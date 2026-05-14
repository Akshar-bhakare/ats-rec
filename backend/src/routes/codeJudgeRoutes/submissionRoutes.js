import mongoose from 'mongoose';
import crypto from 'crypto';
import axios from 'axios';
import { SUPPORTED_LANGUAGES, expandLanguages, deriveExtension } from '../../utils/supportedLanguages.js';
/**
 * Compute plagiarism hash for source code
 * Simple implementation - can be enhanced with more sophisticated algorithms
 */

function computePlagiarismHash(sourceCode) {

    const normalized = sourceCode
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
        .replace(/\/\/.*/g, '') // Remove single-line comments
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

    return crypto.createHash('sha256').update(normalized).digest('hex');
}

export default async function submissionRoutes(fastify) {
    // Apply authentication to all routes
    fastify.addHook('preHandler', fastify.authenticate);

    /**
     * POST /interviews/:interviewId/submissions
     * Candidate submits code for a problem
     * Auth: Authenticated users (candidates)
     * 
 
     */

    fastify.post('/interviews/:interviewId/submissions', async (req, reply) => {
        try {
            const { interviewId } = req.params;
            const { problemId, languageId, sourceCode } = req.body;

            // ============ STEP 1: BASIC VALIDATION ============
            if (!problemId || !languageId || !sourceCode) {
                return reply.code(400).send({
                    error: 'Bad Request',
                    message: 'problemId, languageId, and sourceCode are required'
                });
            }

            if (sourceCode.length > 1048576) {
                return reply.code(400).send({
                    error: 'Bad Request',
                    message: 'Source code exceeds maximum size of 1MB'
                });
            }

            // ============ STEP 2: INTERVIEW VALIDATION ============
            const interview = await req.conn.models['InterviewSchedule'].findById(interviewId);
            if (!interview) {
                return reply.code(404).send({ message: 'Interview not found' });
            }

            if (interview.isArchived) {
                return reply.code(400).send({
                    message: `Interview is archived/ended.`
                });
            }

            const now = new Date();
            const startAt = new Date(interview.startAt);
            if (now < startAt) {
                return reply.code(400).send({ message: 'Interview has not started yet' });
            }

            // Optional: Check if expired based on duration?
            // const endAt = new Date(startAt.getTime() + (interview.durationMinutes || 45) * 60000);
            // if (now > endAt) { ... }
            // Keeping it loose for now as user just wants connection.


            // ============ STEP 3: PROBLEM VALIDATION ============
            const problem = await req.conn.models.Problem.findOne({
                _id: problemId,
                interviewId
            });

            if (!problem || !problem.isActive) {
                return reply.code(404).send({ message: 'Problem not found or inactive' });
            }

            // ============ STEP 4: LANGUAGE VALIDATION ============
            let languageIdNum = Number(languageId);
            if (isNaN(languageIdNum)) {
                // Try to see if it's an object with judge0Id (legacy fallback)
                if (typeof languageId === 'object' && languageId.judge0Id) {
                    languageIdNum = Number(languageId.judge0Id);
                }
            }

            if (!SUPPORTED_LANGUAGES[languageIdNum]) {
                return reply.code(400).send({ message: 'Invalid or unsupported language' });
            }

            if (problem.allowedLanguages?.length) {
                // allowedLanguages are now numbers (Judge0 IDs)
                const allowed = problem.allowedLanguages.some(
                    allowedId => Number(allowedId) === languageIdNum
                );
                if (!allowed) {
                    return reply.code(400).send({
                        message: 'This language is not allowed for this problem'
                    });
                }
            }

            // ============ STEP 5: ATTEMPT NUMBER ============
            const attemptNumber =
                (await req.conn.models.Submission.countDocuments({
                    userId: req.user.sub,
                    problemId,
                    interviewId
                })) + 1;

            // ============ STEP 6: INITIAL SUBMISSION ============
            const totalTestCases = await req.conn.models.TestCase.countDocuments({
                problemId
            });

            const submission = await req.conn.models.Submission.create({
                userId: req.user.sub,
                problemId,
                interviewId,
                language: languageIdNum, // Store Judge0 ID directly
                sourceCode,
                attemptNumber,
                status: 'queued',
                totalTestCases,
                passedTestCases: 0,
                judge0: {
                    batchTokens: [],
                    totalTests: totalTestCases,
                    completedTests: 0
                },
                plagiarismHash: computePlagiarismHash(sourceCode)
            });

            const adapterUrl = process.env.EXECUTION_ADAPTER_URL || 'http://localhost:8080';
            axios.post(
                `${adapterUrl}/api/codejudge/internal/execute`,
                {
                    submissionId: submission._id.toString(),
                    sourceCode,
                    languageId: languageIdNum,
                    problemId,
                    dbName: req.conn.name || process.env.DEFAULT_DB_NAME

                }
            ).catch(err => {
                console.error('❌ Execution adapter failed:', err);
            });


            // ============ STEP 8: RESPOND ============
            return reply.code(201).send({
                submissionId: submission._id,
                status: 'queued',
                attemptNumber,
                totalTestCases,
                message: 'Submission received and queued for execution'
            });

        } catch (err) {
            console.error('❌ Submission error:', err);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: err.message
            });
        }
    });


    // Gets status of a submission
    fastify.get('/submissions/:submissionId/status', async (req, reply) => {
        try {
            const { submissionId } = req.params;

            // Use authenticated connection
            const conn = req.conn;

            // Find submission
            const submission = await conn.models['Submission'].findById(submissionId).lean();

            if (!submission) {
                return reply.code(404).send({
                    error: 'Not Found',
                    message: 'Submission not found'
                });
            }

            // Find detailed results if any
            let detailedResults = [];
            if (conn.models['SubmissionResult']) {
                detailedResults = await conn.models['SubmissionResult']
                    .find({ submissionId: submission._id })
                    .lean();
            }

            // Return current status and verdict (updated via webhook)
            return reply.code(200).send({
                submissionId: submission._id,
                status: submission.status,
                webhookReceived: submission.webhookReceived,
                judge0Tokens: submission.judge0?.batchTokens || [],
                passedTestCases: submission.passedTestCases,
                totalTestCases: submission.totalTestCases,
                executionTime: submission.executionTime,
                memoryUsed: submission.memoryUsed,
                stdout: submission.stdout,
                detailedResults, // Include detailed breakdown
                stderr: submission.stderr,
                compilerOutput: submission.compilerOutput
            });

        } catch (error) {
            console.error('❌ [SUBMISSION STATUS] Error:', error);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: error.message || 'Failed to fetch submission status'
            });
        }
    });



    /**
     * GET /interviews/:interviewId/submissions
     * Get all submissions for an interview
     * Auth: Authenticated users
     */
    fastify.get('/interviews/:interviewId/submissions', async (req, reply) => {
        try {
            const { interviewId } = req.params;
            const { problemId, userId, limit = 50, skip = 0 } = req.query;

            // Validation: Interview exists
            const interview = await req.conn.models['InterviewSchedule'].findById(interviewId);
            if (!interview) {
                return reply.code(404).send({
                    error: 'Not Found',
                    message: 'Interview not found'
                });
            }

            // Build query
            const query = { interviewId: new mongoose.Types.ObjectId(interviewId) };

            // Authorization: Candidates can only see their own submissions
            if (req.user.role === 'candidate' || req.user.role === 'job_seeker') {
                query.userId = new mongoose.Types.ObjectId(req.user.sub);
            } else if (userId) {
                // Admins/recruiters can filter by userId
                query.userId = new mongoose.Types.ObjectId(userId);
            }

            // Filter by problem if specified
            if (problemId) {
                query.problemId = new mongoose.Types.ObjectId(problemId);
            }

            let submissions = await req.conn.models['Submission']
                .find(query)
                .sort({ createdAt: -1 })
                .limit(parseInt(limit))
                .skip(parseInt(skip))
                .populate('problemId', 'title difficulty')
                .populate('userId', 'firstName lastName email')
                .select('-sourceCode') // Don't include source code in list view
                .lean();

            // Manually expand language for each submission
            submissions = submissions.map(s => {
                const langName = SUPPORTED_LANGUAGES[s.language] || "Unknown";
                return {
                    ...s,
                    language: {
                        _id: s.language,
                        judge0Id: s.language,
                        name: langName
                    }
                };
            });

            const total = await req.conn.models['Submission'].countDocuments(query);

            return reply.code(200).send({
                interviewId,
                submissions,
                total,
                limit: parseInt(limit),
                skip: parseInt(skip)
            });

        } catch (error) {
            console.error('Error fetching submissions:', error);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: error.message || 'Failed to fetch submissions'
            });
        }
    });

    /**
     * GET /interviews/:interviewId/best-submission
     * Get the best submission for the current candidate in the interview
     * "Best" = Max passed test cases, then most recent
     * Auth: Authenticated users
     */
    fastify.get('/interviews/:interviewId/best-submission', async (req, reply) => {
        try {
            const { interviewId } = req.params;
            const { userId } = req.query;

            // Authorization: Candidates can only see their own best
            let targetUserId = req.user.sub;
            if (req.user.role !== 'candidate' && req.user.role !== 'job_seeker' && userId) {
                // Admins can request best for a specific user
                targetUserId = userId;
            }

            const terminalFilter = { $nin: ['queued', 'running'] };
            const best = await req.conn.models['Submission']
                .findOne({
                    interviewId,
                    userId: targetUserId,
                    status: terminalFilter
                })
                .sort({ passedTestCases: -1, createdAt: -1 }) // Best logic
                .lean();

            if (!best) {
                return reply.code(404).send({ message: 'No completed submissions found' });
            }

            return reply.send(best);

        } catch (error) {
            console.error('Error fetching best submission:', error);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: error.message
            });
        }
    });

    /**
     * GET /submissions/:submissionId
     * Get submission details
     * Auth: Authenticated users (candidates can only see their own)
     */
    fastify.get('/submissions/:submissionId', async (req, reply) => {
        try {
            const { submissionId } = req.params;
            const { includeSourceCode } = req.query;

            const selectFields = includeSourceCode === 'true' ? '' : '-sourceCode';

            const submission = await req.conn.models['Submission']
                .findById(submissionId)
                .populate('problemId', 'title difficulty description')
                .populate('userId', 'firstName lastName email')
                .populate('interviewId', 'title status')
                .select(selectFields)
                .lean();

            if (submission && submission.language) {
                const langName = SUPPORTED_LANGUAGES[submission.language];
                submission.language = {
                    name: langName,
                    judge0Id: submission.language,
                    extension: deriveExtension(langName)
                };
            }

            if (!submission) {
                return reply.code(404).send({
                    error: 'Not Found',
                    message: 'Submission not found'
                });
            }

            // Authorization: Candidates can only view their own submissions
            if (req.user.role === 'candidate' || req.user.role === 'job_seeker') {
                if (submission.userId._id.toString() !== req.user.sub) {
                    return reply.code(403).send({
                        error: 'Forbidden',
                        message: 'You are not authorized to view this submission'
                    });
                }
            }

            // Get submission results (test case results)
            // const results = await req.conn.models['SubmissionResult']
            //     .find({ submissionId: submission._id })
            //     .populate('testCaseId', 'isSample order')
            //     .sort({ 'testCaseId.order': 1 })
            //     .lean();

            // // Candidates only see results for sample test cases
            // let filteredResults = results;
            // if (req.user.role === 'candidate' || req.user.role === 'job_seeker') {
            //     filteredResults = results.filter(result => result.testCaseId?.isSample === true);
            // }

            return reply.code(200).send({
                ...submission,
                // results: filteredResults,
                // totalResults: results.length,
                // visibleResults: filteredResults.length
            });

        } catch (error) {
            console.error('Error fetching submission details:', error);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: error.message || 'Failed to fetch submission details'
            });
        }
    });

    /**
     * POST /submissions/:submissionId/rejudge
     * Re-execute a submission (for debugging or updated test cases)
     * Auth: Admin/Recruiter only
     */
    // fastify.post('/:submissionId/rejudge', async (req, reply) => {
    //     try {
    //         // Authorization check
    //         if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
    //             return reply.code(403).send({
    //                 error: 'Forbidden',
    //                 message: 'Only admins and recruiters can rejudge submissions'
    //             });
    //         }

    //         const { submissionId } = req.params;

    //         // Find submission
    //         const submission = await req.conn.models['Submission']
    //             .findById(submissionId)
    //             .populate('language', 'judge0Id');

    //         if (!submission) {
    //             return reply.code(404).send({
    //                 error: 'Not Found',
    //                 message: 'Submission not found'
    //             });
    //         }

    //         // Increment attempt number
    //         submission.attemptNumber += 1;
    //         submission.status = 'queued';
    //         submission.webhookReceived = false;
    //         submission.judge0Token = null;
    //         submission.executionTime = null;
    //         submission.memoryUsed = null;
    //         submission.stdout = null;
    //         submission.stderr = null;
    //         submission.compilerOutput = null;
    //         submission.passedTestCases = null;
    //         submission.score = null;

    //         await submission.save();

    //         // Delete old submission results
    //         await req.conn.models['SubmissionResult'].deleteMany({
    //             submissionId: submission._id
    //         });

    //         // TODO: Re-trigger execution adapter
    //         // await executionAdapter.execute({
    //         //     submissionId: submission._id,
    //         //     sourceCode: submission.sourceCode,
    //         //     languageId: submission.language.judge0Id,
    //         //     problemId: submission.problemId
    //         // });

    //         // Dummy token for now
    //         const dummyJudge0Token = `rejudge_token_${submission._id}_${Date.now()}`;
    //         submission.judge0Token = dummyJudge0Token;
    //         submission.status = 'running';
    //         await submission.save();

    //         console.log(`🔄 Submission rejudged: ${submission._id} | New attempt: ${submission.attemptNumber}`);

    //         return reply.code(200).send({
    //             submissionId: submission._id,
    //             status: 'queued',
    //             attemptNumber: submission.attemptNumber,
    //             message: 'Submission queued for rejudging'
    //         });

    //     } catch (error) {
    //         console.error('Error rejudging submission:', error);
    //         return reply.code(500).send({
    //             error: 'Internal Server Error',
    //             message: error.message || 'Failed to rejudge submission'
    //         });
    //     }
    // });

    /**
     * PATCH /submissions/:submissionId/finalize
     * Mark submission as final for interview scoring
     * Auth: Candidate (own submission) or Admin
     */
    fastify.patch('/submissions/:submissionId/finalize', async (req, reply) => {
        try {
            const { submissionId } = req.params;
            const { isFinalSubmission } = req.body;
            console.log(`[FINALIZE REQUEST] ID: ${submissionId}, isFinal: ${isFinalSubmission}`);

            if (typeof isFinalSubmission !== 'boolean') {
                return reply.code(400).send({
                    error: 'Bad Request',
                    message: 'isFinalSubmission must be a boolean value'
                });
            }

            // Find submission
            const submission = await req.conn.models['Submission'].findById(submissionId);
            if (!submission) {
                console.error(`[FINALIZE ERROR] Submission ${submissionId} not found`);
                return reply.code(404).send({
                    error: 'Not Found',
                    message: 'Submission not found'
                });
            }

            // Authorization: Candidate can only finalize their own submissions
            // if (req.user.role === 'candidate' || req.user.role === 'job_seeker') {
            //     if (submission.userId.toString() !== req.user.sub) {
            //         return reply.code(403).send({
            //             error: 'Forbidden',
            //             message: 'You can only finalize your own submissions'
            //         });
            //     }
            // }

            // If setting as final, unset other final submissions for this problem
            if (isFinalSubmission) {
                await req.conn.models['Submission'].updateMany(
                    {
                        userId: submission.userId,
                        problemId: submission.problemId,
                        interviewId: submission.interviewId,
                        _id: { $ne: submission._id }
                    },
                    { isFinalSubmission: false }
                );
            }

            // Update submission using findByIdAndUpdate to ensure atomic update
            const updatedSubmission = await req.conn.models['Submission'].findByIdAndUpdate(
                submissionId,
                { $set: { isFinalSubmission: isFinalSubmission } },
                { new: true, runValidators: true }
            );

            console.log(`✅ [FINALIZE SUCCESS] Submission ${submissionId} marked as final: ${updatedSubmission?.isFinalSubmission}`);

            // Handle End Interview (Archive)
            const shouldEndInterview = Boolean(req.body?.endInterview);
            if (shouldEndInterview) {
                console.log(`[FINALIZE] endInterview requested for submission ${submissionId}`);
                const InterviewSchedule = req.conn.models['InterviewSchedule'];
                try {
                    if (InterviewSchedule && submission?.interviewId) {
                        const scheduleId = submission.interviewId?.toString?.() || String(submission.interviewId);
                        const schedule = await InterviewSchedule.findOne({
                            _id: scheduleId,
                            client: req.client,
                            isArchived: false,
                        })
                            .lean()
                            .exec();

                        if (schedule) {
                            const authHeader = req.headers.authorization;
                            const cookieHeader = req.headers.cookie;
                            const payload = {
                                interviewScheduleId: scheduleId,
                                candidateId: schedule.candidate?.toString?.(),
                                jobId: schedule.job?.toString?.(),
                            };

                            setImmediate(async () => {
                                try {
                                    const res = await fastify.inject({
                                        method: 'POST',
                                        url: '/api/ai/endInterview',
                                        payload,
                                        headers: {
                                            'content-type': 'application/json',
                                            ...(authHeader ? { authorization: authHeader } : {}),
                                            ...(cookieHeader ? { cookie: cookieHeader } : {}),
                                        },
                                    });
                                    console.log('[FINALIZE] endInterview triggered', {
                                        scheduleId,
                                        statusCode: res?.statusCode,
                                    });
                                } catch (err) {
                                    console.error('[FINALIZE] endInterview inject failed:', err?.message || err);
                                }
                            });
                        } else {
                            console.warn('[FINALIZE] endInterview skipped, schedule not found', { scheduleId });
                        }
                    }
                } catch (err) {
                    console.error('[FINALIZE] endInterview trigger error:', err?.message || err);
                }
            }


            return reply.code(200).send({
                submissionId: updatedSubmission._id,
                isFinalSubmission: updatedSubmission.isFinalSubmission,
                message: isFinalSubmission
                    ? 'Submission marked as final for scoring'
                    : 'Submission unmarked as final'
            });

        } catch (error) {
            console.error('Error finalizing submission:', error);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: error.message || 'Failed to finalize submission'
            });
        }
    });

    /**
     * GET /interviews/:interviewId/final-submission
     * Get the final submission for a candidate in an interview
     * Auth: Admin/Ultra Admin/Recruiter/Interviewer only
     */
    fastify.get('/interviews/:interviewId/final-submission', async (req, reply) => {
        try {
            const { interviewId } = req.params;
            const { userId } = req.query; // Explicitly get userId from query

            console.log(`[FINAL SUBMISSION] Request for interview: ${interviewId}, queryUser: ${userId}, requesterRole: ${req.user.role}`);

            // Strict Authorization: Only specific roles can view evaluations
            const notAllowedRoles = ['candidate', 'job_seeker'];
            if (notAllowedRoles.includes(req.user.role)) {
                console.log(`[FINAL SUBMISSION] Unauthorized access attempt by ${req.user.role}`);
                return reply.code(403).send({
                    error: 'Forbidden',
                    message: 'You are not authorized to view interview evaluations.'
                });
            }

            const baseQuery = {
                interviewId: new mongoose.Types.ObjectId(interviewId)
            };

            // If userId provided, focus on that user's submission
            if (userId) {
                baseQuery.userId = new mongoose.Types.ObjectId(userId);
            }

            console.log(`[FINAL SUBMISSION] Query:`, JSON.stringify(baseQuery));

            let submission = await req.conn.models['Submission']
                .findOne({
                    ...baseQuery,
                    isFinalSubmission: true
                })
                .populate('problemId', 'title difficulty')
                .populate('userId', 'firstName lastName email')
                .lean();

            let resolvedFrom = 'final';
            if (!submission) {
                submission = await req.conn.models['Submission']
                    .findOne({
                        ...baseQuery,
                        status: { $nin: ['queued', 'running'] }
                    })
                    .sort({ passedTestCases: -1, createdAt: -1 })
                    .populate('problemId', 'title difficulty')
                    .populate('userId', 'firstName lastName email')
                    .lean();
                if (submission) {
                    resolvedFrom = 'best-completed';
                    console.log('[FINAL SUBMISSION] Fallback used: best completed submission');
                }
            }

            if (submission && submission.language) {
                const langName = SUPPORTED_LANGUAGES[submission.language];
                submission.language = {
                    name: langName,
                    judge0Id: submission.language,
                    extension: deriveExtension(langName)
                };
            }

            if (!submission) {
                console.log(`[FINAL SUBMISSION] No submission found for query.`);
                return reply.code(404).send({ message: 'No final submission found' });
            }

            // Get submission results (test case results)
            let results = [];
            if (req.conn.models['SubmissionResult']) {
                const rawResults = await req.conn.models['SubmissionResult']
                    .find({ submissionId: submission._id })
                    .populate('testCaseId', 'isSample order input output expectedOutput')
                    .sort({ 'testCaseId.order': 1 })
                    .lean();

                // Transform results to match frontend expectations
                results = rawResults.map(res => ({
                    ...res,
                    time: res.executionTime, // Map executionTime to time
                    memory: res.memoryUsed,  // Map memoryUsed to memory
                    // Robust status mapping
                    status: {
                        id: res.status === 'passed' ? 3 : 4,
                        label: res.status === 'passed' ? 'Accepted' :
                            (res.status === 'failed' || res.status === 'wrong_answer') ? 'Wrong Answer' :
                                res.status === 'runtime_error' ? 'Runtime Error' :
                                    res.status === 'time_limit_exceeded' ? 'Time Limit Exceeded' : res.status,
                        description: res.status
                    },
                    message: res.output || '' // Use output as message
                }));
            }

            return reply.code(200).send({
                ...submission,
                results, // Include detailed results
                resolvedFrom
            });

        } catch (error) {
            console.error('Error fetching final submission:', error);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: error.message || 'Failed to fetch final submission'
            });
        }
    });

    /**
     * GET /interviews/:interviewId/leaderboard
     * Get leaderboard for an interview
     * Auth: Admin/Recruiter
     */
    fastify.get('/interviews/:interviewId/leaderboard', async (req, reply) => {
        try {
            // Authorization check
            if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
                return reply.code(403).send({
                    error: 'Forbidden',
                    message: 'Only admins and recruiters can view leaderboard'
                });
            }

            const { interviewId } = req.params;

            // Validation: Interview exists
            const interview = await req.conn.models['InterviewSchedule'].findById(interviewId);
            if (!interview) {
                return reply.code(404).send({
                    error: 'Not Found',
                    message: 'Interview not found'
                });
            }

            // Aggregate submissions to get leaderboard
            const leaderboard = await req.conn.models['Submission'].aggregate([
                { $match: { interviewId: new mongoose.Types.ObjectId(interviewId) } },
                {
                    $group: {
                        _id: '$userId',
                        totalSubmissions: { $sum: 1 },
                        acceptedSubmissions: {
                            $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] }
                        },
                        totalScore: { $sum: '$score' },
                        avgExecutionTime: { $avg: '$executionTime' },
                        lastSubmission: { $max: '$createdAt' }
                    }
                },
                { $sort: { totalScore: -1, avgExecutionTime: 1 } }
            ]);

            // Populate user details
            const populatedLeaderboard = await req.conn.models['Candidate'].populate(
                leaderboard,
                { path: '_id', select: 'firstName lastName email' }
            );

            return reply.code(200).send({
                interviewId,
                leaderboard: populatedLeaderboard,
                total: populatedLeaderboard.length
            });

        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            return reply.code(500).send({
                error: 'Internal Server Error',
                message: error.message || 'Failed to fetch leaderboard'
            });
        }
    });
}
