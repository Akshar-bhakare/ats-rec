/**
 * Build Lua harness
 * Dependency-free: Manual string parsing
 */
export function buildLuaHarness(userSource, signature) {
    const functionName = signature.functionName;
    return `${userSource}

-- HARNESS
local input = io.read("*a")

-- Simple regex-like pattern matching for args
-- {"args": [5, 10]}
local results = {}

for a, b in string.gmatch(input, "args\\":%s*%[%s*(%-?%d+)%s*,%s*(%-?%d+)%s*%]") do
    local valA = tonumber(a)
    local valB = tonumber(b)
    
    -- Call user function
    local status, res = pcall(${functionName}, valA, valB)
    if status then
        table.insert(results, res)
    else
        table.insert(results, "null")
    end
end

-- Build JSON output manually
io.write("{\\"results\\":[")
for i, v in ipairs(results) do
    if i > 1 then io.write(",") end
    io.write(tostring(v))
end
io.write("]}")
`;
}

/**
 * Generate Lua boilerplate code
 */
export function generateLuaBoilerplate(signature, className) {
    const functionName = signature.functionName;
    const params = signature.params || [];
    const paramList = params.map(p => p.name).join(', ');
    
    return `function ${functionName}(${paramList})
    -- Write your code here
    
end
`;
}
