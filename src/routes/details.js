import { getDb } from '../db/connect.js';

export default async (req, res) => {
    const { tripId } = req.params;
    const db = getDb();
    const details = await db.collection('trips').findOne({ id: tripId });
    details.schedules = await db.collection('schedules').find({ tripId }).toArray();

    res.render('trips/details', {
        title: 'Trip Details',
        details
    });
};
