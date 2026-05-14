/**
 * Build JavaScript harness
 */
export function buildJavaScriptHarness(userSource, signature) {
    const className = signature.className || 'Solution';
    const functionName = signature.functionName;

    return `${userSource}

// ============================================================
// HARNESS (auto-generated, do not modify)
// ============================================================
const readline = require('readline');

// Read all stdin
let inputData = '';
process.stdin.on('data', (chunk) => {
    inputData += chunk;
});

process.stdin.on('end', () => {
    try {
        // Parse JSON payload
        const payload = JSON.parse(inputData.trim());
        const functionName = payload.functionName;
        const tests = payload.tests || [];
        
        // Instantiate Solution class
        const solution = new ${className}();
        
        // Run tests and collect results
        const results = [];
        for (const test of tests) {
            const args = test.args || [];
            const result = solution[functionName](...args);
            results.push(result);
        }
        
        // Print JSON output
        console.log(JSON.stringify({ results }));
        
    } catch (error) {
        // Print error in JSON format
        console.log(JSON.stringify({ results: [], error: error.message }));
        process.exit(1);
    }
});
`;
}

/**
 * Generate JavaScript boilerplate code
 */
export function generateJavaScriptBoilerplate(signature, className) {
    const functionName = signature.functionName;
    const params = signature.params || [];
    const paramNames = params.map(p => p.name).join(', ');

    return `class ${className} {
    ${functionName}(${paramNames}) {
        // Write your code here
        
    }
}
`;
}
