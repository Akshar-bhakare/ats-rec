/**
 * Integration Test: Create a Real Problem with JSON Harness
 * 
 * This script creates a complete problem with signature and structured test cases
 * to test the JSON harness system end-to-end.
 * 
 * Run this after ensuring your MongoDB connection is active.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

// Import models
import ProblemSchema from '../models/codeJudge/problem.js';
import TestCaseSchema from '../models/codeJudge/testCase.js';

async function createTestProblem() {
    try {
        // Connect to MongoDB
        const dbUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_selekt';
        await mongoose.connect(dbUri);
        console.log('✅ Connected to MongoDB');

        // Register models
        const Problem = mongoose.models.Problem || mongoose.model('Problem', ProblemSchema);
        const TestCase = mongoose.models.TestCase || mongoose.model('TestCase', TestCaseSchema);

        // Create a test problem with signature
        const problem = await Problem.create({
            title: 'First Index Queries',
            description: `Given an array of strings \`arr\` and an array of query strings \`queries\`, return an array of indices where each index represents the first occurrence of the corresponding query string in \`arr\`. If a query string is not found, return -1 for that query.

**Example:**
- Input: arr = ["api", "db", "cache"], queries = ["api", "cache", "missing"]
- Output: [0, 2, -1]

**Constraints:**
- 1 <= arr.length <= 1000
- 1 <= queries.length <= 1000
- All strings contain only lowercase letters`,
            difficulty: 'easy',
            constraints: '1 <= arr.length <= 1000\n1 <= queries.length <= 1000',
            timeLimit: 2000,
            memoryLimit: 256000,
            allowedLanguages: [], // Add language IDs as needed
            createdBy: new mongoose.Types.ObjectId(), // Placeholder
            interviewId: new mongoose.Types.ObjectId(), // Placeholder
            isActive: true,

            // JSON Harness Signature
            signature: {
                className: 'Solution',
                functionName: 'firstIndexQueries',
                params: [
                    { name: 'arr', type: 'string[]' },
                    { name: 'queries', type: 'string[]' }
                ],
                returnType: 'int[]',
                classBased: true
            }
        });

        console.log('✅ Created problem:', problem._id);
        console.log('   Title:', problem.title);
        console.log('   Function:', problem.signature.functionName);

        // Create test cases with structured args/expected
        const testCases = [
            {
                problemId: problem._id,
                args: [['api', 'db', 'cache'], ['api', 'cache', 'missing']],
                expected: [0, 2, -1],
                isSample: true,
                order: 1
            },
            {
                problemId: problem._id,
                args: [['react', 'node', 'mongo'], ['node', 'react']],
                expected: [1, 0],
                isSample: true,
                order: 2
            },
            {
                problemId: problem._id,
                args: [['a', 'b', 'c', 'd'], ['x', 'y', 'z']],
                expected: [-1, -1, -1],
                isSample: false,
                order: 3
            },
            {
                problemId: problem._id,
                args: [['hello', 'world', 'hello'], ['hello', 'world']],
                expected: [0, 1],
                isSample: false,
                order: 4
            }
        ];

        const createdTestCases = await TestCase.insertMany(testCases);
        console.log(`✅ Created ${createdTestCases.length} test cases`);

        // Display test case details
        createdTestCases.forEach((tc, i) => {
            console.log(`   Test ${i + 1}:`, {
                args: tc.args,
                expected: tc.expected,
                isSample: tc.isSample
            });
        });

        console.log('\n📋 Problem Details:');
        console.log('   Problem ID:', problem._id.toString());
        console.log('   Test Case IDs:', createdTestCases.map(tc => tc._id.toString()));

        console.log('\n🎯 Next Steps:');
        console.log('   1. Use this problem ID in your frontend');
        console.log('   2. Generate boilerplate using /api/ai/generateCodingBoilerplate');
        console.log('   3. Submit a solution');
        console.log('   4. Verify execution with JSON harness');

        console.log('\n📝 Sample Solution (Python):');
        console.log(`class Solution:
    def firstIndexQueries(self, arr, queries):
        result = []
        for q in queries:
            if q in arr:
                result.append(arr.index(q))
            else:
                result.append(-1)
        return result`);

        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');

    } catch (error) {
        console.error('❌ Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run the script
createTestProblem();
