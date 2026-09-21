import Schedule from "./schemas/schedules.js";

export async function getSchedulesByTripId(
    tripId
) {
    return Schedule.find({ tripId }).lean();
}