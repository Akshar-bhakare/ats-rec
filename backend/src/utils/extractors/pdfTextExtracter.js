// backend/src/utils/extractors/pdfTextExtractor.js
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { PDFExtract } from 'pdf.js-extract';
import { PdfReader } from 'pdfreader';
import { Poppler } from 'node-poppler';
import { tmpMediaDir } from '../../../server.js';

export async function extractPdfText(buffer, filename = '') {
    if (!buffer) {
        throw new Error('PDF buffer is required');
    }

    let safeBuffer = buffer;
    if (!Buffer.isBuffer(safeBuffer)) {
        try {
            safeBuffer = Buffer.from(safeBuffer);
        } catch (err) {
            throw new Error(`Invalid PDF buffer: ${err?.message || err}`);
        }
    }

    // 0) write buffer → temp PDF
    let safeName = '';
    try {
        safeName = String(filename || '').replace(/\W+/g, '_');
    } catch {
        safeName = '';
    }
    if (!safeName) safeName = randomUUID();

    const tmpFile = path.join(tmpMediaDir, `tmp_${safeName}.pdf`);
    try {
        fs.writeFileSync(tmpFile, safeBuffer);
    } catch (err) {
        console.error(`❌ [Local] Failed to write temp PDF: ${err?.message || err}`);
        throw err;
    }
    console.log(`📥 [Local] PDF written to: ${tmpFile}`);

    // helper: throw if empty
    const ensure = (txt, label) => {
        if (!txt || !txt.trim()) {
            throw new Error(`${label} returned empty text`);
        }
        return txt;
    };

    let lastError = null;

    // 1) pdf.js-extract
    try {
        console.log('🔄 [Step 1] pdf.js-extract starting…');
        const extractor = new PDFExtract();
        const data = await new Promise((res, rej) =>
            extractor.extract(tmpFile, {}, (err, d) => (err ? rej(err) : res(d)))
        );

        if (!data || !Array.isArray(data.pages)) {
            throw new Error('pdf.js-extract returned invalid data');
        }

        let txt = '';
        for (const page of data.pages) {
            const content = Array.isArray(page?.content) ? page.content : [];
            for (const item of content) {
                txt += item.str + ' ';
            }
            txt += '\n\n';
        }

        console.log('✅ [Step 1] pdf.js-extract succeeded');
        console.log(
            '📄 [Step 1] snippet:',
            txt.slice(0, 200).replace(/\s+/g, ' '),
            '…'
        );
        return ensure(txt, 'pdf.js-extract');
    } catch (e) {
        lastError = e;
        console.log('❌ [Step 1] pdf.js-extract failed:', e.stack || e.message);
    }

    // 2) node-poppler
    try {
        console.log('🔄 [Step 2] node-poppler starting…');
        const outTxt = tmpFile.replace(/\.pdf$/i, '.txt');
        await new Poppler().pdfToText(tmpFile, outTxt);
        const txt = fs.readFileSync(outTxt, 'utf8');
        console.log('✅ [Step 2] node-poppler succeeded →', outTxt);
        return ensure(txt, 'node-poppler');
    } catch (e) {
        lastError = e;
        console.log('❌ [Step 2] node-poppler failed:', e.stack || e.message);
    }

    // 3) pdfreader fallback
    try {
        console.log('🔄 [Step 3] pdfreader fallback starting…');
        const items = [];
        await new Promise((res, rej) => {
            new PdfReader().parseFileItems(tmpFile, (err, item) => {
                if (err) return rej(err);
                if (!item) return res(); // EOF
                const chunk = item.str ?? item.text;
                if (chunk && typeof chunk === 'string') items.push(chunk);
            });
        });

        console.log(`✅ [Step 3] pdfreader succeeded, items: ${items.length}`);
        const txt = items.join(' ');
        console.log('📄 [Step 3] full text:', txt);
        return ensure(txt, 'pdfreader');
    } catch (e) {
        lastError = e;
        console.log('❌ [Step 3] pdfreader failed:', e.stack || e.message);
    }

    // nothing worked
    const lastMsg = lastError?.message || lastError || 'unknown error';
    throw new Error(`All local extraction methods failed: ${lastMsg}`);
}
