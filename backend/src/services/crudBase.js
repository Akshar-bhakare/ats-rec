import EventService from './eventService.js';

export class CRUDService {

    /**
     * @param {import('mongoose').Model} ModelName
     */
    constructor(ModelName, connOverride = undefined) {
        this.ModelName = ModelName;
        if (connOverride) {
            this.conn = connOverride;
        }
    }

    /** Create a new document */
    async create(data, req) {

        let creRes = await (this.conn || req.conn).models[this.ModelName]
            .create({
                isArchived: false,
                ...data,
                client: req.client,
            });

        (async () => {
            if (!['Event', 'EventName'].includes(this.ModelName)) {
                try {

                    this.logger = new EventService();

                    const { evt } = await this.logger.log(
                        req?.user?._id || req?.user?.sub,
                        `Created`,
                        req
                    );

                    if (creRes.eventIds && !creRes.eventIds.includes(evt._id)) {
                        await (this.conn || req.conn).models[this.ModelName].findByIdAndUpdate(creRes._id, {
                            $addToSet: { eventIds: evt._id }
                        }).exec();
                    }

                } catch (err) {
                    console.log('❌ Error logging Create event:', err);
                }

            }

        })();

        return creRes;

    }

    async readAll(req, populateEvents = false, populationMatch = { name: 'Created' }, populateEventUserAlso = false) {
        let reaAlRes;

        if (populateEvents) {
            reaAlRes = await (this.conn || req.conn).models[this.ModelName]
                .find({ isArchived: false, client: req.client })
                .populate({
                    path: 'eventIds',
                    select: 'eventAt eventName',
                    populate: {
                        path: 'eventName',
                        model: 'EventName',
                        select: 'name userId',
                        match: populationMatch,
                        populate: populateEventUserAlso
                            ? { path: 'userId', model: 'User', select: 'firstName lastName email' }
                            : undefined,
                    }
                })
                .sort("-_id")
                .lean()
                .exec();

        } else {
            reaAlRes = await (this.conn || req.conn).models[this.ModelName]
                .find({ isArchived: false, client: req.client })
                .sort("-_id")
                .lean()
                .exec();
        }

        return reaAlRes;

    }

    async readFiltered(filter, req, populateEvents = false, populationMatch = { name: 'Created' }, populateEventUserAlso = false, projectionStr = undefined, otherPopulationsArr = undefined) {
        const fndFilter = { isArchived: false, client: req.client, ...filter };
        let populates = [];

        if (populateEvents) {
            populates.push({
                path: 'eventIds',
                select: 'eventAt eventName',
                populate: {
                    path: 'eventName',
                    model: 'EventName',
                    select: 'name userId',
                    match: populationMatch,
                    populate: populateEventUserAlso
                        ? { path: 'userId', model: 'User', select: 'firstName lastName email' }
                        : undefined,
                }
            });
        }

        if (otherPopulationsArr && Array.isArray(otherPopulationsArr)) {
            if (otherPopulationsArr?.length > 0) {
                populates = populates.concat(otherPopulationsArr);
            }
        }

        const reaFlRes = await (this.conn || req.conn).models[this.ModelName]
            .find(fndFilter, projectionStr)
            .populate(populates)
            .sort("-_id")
            .lean()
            .exec();

        (async () => {
            if (!['Event', 'EventName'].includes(this.ModelName)) {
                try {
                    this.logger = new EventService();
                    const { evt } = await this.logger.log(
                        req?.user?._id || req?.user?.sub,
                        `Read`,
                        req
                    );

                    for (const ele of reaFlRes) {
                        if (!ele.eventIds?.includes?.(evt._id)) {
                            await (this.conn || req.conn).models[this.ModelName].findByIdAndUpdate(ele._id, {
                                $addToSet: { eventIds: evt._id }
                            }).exec();
                        }
                    }

                } catch (err) {
                    console.log('❌ Error logging READ Filtered event:', err);
                }

            }

        })();

        return reaFlRes;

    }


    async readById(id, req, populateEvents = false, populationMatch = { name: 'Created' }, populateEventUserAlso = false) {
        let reaIdRes;

        if (populateEvents) {
            reaIdRes = await (this.conn || req.conn).models[this.ModelName]
                .findOne({ _id: id, isArchived: false, client: req.client })
                .populate({
                    path: 'eventIds',
                    select: 'eventAt eventName',
                    populate: {
                        path: 'eventName',
                        model: 'EventName',
                        select: 'name userId',
                        match: populationMatch,
                        populate: populateEventUserAlso
                            ? { path: 'userId', model: 'User', select: 'firstName lastName email' }
                            : undefined,
                    }
                })
                .lean()
                .exec();

        } else {
            reaIdRes = await (this.conn || req.conn).models[this.ModelName]
                .findOne({ _id: id, isArchived: false, client: req.client })
                .lean()
                .exec();
        }

        (async () => {
            if (!['Event', 'EventName'].includes(this.ModelName)) {
                try {
                    this.logger = new EventService();
                    const { evt } = await this.logger.log(
                        req?.user?._id || req?.user?.sub,
                        `Read`,
                        req
                    );

                    if (reaIdRes && !reaIdRes.eventIds.includes(evt._id)) {
                        await (this.conn || req.conn).models[this.ModelName].findByIdAndUpdate(reaIdRes._id, {
                            $addToSet: { eventIds: evt._id }
                        }).exec();
                    }

                } catch (err) {
                    console.log('❌ Error logging READ by Id event:', err);
                }

            }

        })();

        return reaIdRes;

    }

    /** Update one by ID */
    async update(id, data, req, useSave = false, isArchived = false, otherFieldsFilter = {}) {
        let updRes;
        if (useSave) {
            updRes = await (this.conn || req.conn).models[this.ModelName]
                .findOne(
                    { _id: id, isArchived, ...otherFieldsFilter, client: req.client },
                )

            for (const ele of Object.keys(data)) {
                updRes[ele] = data[ele];
            }

            await updRes.save();
        } else {
            updRes = await (this.conn || req.conn).models[this.ModelName]
                .findOneAndUpdate(
                    { _id: id, isArchived, ...otherFieldsFilter, client: req.client },
                    data,
                    {
                        new: true,
                        runValidators: true,
                        context: 'query',
                    }
                )
                .lean()
                .exec();
        }

        (async () => {
            if (!['Event', 'EventName'].includes(this.ModelName)) {
                try {
                    this.logger = new EventService();
                    const { evt } = await this.logger.log(
                        req?.user?._id || req?.user?.sub,
                        `Updated`,
                        req
                    );

                    if (updRes && !updRes?.eventIds?.includes?.(evt._id)) {
                        await (this.conn || req.conn).models[this.ModelName].findByIdAndUpdate(updRes._id, {
                            $addToSet: { eventIds: evt._id }
                        }).exec();
                    }

                } catch (err) {
                    console.log('❌ Error logging Update event:', err);
                }

            }

        })();

        return updRes;

    }

    /** “Soft” delete (archive) one by ID */
    async delete(id, req) {
        const obj = await (this.conn || req.conn).models[this.ModelName]
            .findOne({ _id: id, client: req.client });

        if (!obj) return null;
        obj.isArchived = true;
        await obj.save();

        let delRes = obj;

        (async () => {
            if (!['Event', 'EventName'].includes(this.ModelName)) {
                try {
                    this.logger = new EventService();
                    const { evt } = await this.logger.log(
                        req?.user?._id || req?.user?.sub,
                        `Archived`,
                        req
                    );

                    if (!obj.eventIds.includes(evt._id)) {
                        await (this.conn || req.conn).models[this.ModelName].findByIdAndUpdate(delRes._id, {
                            $addToSet: { eventIds: evt._id }
                        }).exec();
                    }

                } catch (err) {
                    console.log('❌ Error logging Delete event:', err);
                }

            }

        })();

        return delRes;

    }
}

export default CRUDService;
