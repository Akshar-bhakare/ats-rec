import path from 'path';
import fs from 'fs';
import os from 'os';
import { Poppler } from 'node-poppler';
import mammoth from 'mammoth';
import Tesseract from 'tesseract.js';
import { geminiChatCompletion } from '../aiGeminiCompletions.js';

// Define tmpMediaDir locally to avoid circular dependency with server.js
const tmpMediaDir = path.join(os.tmpdir(), 'AiSelektTmpMedia');

// Ensure temp directory exists
if (!fs.existsSync(tmpMediaDir)) {
    fs.mkdirSync(tmpMediaDir, { recursive: true });
}

/**
 * Extract images from PDF using node-poppler (pdfToCairo)
 * This renders pages to images, which is effective for scanned resumes.
 * @param {string} filePath - Absolute path to PDF file
 * @returns {Promise<string[]>} - Array of image file paths
 */
export async function extractImagesFromPdf(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        console.warn('⚠ [ImageExtractor] Invalid PDF path');
        return [];
    }
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠ [ImageExtractor] PDF not found: ${filePath}`);
        return [];
    }

    console.log(`🖼️ [ImageExtractor] Extracting images from PDF: ${filePath}`);
    const outputPrefix = path.join(tmpMediaDir, `img_extract_${Date.now()}_page`);
    
    try {
        const poppler = new Poppler();
        
        // Quick check if poppler is actually usable/installed could go here, 
        // but try-catch in documentTextExtractor handles the upper level.
        // We will make this robust:
        if (!poppler) throw new Error("Poppler not initialized");
        

        const options = {
            pngFile: true, // Convert to PNG
            singleFile: false // Expect multiple pages potentially
        };
        
        // This will generate files like outputPrefix-1.png, outputPrefix-2.png
        await poppler.pdfToCairo(filePath, outputPrefix, options);
        
        // Find generated files
        const dirFiles = fs.readdirSync(tmpMediaDir);
        const generatedImages = dirFiles
            .filter(f => f.startsWith(path.basename(outputPrefix)) && (f.endsWith('.png') || f.endsWith('.jpg')))
            .map(f => path.join(tmpMediaDir, f));

        console.log(`✅ [ImageExtractor] Extracted ${generatedImages.length} images from PDF`);
        return generatedImages;
    } catch (err) {
        console.error(`❌ [ImageExtractor] PDF extraction failed: ${err?.message || err}`);
        // Fallback: Try pdfimages (extract embedded images) if rendering failed
        // This handles cases where pdfToCairo might not be available or fails
        try {
             console.log(`🔄 [ImageExtractor] Retrying with pdfimages (embedded extraction)...`);
             const poppler = new Poppler();
             const outputPrefixEmb = path.join(tmpMediaDir, `img_embed_${Date.now()}`);
             await poppler.pdfImages(filePath, outputPrefixEmb, { allFiles: true });
             
             const dirFiles = fs.readdirSync(tmpMediaDir);
             const generatedImages = dirFiles
                .filter(f => f.startsWith(path.basename(outputPrefixEmb)))
                .map(f => path.join(tmpMediaDir, f));
                
             console.log(`✅ [ImageExtractor] Extracted ${generatedImages.length} embedded images`);
             return generatedImages;
        } catch (e2) {
             console.error(`❌ [ImageExtractor] PDF embedded extraction failed: ${e2?.message || e2}`);
             return [];
        }
    }
}

/**
 * Extract images from DOCX using Mammoth
 * @param {string} filePath - Absolute path to DOCX file
 * @returns {Promise<string[]>} - Array of image file paths
 */
export async function extractImagesFromDocx(filePath) {
    if (!filePath || typeof filePath !== 'string') {
        console.warn('⚠ [ImageExtractor] Invalid DOCX path');
        return [];
    }
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠ [ImageExtractor] DOCX not found: ${filePath}`);
        return [];
    }

    console.log(`🖼️ [ImageExtractor] Extracting images from DOCX: ${filePath}`);
    const images = [];
    
    try {
        await mammoth.convertToHtml({ path: filePath }, {
            convertImage: mammoth.images.imgElement(function(image) {
                return image.read("base64").then(function(imageBuffer) {
                    const buffer = Buffer.from(imageBuffer, 'base64');
                    const fileName = `docx_img_${Date.now()}_${images.length}.png`; // Mammoth usually returns generic types, assuming png/jpg support handling
                    // We can detect type from image.contentType
                    let ext = '.png';
                    if (image.contentType === 'image/jpeg') ext = '.jpg';
                    if (image.contentType === 'image/gif') ext = '.gif';
                    
                    const outPath = path.join(tmpMediaDir, fileName.replace('.png', ext));
                    try {
                        fs.writeFileSync(outPath, buffer);
                    } catch (err) {
                        console.error(`❌ [ImageExtractor] Failed to write DOCX image: ${err?.message || err}`);
                        throw err;
                    }
                    images.push(outPath);
                    
                    return { src: "data:" + image.contentType + ";base64," + imageBuffer };
                });
            })
        });
        
        console.log(`✅ [ImageExtractor] Extracted ${images.length} images from DOCX`);
        return images;
    } catch (err) {
        console.error(`❌ [ImageExtractor] DOCX extraction failed: ${err?.message || err}`);
        return [];
    }
}

/**
 * Wrapper to extract images based on extension
 */
export async function extractImages(filePath) {
    try {
        const ext = path.extname(filePath).toLowerCase();
        if (ext === '.pdf') {
            return extractImagesFromPdf(filePath);
        } else if (ext === '.docx' || ext === '.doc') {
            // Note: Mammoth only supports .docx. .doc (binary) needs generic failover or external tool.
            if (ext === '.doc') {
                 console.warn(`⚠️ [ImageExtractor] .doc files not supported by local image extractor (requires .docx or PDF conversion).`);
                 return [];
            }
            return extractImagesFromDocx(filePath);
        }
        return [];
    } catch (err) {
        console.error(`❌ [ImageExtractor] extractImages failed: ${err?.message || err}`);
        return [];
    }
}

/* ========================================================================
   SMART FALLBACK SYSTEM
   1. Extract Images -> Local Tesseract OCR
   2. Fallback: Extract Images -> Gemini Vision
   3. Fallback: Full Document -> Gemini Multimodal
   ======================================================================== */

/**
 * Performs local OCR on a list of image paths using Tesseract.js
 */
async function performLocalOCR(imagePaths) {
    if (!Array.isArray(imagePaths) || imagePaths.length === 0) return "";
    
    console.log(`📖 [LocalOCR] Starting Tesseract.js on ${imagePaths.length} images...`);
    let combinedText = "";
    let worker;

    try {
        worker = await Tesseract.createWorker('eng');
        
        for (const imgPath of imagePaths) {
            const { data: { text } } = await worker.recognize(imgPath);
            if (text) combinedText += text + "\n";
        }
        
        console.log(`✅ [LocalOCR] Completed. Extracted ${combinedText.length} characters.`);
    } catch (err) {
        console.error(`❌ [LocalOCR] Failed: ${err?.message || err}`);
    } finally {
        if (worker) {
            try {
                await worker.terminate();
            } catch {
                // ignore terminate errors
            }
        }
    }

    return combinedText.trim();
}

/**
 * Main Entry Point for "Smart Fallback" extraction when standard text extraction fails.
 * @param {string} filePath - Path to the temp file
 * @param {Buffer} fileBuffer - Original file buffer (backup for full doc send)
 * @param {object} req - Request object for config loading
 * @returns {Promise<[string, string]>} - [extractedText, filePath]
 */
export async function processDocumentWithSmartFallback(filePath, fileBuffer, req) {
    if (!filePath || typeof filePath !== 'string') {
        console.error('❌ [SmartFallback] Invalid file path');
        return ["", filePath || ""];
    }
    if (!fs.existsSync(filePath)) {
        console.error(`❌ [SmartFallback] File not found: ${filePath}`);
        return ["", filePath];
    }

    console.log(`🛡️ [SmartFallback] Initiating fallback sequence for: ${path.basename(filePath)}`);
    const isPDF = path.extname(filePath).toLowerCase() === '.pdf';
    
    // --- STEP 1 & 2: EXTRACT IMAGES & TRY LOCAL OCR ---
    let images = [];
    try {
        images = await extractImages(filePath);
        if (images.length > 0) {
            const localOcrText = await performLocalOCR(images);
            if (localOcrText.length > 50) { // Threshold for "meaningful" text
                console.log(`✅ [SmartFallback] Step 1 Success: Local OCR extracted ${localOcrText.length} chars.`);
                return [localOcrText, filePath];
            } else {
                console.log(`⚠️ [SmartFallback] Step 1 Result: Local OCR text too short or empty.`);
            }
        } else {
            console.log(`⚠️ [SmartFallback] Step 1 Result: No images found in document.`);
        }
    } catch (e) {
        console.error(`❌ [SmartFallback] Step 1 Error:`, e);
    }

    // --- STEP 3: FALLBACK TO GEMINI VISION (Send Extracted Images) ---
    if (images.length > 0) {
        console.log(`🚀 [SmartFallback] Step 2: Attempting Gemini Vision with ${images.length} extracted images...`);
        try {
            const contentParts = [
                { type: 'text', text: "Transcribe the text in these images exactly as it appears." }
            ];

            for (const imgPath of images) {
                let imgBuf;
                try {
                    imgBuf = fs.readFileSync(imgPath);
                } catch (err) {
                    throw new Error(`Failed to read image ${imgPath}: ${err?.message || err}`);
                }
                const b64 = imgBuf.toString('base64');
                const ext = path.extname(imgPath).toLowerCase();
                const mime = ext === '.png' ? 'image/png' : (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'image/png';
                
                contentParts.push({
                    type: 'inline_data',
                    mimeType: mime,
                    data: b64
                });
            }

            const messages = [{ role: 'user', content: contentParts }];
            // Use config instructions to possibly use a Pro model if available or rely on default
            const aiResp = await geminiChatCompletion(messages, req, 0); 
            const aiText = aiResp.choices[0]?.message?.content || "";

            if (aiText && aiText.trim().length > 50) {
                console.log(`✅ [SmartFallback] Step 2 Success: AI Vision extracted ${aiText.length} chars.`);
                return [aiText, filePath];
            }
             console.log(`⚠️ [SmartFallback] Step 2 Result: AI Vision text too short.`);

        } catch (e) {
            console.error(`❌ [SmartFallback] Step 2 Error:`, e);
        }
    }

    // --- STEP 4: FINAL FALLBACK - SEND FULL DOCUMENT TO GEMINI ---
    console.log(`🚀 [SmartFallback] Step 3: Attempting Full Document -> Gemini...`);
    
    // We only reliably support PDF for "Full Doc" mode in this context. 
    // DOCX support depends on the model, but usually PDF is the standard for "Document Understanding".
    if (!isPDF) {
        console.warn(`⚠️ [SmartFallback] Step 3 Skipped: Full document fallback currently optimized for PDF only (File is ${path.extname(filePath)}).`);
        return ["", filePath];
    }

    try {
        if (!fileBuffer || fileBuffer.length === 0) {
             // Try reading from file path if buffer missing
             fileBuffer = fs.readFileSync(filePath);
        }

        if (!Buffer.isBuffer(fileBuffer)) {
            try {
                fileBuffer = Buffer.from(fileBuffer);
            } catch (err) {
                throw new Error(`Invalid file buffer: ${err?.message || err}`);
            }
        }

        const b64 = fileBuffer.toString('base64');
        const contentParts = [
             { type: 'text', text: "OCR TASK: Transcribe all text from this complete document word-for-word." },
             {
                 type: 'inline_data',
                 mimeType: 'application/pdf',
                 data: b64
             }
        ];
        
        const messages = [{ role: 'user', content: contentParts }];
        const aiResp = await geminiChatCompletion(messages, req, 0);
        const aiText = aiResp.choices[0]?.message?.content || "";
        
        if (aiText && aiText.trim().length > 20) {
             console.log(`✅ [SmartFallback] Step 3 Success: Full Doc AI extracted ${aiText.length} chars.`);
             return [aiText, filePath];
        }
        
    } catch (e) {
        console.error(`❌ [SmartFallback] Step 3 Error:`, e);
    }

    console.error(`❌ [SmartFallback] All fallback methods failed.`);
    return ["", filePath];
}
