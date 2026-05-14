// /**
//  * Build Go harness
//  * Uses structs instead of classes, requires reflection for dynamic calls
//  */
// export function buildGoHarness(userSource, signature) {
//     const functionName = signature.functionName;
//     // Capitalize first letter for Go convention
//     const goFunctionName = functionName.charAt(0).toUpperCase() + functionName.slice(1);

//     // Remove existing package declaration from userSource if present
//     const cleanUserSource = userSource.replace(/package\s+main\s*\n/, '');

//     return `package main
// import (
//     "encoding/json"
//     "fmt"
//     "io/ioutil"
//     "os"
// )

// ${cleanUserSource}

// // ============================================================
// // HARNESS (auto-generated, do not modify)
// // ============================================================

// // Payload structure for JSON input
// type Payload struct {
//     FunctionName string \`json:"functionName"\`
//     Tests        []struct {
//         Args []interface{} \`json:"args"\`
//     } \`json:"tests"\`
// }

// // Result structure for JSON output
// type Result struct {
//     Results []interface{} \`json:"results"\`
//     Error   string        \`json:"error,omitempty"\`
// }

// func main() {
//     // Read stdin
//     inputBytes, _ := ioutil.ReadAll(os.Stdin)
//     // input := string(inputBytes) // Unused now
    
//     // Manual parsing because struct mapping can be brittle with varying JSON
//     // Just find the numbers for this specific 'add' test case to verify flow
//     // In production, you'd use encoding/json with a map[string]interface{}
    
//     solution := Solution{}
//     var results []int
    
//     // Very naive parsing for the "add" test case: {"... "args": [5, 10] ...}
//     // seeking "args"
    
//     // Try to scan for integers in the input string
//     // This is HACK for verification only. 
//     // Real implementation should use json.Unmarshal but ensure struct matches EXACTLY
    
//     // Let's rely on the previous json unmarshal but make it more robust
//     var payload struct {
//         FunctionName string \`json:"functionName"\`
//         Tests        []struct {
//              Args []interface{} \`json:"args"\`
//         } \`json:"tests"\`
//     }
    
//     if err := json.Unmarshal(inputBytes, &payload); err == nil {
//          for _, test := range payload.Tests {
//              if len(test.Args) >= 2 {
//                  // Type assertion is critical in Go
//                  // JSON numbers are float64 by default
//                  var valA, valB int
                 
//                  if v, ok := test.Args[0].(float64); ok { valA = int(v) }
//                  if v, ok := test.Args[1].(float64); ok { valB = int(v) }
                 
//                  res := solution.Add(valA, valB)
//                  results = append(results, res)
//              }
//          }
//     }
    
//     // Output
//     fmt.Print("{\\"results\\":[")
//     for i, res := range results {
//         if i > 0 { fmt.Print(",") }
//         fmt.Print(res)
//     }
//     fmt.Println("]}")
// }
// `;
// }

// /**
//  * Generate Go boilerplate code
//  */
// export function generateGoBoilerplate(signature, className) {
//     const functionName = signature.functionName;
//     // Capitalize first letter for Go convention
//     const goFunctionName = functionName.charAt(0).toUpperCase() + functionName.slice(1);
//     const params = signature.params || [];
//     const returnType = signature.returnType || 'int';
    
//     const paramList = params.map(p => {
//         const type = p.type || 'int';
//         return `${p.name} ${type}`;
//     }).join(', ');

//     return `package main

// // Solution struct
// type Solution struct{}

// // ${goFunctionName} - Write your code here
// func (s Solution) ${goFunctionName}(${paramList}) ${returnType} {
//     // Write your code here
    
// }
// `;
// }
/**
 * Build Go harness (deterministic, signature-driven)
 *
 * Input JSON:
 * {"functionName":"add","tests":[{"args":[5,10]}]}
 *
 * Output JSON:
 * {"results":[15]}
 */
export function buildGoHarness(userSource, signature) {
  const functionName = signature.functionName || "solve";
  const goMethodName = functionName.charAt(0).toUpperCase() + functionName.slice(1);

  // Remove any existing `package main` to avoid duplicates
  const cleanUserSource = String(userSource || "").replace(/^\s*package\s+main\s*\n+/m, "");

  // Ensure Solution struct exists (many candidates won't include it)
  // If user already defines `type Solution struct`, don't duplicate
  const hasSolution =
    /type\s+Solution\s+struct\s*\{/m.test(cleanUserSource) ||
    /type\s+Solution\s+struct\b/m.test(cleanUserSource);

  // Build param conversions based on signature types (supports int, long->int64, double->float64, bool, string)
  const params = Array.isArray(signature.params) ? signature.params : [];

  const goType = (t) => {
    const x = String(t || "int").toLowerCase();
    if (x === "int" || x === "int32") return "int";
    if (x === "long" || x === "int64") return "int64";
    if (x === "double" || x === "float" || x === "float64") return "float64";
    if (x === "boolean" || x === "bool") return "bool";
    if (x === "string") return "string";
    // TODO arrays later
    return "int";
  };

  // create typed vars a0,a1,... and conversion from []interface{} tokens
  const decls = params.map((p, i) => `    var a${i} ${goType(p.type)}`).join("\n");

  const converts = params
    .map((p, i) => {
      const t = goType(p.type);
      if (t === "int") {
        return `    a${i} = toInt(args[${i}])`;
      }
      if (t === "int64") {
        return `    a${i} = toInt64(args[${i}])`;
      }
      if (t === "float64") {
        return `    a${i} = toFloat64(args[${i}])`;
      }
      if (t === "bool") {
        return `    a${i} = toBool(args[${i}])`;
      }
      if (t === "string") {
        return `    a${i} = toString(args[${i}])`;
      }
      return `    a${i} = toInt(args[${i}])`;
    })
    .join("\n");

  const callArgs = params.map((_, i) => `a${i}`).join(", ");

  return `package main

import (
  "encoding/json"
  "fmt"
  "io/ioutil"
  "os"

)

${hasSolution ? "" : "type Solution struct{}\n"}

${cleanUserSource}

// ============================================================
// HARNESS (auto-generated, do not modify)
// ============================================================

type Payload struct {
  FunctionName string \`json:"functionName"\`
  Tests []struct {
    Args []interface{} \`json:"args"\`
  } \`json:"tests"\`
}

type Out struct {
  Results []interface{} \`json:"results"\`
  Error string \`json:"error,omitempty"\`
}

func toFloat64(v interface{}) float64 {
  switch x := v.(type) {
  case float64:
    return x
  case int:
    return float64(x)
  case int64:
    return float64(x)
  default:
    return 0
  }
}
func toInt(v interface{}) int {
  return int(toFloat64(v))
}
func toInt64(v interface{}) int64 {
  return int64(toFloat64(v))
}
func toBool(v interface{}) bool {
  if b, ok := v.(bool); ok { return b }
  return false
}
func toString(v interface{}) string {
  if s, ok := v.(string); ok { return s }
  return fmt.Sprintf("%v", v)
}

func main() {
  input, _ := ioutil.ReadAll(os.Stdin)


  if len(input) == 0 {
    fmt.Print("{\\"results\\":[],\\"error\\":\\"Empty stdin\\"}")
    return
  }

  var payload Payload
  if err := json.Unmarshal(input, &payload); err != nil {
    fmt.Printf("{\\"results\\":[],\\"error\\":%q}", err.Error())
    return
  }

  solution := Solution{}
  results := make([]interface{}, 0, len(payload.Tests))

  for _, t := range payload.Tests {
    args := t.Args
    if len(args) < ${params.length} {
      results = append(results, nil)
      continue
    }

${decls ? decls : ""}

${converts ? converts : ""}

    res := solution.${goMethodName}(${callArgs})
    results = append(results, res)
  }

  out := Out{Results: results}
  b, _ := json.Marshal(out)
  fmt.Print(string(b))
}
`;
}

/**
 * Generate Go boilerplate code
 */
export function generateGoBoilerplate(signature, className) {
  const functionName = signature.functionName || "solve";
  const goMethodName = functionName.charAt(0).toUpperCase() + functionName.slice(1);
  const params = signature.params || [];
  const returnType = signature.returnType || "int";

  const goType = (t) => {
    const x = String(t || "int").toLowerCase();
    if (x === "int" || x === "int32") return "int";
    if (x === "long" || x === "int64") return "int64";
    if (x === "double" || x === "float" || x === "float64") return "float64";
    if (x === "boolean" || x === "bool") return "bool";
    if (x === "string") return "string";
    return "int";
  };

  const paramList = params.map(p => `${p.name} ${goType(p.type)}`).join(", ");

  return `package main

type Solution struct{}

// ${goMethodName} - Write your code here
func (s Solution) ${goMethodName}(${paramList}) ${goType(returnType)} {
  // Write your code here
  return 0
}
`;
}
