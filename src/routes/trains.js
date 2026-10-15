import { getDb } from '../db/connect.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

const parsePositiveInteger = (value, defaultValue) => {
    if (value === undefined) {
        return defaultValue;
    }

    const parsed = Number(value);

    if (!Number.isSafeInteger(parsed) || parsed < 1) {
        return null;
    }

    return parsed;
};

const trainsPage = (req, res) => {
    res.render('trains', { title: 'Trains' });
};

const trainsApi = async (req, res, next) => {
    try {
        const page = parsePositiveInteger(req.query.page, DEFAULT_PAGE);
        const limit = parsePositiveInteger(req.query.limit, DEFAULT_LIMIT);

        const errors = [];

        if (page === null) {
            errors.push({
                field: 'page',
                message: 'page must be a whole number of 1 or more.'
            });
        }

        if (limit === null || limit > MAX_LIMIT) {
            errors.push({
                field: 'limit',
                message: `limit must be a number between 1 and ${MAX_LIMIT}.`
            });
        }

        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }

        const collection = getDb().collection('trains');
        const totalItems = await collection.countDocuments({});
        const trains = await collection
            .find({})
            .sort({ name: 1, id: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray();
        const totalPages = Math.ceil(totalItems / limit);

        return res.json({
            trains,
            pagination: {
                page,
                limit,
                totalItems,
                totalPages,
                hasNextPage: page * limit < totalItems,
                hasPreviousPage: page > 1
            }
        });
    } catch (error) {
        return next(error);
    }
};

export { trainsApi, trainsPage };
