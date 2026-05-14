import dotenv from 'dotenv';

import { getClientDbConn } from '../src/utils/clientDbUtils.js';
import { isAllowedCallingHourIST } from '../src/utils/timeUtils.js';
import { aiCallTriggerer } from '../src/routes/aiCallRoutes.js';
import CandidateATSService from '../src/services/candidateATSService.js';
import { isAICallCreditsExausted } from '../src/utils/aiCallCredits.js';


dotenv.config();

let globalSchedules = {
    // `${candidateId}, ${jobId}`: TimeoutId,
}

export const setGlobalSchedules = (keyValuePairs = {}) => {
    globalSchedules = {
        ...globalSchedules,
        ...keyValuePairs,
    }
}

export const getGlobalSchedulesValue = (globalScheduleKey, defaultValue = undefined) => {
    if (!(globalScheduleKey in globalSchedules || (defaultValue || defaultValue === null))) {
        throw new Error("Key not found in it [" + globalScheduleKey + "]...");
    }
    return globalSchedules?.[globalScheduleKey] || defaultValue;
}

export const deleteGlobalSchedule = (keyId) => {
    if (keyId in globalSchedules) {
        try {
            globalSchedules[keyId] && clearTimeout(globalSchedules[keyId]);
        } catch (err) {
            //
        }
        globalSchedules[keyId] = undefined;
    }
}


export const timeOutSetterForSchedulersAfterDeploy = async () => {
    console.log(
        "[AfterDeployCallScheduler] Initial Check for various campaign schedulers..."
    );

    const now = new Date();
    console.log(
        "[AfterDeployCallScheduler] now: ", now
    );

    if (process?.env?.DEFAULT_DB_NAME) {
        const globalDBConn = await getClientDbConn(process?.env?.DEFAULT_DB_NAME);

        const clientAdmins = await globalDBConn.models['ClientAdmin'].find({
            $expr: { $gt: ["$totalCredit", "$totalCallCount"] },
            isArchived: false
        })
            .select('clientCompany')
            .lean().exec() || [];


        const clientCompanies = clientAdmins?.map?.(ele => ele?.clientCompany) || [];

        console.log(
            "[AfterDeployCallScheduler] clientCompanies?.length: ", clientCompanies?.length
        );


        for (const clientDBName of clientCompanies) {
            console.log(
                "[AfterDeployCallScheduler] Current DB: ", clientDBName
            );

            const clientDBConn = await getClientDbConn(clientDBName);

            const scheduledCandidateATSs = await clientDBConn.models['CandidateATS'].find({
                scheduleTimes: { $elemMatch: { scheduleTime: { $gte: now }, scheduleStatus: "Scheduled" } },
                isArchived: false
            })
                .select('candidate job scheduleTimes eventIds')
                .populate({
                    path: 'eventIds',
                    select: 'eventAt eventName',
                    populate: {
                        path: 'eventName',
                        model: 'EventName',
                        select: 'name userId',
                        match: { 'name': "Created" }
                    }
                })
                .lean().exec();

            console.log(
                "[AfterDeployCallScheduler] scheduledCandidateATSs?.length: ", scheduledCandidateATSs?.length
            );


            for (const candAts of scheduledCandidateATSs) {
                let userId;
                for (const ele of candAts?.eventIds || []) {
                    if (ele?.eventName && ele?.eventName?.name === 'Created') {
                        userId = ele?.eventName?.userId;
                        break;
                    }
                }

                console.log(
                    "[AfterDeployCallScheduler] userId: ", userId
                );


                if (userId) {
                    const reqUser = await clientDBConn.models['User'].findById(userId).lean().exec() || {};

                    const req = {
                        user: { ...reqUser, sub: reqUser?._id },
                        conn: clientDBConn,
                        client: reqUser?.clientId || reqUser?.client || reqUser?._id,
                    }

                    // now finally schedulling will be done...
                    const candAtsSvc = new CandidateATSService();

                    console.log(
                        "\n [AfterDeployCallScheduler] candAts.scheduleTimes?.length: ", candAts.scheduleTimes?.length
                    );


                    for (const eleScheduleTime of candAts.scheduleTimes) {

                        const scheduledTime = Date.parse(eleScheduleTime?.scheduleTime);

                        if (scheduledTime >= new Date()) {
                            const callTimeOutMiliSecs = scheduledTime - Date.now();
                            const isAlreadyExistOnServer = getGlobalSchedulesValue(`${candAts?.candidate}, ${candAts?.job}`, "Not found") !== "Not found";
                            if (callTimeOutMiliSecs > 0 && !isAlreadyExistOnServer) {
                                if ((isAllowedCallingHourIST() || process?.env?.NODE_ENV === 'development') && !await isAICallCreditsExausted(req)) {
                                    let timeoutId = setTimeout(async () => {
                                        if ((isAllowedCallingHourIST() || process?.env?.NODE_ENV === 'development') && !await isAICallCreditsExausted(req)) {
                                            const dummyReply = { code: (code) => console.log("\n[AfterDeployCallScheduler] ReplyCode: ", code) || { send: (dt) => console.log("\n[AfterDeployCallScheduler] ReplyCodeSend: ", dt) }, send: (dt) => console.log("\n[AfterDeployCallScheduler] ReplySend: ", dt) }

                                            aiCallTriggerer(candAts?.candidate, candAts?.job, req, dummyReply)
                                                .then(() => {
                                                    candAts?.candidate && candAts?.job && candAts?._id && candAtsSvc.update(
                                                        candAts?._id,
                                                        {
                                                            $set: { "scheduleTimes.$.scheduleStatus": "Executed" },
                                                        },
                                                        req,
                                                        false,
                                                        false,
                                                        {
                                                            "scheduleTimes.scheduleTime": eleScheduleTime?.scheduleTime
                                                        }
                                                    );

                                                    deleteGlobalSchedule(`${candAts?.candidate}, ${candAts?.job}`);
                                                })
                                                .catch(err => {
                                                    candAts?.candidate && candAts?.job && candAts?._id && candAtsSvc.update(
                                                        candAts?._id,
                                                        {
                                                            $set: { "scheduleTimes.$.scheduleStatus": "Errored", "scheduleTimes.$.errorDetails": err },
                                                        },
                                                        req,
                                                        false,
                                                        false,
                                                        {
                                                            "scheduleTimes.scheduleTime": eleScheduleTime?.scheduleTime
                                                        }
                                                    );

                                                    deleteGlobalSchedule(`${candAts?.candidate}, ${candAts?.job}`);
                                                });

                                        } else {
                                            console.log(
                                                "❌ Candidate AI Call(" + candAts?.candidate + ") was blocked from initiation as it goes beyond time limit, we can not initiate calls after 08:00 PM, now time: " + new Date() + " Or may AI Call credits are exausted..."
                                            );
                                        }
                                    }, callTimeOutMiliSecs);

                                    setGlobalSchedules({
                                        [`${candAts?.candidate}, ${candAts?.job}`]: timeoutId
                                    });

                                } else {
                                    console.log(
                                        "❌ [AfterDeployCallScheduler] Candidate AI Call(" + candAts?.candidate + ") was blocked from initiation as it goes beyond time limit, we can not initiate calls after 08:00 PM, now time: " + new Date() + " Or may AI Call credits are exausted..."
                                    );
                                }
                            }

                        }

                    }

                } else {
                    console.log(
                        "[AfterDeployCallScheduler] User Id not found for candidateAts: ", candAts?.name || candAts?._id
                    );

                }

                // // for development
                // break;
            }

            // // for development
            // break;

        }


    } else {
        console.log(
            "[AfterDeployCallScheduler] ❌ Error: environment variable 'DEFAULT_DB_NAME' not found..."
        );

    }

    console.log(
        "\n[AfterDeployCallScheduler] Ended:: Initial Check for various campaign schedulers...\n"
    );

}
