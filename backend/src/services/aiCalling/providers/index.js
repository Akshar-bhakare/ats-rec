import plivoProvider from "./plivoProvider.js";
import telnyxProvider from "./telnyxProvider.js";

const providerMap = {
    plivo: plivoProvider,
    telnyx: telnyxProvider,
};

export const normalizeCountryCode = (code) => String(code || "").replace(/\D/g, "");

export const selectProviderForCandidate = (candidate, fallback = null) => {
    const numericCode = normalizeCountryCode(candidate?.countryCode);
    if (numericCode === "91") return "plivo";
    if (numericCode) return "telnyx";

    const rawCountry = String(candidate?.country || "").toLowerCase();
    if (rawCountry.includes("india")) return "plivo";
    if (rawCountry) return "telnyx";

    if (fallback) return fallback;
    const envDefault = String(process.env?.AI_CALL_PROVIDER || "plivo").trim().toLowerCase();
    return envDefault === "telnyx" ? "telnyx" : "plivo";
};

export const getProviderPlugin = (providerName) => {
    const normalized = String(providerName || "").trim().toLowerCase();
    return providerMap[normalized] || providerMap.plivo;
};

export { plivoProvider, telnyxProvider };
