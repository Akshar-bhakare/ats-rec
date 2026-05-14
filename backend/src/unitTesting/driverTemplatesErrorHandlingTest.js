import TestFormatter from '../tests/formatter.js';
import {
    buildSourceWithHarness,
    buildStdinPayload,
    generateBoilerplate,
    deepEqual
} from '../utils/driverTemplates.js';

const formatter = new TestFormatter();

function expectThrow(name, fn, expectedSubstring) {
    formatter.testName(name);
    try {
        fn();
        formatter.error('Expected error but function succeeded');
    } catch (err) {
        const message = err?.message || String(err);
        if (expectedSubstring && !message.includes(expectedSubstring)) {
            formatter.error(
                'Error message mismatch',
                new Error(`Expected substring "${expectedSubstring}" but got "${message}"`)
            );
            return;
        }
        formatter.success(`Error thrown as expected: ${message}`);
    }
}

function expectSuccess(name, fn, validate) {
    formatter.testName(name);
    try {
        const result = fn();
        if (validate) {
            const validationMessage = validate(result);
            if (validationMessage) {
                formatter.error('Validation failed', new Error(validationMessage));
                return;
            }
        }
        formatter.success('Success');
    } catch (err) {
        formatter.error('Unexpected error', err);
    }
}

formatter.header('Driver Templates Utils Tests');

const validSignature = {
    className: 'Solution',
    functionName: 'add',
    params: [
        { name: 'a', type: 'int' },
        { name: 'b', type: 'int' }
    ],
    returnType: 'int',
    classBased: true
};

const validPythonSource = `class Solution:
    def add(self, a, b):
        return a + b
`;

// buildSourceWithHarness success
expectSuccess('buildSourceWithHarness success (python)', () => {
    return buildSourceWithHarness({
        language: 'python',
        userSource: validPythonSource,
        signature: validSignature
    });
}, (result) => {
    if (typeof result !== 'string') return 'Expected string output';
    if (!result.includes('HARNESS')) return 'Expected harness marker in output';
    if (!result.includes('class Solution')) return 'Expected user source to be included';
    return null;
});

// buildSourceWithHarness errors
expectThrow(
    'buildSourceWithHarness error: missing signature',
    () => buildSourceWithHarness({ language: 'python', userSource: validPythonSource }),
    'signature is required'
);

expectThrow(
    'buildSourceWithHarness error: empty userSource',
    () => buildSourceWithHarness({ language: 'python', userSource: '   ', signature: validSignature }),
    'userSource must be a non-empty string'
);

expectThrow(
    'buildSourceWithHarness error: invalid params array',
    () => buildSourceWithHarness({
        language: 'python',
        userSource: validPythonSource,
        signature: { functionName: 'add', params: 'nope', returnType: 'int' }
    }),
    'signature.params must be an array'
);

expectThrow(
    'buildSourceWithHarness error: missing functionName',
    () => buildSourceWithHarness({
        language: 'python',
        userSource: validPythonSource,
        signature: { functionName: '  ', params: [], returnType: 'int' }
    }),
    'signature.functionName'
);

expectThrow(
    'buildSourceWithHarness error: unresolved language',
    () => buildSourceWithHarness({
        language: '',
        userSource: validPythonSource,
        signature: validSignature
    }),
    'unable to resolve language'
);

expectThrow(
    'buildSourceWithHarness error: unsupported language id',
    () => buildSourceWithHarness({
        language: { judge0Id: 45 },
        userSource: validPythonSource,
        signature: validSignature
    }),
    'unsupported language'
);

// generateBoilerplate success
expectSuccess('generateBoilerplate success (python)', () => {
    return generateBoilerplate({
        language: 'python',
        signature: validSignature,
        className: 'Solution'
    });
}, (result) => {
    if (typeof result !== 'string') return 'Expected string output';
    if (!result.includes('class Solution')) return 'Expected class name in boilerplate';
    if (!result.includes('def add')) return 'Expected function name in boilerplate';
    return null;
});

// generateBoilerplate errors
expectThrow(
    'generateBoilerplate error: missing signature',
    () => generateBoilerplate({ language: 'python' }),
    'signature is required'
);

expectThrow(
    'generateBoilerplate error: invalid className',
    () => generateBoilerplate({
        language: 'python',
        signature: validSignature,
        className: '   '
    }),
    'className must be a non-empty string'
);

expectThrow(
    'generateBoilerplate error: unresolved language',
    () => generateBoilerplate({ language: '', signature: validSignature }),
    'unable to resolve language'
);

expectThrow(
    'generateBoilerplate error: unsupported language id',
    () => generateBoilerplate({ language: { judge0Id: 45 }, signature: validSignature }),
    'unsupported language'
);

// buildStdinPayload success
expectSuccess('buildStdinPayload success', () => {
    return buildStdinPayload({
        signature: validSignature,
        testCase: { args: [1, 2] }
    });
}, (result) => {
    const parsed = JSON.parse(result);
    if (parsed.functionName !== 'add') return 'Expected functionName "add"';
    if (!Array.isArray(parsed.tests) || parsed.tests.length !== 1) return 'Expected one test entry';
    if (!Array.isArray(parsed.tests[0].args)) return 'Expected args array';
    return null;
});

// buildStdinPayload errors
expectThrow(
    'buildStdinPayload error: missing signature',
    () => buildStdinPayload({ testCase: { args: [1] } }),
    'signature is required'
);

expectThrow(
    'buildStdinPayload error: missing functionName',
    () => buildStdinPayload({
        signature: { functionName: '  ' },
        testCase: { args: [1] }
    }),
    'signature.functionName'
);

expectThrow(
    'buildStdinPayload error: missing testCase',
    () => buildStdinPayload({ signature: validSignature }),
    'testCase is required'
);

expectThrow(
    'buildStdinPayload error: args not array',
    () => buildStdinPayload({
        signature: validSignature,
        testCase: { args: 'not-array' }
    }),
    'testCase.args must be an array'
);

expectThrow(
    'buildStdinPayload error: non-serializable payload',
    () => buildStdinPayload({
        signature: validSignature,
        testCase: { args: [1n] }
    }),
    'failed to serialize stdin payload'
);

// deepEqual success cases
expectSuccess('deepEqual: primitives match', () => deepEqual(1, 1), (result) => {
    if (result !== true) return 'Expected true for equal primitives';
    return null;
});

expectSuccess('deepEqual: NaN match', () => deepEqual(Number.NaN, Number.NaN), (result) => {
    if (result !== true) return 'Expected true for NaN comparison';
    return null;
});

expectSuccess('deepEqual: array/object match', () => deepEqual([1, { a: 2 }], [1, { a: 2 }]), (result) => {
    if (result !== true) return 'Expected true for equal arrays';
    return null;
});

expectSuccess('deepEqual: object key order ignored', () => deepEqual({ a: 1, b: [2, 3] }, { b: [2, 3], a: 1 }), (result) => {
    if (result !== true) return 'Expected true for equal objects with different key order';
    return null;
});

expectSuccess('deepEqual: cyclic structures', () => {
    const a = {}; a.self = a;
    const b = {}; b.self = b;
    return deepEqual(a, b);
}, (result) => {
    if (result !== true) return 'Expected true for equivalent cyclic structures';
    return null;
});

// deepEqual failure cases
expectSuccess('deepEqual: array length mismatch', () => deepEqual([1, 2], [1, 2, 3]), (result) => {
    if (result !== false) return 'Expected false for different array lengths';
    return null;
});

expectSuccess('deepEqual: object value mismatch', () => deepEqual({ a: 1 }, { a: 2 }), (result) => {
    if (result !== false) return 'Expected false for different object values';
    return null;
});

expectSuccess('deepEqual: object key mismatch', () => deepEqual({ a: 1 }, { a: 1, b: 2 }), (result) => {
    if (result !== false) return 'Expected false for different object keys';
    return null;
});

expectSuccess('deepEqual: null mismatch', () => deepEqual(null, {}), (result) => {
    if (result !== false) return 'Expected false for null vs object';
    return null;
});

formatter.summary();

const failed = formatter.results.filter(r => r.status === 'FAIL').length;
if (failed > 0) {
    process.exit(1);
}
