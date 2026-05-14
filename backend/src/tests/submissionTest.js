// Simple test for Submission Routes - No testing framework
import http from 'http';
import TestFormatter from './formatter.js';

const formatter = new TestFormatter();
const BASE_URL = 'http://localhost:8080';
const API_PREFIX = '/api/codejudge/submissions';

const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2OTE2Yjk4MDkwZDlkZjhlNmJiNDMxYzEiLCJjbGllbnQiOiI2OTE2Yjk4MDkwZDlkZjhlNmJiNDMxYzEiLCJkYk5hbWUiOiJBcHBseUN1cCIsImlhdCI6MTc2NzAwNDMwOCwiZXhwIjoxNzY3MDkwNzA4fQ.KmKVy_BJACvYPeh1-zz7JrLZ1yg9ZaWW1hTMR4LwxG4';
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
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

function makeRequest1(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {

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


const TEST_INTERVIEW_ID = '694f95442977e1c8e1805fdc';
const TEST_PROBLEM_ID = '694f9747f030f8cb37f78f84';
const TEST_CANDIDATE_ID = '69258c4978c4edca5a1abe3b';
let createdSubmissionId = null;

const testData1 = {
    problemId: TEST_PROBLEM_ID,
    candidateId: TEST_CANDIDATE_ID,
    languageId: '694feb34cf8a8bfadeb3dedf',
    sourceCode: `
const fs = require('fs');

function solve() {
    try {
        // 1. Read from stdin (fd 0)
        const input = fs.readFileSync(0, 'utf8').trim().split('\\n');
        if (input.length < 2) return;

        const nums = JSON.parse(input[0]);
        const target = parseInt(input[1]);

        // 2. User Logic
        const map = new Map();
        let result = [];
        for (let i = 0; i < nums.length; i++) {
            const complement = target - nums[i];
            if (map.has(complement)) {
                result = [map.get(complement), i];
                break;
            }
            map.set(nums[i], i);
        }

        // 3. Output to stdout
        process.stdout.write(JSON.stringify(result));
    } catch (err) {
        process.stderr.write(err.message);
        process.exit(1);
    }
}
solve();
`
};

const testData2 = {
    problemId: TEST_PROBLEM_ID,
    candidateId: TEST_CANDIDATE_ID,
    languageId: '694feb34cf8a8bfadeb3dedf',
    sourceCode: `
const fs = require('fs');
// Logic Error: Always returns [0, 1] regardless of actual math
const input = fs.readFileSync(0, 'utf8');
process.stdout.write(JSON.stringify([0, 1]));
`
};

const testData3 = {
    problemId: TEST_PROBLEM_ID,
    candidateId: TEST_CANDIDATE_ID,
    languageId: '694feb34cf8a8bfadeb3dedf',
    sourceCode: `
const fs = require('fs');
const input = fs.readFileSync(0, 'utf8');

// Runtime Error: Accessing property of undefined
let data; 
console.log(data.indices); 
`
};
// Test 1: POST /interviews/:interviewId/submissions - Create Submission
async function testCreateSubmission(testData) {
    formatter.testName('Test 1: Create Submission (POST /interviews/:interviewId/submissions)');

    
    try {
        const path = `${API_PREFIX}/interviews/${TEST_INTERVIEW_ID}/submissions`;
        formatter.request('POST', path, testData);
        const { statusCode, data } = await makeRequest('POST', path, testData);
        formatter.response(statusCode, data);

        if (statusCode === 201) {
            createdSubmissionId = data.submissionId;
            formatter.success(`Submission created successfully with ID: ${createdSubmissionId}`);
        } else {
            formatter.error('Failed to create submission', new Error(`Status: ${statusCode}`));
        }
    } catch (error) {
        formatter.error('Request failed', error);
    }
}

async function testSubmissionStatus(submissionId) {
    formatter.testName(`Test 2: Polling Submission Status`);
    
    const dbName = "ApplyCup"; ``
    const MAX_POLLS = 15;
    const DELAY = 2000; // 2 seconds
    
    for (let i = 0; i < MAX_POLLS; i++) {
        try {
            // Updated Path: /submissions/:submissionId/status
            // Method: GET (as per your Fastify code)
            const path = `${API_PREFIX}/submissions/${submissionId}/status?dbName=${dbName}`;
            
            const { statusCode, data } = await makeRequest('GET', path);
            
            if (statusCode !== 200) {
                formatter.error(`Fetch failed with status ${statusCode}`);
                return;
            }

            const status = data.status;
            const progress = data.judge0 ? `${data.judge0.completedTests}/${data.totalTestCases}` : '0/0';
            
            formatter.success(`Polling... Attempt ${i+1}: Status is "${status}" [Tests: ${progress}]`);

            // Check if execution is finished
            const isFinished = !['queued', 'running', 'sent_to_judge0'].includes(status);
            
            if (isFinished) {
                formatter.success(`Execution Finalized! Verdict: ${status.toUpperCase()}`);
                formatter.response(statusCode, data);
                return data;
            }

            // Wait before next poll
            await new Promise(resolve => setTimeout(resolve, DELAY));
            
        } catch (error) {
            formatter.error('Polling request failed', error);
            break;
        }
    }
    formatter.error('Test timed out: Submission did not reach a final state in time.');
}
// Test 2: GET /interviews/:interviewId/submissions - List Submissions
async function testListSubmissions() {
    formatter.testName('Test 2: List Submissions for Interview (GET /interviews/:interviewId/submissions)');

    try {
        const path = `${API_PREFIX}/interviews/${TEST_INTERVIEW_ID}/submissions`;
        formatter.request('GET', path);
        const { statusCode, data } = await makeRequest('GET', path);
        formatter.response(statusCode, data);

        if (statusCode === 200) {
            formatter.success(`Retrieved ${Array.isArray(data) ? data.length : 0} submissions`);
        } else {
            formatter.error('Failed to list submissions', new Error(`Status: ${statusCode}`));
        }
    } catch (error) {
        formatter.error('Request failed', error);
    }
}

// Test 3: GET /:submissionId - Get Submission Details
async function testGetSubmissionDetails() {
    formatter.testName('Test 3: Get Submission Details (GET /:submissionId)');

    if (!createdSubmissionId) {
        formatter.error('Skipping test - No submission ID available', new Error('Previous test failed'));
        return;
    }

    try {
        const path = `${API_PREFIX}/${createdSubmissionId}`;
        formatter.request('GET', path);
        const { statusCode, data } = await makeRequest('GET', path);
        formatter.response(statusCode, data);

        if (statusCode === 200 && data) {
            formatter.success('Submission details retrieved successfully');
        } else {
            formatter.error('Failed to get submission details', new Error(`Status: ${statusCode}`));
        }
    } catch (error) {
        formatter.error('Request failed', error);
    }
}


// Test 5: GET /interviews/:interviewId/leaderboard - Get Leaderboard
async function testGetLeaderboard() {
    formatter.testName('Test 5: Get Leaderboard (GET /interviews/:interviewId/leaderboard)');

    try {
        const path = `${API_PREFIX}/interviews/${TEST_INTERVIEW_ID}/leaderboard`;
        formatter.request('GET', path);
        const { statusCode, data } = await makeRequest('GET', path);
        formatter.response(statusCode, data);

        if (statusCode === 200) {
            formatter.success(`Retrieved leaderboard with ${Array.isArray(data) ? data.length : 0} entries`);
        } else {
            formatter.error('Failed to get leaderboard', new Error(`Status: ${statusCode}`));
        }
    } catch (error) {
        formatter.error('Request failed', error);
    }
}

// Run all tests
async function runTests() {
    formatter.header('Submission Routes Tests');

    console.log(`\nNote: Using test IDs:`);
    console.log(`  Interview ID: ${TEST_INTERVIEW_ID}`);
    console.log(`  Problem ID: ${TEST_PROBLEM_ID}`);
    console.log(`  Candidate ID: ${TEST_CANDIDATE_ID}`);
    console.log('Make sure these exist or update the IDs\n');

    await testCreateSubmission(testData1);
    if (createdSubmissionId) {
            await testSubmissionStatus(createdSubmissionId);
        }

        await sleep(5000);
        
    createdSubmissionId = null;
    await testCreateSubmission(testData2);

     if (createdSubmissionId) {
            await testSubmissionStatus(createdSubmissionId);
        }

    await sleep(5000);
    createdSubmissionId = null;
    await testCreateSubmission(testData3);
       if (createdSubmissionId) {
            await testSubmissionStatus(createdSubmissionId);
        }

    await sleep(5000);
    await testListSubmissions();
    await testGetSubmissionDetails();
    await testGetLeaderboard();

    formatter.summary();
}

// Execute tests
runTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
});


// Test 4: POST /:submissionId/rejudge - Rejudge Submission
// async function testRejudgeSubmission() {
//     formatter.testName('Test 4: Rejudge Submission (POST /:submissionId/rejudge)');

//     if (!createdSubmissionId) {
//         formatter.error('Skipping test - No submission ID available', new Error('Previous test failed'));
//         return;
//     }

//     try {
//         const path = `${API_PREFIX}/${createdSubmissionId}/rejudge`;
//         formatter.request('POST', path);
//         const { statusCode, data } = await makeRequest1('POST', path);
//         formatter.response(statusCode, data);

//         if (statusCode === 200) {
//             formatter.success('Submission rejudge initiated successfully');
//         } else {
//             formatter.error('Failed to rejudge submission', new Error(`Status: ${statusCode}`));
//         }
//     } catch (error) {
//         formatter.error('Request failed', error);
//     }
// }
