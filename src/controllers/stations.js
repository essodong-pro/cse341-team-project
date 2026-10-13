import { getDb } from "../db/connect.js";

export async function getAllStations(req, res) {
    try {
        const stations = await getDb()
            .collection("stations")
            .find({})
            .toArray();

        return res.status(200).json(stations);
    } catch (error) {
        console.error("Error fetching stations:", error);

        return res.status(500).json({
            error: "Internal Server Error"
        });
    }
}

export async function getStationById(req, res) {
    try {
        const { id } = req.params;

        const station = await getDb()
            .collection("stations")
            .findOne({ id });

        if (!station) {
            return res.status(404).json({
                error: "Station not found"
            });
        }

        return res.status(200).json(station);
    } catch (error) {
        console.error("Error fetching station by ID:", error);

        return res.status(500).json({
            error: "Internal Server Error"
        });
    }
}
