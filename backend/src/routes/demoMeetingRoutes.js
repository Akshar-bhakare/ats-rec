import DemoMeetingController from '../modules/demoMeetings/demoMeetingController.js';

export default async function demoMeetingRoutes(fastify) {
    const controller = new DemoMeetingController();

    fastify.post('/schedule', async (req, reply) => controller.schedule(req, reply));
}

