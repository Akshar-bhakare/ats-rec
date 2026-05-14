/**
 * Deterministic Harness Generator for Code Execution
 * 
 * Replaces AI-generated driver code with language-specific templates.
 * Generates harness code that:
 * - Reads JSON stdin
 * - Calls candidate's function with parsed arguments
 * - Returns JSON stdout with results
 */

// Import language harnesses and boilerplate generators
import { buildPythonHarness, generatePythonBoilerplate } from './driver_languages/python.js';
import { buildJavaScriptHarness, generateJavaScriptBoilerplate } from './driver_languages/javascript.js';
import { buildTypeScriptHarness, generateTypeScriptBoilerplate } from './driver_languages/typescript.js';
import { buildJavaHarness, generateJavaBoilerplate } from './driver_languages/java.js';
import { buildCppHarness, generateCppBoilerplate } from './driver_languages/cpp.js';
import { buildCHarness, generateCBoilerplate } from './driver_languages/c.js';
import { buildGoHarness, generateGoBoilerplate } from './driver_languages/go.js';
import { buildKotlinHarness, generateKotlinBoilerplate } from './driver_languages/kotlin.js';
import { buildSwiftHarness, generateSwiftBoilerplate } from './driver_languages/swift.js';
import { buildPHPHarness, generatePHPBoilerplate } from './driver_languages/php.js';
import { buildRubyHarness, generateRubyBoilerplate } from './driver_languages/ruby.js';
import { buildRustHarness, generateRustBoilerplate } from './driver_languages/rust.js';
import { buildScalaHarness, generateScalaBoilerplate } from './driver_languages/scala.js';
import { buildRHarness, generateRBoilerplate } from './driver_languages/r.js';
import { buildSQLHarness, generateSQLBoilerplate } from './driver_languages/sql.js';
import { buildBashHarness, generateBashBoilerplate } from './driver_languages/bash.js';
import { buildElixirHarness, generateElixirBoilerplate } from './driver_languages/elixir.js';
import { buildHaskellHarness, generateHaskellBoilerplate } from './driver_languages/haskell.js';
import { buildLuaHarness, generateLuaBoilerplate } from './driver_languages/lua.js';
import { buildPerlHarness, generatePerlBoilerplate } from './driver_languages/perl.js';
import { buildObjectiveCHarness, generateObjectiveCBoilerplate } from './driver_languages/objective_c.js';
import { buildClojureHarness, generateClojureBoilerplate } from './driver_languages/clojure.js';

const LANGUAGE_ID_MAP = {
    45: 'assembly',    // Assembly
    46: 'bash',        // Bash
    47: 'basic',       // Basic
    50: 'c',           // C
    54: 'c++',         // C++
    86: 'clojure',     // Clojure
    51: 'csharp',      // C#
    77: 'cobol',       // COBOL
    55: 'lisp',        // Common Lisp
    56: 'd',           // D
    57: 'elixir',      // Elixir
    58: 'erlang',      // Erlang
    87: 'fsharp',      // F#
    59: 'fortran',     // Fortran
    60: 'go',          // Go
    88: 'groovy',      // Groovy
    61: 'haskell',     // Haskell
    62: 'java',        // Java
    63: 'javascript',  // JavaScript
    78: 'kotlin',      // Kotlin
    64: 'lua',         // Lua
    79: 'objective-c', // Objective-C
    65: 'ocaml',       // OCaml
    66: 'octave',      // Octave
    67: 'pascal',      // Pascal
    85: 'perl',        // Perl
    68: 'php',         // PHP
    69: 'prolog',      // Prolog
    71: 'python',      // Python
    80: 'r',           // R
    72: 'ruby',        // Ruby
    73: 'rust',        // Rust
    81: 'scala',       // Scala
    82: 'sql',         // SQL
    83: 'swift',       // Swift
    74: 'typescript',  // TypeScript
    84: 'vbnet'        // Visual Basic.Net
};

const SUPPORTED_LANG_CODES = new Set([
    'python',
    'javascript',
    'typescript',
    'java',
    'c++',
    'c',
    'go',
    'kotlin',
    'swift',
    'php',
    'ruby',
    'rust',
    'scala',
    'r',
    'sql',
    'bash',
    'elixir',
    'haskell',
    'lua',
    'perl',
    'objective-c',
    'clojure'
]);

const SUPPORTED_LANG_LIST = Array.from(SUPPORTED_LANG_CODES).sort().join(', ');

function normalizeLanguageName(language) {
    const raw =
        typeof language === 'string'
            ? language
            : language && typeof language === 'object'
                ? (language.name || language.label || language.value || '')
                : '';
    return String(raw).toLowerCase().trim();
}

function resolveLanguageCode(language) {
    const maybeId =
        typeof language === 'number'
            ? language
            : language && typeof language === 'object'
                ? language.judge0Id
                : undefined;

    if (maybeId !== undefined && maybeId !== null) {
        const id = Number(maybeId);
        if (Number.isFinite(id) && LANGUAGE_ID_MAP[id]) {
            return LANGUAGE_ID_MAP[id];
        }
    }

    const langName = normalizeLanguageName(language);
    if (!langName) return null;

    if (langName.includes('python')) return 'python';
    else if (langName.includes('javascript') || langName === 'js') return 'javascript';
    else if (langName.includes('typescript') || langName === 'ts') return 'typescript';
    else if (langName.includes('java') && !langName.includes('javascript')) return 'java';
    else if (langName.includes('c++') || langName === 'cpp') return 'c++';
    else if (langName === 'c' || langName.startsWith('c (')) return 'c';
    else if (langName.includes('go') || langName === 'golang') return 'go';
    else if (langName.includes('kotlin')) return 'kotlin';
    else if (langName.includes('swift')) return 'swift';
    else if (langName.includes('php')) return 'php';
    else if (langName.includes('ruby')) return 'ruby';
    else if (langName.includes('rust')) return 'rust';
    else if (langName.includes('scala')) return 'scala';
    else if (langName === 'r' || langName.startsWith('r (')) return 'r';
    else if (langName.includes('sql')) return 'sql';
    else if (langName.includes('bash')) return 'bash';
    else if (langName.includes('elixir')) return 'elixir';
    else if (langName.includes('haskell')) return 'haskell';
    else if (langName.includes('lua')) return 'lua';
    else if (langName.includes('perl')) return 'perl';
    else if (langName.includes('objective')) return 'objective-c';
    else if (langName.includes('clojure')) return 'clojure';

    return null;
}

function describeLanguage(language) {
    if (typeof language === 'string') return language;
    if (typeof language === 'number') return String(language);
    try {
        return JSON.stringify(language);
    } catch (err) {
        return String(language);
    }
}

function assertNonEmptyString(value, label) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new Error(`[driverTemplates] ${label} must be a non-empty string`);
    }
}

function assertFunctionName(signature) {
    if (!signature || typeof signature !== 'object') {
        throw new Error('[driverTemplates] signature is required');
    }
    assertNonEmptyString(signature.functionName, 'signature.functionName');
}

function assertSignature(signature) {
    assertFunctionName(signature);
    if (!Array.isArray(signature.params)) {
        throw new Error('[driverTemplates] signature.params must be an array');
    }
    assertNonEmptyString(signature.returnType, 'signature.returnType');
}

function assertSupportedLanguage(langCode, language, context) {
    if (!langCode) {
        throw new Error(`[driverTemplates] ${context}: unable to resolve language from ${describeLanguage(language)}`);
    }
    if (!SUPPORTED_LANG_CODES.has(langCode)) {
        throw new Error(`[driverTemplates] ${context}: unsupported language "${langCode}". Supported: ${SUPPORTED_LANG_LIST}`);
    }
}

function isObject(value) {
    return value !== null && typeof value === 'object';
}

function hasSeenPair(a, b, seen) {
    if (!isObject(a) || !isObject(b)) return false;
    let map = seen.get(a);
    if (!map) {
        map = new WeakSet();
        seen.set(a, map);
    } else if (map.has(b)) {
        return true;
    }
    map.add(b);
    return false;
}

function deepEqualInternal(a, b, seen) {
    if (a === b) return true;
    if (Number.isNaN(a) && Number.isNaN(b)) return true;
    if (a == null || b == null) return false;

    if (Array.isArray(a) !== Array.isArray(b)) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        if (hasSeenPair(a, b, seen)) return true;
        for (let i = 0; i < a.length; i++) {
            if (!deepEqualInternal(a[i], b[i], seen)) return false;
        }
        return true;
    }

    if (typeof a === 'object' && typeof b === 'object') {
        if (hasSeenPair(a, b, seen)) return true;
        const keysA = Object.keys(a).sort();
        const keysB = Object.keys(b).sort();
        if (keysA.length !== keysB.length) return false;
        if (!deepEqualInternal(keysA, keysB, seen)) return false;
        for (const key of keysA) {
            if (!deepEqualInternal(a[key], b[key], seen)) return false;
        }
        return true;
    }

    return false;
}


/**
 * Build complete source code with embedded harness
 * 
 * @param {Object} options
 * @param {string} options.language - Language name (e.g., "python", "javascript")
 * @param {string} options.userSource - Candidate's code
 * @param {Object} options.signature - Function signature from Problem
 * @param {string} options.signature.className - Class name (default: "Solution")
 * @param {string} options.signature.functionName - Function name to call
 * @param {Array} options.signature.params - Parameter definitions
 * @param {string} options.signature.returnType - Return type
 * @returns {string} Complete source code ready for execution
 */
export function buildSourceWithHarness({ language, userSource, signature } = {}) {
    assertSignature(signature);
    assertNonEmptyString(userSource, 'userSource');

    const langCode = resolveLanguageCode(language);
    assertSupportedLanguage(langCode, language, 'buildSourceWithHarness');

    // Route to appropriate harness builder
    switch (langCode) {
        case 'python': return buildPythonHarness(userSource, signature);
        case 'javascript': return buildJavaScriptHarness(userSource, signature);
        case 'typescript': return buildTypeScriptHarness(userSource, signature);
        case 'java': return buildJavaHarness(userSource, signature);
        case 'c++': case 'cpp': return buildCppHarness(userSource, signature);
        case 'c': return buildCHarness(userSource, signature);
        case 'go': return buildGoHarness(userSource, signature);
        case 'kotlin': return buildKotlinHarness(userSource, signature);
        case 'swift': return buildSwiftHarness(userSource, signature);
        case 'php': return buildPHPHarness(userSource, signature);
        case 'ruby': return buildRubyHarness(userSource, signature);
        case 'rust': return buildRustHarness(userSource, signature);
        case 'scala': return buildScalaHarness(userSource, signature);
        case 'r': return buildRHarness(userSource, signature);
        case 'sql': return buildSQLHarness(userSource, signature);
        case 'bash': return buildBashHarness(userSource, signature);
        case 'elixir': return buildElixirHarness(userSource, signature);
        case 'haskell': return buildHaskellHarness(userSource, signature);
        case 'lua': return buildLuaHarness(userSource, signature);
        case 'perl': return buildPerlHarness(userSource, signature);
        case 'objective-c': return buildObjectiveCHarness(userSource, signature);
        case 'clojure': return buildClojureHarness(userSource, signature);
        default: throw new Error(`[driverTemplates] buildSourceWithHarness: unsupported language "${langCode}"`);
    }
}

/**
 * Build JSON stdin payload for a SINGLE test case
 * 
 * @param {Object} options
 * @param {Object} options.signature - Function signature
 * @param {string} options.signature.functionName - Function name
 * @param {Object} options.testCase - Single test case
 * @param {Array} options.testCase.args - Arguments array
 * @returns {string} JSON string for stdin
 */
export function buildStdinPayload({ signature, testCase } = {}) {
    assertFunctionName(signature);

    if (!testCase || typeof testCase !== 'object') {
        throw new Error('[driverTemplates] buildStdinPayload: testCase is required');
    }
    if (!Array.isArray(testCase.args)) {
        throw new Error('[driverTemplates] buildStdinPayload: testCase.args must be an array');
    }

    const payload = {
        functionName: signature.functionName,
        tests: [
            { args: testCase.args }
        ]
    };

    try {
        return JSON.stringify(payload);
    } catch (err) {
        const message = err && err.message ? err.message : String(err);
        throw new Error(`[driverTemplates] buildStdinPayload: failed to serialize stdin payload: ${message}`);
    }
}

/**
 * Generate boilerplate code (candidate starter code)
 * 
 * @param {Object} options
 * @param {string} options.language - Language name
 * @param {Object} options.signature - Function signature
 * @param {string} options.className - Class name (default: "Solution")
 * @returns {string} Boilerplate code
 */
export function generateBoilerplate({ language, signature, className = "Solution" } = {}) {
    assertSignature(signature);
    if (className == null) className = "Solution";
    assertNonEmptyString(className, 'className');

    const langCode = resolveLanguageCode(language);
    assertSupportedLanguage(langCode, language, 'generateBoilerplate');

    // Route to appropriate boilerplate generator
    switch (langCode) {
        case 'python': return generatePythonBoilerplate(signature, className);
        case 'javascript': return generateJavaScriptBoilerplate(signature, className);
        case 'typescript': return generateTypeScriptBoilerplate(signature, className);
        case 'java': return generateJavaBoilerplate(signature, className);
        case 'c++': case 'cpp': return generateCppBoilerplate(signature, className);
        case 'c': return generateCBoilerplate(signature, className);
        case 'go': return generateGoBoilerplate(signature, className);
        case 'kotlin': return generateKotlinBoilerplate(signature, className);
        case 'swift': return generateSwiftBoilerplate(signature, className);
        case 'php': return generatePHPBoilerplate(signature, className);
        case 'ruby': return generateRubyBoilerplate(signature, className);
        case 'rust': return generateRustBoilerplate(signature, className);
        case 'scala': return generateScalaBoilerplate(signature, className);
        case 'r': return generateRBoilerplate(signature, className);
        case 'sql': return generateSQLBoilerplate(signature, className);
        case 'bash': return generateBashBoilerplate(signature, className);
        case 'elixir': return generateElixirBoilerplate(signature, className);
        case 'haskell': return generateHaskellBoilerplate(signature, className);
        case 'lua': return generateLuaBoilerplate(signature, className);
        case 'perl': return generatePerlBoilerplate(signature, className);
        case 'objective-c': return generateObjectiveCBoilerplate(signature, className);
        case 'clojure': return generateClojureBoilerplate(signature, className);
        default: throw new Error(`[driverTemplates] generateBoilerplate: unsupported language "${langCode}"`);
    }
}


/**
 * Deep equality comparison for JSON values
 * Handles arrays, objects, primitives, null
 * 
 * @param {*} a - First value
 * @param {*} b - Second value
 * @returns {boolean} True if deeply equal
 */
export function deepEqual(a, b) {
    return deepEqualInternal(a, b, new WeakMap());
}
