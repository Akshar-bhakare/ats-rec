import mongoose from 'mongoose';
import { SUPPORTED_LANGUAGES, deriveExtension, extractVersion, expandLanguages } from '../../utils/supportedLanguages.js';

const normalizeAllowedLanguageInput = (allowedLanguages = []) => {
    const ids = new Set();

    if (!Array.isArray(allowedLanguages)) {
        return [];
    }

    for (const entry of allowedLanguages) {
        if (entry == null) continue;

        if (typeof entry === 'number' && Number.isFinite(entry)) {
            ids.add(entry);
            continue;
        }

        // Handle objects or strings if legacy data comes in
        const candidate = typeof entry === 'object'
            ? (entry.judge0Id ?? entry._id ?? entry.id ?? entry)
            : entry;

        const str = String(candidate).trim();
        if (!str) continue;

        if (/^\d+$/.test(str)) {
            const parsed = Number(str);
            if (Number.isFinite(parsed)) ids.add(parsed);
        }
    }

    return Array.from(ids);
};

const resolveActiveLanguages = (allowedLanguages) => {
    const requestedIds = normalizeAllowedLanguageInput(allowedLanguages);

    if (!requestedIds.length) return [];

    const validIds = [];

    for (const id of requestedIds) {
        if (SUPPORTED_LANGUAGES[id]) {
            validIds.push(id);
        }
    }

    return validIds;
};



export default async function problemRoutes(fastify) {
    // Apply authentication to all routes
    fastify.addHook('preHandler', fastify.authenticate);

    /**
     * POST /interviews/:interviewId/problems
     * Add a problem to a specific interview
     * Auth: Admin/Recruiter
     */
    fastify.post('/interviews/:interviewId/problems', async (req, reply) => {
        try {
            // Authorization check
            if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
                return reply.code(403).send({
                    error: 'Forbidden',
                    message: 'Only admins and recruiters can create problems'
                });
            }

            const { interviewId } = req.params;
            const {
                title,
                description,
                difficulty,
                constraints,
                signature, // JSON Harness signature
                timeLimit,
                memoryLimit,
                allowedLanguages
            } = req.body;

            // Validation: Required fields
            if (!title || !description) {
                return reply.code(400).send({
                    error: 'Bad Request',
                    message: 'title and description are required'
                });
            }

            // Validation: InterviewSchedule exists
            const interviewSchedule = await req.conn.models['InterviewSchedule'].findById(interviewId);
            if (!interviewSchedule) {
                return reply.code(404).send({
                    error: 'Not Found',
                    message: 'Interview schedule not found'
                });
            }

            // Validation: Difficulty enum
            if (difficulty && !['easy', 'medium', 'hard'].includes(difficulty)) {
                return reply.code(400).send({
                    error: 'Bad Request',
                    message: 'difficulty must be one of: easy, medium, hard'
                });
            }

            // Validation: Time and memory limits
            if (timeLimit && (timeLimit < 100 || timeLimit > 30000)) {
                return reply.code(400).send({
                    error: 'Bad Request',
                    message: 'timeLimit must be between 100ms and 30000ms'
                });
            }

            if (memoryLimit && (memoryLimit < 1024 || memoryLimit > 1048576)) {
                return reply.code(400).send({
                    error: 'Bad Request',
                    message: 'memoryLimit must be between 1KB and 1GB (1024-1048576 KB)'
                });
            }

            // Validate allowed languages and normalize IDs
            let validatedLanguages = [];
            if (allowedLanguages && Array.isArray(allowedLanguages) && allowedLanguages.length > 0) {
                validatedLanguages = resolveActiveLanguages(allowedLanguages);

                if (validatedLanguages.length === 0) {
                    console.warn('[codejudge] All provided allowedLanguages were invalid/unsupported. Defaulting to ALL.');
                    validatedLanguages = Object.keys(SUPPORTED_LANGUAGES).map(Number);
                }
            } else {
                // Default to all supported languages if none provided or invalid format
                validatedLanguages = Object.keys(SUPPORTED_LANGUAGES).map(Number);
            }

            // Create problem


            const problem = await req.conn.models['Problem'].create({
                title,
                description,
                difficulty: difficulty || 'medium',
                constraints: constraints || '',
                signature, // JSON Harness signature
                timeLimit: timeLimit || 2000, // default 2 seconds
                memoryLimit: memoryLimit || 256000, // default 256MB
                allowedLanguages: validatedLanguages,
                createdBy: new mongoose.Types.ObjectId(req.user.sub),
                interviewId: new mongoose.Types.ObjectId(interviewId),
                isActive: true
            });



            // Get test case count
            const testCaseCount = await req.conn.models['TestCase'].countDocuments({
                problemId: problem._id
            });

            return reply.code(201).send({
                problemId: problem._id,
                interviewId: problem.interviewId,
                title: problem.title,
                difficulty: problem.difficulty,
                timeLimit: problem.timeLimit,
                memoryLimit: problem.memoryLimit,
                totalTestCases: testCaseCount,
                isActive: problem.isActive,
                createdAt: problem.createdAt
            });

        } catch (error) {
            console.error('Error creating problem:', error);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: error.message || 'Failed to create problem'
            });
        }
    });

    /**
     * GET /interviews/:interviewId/problems
     * Get all problems for an interview
     * Auth: Authenticated users
     */
    fastify.get('/interviews/:interviewId/problems', async (req, reply) => {
        try {
            const { interviewId } = req.params;
            const { includeInactive } = req.query;

            // Validation: InterviewSchedule exists
            const interviewSchedule = await req.conn.models['InterviewSchedule'].findById(interviewId);
            if (!interviewSchedule) {
                return reply.code(404).send({
                    error: 'Not Found',
                    message: 'Interview schedule not found'
                });
            }

            // Authorization: Candidates can only view problems for their interviews
            if (req.user.role === 'candidate' || req.user.role === 'job_seeker') {
                const isCandidateInInterview = interviewSchedule.candidate.toString() === req.user.sub;

                if (!isCandidateInInterview) {
                    return reply.code(403).send({
                        error: 'Forbidden',
                        message: 'You are not authorized to view problems for this interview'
                    });
                }
            }

            // Build query
            const query = { interviewId: new mongoose.Types.ObjectId(interviewId) };

            // Only show active problems to candidates
            if (req.user.role === 'candidate' || req.user.role === 'job_seeker' || !includeInactive) {
                query.isActive = true;
            }

            const problems = await req.conn.models['Problem']
                .find(query)
                // .populate('allowedLanguages', 'name judge0Id extension') // REMOVED
                .populate('createdBy', 'firstName lastName email')
                .sort({ createdAt: -1 })
                .lean();

            // Get test case counts for each problem and expand languages
            const problemsWithCounts = await Promise.all(
                problems.map(async (problem) => {
                    const totalTestCases = await req.conn.models['TestCase'].countDocuments({
                        problemId: problem._id
                    });
                    const sampleTestCases = await req.conn.models['TestCase'].countDocuments({
                        problemId: problem._id,
                        isSample: true
                    });

                    return {
                        ...problem,
                        allowedLanguages: expandLanguages(problem.allowedLanguages),
                        totalTestCases,
                        sampleTestCases,
                        hiddenTestCases: totalTestCases - sampleTestCases
                    };
                })
            );

            return reply.code(200).send({
                interviewId,
                problems: problemsWithCounts,
                total: problemsWithCounts.length
            });

        } catch (error) {
            console.error('Error fetching problems:', error);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: error.message || 'Failed to fetch problems'
            });
        }
    });

    /**
     * GET /problems/:problemId
     * Get problem details
     * Auth: Authenticated users
     */
    fastify.get('/problems/:problemId', async (req, reply) => {
        try {
            const { problemId } = req.params;
            const { includeTestCases } = req.query;

            const problem = await req.conn.models['Problem']
                .findById(problemId)
                // .populate('allowedLanguages', 'name judge0Id extension version') // REMOVED
                .populate('createdBy', 'firstName lastName email')
                .populate('interviewId', 'title status startTime endTime')
                .lean();

            if (!problem) {
                return reply.code(404).send({
                    error: 'Not Found',
                    message: 'Problem not found'
                });
            }

            // Expand languages manually
            problem.allowedLanguages = expandLanguages(problem.allowedLanguages);

            // Authorization: Candidates can only view problems from their interviews
            if (req.user.role === 'candidate' || req.user.role === 'job_seeker') {
                const interviewSchedule = await req.conn.models['InterviewSchedule'].findById(problem.interviewId._id);
                const isCandidateInInterview = interviewSchedule && interviewSchedule.candidate.toString() === req.user.sub;

                if (!isCandidateInInterview) {
                    return reply.code(403).send({
                        error: 'Forbidden',
                        message: 'You are not authorized to view this problem'
                    });
                }

                // Candidates can only see active problems
                if (!problem.isActive) {
                    return reply.code(403).send({
                        error: 'Forbidden',
                        message: 'This problem is not available'
                    });
                }
            }

            // Get test case counts
            const totalTestCases = await req.conn.models['TestCase'].countDocuments({
                problemId: problem._id
            });
            const sampleTestCases = await req.conn.models['TestCase'].countDocuments({
                problemId: problem._id,
                isSample: true
            });

            const response = {
                ...problem,
                totalTestCases,
                sampleTestCases,
                hiddenTestCases: totalTestCases - sampleTestCases
            };

            // Include sample test cases if requested (candidates only see samples)
            if (includeTestCases === 'true') {
                const testCaseQuery = { problemId: problem._id };

                // Candidates only see sample test cases
                if (req.user.role === 'candidate' || req.user.role === 'job_seeker') {
                    testCaseQuery.isSample = true;
                }

                const testCases = await req.conn.models['TestCase']
                    .find(testCaseQuery)
                    .sort({ order: 1 })
                    .select('-__v')
                    .lean();

                response.testCases = testCases;
            }

            return reply.code(200).send(response);

        } catch (error) {
            console.error('Error fetching problem details:', error);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: error.message || 'Failed to fetch problem details'
            });
        }
    });

    /**
     * PATCH /problems/:problemId
     * Update problem content
     * Auth: Admin/Problem creator
     */
    fastify.patch('/:problemId', async (req, reply) => {
        try {
            // Authorization check
            if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
                return reply.code(403).send({
                    error: 'Forbidden',
                    message: 'Only admins and recruiters can update problems'
                });
            }

            const { problemId } = req.params;
            const updates = req.body;

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
                    message: 'You are not authorized to modify this problem'
                });
            }

            // Prevent changing interviewId
            if (updates.interviewId) {
                return reply.code(400).send({
                    error: 'Bad Request',
                    message: 'Cannot change interviewId of an existing problem'
                });
            }

            // Validation: Difficulty
            if (updates.difficulty && !['easy', 'medium', 'hard'].includes(updates.difficulty)) {
                return reply.code(400).send({
                    error: 'Bad Request',
                    message: 'difficulty must be one of: easy, medium, hard'
                });
            }

            // Validation: Time and memory limits
            if (updates.timeLimit && (updates.timeLimit < 100 || updates.timeLimit > 30000)) {
                return reply.code(400).send({
                    error: 'Bad Request',
                    message: 'timeLimit must be between 100ms and 30000ms'
                });
            }

            if (updates.memoryLimit && (updates.memoryLimit < 1024 || updates.memoryLimit > 1048576)) {
                return reply.code(400).send({
                    error: 'Bad Request',
                    message: 'memoryLimit must be between 1KB and 1GB (1024-1048576 KB)'
                });
            }

            // Validation: Allowed languages
            if (updates.allowedLanguages && Array.isArray(updates.allowedLanguages)) {
                const validatedLanguages = resolveActiveLanguages(updates.allowedLanguages);

                if (updates.allowedLanguages.length > 0 && validatedLanguages.length === 0) {
                    console.warn('[codejudge] All provided allowedLanguages for update were invalid/unsupported');
                }

                updates.allowedLanguages = validatedLanguages;
            }

            // Check if interview is active and warn
            const interviewSchedule = await req.conn.models['InterviewSchedule'].findById(problem.interviewId);
            if (interviewSchedule) {
                const now = new Date();
                const interviewStart = new Date(interviewSchedule.startAt);
                const interviewEnd = new Date(interviewStart.getTime() + interviewSchedule.durationMinutes * 60000);
                if (now >= interviewStart && now <= interviewEnd) {
                    console.warn(`⚠️ Updating problem ${problemId} while interview ${interviewSchedule._id} is active`);
                }
            }

            // Apply updates
            Object.assign(problem, updates);
            await problem.save();

            return reply.code(200).send({
                problemId: problem._id,
                message: 'Problem updated successfully',
                updated: problem
            });

        } catch (error) {
            console.error('Error updating problem:', error);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: error.message || 'Failed to update problem'
            });
        }
    });

    /**
     * PATCH /problems/:problemId/visibility
     * Toggle problem active status
     * Auth: Admin/Recruiter
     */
    fastify.patch('/:problemId/visibility', async (req, reply) => {
        try {
            // Authorization check
            if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
                return reply.code(403).send({
                    error: 'Forbidden',
                    message: 'Only admins and recruiters can change problem visibility'
                });
            }

            const { problemId } = req.params;
            const { isActive } = req.body;

            if (typeof isActive !== 'boolean') {
                return reply.code(400).send({
                    error: 'Bad Request',
                    message: 'isActive must be a boolean value'
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

            // Update visibility
            problem.isActive = isActive;
            await problem.save();

            return reply.code(200).send({
                problemId: problem._id,
                isActive: problem.isActive,
                message: `Problem ${isActive ? 'activated' : 'deactivated'} successfully`
            });

        } catch (error) {
            console.error('Error updating problem visibility:', error);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: error.message || 'Failed to update problem visibility'
            });
        }
    });

    /**
     * DELETE /problems/:problemId
     * Delete a problem (soft delete by setting isActive to false)
     * Auth: Admin only
     */
    fastify.delete('/:problemId', async (req, reply) => {
        try {
            // Authorization check - only admins can delete
            if (!['ultra_admin', 'client_admin'].includes(req.user.role)) {
                return reply.code(403).send({
                    error: 'Forbidden',
                    message: 'Only admins can delete problems'
                });
            }

            const { problemId } = req.params;

            // Find problem
            const problem = await req.conn.models['Problem'].findById(problemId);
            if (!problem) {
                return reply.code(404).send({
                    error: 'Not Found',
                    message: 'Problem not found'
                });
            }

            // Check if submissions exist
            const submissionCount = await req.conn.models['Submission'].countDocuments({
                problemId: problem._id
            });

            if (submissionCount > 0) {
                // Soft delete: set isActive to false
                problem.isActive = false;
                await problem.save();

                return reply.code(200).send({
                    message: 'Problem deactivated (soft delete) due to existing submissions',
                    problemId: problem._id,
                    submissionCount,
                    isActive: false
                });
            }

            // No submissions, safe to hard delete
            await req.conn.models['Problem'].findByIdAndDelete(problemId);

            // Also delete associated test cases
            await req.conn.models['TestCase'].deleteMany({ problemId: problem._id });

            return reply.code(200).send({
                message: 'Problem and associated test cases deleted successfully',
                problemId: problem._id
            });

        } catch (error) {
            console.error('Error deleting problem:', error);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: error.message || 'Failed to delete problem'
            });
        }
    });
}
