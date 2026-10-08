import Trip from "./schemas/trips.js";

export async function getTripById(id) {
    return Trip.findOne({ id }).lean();
}

export async function getAllTrips() {
    return Trip.find({}).lean();
}

export async function getPaginatedTrips(page, limit) {
    const skip = (page - 1) * limit;

    const [trips, totalItems] = await Promise.all([
        Trip.find(filter)
            .sort({ id: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Trip.countDocuments({})
    ]);

    return {
        trips,
        totalItems
    };
}