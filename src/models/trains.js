//src/models/trains.js. 
import Train from "../train.js";

export async function getTrainById(id) {
  return Train.findOne({ id }).lean();
}

export async function getAllTrains() {
  return Train.find({}).lean();
}