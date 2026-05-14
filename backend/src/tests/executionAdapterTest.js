// Simple test for Execution Adapter Routes - No testing framework
import http from 'http';
import TestFormatter from './formatter.js';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });
const formatter = new TestFormatter();
const BASE_URL = 'http://localhost:8080';
const API_PREFIX = '/api/codejudge';

const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTE2Yjk4MDkwZDlkZjhlNmJiNDMxYzEiLCJjbGllbnQiOiI2OTE2Yjk4MDkwZDlkZjhlNmJiNDMxYzEiLCJkYk5hbWUiOiJBcHBseUN1cCIsImlhdCI6MTc2NjgyMDI3MiwiZXhwIjoxNzY2OTA2NjcyfQ.ufV3c-YGsa1I4IuMk05qqK-A2SSbh34m8Se1Ir5TpJU';
// Helper function to make HTTP requests
function makeRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${AUTH_TOKEN}`
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : null;
                    resolve({ statusCode: res.statusCode, data: parsed });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }

        req.end();
    });
}

// Use test IDs (you may need to create these first or use existing)
const TEST_SUBMISSION_ID = '694fedb5952c1eacbb834473'; // Replace with actual submission ID
const TEST_PROBLEM_ID = '694f9747f030f8cb37f78f84'; // Replace with actual problem ID
let judge0Token = null;
const DEFAULT_DB_NAME = process.env.DEFAULT_DB_NAME || 'ApplyCup';

// Test 1: POST /internal/execute - Execute Code with Test Cases
async function testExecuteCode() {
    formatter.testName('Test 1: Execute Code (POST /internal/execute)');

    const testData = {
        submissionId: TEST_SUBMISSION_ID,
        sourceCode: 'print("Hello World")', // Simple Python code
        languageId: 71, // Python (Camisole Mapped)
        problemId: TEST_PROBLEM_ID,
        dbName: DEFAULT_DB_NAME
    };

    try {
        const path = `${API_PREFIX}/internal/execute`;
        formatter.request('POST', path, testData);
        const { statusCode, data } = await makeRequest('POST', path, testData);
        formatter.response(statusCode, data);

        if (statusCode === 200 && data) {
            // New Camisole Adapter Response Structure
            if (data.status && typeof data.passedTestCases === 'number') {
                formatter.success(`Code execution completed synchronously: ${data.status} (${data.passedTestCases}/${data.totalTestCases})`);
            } else if (data.judge0Token) {
                // Keep backward compatibility check just in case
                judge0Token = data.judge0Token;
                formatter.success(`Code execution initiated with token: ${judge0Token}`);
            } else {
                formatter.error('Unexpected response format', new Error(JSON.stringify(data)));
            }
        } else {
            formatter.error('Failed to execute code', new Error(`Status: ${statusCode}`));
        }
    } catch (error) {
        formatter.error('Request failed', error);
    }
}

// Test 2: POST /internal/execute-single - Execute Single Test Case
async function testExecuteSingleTestCase() {
    formatter.testName('Test 2: Execute Single Test Case (POST /internal/execute-single)');

    const testData = {
        sourceCode: 'console.log("Hello, World!");',
        languageId: 63, // JavaScript (Node.js)
        stdin: '',
        expectedOutput: 'Hello, World!'
    };

    try {
        const path = `${API_PREFIX}/internal/execute-single`;
        formatter.request('POST', path, testData);
        const { statusCode, data } = await makeRequest('POST', path, testData);
        formatter.response(statusCode, data);

        if (statusCode === 200 && data) {
            formatter.success('Single test case executed successfully');
        } else {
            formatter.error('Failed to execute single test case', new Error(`Status: ${statusCode}`));
        }
    } catch (error) {
        formatter.error('Request failed', error);
    }
}

// Test 3: GET /internal/execution-status/:judge0Token - Get Execution Status
async function testGetExecutionStatus() {
    formatter.testName('Test 3: Get Execution Status (GET /internal/execution-status/:judge0Token)');

    if (!judge0Token) {
        // Use a dummy token for testing
        judge0Token = 'test-token-12345';
        console.log(`${formatter.constructor.name ? '' : ''}Note: Using dummy token for testing: ${judge0Token}`);
    }

    try {
        const path = `${API_PREFIX}/internal/execution-status/${judge0Token}?dbName=${DEFAULT_DB_NAME}`;
        formatter.request('GET', path);
        const { statusCode, data } = await makeRequest('GET', path);
        formatter.response(statusCode, data);

        if (statusCode === 200 && data) {
            formatter.success('Execution status retrieved successfully');
        } else {
            formatter.error('Failed to get execution status', new Error(`Status: ${statusCode}`));
        }
    } catch (error) {
        formatter.error('Request failed', error);
    }
}

// Run all tests
async function runTests() {
    formatter.header('Execution Adapter Routes Tests');

    console.log(`\nNote: These are INTERNAL routes for backend use only`);
    console.log(`Using test IDs:`);
    console.log(`  Submission ID: ${TEST_SUBMISSION_ID}`);
    console.log(`  Problem ID: ${TEST_PROBLEM_ID}`);
    console.log('Make sure these exist or update the IDs\n');

    await testExecuteCode();
    await testExecuteSingleTestCase();
    await testGetExecutionStatus();

    formatter.summary();
}

// Execute tests
runTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
});