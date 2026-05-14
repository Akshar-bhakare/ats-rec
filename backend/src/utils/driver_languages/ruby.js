/**
 * Build Ruby harness
 */
export function buildRubyHarness(userSource, signature) {
    const className = signature.className || 'Solution';
    const functionName = signature.functionName;

    return `require 'json'

${userSource}

# ============================================================
# HARNESS (auto-generated, do not modify)
# ============================================================

begin
    # Read stdin
    input = STDIN.read.strip
    payload = JSON.parse(input)
    
    function_name = payload['functionName']
    tests = payload['tests'] || []
    
    # Instantiate Solution class
    solution = ${className}.new
    results = []
    
    # Run tests
    tests.each do |test|
        args = test['args'] || []
        # Call function with arguments
        result = solution.send(function_name, *args)
        results << result
    end
    
    # Print JSON output
    puts JSON.generate({ results: results })
    
rescue => e
    puts JSON.generate({ results: [], error: e.message })
    exit 1
end
`;
}

/**
 * Generate Ruby boilerplate code
 */
export function generateRubyBoilerplate(signature, className) {
    const functionName = signature.functionName;
    const params = signature.params || [];
    
    const paramList = params.map(p => p.name).join(', ');

    return `class ${className}
    def ${functionName}(${paramList})
        # Write your code here
        
    end
end
`;
}
