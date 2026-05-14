// backend\src\utils\extractors\wordTextExtracter.js
import fs from 'fs';
import os from 'os';
import path from 'path';
import mammoth from 'mammoth';                    // DOCX → text
import WordExtractor from 'word-extractor';       // DOC  → text
import * as officeExtract from 'office-text-extractor'; // DOCX → text
import anyText from 'any-text';                   // many formats

/* small helpers */
const tmpFile = async (buf, ext = '.bin') => {
    const p = path.join(os.tmpdir(), `uwx_${Date.now()}${ext}`);
    try {
        await fs.promises.writeFile(p, buf);
    } catch (err) {
        throw new Error(`Failed to write temp file: ${err?.message || err}`);
    }
    return p;
};
const safeUnlink = (p) => fs.promises.unlink(p).catch(() => { });

/**
 * anyTextProm – promisified wrapper
 */
// safer wrapper: never allow unhandled rejection
const anyTextProm = (file) =>
    new Promise((res) =>
        anyText.getText(file, (err, txt) => {
            if (err) {
                console.warn("⚠ any-text failed silently:", err.message);
                return res(null);
            }
            res(txt);
        })
    );


/**
 * Extract text from DOC / DOCX with fallbacks
 * @param {String|Buffer} input  – path or Buffer
 * @param {String} [nameHint]    – e.g. "cv.doc" if input is Buffer
 */
export async function extractWordText(input, nameHint = '') {
    if (!input) {
        console.warn('⚠ [Start] extractWordText – missing input');
        return { ok: false, error: new Error('No input provided') };
    }

    const isBuf = Buffer.isBuffer(input);
    if (!isBuf && typeof input !== 'string') {
        console.warn('⚠ [Start] extractWordText – invalid input type');
        return { ok: false, error: new Error('Invalid input type') };
    }

    const safeNameHint = isBuf ? String(nameHint || '') : String(input || '');
    const origExt = (path.extname(safeNameHint) || '').toLowerCase();
    const ext = origExt === '.doc' || origExt === '.docx' ? origExt : '.docx';

    let workPath;
    try {
        workPath = isBuf ? await tmpFile(input, ext) : path.resolve(input);
    } catch (err) {
        console.warn(`❌ [Start] extractWordText failed to prepare file: ${err?.message || err}`);
        return { ok: false, error: err };
    }

    let lastError = null;

    console.log(`⏩ [Start] extractWordText – file="${workPath}", ext="${ext}"`);

    /* ---------- DOCX chain ---------- */
    if (ext === '.docx') {
        // Step 1: mammoth
        try {
            // console.log('🔄 [Step 1] mammoth.extractRawText starting…');
            const res = await mammoth.extractRawText({ path: workPath });
            const value = typeof res?.value === 'string' ? res.value : '';
            // console.log(
            //     `✅ [Step 1] mammoth OK – extracted ${value.length} char(s)`
            // );
            if (isBuf) await safeUnlink(workPath);
            return { ok: true, text: value, src: 'mammoth' };
        } catch (e) {
            lastError = e;
            console.warn(`❌ [Step 1] mammoth failed: ${e.message}`);
        }

        // Step 2: office-text-extractor
        try {
            // console.log('🔄 [Step 2] office-text-extractor starting…');
            const value = await officeExtract(workPath);
            const text = typeof value === 'string' ? value : '';
            // console.log(
            //     `✅ [Step 2] office-text-extractor OK – extracted ${value.length} char(s)`
            // );
            if (isBuf) await safeUnlink(workPath);
            return { ok: true, text, src: 'office-text-extractor' };
        } catch (e) {
            lastError = e;
            console.warn(`❌ [Step 2] office-text-extractor failed: ${e.message}`);
        }
    }

    /* ---------- DOC main path ---------- */
    if (ext === '.doc') {
        // Step 3: word-extractor
        try {
            console.log('🔄 [Step 3] word-extractor starting…');
            const extractor = new WordExtractor();
            const doc = await extractor.extract(workPath);
            const body = typeof doc?.getBody === 'function' ? (doc.getBody() || '') : '';
            console.log(
                `✅ [Step 3] word-extractor OK – extracted ${body.length} char(s)`
            );
            if (isBuf) await safeUnlink(workPath);
            return { ok: true, text: body, src: 'word-extractor' };
        } catch (e) {
            lastError = e;
            console.warn(`❌ [Step 3] word-extractor failed: ${e.message}`);
        }
    }

    // Step 5: any-text with OLE safety guard
    try {
        console.log('🔄 [Step 5] any-text starting…');

        // Prevent OLE-parsing on non-DOC files
        if (ext === '.doc') {
            const sig = fs.readFileSync(workPath).slice(0, 4).toString('hex').toUpperCase();
            const isOle = sig === 'D0CF11E0';

            if (!isOle) {
                console.warn('⚠ Not a valid OLE DOC file. Skipping any-text to avoid "Not a valid compound document".');
                throw new Error('Invalid DOC file format');
            }
        }

        const txt = await anyTextProm(workPath);
        if (!txt || typeof txt !== 'string') {
            throw new Error('any-text returned empty text');
        }
        console.log(`✅ [Step 5] any-text OK – extracted ${txt.length} char(s)`);
        if (isBuf) await safeUnlink(workPath);
        return { ok: true, text: txt, src: 'any-text' };

    } catch (e) {
        lastError = e;
        console.warn(`❌ [Step 5] any-text failed: ${e.message}`);
    }

    // All failed
    if (isBuf) await safeUnlink(workPath);
    console.log('❌ [End] All extractors failed');
    return { ok: false, error: lastError || new Error('No extractor succeeded') };
}

/* ─────────────── CLI helper ─────────────── */
if (import.meta.url === `file://${process.argv[1]}` && process.argv[2]) {
    (async () => {
        const res = await extractWordText(process.argv[2]);
        if (res.ok) {
            console.log('\n──────────── EXTRACTED TEXT ────────────\n');
            console.log(res.text.trim());
        } else {
            console.log('❌ Extraction failed:', res.error);
        }
    })();
}

