// backend\src\routes\candidateATSRoutes.js
import CandidateATSService from '../services/candidateATSService.js';

export default async function candidateATSRoutes(fastify) {
    const svc = new CandidateATSService();

    fastify.addHook('preHandler', fastify.authenticate);

    // List candidate ATS view data
    fastify.get('/', async (req, reply) => {
        const res = await svc.getATSListView(req?.query || {}, req.user, req.client, req.conn);
        if (!res?.ok) return reply.code(res?.code || 400).send({ error: res?.message || 'Failed to load' });
        if (res?.meta) {
            return reply.send(res);
        }
        return reply.send(res.items); // keep output same as before
    });

    fastify.get('/filter/job/:jobId/', async (req, reply) => {
        const { jobId } = req?.params || {};
        const atsFilter = {
            job: jobId,
        };
        const allAts = await svc.readFiltered(
            atsFilter,
            req,
            false,
            null,
            false,
            'interested aiCallStatus aiCallHangUpCause aiCallHangUpSource callAudioDuration scheduleTimes stageResults',
            [
                {
                    path: "candidate",
                    model: "Candidate",
                    selection: 'firstName lastName email countryCode phoneNumber skills'
                },
                {
                    path: "stageResults",
                    model: "StageResult",
                    select: "stage stageStatus remarkOrFeedback",
                    populate: {
                        path: "stage",
                        model: "Stage",
                        select: "title description createdAt",
                        match: { isArchived: false }
                    }
                }
            ]
        );

        const withSchduleTime = [];

        for (const atsEle of (allAts || [])) {
            const { scheduleTimes, ...restData } = atsEle;
            let newDt = { ...restData };
            for (const stEle of (scheduleTimes || [])) {
                const dte = new Date();
                if (Number(stEle.scheduleTime?.getTime?.()) > dte.getTime() && stEle.scheduleStatus === "Scheduled") {
                    newDt['schedule'] = stEle;
                }
            }
            withSchduleTime.push(newDt);
        }

        return reply.send(withSchduleTime);
    });

    // Read single ATS
    fastify.get('/:id', async (req, reply) => {
        const { id } = req.params;

        // support both ?fields=stageResults and object-style fields
        const includeStageResults =
            typeof req.query?.fields === 'string'
                ? req.query.fields.includes('stageResults')
                : (req.query?.fields && 'stageResults' in (req.query?.fields || {}));

        const res = await svc.getATSDetails({ id, includeStageResults }, req.user, req.client, req.conn);
        if (!res?.ok) return reply.code(res?.code || 400).send({ error: res?.message || 'Failed' });

        // keep previous output (raw ATS doc)
        return reply.send(res.details.ats);
    });

    // Update a single StageResult inside an ATS
    fastify.put('/:atsId/stageresult/:srId', async (req, reply) => {
        const { atsId, srId } = req.params;
        const { stageStatus = '', remarkOrFeedback = '' } = req.body || {};

        const res = await svc.updateStageResult({ atsId, srId, stageStatus, remarkOrFeedback }, req);
        return reply.code(res?.code || (res?.ok ? 200 : 400)).send(res?.ok ? { ok: true } : { error: res?.message });
    });
}




// // Code block For reset Candidate Stage-Result

// console.log(
//     "Candidate Stage-Result reset began..."
// );


// const dbName = "ApplyCup"; // prod
// const client = "687fbd6c09e0ea9f448b3303"; // prod

// // const dbName = "Applycup"; // dev
// // const client = "68833f8c143e974c02e3cf23"; // dev

// getClientDbConn(dbName)
//     .then(async clientConn => {


//         const extraFilter = {};

//         // const startOfToday = new Date();
//         // startOfToday.setHours(0, 0, 0, 0);  // 00:00:00.000

//         // const endOfToday = new Date();
//         // endOfToday.setHours(23, 59, 59, 999);  // 23:59:59.999

//         // extraFilter.createdAt = {
//         //     $gte: startOfToday,
//         //     $lte: endOfToday
//         // };




//         const activeCandATSCount = await clientConn.models['CandidateATS'].countDocuments({ ...extraFilter, isArchived: false }).exec();

//         console.log(
//             "activeCandATSCount: ", activeCandATSCount,
//         );

//         let loopCount = 0;

//         const execLimit = activeCandATSCount <= 40 ? activeCandATSCount : 40;

//         let whileCount = activeCandATSCount;

//         const cachedStgRes = {};
//         const cachedOldStgRes = {};

//         try {
//             while (whileCount > 0) {

//                 let allCandATS = await clientConn.models['CandidateATS'].find({ ...extraFilter, isArchived: false }).skip(execLimit * loopCount).limit(execLimit).exec();

//                 allCandATS?.length !== execLimit && console.log(
//                     "allCandATS?.length: ", allCandATS?.length,
//                 );

//                 let collToBeUpdated = [];

//                 for (const candATS of allCandATS) {
//                     console.log("Updating ATS: ", candATS._id);
//                     try {

//                         let updated;
//                         let srRes;
//                         let newStgRes = [];
//                         for (const srId of candATS.stageResults) {

//                             if (`${srId}` in cachedOldStgRes) {
//                                 srRes = cachedOldStgRes[srId];
//                             } else {
//                                 srRes = await clientConn.models['StageResult'].findById(srId?._id || srId).lean().exec();
//                                 cachedOldStgRes[srId] = srRes;
//                             }

//                             if (`${srRes.stage}` in cachedStgRes) {
//                                 updated = cachedStgRes[`${srRes.stage}`];

//                             } else {
//                                 updated = await clientConn.models['StageResult'].findOrCreate(srRes.stage, "Not Initiated", "", { conn: clientConn, client });

//                                 cachedStgRes[`${srRes.stage}`] = updated;
//                             }

//                             if (updated) {
//                                 newStgRes.push(updated._id);
//                             } else {
//                                 newStgRes.push(srId);
//                             }

//                         }

//                         // console.log(
//                         //     "1. newStgRes: ", candATS.stageResults,
//                         // );

//                         // candATS.stageResults = newStgRes;
//                         // await candATS.save();


//                         collToBeUpdated.push({
//                             updateOne: {
//                                 filter: {
//                                     _id: candATS._id,
//                                     client,
//                                 },
//                                 update: {
//                                     stageResults: newStgRes
//                                 }

//                             }
//                         });


//                         // console.log(
//                         //     "2. newStgRes: ", newStgRes,
//                         // );

//                     } catch (err) {
//                         console.log(
//                             "❌ Error in updating function's call: ", err
//                         );
//                         continue;

//                     }
//                 }


//                 if (collToBeUpdated?.length) {

//                     let res = await clientConn.models['CandidateATS'].bulkWrite(collToBeUpdated);

//                     console.log(
//                         "CandidateATS bulkWrite res: ", res
//                     );

//                 }


//                 whileCount = whileCount - execLimit;
//                 loopCount++;

//                 console.log(
//                     "\n Remaining Docs: ", whileCount,
//                     "\n Loop(s) done: ", loopCount,
//                 );


//             }
//             console.log(
//                 "\n Candidate ATS reset Completed Successfully...\n", cachedStgRes, "\n"
//             );

//         } catch (err) {
//             console.log(
//                 "❌ Error in correcting candidate ATS: ", err
//             );

//         }





//     })
//     .catch((err) => {
//         console.log(
//             "❌ Error in correcting Candidate ATS's Stage Results db connection: ", err
//         );

//     })
//     .finally(() => {
//         console.log(
//             "\n Stage Results reset of Candidate ATS is finished...\n\n"
//         );

//     });
