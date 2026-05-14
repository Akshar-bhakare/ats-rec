/**
 * Build TypeScript harness
 */
export function buildTypeScriptHarness(userSource, signature) {
    const className = signature.className || 'Solution';
    const functionName = signature.functionName;

    return `${userSource}

// ============================================================
// HARNESS (auto-generated, do not modify)
// ============================================================

// Read all stdin
declare var process: any;
let inputData = '';
process.stdin.on('data', (chunk) => {
    inputData += chunk.toString();
});

process.stdin.on('end', () => {
    try {
        // Parse JSON payload
        const payload = JSON.parse(inputData.trim());
        const functionName: string = payload.functionName;
        const tests: any[] = payload.tests || [];
        
        // Instantiate Solution class
        const solution = new ${className}();
        
        // Run tests and collect results
        const results: any[] = [];
        for (const test of tests) {
            const args: any[] = test.args || [];
            const result = (solution as any)[functionName](...args);
            results.push(result);
        }
        
        // Print JSON output
        console.log(JSON.stringify({ results }));
        
    } catch (error) {
        // Print error in JSON format
        console.log(JSON.stringify({ results: [], error: (error as any).message }));
        process.exit(1);
    }
});
`;
}

/**
 * Generate TypeScript boilerplate code
 */
export function generateTypeScriptBoilerplate(signature, className) {
    const functionName = signature.functionName;
    const params = signature.params || [];
    
    // Type mapping helper
    const tsType = (t) => {
        const x = (t || "any").toLowerCase();
        
        if (x === "any") return "any";
        if (x === "boolean" || x === "bool") return "boolean";
        if (x === "string") return "string";
        if (x === "void") return "void";
        
        // Number types
        if (["int", "integer", "long", "double", "float", "number"].includes(x)) return "number";
        
        // Arrays
        if (x.includes("[]")) {
            const inner = x.replace("[]", "");
            // Recursive call for inner type doesn't work well with string replace, so we manually check
            if (["int", "integer", "long", "double", "float", "number"].some(n => inner.includes(n))) return "number[]";
            if (inner.includes("string")) return "string[]";
            if (inner.includes("bool")) return "boolean[]";
            return "any[]";
        }
        
        return "any"; // default
    };
    
    const returnType = tsType(signature.returnType);
    
    const paramList = params.map(p => {
        return `${p.name}: ${tsType(p.type)}`;
    }).join(', ');
    
    // Default return statement
    let defaultReturn = "return 0;";
    if (returnType === "boolean") defaultReturn = "return false;";
    if (returnType === "string") defaultReturn = 'return "";';
    if (returnType.endsWith("[]")) defaultReturn = "return [];";
    if (returnType === "void") defaultReturn = "";

    return `class ${className} {
    ${functionName}(${paramList}): ${returnType} {
        // Write your code here
        ${defaultReturn}
    }
}
`;
}
