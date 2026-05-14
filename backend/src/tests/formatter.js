// Simple formatter for test results - no external dependencies

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[36m',
    gray: '\x1b[90m'
};

class TestFormatter {
    constructor() {
        this.results = [];
        this.startTime = Date.now();
    }

    // Format test header
    header(title) {
        console.log('\n' + '='.repeat(60));
        console.log(`${colors.bright}${colors.blue}${title}${colors.reset}`);
        console.log('='.repeat(60));
    }

    // Format test name
    testName(name) {
        console.log(`\n${colors.yellow}▶ ${name}${colors.reset}`);
    }

    // Format success message
    success(message) {
        console.log(`${colors.green}✓ ${message}${colors.reset}`);
        this.results.push({ status: 'PASS', message });
    }

    // Format error message
    error(message, error) {
        console.log(`${colors.red}✗ ${message}${colors.reset}`);
        if (error) {
            console.log(`${colors.gray}  Error: ${error.message || error}${colors.reset}`);
        }
        this.results.push({ status: 'FAIL', message, error: error?.message || error });
    }

    // Format JSON data
    json(data, indent = 2) {
        console.log(JSON.stringify(data, null, indent));
    }

    // Format GET response data in a readable way
    formatGetResponse(data) {
        if (!data) {
            console.log(`${colors.gray}No data returned${colors.reset}`);
            return;
        }

        if (Array.isArray(data)) {
            console.log(`${colors.bright}Results: ${data.length} items${colors.reset}`);
            if (data.length > 0) {
                // Show first few items
                const itemsToShow = Math.min(3, data.length);
                for (let i = 0; i < itemsToShow; i++) {
                    console.log(`\n${colors.blue}Item ${i + 1}:${colors.reset}`);
                    this.formatObject(data[i]);
                }
                if (data.length > itemsToShow) {
                    console.log(`${colors.gray}... and ${data.length - itemsToShow} more items${colors.reset}`);
                }
            }
        } else if (typeof data === 'object') {
            this.formatObject(data);
        } else {
            console.log(data);
        }
    }

    // Format object in key-value pairs
    formatObject(obj, indent = '  ') {
        for (const [key, value] of Object.entries(obj)) {
            if (value === null || value === undefined) {
                console.log(`${indent}${colors.gray}${key}: ${value}${colors.reset}`);
            } else if (typeof value === 'object' && !Array.isArray(value)) {
                console.log(`${indent}${colors.bright}${key}:${colors.reset}`);
                this.formatObject(value, indent + '  ');
            } else if (Array.isArray(value)) {
                console.log(`${indent}${colors.bright}${key}: ${colors.gray}[${value.length} items]${colors.reset}`);
            } else {
                console.log(`${indent}${key}: ${value}`);
            }
        }
    }

    // Format table for array data
    table(data, columns) {
        if (!Array.isArray(data) || data.length === 0) {
            console.log(`${colors.gray}No data to display${colors.reset}`);
            return;
        }

        // Auto-detect columns if not provided
        if (!columns) {
            columns = Object.keys(data[0]);
        }

        // Calculate column widths
        const widths = {};
        columns.forEach(col => {
            widths[col] = Math.max(
                col.length,
                ...data.map(row => String(row[col] || '').length)
            );
        });

        // Print header
        const header = columns.map(col => col.padEnd(widths[col])).join(' | ');
        console.log(`${colors.bright}${header}${colors.reset}`);
        console.log('-'.repeat(header.length));

        // Print rows
        data.forEach(row => {
            const rowStr = columns.map(col => String(row[col] || '').padEnd(widths[col])).join(' | ');
            console.log(rowStr);
        });
    }

    // Format request info
    request(method, url, body = null) {
        console.log(`${colors.gray}${method} ${url}${colors.reset}`);
        if (body) {
            console.log(`${colors.gray}Body: ${JSON.stringify(body)}${colors.reset}`);
        }
    }

    // Format response info
    response(statusCode, data = null) {
        const statusColor = statusCode >= 200 && statusCode < 300 ? colors.green : colors.red;
        console.log(`${statusColor}Status: ${statusCode}${colors.reset}`);
        if (data) {
            console.log(`${colors.gray}Response:${colors.reset}`);
            this.formatGetResponse(data);
        }
    }

    // Print summary
    summary() {
        const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
        const passed = this.results.filter(r => r.status === 'PASS').length;
        const failed = this.results.filter(r => r.status === 'FAIL').length;
        const total = this.results.length;

        console.log('\n' + '='.repeat(60));
        console.log(`${colors.bright}Test Summary${colors.reset}`);
        console.log('='.repeat(60));
        console.log(`Total Tests: ${total}`);
        console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
        console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
        console.log(`Duration: ${duration}s`);
        console.log('='.repeat(60) + '\n');
    }
}

export default TestFormatter;
