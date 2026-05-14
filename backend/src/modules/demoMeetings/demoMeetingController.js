import { ZodError } from 'zod';
import DemoMeetingService from './demoMeetingService.js';
import { normalizeScheduleDemoMeetingRequest } from './demoMeetingSchemas.js';
import { ErrorCodes, createDemoMeetingError, toHttpResponse } from './utils/demoMeetingErrors.js';

export default class DemoMeetingController {
    constructor({ service = null } = {}) {
        this.service = service || new DemoMeetingService();
    }

    async schedule(req, reply) {
        try {
            const parsed = normalizeScheduleDemoMeetingRequest({
                body: req.body || {},
                headers: req.headers || {},
            });

            const result = await this.service.scheduleMeeting(parsed, {
                logger: req.log,
                requestId: req.id,
            });

            return reply.code(result.httpStatus || 201).send(result.body);
        } catch (error) {
            const mappedError = error instanceof ZodError
                ? createDemoMeetingError(
                    ErrorCodes.VALIDATION_ERROR,
                    'Invalid demo meeting request',
                    400,
                    error.flatten()
                )
                : error;

            const response = toHttpResponse(mappedError);
            return reply.code(response.statusCode).send(response.body);
        }
    }
}

