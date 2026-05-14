/**
 * Password strength validation utility (frontend).
 *
 * Rules:
 *  - Minimum 8 characters
 *  - At least one uppercase letter
 *  - At least one lowercase letter
 *  - At least one digit
 *  - At least one special character (symbol)
 */

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;

/**
 * Validates that a password meets strength requirements.
 * @param {string} password - The plaintext password to validate.
 * @returns {{ valid: boolean, message: string }}
 */
export function validatePasswordStrength(password) {
    if (!password) return { valid: false, message: '' };

    if (password.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters long.' };
    }

    if (!PASSWORD_REGEX.test(password)) {
        return {
            valid: false,
            message:
                'Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character.',
        };
    }

    return { valid: true, message: '' };
}
