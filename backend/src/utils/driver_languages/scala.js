/**
 * Build Scala harness
 */
export function buildScalaHarness(userSource, signature) {
  const className = signature.className || "Solution";
  const functionName = signature.functionName || "solve";
  const params = Array.isArray(signature.params) ? signature.params : [];
  
  // Type mapping helper
  const scalaType = (t) => {
    const x = (t || "Int").toLowerCase();
    
    // Primitives
    if (x === "int" || x === "integer") return "Int";
    if (x === "long") return "Long";
    if (x === "double" || x === "float") return "Double";
    if (x === "boolean" || x === "bool") return "Boolean";
    if (x === "string") return "String";
    
    // Arrays
    if (x.includes("int") && x.includes("[]")) return "Array[Int]";
    if (x.includes("long") && x.includes("[]")) return "Array[Long]";
    if (x.includes("double") && x.includes("[]")) return "Array[Double]";
    if (x.includes("boolean") && x.includes("[]")) return "Array[Boolean]";
    if (x.includes("string") && x.includes("[]")) return "Array[String]";
    
    return "Int"; // fallback
  };

  const paramCount = params.length;

  // Generate argument extraction logic
  const parseLines = params.map((p, i) => {
      const sType = scalaType(p.type);
      
      // We expect input "args": [arg0, arg1]
      // arg0 could be 5 or [1,2,3]
      // We need to parse the JSON structure manually since default Scala libs are minimal
      
      // Logic:
      // 1. Extract the raw string for the i-th element of the extracted args list
      // 2. Parse it based on expected type
      
      if (sType === "Int") return `val a${i} = argsList(${i}).trim.toInt`;
      if (sType === "Long") return `val a${i} = argsList(${i}).trim.toLong`;
      if (sType === "Double") return `val a${i} = argsList(${i}).trim.toDouble`;
      if (sType === "Boolean") return `val a${i} = argsList(${i}).trim == "true"`;
      if (sType === "String") return `val a${i} = argsList(${i}).trim.stripPrefix("\\"").stripSuffix("\\"")`;
      
      if (sType.startsWith("Array[")) {
          const inner = sType.match(/Array\[(.+)\]/)[1];
          let conv = "";
          if (inner === "Int") conv = ".toInt";
          if (inner === "Long") conv = ".toLong";
          if (inner === "Double") conv = ".toDouble";
          if (inner === "Boolean") conv = " == \"true\"";
          if (inner === "String") conv = ".stripPrefix(\"\\\"\").stripSuffix(\"\\\"\")"; // Handle string arrays if needed
          
          return `
          val raw${i} = argsList(${i}).trim.stripPrefix("[").stripSuffix("]")
          val a${i} = if (raw${i}.isEmpty) Array[${inner}]() 
                      else raw${i}.split(",").map(_.trim${conv})
          `;
      }
      
      return `val a${i} = argsList(${i})`; 
  }).join("\n        ");
  
  const callArgs = params.map((_, i) => `a${i}`).join(", ");

  return `${userSource}

import scala.io.Source
import scala.util.matching.Regex

object Main {
  def main(args: Array[String]): Unit = {
    try {
      val input = Source.stdin.getLines().mkString.trim
      if (input.isEmpty) {
        println("{\\"results\\":[],\\"error\\":\\"Empty stdin\\"}")
        return
      }

      // Simple JSON parser for "args": [ ... ]
      // We need to find the array content and then split it safely
      
      val argsMarker = "\\"args\\":"
      val startIdx = input.indexOf(argsMarker)
      
      if (startIdx != -1) {
          val arrayStart = input.indexOf("[", startIdx + argsMarker.length)
          if (arrayStart != -1) {
              // Extract the array content respecting balanced brackets
              var depth = 0
              var arrayEnd = -1
              var i = arrayStart
              var found = false
              
              while (i < input.length && !found) {
                  val c = input.charAt(i)
                  if (c == '[') depth += 1
                  else if (c == ']') depth -= 1
                  
                  if (depth == 0) {
                      arrayEnd = i
                      found = true
                  }
                  i += 1
              }
              
              if (found) {
                  val argsContent = input.substring(arrayStart + 1, arrayEnd)
                  
                  // Split argsContent by comma, respecting nested brackets
                  val argsBuffer = scala.collection.mutable.ListBuffer[String]()
                  var currentObj = new StringBuilder()
                  var objDepth = 0
                  
                  for (c <- argsContent) {
                      if (c == '[') objDepth += 1
                      else if (c == ']') objDepth -= 1
                      
                      if (c == ',' && objDepth == 0) {
                          argsBuffer += currentObj.toString()
                          currentObj.setLength(0)
                      } else {
                          currentObj.append(c)
                      }
                  }
                  if (currentObj.nonEmpty) {
                      argsBuffer += currentObj.toString()
                  }
                  
                  val argsList = argsBuffer.toList
                  
                  if (argsList.length < ${paramCount}) {
                      println("{\\"results\\":[],\\"error\\":\\"Insufficient arguments\\"}")
                      return
                  }
                  
                  val solution = new ${className}()
                  
                  ${parseLines}
                  
                  val res: Any = solution.${functionName}(${callArgs})
                  
                  // Format result
                  val resStr = res match {
                      case arr: Array[_] => "[" + arr.mkString(",") + "]"
                      case list: List[_] => "[" + list.mkString(",") + "]"
                      case s: String => "\\"" + s + "\\""
                      case other => other.toString
                  }
                  
                  println("{\\"results\\":[" + resStr + "]}")
                  return
              }
          }
      }
      
      println("{\\"results\\":[],\\"error\\":\\"Invalid input structure\\"}")

    } catch {
      case e: Exception =>
        val msg = Option(e.getMessage).getOrElse("Unknown Error")
            .replace("\\"", "\\\\\\\\\\"")
        println("{\\"results\\":[],\\"error\\":\\"" + msg + "\\"}")
    }
  }
}
`;
}


/**
 * Generate Scala boilerplate code
 */
export function generateScalaBoilerplate(signature, className) {
  const functionName = signature.functionName || "solve";
  const params = Array.isArray(signature.params) ? signature.params : [];
  
  // Type mapping helper
  const scalaType = (t) => {
    const x = (t || "Int").toLowerCase();
    
    // Primitives
    if (x === "int" || x === "integer") return "Int";
    if (x === "long") return "Long";
    if (x === "double" || x === "float") return "Double";
    if (x === "boolean" || x === "bool") return "Boolean";
    if (x === "string") return "String";
    
    // Arrays
    if (x.includes("int") && x.includes("[]")) return "Array[Int]";
    if (x.includes("long") && x.includes("[]")) return "Array[Long]";
    if (x.includes("double") && x.includes("[]")) return "Array[Double]";
    if (x.includes("boolean") && x.includes("[]")) return "Array[Boolean]";
    if (x.includes("string") && x.includes("[]")) return "Array[String]";
    
    return "Int"; // fallback
  };

  const returnType = scalaType(signature.returnType);

  const paramList = params
    .map(p => `${p.name}: ${scalaType(p.type)}`)
    .join(", ");

  const defaultReturn =
    returnType === "Boolean" ? "false"
    : returnType === "String" ? "\"\""
    : returnType.startsWith("Array") ? "Array()"
    : "0";

  return `class ${className} {
  def ${functionName}(${paramList}): ${returnType} = {
    // Write your code here
    ${defaultReturn}
  }
}
`;
}
