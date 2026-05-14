// backend/src/services/aiCalling/ctcScreeningCondition.js
//
// CTC screening condition based on candidate country code.
// - CTC (Current Total Compensation): Only ask for +91 (India).
// - ECTC (Expected Total Compensation): Ask for ALL countries.

import { normalizeCountryCode } from "./providers/index.js";

/**
 * Returns true only if the candidate's country code is +91 (India).
 * Use this to gate CTC (current salary) questions only.
 *
 * @param {object} candidate - Candidate document (must have .countryCode field)
 * @returns {boolean}
 */
export const shouldAskCTC = (candidate) => {
    const numericCode = normalizeCountryCode(candidate?.countryCode);
    return numericCode === "91";
};

/**
 * Returns the compensation section of the agent instructions.
 *
 * - India (+91): Ask both Current CTC and Expected CTC (ECTC), use LPA wording.
 * - All other countries: Skip Current CTC only. ECTC (expected salary) is still asked.
 *
 * @param {object} candidate - Candidate document
 * @returns {string} - Instruction block to embed in the agent system prompt
 */
export const getCompensationInstructions = (candidate) => {
    if (shouldAskCTC(candidate)) {
        return `Compensation wording:
- Always refer to salary as "Lakh Per Annum (LPA)".
- Ask for both Current CTC and Expected CTC (ECTC) as part of the screening.`;
    }

    return `Compensation rules (country is NOT India):
- Do NOT ask about Current CTC (current salary). Skip that question entirely even if it appears in the script.
- You MAY and SHOULD still ask about Expected CTC / ECTC (expected salary / salary expectation).
- If the candidate voluntarily mentions their current salary, acknowledge briefly and move on — do not probe further.`;
};

/**
 * Returns the salary follow-up conditional instruction line.
 *
 * - India (+91): may ask for a reason if expected hike > 30% of current salary.
 * - All other countries: no hike-comparison follow-up (since current salary is not collected).
 *
 * @param {object} candidate - Candidate document
 * @returns {string}
 */
export const getSalaryFollowUpInstruction = (candidate) => {
    if (shouldAskCTC(candidate)) {
        return `  - If expected salary increase exceeds 30% of current salary, ask for a brief reason.`;
    }
    return `  - Do not compare expected salary against a current salary figure (current CTC is not collected for this candidate).`;
};
