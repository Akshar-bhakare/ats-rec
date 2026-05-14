/**
 * Build Rust harness (dependency-free; no serde)
 */
export function buildRustHarness(userSource, signature) {
  const functionName = signature.functionName || "solve";
  const params = Array.isArray(signature.params) ? signature.params : [];

  // Helper for type mapping
  const rustType = (t) => {
    const x = (t || "i32").toLowerCase();

    // Primitives
    if (x === "int" || x === "integer" || x === "i32") return "i32";
    if (x === "long" || x === "int64" || x === "i64") return "i64";
    if (x === "double" || x === "float" || x === "f64") return "f64";
    if (x === "boolean" || x === "bool") return "bool";
    if (x === "string") return "String";

    // Arrays
    if (x.includes("int") && x.includes("[]")) return "Vec<i32>";
    if (x.includes("long") && x.includes("[]")) return "Vec<i64>";
    if (x.includes("double") && x.includes("[]")) return "Vec<f64>";
    if (x.includes("boolean") && x.includes("[]")) return "Vec<bool>";
    if (x.includes("string") && x.includes("[]")) return "Vec<String>";

    return "i32"; // default
  };

  const paramCount = params.length;

  const src = String(userSource || "");
  const hasStructSolution = /\bstruct\s+Solution\b/.test(src);
  const hasImplSolution = /\bimpl\s+Solution\b/.test(src);

  const injectedSolution =
    (hasStructSolution ? "" : "struct Solution;\n") +
    (hasImplSolution ? "" : "impl Solution {}\n");

  // Generate typed parsing logic
  const parseLines = params.map((p, i) => {
    const rType = rustType(p.type);

    // Parsing logic based on type
    if (rType === "i32") return `let a${i}: i32 = parts[${i}].trim().parse().unwrap_or(0);`;
    if (rType === "i64") return `let a${i}: i64 = parts[${i}].trim().parse().unwrap_or(0);`;
    if (rType === "f64") return `let a${i}: f64 = parts[${i}].trim().parse().unwrap_or(0.0);`;
    if (rType === "bool") return `let a${i}: bool = parts[${i}].trim() == "true";`;
    if (rType === "String") return `let a${i}: String = parts[${i}].trim().trim_matches('"').to_string();`;

    // Vector parsing (Manual JSON array parsing since serde is assumed unavailable/complex to inject)
    if (rType.startsWith("Vec<")) {
      const innerType = rType.match(/Vec<(.+)>/)[1]; // e.g., i32
      let parseInner = "";
      if (innerType === "i32") parseInner = "s.trim().parse::<i32>().unwrap_or(0)";
      else if (innerType === "i64") parseInner = "s.trim().parse::<i64>().unwrap_or(0)";
      else if (innerType === "f64") parseInner = "s.trim().parse::<f64>().unwrap_or(0.0)";

      return `let a${i}: ${rType} = parts[${i}]
            .trim()
            .trim_matches(|c| c == '[' || c == ']')
            .split(',')
            .filter(|s| !s.trim().is_empty())
            .map(|s| ${parseInner})
            .collect();`;
    }

    return `let a${i} = parts[${i}];`; // Fallback
  }).join("\n        ");

  const callArgs = Array.from({ length: paramCount }, (_, i) => `a${i}`).join(", ");

  // Determine result type for harness
  const resultType = rustType(signature.returnType);



  return `use std::io::{self, Read};


${src}

// ============================================================
// HARNESS (auto-generated, do not modify)
// ============================================================

fn main() {
  let mut input = String::new();
  io::stdin().read_to_string(&mut input).unwrap();
  
  // Clean input (handle simple JSON inputs)
  // We expect {"functionName": "...", "tests": [{"args": [1, [2,3]]}]}
  // But our simple parser just looks for "args": [ ... ]
  
  // Explicitly type results to avoid inference errors if empty
  let mut results: Vec<${resultType}> = Vec::new();
  
  // Clean input (handle simple JSON inputs)
  // We expect {"functionName": "...", "tests": [{"args": [1, [2,3]]}]}
  // But our simple parser just looks for "args": [ ... ]
  
  // Explicitly type results to avoid inference errors if empty
  let mut results: Vec<${resultType}> = Vec::new();

  if let Some(k) = input.find("\\"args\\":") {
      let rest = &input[k+7..]; // Skip "args":
      if let Some(start) = rest.find('[') {
          // This '[' starts the args array
          let args_content_start = k + 7 + start + 1;
          
          // Naive matching of closing bracket ]
          // This is fragile for nested arrays but works for 1D arrays or primitives
          // Ideally we would count brackets.
          
          let mut bracket_count = 1;
          let mut args_content_end = 0;
          
          for (i, c) in input[args_content_start..].char_indices() {
              if c == '[' { bracket_count += 1; }
              if c == ']' { bracket_count -= 1; }
              if bracket_count == 0 {
                  args_content_end = args_content_start + i;
                  break;
              }
          }
          
          if args_content_end > 0 {
              let args_str = &input[args_content_start..args_content_end];
              
              // We need to split args_str by COMMA, but respecting nested brackets
              // e.g. "1, [2,3], 4" -> ["1", "[2,3]", "4"]
              
              let mut parts: Vec<String> = Vec::new();
              let mut current_part = String::new();
              let mut depth = 0;
              
              for c in args_str.chars() {
                  if c == '[' { depth += 1; }
                  if c == ']' { depth -= 1; }
                  
                  if c == ',' && depth == 0 {
                      parts.push(current_part.trim().to_string());
                      current_part.clear();
                  } else {
                      current_part.push(c);
                  }
              }
              if !current_part.trim().is_empty() {
                  parts.push(current_part.trim().to_string());
              }
              
              if parts.len() < ${paramCount} {
                   print!("{{\\"results\\":[], \\"error\\": \\"Insufficient arguments found\\"}}");
                   return;
              }
              
              let solution = Solution;
              
              ${parseLines}
              
              let r = solution.${functionName}(${callArgs});
              
              // Print only result
              print!("{{\\"results\\":[{:?}]}}", r);
              return;
          }
      }
      let rest = &input[k+7..]; // Skip "args":
      if let Some(start) = rest.find('[') {
          // This '[' starts the args array
          let args_content_start = k + 7 + start + 1;
          
          // Naive matching of closing bracket ]
          // This is fragile for nested arrays but works for 1D arrays or primitives
          // Ideally we would count brackets.
          
          let mut bracket_count = 1;
          let mut args_content_end = 0;
          
          for (i, c) in input[args_content_start..].char_indices() {
              if c == '[' { bracket_count += 1; }
              if c == ']' { bracket_count -= 1; }
              if bracket_count == 0 {
                  args_content_end = args_content_start + i;
                  break;
              }
          }
          
          if args_content_end > 0 {
              let args_str = &input[args_content_start..args_content_end];
              
              // We need to split args_str by COMMA, but respecting nested brackets
              // e.g. "1, [2,3], 4" -> ["1", "[2,3]", "4"]
              
              let mut parts: Vec<String> = Vec::new();
              let mut current_part = String::new();
              let mut depth = 0;
              
              for c in args_str.chars() {
                  if c == '[' { depth += 1; }
                  if c == ']' { depth -= 1; }
                  
                  if c == ',' && depth == 0 {
                      parts.push(current_part.trim().to_string());
                      current_part.clear();
                  } else {
                      current_part.push(c);
                  }
              }
              if !current_part.trim().is_empty() {
                  parts.push(current_part.trim().to_string());
              }
              
              if parts.len() < ${paramCount} {
                   print!("{{\\"results\\":[], \\"error\\": \\"Insufficient arguments found\\"}}");
                   return;
              }
              
              let solution = Solution;
              
              ${parseLines}
              
              let r = solution.${functionName}(${callArgs});
              
              // Print only result
              print!("{{\\"results\\":[{:?}]}}", r);
              return;
          }
      }
  }

  print!("{{\\"results\\":[]}}");
  print!("{{\\"results\\":[]}}");
}
`;
}


/**
 * Generate Rust boilerplate code
 */
export function generateRustBoilerplate(signature, className) {
  const functionName = signature.functionName || "solve";
  const params = signature.params || [];

  // Helper for type mapping
  const rustType = (t) => {
    const x = (t || "i32").toLowerCase();

    // Primitives
    if (x === "int" || x === "integer" || x === "i32") return "i32";
    if (x === "long" || x === "int64" || x === "i64") return "i64";
    if (x === "double" || x === "float" || x === "f64") return "f64";
    if (x === "boolean" || x === "bool") return "bool";
    if (x === "string") return "String";

    // Arrays
    if (x.includes("int") && x.includes("[]")) return "Vec<i32>";
    if (x.includes("long") && x.includes("[]")) return "Vec<i64>";
    if (x.includes("double") && x.includes("[]")) return "Vec<f64>";
    if (x.includes("boolean") && x.includes("[]")) return "Vec<bool>";
    if (x.includes("string") && x.includes("[]")) return "Vec<String>";

    return "i32"; // default
  };

  const returnType = rustType(signature.returnType);

  // Default return value based on type
  let defaultReturn = "0";
  if (returnType === "bool") defaultReturn = "false";
  if (returnType === "String") defaultReturn = "String::new()";
  if (returnType.startsWith("Vec")) defaultReturn = "Vec::new()";
  if (returnType === "f64") defaultReturn = "0.0";

  const paramList = params
    .map(p => {
      const rType = rustType(p.type);
      // Pass complex types by reference if needed, but for simplicity we assume ownership for now
      // or &Vec<i32> etc. To keep it simple: ownership.
      return `${p.name}: ${rType}`;
    })
    .join(", ");

  return `struct ${className};

impl ${className} {
  pub fn new() -> Self {
    Self {}
  }

  pub fn ${functionName}(&self, ${paramList}) -> ${returnType} {
  pub fn new() -> Self {
    Self {}
  }

  pub fn ${functionName}(&self, ${paramList}) -> ${returnType} {
    // Write your code here
    ${defaultReturn}
    ${defaultReturn}
  }
}
`;
}
