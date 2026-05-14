// backend\src\utils\documentTextExtractor.js
import fs from "fs";
import path from "path";
import dotenv from 'dotenv';
import ILovePDFApi from "@ilovepdf/ilovepdf-nodejs";
import ILovePDFFile from "@ilovepdf/ilovepdf-nodejs/ILovePDFFile.js";
import os from 'os';
// Define tmpMediaDir locally to avoid circular dependency
const tmpMediaDir = path.join(os.tmpdir(), 'AiSelektTmpMedia');
import { extractPdfText } from "./extractors/pdfTextExtracter.js";
import { extractWordText } from "./extractors/wordTextExtracter.js";
import { processDocumentWithSmartFallback } from "./extractors/imageExtractor.js";
import { loadKeysConfigFromDB } from "./dbUtils.js";

dotenv.config();

async function loadILovePDFKeys(req) {
    let cfg;
    try {
        cfg = await loadKeysConfigFromDB({ $in: ['Document'] }, 'ILovePDFAPI', req);
    } catch (err) {
        throw new Error(`[ILovePDF] Failed to load keys from DB: ${err?.message || err}`);
    }

    if (cfg?.configurationDetails?.apiKey && cfg.configurationDetails?.secretKey) {
        const { apiKey, secretKey } = cfg.configurationDetails;
        return { publicKey: apiKey, secretKey };
    }

    if (process.env.ILOVEPDF_PUBLIC_KEY && process.env.ILOVEPDF_SECRET_KEY) {
        return {
            publicKey: process.env.ILOVEPDF_PUBLIC_KEY,
            secretKey: process.env.ILOVEPDF_SECRET_KEY
        };
    }

    throw new Error("No ILovePDF keys found in database or environment variables");
}

const cleanText = (txt) => {
    if (!txt) return "";
    try {
        return txt.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F\uFFFD]/g, "").trim();
    } catch (err) {
        console.error(`[TextExtract] cleanText failed: ${err?.message || err}`);
        return "";
    }
};

export const extractResumeText = async (
    fileBuffer,
    defaultFileName,
    req
) => {
    // Normalize to Buffer
    if (typeof fileBuffer === "string") {
        console.error("[TextExtract] Invalid fileBuffer: expected binary data, received string");
        return ["", ""];
    }

    try {
        fileBuffer = Buffer.isBuffer(fileBuffer)
            ? fileBuffer
            : Buffer.from(fileBuffer);
    } catch (err) {
        console.error(`[TextExtract] Failed to normalize file buffer: ${err?.message || err}`);
        return ["", ""];
    }

    const safeFileName = (typeof defaultFileName === "string" && defaultFileName)
        ? defaultFileName
        : "unknown";

    if (safeFileName !== defaultFileName) {
        console.warn(`[TextExtract] Missing or invalid filename; using "${safeFileName}"`);
    }

    let extIn = "";
    try {
        extIn = (path.extname(safeFileName) || "").toLowerCase();
    } catch (err) {
        console.error(`[TextExtract] Failed to parse file extension: ${err?.message || err}`);
        extIn = "";
    }

    const isPDF = extIn === ".pdf" || !extIn;
    const tmpPath = path.join(
        tmpMediaDir,
        `tmpResume_${safeFileName.replace(/\W+/g, '_')}${extIn || ".pdf"}`
    );

    try {
        fs.writeFileSync(tmpPath, fileBuffer);
    } catch (err) {
        console.error(`[ILovePDF] Step 0 failed: could not write temp file: ${err?.message || err}`);
        return ["", ""];
    }

    let ilovepdf;
    try {
        const keys = await loadILovePDFKeys(req);
        ilovepdf = new ILovePDFApi(keys.publicKey, keys.secretKey);
    } catch (err) {
        console.error(`[ILovePDF] Step 0 failed: initialization error: ${err?.message || err} (continuing to local/AI tools)`);
        // return ["", ""]; <--- Don't exit, allow local tools to run!
    }

    const runExtract = async (fileForTask) => {
        try {
            if (!ilovepdf) {
                throw new Error("ILovePDF client not initialized");
            }
            const fileObj = new ILovePDFFile(fileForTask);
            const task = ilovepdf.newTask("extract");
            await task.start();
            await task.addFile(fileObj);
            await task.process();
            return task.download();
        } catch (err) {
            throw new Error(`[ILovePDF] Extract task failed: ${err?.message || err}`);
        }
    };

    if (isPDF) {
        // 1) Local extraction
        try {
            // console.log(`Step 1: Local extractPdfText("${safeFileName}")`);
            const localText = await extractPdfText(fileBuffer, safeFileName);

            if (localText && localText.trim().length > 100) {
                // console.log(
                //     `Step 1 succeeded: ${localText.length} char(s) extracted locally`
                // );
                return [cleanText(localText), tmpPath];
            }
            console.warn(`[TextExtract] Step 1 warning: local text insufficient (${localText?.length || 0} chars). Trying fallbacks...`);

        } catch (err) {
            console.error(`[TextExtract] Step 1 failed: ${err?.message || err}`);
        }

        // 2) Remote extraction attempt #1
        try {
            if (ilovepdf) {
                // console.log("Step 2: Remote extract attempt #1");
                const buf1 = await runExtract(tmpPath);
                const txt1 = buf1.toString("utf8");
                if (txt1 && txt1.trim().length > 50) {
                    return [cleanText(txt1), tmpPath];
                }
                console.warn(`[TextExtract] Step 2 warning: remote text insufficient (${txt1?.length || 0} chars).`);
            }
        } catch (err1) {
            console.error(`[TextExtract] Step 2 failed: ${err1?.message || err1}`);
        }

        // 3) Remote extraction attempt #2 (time-shift)
        const realNow = Date.now;
        Date.now = () => realNow() - 5.5 * 60 * 60 * 1000;
        try {
            if (ilovepdf) {
                // console.log("Step 3: Remote extract retry #2");
                const buf2 = await runExtract(tmpPath);
                const txt2 = buf2.toString("utf8");

                if (txt2 && txt2.trim().length > 50) {
                    return [cleanText(txt2), tmpPath];
                }
                console.warn(`[TextExtract] Step 3 warning: remote text insufficient (${txt2?.length || 0} chars).`);
            }
        } catch (err2) {
            console.error(`[TextExtract] Step 3 failed: ${err2?.message || err2}`);
        } finally {
            Date.now = realNow;
        }
    }


    // 4) DOC / DOCX via word-extractor
    if (extIn === ".doc" || extIn === ".docx") {
        try {
            const { ok, text } = await extractWordText(tmpPath);
            if (ok && text && text.trim().length > 50) {
                return [cleanText(text), tmpPath];
            }
            console.warn(`[TextExtract] Step 4 warning: DOC/DOCX extraction sparse, trying image extraction...`);
        } catch (err) {
            console.error(`[TextExtract] Step 4 failed: ${err?.message || err}`);
        }
    }


    // NEW STEP: Smart Fallback (Local Image OCR -> Gemini Vision -> Gemini Full Doc)
    try {
        return await processDocumentWithSmartFallback(tmpPath, fileBuffer, req);
    } catch (smartErr) {
        console.error(`[TextExtract] Smart fallback failed: ${smartErr?.message || smartErr}`);
    }



    // 5) Fallback Office->PDF->recurse (Existing ILovePDF fallback)
    try {
        console.log(`[TextExtract] Step 5: Office->PDF fallback for "${safeFileName}"`);
        if (!ilovepdf) {
            throw new Error("ILovePDF client not initialized; cannot run Office->PDF fallback");
        }
        const officeTask = ilovepdf.newTask("officepdf");

        await officeTask.start();
        await officeTask.addFile(new ILovePDFFile(tmpPath));
        await officeTask.process();
        const pdfBuf = await officeTask.download();
        const pdfPath = tmpPath.replace(path.extname(tmpPath), ".pdf");
        fs.writeFileSync(pdfPath, pdfBuf);
        console.log(`[TextExtract] Step 5: Re-running extractResumeText on converted PDF`);
        const [resText, resPath] = await extractResumeText(pdfBuf, pdfPath, req);
        return [cleanText(resText), resPath];
    } catch (err) {
        console.error(`[TextExtract] Step 5 failed: ${err?.message || err}`);
        return ["", ""];
    }
};
