const FACEAPI_MODEL_URL = (
    import.meta.env?.VITE_FACEAPI_MODEL_URL ||
    "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model/"
).replace(/\/+$/, "/");

let faceApiModule = null;
let faceApiReady = false;
let faceApiLoading = null;

let nativeFaceDetectorInstance = null;
let nativeFaceDetectorTried = false;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const toFiniteNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const loadFaceApiModule = async () => {
    if (faceApiModule) return faceApiModule;
    faceApiModule = await import("@vladmandic/face-api");
    return faceApiModule;
};

const ensureFaceApiReady = async () => {
    if (faceApiReady && faceApiModule) return faceApiModule;
    if (faceApiLoading) return faceApiLoading;

    faceApiLoading = (async () => {
        if (typeof window === "undefined") {
            throw new Error("face-api requires a browser environment");
        }

        const faceapi = await loadFaceApiModule();
        const tf = faceapi?.tf;

        if (tf?.setBackend) {
            try {
                await tf.setBackend("webgl");
            } catch {
                await tf.setBackend("cpu");
            }
            await tf.ready();
        }

        const modelPath = FACEAPI_MODEL_URL;
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(modelPath),
            faceapi.nets.faceLandmark68Net.loadFromUri(modelPath),
            faceapi.nets.faceRecognitionNet.loadFromUri(modelPath)
        ]);

        faceApiReady = true;
        console.log("[FaceIdentity] face-api models ready", {
            backend: tf?.getBackend?.() || "unknown",
            modelPath
        });
        return faceapi;
    })().catch((err) => {
        faceApiReady = false;
        faceApiLoading = null;
        console.warn("[FaceIdentity] Failed to initialise face-api:", err?.message || err);
        throw err;
    });

    return faceApiLoading;
};

const getNativeFaceDetector = () => {
    if (nativeFaceDetectorTried) return nativeFaceDetectorInstance;
    nativeFaceDetectorTried = true;

    if (typeof window === "undefined") return null;
    if (!window.isSecureContext || typeof window.FaceDetector !== "function") {
        return null;
    }

    try {
        nativeFaceDetectorInstance = new window.FaceDetector({
            fastMode: true,
            maxDetectedFaces: 5
        });
        return nativeFaceDetectorInstance;
    } catch (err) {
        console.warn("[FaceIdentity] Native FaceDetector unavailable:", err?.message || err);
        nativeFaceDetectorInstance = null;
        return null;
    }
};

const normalizeFaceBox = (face) => {
    if (!face || typeof face !== "object") return null;

    if (face.boundingBox) {
        const box = face.boundingBox;
        const x = toFiniteNumber(box.x ?? box.left ?? box.originX ?? box.xMin, NaN);
        const y = toFiniteNumber(box.y ?? box.top ?? box.originY ?? box.yMin, NaN);
        const width = toFiniteNumber(box.width ?? (box.right - box.left), NaN);
        const height = toFiniteNumber(box.height ?? (box.bottom - box.top), NaN);
        if ([x, y, width, height].every(Number.isFinite)) {
            return { x, y, width, height };
        }
    }

    if (face.box) {
        const box = face.box;
        const x = toFiniteNumber(box.xMin ?? box.x ?? box.left, NaN);
        const y = toFiniteNumber(box.yMin ?? box.y ?? box.top, NaN);
        const width = toFiniteNumber(box.width ?? (box.xMax - box.xMin), NaN);
        const height = toFiniteNumber(box.height ?? (box.yMax - box.yMin), NaN);
        if ([x, y, width, height].every(Number.isFinite)) {
            return { x, y, width, height };
        }
    }

    const topLeft = face.topLeft;
    const bottomRight = face.bottomRight;
    if (
        Array.isArray(topLeft) &&
        topLeft.length >= 2 &&
        Array.isArray(bottomRight) &&
        bottomRight.length >= 2
    ) {
        const x = toFiniteNumber(topLeft[0], NaN);
        const y = toFiniteNumber(topLeft[1], NaN);
        const width = toFiniteNumber(bottomRight[0], NaN) - x;
        const height = toFiniteNumber(bottomRight[1], NaN) - y;
        if ([x, y, width, height].every(Number.isFinite)) {
            return { x, y, width, height };
        }
    }

    return null;
};

const normalizeCropBox = (box, sourceWidth, sourceHeight, expandRatio = 0.25) => {
    if (!box) return null;
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const expandedWidth = box.width * (1 + expandRatio);
    const expandedHeight = box.height * (1 + expandRatio);

    const x = clamp(centerX - expandedWidth / 2, 0, sourceWidth - 1);
    const y = clamp(centerY - expandedHeight / 2, 0, sourceHeight - 1);
    const maxWidth = sourceWidth - x;
    const maxHeight = sourceHeight - y;
    const width = clamp(expandedWidth, 1, maxWidth);
    const height = clamp(expandedHeight, 1, maxHeight);

    return { x, y, width, height };
};

const buildDescriptorFromImageData = (imageData) => {
    const { data, width, height } = imageData;
    const pixelCount = width * height;
    if (!pixelCount || data.length < pixelCount * 4) {
        return null;
    }

    const grayscale = new Float32Array(pixelCount);
    let mean = 0;

    for (let i = 0; i < pixelCount; i += 1) {
        const idx = i * 4;
        const gray =
            0.299 * data[idx] +
            0.587 * data[idx + 1] +
            0.114 * data[idx + 2];
        grayscale[i] = gray;
        mean += gray;
    }
    mean /= pixelCount;

    let variance = 0;
    for (let i = 0; i < pixelCount; i += 1) {
        const delta = grayscale[i] - mean;
        variance += delta * delta;
    }
    variance /= pixelCount;
    const std = Math.sqrt(variance) || 1;

    const descriptor = new Array(pixelCount);
    for (let i = 0; i < pixelCount; i += 1) {
        descriptor[i] = (grayscale[i] - mean) / std;
    }

    return { descriptor, grayscale, mean, std };
};

const scoreFaceClarity = ({ grayscale, mean, std, width, height }) => {
    let sharpnessAccum = 0;
    let sharpnessCount = 0;

    for (let y = 1; y < height; y += 1) {
        for (let x = 1; x < width; x += 1) {
            const idx = y * width + x;
            const current = grayscale[idx];
            const left = grayscale[idx - 1];
            const top = grayscale[idx - width];
            sharpnessAccum += Math.abs(current - left) + Math.abs(current - top);
            sharpnessCount += 2;
        }
    }

    const sharpness = sharpnessCount ? sharpnessAccum / sharpnessCount : 0;
    const brightnessScore = 1 - Math.min(1, Math.abs(mean - 128) / 128);
    const contrastScore = Math.min(1, std / 64);
    const sharpnessScore = Math.min(1, sharpness / 28);

    const qualityScore = Math.round(
        (brightnessScore * 0.25 + contrastScore * 0.35 + sharpnessScore * 0.4) * 100
    );
    const clarityScore = Math.round((contrastScore * 0.45 + sharpnessScore * 0.55) * 100);

    let clarityReason = "Clear image";
    if (mean < 45) clarityReason = "Image too dark";
    else if (mean > 220) clarityReason = "Image too bright";
    else if (sharpnessScore < 0.35) clarityReason = "Image appears blurry";
    else if (contrastScore < 0.2) clarityReason = "Low contrast in face area";

    return {
        qualityScore,
        clarityScore,
        clarityReason,
        details: {
            brightness: Math.round(mean),
            contrast: Number(std.toFixed(2)),
            sharpness: Number(sharpness.toFixed(2))
        }
    };
};

export const isVerificationMediaClear = ({
    qualityScore,
    clarityScore,
    minQualityScore = 45,
    minClarityScore = 35
}) =>
    Number.isFinite(qualityScore) &&
    Number.isFinite(clarityScore) &&
    qualityScore >= minQualityScore &&
    clarityScore >= minClarityScore;

export const detectFacesForElement = async (sourceEl) => {
    if (!sourceEl) return { faces: [], backend: null };

    try {
        const faceapi = await ensureFaceApiReady();
        const detections = await faceapi.detectAllFaces(
            sourceEl,
            new faceapi.SsdMobilenetv1Options({ minConfidence: 0.55 })
        );
        const faces = (detections || [])
            .map((d) => normalizeFaceBox({ box: d?.box || d?.detection?.box }))
            .filter(Boolean);
        if (faces.length) {
            return {
                faces,
                backend: `face-api(${faceapi?.tf?.getBackend?.() || "tf"})`
            };
        }
    } catch (err) {
        console.warn("[FaceIdentity] face-api detect failed, falling back:", err?.message || err);
    }

    const nativeDetector = getNativeFaceDetector();
    if (nativeDetector) {
        try {
            const faces = await nativeDetector.detect(sourceEl);
            return { faces: Array.isArray(faces) ? faces : [], backend: "native" };
        } catch (err) {
            console.warn("[FaceIdentity] Native detect failed:", err?.message || err);
        }
    }

    return { faces: [], backend: "none" };
};

export const createFaceDescriptorFromSource = async (
    sourceEl,
    { descriptorSize = 32, minFaceRatio = 0.12 } = {}
) => {
    if (!sourceEl) {
        return { ok: false, error: "No source provided", faceCount: 0, descriptor: [], legacyDescriptor: [], qualityScore: 0, clarityScore: 0 };
    }

    const sourceWidth = toFiniteNumber(sourceEl.videoWidth || sourceEl.naturalWidth || sourceEl.width, 0);
    const sourceHeight = toFiniteNumber(sourceEl.videoHeight || sourceEl.naturalHeight || sourceEl.height, 0);
    if (sourceWidth <= 0 || sourceHeight <= 0) {
        return { ok: false, error: "Source dimensions not ready", faceCount: 0, descriptor: [], legacyDescriptor: [], qualityScore: 0, clarityScore: 0 };
    }

    let backend = "face-api";
    let faceCount = 0;
    let faceBox = null;
    let faceConfidence = null;
    let faceapiDetection = null;

    try {
        const faceapi = await ensureFaceApiReady();
        const detections = await faceapi
            .detectAllFaces(sourceEl, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.55 }))
            .withFaceLandmarks()
            .withFaceDescriptors();

        faceCount = Array.isArray(detections) ? detections.length : 0;

        if (faceCount === 1 && detections[0]?.descriptor?.length) {
            faceapiDetection = detections[0];
            faceBox = normalizeFaceBox({ box: detections[0]?.detection?.box || detections[0]?.box });
            faceConfidence = toFiniteNumber(detections[0]?.detection?.score, null);
            backend = `face-api(${faceapi?.tf?.getBackend?.() || "tf"})`;
        } else if (faceCount > 1) {
            return { ok: false, error: "Multiple faces detected", backend, faceCount, descriptor: [], legacyDescriptor: [], qualityScore: 0, clarityScore: 0, clarityReason: "More than one face visible", faceBox: null };
        }
    } catch (err) {
        console.warn("[FaceIdentity] face-api descriptor failed, using legacy fallback:", err?.message || err);
        faceapiDetection = null;
    }

    if (!faceapiDetection) {
        const { faces, backend: fallbackBackend } = await detectFacesForElement(sourceEl);
        const faceBoxes = faces.map(normalizeFaceBox).filter(Boolean);
        faceCount = faceBoxes.length;
        backend = fallbackBackend || backend;

        if (faceCount !== 1) {
            return {
                ok: false,
                error: faceCount === 0 ? "No face detected" : "Multiple faces detected",
                backend, faceCount, descriptor: [], legacyDescriptor: [], qualityScore: 0, clarityScore: 0,
                clarityReason: faceCount === 0 ? "No clear face found" : "More than one face visible",
                faceBox: null
            };
        }
        faceBox = faceBoxes[0];
    }

    if (!faceBox) {
        return { ok: false, error: "No face detected", backend, faceCount, descriptor: [], legacyDescriptor: [], qualityScore: 0, clarityScore: 0, clarityReason: "No clear face found", faceBox: null };
    }

    const faceArea = faceBox.width * faceBox.height;
    const frameArea = sourceWidth * sourceHeight;
    const faceRatio = frameArea > 0 ? faceArea / frameArea : 0;

    if (faceRatio < minFaceRatio) {
        return { ok: false, error: "Face is too small in frame", backend, faceCount, descriptor: [], legacyDescriptor: [], qualityScore: 0, clarityScore: 0, clarityReason: "Move closer to camera", faceBox };
    }

    const crop = normalizeCropBox(faceBox, sourceWidth, sourceHeight);
    if (!crop) {
        return { ok: false, error: "Failed to crop face area", backend, faceCount, descriptor: [], legacyDescriptor: [], qualityScore: 0, clarityScore: 0, clarityReason: "Unable to process face crop", faceBox };
    }

    const clarityCanvasSize = 96;
    const clarityCanvas = document.createElement("canvas");
    clarityCanvas.width = clarityCanvasSize;
    clarityCanvas.height = clarityCanvasSize;
    const clarityCtx = clarityCanvas.getContext("2d", { willReadFrequently: true });
    if (!clarityCtx) {
        return { ok: false, error: "Canvas context unavailable", backend, faceCount, descriptor: [], legacyDescriptor: [], qualityScore: 0, clarityScore: 0, clarityReason: "Canvas context unavailable", faceBox };
    }
    clarityCtx.drawImage(sourceEl, crop.x, crop.y, crop.width, crop.height, 0, 0, clarityCanvasSize, clarityCanvasSize);
    const clarityData = clarityCtx.getImageData(0, 0, clarityCanvasSize, clarityCanvasSize);
    const clarityComputed = buildDescriptorFromImageData(clarityData);
    if (!clarityComputed) {
        return { ok: false, error: "Failed to compute clarity", backend, faceCount, descriptor: [], legacyDescriptor: [], qualityScore: 0, clarityScore: 0, clarityReason: "Descriptor generation failed", faceBox };
    }
    const clarity = scoreFaceClarity({ grayscale: clarityComputed.grayscale, mean: clarityComputed.mean, std: clarityComputed.std, width: clarityCanvasSize, height: clarityCanvasSize });

    const legacyCanvas = document.createElement("canvas");
    legacyCanvas.width = descriptorSize;
    legacyCanvas.height = descriptorSize;
    const legacyCtx = legacyCanvas.getContext("2d", { willReadFrequently: true });
    if (legacyCtx) {
        legacyCtx.drawImage(sourceEl, crop.x, crop.y, crop.width, crop.height, 0, 0, descriptorSize, descriptorSize);
    }
    const legacyData = legacyCtx?.getImageData(0, 0, descriptorSize, descriptorSize) || null;
    const legacyComputed = legacyData ? buildDescriptorFromImageData(legacyData) : null;

    const descriptor =
        faceapiDetection?.descriptor && faceapiDetection.descriptor.length
            ? Array.from(faceapiDetection.descriptor)
            : (legacyComputed?.descriptor || []);

    const legacyDescriptor = legacyComputed?.descriptor || [];

    if (!descriptor.length) {
        return { ok: false, error: "Failed to compute descriptor", backend, faceCount, descriptor: [], legacyDescriptor, qualityScore: 0, clarityScore: 0, clarityReason: "Descriptor generation failed", faceBox };
    }

    return {
        ok: true,
        backend,
        faceCount,
        descriptor,
        legacyDescriptor,
        qualityScore: clarity.qualityScore,
        clarityScore: clarity.clarityScore,
        clarityReason: clarity.clarityReason,
        clarityDetails: clarity.details,
        faceBox,
        faceConfidence
    };
};

export const compareFaceDescriptors = (referenceDescriptor = [], liveDescriptor = []) => {
    const a = Array.isArray(referenceDescriptor) ? referenceDescriptor : [];
    const b = Array.isArray(liveDescriptor) ? liveDescriptor : [];
    const size = Math.min(a.length, b.length);
    if (size < 32) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < size; i += 1) {
        const av = toFiniteNumber(a[i], 0);
        const bv = toFiniteNumber(b[i], 0);
        dot += av * bv;
        normA += av * av;
        normB += bv * bv;
    }

    if (normA <= 0 || normB <= 0) return 0;
    const cosine = dot / (Math.sqrt(normA) * Math.sqrt(normB));
    const normalized = clamp((cosine + 1) / 2, 0, 1);
    return Math.round(normalized * 10000) / 100;
};
