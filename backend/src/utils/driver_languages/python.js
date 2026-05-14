/**
 * Build Python source with JSON harness
 */
export function buildPythonHarness(userSource, signature) {
    const className = signature.className || 'Solution';
    const functionName = signature.functionName;

    return `${userSource}

# ============================================================
# HARNESS (auto-generated, do not modify)
# ============================================================
import sys
import json

if __name__ == "__main__":
    try:
        # Read stdin JSON
        stdin_data = sys.stdin.read().strip()
        if not stdin_data:
            print(json.dumps({"results": [], "error": "Empty stdin"}))
            sys.stdout.flush()
            sys.exit(1)
        
        # Parse JSON payload
        payload = json.loads(stdin_data)
        function_name = payload.get("functionName")
        tests = payload.get("tests", [])
        
        # Instantiate Solution class
        solution = ${className}()
        
        # Run tests and collect results
        results = []
        for test in tests:
            args = test.get("args", [])
            result = getattr(solution, function_name)(*args)
            results.append(result)
        
        # Print JSON output
        print(json.dumps({"results": results}))
        sys.stdout.flush()
        
    except Exception as e:
        # Print error in JSON format for better debugging
        print(json.dumps({"results": [], "error": str(e)}))
        sys.stdout.flush()
        sys.exit(1)
`;
}

/**
 * Generate Python boilerplate code
 */
export function generatePythonBoilerplate(signature, className) {
    const functionName = signature.functionName;
    const params = signature.params || [];
    const paramNames = params.map(p => p.name).join(', ');

    return `class ${className}:
    def ${functionName}(self${paramNames ? ', ' + paramNames : ''}):
        # Write your code here
        pass
`;
}
