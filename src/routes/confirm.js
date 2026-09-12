import { getDb } from '../db/connect.js';

export default async (req, res) => {
    const { confirmationId } = req.params;

    const confirmation = await getDb().collection('confirmations').findOne({ id: confirmationId });

    res.render('trips/confirm', {
        title: 'Trip Confirmation',
        confirmation
    });
};
