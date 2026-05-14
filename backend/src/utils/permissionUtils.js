export const hasEntityAccess = (user, entity) => {
    if (!user) return false;
    const role = user?.role;
    if (role === 'ultra_admin' || role === 'client_admin') return true;
    const access = user?.accessRestrictions || {};
    return access?.[entity] !== false;
};

export const requirePermission = (entity, allowedRoles = ['ultra_admin', 'client_admin', 'recruiter']) =>
    async (req, reply) => {
        const role = req.user?.role;
        if (Array.isArray(allowedRoles) && allowedRoles.length && !allowedRoles.includes(role)) {
            return reply.code(403).send({ ok: false, code: 403, message: 'Forbidden' });
        }

        if (hasEntityAccess(req.user, entity)) return;
        return reply.code(403).send({ ok: false, code: 403, message: 'Forbidden' });
    };
