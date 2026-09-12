import { getDb } from '../db/connect.js';

const trainsPage = (req, res) => {
    res.render('trains', { title: 'Trains' });
};

const trainsApi = async (req, res, next) => {
    try {
        const trains = await getDb().collection('trains').find({}).toArray();
        return res.json({ trains });
    } catch (error) {
        return next(error);
    }
};

export { trainsApi, trainsPage };
