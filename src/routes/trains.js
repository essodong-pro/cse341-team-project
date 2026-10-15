import { getDb } from '../db/connect.js';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_SEARCH_LENGTH = 100;

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

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const trainsPage = (req, res) => {
    res.render('trains', { title: 'Trains' });
};

const trainsApi = async (req, res, next) => {
    try {
        const page = parsePositiveInteger(req.query.page, DEFAULT_PAGE);
        const limit = parsePositiveInteger(req.query.limit, DEFAULT_LIMIT);
        const rawSearch = req.query.q;

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

        if (Array.isArray(rawSearch)) {
            errors.push({
                field: 'q',
                message: 'q must be a single search value.'
            });
        } else if (rawSearch !== undefined &&
            (typeof rawSearch !== 'string' ||
                rawSearch.trim().length === 0 ||
                rawSearch.trim().length > MAX_SEARCH_LENGTH)) {
            errors.push({
                field: 'q',
                message: `q must be between 1 and ${MAX_SEARCH_LENGTH} characters.`
            });
        }

        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }

        const q = typeof rawSearch === 'string' ? rawSearch.trim() : undefined;
        const filter = q
            ? {
                $or: [
                    { name: { $regex: escapeRegex(q), $options: 'i' } },
                    { operator: { $regex: escapeRegex(q), $options: 'i' } }
                ]
            }
            : {};
        const collection = getDb().collection('trains');
        const totalItems = await collection.countDocuments(filter);
        const trains = await collection
            .find(filter)
            .sort({ name: 1, id: 1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .toArray();
        const totalPages = Math.ceil(totalItems / limit);

        return res.json({
            trains,
            ...(q ? { query: { q } } : {}),
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
