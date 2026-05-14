// Simple test for Problem Routes - No testing framework
import http from 'http';
import TestFormatter from './formatter.js';

const formatter = new TestFormatter();
const BASE_URL = 'http://localhost:8080';
const API_PREFIX = '/api/codejudge/problems';

const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTE2Yjk4MDkwZDlkZjhlNmJiNDMxYzEiLCJjbGllbnQiOiI2OTE2Yjk4MDkwZDlkZjhlNmJiNDMxYzEiLCJkYk5hbWUiOiJBcHBseUN1cCIsImlhdCI6MTc2NjgyMDI3MiwiZXhwIjoxNzY2OTA2NjcyfQ.ufV3c-YGsa1I4IuMk05qqK-A2SSbh34m8Se1Ir5TpJU';

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

// Use a test interview ID (you may need to create one first or use existing)
const TEST_INTERVIEW_ID = '694f95442977e1c8e1805fdc'; // Replace with actual interview ID
let createdProblemId = '694f9747f030f8cb37f78f84';

// Test 1: POST /interviews/:interviewId/problems - Create Problem
async function testCreateProblem() {
    formatter.testName('Test 1: Create Problem (POST /interviews/:interviewId/problems)');

    const testData = {
        title: 'Two Sum Problem',
        description: 'Given an array of integers, return indices of two numbers that add up to a target.',
        difficulty: 'easy',
        timeLimit: 2000,
        memoryLimit: 256000,
        points: 100,
        tags: ['array', 'hash-table'],
        constraints: 'Array length: 2 <= n <= 10^4',
        inputFormat: 'First line: array of integers\nSecond line: target integer',
        outputFormat: 'Two space-separated indices',
        sampleInput: '2 7 11 15\n9',
        sampleOutput: '0 1'
    };

    try {
        const path = `${API_PREFIX}/interviews/${TEST_INTERVIEW_ID}/problems`;
        formatter.request('POST', path, testData);
        const { statusCode, data } = await makeRequest('POST', path, testData);
        formatter.response(statusCode, data);

        if (statusCode === 201 && data && data._id) {
            createdProblemId = data._id;
            formatter.success(`Problem created successfully with ID: ${createdProblemId}`);
        } else {
            formatter.error('Failed to create problem', new Error(`Status: ${statusCode}`));
        }
    } catch (error) {
        formatter.error('Request failed', error);
    }
}

// Test 2: GET /interviews/:interviewId/problems - List Problems
async function testListProblems() {
    formatter.testName('Test 2: List Problems for Interview (GET /interviews/:interviewId/problems)');

    try {
        const path = `${API_PREFIX}/interviews/${TEST_INTERVIEW_ID}/problems`;
        formatter.request('GET', path);
        const { statusCode, data } = await makeRequest('GET', path);
        formatter.response(statusCode, data);

        if (statusCode === 200) {
            formatter.success(`Retrieved ${Array.isArray(data) ? data.length : 0} problems`);
        } else {
            formatter.error('Failed to list problems', new Error(`Status: ${statusCode}`));
        }
    } catch (error) {
        formatter.error('Request failed', error);
    }
}

// Test 3: GET /:problemId - Get Problem Details
async function testGetProblemDetails() {
    formatter.testName('Test 3: Get Problem Details (GET /:problemId)');

    if (!createdProblemId) {
        formatter.error('Skipping test - No problem ID available', new Error('Previous test failed'));
        return;
    }

    try {
        const path = `${API_PREFIX}/${createdProblemId}`;
        formatter.request('GET', path);
        const { statusCode, data } = await makeRequest('GET', path);
        formatter.response(statusCode, data);

        if (statusCode === 200 && data) {
            formatter.success('Problem details retrieved successfully');
        } else {
            formatter.error('Failed to get problem details', new Error(`Status: ${statusCode}`));
        }
    } catch (error) {
        formatter.error('Request failed', error);
    }
}

// Run all tests
async function runTests() {
    formatter.header('Problem Routes Tests');

    console.log(`\n${formatter.constructor.name ? '' : ''}Note: Using test interview ID: ${TEST_INTERVIEW_ID}`);
    console.log('Make sure this interview exists or update TEST_INTERVIEW_ID\n');

    //await testCreateProblem();
    await testListProblems();
    await testGetProblemDetails();

    formatter.summary();
}

// Execute tests
runTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
});
