// Core logic. This file has no browser code, so you can test it alone.
// All times are minutes after midnight.

export function toMinutes(text) {
  const [hours, minutes] = text.split(":").map(Number);
  const total = hours * 60 + minutes;
  if (Number.isNaN(total)) throw new Error(`Bad time: "${text}". Use the HH:MM format.`);
  return total;
}

// A value below 0 or above 1439 wraps to the previous or the next day.
export function toText(minutes) {
  const day = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = String(Math.floor(day / 60)).padStart(2, "0");
  const m = String(day % 60).padStart(2, "0");
  return `${h}:${m}`;
}

// Make the list of departure times for one service.
// If service.live has times, use them first. Use the timetable only after the last live time.
export function departures(service) {
  if (!(service.every > 0)) throw new Error("The value of every must be more than 0.");
  const live = service.live || [];
  const lastLive = live.length ? Math.max(...live) : -Infinity;
  const list = [...live];
  for (let t = toMinutes(service.first); t <= toMinutes(service.last); t += service.every) {
    if (t > lastLive) list.push(t);
  }
  return list;
}

// Read the live bus times from the answer of the community API (Arrivelah).
// Return minutes after midnight in Singapore time, or [] if the service is not in the answer.
export function liveTimes(answer, serviceNo) {
  const found = ((answer && answer.services) || []).find((s) => s.no === serviceNo);
  if (!found) return [];
  return ["next", "subsequent", "next2", "next3"]
    .map((key) => found[key])
    .filter((bus) => bus && typeof bus.time === "string" && bus.duration_ms >= 0)
    .map((bus) => {
      const [h, m, s] = bus.time.slice(11, 19).split(":").map(Number);
      return h * 60 + m + s / 60;
    })
    .filter((t, i, all) => !Number.isNaN(t) && all.indexOf(t) === i)
    .sort((a, b) => a - b);
}

// Find the latest leave time so that you arrive at the target time or before.
// Return null if no trip can reach the target.
export function plan(route, targetMinutes, warnMinutes) {
  const busDepartures = departures(route.bus).filter(
    (t) => t + route.bus.ride + route.walkToDestination <= targetMinutes
  );
  if (busDepartures.length === 0) return null;
  const busDeparture = Math.max(...busDepartures);

  const trainDepartures = departures(route.train).filter(
    (t) => t + route.train.ride + route.transfer <= busDeparture
  );
  if (trainDepartures.length === 0) return null;
  const trainDeparture = Math.max(...trainDepartures);

  const leave = trainDeparture - route.walkToStation;
  return {
    leave,
    notifyAt: leave - warnMinutes,
    trainDeparture,
    trainArrival: trainDeparture + route.train.ride,
    busDeparture,
    arrive: busDeparture + route.bus.ride + route.walkToDestination,
  };
}
