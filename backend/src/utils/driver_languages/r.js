/**
 * Build R harness
 */
export function buildRHarness(userSource, signature) {
    const functionName = signature.functionName;
    return `${userSource}

# HARNESS
# Try to use jsonlite for robust parsing
if (!require("jsonlite", quietly = TRUE)) {
    cat('{"results":[], "error": "jsonlite library not found"}')
    quit(status=0)
}

# Read stdin
input_lines <- readLines("stdin", warn = FALSE)
input_str <- paste(input_lines, collapse = "\\n")

if (nchar(trimws(input_str)) == 0) {
    cat('{"results":[], "error": "Empty stdin"}')
    quit(status=0)
}

# Parse JSON
data <- tryCatch({
    fromJSON(input_str)
}, error = function(e) {
    NULL
})

if (is.null(data) || is.null(data$tests)) {
    cat('{"results":[], "error": "Invalid JSON input"}')
    quit(status=0)
}

results <- list()

for (test in data$tests) {
    args <- test$args
    
    # args is a list of arguments.
    # We need to call the function with these arguments.
    # do.call is the R way to call a function with a list of args.
    
    # Check if function exists
    if (!exists("${functionName}")) {
        results[[length(results) + 1]] <- paste0("Error: Function '${functionName}' not found")
        next
    }
    
    res <- tryCatch({
        do.call("${functionName}", args)
    }, error = function(e) {
        paste0("Runtime Error: ", e$message)
    })
    
    # Handle NULL returns or complex objects by ensuring basic JSON compatibility
    if (is.null(res)) {
        results[[length(results) + 1]] <- NA # maps to null in JSON
    } else {
        results[[length(results) + 1]] <- res
    }
}

# Output results
cat(toJSON(list(results = results), auto_unbox = TRUE))
`;
}

/**
 * Generate R boilerplate code
 */
export function generateRBoilerplate(signature, className) {
    const functionName = signature.functionName;
    const params = signature.params || [];
    const paramList = params.map(p => p.name).join(', ');
    
    return `# Define the function '${functionName}'
# Do NOT change the function name or assignment syntax
${functionName} <- function(${paramList}) {
    # Write your code here
    return(NULL)
}
`;
}
