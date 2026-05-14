/**
 * Formats a number with commas (or locale-specific separators) and optional currency.
 * @param {number|string} value - The number to format.
 * @param {Object} options - Formatting options.
 * @param {string} [options.locale='en-IN'] - Locale string (default to Indian English).
 * @param {string} [options.currency] - Currency code (e.g., 'INR', 'USD'). If provided, formats as currency.
 * @param {boolean} [options.currencyDisplaySymbol=true] - Show currency symbol or code.
 * @returns {string} - Formatted number string.
 */
export function formatNumber(value, options = {}) {
    if (value === null || value === undefined || value === '') return '';

    const {
        locale = 'en-IN',
        currency,
        currencyDisplaySymbol = true
    } = options;

    let number = typeof value === 'string' ? Number(value) : value;

    if (isNaN(number)) return '';

    if (currency) {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            currencyDisplay: currencyDisplaySymbol ? 'symbol' : 'code',
            maximumFractionDigits: 0
        }).format(number);
    }

    // Default: number with grouping (e.g., 1,00,000)
    return new Intl.NumberFormat(locale, {
        maximumFractionDigits: 0
    }).format(number);
}
