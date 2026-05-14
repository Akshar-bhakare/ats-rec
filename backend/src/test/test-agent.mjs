import 'dotenv/config';
import mongoose from 'mongoose';
import CompanySchema from '../models/company.js';
import { runCompanyAgent } from '../ai/companyAgent.js';

const { MONGODB_URI, DEFAULT_DB_NAME, TEST_CLIENT_ID, TEST_USER_ID } = process.env;
if (!MONGODB_URI) { console.error('Missing MONGODB_URI'); process.exit(1); }

console.log('[test] connecting to Mongo...');
await mongoose.connect(MONGODB_URI, { dbName: DEFAULT_DB_NAME || 'AiSelecktDev' });

if (!mongoose.models.Company) {
    mongoose.model('Company', CompanySchema);
}

const isHex24 = v => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v);
const oid = v => new mongoose.Types.ObjectId(isHex24(v) ? v : '507f1f77bcf86cd799439011');

const req = {
    conn: mongoose.connection,
    client: oid(TEST_CLIENT_ID),
    user: { _id: oid(TEST_USER_ID || '507f1f77bcf86cd799439012') }
};

console.log('[test] req keys:', {
    hasConn: !!req.conn, state: mongoose.connection.readyState,
    client: String(req.client), user: String(req.user._id)
});

const query = process.argv.slice(2).join(' ')
    || 'Create a company called Nimbus Labs in SaaS, size 50–200, website https://nimbus.io. About: AI for operations.';

console.log('[test] running agent on query:', query);
const { output, trace } = await runCompanyAgent({ req, query, context: null, temperature: 0 });

console.log('[test] OUTPUT:\n', JSON.stringify(output, null, 2));
console.log('[test] STEPS:', (trace || []).length);

await mongoose.disconnect();
console.log('[test] disconnected.');
