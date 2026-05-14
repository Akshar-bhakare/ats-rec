/**
 * Java Harness + Boilerplate Generator
 *
 * Goals:
 * - Read JSON stdin: {"functionName":"...", "tests":[{"args":[...]}]}
 * - Extract tests[0].args safely (handles strings + nested brackets in other parts)
 * - Convert args based on signature.params types (int, int[], List<Integer>, String, etc.)
 * - Call Solution.<functionName>(typedArgs...)
 * - Print JSON stdout: {"results":[<json>]}
 *
 * Notes:
 * - No external JSON library (keeps Judge0 CE minimal)
 * - Supports primitives, Strings, and Arrays/Lists of primitives/Strings
 */

function normalizeType(t) {
  const x = String(t || "int").trim().toLowerCase();
  
  // Primitives
  if (x === "int" || x === "integer") return "int";
  if (x === "long") return "long";
  if (x === "double" || x === "float") return "double";
  if (x === "boolean" || x === "bool") return "boolean";
  if (x === "char" || x === "character") return "char";
  
  // String
  if (x === "string" || x === "str") return "String";
  
  // Arrays
  if (x === "int[]" || x === "integer[]") return "int[]";
  if (x === "long[]") return "long[]";
  if (x === "double[]" || x === "float[]") return "double[]";
  if (x === "boolean[]" || x === "bool[]") return "boolean[]";
  if (x === "char[]") return "char[]";
  if (x === "string[]" || x === "str[]") return "String[]";
  
  // Lists
  if (x.includes("list<integer>")) return "List<Integer>";
  if (x.includes("list<long>")) return "List<Long>";
  if (x.includes("list<double>")) return "List<Double>";
  if (x.includes("list<boolean>")) return "List<Boolean>";
  if (x.includes("list<string>")) return "List<String>";
  
  // Fallback
  return "int"; // Default to int if unknown
}

function defaultReturnFor(javaType) {
  if (javaType === "void") return "";
  if (javaType === "boolean") return "return false;";
  if (javaType === "double") return "return 0.0;";
  if (javaType === "long") return "return 0L;";
  if (javaType === "String") return 'return "";';
  if (javaType.endsWith("[]")) return "return new " + javaType.replace("[]", "[0];");
  if (javaType.startsWith("List")) return "return new ArrayList<>();";
  return "return 0;";
}

/**
 * Build Java harness
 */
export function buildJavaHarness(userSource, signature) {
  const className = signature.className || "Solution";
  const functionName = signature.functionName || "solve";
  const params = Array.isArray(signature.params) ? signature.params : [];

  // Generate typed variable declarations: int a0; String a1; ...
  const declLines = params.map((p, i) => `      ${normalizeType(p.type)} a${i};`).join("\n");

  // Generate conversions from raw arg tokens
  const assignLines = params
    .map((p, i) => {
      const type = normalizeType(p.type);
      let parser = "";
      
      // Primitives
      if (type === "int") parser = `Integer.parseInt(r${i})`;
      else if (type === "long") parser = `Long.parseLong(r${i})`;
      else if (type === "double") parser = `Double.parseDouble(r${i})`;
      else if (type === "boolean") parser = `Boolean.parseBoolean(r${i})`;
      else if (type === "char") parser = `parseChar(r${i})`;
      else if (type === "String") parser = `parseString(r${i})`;
      
      // Arrays
      else if (type === "int[]") parser = `parseIntArray(r${i})`;
      else if (type === "long[]") parser = `parseLongArray(r${i})`;
      else if (type === "double[]") parser = `parseDoubleArray(r${i})`;
      else if (type === "String[]") parser = `parseStringArray(r${i})`;
      else if (type === "boolean[]") parser = `parseBooleanArray(r${i})`;
      else if (type === "char[]") parser = `parseCharArray(r${i})`;
      
      // Lists
      else if (type === "List<Integer>") parser = `parseIntegerList(r${i})`;
      else if (type === "List<Long>") parser = `parseLongList(r${i})`;
      else if (type === "List<Double>") parser = `parseDoubleList(r${i})`;
      else if (type === "List<String>") parser = `parseStringList(r${i})`;
      else if (type === "List<Boolean>") parser = `parseBooleanList(r${i})`;
      
      // Fallback
      else parser = `Integer.parseInt(r${i})`;

      return `
      if (raw.size() <= ${i}) throw new RuntimeException("Missing arg ${i}");
      String r${i} = raw.get(${i});
      if (r${i}.equals("null")) {
          // Handle nulls for objects if needed, for now throw or null
          // Primitives cannot be null
          ${['int','long','double','boolean','char'].includes(type) ? `throw new RuntimeException("Primitive arg ${i} cannot be null");` : `a${i} = null;`}
      } else {
          a${i} = ${parser};
      }
      `.trimEnd();
    })
    .join("\n");

  // Call args: a0, a1, ...
  const callArgs = params.map((_, i) => `a${i}`).join(", ");

  return `import java.io.*;
import java.util.*;
import java.util.stream.*;

${userSource}

// ============================================================
// HARNESS (auto-generated, do not modify)
// ============================================================
class Main {

  public static void main(String[] args) {
    try {
      String input = readAllStdin().trim();
      if (input.isEmpty()) {
        System.out.println("{\\"results\\":[],\\"error\\":\\"Empty stdin\\"}");
        System.exit(1);
      }

      // Find "args":
      int argsKey = input.indexOf("\\"args\\":");
      if (argsKey < 0) {
        System.out.println("{\\"results\\":[],\\"error\\":\\"Invalid JSON format: missing args\\"}");
        System.exit(1);
      }

      int start = input.indexOf('[', argsKey);
      if (start < 0) {
        System.out.println("{\\"results\\":[],\\"error\\":\\"Invalid JSON format: args not array\\"}");
        System.exit(1);
      }

      int end = findMatchingBracket(input, start);
      if (end < 0) {
        System.out.println("{\\"results\\":[],\\"error\\":\\"Invalid JSON format: unterminated args array\\"}");
        System.exit(1);
      }

      String argsArray = input.substring(start, end + 1);
      List<String> raw = splitJsonArray(argsArray);

${declLines ? declLines : ""}

${assignLines ? assignLines : ""}

      ${className} solution = new ${className}();
      Object resultObj = solution.${functionName}(${callArgs});

      System.out.println("{\\"results\\":[" + toJson(resultObj) + "]}");
    } catch (Exception e) {
      e.printStackTrace();
      System.out.println("{\\"results\\":[],\\"error\\":\\"" + escapeJson(e.toString()) + "\\"}");
      System.exit(1);
    }
  }

  private static String readAllStdin() throws IOException {
    BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
    StringBuilder sb = new StringBuilder();
    String line;
    while ((line = br.readLine()) != null) sb.append(line);
    return sb.toString();
  }

  // Finds matching ']' for a '[' at position start, handling nested arrays and strings
  private static int findMatchingBracket(String s, int start) {
    int depth = 0;
    boolean inStr = false;
    boolean esc = false;

    for (int i = start; i < s.length(); i++) {
      char c = s.charAt(i);
      if (inStr) {
        if (esc) { esc = false; continue; }
        if (c == '\\\\') { esc = true; continue; }
        if (c == '"') inStr = false;
        continue;
      } else {
        if (c == '"') { inStr = true; continue; }
        if (c == '[') depth++;
        if (c == ']') {
          depth--;
          if (depth == 0) return i;
        }
      }
    }
    return -1;
  }

  // Robustly splits a JSON array string [a, b, c] into [a, b, c] as strings
  // Respects nested brackets and quotes
  private static List<String> splitJsonArray(String arr) {
    List<String> out = new ArrayList<>();
    String s = arr.trim();
    if (s.length() < 2 || s.charAt(0) != '[' || s.charAt(s.length()-1) != ']') return out;

    // Use a scanner-like approach
    int depth = 0; // [] and {}
    boolean inStr = false;
    boolean esc = false;
    StringBuilder cur = new StringBuilder();

    // Skip first '[' and last ']'
    for (int i = 1; i < s.length() - 1; i++) {
        char c = s.charAt(i);
        
        if (inStr) {
            if (esc) {
                cur.append(c);
                esc = false;
            } else if (c == '\\\\') {
                cur.append(c);
                esc = true;
            } else if (c == '"') {
                cur.append(c);
                inStr = false;
            } else {
                cur.append(c);
            }
        } else {
            if (c == '"') {
                cur.append(c);
                inStr = true;
            } else if (c == '[' || c == '{') {
                cur.append(c);
                depth++;
            } else if (c == ']' || c == '}') {
                cur.append(c);
                depth--;
            } else if (c == ',' && depth == 0) {
                out.add(cur.toString().trim());
                cur.setLength(0);
            } else {
                cur.append(c);
            }
        }
    }
    if (cur.length() > 0) {
        out.add(cur.toString().trim());
    }
    return out;
  }
  
  // PARSERS
  
  private static String parseString(String s) {
      if (s.equals("null")) return null;
      if (s.startsWith("\\"") && s.endsWith("\\"")) {
          // Simple unescaping
          String inner = s.substring(1, s.length() - 1);
          return inner.replace("\\\\\\"", "\\"").replace("\\\\\\\\", "\\\\");
      }
      return s;
  }

  private static char parseChar(String s) {
      if (s.equals("null")) throw new RuntimeException("char cannot be null");
      String str = parseString(s);
      if (str.length() != 1) throw new RuntimeException("Expected single character for char type, got: " + str);
      return str.charAt(0);
  }
  
  private static int[] parseIntArray(String s) {
      if (s.equals("null")) return null;
      List<String> items = splitJsonArray(s);
      int[] res = new int[items.size()];
      for(int i=0; i<items.size(); i++) res[i] = Integer.parseInt(items.get(i));
      return res;
  }
  
  private static long[] parseLongArray(String s) {
      if (s.equals("null")) return null;
      List<String> items = splitJsonArray(s);
      long[] res = new long[items.size()];
      for(int i=0; i<items.size(); i++) res[i] = Long.parseLong(items.get(i));
      return res;
  }
  
  private static double[] parseDoubleArray(String s) {
      if (s.equals("null")) return null;
      List<String> items = splitJsonArray(s);
      double[] res = new double[items.size()];
      for(int i=0; i<items.size(); i++) res[i] = Double.parseDouble(items.get(i));
      return res;
  }
  
  private static boolean[] parseBooleanArray(String s) {
      if (s.equals("null")) return null;
      List<String> items = splitJsonArray(s);
      boolean[] res = new boolean[items.size()];
      for(int i=0; i<items.size(); i++) res[i] = Boolean.parseBoolean(items.get(i));
      return res;
  }
 
  private static char[] parseCharArray(String s) {
      if (s.equals("null")) return null;
      List<String> items = splitJsonArray(s);
      char[] res = new char[items.size()];
      for(int i=0; i<items.size(); i++) {
        String str = parseString(items.get(i));
        res[i] = str.length() > 0 ? str.charAt(0) : '\\0';
      }
      return res;
  }

  private static String[] parseStringArray(String s) {
      if (s.equals("null")) return null;
      List<String> items = splitJsonArray(s);
      String[] res = new String[items.size()];
      for(int i=0; i<items.size(); i++) res[i] = parseString(items.get(i));
      return res;
  }
  
  private static List<Integer> parseIntegerList(String s) {
      if (s.equals("null")) return null;
      List<String> items = splitJsonArray(s);
      List<Integer> res = new ArrayList<>();
      for(String item : items) res.add(Integer.parseInt(item));
      return res;
  }
  
  private static List<Long> parseLongList(String s) {
      if (s.equals("null")) return null;
      List<String> items = splitJsonArray(s);
      List<Long> res = new ArrayList<>();
      for(String item : items) res.add(Long.parseLong(item));
      return res;
  }
  
  private static List<Double> parseDoubleList(String s) {
      if (s.equals("null")) return null;
      List<String> items = splitJsonArray(s);
      List<Double> res = new ArrayList<>();
      for(String item : items) res.add(Double.parseDouble(item));
      return res;
  }
  
  private static List<Boolean> parseBooleanList(String s) {
      if (s.equals("null")) return null;
      List<String> items = splitJsonArray(s);
      List<Boolean> res = new ArrayList<>();
      for(String item : items) res.add(Boolean.parseBoolean(item));
      return res;
  }
  
  private static List<String> parseStringList(String s) {
      if (s.equals("null")) return null;
      List<String> items = splitJsonArray(s);
      List<String> res = new ArrayList<>();
      for(String item : items) res.add(parseString(item));
      return res;
  }

  private static String toJson(Object obj) {
    if (obj == null) return "null";
    if (obj instanceof String) return "\\"" + escapeJson((String)obj) + "\\"";
    if (obj instanceof Boolean || obj instanceof Integer || obj instanceof Long || obj instanceof Double) return obj.toString();
    if (obj instanceof Character) return "\\"" + escapeJson(obj.toString()) + "\\"";

    if (obj instanceof int[]) {
      int[] a = (int[]) obj;
      StringBuilder sb = new StringBuilder("[");
      for (int i = 0; i < a.length; i++) {
        if (i > 0) sb.append(",");
        sb.append(a[i]);
      }
      sb.append("]");
      return sb.toString();
    }
    if (obj instanceof long[]) {
      long[] a = (long[]) obj;
      StringBuilder sb = new StringBuilder("[");
      for (int i = 0; i < a.length; i++) {
        if (i > 0) sb.append(",");
        sb.append(a[i]);
      }
      sb.append("]");
      return sb.toString();
    }
    if (obj instanceof double[]) {
      double[] a = (double[]) obj;
      StringBuilder sb = new StringBuilder("[");
      for (int i = 0; i < a.length; i++) {
        if (i > 0) sb.append(",");
        sb.append(a[i]);
      }
      sb.append("]");
      return sb.toString();
    }
    if (obj instanceof boolean[]) {
      boolean[] a = (boolean[]) obj;
      StringBuilder sb = new StringBuilder("[");
      for (int i = 0; i < a.length; i++) {
        if (i > 0) sb.append(",");
        sb.append(a[i]);
      }
      sb.append("]");
      return sb.toString();
    }
    if (obj instanceof char[]) {
      char[] a = (char[]) obj;
      StringBuilder sb = new StringBuilder("[");
      for (int i = 0; i < a.length; i++) {
        if (i > 0) sb.append(",");
        sb.append("\\"").append(escapeJson(String.valueOf(a[i]))).append("\\"");
      }
      sb.append("]");
      return sb.toString();
    }
    if (obj instanceof Object[]) {
      Object[] a = (Object[]) obj;
      StringBuilder sb = new StringBuilder("[");
      for (int i = 0; i < a.length; i++) {
        if (i > 0) sb.append(",");
        sb.append(toJson(a[i]));
      }
      sb.append("]");
      return sb.toString();
    }
    if (obj instanceof Collection) {
      Collection<?> list = (Collection<?>) obj;
      StringBuilder sb = new StringBuilder("[");
      int i = 0;
      for (Object o : list) {
        if (i > 0) sb.append(",");
        sb.append(toJson(o));
        i++;
      }
      sb.append("]");
      return sb.toString();
    }

    return "\\"" + escapeJson(obj.toString()) + "\\"";
  }

  private static String escapeJson(String str) {
    if (str == null) return "";
    return str.replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"").replace("\\n", "\\\\n").replace("\\r", "\\\\r").replace("\\t", "\\\\t");
  }
}
`;
}

/**
 * Generate Java boilerplate code
 */
export function generateJavaBoilerplate(signature, className) {
  const functionName = signature.functionName || "solve";
  const params = Array.isArray(signature.params) ? signature.params : [];
  const returnType = normalizeType(signature.returnType || "int");

  const paramList = params
    .map((p) => `${normalizeType(p.type)} ${p.name}`)
    .join(", ");

  return `import java.util.*;
import java.io.*;

class ${className} {
    public ${returnType} ${functionName}(${paramList}) {
        // Write your code here
        ${defaultReturnFor(returnType)}
    }
}
`;
}
