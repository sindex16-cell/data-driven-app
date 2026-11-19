// The route and the timetable. The numbers are SAMPLE values.
// Replace them with the real values for your trip.
// Times in "HH:MM" format. Durations in minutes.

export const route = {
  walkToStation: 8,        // Home to the train station.
  train: {
    first: "06:00",        // First train departure.
    last: "23:00",         // Last train departure.
    every: 6,              // A train leaves every 6 minutes.
    ride: 18,              // The train ride.
  },
  transfer: 4,             // Train exit to the bus stop.
  bus: {
    first: "06:05",
    last: "23:05",
    every: 10,
    ride: 15,
  },
  walkToDestination: 5,    // Bus stop to the meeting room.
};

export const settings = {
  arrivalTime: "09:00",    // Version 1 uses one fixed arrival time.
  safetyMinutes: 10,       // The green plan arrives 10 minutes before the arrival time.
  warnMinutes: 10,         // The warning comes 10 minutes before the leave time.
};
