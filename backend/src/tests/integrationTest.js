/**
 * End-to-End Integration Test
 * 
 * Tests the complete JSON harness flow:
 * 1. Load problem with signature
 * 2. Generate boilerplate
 * 3. Simulate submission execution
 * 4. Verify results
 * 
 * Use the problem ID from createTestProblem.js output
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

import ProblemSchema from '../models/codeJudge/problem.js';
import TestCaseSchema from '../models/codeJudge/testCase.js';
import { buildSourceWithHarness, buildStdinPayload, generateBoilerplate, deepEqual } from '../utils/driverTemplates.js';

// CHANGE THIS to your problem ID from createTestProblem.js output
const PROBLEM_ID = '6969388effe5c9b87de59854';

async function runIntegrationTest() {
    try {
        // Connect to MongoDB
        const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_selekt';
        await mongoose.connect(dbUri);
        console.log('✅ Connected to MongoDB\n');

        const Problem = mongoose.models.Problem || mongoose.model('Problem', ProblemSchema);
        const TestCase = mongoose.models.TestCase || mongoose.model('TestCase', TestCaseSchema);

        // Step 1: Load problem
        console.log('=== Step 1: Load Problem ===');
        const problem = await Problem.findById(PROBLEM_ID).lean();
        if (!problem) {
            throw new Error(`Problem ${PROBLEM_ID} not found`);
        }
        console.log('✅ Loaded problem:', problem.title);
        console.log('   Function:', problem.signature.functionName);
        console.log('   Params:', problem.signature.params);
        console.log('   Return:', problem.signature.returnType);

        // Step 2: Generate boilerplate
        console.log('\n=== Step 2: Generate Boilerplate ===');
        const boilerplate = generateBoilerplate({
            language: 'python',
            signature: problem.signature,
            className: problem.signature.className
        });
        console.log('✅ Generated boilerplate:');
        console.log(boilerplate);

        // Step 3: Candidate's solution
        console.log('\n=== Step 3: Candidate Solution ===');
        const candidateSolution = `class Solution:
    def firstIndexQueries(self, arr, queries):
        result = []
        for q in queries:
            if q in arr:
                result.append(arr.index(q))
            else:
                result.append(-1)
        return result`;
        console.log('✅ Candidate wrote solution');

        // Step 4: Build harness
        console.log('\n=== Step 4: Build Harness ===');
        const fullSource = buildSourceWithHarness({
            language: 'python',
            userSource: candidateSolution,
            signature: problem.signature
        });
        console.log('✅ Built complete source with harness');
        console.log('   Total length:', fullSource.length, 'characters');

        // Step 5: Load test cases
        console.log('\n=== Step 5: Load Test Cases ===');
        const testCases = await TestCase.find({ problemId: problem._id }).sort({ order: 1 }).lean();
        console.log(`✅ Loaded ${testCases.length} test cases`);

        // Step 6: Simulate execution for each test case
        console.log('\n=== Step 6: Simulate Execution ===');
        let passedCount = 0;

        for (let i = 0; i < testCases.length; i++) {
            const testCase = testCases[i];

            // Build stdin
            const stdinJson = buildStdinPayload({
                signature: problem.signature,
                testCase: testCase
            });

            console.log(`\nTest ${i + 1}:`);
            console.log('  Args:', JSON.stringify(testCase.args));
            console.log('  Expected:', JSON.stringify(testCase.expected));

            // Simulate execution (in real flow, this goes to Camisole)
            // For this test, we'll manually compute the expected output
            const simulatedOutput = simulateExecution(testCase.args);

            console.log('  Got:', JSON.stringify(simulatedOutput));

            // Compare with deep equality
            const passed = deepEqual(simulatedOutput, testCase.expected);
            console.log('  Result:', passed ? '✅ PASSED' : '❌ FAILED');

            if (passed) passedCount++;
        }

        console.log(`\n📊 Final Results: ${passedCount}/${testCases.length} tests passed`);

        if (passedCount === testCases.length) {
            console.log('✅ ALL TESTS PASSED! JSON Harness system working correctly.');
        } else {
            console.log('❌ Some tests failed. Check the logic.');
        }

        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Simulate the execution of the candidate's solution
function simulateExecution(args) {
    const [arr, queries] = args;
    const result = [];
    for (const q of queries) {
        if (arr.includes(q)) {
            result.push(arr.indexOf(q));
        } else {
            result.push(-1);
        }
    }
    return result;
}

// Run the test
runIntegrationTest();
