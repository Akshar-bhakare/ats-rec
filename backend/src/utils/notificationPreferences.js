export const DEFAULT_NOTIFICATION_PREFERENCES = {
    channels: {
        email: true,
        inApp: true,
        whatsapp: true
    },
    hiringActivity: {
        newCandidate: true,
        candidateStageUpdated: true,
        interviewScheduled: true,
        interviewFeedbackSubmitted: true,
        candidateArchived: true
    },
    systemAccount: {
        billingInvoiceUpdates: true,
        subscriptionChanges: true
    }
};

const normalizeSection = (incoming, defaults) => {
    const output = { ...defaults };
    const source = incoming && typeof incoming === 'object' ? incoming : {};
    Object.keys(defaults).forEach((key) => {
        if (typeof source[key] === 'boolean') {
            output[key] = source[key];
        }
    });
    return output;
};

export const mergeNotificationPreferences = (incoming = {}) => {
    return {
        channels: normalizeSection(incoming.channels, DEFAULT_NOTIFICATION_PREFERENCES.channels),
        hiringActivity: normalizeSection(incoming.hiringActivity, DEFAULT_NOTIFICATION_PREFERENCES.hiringActivity),
        systemAccount: normalizeSection(incoming.systemAccount, DEFAULT_NOTIFICATION_PREFERENCES.systemAccount)
    };
};

export const getNotificationPreferences = async (req, options = {}) => {
    const { createIfMissing = false } = options || {};
    try {
        const Model = req?.conn?.models?.NotificationPreference;
        if (!Model || !req?.client) {
            return mergeNotificationPreferences();
        }

        let doc = await Model.findOne({ client: req.client }).lean().exec();
        if (!doc && createIfMissing) {
            const created = await Model.create({ client: req.client });
            doc = created?.toObject ? created.toObject() : created;
        }

        return mergeNotificationPreferences(doc);
    } catch (err) {
        console.warn('Failed to load notification preferences', err?.message || err);
        return mergeNotificationPreferences();
    }
};

export const isInAppNotificationEnabled = (prefs, key) => {
    const merged = mergeNotificationPreferences(prefs);
    if (!merged.channels.inApp) return false;
    if (!key) return true;
    const [group, field] = String(key || '').split('.');
    if (group && field && merged[group] && typeof merged[group][field] === 'boolean') {
        return merged[group][field];
    }
    return true;
};
