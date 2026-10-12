import { getDb } from "../db/connect.js";

export async function getTripStations(req, res) {
    try {
        const { id } = req.params;
        const db = getDb();

        const trip = await db.collection("trips").findOne(
            { id },
            { projection: { _id: 0 } }
        );

        if (!trip) {
            return res.status(404).json({ error: "Trip not found" });
        }

        const [origin, destination] = await Promise.all([
            db.collection("stations").findOne(
                { id: trip.startStation },
                { projection: { _id: 0 } }
            ),
            db.collection("stations").findOne(
                { id: trip.endStation },
                { projection: { _id: 0 } }
            )
        ]);

        if (!origin || !destination) {
            return res.status(404).json({
                error: "Trip station not found"
            });
        }

        return res.status(200).json({
            tripId: trip.id,
            origin,
            destination
        });
    } catch (error) {
        console.error("Error fetching trip stations:", error);
        return res.status(500).json({
            error: "Internal Server Error"
        });
    }
}
