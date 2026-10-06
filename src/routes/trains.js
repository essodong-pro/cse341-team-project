import { getDb } from '../db/connect.js';

const trainsPage = (req, res) => {
    res.render('trains', { title: 'Trains' });
};

const trainsApi = async (req, res, next) => {
    try {
        const page = Number.parseInt(req.query.page, 10) || 1;
        const limit = Number.parseInt(req.query.limit, 10) || 10;

        if (page < 1 || limit < 1 || limit > 50) {
            return res.status(400).json({
                error: 'page must be at least 1 and limit must be between 1 and 50'
            });
        }

        const collection = getDb().collection('trains');
        const search = req.query.search?.trim() || '';
        const filter = search
    ? {
        $or: [
            { name: { $regex: search, $options: 'i' } },
            { operator: { $regex: search, $options: 'i' } }
        ]
    }
    : {};

const totalItems = await collection.countDocuments(filter);
        const totalPages = Math.ceil(totalItems / limit);

        const trains = await collection
            .find(filter)
            .sort({ _id: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray();

        return res.json({
            data: trains,
            search,
            pagination: {
                page,
                limit,
                totalItems,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1
            }
        });
    } catch (error) {
        return next(error);
    }
};

export { trainsApi, trainsPage };
