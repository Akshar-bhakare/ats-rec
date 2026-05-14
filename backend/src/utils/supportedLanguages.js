/**
 * Shared configuration for supported programming languages.
 * These are the languages we allow to be used in the system,
 * mapped to their specific Judge0 IDs and names.
 */

export const SUPPORTED_LANGUAGES = {
    46: 'Bash (5.0.0)',
    50: 'C (GCC 9.2.0)',
    54: 'C++ (GCC 9.2.0)',
    86: 'Clojure (1.10.1)',
    57: 'Elixir (1.9.4)',
    60: 'Go (1.13.5)',
    61: 'Haskell (GHC 8.8.1)',
    62: 'Java (OpenJDK 13.0.1)',
    63: 'JavaScript (Node.js 12.14.0)',
    78: 'Kotlin (1.3.70)',
    64: 'Lua (5.3.5)',
    85: 'Perl (5.28.1)',
    68: 'PHP (7.4.1)',
    71: 'Python (3.8.1)',
    80: 'R (4.0.0)',
    72: 'Ruby (2.7.0)',
    73: 'Rust (1.40.0)',
    81: 'Scala (2.13.2)',
    82: 'SQL (SQLite 3.27.2)',
    83: 'Swift (5.2.3)',
    74: 'TypeScript (3.7.4)',
};

/**
 * Extension mapping based on language name
 * Used to derive file extensions from Judge0 language names
 */
export const EXTENSION_MAP = {
    'python': '.py',
    'javascript': '.js',
    'java': '.java',
    'c++': '.cpp',
    'c#': '.cs',
    'c ': '.c',
    'ruby': '.rb',
    'php': '.php',
    'swift': '.swift',
    'rust': '.rs',
    'typescript': '.ts',
    'sql': '.sql',
    'go': '.go',
    'kotlin': '.kt',
    'scala': '.scala',
    'perl': '.pl',
    'haskell': '.hs',
    'elixir': '.exs',
    'bash': '.sh',
    'clojure': '.clj',
    'lua': '.lua',
    'r': '.r'
};

/**
 * Derive file extension from Judge0 language name
 * @param {string} languageName - Language name from Judge0 (e.g., "Python (3.8.1)")
 * @returns {string} File extension (e.g., ".py")
 */
export function deriveExtension(languageName) {
    if (!languageName) return '.txt';

    const lower = languageName.toLowerCase();

    // Check each known language pattern
    for (const [key, ext] of Object.entries(EXTENSION_MAP)) {
        if (lower.includes(key)) {
            return ext;
        }
    }

    // Default fallback
    return '.txt';
}

/**
 * Extract version from Judge0 language name
 * @param {string} languageName - Language name (e.g., "Python (3.8.1)")
 * @returns {string} Version string (e.g., "3.8.1")
 */
export function extractVersion(languageName) {
    if (!languageName) return 'unknown';

    // Match content inside parentheses
    const match = languageName.match(/\(([^)]+)\)/);
    return match ? match[1] : 'unknown';
}

/**
 * Expand language IDs into full language objects
 * @param {number[]} languageIds - Array of Judge0 language IDs
 * @returns {object[]} Array of expanded language objects
 */
export const expandLanguages = (languageIds) => {
    if (!Array.isArray(languageIds)) return [];
    return languageIds.map(id => {
        const name = SUPPORTED_LANGUAGES[id];
        if (!name) return null;

        return {
            _id: id, // For frontend compatibility (was ObjectId)
            judge0Id: id,
            name: name,
            extension: deriveExtension(name),
            version: extractVersion(name)
        };
    }).filter(Boolean);
};
