import dotenv from 'dotenv';

import { getClientDbConn } from './clientDbUtils.js';


dotenv.config();

export const isAICallCreditsExausted = async (req) => {

    if (!req || !req.user) {
        console.warn("[AICallCredits] Missing req/user; defaulting to not exhausted.");
        return false;
    }

    const roleForOwnership = req.user?.originalRole || req.user?.role;

    if (!roleForOwnership) {
        console.warn("[AICallCredits] Missing user role; defaulting to not exhausted.", {
            userId: req.user?._id || req.user?.sub
        });
        return false;
    }

    if (roleForOwnership === "ultra_admin") return false;

    const clientAdminUserId =
        roleForOwnership === "client_admin"
            ? (req.user._id || req.user.sub)
            : req.user.client;
    if (!clientAdminUserId) {
        console.warn("[AICallCredits] Missing client admin user id; defaulting to not exhausted.", {
            role: roleForOwnership
        });
        return false;
    }

    let globalConn;
    try {
        globalConn = await getClientDbConn(process.env.DEFAULT_DB_NAME);
    } catch (err) {
        console.error("[AICallCredits] Failed to get DB connection; defaulting to not exhausted.", {
            error: err?.message || err
        });
        return false;
    }

    let clientAdminDoc;
    try {
        clientAdminDoc = await globalConn.models.ClientAdmin
            .findOne(
                { user: clientAdminUserId, isArchived: false }
            ).lean().exec();
    } catch (err) {
        console.error("[AICallCredits] Failed to fetch client admin doc; defaulting to not exhausted.", {
            error: err?.message || err
        });
        return false;
    }

    if (!clientAdminDoc) {
        console.warn("[AICallCredits] Client admin not found; defaulting to not exhausted.", {
            clientAdminUserId
        });
        return false;
    }

    const totalCallCount = Number(clientAdminDoc.totalCallCount);
    const creditRatePerCall = Number(clientAdminDoc.creditRatePerCall);
    const totalCredit = Number(clientAdminDoc.totalCredit);

    if (!Number.isFinite(totalCallCount) || !Number.isFinite(creditRatePerCall) || !Number.isFinite(totalCredit)) {
        console.warn("[AICallCredits] Invalid credit fields; defaulting to not exhausted.", {
            totalCallCount: clientAdminDoc.totalCallCount,
            creditRatePerCall: clientAdminDoc.creditRatePerCall,
            totalCredit: clientAdminDoc.totalCredit
        });
        return false;
    }

    const usedCredits = totalCallCount * creditRatePerCall;
    if (!Number.isFinite(usedCredits)) {
        console.warn("[AICallCredits] Invalid usedCredits value; defaulting to not exhausted.", {
            usedCredits
        });
        return false;
    }

    return usedCredits >= totalCredit;

}
