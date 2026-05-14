// /**
//  * Build Swift harness
//  */
// export function buildSwiftHarness(userSource, signature) {
//     const className = signature.className || 'Solution';
//     const functionName = signature.functionName;

//     return `import Foundation

// ${userSource}

// // ============================================================
// // HARNESS (auto-generated, do not modify)
// // ============================================================

// // Read stdin
// var input = ""
// while let line = readLine() {
//     input += line
// }

// // Parse JSON and execute
// do {
//     guard let data = input.data(using: .utf8) else {
//         print("{\\"results\\":[],\\"error\\":\\"Invalid input encoding\\"}")
//         exit(1)
//     }
    
//     // Simple JSON parsing
//     guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
//           let tests = json["tests"] as? [[String: Any]] else {
//         print("{\\"results\\":[],\\"error\\":\\"Invalid JSON format\\"}")
//         exit(1)
//     }
    
//     // Create solution instance
//     let solution = ${className}()
//     var results: [Any] = []
    
//     // Execute tests
//     for test in tests {
//         guard let args = test["args"] as? [Any] else { continue }
        
//         // Call function (simplified - extend for more arg types)
//         // Note: Swift requires explicit type handling
//         let result: Any
//         if args.count == 2 {
//             // Assume Int for this test context
//             let a = args[0] as? Int ?? 0
//             let b = args[1] as? Int ?? 0
//             result = solution.${functionName}(a, b)
//         } else if args.count == 1 {
//              let a = args[0] as? Int ?? 0
//              result = solution.${functionName}(a)
//         } else {
//             result = 0 
//         }
//         results.append(result)
//     }
    
//     // Output JSON
//     let output: [String: Any] = ["results": results]
//     let outputData = try JSONSerialization.data(withJSONObject: output)
//     if let outputString = String(data: outputData, encoding: .utf8) {
//         print(outputString)
//     }
    
// } catch {
//     print("{\\"results\\":[],\\"error\\":\\"\\(error.localizedDescription)\\"}")
//     exit(1)
// }
// `;
// }

// /**
//  * Generate Swift boilerplate code
//  */
// export function generateSwiftBoilerplate(signature, className) {
//     const functionName = signature.functionName;
//     const params = signature.params || [];
//     const returnType = signature.returnType || 'Int';
    
//     const paramList = params.map(p => {
//         const type = p.type || 'Int';
//         return `_ ${p.name}: ${type}`;
//     }).join(', ');

//     return `class ${className} {
//     func ${functionName}(${paramList}) -> ${returnType} {
//         // Write your code here
        
//     }
// }
// `;
// }
/**
 * Build Swift harness (signature-driven)
 */
export function buildSwiftHarness(userSource, signature) {
  const className = signature.className || "Solution";
  const functionName = signature.functionName || "solve";
  const params = Array.isArray(signature.params) ? signature.params : [];
  const paramCount = params.length;

  // Build typed extraction lines for each arg based on param types
  const normType = (t) => {
    const x = String(t || "Int").toLowerCase();
    if (x === "int" || x === "int32" || x === "int64" || x === "int") return "Int";
    if (x === "double" || x === "float" || x === "float64") return "Double";
    if (x === "bool" || x === "boolean") return "Bool";
    if (x === "string" || x === "str") return "String";
    return "Int";
  };

  const extract = (swiftType, idx) => {
    if (swiftType === "Int") {
      return `let a${idx} = (args[${idx}] as? NSNumber)?.intValue ?? 0`;
    }
    if (swiftType === "Double") {
      return `let a${idx} = (args[${idx}] as? NSNumber)?.doubleValue ?? 0.0`;
    }
    if (swiftType === "Bool") {
      return `let a${idx} = (args[${idx}] as? Bool) ?? false`;
    }
    if (swiftType === "String") {
      return `let a${idx} = (args[${idx}] as? String) ?? ""`;
    }
    return `let a${idx} = (args[${idx}] as? NSNumber)?.intValue ?? 0`;
  };

  const argDecls = params
    .map((p, i) => extract(normType(p.type), i))
    .join("\n        ");

  const callArgs = params.map((_, i) => `a${i}`).join(", ");

  return `import Foundation

${userSource}

// ============================================================
// HARNESS (auto-generated, do not modify)
// ============================================================

var input = ""
while let line = readLine() {
  input += line
}

do {
  guard let data = input.data(using: .utf8) else {
    print("{\\"results\\":[],\\"error\\":\\"Invalid input encoding\\"}")
    exit(1)
  }

  guard
    let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
    let tests = json["tests"] as? [[String: Any]]
  else {
    print("{\\"results\\":[],\\"error\\":\\"Invalid JSON format\\"}")
    exit(1)
  }

  let solution = ${className}()
  var results: [Any] = []

  for test in tests {
    guard let args = test["args"] as? [Any] else { continue }
    if args.count < ${paramCount} {
      results.append(NSNull())
      continue
    }

        ${argDecls}

    let result = solution.${functionName}(${callArgs})
    results.append(result)
  }

  let output: [String: Any] = ["results": results]
  let outData = try JSONSerialization.data(withJSONObject: output, options: [])
  if let outStr = String(data: outData, encoding: .utf8) {
    print(outStr)
  } else {
    print("{\\"results\\":[],\\"error\\":\\"Failed to encode output\\"}")
    exit(1)
  }

} catch {
  print("{\\"results\\":[],\\"error\\":\\"\\(error.localizedDescription)\\"}")
  exit(1)
}
`;
}

/**
 * Generate Swift boilerplate code
 */
export function generateSwiftBoilerplate(signature, className) {
  const functionName = signature.functionName || "solve";
  const params = Array.isArray(signature.params) ? signature.params : [];
  const returnType = signature.returnType || "Int";

  const normType = (t) => {
    const x = String(t || "Int").toLowerCase();
    if (x === "int" || x === "int32" || x === "int64") return "Int";
    if (x === "double" || x === "float" || x === "float64") return "Double";
    if (x === "bool" || x === "boolean") return "Bool";
    if (x === "string" || x === "str") return "String";
    return "Int";
  };

  const swiftReturn = normType(returnType);

  const paramList = params
    .map((p) => `_ ${p.name}: ${normType(p.type)}`)
    .join(", ");

  const defaultReturn =
    swiftReturn === "Bool" ? "return false" :
    swiftReturn === "Double" ? "return 0.0" :
    swiftReturn === "String" ? 'return ""' :
    "return 0";

  return `class ${className} {
  func ${functionName}(${paramList}) -> ${swiftReturn} {
    // Write your code here
    ${defaultReturn}
  }
}
`;
}
