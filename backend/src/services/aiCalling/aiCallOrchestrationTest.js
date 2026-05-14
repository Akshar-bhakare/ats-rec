
// Call Trigger from like plivo

// Call audio receiver from like plivo

// STT worker

// AI Agent

// TTS worker

// Call audio sender to like plivo

// AiCallManager - who manage's this all


import { assistant, user } from "@openai/agents";
import { getClientDbConn } from "../../utils/clientDbUtils.js";
import { AiCallManager, withTime } from "./aiCallOrchestrationV2.js";
import universalTextToSpeech from "../../utils/googleTTSAndSTTUtils.js";

// For testing purpose

console.log(
    AiCallManager.name + " Testing began..."
);


// const dbName = "ApplyCup"; // prod
// const client = "687fbd6c09e0ea9f448b3303"; // prod

const dbName = "ApplyCup"; // dev
const client = "68f088f37ee45d1d618c40b1"; // dev

const Cand_Job_cache = {
    candidateId: "68f090ea53259c427fef1828",
    jobId: "68f0907653259c427fef17f5", // Full stack developer
};

getClientDbConn(dbName)
    .then(async clientConn => {
        clientConn
        const req = {
            client,
            dbName,
            conn: clientConn,
            query: { callUUID: 'call_simulation' },
        };
        req["user"] = await clientConn.models['User'].findById(client).lean().exec();

        const testReply = { code: (code) => console.log("\n[AI Call Test Simulator] ReplyCode: ", code) || { send: (dt) => console.log("\n[AI Call Test Simulator] ReplyCodeSend: ", dt) }, send: (dt) => console.log("\n[AI Call Test Simulator] ReplySend: ", dt) }

        const aiCallObj = new AiCallManager();

        const getAudioBuffer = async (text) => {
            return await universalTextToSpeech(
                text,
                aiCallObj.script?.language || 'en-IN',
                aiCallObj.script?.gender || 'FEMALE',
                aiCallObj.script?.voiceModel || 'en-IN-Chirp-HD-F',
                AiCallManager.audioEncoding,
                AiCallManager.audioSampleHtz,
                AiCallManager.speakingRate,
            )
        }

        const initRes = await aiCallObj.init(Cand_Job_cache?.candidateId, Cand_Job_cache?.jobId, req);
        console.log(
            "\n[AI Call Test Simulator] initRes: ", initRes
        );

        aiCallObj.callUUID = 'call_simulation';

        await aiCallObj.initiateConversation();

        console.log(
            "\n[AI Call Test Simulator] 1) JSON.stringify(aiCallObj.classLevelConv?.messages): ", JSON.stringify(aiCallObj.classLevelConv?.messages)
        );


        if ((aiCallObj?.classLevelConv?.messages || [])?.length > 0) {

            // if (!aiCallObj.classLevelConv.messages.map(ele => ele?.role).includes("user")) {
            //     aiCallObj.classLevelConv.messages.push(withTime(user, "Yes..."));
            // }




            // // console.log("\n[AI Call Test Simulator] Normal AI response testing...");
            // // const firstConvRes_ = await aiCallObj.generateOpenAIResponse(aiCallObj.classLevelConv);
            // // const firstConvRes = firstConvRes_?.replaceAll?.(AiCallManager.sentencesSeparator, "")?.trim?.();
            // // console.log(
            // //     "\n[AI Call Test Simulator] firstConvRes: ", firstConvRes
            // // );

            // // firstConvRes && aiCallObj.classLevelConv.messages.push(withTime(assistant, firstConvRes));




            // console.log("\n[AI Call Test Simulator] Streaming AI response testing...");

            // let cnt = 0;
            // for await (const assistantRes of aiCallObj.generateOpenAIResponseStream(aiCallObj.classLevelConv)) {
            //     console.log(
            //         "\n", ++cnt + ") 1st assistantRes: ", assistantRes, "\n",
            //     );

            //     aiCallObj.classLevelConv.messages.push(withTime(assistant, assistantRes));
            // };

            // aiCallObj.classLevelConv.messages.push(withTime(user, "What is current time?"));

            // cnt = 0;
            // for await (const assistantRes of aiCallObj.generateOpenAIResponseStream(aiCallObj.classLevelConv)) {
            //     console.log(
            //         "\n", ++cnt + ") 2nd assistantRes: ", assistantRes, "\n",
            //     );

            //     aiCallObj.classLevelConv.messages.push(withTime(assistant, assistantRes));
            // };


            // aiCallObj.classLevelConv.messages = aiCallObj?.classLevelConv?.messages?.filter?.(ele => Boolean(ele?.content)) || [];

            // await req.conn.models['Conversation'].updateOne(
            //     { _id: aiCallObj.classLevelConv?._id },
            //     { messages: aiCallObj.classLevelConv.messages }
            // )





            console.log("\n[AI Call Test Simulator] Streaming Recognise testing...");

            await aiCallObj.ensureRealtimeTranscriber({ waitForReady: true });

            const yesBuffer = await getAudioBuffer("Yes...");
            aiCallObj.sttEngine?.write(yesBuffer);
            aiCallObj.sttEngine?.write(yesBuffer);

            // Constant streaming required, how we get that, may be silent interval needed...

            // const currentTimeBuffer = await getAudioBuffer("What is current time?");

        } else {
            console.log(
                "\n[AI Call Test Simulator] ❌ Error: aiCallObj.classLevelConv: ", aiCallObj.classLevelConv
            );

        }


        // await aiCallObj.aiCallTriggerer(Cand_Job_cache?.candidateId, Cand_Job_cache?.jobId, req, testReply);

        // await myRes("Yes, but can we talk after 7 pm today", aiCallObj);

    })
    .catch((err) => {
        console.log(
            "\n[AI Call Test Simulator] ❌ Error in " + AiCallManager.name + "  Testing: ", err
        );

    })
    .finally(() => {
        console.log(
            "\n[AI Call Test Simulator] " + AiCallManager.name + "  Testing is finished...\n\n"
        );

    });
