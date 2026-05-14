import mongoose from 'mongoose';

export default async function testCaseRoutes(fastify) {
    // Apply authentication to all routes
    fastify.addHook('preHandler', fastify.authenticate);

    /**
     * POST /problems/:problemId/testcases
     * Add test cases to a problem (bulk create)
     * Auth: Admin/Problem creator
     */
    fastify.post('/problems/:problemId/testcases', async (req, reply) => {
        try {
            // Authorization check
            if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
                return reply.code(403).send({
                    error: 'Forbidden',
                    message: 'Only admins and recruiters can create test cases'
                });
            }

            const { problemId } = req.params;
            const { testCases } = req.body;

            // Validation: testCases array
            if (!testCases || !Array.isArray(testCases) || testCases.length === 0) {
                return reply.code(400).send({
                    error: 'Bad Request',
                    message: 'testCases is required and must be a non-empty array'
                });
            }

            // Find problem
            const problem = await req.conn.models['Problem'].findById(problemId);
            if (!problem) {
                return reply.code(404).send({
                    error: 'Not Found',
                    message: 'Problem not found'
                });
            }

            // Authorization: Check if user is the problem creator or admin
            if (
                req.user.role !== 'ultra_admin' &&
                req.user.role !== 'client_admin' &&
                problem.createdBy.toString() !== req.user.sub
            ) {
                return reply.code(403).send({
                    error: 'Forbidden',
                    message: 'You are not authorized to add test cases to this problem'
                });
            }

            // Validate each test case (JSON HARNESS FORMAT ONLY - legacy commented out)
            console.log(`\n[TEST CASES] Validating ${testCases.length} test cases for problem ${problemId}`);
            console.log('[TEST CASES] Test cases received:', JSON.stringify(testCases, null, 2));

            const validatedTestCases = [];
            for (let i = 0; i < testCases.length; i++) {
                const tc = testCases[i];
                console.log(`[TEST CASES] Validating test case ${i + 1}:`, JSON.stringify(tc, null, 2));

                // Check if it's JSON harness format (args + expected)
                const isJsonHarness = tc.args !== undefined && tc.expected !== undefined;
                // LEGACY FORMAT DISABLED - uncomment below to re-enable
                // const isLegacy = tc.input !== undefined && (tc.expectedOutput !== undefined || tc.output !== undefined);

                if (!isJsonHarness) {
                    console.error(`[TEST CASES] Test case ${i + 1} FAILED validation - missing args or expected`);
                    console.error(`[TEST CASES] Has args: ${tc.args !== undefined}, Has expected: ${tc.expected !== undefined}`);
                    return reply.code(400).send({
                        error: 'Bad Request',
                        message: `Test case ${i + 1}: must have args and expected fields (JSON harness format only)`
                    });
                }

                // Build validated test case
                const validatedTC = {
                    problemId: new mongoose.Types.ObjectId(problemId),
                    isSample: tc.isSample !== undefined ? tc.isSample : false,
                    weight: tc.weight !== undefined ? tc.weight : 1,
                    order: tc.order !== undefined ? tc.order : i + 1
                };

                // Add JSON harness fields
                validatedTC.args = tc.args;
                validatedTC.expected = tc.expected;

                /* LEGACY FORMAT VALIDATION - COMMENTED OUT
                } else {
                    // Legacy format
                    if (typeof tc.input !== 'string') {
                        return reply.code(400).send({
                            error: 'Bad Request',
                            message: `Test case ${i + 1}: input must be a string`
                        });
                    }
                    const expectedOutput = tc.expectedOutput || tc.output;
                    if (typeof expectedOutput !== 'string') {
                        return reply.code(400).send({
                            error: 'Bad Request',
                            message: `Test case ${i + 1}: expectedOutput must be a string`
                        });
                    }
                    validatedTC.input = tc.input;
                    validatedTC.expectedOutput = expectedOutput;
                }
                */

                validatedTestCases.push(validatedTC);
            }

            // Check if interview is active and warn
            const interviewSchedule = await req.conn.models['InterviewSchedule'].findById(problem.interviewId);
            if (interviewSchedule) {
                const now = new Date();
                const interviewStart = new Date(interviewSchedule.startAt);
                const interviewEnd = new Date(interviewStart.getTime() + interviewSchedule.durationMinutes * 60000);
                if (now >= interviewStart && now <= interviewEnd) {
                    console.warn(`⚠️ Adding test cases to problem ${problemId} while interview ${interviewSchedule._id} is active`);
                }
            }

            // Insert test cases
            const createdTestCases = await req.conn.models['TestCase'].insertMany(validatedTestCases);

            // Count sample vs hidden
            const sampleCount = createdTestCases.filter(tc => tc.isSample).length;
            const hiddenCount = createdTestCases.length - sampleCount;

            return reply.code(201).send({
                problemId,
                testCasesAdded: createdTestCases.length,
                sampleCount,
                hiddenCount,
                testCases: createdTestCases
            });

        } catch (error) {
            console.error('Error creating test cases:', error);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: error.message || 'Failed to create test cases'
            });
        }
    });

    /**
     * GET /problems/:problemId/testcases
     * Get all test cases for a problem
     * Auth: Authenticated users (candidates only see sample test cases)
     */
    fastify.get('/problems/:problemId/testcases', async (req, reply) => {
        try {
            const { problemId } = req.params;

            // Find problem
            const problem = await req.conn.models['Problem'].findById(problemId);
            if (!problem) {
                return reply.code(404).send({
                    error: 'Not Found',
                    message: 'Problem not found'
                });
            }

            // Authorization: Candidates can only view test cases from their interviews
            if (req.user.role === 'candidate' || req.user.role === 'job_seeker') {
                const interviewSchedule = await req.conn.models['InterviewSchedule'].findById(problem.interviewId);
                const isCandidateInInterview = interviewSchedule && interviewSchedule.candidate.toString() === req.user.sub;

                if (!isCandidateInInterview) {
                    return reply.code(403).send({
                        error: 'Forbidden',
                        message: 'You are not authorized to view test cases for this problem'
                    });
                }
            }

            // Build query
            const query = { problemId: new mongoose.Types.ObjectId(problemId) };

            // Candidates only see sample test cases
            if (req.user.role === 'candidate' || req.user.role === 'job_seeker') {
                query.isSample = true;
            }

            const testCases = await req.conn.models['TestCase']
                .find(query)
                .sort({ order: 1 })
                .select('-__v')
                .lean();

            const totalCount = await req.conn.models['TestCase'].countDocuments({
                problemId: new mongoose.Types.ObjectId(problemId)
            });
            const sampleCount = await req.conn.models['TestCase'].countDocuments({
                problemId: new mongoose.Types.ObjectId(problemId),
                isSample: true
            });

            return reply.code(200).send({
                problemId,
                testCases,
                returned: testCases.length,
                totalCount,
                sampleCount,
                hiddenCount: totalCount - sampleCount
            });

        } catch (error) {
            console.error('Error fetching test cases:', error);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: error.message || 'Failed to fetch test cases'
            });
        }
    });

    /**
     * GET /testcases/:testCaseId
     * Get a specific test case
     * Auth: Admin/Recruiter only (candidates should use problem endpoint)
     */
    fastify.get('/testcases/:testCaseId', async (req, reply) => {
        try {
            const { testCaseId } = req.params;

            const testCase = await req.conn.models['TestCase']
                .findById(testCaseId)
                .populate('problemId', 'title interviewId')
                .lean();

            if (!testCase) {
                return reply.code(404).send({
                    error: 'Not Found',
                    message: 'Test case not found'
                });
            }

            // Authorization: Only admins/recruiters can view individual test cases directly
            if (req.user.role === 'candidate' || req.user.role === 'job_seeker') {
                // Candidates must use the problem endpoint to see sample test cases
                return reply.code(403).send({
                    error: 'Forbidden',
                    message: 'Candidates cannot access test cases directly. Use the problem endpoint instead.'
                });
            }

            return reply.code(200).send(testCase);

        } catch (error) {
            console.error('Error fetching test case:', error);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: error.message || 'Failed to fetch test case'
            });
        }
    });

    /**
     * PATCH /testcases/:testCaseId
     * Update a test case
     * Auth: Admin/Problem creator
     */
    fastify.patch('/testcases/:testCaseId', async (req, reply) => {
        try {
            // Authorization check
            if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
                return reply.code(403).send({
                    error: 'Forbidden',
                    message: 'Only admins and recruiters can update test cases'
                });
            }

            const { testCaseId } = req.params;
            const updates = req.body;

            // Find test case
            const testCase = await req.conn.models['TestCase'].findById(testCaseId);
            if (!testCase) {
                return reply.code(404).send({
                    error: 'Not Found',
                    message: 'Test case not found'
                });
            }

            // Find associated problem
            const problem = await req.conn.models['Problem'].findById(testCase.problemId);
            if (!problem) {
                return reply.code(404).send({
                    error: 'Not Found',
                    message: 'Associated problem not found'
                });
            }

            // Authorization: Check if user is the problem creator or admin
            if (
                req.user.role !== 'ultra_admin' &&
                req.user.role !== 'client_admin' &&
                problem.createdBy.toString() !== req.user.sub
            ) {
                return reply.code(403).send({
                    error: 'Forbidden',
                    message: 'You are not authorized to modify test cases for this problem'
                });
            }

            // Prevent changing problemId
            if (updates.problemId) {
                return reply.code(400).send({
                    error: 'Bad Request',
                    message: 'Cannot change problemId of an existing test case'
                });
            }

            // Validation: input and expectedOutput must be strings if provided
            if (updates.input !== undefined && typeof updates.input !== 'string') {
                return reply.code(400).send({
                    error: 'Bad Request',
                    message: 'input must be a string'
                });
            }

            if (updates.expectedOutput !== undefined && typeof updates.expectedOutput !== 'string') {
                return reply.code(400).send({
                    error: 'Bad Request',
                    message: 'expectedOutput must be a string'
                });
            }

            // Validation: isSample must be boolean if provided
            if (updates.isSample !== undefined && typeof updates.isSample !== 'boolean') {
                return reply.code(400).send({
                    error: 'Bad Request',
                    message: 'isSample must be a boolean'
                });
            }

            // Validation: weight must be number if provided
            if (updates.weight !== undefined && typeof updates.weight !== 'number') {
                return reply.code(400).send({
                    error: 'Bad Request',
                    message: 'weight must be a number'
                });
            }

            // Validation: order must be number if provided
            if (updates.order !== undefined && typeof updates.order !== 'number') {
                return reply.code(400).send({
                    error: 'Bad Request',
                    message: 'order must be a number'
                });
            }

            // Check if interview is active and warn
            const interviewSchedule = await req.conn.models['InterviewSchedule'].findById(problem.interviewId);
            if (interviewSchedule) {
                const now = new Date();
                const interviewStart = new Date(interviewSchedule.startAt);
                const interviewEnd = new Date(interviewStart.getTime() + interviewSchedule.durationMinutes * 60000);
                if (now >= interviewStart && now <= interviewEnd) {
                    console.warn(`⚠️ Updating test case ${testCaseId} while interview ${interviewSchedule._id} is active`);
                }
            }

            // Apply updates
            Object.assign(testCase, updates);
            await testCase.save();

            return reply.code(200).send({
                testCaseId: testCase._id,
                message: 'Test case updated successfully',
                updated: testCase
            });

        } catch (error) {
            console.error('Error updating test case:', error);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: error.message || 'Failed to update test case'
            });
        }
    });

    /**
     * DELETE /testcases/:testCaseId
     * Delete a test case
     * Auth: Admin only
     */
    fastify.delete('/testcases/:testCaseId', async (req, reply) => {
        try {
            // Authorization check - only admins can delete
            if (!['ultra_admin', 'client_admin'].includes(req.user.role)) {
                return reply.code(403).send({
                    error: 'Forbidden',
                    message: 'Only admins can delete test cases'
                });
            }

            const { testCaseId } = req.params;

            // Find test case
            const testCase = await req.conn.models['TestCase'].findById(testCaseId);
            if (!testCase) {
                return reply.code(404).send({
                    error: 'Not Found',
                    message: 'Test case not found'
                });
            }

            const problemId = testCase.problemId;

            // Check if there are submission results using this test case
            // const resultCount = await req.conn.models['SubmissionResult'].countDocuments({
            //     testCaseId: testCase._id
            // });

            // if (resultCount > 0) {
            //     return reply.code(400).send({
            //         error: 'Bad Request',
            //         message: `Cannot delete test case: ${resultCount} submission result(s) reference this test case`,
            //         resultCount
            //     });
            // }

            // Delete test case
            await req.conn.models['TestCase'].findByIdAndDelete(testCaseId);

            return reply.code(200).send({
                message: 'Test case deleted successfully',
                testCaseId,
                problemId
            });

        } catch (error) {
            console.error('Error deleting test case:', error);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: error.message || 'Failed to delete test case'
            });
        }
    });

    /**
     * POST /problems/:problemId/testcases/reorder
     * Reorder test cases for a problem
     * Auth: Admin/Problem creator
     */
    fastify.post('/problems/:problemId/testcases/reorder', async (req, reply) => {
        try {
            // Authorization check
            if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
                return reply.code(403).send({
                    error: 'Forbidden',
                    message: 'Only admins and recruiters can reorder test cases'
                });
            }

            const { problemId } = req.params;
            const { testCaseOrder } = req.body;

            // Validation: testCaseOrder array
            if (!testCaseOrder || !Array.isArray(testCaseOrder) || testCaseOrder.length === 0) {
                return reply.code(400).send({
                    error: 'Bad Request',
                    message: 'testCaseOrder is required and must be a non-empty array of { testCaseId, order } objects'
                });
            }

            // Find problem
            const problem = await req.conn.models['Problem'].findById(problemId);
            if (!problem) {
                return reply.code(404).send({
                    error: 'Not Found',
                    message: 'Problem not found'
                });
            }

            // Authorization: Check if user is the problem creator or admin
            if (
                req.user.role !== 'ultra_admin' &&
                req.user.role !== 'client_admin' &&
                problem.createdBy.toString() !== req.user.sub
            ) {
                return reply.code(403).send({
                    error: 'Forbidden',
                    message: 'You are not authorized to reorder test cases for this problem'
                });
            }

            // Update each test case order
            const updatePromises = testCaseOrder.map(({ testCaseId, order }) => {
                if (!testCaseId || typeof order !== 'number') {
                    throw new Error('Each item must have testCaseId and order (number)');
                }

                return req.conn.models['TestCase'].findOneAndUpdate(
                    { _id: testCaseId, problemId },
                    { order },
                    { new: true }
                );
            });

            const updatedTestCases = await Promise.all(updatePromises);

            // Filter out null results (test cases not found)
            const successfulUpdates = updatedTestCases.filter(tc => tc !== null);

            return reply.code(200).send({
                message: 'Test cases reordered successfully',
                problemId,
                updated: successfulUpdates.length,
                testCases: successfulUpdates
            });

        } catch (error) {
            console.error('Error reordering test cases:', error);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: error.message || 'Failed to reorder test cases'
            });
        }
    });
}
