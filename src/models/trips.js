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

    if (typeof region === "string" && region !== "all") {
        filter.region = region;
    }

    if (typeof season === "string" && season !== "all") {
        filter.bestSeason = season.toLowerCase();
    }
    

    if (typeof q === "string" && q.trim()) {
        const escapedQuery = q.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
        );
        filter.$or = [
            {
                name: {
                    $regex: escapedQuery,
                    $options: "i"
                }
            },
            {
                description: {
                    $regex: escapedQuery,
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