import Trip from "./schemas/trips.js";

export async function getTripById(id) {
    return Trip.findOne({ id }).lean();
}

export async function getAllTrips() {
    return Trip.find({}).lean();
}

export async function getPaginatedTrips({
    page,
    limit,
    region,
    season,
    q
}) {
    const skip = (page - 1) * limit;

    const filter = {};

    if (region && region !== "all") {
        filter.region = region;
        }

    if (season && season !== "all") {
        filter.bestSeason = season.toLowerCase();
    }
    

    if (q) {
        filter.$or = [
            {
                name: {
                    $regex: q,
                    $options: "i"
                }
            },
            {
                description: {
                    $regex: q,
                    $options: "i"
                }
            }
        ];
    }

    const [trips, totalItems] = await Promise.all([
        Trip.find(filter)
            .skip(skip)
            .limit(limit)
            .lean(),
        Trip.countDocuments(filter)
    ]);

    return {
        trips,
        totalItems
    };
}