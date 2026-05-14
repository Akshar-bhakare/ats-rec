import { getClientDbConn } from "../utils/clientDbUtils.js";

class EventService {

    /**
     * Log an event and return both:
     *  - nameDoc: the UserEventName entry
     *  - evt: the timestamped Event
     */
    async log(userId, event_name, req) {
        const nameDoc = await req.conn.models['EventName'].findOrCreate(userId, event_name);
        const evt = await req.conn.models['Event'].findOrCreate(nameDoc._id, new Date(Math.floor(Date.now() / 60000) * 60000), false, req.client);
        return { nameDoc, evt };
    }
}


// // For testing

// console.log(
//     "EventName update began..."
// );


// // const dbName = "ApplyCup"; // prod
// // const client = "687fbd6c09e0ea9f448b3303"; // prod

// const dbName = "Applycup"; // dev
// const client = "68833f8c143e974c02e3cf23"; // dev

// getClientDbConn(dbName)
//     .then(async clientConn => {

//         // Script content Updater 
//         const extraFilter = {};

//         // const startOfToday = new Date();
//         // startOfToday.setHours(0, 0, 0, 0);  // 00:00:00.000

//         // const endOfToday = new Date();
//         // endOfToday.setHours(23, 59, 59, 999);  // 23:59:59.999

//         // extraFilter.createdAt = {
//         //     $gte: startOfToday,
//         //     $lte: endOfToday
//         // };

//         const activeEventNameCount = await clientConn.models['EventName'].countDocuments({ ...extraFilter }).exec();

//         console.log(
//             "activeEventNameCount: ", activeEventNameCount,
//         );

//         let loopCount = 0;

//         const execLimit = activeEventNameCount <= 100 ? activeEventNameCount : 100;

//         let whileCount = activeEventNameCount;

//         try {
//             while (whileCount > 0) {

//                 let allEvNms = await clientConn.models['EventName'].find({ ...extraFilter }).skip(execLimit * loopCount).limit(execLimit).lean().exec();

//                 allEvNms?.length !== execLimit && console.log(
//                     "allEvNms?.length: ", allEvNms?.length,
//                     // "Object.keys(allEvNms[0]): ", Object.keys(allEvNms[0]),
//                 );

//                 let collToBeUpdated = [];

//                 for (const evNme of allEvNms) {
//                     console.log("Updating from evNme: ", evNme._id);
//                     try {
//                         console.log(
//                             "\n evNme: ", evNme,
//                             "\n evNme?.eventName: ", evNme?.eventName,
//                         );
                        
//                         evNme?.eventName && collToBeUpdated.push({
//                             updateOne: {
//                                 filter: {
//                                     _id: evNme._id,
//                                 },
//                                 update: {
//                                     $set: {
//                                         name: evNme?.eventName,
//                                     },
//                                     $unset: {
//                                         eventName: "",
//                                     },
//                                 }

//                             }
//                         });

//                     } catch (err) {
//                         console.log(
//                             "❌ Error in updating function's call: ", err
//                         );
//                         continue;

//                     }
//                 }

//                 if (collToBeUpdated?.length) {

//                     let res = await clientConn.models['EventName'].bulkWrite(collToBeUpdated);

//                     console.log(
//                         "EventName bulkWrite res: ", res
//                     );

//                 }

//                 whileCount = whileCount - execLimit;
//                 loopCount++;

//                 console.log(
//                     "\n whileCount: ", whileCount,
//                     "\n loopCount: ", loopCount,
//                 );


//             }
//             console.log(
//                 "\n EventName updating Completed Successfully...\n\n"
//             );

//         } catch (err) {
//             console.log(
//                 "❌ Error in Updating EventName: ", err
//             );

//         }



//     })
//     .catch((err) => {
//         console.log(
//             "❌ Error in getting EventName(s): ", err
//         );

//     })
//     .finally(() => {
//         console.log(
//             "\n Updating EventName(s) is finished...\n\n"
//         );
//     });


export default EventService;
