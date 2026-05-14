/**
 * Build SQL harness
 */
export function buildSQLHarness(userSource, signature) {
    // SQL is special - usually just runs a query against a setup DB
    // For this template, we assume input creates tables and user query selects
    return `${userSource}
`;
}

/**
 * Generate SQL boilerplate code
 */
export function generateSQLBoilerplate(signature, className) {
    return `-- Write your SQL query here
SELECT * FROM table_name;
`;
}
