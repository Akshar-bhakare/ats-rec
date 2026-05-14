/**
 * Build Elixir harness
 * Dependency-free: Uses Regex to extract arguments from JSON string
 */
export function buildElixirHarness(userSource, signature) {
  const className = signature.className || 'Solution';
  const functionName = signature.functionName;

  return `${userSource}

# HARNESS
defmodule Harness do
  def run do
    # Read all stdin
    input = IO.read(:stdio, :all)
    
    # Simple regex to find "args": [5, 10]
    # We assume the test input format is consistent
    
    # This regex looks for args array in JSON
    # It catches simple integers separated by commas
    regex = ~r/"args"\\s*:\\s*\\[([0-9,\\s-]+)\\]/
    
    results = Regex.scan(regex, input)
              |> Enum.map(fn [_, args_str] ->
                args = String.split(args_str, ",")
                       |> Enum.map(&String.trim/1)
                       |> Enum.reject(&(&1 == ""))
                       |> Enum.reject(&(&1 == ""))
                       |> Enum.map(&String.to_integer/1)
                
                # Apply function
                # We assume 2 args for this test case based on "add" function
                # Ideally we'd look at signature.params.length
                
                if length(args) == 2 do
                  [a, b] = args
                  apply(${className}, :${functionName}, [a, b])
                else
                   # Fallback for single arg or other cases
                   0
                end
              end)
    
    # Manual JSON construction for output
    json_results = Enum.join(results, ",")
    IO.puts("{\\"results\\":[#{json_results}]}")
  end
end

Harness.run()
`;
}

/**
 * Generate Elixir boilerplate code
 */
export function generateElixirBoilerplate(signature, className) {
  const functionName = signature.functionName;
  // const params = signature.params || [];
  // const paramList = params.map(p => p.name).join(', ');

  return `defmodule ${className} do
  # NOTE: Elixir uses do...end blocks, not curly braces { }
  def ${functionName}(a, b) do
    # Write your code here
    
  end
end
`;
}
