/**
 * Build PHP harness
 */
export function buildPHPHarness(userSource, signature) {
    const className = signature.className || 'Solution';
    const functionName = signature.functionName;

    // Strip existing PHP tags from user source to prevent nested tags
    const cleanUserSource = userSource.replace(/^\s*<\?php\s*/i, '').replace(/\?>\s*$/i, '');

    return `<?php

${cleanUserSource}

// ============================================================
// HARNESS (auto-generated, do not modify)
// ============================================================

// Read stdin
$input = file_get_contents('php://stdin');
$payload = json_decode($input, true);

if (!$payload) {
    echo json_encode(['results' => [], 'error' => 'Invalid JSON']);
    exit(1);
}

$functionName = $payload['functionName'];
$tests = $payload['tests'] ?? [];

try {
    // Instantiate Solution class
    $solution = new ${className}();
    $results = [];
    
    // Run tests
    foreach ($tests as $test) {
        $args = $test['args'] ?? [];
        // Call function with arguments
        $result = call_user_func_array([$solution, $functionName], $args);
        $results[] = $result;
    }
    
    // Print JSON output
    echo json_encode(['results' => $results]);
    
} catch (Exception $e) {
    echo json_encode(['results' => [], 'error' => $e->getMessage()]);
    exit(1);
}
`;
}

/**
 * Generate PHP boilerplate code
 */
export function generatePHPBoilerplate(signature, className) {
    const functionName = signature.functionName;
    const params = signature.params || [];

    const paramList = params.map(p => `$${p.name}`).join(', ');

    return `<?php

class ${className} {
    public function ${functionName}(${paramList}) {
        // Write your code here
        
    }
}`;
}