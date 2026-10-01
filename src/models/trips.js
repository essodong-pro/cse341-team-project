import Trip from "./schemas/trips.js";

export async function getTripById(id) {
    return Trip.findOne({ id }).lean();
}

export async function getAllTrips() {
    return Trip.find({}).lean();
}

export async function updateTrip(id, updates) {
    return Trip.findOneAndUpdate(
        { id },
        { $set: updates },
        {
            new: true,
            runValidators: true,
        }
    ).lean();
}

export async function deleteTrip(id) {
    return Trip.findOneAndDelete({ id }).lean();
}