import dotenv from 'dotenv';
import mongoose from 'mongoose';

import CandidateSchema from '../models/candidate.js';
import ClientAdminSchema from '../models/clientAdmin.js';
import CompanySchema from '../models/company.js';
import ConversationSchema from '../models/conversation.js';
import UserSchema, { UsersClientSchema } from '../models/user.js';
import EventSchema, { EventNameSchema } from '../models/event.js';
import JobSchema from '../models/job.js';
import ScriptSchema from '../models/script.js';
import SettingSchema from '../models/setting.js';
import StageSchema from '../models/stage.js';
import RecruiterSchema from '../models/recruiter.js';
import CandidateATSSchema, { StageResultSchema } from '../models/candidateATS.js';
import NotificationSchema from '../models/notification.js';
import NotificationPreferenceSchema from '../models/notificationPreference.js';
import EmailTemplateSettingSchema from '../models/emailTemplateSetting.js';
import RelevancyRecordSchema from '../models/RelevancyRecord.js';
import { DemoLeadsSchema } from '../models/demoLeads.js';
import DemoMeetingTeamMemberSchema from '../models/DemoMeetingTeamMember.js';
import DemoScheduledMeetingSchema from '../models/DemoScheduledMeeting.js';
import { BooleanSearchFeedbackSchema } from '../models/feedbackModels.js';
import { WhatsAppMessageSchema } from '../models/whatsAppMessage.js';
import InterviewScheduleSchema from '../models/VirtualInterview/InterviewSchedule.js';
import WebRTCSessionEventSchema from '../models/VirtualInterview/WebRTCSessionEvent.js';
import InterviewChatSchema from '../models/VirtualInterview/InterviewChat.js';
import InterviewerPreferenceSchema from '../models/VirtualInterview/InterviewerPreference.js';
import FinalizationJobSchema from '../models/VirtualInterview/FinalizationJob.js';
import InboundCallScriptSchema from '../models/inboundCallScript.js';
import InboundLeadSchema from '../models/inboundLead.js';
import ProblemSchema from '../models/codeJudge/problem.js';

import TestCaseSchema from '../models/codeJudge/testCase.js';
import SubmissionSchema from '../models/codeJudge/submission.js';
import SubmissionResultSchema from '../models/codeJudge/submissionResult.js';

dotenv.config();

const connections = {};

const DEFAULT_DB_NAME = process.env.DEFAULT_DB_NAME

if (!DEFAULT_DB_NAME || !process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');

/**
 * Registers all models on a given tenant connection (if not already registered)
 */
export const registerModels = (conn) => {
    if (!conn.models['Candidate']) conn.model('Candidate', CandidateSchema);
    if (!conn.models['Recruiter']) conn.model('Recruiter', RecruiterSchema);
    if (!conn.models['Company']) conn.model('Company', CompanySchema);
    if (!conn.models['Conversation']) conn.model('Conversation', ConversationSchema);
    if (!conn.models['EventName']) conn.model('EventName', EventNameSchema);
    if (!conn.models['Event']) conn.model('Event', EventSchema);
    if (!conn.models['Job']) conn.model('Job', JobSchema);
    if (!conn.models['Script']) conn.model('Script', ScriptSchema);
    if (!conn.models['Setting']) conn.model('Setting', SettingSchema);
    if (!conn.models['Stage']) conn.model('Stage', StageSchema);
    if (!conn.models['StageResult']) conn.model('StageResult', StageResultSchema);
    if (!conn.models['CandidateATS']) conn.model('CandidateATS', CandidateATSSchema);
    if (!conn.models['User']) conn.model('User', UserSchema);
    if (!conn.models['Notification']) conn.model('Notification', NotificationSchema);
    if (!conn.models['NotificationPreference']) conn.model('NotificationPreference', NotificationPreferenceSchema);
    if (!conn.models['EmailTemplateSetting']) conn.model('EmailTemplateSetting', EmailTemplateSettingSchema);
    if (!conn.models['RelevancyRecord']) conn.model('RelevancyRecord', RelevancyRecordSchema);
    if (!conn.models['WhatsAppMessage']) conn.model('WhatsAppMessage', WhatsAppMessageSchema);
    if (!conn.models['InterviewSchedule']) conn.model('InterviewSchedule', InterviewScheduleSchema);
    if (!conn.models['WebRTCSessionEvent']) conn.model('WebRTCSessionEvent', WebRTCSessionEventSchema);
    if (!conn.models['InterviewChat']) conn.model('InterviewChat', InterviewChatSchema);
    if (!conn.models['InterviewerPreference']) conn.model('InterviewerPreference', InterviewerPreferenceSchema);
    if (!conn.models['FinalizationJob']) conn.model('FinalizationJob', FinalizationJobSchema);
    if (!conn.models['InboundCallScript']) conn.model('InboundCallScript', InboundCallScriptSchema);
    if (!conn.models['InboundLead']) conn.model('InboundLead', InboundLeadSchema);
    // Code Judge Models

    if (!conn.models['Problem']) conn.model('Problem', ProblemSchema);
    if (!conn.models['TestCase']) conn.model('TestCase', TestCaseSchema);
    if (!conn.models['Submission']) conn.model('Submission', SubmissionSchema);
    if (!conn.models['SubmissionResult']) conn.model('SubmissionResult', SubmissionResultSchema);
};


/**
 * Resolves or creates a Mongoose connection to the specified tenant database
 * @param {string} dbName - The tenant's database name
 * @returns {Promise<mongoose.Connection>}
 */
export const getClientDbConn = async (dbName, connParams = {}) => {
    const existingConn = connections[dbName];
    if (existingConn) {
        if (process.env.NODE_ENV === "development") {
            await existingConn?.close?.();
        } else {
            return existingConn;
        }
    }

    const uri = process.env.MONGODB_URI;
    let conn;
    try {
        conn = mongoose.createConnection(uri, {
            serverApi: { version: '1', strict: false, deprecationErrors: true },
            ...connParams,
            dbName,
            maxIdleTimeMS: 10 * 1000,
        });

        await conn.asPromise();

        registerModels(conn);
        if (dbName === DEFAULT_DB_NAME) {
            if (!conn.models['ClientAdmin']) conn.model('ClientAdmin', ClientAdminSchema);
            if (!conn.models['UsersClient']) conn.model('UsersClient', UsersClientSchema);
            if (!conn.models['DemoLeads']) conn.model('DemoLeads', DemoLeadsSchema);
            if (!conn.models['DemoMeetingTeamMember']) conn.model('DemoMeetingTeamMember', DemoMeetingTeamMemberSchema);
            if (!conn.models['DemoScheduledMeeting']) conn.model('DemoScheduledMeeting', DemoScheduledMeetingSchema);
            if (!conn.models['BooleanSearchFeedback']) conn.model('BooleanSearchFeedback', BooleanSearchFeedbackSchema);
        }
        console.log("✅ Connected to DB:", dbName);

        conn.on('error', (err) => {
            console.log('❌ MongoDB connection creation with ' + dbName + ' error:', err);
            if (connections[dbName] === conn) {
                delete connections[dbName];
            }
        });

        conn.on('disconnected', () => {
            console.log("ℹ️ Disconnected from DB:", dbName);
            if (connections[dbName] === conn) {
                delete connections[dbName];
            }
        });

        conn.on('close', () => {
            console.log("ℹ️ DB connection closed:", dbName);
            if (connections[dbName] === conn) {
                delete connections[dbName];
            }
        });

        connections[dbName] = conn;
        return conn;
    } catch (err) {

        console.log(
            "\n\n❌ getClientDbConn:: Error in db conn creation: ", err, "\n\n"
        );

        if (conn) {
            try {
                await conn?.close?.();
            } catch {
                // swallow secondary errors while closing failed connection
            }
        }
        throw err;
    }
};

const globalDbConn = await getClientDbConn(DEFAULT_DB_NAME);

export const resolveDbNameByClientId = async (clientUserId) => {

    let clientData = await globalDbConn.models['ClientAdmin'].findOne({ user: clientUserId }).lean().exec();
    return clientData.clientCompany;

}

export const resolveDbNameByEmail = async (email) => {
    let usrLogin = await globalDbConn.models['UsersClient'].findOne({ email }).lean().exec();
    return resolveDbNameByClientId(usrLogin.client);

}

export const getDBNameByEmail = async (email) => {

    let usrLoginData = await globalDbConn.models['User'].findOne({ email }).lean().exec();
    let dbName = DEFAULT_DB_NAME;
    try {

        if ((usrLoginData && !['ultra_admin'].includes(usrLoginData.role)) || !usrLoginData) {
            dbName = await resolveDbNameByEmail(email);
        }

    } catch (err) {
        console.log(
            "Error in getting db name by email: ", err?.message || err
        );

    }

    return dbName;
}
