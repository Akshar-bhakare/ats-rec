import mongoose from 'mongoose';
import axios from 'axios';
import { buildStdinPayload } from '../../utils/driverTemplates.js';
/**
 * Execution Adapter Routes
 * 
 * This is the abstraction layer between the main backend and Judge0 CE (self-hosted).
 * It handles:
 * - Fetching test cases from DB
 * - Building Judge0 payloads with JSON harness
 * - Sending code for execution to Judge0 CE
 * - Parsing Judge0 responses and updating submission status
 * 
 * CRITICAL: This is an INTERNAL route, not exposed to frontend.
 * Only the backend submission flow should call this.
 * 
 * NOTE: Uses Judge0 CE (self-hosted), NOT RapidAPI.
 */
function normalizeJudge0Status(statusId) {
    switch (statusId) {
        case 3: return 'accepted';
        case 4: return 'wrong_answer';
        case 5: return 'time_limit_exceeded';
        case 6: return 'compilation_error';
        case 7: return 'runtime_error';
        case 8: return 'memory_limit_exceeded';
        default: return 'runtime_error';
    }
}

// Helper functions for Base64
const toBase64 = (str) => Buffer.from(str || '', 'utf8').toString('base64');
const fromBase64 = (str) => Buffer.from(str || '', 'base64').toString('utf8');

export default async function executionAdapterRoutes(fastify) {
    // Judge0 CE configuration from environment
    const judge0Url = process.env.JUDGE0_URL || 'http://localhost:2358';
    const judge0PollInterval = parseInt(process.env.JUDGE0_POLL_INTERVAL || '500', 10); // ms
    const judge0MaxPollTime = parseInt(process.env.JUDGE0_MAX_POLL_TIME || '30000', 10); // ms (increased for C++ compilation)

    /**
     * Helper: Poll Judge0 for submission result
     * Polls Judge0 API until execution completes or timeout occurs
     * 
     * @param {string} token - Judge0 submission token
     * @param {number} maxWaitMs - Maximum wait time in milliseconds
     * @returns {Promise<object>} Judge0 result object
     * @throws {Error} If polling times out
     */
    async function pollJudge0Result(token, maxWaitMs = 10000) {
        const pollInterval = judge0PollInterval;
        const maxPolls = Math.floor(maxWaitMs / pollInterval);

        for (let i = 0; i < maxPolls; i++) {
            // Wait before polling
            await new Promise(resolve => setTimeout(resolve, pollInterval));

            try {
                const response = await axios.get(
                    `${judge0Url}/submissions/${token}?base64_encoded=true`
                );

                const result = response.data;
                
                // Decode base64 fields
                if (result.stdout) result.stdout = fromBase64(result.stdout);
                if (result.stderr) result.stderr = fromBase64(result.stderr);
                if (result.compile_output) result.compile_output = fromBase64(result.compile_output);
                if (result.message) result.message = fromBase64(result.message);

                // Judge0 Status IDs:
                // 1 = In Queue
                // 2 = Processing
                // 3+ = Finished (Accepted, Wrong Answer, Error, etc.)
                if (result.status.id > 2) {
                    console.log(`[POLL] Token ${token} completed with status: ${result.status.description}`);
                    return result;
                }

                // Still processing, continue polling
                if (i % 4 === 0) { // Log every 2 seconds to reduce noise
                    console.log(`[POLL] Token ${token} status: ${result.status.description}, poll ${i + 1}/${maxPolls} (${Math.floor((i + 1) * pollInterval / 1000)}s elapsed)`);
                }

            } catch (error) {
                console.error(`[POLL] Error polling token ${token}:`, error.message);
                // Continue polling on transient errors
            }
        }

        // Timeout reached
        throw new Error(`Judge0 polling timeout after ${maxWaitMs}ms`);
    }

    /**
     * Helper: Validate Judge0 language ID
     * Returns the language ID if valid, throws error otherwise
     */
    async function validateLanguageId(id) {
        const { SUPPORTED_LANGUAGES } = await import('../../utils/supportedLanguages.js');
        if (!SUPPORTED_LANGUAGES[id]) {
            throw new Error(`Unsupported language ID: ${id}. Supported: ${Object.keys(SUPPORTED_LANGUAGES).join(', ')}`);
        }
        return id; // Return the ID itself for Judge0
    }


    /**
     * POST /internal/execute
     * Execute code submission via Judge0 CE (Self-Hosted)
     * Auth: Internal only (no authentication - called by backend)
     */
    fastify.post('/internal/execute', async (req, reply) => {
        try {
            const { submissionId, sourceCode, languageId, problemId, dbName } = req.body;

            // Validation: Required fields
            if (!submissionId || !sourceCode || !languageId || !problemId || !dbName) {
                return reply.code(400).send({
                    error: 'Bad Request',
                    message: 'submissionId, sourceCode, languageId, problemId, and dbName are required'
                });
            }

            console.log(`🔧 [EXECUTION ADAPTER] Processing submission: ${submissionId}`);

            // Get database connection for this request
            const { getClientDbConn } = await import('../../utils/clientDbUtils.js');
            const conn = await getClientDbConn(dbName);

            // ============ STEP 1: FETCH TEST CASES ============
            const testCases = await conn.models['TestCase']
                .find({ problemId: new mongoose.Types.ObjectId(problemId) })
                .sort({ order: 1 })
                .lean();

            if (!testCases || testCases.length === 0) {
                console.warn(`⚠️ [EXECUTION ADAPTER] No test cases found for problem: ${problemId}`);
                await conn.models['Submission'].findByIdAndUpdate(submissionId, {
                    status: 'runtime_error',
                    stderr: 'No test cases available for this problem',
                    webhookReceived: true // Auto-complete
                });
                return reply.code(400).send({
                    error: 'Bad Request',
                    message: 'No test cases found for this problem'
                });
            }

            console.log(`📋 [EXECUTION ADAPTER] Found ${testCases.length} test cases`);

            // Load problem to get signature for JSON harness
            const problem = await conn.models['Problem']
                .findById(problemId)
                .lean();

            if (!problem) {
                console.warn(`⚠️ [EXECUTION ADAPTER] Problem not found: ${problemId}`);
                await conn.models['Submission'].findByIdAndUpdate(submissionId, {
                    status: 'runtime_error',
                    stderr: 'Problem not found',
                    webhookReceived: true
                });
                return reply.code(400).send({
                    error: 'Bad Request',
                    message: 'Problem not found'
                });
            }

            // ============ STEP 2: VALIDATE LANGUAGE ============
            let judge0LanguageId;
            try {
                console.log("[EXECUTION ADAPTER] Validating language ID:", { languageId, type: typeof languageId });
                judge0LanguageId = await validateLanguageId(languageId);
            } catch (e) {
                console.error(`❌ [EXECUTION ADAPTER] Language validation error: ${e.message}`);
                await conn.models['Submission'].findByIdAndUpdate(submissionId, {
                    status: 'runtime_error',
                    stderr: e.message,
                    webhookReceived: true
                });
                return reply.code(400).send({ message: e.message });
            }

            // ============ STEP 3: EXECUTE & JUDGE (LOOP) ============
            let passedCount = 0;
            let totalExecutionTime = 0;
            let maxMemoryDetails = 0;
            let firstError = null;
            let finalStatus = 'accepted';

            // Helper to clean output
            const normalize = (str) => (str || '').trim().replace(/\r\n/g, '\n');

            // Update status to running
            await conn.models['Submission'].findByIdAndUpdate(submissionId, {
                status: 'running'
            });

            for (const testCase of testCases) {
                // Build source code with JSON harness wrapper
                const { buildSourceWithHarness } = await import('../../utils/driverTemplates.js');
                const finalSource = buildSourceWithHarness({
                    language: { judge0Id: languageId },
                    userSource: sourceCode,
                    signature: problem.signature
                });

                console.log('[EXECUTION DEBUG] Built harness, source length:', finalSource.length);

                // Build JSON stdin for this specific test case
                const stdinJson = buildStdinPayload({
                    signature: problem.signature,
                    testCase: testCase
                });

                // Prepare Judge0 CE payload
                // Judge0 expects: language_id, source_code, stdin (base64 or plain text)
                const payload = {
                    language_id: judge0LanguageId,
                    source_code: toBase64(finalSource),
                    stdin: toBase64(stdinJson),
                    cpu_time_limit: 2,      // 2 seconds
                    memory_limit: 128000,   // 128 MB in KB
                    enable_network: false   // Security: disable network access
                };

                try {
                    // ============ ASYNC SUBMISSION TO JUDGE0 ============
                    // Submit to Judge0 CE (async mode - no wait parameter)
                    // This returns immediately with a token for polling
                    const response = await axios.post(
                        `${judge0Url}/submissions?base64_encoded=true`, // No wait=true
                        payload
                    );

                    const token = response.data.token;
                    console.log(`[EXECUTION DEBUG] Submitted to Judge0, token: ${token}`);

                    // Store token in database for tracking
                    await conn.models['Submission'].findByIdAndUpdate(submissionId, {
                        $push: { 'judge0.batchTokens': token }
                    });

                    // ============ POLL FOR RESULT ============
                    // Poll Judge0 until execution completes or timeout
                    let result;
                    try {
                        result = await pollJudge0Result(token, judge0MaxPollTime);
                    } catch (pollError) {
                        // Polling timeout - mark as runtime error
                        console.error(`❌ [EXECUTION ADAPTER] Polling timeout for token ${token}`);
                        finalStatus = 'runtime_error';
                        firstError = {
                            stderr: 'Execution timeout - code took too long to execute',
                            stdout: ''
                        };
                        break; // Stop processing remaining test cases
                    }

                    console.log('[EXECUTION DEBUG] Judge0 response status:', result.status?.description);

                    // 1. Check Compilation Error
                    // Judge0 status.id = 6 means compilation error
                    if (result.status?.id === 6) {
                        finalStatus = 'compilation_error';
                        firstError = {
                            stderr: result.compile_output || result.stderr || 'Compilation failed',
                            stdout: result.stdout || ''
                        };
                        break; // Stop on compilation error
                    }

                    // 2. Check Runtime Errors
                    // Judge0 status.id: 3=Accepted, 4=Wrong Answer, 5=TLE, 7-12=Runtime Errors, 13=Internal Error
                    const statusId = result.status?.id;

                    // Declare variables for test result tracking
                    let actualResult = null;
                    let testPassed = false;

                    // Runtime error statuses: 7-12 (various runtime errors), 13 (internal error)
                    if (statusId >= 7 && statusId <= 13) {
                        finalStatus = 'runtime_error';
                        firstError = {
                            stderr: result.stderr || result.message || 'Runtime Error',
                            stdout: result.stdout || ''
                        };
                        // Continue to next test case (don't break)
                    } else if (statusId === 5) {
                        // Time Limit Exceeded
                        finalStatus = 'time_limit_exceeded';
                        firstError = {
                            stderr: 'Time Limit Exceeded',
                            stdout: result.stdout || ''
                        };
                    } else if (statusId === 3 || statusId === 4) {
                        // Status 3 = Accepted, 4 = Wrong Answer
                        // We need to parse the JSON harness output to determine actual correctness

                        // 3. Parse JSON Harness Output
                        // The harness outputs JSON with results array
                        console.log('[EXECUTION DEBUG] Raw stdout:', result.stdout);

                        try {
                            // Extract JSON from stdout (handle print statements)
                            // The harness always outputs JSON at the end, so we look for the last valid JSON object
                            let jsonStr = (result.stdout || '').trim();

                            // Find JSON that starts with {"results": on its own line
                            // This is more specific than just looking for any { to avoid matching user print statements
                            // Match pattern: newline or start of string, followed by {"results":..., followed by end
                            const jsonMatch = jsonStr.match(/(?:^|\n)(\{"results":\s*\[[\s\S]*?\]\s*(?:,\s*"error":\s*"[^"]*")?\})$/);
                            if (jsonMatch) {
                                jsonStr = jsonMatch[1]; // Extract the captured group (the JSON object)
                            }

                            const harnessOutput = JSON.parse(jsonStr);

                            if (harnessOutput.error) {
                                // Harness reported an error
                                finalStatus = 'runtime_error';
                                firstError = {
                                    stderr: harnessOutput.error,
                                    stdout: result.stdout || ''
                                };
                            } else if (harnessOutput.results && harnessOutput.results.length > 0) {
                                // Get the actual result from harness
                                actualResult = harnessOutput.results[0]; // Assign to outer scope variable
                                const expectedResult = testCase.expected;

                                // Deep equality comparison
                                const { deepEqual } = await import('../../utils/driverTemplates.js');
                                if (deepEqual(actualResult, expectedResult)) {
                                    passedCount++;
                                    testPassed = true; // Mark this test as passed
                                } else {
                                    if (finalStatus === 'accepted') {
                                        finalStatus = 'wrong_answer';
                                        if (!firstError) {
                                            firstError = {
                                                stdout: `Expected: ${JSON.stringify(expectedResult)}, Got: ${JSON.stringify(actualResult)}`,
                                                stderr: '',
                                                expected: expectedResult,
                                                actual: actualResult
                                            };
                                        }
                                    }
                                }
                            } else {
                                // No results in harness output
                                finalStatus = 'runtime_error';
                                firstError = {
                                    stderr: 'No results from harness',
                                    stdout: result.stdout || ''
                                };
                            }
                        } catch (parseError) {
                            // Failed to parse JSON - treat as runtime error
                            finalStatus = 'runtime_error';
                            firstError = {
                                stderr: `Failed to parse harness output: ${parseError.message}`,
                                stdout: result.stdout || ''
                            };
                        }
                    } else {
                        // Unexpected status from Judge0
                        finalStatus = 'runtime_error';
                        firstError = {
                            stderr: `Unexpected Judge0 status: ${result.status?.description || 'Unknown'}`,
                            stdout: result.stdout || ''
                        };
                    }

                    // Metrics from Judge0
                    // Judge0: time in seconds (string), memory in KB (integer)
                    const runTime = result.time ? parseFloat(result.time) * 1000 : 0; // Convert to ms
                    const runMem = result.memory || 0; // Already in KB

                    totalExecutionTime = Math.max(totalExecutionTime, runTime);
                    maxMemoryDetails = Math.max(maxMemoryDetails, runMem);

                    // Determine per-test status based on JSON harness comparison
                    let caseStatus = 'passed';
                    if (statusId >= 7 && statusId <= 13) {
                        caseStatus = 'runtime_error';
                    } else if (statusId === 5) {
                        caseStatus = 'time_limit_exceeded';
                    } else if (!testPassed) {
                        caseStatus = 'failed';
                    }

                    // Create detailed result record
                    if (conn.models['SubmissionResult']) {
                        await conn.models['SubmissionResult'].create({
                            submissionId,
                            testCaseId: testCase._id,
                            status: caseStatus,
                            executionTime: runTime,
                            memoryUsed: runMem,
                            output: actualResult !== null && actualResult !== undefined
                                ? (typeof actualResult === 'object' ? JSON.stringify(actualResult) : String(actualResult))
                                : (result.stdout || result.stderr || '') // Fallback to raw output if parsing failed
                        });
                    }

                } catch (netError) {
                    console.error('❌ [EXECUTION ADAPTER] Judge0 CE connection failed:', netError.message);
                    // Critical failure of the execution engine
                    await conn.models['Submission'].findByIdAndUpdate(submissionId, {
                        status: 'runtime_error',
                        stderr: 'Internal Execution Error: Judge0 CE unreachable',
                        webhookReceived: true
                    });
                    return reply.code(500).send({
                        error: 'Internal Server Error',
                        message: 'Judge0 CE execution engine unavailable'
                    });
                }
            }

            // ============ STEP 4: UPDATE SUBMISSION ============
            const updateData = {
                status: finalStatus,
                passedTestCases: passedCount,
                totalTestCases: testCases.length,
                executionTime: totalExecutionTime,
                memoryUsed: maxMemoryDetails,
                webhookReceived: true // Completed locally
            };

            if (firstError) {
                updateData.stderr = firstError.stderr;
                updateData.stdout = firstError.stdout; // Optional: show stdout of failed test
            }

            await conn.models['Submission'].findByIdAndUpdate(submissionId, updateData);

            console.log(`✅ [EXECUTION ADAPTER] Completed ${submissionId}: ${finalStatus} (${passedCount}/${testCases.length})`);

            return reply.code(200).send({
                success: true,
                submissionId,
                status: finalStatus,
                passedTestCases: passedCount,
                totalTestCases: testCases.length
            });

        } catch (error) {
            console.error('❌ [EXECUTION ADAPTER] Error:', error);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: error.message || 'Failed to execute code'
            });
        }
    });

    /**
     * POST /internal/judge0/webhook
     * Webhook callback for execution results
     * Auth: Internal only
     * **/
    fastify.post('/internal/judge0/webhook', async (req, reply) => {
        try {
            const result = req.body;
            // Expecting submissionId in the payload or query
            const submissionId = result.submissionId || req.query.submissionId || result.token; // Fallback to token as ID if configured that way
            const { status, time, memory, stdout, stderr, compile_output, passedTestCases, totalTestCases } = result;

            if (!submissionId) {
                return reply.code(400).send({ message: 'submissionId is required' });
            }

            const { getClientDbConn } = await import('../../utils/clientDbUtils.js');
            const conn = await getClientDbConn(result.dbName || req.query.dbName);

            // Find submission directly by ID
            const submission = await conn.models.Submission.findById(submissionId);

            if (!submission) {
                return reply.code(404).send({ message: 'Submission not found' });
            }

            // Update status mapping
            // If the status is coming from Judge0 standard (ID based)
            if (status && status.id) {
                if (status.id !== 3) { // 3 = Accepted
                    submission.status = normalizeJudge0Status(status.id);
                } else {
                    submission.status = 'accepted';
                }
            } else if (typeof status === 'string') {
                // Direct string status (e.g. from custom executor)
                submission.status = status;
            }

            // Update metrics
            if (time) submission.executionTime = parseFloat(time) * 1000; // to ms
            if (memory) submission.memoryUsed = parseFloat(memory); // KB

            // Update Outputs
            if (stdout) submission.stdout = fromBase64(stdout);
            if (stderr) submission.stderr = fromBase64(stderr);
            if (compile_output) submission.compilerOutput = fromBase64(compile_output);

            // Update Test Case Counts if provided
            if (passedTestCases !== undefined) submission.passedTestCases = passedTestCases;
            if (totalTestCases !== undefined) submission.totalTestCases = totalTestCases;

            // Mark as webhook received
            submission.webhookReceived = true;

            // If passed all, ensure accepted
            if (submission.passedTestCases === submission.totalTestCases && submission.totalTestCases > 0) {
                submission.status = 'accepted';
            }

            await submission.save();

            return reply.code(200).send({ success: true });

        } catch (err) {
            console.error('❌ Judge0 webhook error:', err);
            return reply.code(500).send({ error: 'Webhook processing failed' });
        }
    });
}
    
/**
 * PRODUCTION JUDGE0 INTEGRATION NOTES:
 
 * 6. Security:
 *    - Add IP whitelist for /internal/* routes
 *    - Or use internal API key validation
 *    - Never expose these routes to frontend
 */