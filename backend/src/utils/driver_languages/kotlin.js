export function buildKotlinHarness(userSource, signature) {
  const className = signature.className || "Solution";
  const functionName = signature.functionName;
  const params = signature.params || [];

  const ktType = (t) => {
    const x = (t || "Int").toLowerCase().replace(/\s+/g, "");

    if (x === "int" || x === "integer") return "Int";
    if (x === "long") return "Long";
    if (x === "double" || x === "float") return "Double";
    if (x === "boolean" || x === "bool") return "Boolean";
    if (x === "string") return "String";

    if (x === "int[]" || x === "intarray") return "IntArray";
    if (x === "long[]" || x === "longarray") return "LongArray";
    if (x === "double[]" || x === "doublearray" || x === "float[]") return "DoubleArray";
    if (x === "boolean[]" || x === "bool[]") return "BooleanArray";
    if (x === "string[]") return "Array<String>";

    if (x.includes("list") && x.includes("int")) return "List<Int>";
    if (x.includes("list") && x.includes("string")) return "List<String>";

    return "String";
  };

  const paramTypes = params.map(p => ktType(p.type));
  const arity = paramTypes.length;
  const callArgs = paramTypes.map((_, i) => `a${i}`).join(", ");

  const parseLines = paramTypes.map((t, i) => {
    if (t === "Int") return `val a${i} = args[${i}].toInt()`;
    if (t === "Long") return `val a${i} = args[${i}].toLong()`;
    if (t === "Double") return `val a${i} = args[${i}].toDouble()`;
    if (t === "Boolean") return `val a${i} = args[${i}].lowercase() == "true"`;

    if (t === "IntArray") {
      return `val a${i} = parseIntArray(args[${i}])`;
    }
    if (t === "LongArray") {
      return `val a${i} = parseLongArray(args[${i}])`;
    }
    if (t === "DoubleArray") {
      return `val a${i} = parseDoubleArray(args[${i}])`;
    }
    if (t === "BooleanArray") {
      return `val a${i} = parseBooleanArray(args[${i}])`;
    }
    if (t === "Array<String>") {
      return `val a${i} = parseStringArray(args[${i}])`;
    }

    // String default
    return `val a${i} = args[${i}]`;
  }).join("\n        ");

  // Helper for printing result as JSON safely (basic types + arrays)
  // NOTE: If you need objects, you must add a real JSON lib.
  const returnType = ktType(signature.returnType || "Int");

  return `import java.io.BufferedReader
import java.io.InputStreamReader

${userSource}

// ============================================================
// HARNESS (auto-generated, do not modify)
// ============================================================

private fun extractFirstArgsArray(input: String): String? {
    val testsPos = input.indexOf("\\"tests\\"")
    if (testsPos == -1) return null

    val argsKey = input.indexOf("\\"args\\"", testsPos)
    if (argsKey == -1) return null

    val startBracket = input.indexOf('[', argsKey)
    if (startBracket == -1) return null

    var depth = 0
    var endBracket = -1
    var i = startBracket
    while (i < input.length) {
        val c = input[i]
        if (c == '[') depth++
        else if (c == ']') {
            depth--
            if (depth == 0) { endBracket = i; break } // IMPORTANT: i (not i+1)
        }
        i++
    }
    if (endBracket == -1) return null

    // Return content INSIDE [...]
    return input.substring(startBracket + 1, endBracket).trim()
}

private fun splitTopLevelArgs(raw: String): List<String> {
    val out = ArrayList<String>()
    var depth = 0
    var inQuotes = false
    var escape = false
    val sb = StringBuilder()

    fun flush() {
        val token = sb.toString().trim()
        if (token.isNotEmpty()) out.add(unquoteIfQuoted(token))
        sb.setLength(0)
    }

    for (c in raw) {
        if (escape) {
            sb.append(c)
            escape = false
            continue
        }
        if (c == '\\\\' && inQuotes) {
            sb.append(c)
            escape = true
            continue
        }
        if (c == '"') {
            inQuotes = !inQuotes
            sb.append(c)
            continue
        }

        if (!inQuotes) {
            if (c == '[' || c == '{') depth++
            else if (c == ']' || c == '}') depth--
            else if (c == ',' && depth == 0) {
                flush()
                continue
            }
        }
        sb.append(c)
    }
    if (sb.isNotEmpty()) flush()
    return out
}

private fun unquoteIfQuoted(s: String): String {
    val t = s.trim()
    if (t.length >= 2 && t.first() == '"' && t.last() == '"') {
        // keep basic escapes as-is; array parsers below handle inner quotes
        return t.substring(1, t.length - 1)
    }
    return t
}

private fun parseIntArray(s: String): IntArray =
    s.trim().removePrefix("[").removeSuffix("]")
        .takeIf { it.isNotBlank() }?.split(",")?.map { it.trim().toInt() }?.toIntArray()
        ?: intArrayOf()

private fun parseLongArray(s: String): LongArray =
    s.trim().removePrefix("[").removeSuffix("]")
        .takeIf { it.isNotBlank() }?.split(",")?.map { it.trim().toLong() }?.toLongArray()
        ?: longArrayOf()

private fun parseDoubleArray(s: String): DoubleArray =
    s.trim().removePrefix("[").removeSuffix("]")
        .takeIf { it.isNotBlank() }?.split(",")?.map { it.trim().toDouble() }?.toDoubleArray()
        ?: doubleArrayOf()

private fun parseBooleanArray(s: String): BooleanArray =
    s.trim().removePrefix("[").removeSuffix("]")
        .takeIf { it.isNotBlank() }?.split(",")?.map { it.trim().lowercase() == "true" }?.toBooleanArray()
        ?: booleanArrayOf()

private fun parseStringArray(s: String): Array<String> {
    val inner = s.trim().removePrefix("[").removeSuffix("]").trim()
    if (inner.isBlank()) return emptyArray()
    // Split string array safely using the same top-level splitter
    val parts = splitTopLevelArgs(inner)
    return parts.map { it.trim().removePrefix("\\"").removeSuffix("\\"") }.toTypedArray()
}

private fun jsonEscape(s: String): String =
    s.replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"").replace("\\n", "\\\\n").replace("\\r", "\\\\r").replace("\\t", "\\\\t")

private fun printResultAsJson(result: Any?): String {
    return when (result) {
        null -> "null"
        is String -> "\\"${'$'}{jsonEscape(result)}\\""
        is Char -> "\\"${'$'}{jsonEscape(result.toString())}\\""
        is Boolean -> if (result) "true" else "false"
        is Int, is Long, is Double, is Float -> result.toString()
        is IntArray -> result.joinToString(prefix = "[", postfix = "]")
        is LongArray -> result.joinToString(prefix = "[", postfix = "]")
        is DoubleArray -> result.joinToString(prefix = "[", postfix = "]")
        is BooleanArray -> result.joinToString(prefix = "[", postfix = "]") { if (it) "true" else "false" }
        is Array<*> -> result.joinToString(prefix = "[", postfix = "]") { v ->
            if (v is String) "\\"${'$'}{jsonEscape(v)}\\"" else (v?.toString() ?: "null")
        }
        else -> "\\"${'$'}{jsonEscape(result.toString())}\\"" // safe fallback
    }
}

fun main() {
    try {
        val input = BufferedReader(InputStreamReader(System.\`in\`)).readText().trim()
        if (input.isEmpty()) {
            println("{\\"results\\":[],\\"error\\":\\"Empty stdin\\"}")
            return
        }

        val rawArgs = extractFirstArgsArray(input)
        if (rawArgs == null) {
            println("{\\"results\\":[],\\"error\\":\\"Invalid JSON: missing tests[0].args\\"}")
            return
        }

        val args = splitTopLevelArgs(rawArgs)

        if (args.size != ${arity}) {
            println("{\\"results\\":[],\\"error\\":\\"Arity mismatch: expected ${arity} got \${'$'}{args.size}\\"}")
            return
        }

        val solution = ${className}()

        ${parseLines}

        val result = solution.${functionName}(${callArgs})

        println("{\\"results\\":[\${'$'}{printResultAsJson(result)}]}")

    } catch (e: Exception) {
        val msg = e.message?.replace("\\\\", "/") ?: "Exception"
        println("{\\"results\\":[],\\"error\\":\\"\${'$'}msg\\"}")
    }
}
`;
}


/**
 * Generate Kotlin boilerplate code
 */
export function generateKotlinBoilerplate(signature, className) {
    const functionName = signature.functionName;
    const params = signature.params || [];

    // Type normalization helper
    const normalizeType = (t) => {
        const x = (t || 'Int').toLowerCase();

        // Primitives
        if (x === 'int' || x === 'integer') return 'Int';
        if (x === 'long') return 'Long';
        if (x === 'double' || x === 'float') return 'Double';
        if (x === 'boolean' || x === 'bool') return 'Boolean';
        if (x === 'string') return 'String';

        // Array Types 
        if (x.includes('int') && x.includes('[]')) return 'IntArray';
        if (x.includes('long') && x.includes('[]')) return 'LongArray';
        if (x.includes('double') && x.includes('[]')) return 'DoubleArray';
        if (x.includes('boolean') && x.includes('[]')) return 'BooleanArray';
        if (x.includes('string') && x.includes('[]')) return 'Array<String>';
        if (x.includes('list') && x.includes('int')) return 'List<Int>';

        return 'Int'; // Default fallback
    };

    const returnType = normalizeType(signature.returnType);

    const paramList = params.map(p => {
        return `${p.name}: ${normalizeType(p.type)}`;
    }).join(', ');

    // Determine default return value
    let defaultReturn = '0';
    if (returnType === 'Boolean') defaultReturn = 'false';
    if (returnType === 'String') defaultReturn = '""';
    if (returnType === 'Double') defaultReturn = '0.0';
    if (returnType === 'Long') defaultReturn = '0L';
    if (returnType === 'IntArray') defaultReturn = 'IntArray(0)';
    if (returnType === 'LongArray') defaultReturn = 'LongArray(0)';
    if (returnType === 'DoubleArray') defaultReturn = 'DoubleArray(0)';
    if (returnType === 'BooleanArray') defaultReturn = 'BooleanArray(0)';
    if (returnType === 'Array<String>') defaultReturn = 'emptyArray<String>()';
    if (returnType.startsWith('List')) defaultReturn = 'emptyList()';

    return `class ${className} {
    fun ${functionName}(${paramList}): ${returnType} {
        // Write your code here
        return ${defaultReturn}
    }
}
`;
}
