/**
 * Build C++ harness
 */
export function buildCppHarness(userSource, signature) {
    const className = signature.className || 'Solution';
    const functionName = signature.functionName;
    const params = signature.params || [];

    // Generate argument parsing code based on parameter types
    let argParsingCode = '';
    let functionCallArgs = [];

    params.forEach((param, index) => {
        const paramType = param.type || 'int';
        const paramName = param.name || `arg${index}`;

        if (paramType === 'int' || paramType === 'long' || paramType === 'double') {
            argParsingCode += `        ${paramType} ${paramName} = parseNumber<${paramType}>(argsArray[${index}]);\n`;
            functionCallArgs.push(paramName);
        } else if (paramType === 'int[]' || paramType === 'vector<int>') {
            argParsingCode += `        vector<int> ${paramName} = parseIntArray(argsArray[${index}]);\n`;
            functionCallArgs.push(paramName);
        } else if (paramType === 'string' || paramType === 'String') {
            argParsingCode += `        string ${paramName} = parseString(argsArray[${index}]);\n`;
            functionCallArgs.push(paramName);
        } else if (paramType === 'string[]' || paramType === 'vector<string>') {
            argParsingCode += `        vector<string> ${paramName} = parseStringArray(argsArray[${index}]);\n`;
            functionCallArgs.push(paramName);
        } else if (paramType === 'bool' || paramType === 'boolean') {
            argParsingCode += `        bool ${paramName} = parseBool(argsArray[${index}]);\n`;
            functionCallArgs.push(paramName);
        } else {
            // Default to int for unknown types
            argParsingCode += `        int ${paramName} = parseNumber<int>(argsArray[${index}]);\n`;
            functionCallArgs.push(paramName);
        }
    });

    const functionCall = functionCallArgs.length > 0
        ? `solution.${functionName}(${functionCallArgs.join(', ')})`
        : `solution.${functionName}()`;

    return `#include <iostream>
#include <string>
#include <vector>
#include <sstream>
#include <algorithm>
using namespace std;

${userSource}

// ============================================================
// HARNESS (auto-generated, do not modify)
// ============================================================

// Helper: Trim whitespace
string trim(const string& str) {
    size_t start = str.find_first_not_of(" \\t\\n\\r");
    if (start == string::npos) return "";
    size_t end = str.find_last_not_of(" \\t\\n\\r");
    return str.substr(start, end - start + 1);
}

// Helper: Parse number from JSON string
template<typename T>
T parseNumber(const string& str) {
    string trimmed = trim(str);
    if (trimmed.empty() || trimmed == "null") return 0;
    
    // Remove quotes if present
    if (trimmed.front() == '"' && trimmed.back() == '"') {
        trimmed = trimmed.substr(1, trimmed.length() - 2);
    }
    
    istringstream iss(trimmed);
    T value;
    iss >> value;
    return value;
}

// Helper: Parse string from JSON
string parseString(const string& str) {
    string trimmed = trim(str);
    if (trimmed.empty() || trimmed == "null") return "";
    
    // Remove quotes
    if (trimmed.front() == '"' && trimmed.back() == '"') {
        return trimmed.substr(1, trimmed.length() - 2);
    }
    return trimmed;
}

// Helper: Parse boolean from JSON
bool parseBool(const string& str) {
    string trimmed = trim(str);
    if (trimmed == "true") return true;
    if (trimmed == "false") return false;
    // fallback for 1/0
    if (trimmed == "1") return true;
    return false;
}

// Helper: Parse int array from JSON string like "[1,2,3]"
vector<int> parseIntArray(const string& str) {
    vector<int> result;
    string trimmed = trim(str);
    
    if (trimmed.empty() || trimmed == "null") return result;
    
    // Find array brackets
    size_t start = trimmed.find('[');
    size_t end = trimmed.rfind(']');
    
    if (start == string::npos || end == string::npos) return result;
    
    string content = trimmed.substr(start + 1, end - start - 1);
    if (content.empty()) return result;
    
    // Parse comma-separated values
    stringstream ss(content);
    string token;
    while (getline(ss, token, ',')) {
        token = trim(token);
        if (!token.empty() && token != "null") {
            result.push_back(parseNumber<int>(token));
        }
    }
    
    return result;
}

// Helper: Parse string array from JSON
vector<string> parseStringArray(const string& str) {
    vector<string> result;
    string trimmed = trim(str);
    
    if (trimmed.empty() || trimmed == "null") return result;
    
    size_t start = trimmed.find('[');
    size_t end = trimmed.rfind(']');
    
    if (start == string::npos || end == string::npos) return result;
    
    string content = trimmed.substr(start + 1, end - start - 1);
    if (content.empty()) return result;
    
    stringstream ss(content);
    string token;
    while (getline(ss, token, ',')) {
        result.push_back(parseString(token));
    }
    
    return result;
}

// Helper: Split string by delimiter
vector<string> splitArgs(const string& argsStr) {
    vector<string> result;
    int depth = 0;
    string current;
    
    for (size_t i = 0; i < argsStr.length(); i++) {
        char c = argsStr[i];
        
        if (c == '[' || c == '{') {
            depth++;
            current += c;
        } else if (c == ']' || c == '}') {
            depth--;
            current += c;
        } else if (c == ',' && depth == 0) {
            result.push_back(trim(current));
            current.clear();
        } else {
            current += c;
        }
    }
    
    if (!current.empty()) {
        result.push_back(trim(current));
    }
    
    return result;
}

// Helper: Escape JSON strings
string escapeJson(const string& str) {
    string result;
    for (char c : str) {
        if (c == '"' || c == '\\\\') result += '\\\\';
        result += c;
    }
    return result;
}

// Helper: Convert to JSON
template<typename T>
string toJson(const T& value) {
    ostringstream oss;
    oss << value;
    return oss.str();
}


string toJson(const string& value) {
    return "\\"" + escapeJson(value) + "\\"";
}

string toJson(bool value) {
    return value ? "true" : "false";
}

template<typename T>
string toJson(const vector<T>& vec) {
    string result = "[";
    for (size_t i = 0; i < vec.size(); i++) {
        if (i > 0) result += ",";
        result += toJson(vec[i]);
    }
    result += "]";
    return result;
}

int main() {
    try {
        // Read all stdin
        string input;
        string line;
        while (getline(cin, line)) {
            input += line;
        }
        
        if (input.empty()) {
            cout << "{\\"results\\":[],\\"error\\":\\"Empty stdin\\"}" << endl;
            return 1;
        }
        
        // Parse JSON - extract args array
        // Expected format: {"functionName":"...", "tests":[{"args":[...]}]}
        size_t argsPos = input.find("\\"args\\":");
        if (argsPos == string::npos) {
            cout << "{\\"results\\":[],\\"error\\":\\"No args found in JSON\\"}" << endl;
            return 1;
        }
        
        // Find the args array
        size_t startBracket = input.find("[", argsPos);
        if (startBracket == string::npos) {
            cout << "{\\"results\\":[],\\"error\\":\\"Invalid args format\\"}" << endl;
            return 1;
        }
        
        // Find matching closing bracket
        int depth = 0;
        size_t endBracket = startBracket;
        for (size_t i = startBracket; i < input.length(); i++) {
            if (input[i] == '[') depth++;
            else if (input[i] == ']') {
                depth--;
                if (depth == 0) {
                    endBracket = i;
                    break;
                }
            }
        }
        
        string argsStr = input.substr(startBracket + 1, endBracket - startBracket - 1);
        vector<string> argsArray = splitArgs(argsStr);
        
        // Parse arguments based on signature
${argParsingCode}
        
        // Call user function
        ${className} solution;
        auto result = ${functionCall};
        
        // Output JSON result
        cout << "{\\"results\\":[" << toJson(result) << "]}" << endl;
        
    } catch (const exception& e) {
        cout << "{\\"results\\":[],\\"error\\":\\"" << escapeJson(e.what()) << "\\"}" << endl;
        return 1;
    }
    
    return 0;
}
`;
}

/**
 * Generate C++ boilerplate code
 */
export function generateCppBoilerplate(signature, className) {
    const functionName = signature.functionName;
    const params = signature.params || [];
    const returnType = signature.returnType || 'int';

    // Helper: Convert type to valid C++ syntax
    const convertToCppType = (type) => {
        if (type === 'int[]') return 'vector<int>';
        if (type === 'string[]' || type === 'String[]') return 'vector<string>';
        if (type === 'double[]') return 'vector<double>';
        if (type === 'long[]') return 'vector<long>';
        if (type === 'char[]') return 'vector<char>';
        if (type === 'String') return 'string';
        if (type === 'boolean' || type === 'bool') return 'bool';
        return type; // Return as-is for valid types like int, vector<int>, etc.
    };

    // Map parameter types to valid C++ syntax
    const paramList = params.map(p => {
        const type = convertToCppType(p.type || 'int');
        return `${type} ${p.name}`;
    }).join(', ');

    // Convert return type as well
    const cppReturnType = convertToCppType(returnType);

    return `class ${className} {
public:
    ${cppReturnType} ${functionName}(${paramList}) {
        // Write your code here
        
    }
};
`;
}
