/**
 * Build C harness
 */
export function buildCHarness(userSource, signature) {
  const functionName = signature.functionName;
  const params = signature.params || [];
  const returnTypeRaw = (signature.returnType || "int").trim();
  const returnType = returnTypeRaw.toLowerCase(); // for comparisons only

  let argParsingCode = "";
  let cleanupCode = "";
  let functionCallArgs = [];

  params.forEach((param, index) => {
    const paramType = (param.type || "int").toLowerCase().replace(/\s+/g, "");
    const paramName = (param.name || `arg${index}`).replace(/[^a-zA-Z0-9_]/g, "_");

    if (paramType === "int") {
      argParsingCode += `    int ${paramName} = 0;\n    sscanf(argsArray[${index}], "%d", &${paramName});\n`;
      functionCallArgs.push(paramName);
      return;
    }

    if (paramType === "long") {
      argParsingCode += `    long ${paramName} = 0;\n    sscanf(argsArray[${index}], "%ld", &${paramName});\n`;
      functionCallArgs.push(paramName);
      return;
    }

    if (paramType === "double" || paramType === "float") {
      argParsingCode += `    double ${paramName} = 0.0;\n    sscanf(argsArray[${index}], "%lf", &${paramName});\n`;
      functionCallArgs.push(paramName);
      return;
    }

    if (paramType === "string" || paramType === "char*") {
      argParsingCode += `    char* ${paramName} = (char*)malloc(10001);\n    if (!${paramName}) { printf("{\\"results\\":[],\\"error\\":\\"malloc failed\\"}\\n"); return 0; }\n    parseString(argsArray[${index}], ${paramName});\n`;
      cleanupCode += `    free(${paramName});\n`;
      functionCallArgs.push(paramName);
      return;
    }

        if (paramType === "int[]" || paramType === "int*") {
            argParsingCode += `    int* ${paramName} = (int*)malloc(20000 * sizeof(int));\n    if (!${paramName}) { printf("{\\"results\\":[],\\"error\\":\\"malloc failed\\"}\\n"); return 0; }\n    int ${paramName}Size = 0;\n    parseIntArray(argsArray[${index}], ${paramName}, &${paramName}Size);\n`;
            cleanupCode += `    free(${paramName});\n`;
            functionCallArgs.push(paramName, `${paramName}Size`);
            return;
        }

        if (paramType === "string[]" || paramType === "char**" || paramType === "char*[]") {
            argParsingCode += `    int ${paramName}Size = 0;\n    char** ${paramName} = parseStringArray(argsArray[${index}], &${paramName}Size);\n`;

            cleanupCode += `    if (${paramName}) { for(int i=0; i<${paramName}Size; i++) free(${paramName}[i]); free(${paramName}); }\n`;
            functionCallArgs.push(paramName, `${paramName}Size`);
            return;
        }

    if (paramType === "bool" || paramType === "boolean") {
      argParsingCode += `    bool ${paramName} = false;\n    parseBool(argsArray[${index}], &${paramName});\n`;
      functionCallArgs.push(paramName);
      return;
    }

    // default int fallback
    argParsingCode += `    int ${paramName} = 0;\n    sscanf(argsArray[${index}], "%d", &${paramName});\n`;
    functionCallArgs.push(paramName);
  });

  const callArgs = functionCallArgs.join(", ");
  const arity = params.length;

  // Helper for printing based on return type
  const printResultBlock = (() => {
    if (returnType === "int") {
      return `printf("%d", (int)result);`;
    }
    if (returnType === "long") {
      return `printf("%ld", (long)result);`;
    }
    if (returnType === "double" || returnType === "float") {
      return `printf("%g", (double)result);`;
    }
    if (returnType === "char*" || returnType === "string") {
      return `print_json_string((const char*)result);`;
    }
    if (returnType === "bool" || returnType === "boolean") {
      return `printf("%s", result ? "true" : "false");`;
    }
    // default
    return `printf("%d", (int)result);`;
  })();

  return `#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include <stdbool.h>
#include <stdbool.h>

// =================== USER CODE ===================
${userSource}

// ============================================================
// HARNESS (auto-generated, do not modify)
// ============================================================

// Forward declarations (avoid implicit-declaration issues)
static void trim_inplace(char* s);
static void parseIntArray(const char* str, int* arr, int* size);
static void parseString(const char* str, char* output);
static void parseBool(const char* str, bool* out);
static char** parseStringArray(const char* str, int* outSize);
static int splitArgsTopLevel(const char* argsStr, char argsArray[][20000], int maxArgs);
static void print_json_string(const char* s);
static const char* extract_first_args_array(const char* input, char* out, int outCap);

static void trim_inplace(char* s) {
    if (!s) return;

    // left trim by shifting
    int i = 0;
    while (s[i] && isspace((unsigned char)s[i])) i++;
    if (i > 0) memmove(s, s + i, strlen(s + i) + 1);

    // right trim
    int n = (int)strlen(s);
    while (n > 0 && isspace((unsigned char)s[n - 1])) n--;
    s[n] = '\\0';
}

// Extract first tests[0].args array content INSIDE [...]
static const char* extract_first_args_array(const char* input, char* out, int outCap) {
    if (!input || !out || outCap <= 1) return NULL;

    const char* testsPos = strstr(input, "\\"tests\\":");
    if (!testsPos) return NULL;

    const char* argsPos = strstr(testsPos, "\\"args\\":");
    if (!argsPos) return NULL;

    const char* startBracket = strchr(argsPos, '[');
    if (!startBracket) return NULL;

    int depth = 0;
    const char* p = startBracket;
    const char* endBracket = NULL;

    while (*p) {
        if (*p == '[') depth++;
        else if (*p == ']') {
            depth--;
            if (depth == 0) { endBracket = p; break; }
        }
        p++;
    }
    if (!endBracket) return NULL;

    int len = (int)(endBracket - startBracket - 1);
    if (len < 0) len = 0;
    if (len >= outCap) len = outCap - 1;

    strncpy(out, startBracket + 1, len);
    out[len] = '\\0';
    return out;
}

static void parseIntArray(const char* str, int* arr, int* size) {
    *size = 0;
    if (!str) return;

    const char* ptr = strchr(str, '[');
    if (!ptr) return;
    ptr++;

    while (*ptr && *ptr != ']') {
        while (*ptr && (*ptr == ' ' || *ptr == ',')) ptr++;
        if (*ptr && *ptr != ']') {
            if (*size < 20000) {
                arr[*size] = atoi(ptr);
                (*size)++;
            }
            while (*ptr && *ptr != ',' && *ptr != ']') ptr++;
        }
    }
}

static void parseString(const char* str, char* output) {
    if (!str || !output) return;

    trim_inplace((char*)str); 

    const char* start = strchr(str, '"');
    if (!start) {
        strncpy(output, str, 10000);
        output[10000] = '\\0';
        trim_inplace(output);
        return;
    }

    start++;
    const char* end = strchr(start, '"');
    if (!end) end = str + strlen(str);

    int len = (int)(end - start);
    if (len > 10000) len = 10000;
    strncpy(output, start, len);
    output[len] = '\\0';
}

static char** parseStringArray(const char* str, int* outSize) {
    // Basic parser for ["a", "b"]
    *outSize = 0;
    if (!str) return NULL;
    
    // Check start bracket
    const char* p = strchr(str, '[');
    if (!p) return NULL;
    p++; 

    // First pass: count elements
    // This is rough but C doesn't have vector. We'll pick a max size or realloc?
    // Let's allocate a fixed max for now (e.g., 2000 pointers) to be safe/simple
    int cap = 2000;
    char** arr = (char**)malloc(cap * sizeof(char*));
    if (!arr) return NULL;

    while (*p && *p != ']') {
        // Find next quote
        while (*p && *p != '"' && *p != ']') p++;
        if (*p == ']') break;
        
        if (*p == '"') {
             p++; // skip open quote
             // find close quote
             const char* endQuote = p;
             while (*endQuote && *endQuote != '"') {
                 if (*endQuote == '\\\\' && *(endQuote+1)) endQuote+=2;
                 else endQuote++;
             }
             
             int len = (int)(endQuote - p);
             char* item = (char*)malloc(len + 1);
             strncpy(item, p, len);
             item[len] = '\\0';
             
             if (*outSize < cap) {
                 arr[*outSize] = item;
                 (*outSize)++;
             } else {
                 free(item); // drop if overflow
             }
             
             p = endQuote;
             if (*p == '"') p++;
        }
        // skip comma or space
        p++;
    }
    return arr;
}

static void parseBool(const char* str, bool* output) {
    if (!str) { *output = false; return; }
    char buffer[64];
    strncpy(buffer, str, 63);
    buffer[63] = '\\0';
    trim_inplace(buffer);

    // check "true"
    if (strcmp(buffer, "true") == 0) {
        *output = true;
        return;
    }
    // check "false"
    if (strcmp(buffer, "false") == 0) {
        *output = false;
        return;
    }
    // check integer 1 or 0
    int val = atoi(buffer);
    *output = (val != 0);
}

static int splitArgsTopLevel(const char* argsStr, char argsArray[][20000], int maxArgs) {
    int count = 0;
    int depth = 0;
    int inQuotes = 0;
    int escape = 0;

    int start = 0;
    int i = 0;

    while (argsStr[i]) {
        char c = argsStr[i];

        if (escape) { escape = 0; i++; continue; }
        if (inQuotes && c == '\\\\') { escape = 1; i++; continue; }
        if (c == '"') { inQuotes = !inQuotes; i++; continue; }

        if (!inQuotes) {
            if (c == '[' || c == '{') depth++;
            else if (c == ']' || c == '}') depth--;
            else if (c == ',' && depth == 0) {
                int len = i - start;
                if (count < maxArgs) {
                    if (len > 19999) len = 19999;
                    strncpy(argsArray[count], argsStr + start, len);
                    argsArray[count][len] = '\\0';
                    trim_inplace(argsArray[count]);
                    count++;
                }
                start = i + 1;
            }
        }

        i++;
    }

    if (start < i && count < maxArgs) {
        int len = i - start;
        if (len > 19999) len = 19999;
        strncpy(argsArray[count], argsStr + start, len);
        argsArray[count][len] = '\\0';
        trim_inplace(argsArray[count]);
        count++;
    }

    return count;
}

static void print_json_string(const char* s) {
    putchar('"');
    for (const char* p = s; p && *p; p++) {
        if (*p == '\\\\' || *p == '"') { putchar('\\\\'); putchar(*p); }
        else if (*p == '\\n') { printf("\\\\n"); }
        else if (*p == '\\r') { printf("\\\\r"); }
        else if (*p == '\\t') { printf("\\\\t"); }
        else putchar(*p);
    }
    putchar('"');
}

// big static buffers
static char input[1024 * 1024];
static char argsArray[64][20000];
static char argsStr[1024 * 512];

int main() {
    // Read stdin
    size_t used = 0;
    while (fgets(input + used, (int)(sizeof(input) - used), stdin)) {
        used = strlen(input);
        if (used >= sizeof(input) - 1) break;
    }

    if (used == 0) {
        printf("{\\"results\\":[],\\"error\\":\\"Empty stdin\\"}\\n");
        return 0;
    }

    // Extract first tests[0].args array
    if (!extract_first_args_array(input, argsStr, (int)sizeof(argsStr))) {
        printf("{\\"results\\":[],\\"error\\":\\"Invalid JSON: missing tests[0].args\\"}\\n");
        return 0;
    }

    int argCount = splitArgsTopLevel(argsStr, argsArray, 64);

    if (argCount != ${arity}) {
        printf("{\\"results\\":[],\\"error\\":\\"Arity mismatch: expected ${arity} got %d\\"}\\n", argCount);
        return 0;
    }

    // Parse arguments based on signature
${argParsingCode}

    // Call user function (convert 'string' to 'char*' for C compatibility)
    ${returnType === 'boolean' ? 'bool' : (returnType === 'string' ? 'char*' : returnTypeRaw)} result = ${functionName}(${callArgs});

    // Print JSON output
    printf("{\\"results\\":[");
    ${printResultBlock}
    printf("]}\\n");

    // Cleanup heap allocations
${cleanupCode}

    return 0;
}
`;
}

/**
 * Generate C boilerplate code
 */
export function generateCBoilerplate(signature, className) {
    const functionName = signature.functionName;
    const params = signature.params || [];
    const returnType = signature.returnType || 'int';

    // Build parameter list with proper C types
    const paramList = params.map(p => {
        const type = p.type || 'int';
        const name = p.name;

        // Handle array types
        if (type === 'int[]' || type === 'int*') {
            return `int* ${name}, int ${name}Size`;
        } else if (type === 'string' || type === 'char*') {
            return `char* ${name}`;
        } else if (type === 'string[]' || type === 'char**' || type === 'char*[]') {
            return `char** ${name}, int ${name}Size`;
        } else if (type === 'bool' || type === 'boolean') {
            return `bool ${name}`;
        } else {
            return `${type} ${name}`;
        }
    }).join(', ');

    // Normalize return type: 'boolean' or 'bool' -> 'bool', 'string' -> 'char*'
    let returnTypeFinal = returnType;
    if (returnType === 'boolean' || returnType === 'bool') {
        returnTypeFinal = 'bool';
    } else if (returnType === 'string') {
        returnTypeFinal = 'char*';
    }

    return `// Function: ${functionName}
// Supported types: int, long, double, int*, char*, char**, bool
${returnTypeFinal} ${functionName}(${paramList}) {
    // Write your code here
    
}
`;
}
