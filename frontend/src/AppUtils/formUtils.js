const isFileLike = (value) => {
    if (!value || typeof value !== 'object') return false;
    if (typeof File !== 'undefined' && value instanceof File) return true;
    if (typeof Blob !== 'undefined' && value instanceof Blob) return true;
    return false;
};

const isPlainObject = (value) => {
    if (!value || typeof value !== 'object') return false;
    return Object.prototype.toString.call(value) === '[object Object]';
};

export const trimFormStrings = (value) => {
    if (typeof value === 'string') return value.trim();
    if (Array.isArray(value)) return value.map(trimFormStrings);
    if (!value || typeof value !== 'object' || isFileLike(value) || !isPlainObject(value)) return value;

    const trimmed = {};
    for (const [key, val] of Object.entries(value)) {
        trimmed[key] = trimFormStrings(val);
    }
    return trimmed;
};

export const syncTrimmedValuesToForm = (formEl, trimmedData) => {
    if (!formEl?.elements || !trimmedData || typeof trimmedData !== 'object') return;

    for (const [name, val] of Object.entries(trimmedData)) {
        if (typeof val !== 'string') continue;
        const control = formEl.elements.namedItem?.(name);
        if (!control) continue;

        if (typeof control.value === 'string') {
            control.value = val;
            continue;
        }

        if (control.length) {
            Array.from(control).forEach((item) => {
                if (item && typeof item.value === 'string') item.value = val;
            });
        }
    }
};
