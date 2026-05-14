// Simple test for Test Case Routes - No testing framework
import http from 'http';
import TestFormatter from './formatter.js';

const formatter = new TestFormatter();
const BASE_URL = 'http://localhost:8080';
const API_PREFIX = '/api/codejudge/testcases';
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

// Use a test problem ID (you may need to create one first or use existing)
const TEST_PROBLEM_ID = '694f9747f030f8cb37f78f84'; // Replace with actual problem ID
let createdTestCaseId = null;

// Test 1: POST /problems/:problemId/testcases - Create Test Case
async function testCreateTestCase() {
    formatter.testName('Test 1: Create Test Case (POST /problems/:problemId/testcases)');

    // NOTE: Route expects testCases as an ARRAY (bulk create)
    const testData = {
        testCases: [{
            input: '2 7 11 15\n9',
            expectedOutput: '0 1',
            isSample: false,  // Changed from isHidden to isSample
            weight: 10
        }]
    };

    try {
        const path = `${API_PREFIX}/problems/${TEST_PROBLEM_ID}/testcases`;
        formatter.request('POST', path, testData);
        const { statusCode, data } = await makeRequest('POST', path, testData);
        formatter.response(statusCode, data);

        if (statusCode === 201 && data && data.testCases && data.testCases.length > 0) {
            createdTestCaseId = data.testCases[0]._id;
            formatter.success(`Test case created successfully with ID: ${createdTestCaseId}`);
        } else {
            formatter.error('Failed to create test case', new Error(`Status: ${statusCode}`));
        }
    } catch (error) {
        formatter.error('Request failed', error);
    }
}

// Test 2: GET /problems/:problemId/testcases - List Test Cases
async function testListTestCases() {
    formatter.testName('Test 2: List Test Cases for Problem (GET /problems/:problemId/testcases)');

    try {
        const path = `${API_PREFIX}/problems/${TEST_PROBLEM_ID}/testcases`;
        formatter.request('GET', path);
        const { statusCode, data } = await makeRequest('GET', path);
        formatter.response(statusCode, data);

        if (statusCode === 200) {
            const testCases = data?.testCases || data;
            formatter.success(`Retrieved ${Array.isArray(testCases) ? testCases.length : 0} test cases`);
        } else {
            formatter.error('Failed to list test cases', new Error(`Status: ${statusCode}`));
        }
    } catch (error) {
        formatter.error('Request failed', error);
    }
}

// Test 3: GET /:testCaseId - Get Test Case Details
async function testGetTestCaseDetails() {
    formatter.testName('Test 3: Get Test Case Details (GET /:testCaseId)');

    if (!createdTestCaseId) {
        formatter.error('Skipping test - No test case ID available', new Error('Previous test failed'));
        return;
    }

    try {
        const path = `${API_PREFIX}/${createdTestCaseId}`;
        formatter.request('GET', path);
        const { statusCode, data } = await makeRequest('GET', path);
        formatter.response(statusCode, data);

        if (statusCode === 200 && data) {
            formatter.success('Test case details retrieved successfully');
        } else {
            formatter.error('Failed to get test case details', new Error(`Status: ${statusCode}`));
        }
    } catch (error) {
        formatter.error('Request failed', error);
    }
}

// Test 4: POST /problems/:problemId/testcases/reorder - Reorder Test Cases
async function testReorderTestCases() {
    formatter.testName('Test 4: Reorder Test Cases (POST /problems/:problemId/testcases/reorder)');

    if (!createdTestCaseId) {
        formatter.error('Skipping test - No test case ID available', new Error('Previous test failed'));
        return;
    }

    // NOTE: Route expects testCaseOrder array with { testCaseId, order } objects
    const testData = {
        testCaseOrder: [
            { testCaseId: createdTestCaseId, order: 1 }
        ]
    };

    try {
        const path = `${API_PREFIX}/problems/${TEST_PROBLEM_ID}/testcases/reorder`;
        formatter.request('POST', path, testData);
        const { statusCode, data } = await makeRequest('POST', path, testData);
        formatter.response(statusCode, data);

        if (statusCode === 200) {
            formatter.success('Test cases reordered successfully');
        } else {
            formatter.error('Failed to reorder test cases', new Error(`Status: ${statusCode}`));
        }
    } catch (error) {
        formatter.error('Request failed', error);
    }
}

// Run all tests
async function runTests() {
    formatter.header('Test Case Routes Tests');

    console.log(`\nNote: Using test problem ID: ${TEST_PROBLEM_ID}`);
    console.log('Make sure this problem exists or update TEST_PROBLEM_ID\n');

    await testCreateTestCase();
    await testListTestCases();
    await testGetTestCaseDetails();
    await testReorderTestCases();

    formatter.summary();
}

// Execute tests
runTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
});
