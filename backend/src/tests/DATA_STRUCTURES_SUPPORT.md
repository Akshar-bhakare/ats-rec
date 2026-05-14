# Data Structures Supported by Driver Templates

## Overview

All driver templates support **multiple data structures** beyond just integers. Each language harness can parse and handle various types from JSON stdin.

---

## Supported Data Structures by Language

### Python ✅

**Supported Types:**
- **Primitives:** int, float, bool, str
- **Collections:** list, dict, tuple, set
- **Nested:** list[list[int]], dict[str, list]

**Why:** Python's dynamic typing and built-in JSON support handles all types automatically

**Example:**
```python
def twoSum(self, nums: list[int], target: int) -> list[int]:
    # nums is parsed as Python list
    # target is parsed as int
    # returns list of ints
```

---

### JavaScript / TypeScript ✅

**Supported Types:**
- **Primitives:** number, string, boolean
- **Collections:** Array, Object
- **Nested:** number[][], Map, Set

**Why:** JavaScript's JSON.parse() handles all JSON-compatible types

**Example:**
```javascript
reverseString(s: string): string {
    // s is parsed as string
    // returns string
}

findMax(nums: number[]): number {
    // nums is parsed as array
    // returns number
}
```

---

### Java ✅

**Supported Types:**
- **Primitives:** int, long, double, boolean
- **Objects:** String, Integer, Long
- **Collections:** List, int[], String[]

**Why:** Java harness uses reflection and type checking

**Example:**
```java
public int[] twoSum(int[] nums, int target) {
    // nums is parsed as int[]
    // target is parsed as int
    // returns int[]
}
```

---

### C++ ✅

**Supported Types:**
- **Primitives:** int, long, double
- **Strings:** string
- **Vectors:** vector<int>, vector<string>, vector<double>
- **Nested:** vector<vector<int>>

**Why:** C++ harness has helper functions for each type

**Parsing Functions:**
```cpp
parseNumber<T>()      // int, long, double
parseString()         // string
parseIntArray()       // vector<int>
parseStringArray()    // vector<string>
```

**Example:**
```cpp
int findMax(vector<int> nums) {
    // nums is parsed from JSON "[1,2,3]"
    // returns int
}

string reverseString(string s) {
    // s is parsed from JSON "\"hello\""
    // returns string
}
```

---

### C ✅ (Enhanced)

**Supported Types:**
- **Primitives:** int, long, double
- **Strings:** char*
- **Arrays:** int* (with size parameter)

**Why:** C harness has helper functions for parsing

**Parsing Functions:**
```c
parseIntArray()   // int* + size
parseString()     // char*
trim()            // whitespace removal
splitArgs()       // comma-separated values
```

**Example:**
```c
// Integer array with size
int findMax(int* nums, int numsSize) {
    // nums is parsed from JSON "[1,2,3]"
    // numsSize is automatically set to 3
    return nums[0];
}

// String parameter
int lengthOfString(char* s) {
    // s is parsed from JSON "\"hello\""
    return strlen(s);
}

// Multiple types
int twoSum(int* nums, int numsSize, int target) {
    // nums is int array
    // target is int
}
```

**Return Types:**
```c
int        // Single integer
double     // Single double
int*       // Array of integers (with printIntArray helper)
```

---

### Go ✅

**Supported Types:**
- **Primitives:** int, float64, bool, string
- **Slices:** []int, []string, []float64
- **Nested:** [][]int

**Why:** Go's encoding/json package handles all types

**Example:**
```go
func (s Solution) TwoSum(nums []int, target int) []int {
    // nums is parsed as []int
    // target is parsed as int
    // returns []int
}
```

---

### Kotlin ✅

**Supported Types:**
- **Primitives:** Int, Long, Double, Boolean, String
- **Collections:** List<Int>, Array<Int>, MutableList
- **Nested:** List<List<Int>>

**Why:** Kotlin's stdlib has JSON parsing capabilities

**Example:**
```kotlin
fun twoSum(nums: IntArray, target: Int): IntArray {
    // nums is parsed as IntArray
    // target is parsed as Int
    // returns IntArray
}
```

---

### Swift ✅
- **Primitives:** Int, Double, Bool, String
- **Collections:** [Int], [String], Dictionary
- **Nested:** [[Int]]

**Why:** Swift's Foundation JSONSerialization handles all types

**Example:**
```swift
func twoSum(_ nums: [Int], _ target: Int) -> [Int] {
    // nums is parsed as [Int]
    // target is parsed as Int
    // returns [Int]
}
```

---

### PHP ✅

**Supported Types:**
- **Primitives:** int, float, bool, string
- **Collections:** array (associative and indexed)
- **Nested:** Multidimensional arrays

**Why:** PHP's `json_decode()` handles all JSON types automatically

**Example:**
```php
public function twoSum($nums, $target) {
    // $nums is parsed as array
    // $target is parsed as int
    // returns array
}
```

---

### Ruby ✅

**Supported Types:**
- **Primitives:** Integer, Float, String, Boolean
- **Collections:** Array, Hash
- **Nested:** Nested arrays and hashes

**Why:** Ruby's `JSON.parse()` handles all JSON types

**Example:**
```ruby
def two_sum(nums, target)
    # nums is parsed as Array
    # target is parsed as Integer
    # returns Array
end
```

---

### Rust ✅

**Supported Types:**
- **Primitives:** i32, i64, f64, bool, String
- **Collections:** Vec<T>, HashMap
- **Nested:** Vec<Vec<T>>

**Why:** Rust's `serde_json` library provides powerful JSON parsing

**Example:**
```rust
fn two_sum(&self, nums: Vec<i32>, target: i32) -> Vec<i32> {
    // nums is parsed as Vec<i32>
    // target is parsed as i32
    // returns Vec<i32>
}
```

---

### Scala ✅

**Supported Types:**
- **Primitives:** Int, Long, Double, Boolean, String
- **Collections:** List, Array, Map
- **Nested:** List[List[Int]]

**Why:** Scala's JSON parsing libraries handle all types

**Example:**
```scala
def twoSum(nums: Array[Int], target: Int): Array[Int] = {
    // nums is parsed as Array[Int]
    // target is parsed as Int
    // returns Array[Int]
}
```

---

### Phase 3 Languages ✅

**R:**
- Primitives, Vectors, Lists, Data Frames
- Uses `jsonlite` or fallback parsing

**SQL:**
- Queries usually return result sets
- Harness handles DB setup and query execution

**Bash:**
- Strings (stdin/stdout)
- Uses `jq` or python one-liners for JSON parsing

**Elixir:**
- Atoms, Lists, Maps, Tuples
- Uses `Jason` library

**Haskell:**
- Strong typing with `Aeson`
- Primitives, Lists, Custom Data Types

**Lua:**
- Tables (arrays/objects)
- Uses `json` library

**Perl:**
- Scalars, Arrays, Hashes
- Uses `JSON` module

**Objective-C:**
- `NSNumber`, `NSString`, `NSArray`, `NSDictionary`
- Uses `NSJSONSerialization`

**Clojure:**
- Vectors, Maps, Keywords
- Uses `clojure.data.json`

---

## Comparison Table

| Language | Primitives | Arrays | Strings | Nested | Objects/Dicts |
|----------|-----------|--------|---------|--------|---------------|
| **Python** | ✅ All | ✅ list | ✅ str | ✅ Yes | ✅ dict |
| **JavaScript** | ✅ All | ✅ Array | ✅ string | ✅ Yes | ✅ Object |
| **TypeScript** | ✅ All | ✅ Array | ✅ string | ✅ Yes | ✅ Object |
| **Java** | ✅ int, long, double | ✅ int[], List | ✅ String | ⚠️ Limited | ⚠️ Limited |
| **C++** | ✅ int, long, double | ✅ vector<T> | ✅ string | ✅ vector<vector<T>> | ❌ No |
| **C** | ✅ int, long, double | ✅ int* + size | ✅ char* | ❌ No | ❌ No |
| **Go** | ✅ All | ✅ []T | ✅ string | ✅ Yes | ✅ map |
| **Kotlin** | ✅ All | ✅ Array, List | ✅ String | ✅ Yes | ⚠️ Limited |
| **Swift** | ✅ All | ✅ [T] | ✅ String | ✅ Yes | ✅ Dictionary |
| **PHP** | ✅ All | ✅ array | ✅ string | ✅ Yes | ✅ array (assoc) |
| **Ruby** | ✅ All | ✅ Array | ✅ String | ✅ Yes | ✅ Hash |
| **Rust** | ✅ i32, i64, f64 | ✅ Vec<T> | ✅ String | ✅ Vec<Vec<T>> | ✅ HashMap |
| **Scala** | ✅ All | ✅ Array, List | ✅ String | ✅ Yes | ✅ Map |
| **R** | ✅ All | ✅ Vector | ✅ String | ✅ Yes | ✅ List |
| **Bash** | ✅ String | ⚠️ array | ✅ String | ❌ No | ❌ No |
| **Haskell** | ✅ All | ✅ List | ✅ String | ✅ Yes | ✅ Record |

---

## How It Works

### JSON Input Format

All languages receive the same JSON format:

```json
{
  "functionName": "twoSum",
  "tests": [
    {
      "args": [[2, 7, 11, 15], 9]
    }
  ]
}
```

### Parsing Process

1. **Read stdin** → Get JSON string
2. **Parse JSON** → Extract `args` array
3. **Type conversion** → Convert JSON types to language types
4. **Call function** → Pass converted args
5. **Return result** → Convert back to JSON

### Example: Integer Array

**JSON:** `[2, 7, 11, 15]`

**Parsed as:**
- Python: `[2, 7, 11, 15]` (list)
- JavaScript: `[2, 7, 11, 15]` (Array)
- C++: `vector<int>{2, 7, 11, 15}`
- C: `int nums[] = {2, 7, 11, 15}; int numsSize = 4;`
- Go: `[]int{2, 7, 11, 15}`
- Kotlin: `intArrayOf(2, 7, 11, 15)`
- Swift: `[2, 7, 11, 15]` ([Int])

---

## C-Specific Details

### Why C is Different

C doesn't have:
- Dynamic arrays (need size parameter)
- Built-in strings (use char*)
- JSON libraries (manual parsing)
- Nested structures (complex to parse)

### C Array Handling

**Function Signature:**
```c
int findMax(int* nums, int numsSize)
```

**Why two parameters?**
- C arrays don't carry size information
- Need explicit size parameter
- Harness automatically provides both

**Boilerplate Generation:**
```c
// Input: { type: "int[]", name: "nums" }
// Output: int* nums, int numsSize
```

### C String Handling

**Function Signature:**
```c
int lengthOfString(char* s)
```

**Parsing:**
- Removes JSON quotes
- Null-terminates
- Passes as char*

---

## Adding New Types

### For Compiled Languages (C++, C)

1. **Add parsing function:**
```cpp
vector<double> parseDoubleArray(const string& str) {
    // Parse "[1.5, 2.3, 3.7]"
}
```

2. **Update harness builder:**
```javascript
else if (paramType === 'double[]') {
    argParsingCode += `vector<double> ${paramName} = parseDoubleArray(argsArray[${index}]);`;
}
```

3. **Update boilerplate:**
```javascript
if (type === 'double[]') return `vector<double> ${name}`;
```

### For Dynamic Languages (Python, JS)

**No changes needed!** JSON.parse() handles everything.

---

## Summary

✅ **All languages support multiple data structures**  
✅ **C now supports: int, int[], char*, double**  
✅ **C++ supports: int, vector<int>, string, vector<string>**  
✅ **Dynamic languages (Python, JS, Go) support all JSON types**  
✅ **Consistent JSON stdin/stdout across all languages**  

**Key Takeaway:** The harness templates are designed to handle real-world coding problems with arrays, strings, and complex data structures - not just simple integers!
