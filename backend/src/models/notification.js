import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Types.ObjectId,
            ref: 'User',
            index: true,
            default: null
        },

        client: {
            type: mongoose.Types.ObjectId,
            ref: 'User',
            index: true,
            default: null
        },

        // ✉️ Email-style envelope fields for richer UI
        subject: {
            type: String,
            trim: true,
            maxlength: 512,
            default: null,
        },

        from: {
            type: String,
            trim: true,
            maxlength: 512,
            default: null,
        },

        to: {
            type: String,
            trim: true,
            maxlength: 512,
            default: null,
        },

        // Short preview line shown in list view
        snippet: {
            type: String,
            trim: true,
            maxlength: 2000,
            default: null,
        },

        // Main body text of the notification (still required)
        content: {
            type: String,
            required: [true, 'Notification content is required'],
            trim: true,
            minlength: [1, 'Notification content cannot be empty'],
            maxlength: [5000, 'Notification content too long'],
        },

        source: {
            type: String,
            trim: true,
            maxlength: 256,
            default: 'system',
        },

        occurredAt: {
            type: Date,
            default: () => new Date(),
            index: true,
        },

        isRead: { type: Boolean, default: false, index: true },
        isArchived: { type: Boolean, default: false, index: true },

        // Optional link target, icon hint, and any other payload
        href: { type: String, trim: true, default: null },
        icon: { type: String, trim: true, default: null }, // e.g., 'info', 'warning'
        category: { type: String, trim: true, default: null },

        meta: {
            type: Object,
            default: {},
        },
    },
    { timestamps: true }
);

NotificationSchema.index({ client: 1, user: 1, isArchived: 1, isRead: 1, occurredAt: -1 });
NotificationSchema.index({ client: 1, isArchived: 1, occurredAt: -1 });

/**
 * Auto-derive email-like fields so the UI always has what it needs.
 * Works even if docs are created directly via the model (not only via service).
 */
NotificationSchema.pre('validate', function (next) {
    try {
        const contentStr =
            typeof this.content === 'string' ? this.content : '';

        // Subject: first line / truncated
        if (!this.subject && contentStr) {
            const firstLine = contentStr.split('\n')[0].trim();
            this.subject = firstLine.slice(0, 160) || null;
        }

        // Snippet: collapsed body preview
        if (!this.snippet && contentStr) {
            const collapsed = contentStr.replace(/\s+/g, ' ').trim();
            this.snippet = collapsed.slice(0, 240) || null;
        }

        // From: meta.from → source → fallback label
        if (!this.from) {
            this.from =
                (this.meta && this.meta.from) ||
                this.source ||
                'Notification';
        }

        // To: meta.to → generic "You"
        if (!this.to) {
            this.to = (this.meta && this.meta.to) || 'You';
        }

        try {
            next?.();
        } catch (err) {
            console.log(
                "Error in next step of notification validate: ", (err?.message || err)
            );

        }
    } catch (err) {
        try {
            next?.(err);
        } catch (err) {
            console.log(
                "Error in next step of notification validate: ", (err?.message || err)
            );

        }
    }
});

export default NotificationSchema;
