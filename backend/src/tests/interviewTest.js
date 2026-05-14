// Simple test for Interview Routes - No testing framework
import http from 'http';
import TestFormatter from './formatter.js';

const formatter = new TestFormatter();
const BASE_URL = 'http://localhost:8080';
const API_PREFIX = '/api/codejudge/interviews';

// Authentication token - Replace with your actual Firebase/JWT token
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

// Store created interview ID for subsequent tests
let createdInterviewId = null;

// Test 1: POST / - Create Interview
async function testCreateInterview() {
    formatter.testName('Test 1: Create Interview (POST /)');

    // Note: Replace candidateIds with actual CANDIDATE IDs (not User IDs) from your Candidate collection
    const testData = {
        title: 'Test Interview for Code Judge',
        candidateIds: ['69258c4978c4edca5a1abe3b'], // IMPORTANT: Use Candidate collection IDs
        recruiterId: '6916b98090d9df8e6bb431c1', // User ID (recruiter/admin)
        startTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        endTime: new Date(Date.now() + 172800000).toISOString() // Day after tomorrow
    };

    try {
        formatter.request('POST', API_PREFIX, testData);
        const { statusCode, data } = await makeRequest('POST', API_PREFIX, testData);
        formatter.response(statusCode, data);

        if (statusCode === 201 && data && data.interviewId) {
            createdInterviewId = data.interviewId;
            formatter.success(`Interview created successfully with ID: ${createdInterviewId}`);
        } else {
            formatter.error('Failed to create interview', new Error(`Status: ${statusCode}`));
        }
    } catch (error) {
        formatter.error('Request failed', error);
    }
}

// Test 2: POST /:interviewId/candidates - Add Candidate
async function testAddCandidate() {
    formatter.testName('Test 2: Add Candidate to Interview (POST /:interviewId/candidates)');

    if (!createdInterviewId) {
        formatter.error('Skipping test - No interview ID available', new Error('Previous test failed'));
        return;
    }

    const testData = {
        candidateIds: ['69258c5d78c4edca5a1ac01c'] // IMPORTANT: Use Candidate collection IDs
    };

    try {
        const path = `${API_PREFIX}/${createdInterviewId}/candidates`;
        formatter.request('POST', path, testData);
        const { statusCode, data } = await makeRequest('POST', path, testData);
        formatter.response(statusCode, data);

        if (statusCode === 200 || statusCode === 201) {
            formatter.success('Candidate added successfully');
        } else {
            formatter.error('Failed to add candidate', new Error(`Status: ${statusCode}`));
        }
    } catch (error) {
        formatter.error('Request failed', error);
    }
}

// Test 3: GET / - List Interviews
async function testListInterviews() {
    formatter.testName('Test 3: List All Interviews (GET /)');

    try {
        formatter.request('GET', API_PREFIX);
        const { statusCode, data } = await makeRequest('GET', API_PREFIX);
        formatter.response(statusCode, data);

        if (statusCode === 200) {
            const interviews = data?.interviews || data;
            formatter.success(`Retrieved ${Array.isArray(interviews) ? interviews.length : 0} interviews`);
        } else {
            formatter.error('Failed to list interviews', new Error(`Status: ${statusCode}`));
        }
    } catch (error) {
        formatter.error('Request failed', error);
    }
}

// Test 4: GET /:interviewId - Get Interview Details
async function testGetInterviewDetails() {
    formatter.testName('Test 4: Get Interview Details (GET /:interviewId)');

    if (!createdInterviewId) {
        formatter.error('Skipping test - No interview ID available', new Error('Previous test failed'));
        return;
    }

    try {
        const path = `${API_PREFIX}/${createdInterviewId}`;
        formatter.request('GET', path);
        const { statusCode, data } = await makeRequest('GET', path);
        formatter.response(statusCode, data);

        if (statusCode === 200 && data) {
            formatter.success('Interview details retrieved successfully');
        } else {
            formatter.error('Failed to get interview details', new Error(`Status: ${statusCode}`));
        }
    } catch (error) {
        formatter.error('Request failed', error);
    }
}

// Run all tests
async function runTests() {
    formatter.header('Interview Routes Tests');

    console.log('\n⚠️  CRITICAL: candidateIds must be IDs from the CANDIDATE collection, NOT User collection!');
    console.log('   Query your Candidate collection to get valid IDs before running this test.\n');

    await testCreateInterview();
    await testAddCandidate();
    await testListInterviews();
    await testGetInterviewDetails();

    formatter.summary();
}

// Execute tests
runTests().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
});
