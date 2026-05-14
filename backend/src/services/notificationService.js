import mongoose from 'mongoose';
import CRUDService from './crudBase.js';

export default class NotificationService extends CRUDService {
    constructor() {
        super('Notification');
    }

    async createNotification(payload, req) {
        try {
            const createdBy = req?.user?._id || req?.user?.sub || null;
            const Model = req.conn.models[this.ModelName];
            const doc = await Model.create({
                ...payload,
                user: payload?.user ?? createdBy ?? null,
                client: req.client,
                occurredAt: payload?.occurredAt || new Date(),
            });
            console.log('✅ Notification stored in DB:', doc._id);
            return { ok: true, code: 201, details: { notification: doc } };
        } catch (err) {
            console.error('❌ Failed to create notification:', err.message);
            return {
                ok: false,
                code: err?.code || 400,
                message: err?.message || 'Failed to create notification',
                details: err?.errors && Object.values(err.errors).map(e => e.message),
            };
        }
    }

    async createManyNotifications(payloadArray, req) {
        try {
            const items = Array.isArray(payloadArray) ? payloadArray : [];
            if (!items.length) return { ok: false, code: 400, message: 'Payload must be a non-empty array' };

            const mapped = items.map(p => ({
                ...p,
                user: p?.user ?? (req?.user?._id || req?.user?.sub || null),
                client: req.client,
                occurredAt: p?.occurredAt || new Date(),
            }));

            const Model = req.conn.models[this.ModelName];
            const inserted = await Model.insertMany(mapped, { ordered: false });
            console.log(`✅ Bulk inserted ${inserted.length} notifications.`);
            return { ok: true, code: 201, details: { count: inserted.length, notifications: inserted } };
        } catch (err) {
            console.error('❌ Bulk notification insert failed:', err.message);
            return { ok: false, code: 400, message: err?.message || 'Failed to bulk create notifications' };
        }
    }

    async getNotifications(query, req) {
        const {
            isRead, isArchived = 'false', source, q, from, to, userId,
            limit = 50, skip = 0, fields, sort = '-occurredAt'
        } = query || {};

        const filter = { client: req.client, isArchived: String(isArchived) === 'true' };
        if (userId && mongoose.Types.ObjectId.isValid(userId)) filter.user = userId;
        else if (req.user) filter.user = req.user._id || req.user.sub || null;

        if (['true', 'false'].includes(String(isRead))) filter.isRead = String(isRead) === 'true';
        if (source) filter.source = source;
        if (q) filter.content = { $regex: String(q).trim(), $options: 'i' };
        if (from || to) {
            filter.occurredAt = {};
            if (from) filter.occurredAt.$gte = new Date(from);
            if (to) filter.occurredAt.$lte = new Date(to);
        }

        const projection = fields
            ? String(fields).split(',').map(s => s.trim()).filter(Boolean).join(' ')
            : undefined;

        const Model = req.conn.models[this.ModelName];
        const items = await Model.find(filter, projection)
            .sort(sort)
            .skip(parseInt(skip) || 0)
            .limit(Math.min(parseInt(limit) || 50, 200))
            .lean();

        console.log(`📬 Retrieved ${items.length} notifications from DB`);
        return { ok: true, code: 200, items };
    }

    async getNotification(id, req) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return { ok: false, code: 400, message: 'Invalid notification ID' };
        }

        const doc = await this.readById(id, req);
        if (!doc) {
            return { ok: false, code: 404, message: 'Not found' };
        }

        return { ok: true, code: 200, details: { notification: doc } };
    }

    async markRead(id, read, req) {
        if (!mongoose.Types.ObjectId.isValid(id)) return { ok: false, code: 400, message: 'Invalid notification ID' };
        const updated = await this.update(id, { isRead: !!read }, req);
        if (updated) console.log(`📖 Notification ${id} marked as read`);
        return updated
            ? { ok: true, code: 200, details: { updated } }
            : { ok: false, code: 404, message: 'Not found' };
    }

    async markAllRead(query, req) {
        const Model = req.conn.models[this.ModelName];
        const { userId } = query || {};
        const filter = { client: req.client, isArchived: false, isRead: false };
        filter.user = userId && mongoose.Types.ObjectId.isValid(userId)
            ? userId
            : (req.user?._id || req.user?.sub || null);
        const res = await Model.updateMany(filter, { $set: { isRead: true } });
        console.log(`📘 Marked ${res.modifiedCount} notifications as read`);
        return { ok: true, code: 200, details: { matched: res.matchedCount, modified: res.modifiedCount } };
    }

    async archive(id, archive, req) {
        if (!mongoose.Types.ObjectId.isValid(id)) return { ok: false, code: 400, message: 'Invalid notification ID' };
        const updated = await this.update(id, { isArchived: !!archive }, req);
        console.log(`🗄️ Notification ${id} archived=${!!archive}`);
        return updated
            ? { ok: true, code: 200, details: { updated } }
            : { ok: false, code: 404, message: 'Not found' };
    }
}
