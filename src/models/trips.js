import Trip from "./schemas/trips.js";

export async function getTripById(id) {
    return Trip.findOne({ id }).lean();
}

export async function getAllTrips() {
    return Trip.find({}).lean();
}