/**
 * Build Bash harness
 */
export function buildBashHarness(userSource, signature) {
    // Bash usually takes args from command line or stdin
    // This harness parses JSON from stdin using jq (if available) or python
    return `
# User code
${userSource}

# HARNESS
# Read JSON from stdin
input=$(cat)

# Extract tests using python (reliably available)
tests_count=$(echo "$input" | python3 -c "import sys, json; print(len(json.load(sys.stdin)['tests']))")

echo "{\\"results\\": ["

for ((i=0; i<tests_count; i++)); do
    # Extract args for this test using python
    arg1=$(echo "$input" | python3 -c "import sys, json; print(json.load(sys.stdin)['tests'][$i]['args'][0])")
    arg2=$(echo "$input" | python3 -c "import sys, json; print(json.load(sys.stdin)['tests'][$i]['args'][1])")
    
    # Call user function
    result=$(${signature.functionName} "$arg1" "$arg2")
    
    # Format result as valid JSON component using Python
    # This tries to parse as JSON first (to preserve numbers/arrays), 
    # falling back to string if it's just text.
    json_result=$(python3 -c "
import json, sys
v = sys.argv[1]
try:
    print(json.dumps(json.loads(v)))
except:
    print(json.dumps(v))
" "$result")

    if [ $i -gt 0 ]; then echo ","; fi
    echo "$json_result"
done

echo "]}"
`;
}

/**
 * Generate Bash boilerplate code
 */
export function generateBashBoilerplate(signature, className) {
    const functionName = signature.functionName;
    const params = signature.params || [];
    const paramList = params.map(p => p.name).join(' ');

    return `function ${functionName} {
    # Args: ${paramList}
    # Write your code here
    echo "result"
}
`;
}
