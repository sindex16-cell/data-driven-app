import { toMinutes, toText, plan, departures } from "./core.js";
import { route, settings } from "./route.js";

// Green plan: arrive with the safety time to spare. Red plan: the latest leave time that is still on time.
function computePlans() {
  const target = toMinutes(settings.arrivalTime);
  return {
    result: plan(route, target - settings.safetyMinutes, settings.warnMinutes),
    latest: plan(route, target, settings.warnMinutes),
  };
}

let { result, latest } = computePlans();
let planDay = new Date().toDateString();
let timerId = null;

const $ = (id) => document.getElementById(id);

function nowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
}

// Compute the plan again when the date changes, so the page keeps working after midnight.
function refreshDay() {
  const today = new Date().toDateString();
  if (today === planDay) return;
  planDay = today;
  ({ result, latest } = computePlans());
  schedule();
}

// Draw the timeline. Time runs from the top to the bottom.
// The train has one line and the bus has one line. A tick marks each departure.
// The green line shows your trip: walk, train, transfer, bus.
function drawTimeline() {
  const PX = 11;           // Pixels for each minute.
  const LEFT = 48;         // Space for the lane names.
  const TRAIN_Y = 84;
  const BUS_Y = 164;
  const start = result.leave;
  const target = toMinutes(settings.arrivalTime);
  const safeTarget = target - settings.safetyMinutes;
  const end = Math.max(result.arrive, latest ? latest.arrive : 0, target) + 3;
  const x = (t) => LEFT + (t - start) * PX;
  const width = x(end) + 12;
  const height = 235;
  const parts = [];

  parts.push(`<text x="0" y="${TRAIN_Y + 4}" class="lane">Train</text>`);
  parts.push(`<text x="0" y="${BUS_Y + 4}" class="lane">Bus</text>`);
  parts.push(`<line x1="${LEFT}" y1="${TRAIN_Y}" x2="${x(end)}" y2="${TRAIN_Y}" class="rail"/>`);
  parts.push(`<line x1="${LEFT}" y1="${BUS_Y}" x2="${x(end)}" y2="${BUS_Y}" class="rail"/>`);

  const lanes = [
    { y: TRAIN_Y, list: departures(route.train), side: -1 },
    { y: BUS_Y, list: departures(route.bus), side: 1 },
  ];
  for (const lane of lanes) {
    for (const t of lane.list) {
      if (t < start || t > end) continue;
      parts.push(`<line x1="${x(t)}" y1="${lane.y - 6}" x2="${x(t)}" y2="${lane.y + 6}" class="tick"/>`);
      parts.push(`<text x="${x(t)}" y="${lane.y + lane.side * 14 + (lane.side > 0 ? 4 : 0)}" text-anchor="middle" class="time">${toText(t)}</text>`);
    }
  }

  // Red vertical line: the arrival limit. Green vertical line: the arrival goal with the safety time.
  parts.push(`<line x1="${x(target)}" y1="22" x2="${x(target)}" y2="${height - 6}" class="limit"/>`);
  parts.push(`<text x="${x(target) - 6}" y="16" text-anchor="end" class="limit-text">Limit ${settings.arrivalTime}</text>`);
  parts.push(`<line x1="${x(safeTarget)}" y1="22" x2="${x(safeTarget)}" y2="${height - 6}" class="goal"/>`);
  parts.push(`<text x="${x(safeTarget) - 6}" y="16" text-anchor="end" class="goal-text">Goal ${toText(safeTarget)}</text>`);

  const points = (p) => [
    [x(p.leave), TRAIN_Y],
    [x(p.trainDeparture), TRAIN_Y],
    [x(p.trainArrival), TRAIN_Y],
    [x(p.busDeparture), BUS_Y],
    [x(p.busDeparture + route.bus.ride), BUS_Y],
    [x(p.arrive), BUS_Y],
  ].map(([px, py]) => `${px},${py}`).join(" ");

  // Red trip: the latest trip that still arrives by the limit. Draw it first, so green is on top.
  const dot = (cls, t, py, label, dy) => {
    parts.push(`<circle cx="${x(t)}" cy="${py}" r="5" class="${cls}"/>`);
    parts.push(`<text x="${x(t)}" y="${py + dy}" text-anchor="middle" class="mark ${cls}">${label}</text>`);
  };
  if (latest) {
    parts.push(`<polyline points="${points(latest)}" class="trip late"/>`);
    dot("late", latest.leave, TRAIN_Y, `Latest leave ${toText(latest.leave)}`, -52);
    dot("late", latest.busDeparture, BUS_Y, `Latest bus ${toText(latest.busDeparture)}`, 54);
    dot("late", latest.arrive, BUS_Y, `Arrive ${toText(latest.arrive)}`, 54);
  }

  parts.push(`<polyline points="${points(result)}" class="trip safe"/>`);
  dot("safe", result.leave, TRAIN_Y, `Leave ${toText(result.leave)}`, -34);
  dot("safe", result.trainDeparture, TRAIN_Y, "Train departs", -34);
  dot("safe", result.trainArrival, TRAIN_Y, "Train arrives", -34);
  dot("safe", result.busDeparture, BUS_Y, "Bus departs", 36);
  dot("safe", result.arrive, BUS_Y, `Arrive ${toText(result.arrive)}`, 36);

  $("timeline").innerHTML =
    `<div class="scroll"><svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" ` +
    `aria-label="Timeline. Green: leave at ${toText(result.leave)} to arrive by ${toText(safeTarget)}. ` +
    (latest ? `Red: the latest leave time is ${toText(latest.leave)} to arrive by ${settings.arrivalTime}.` : "") +
    `">` + parts.join("") + "</svg></div>";
}

function render() {
  refreshDay();
  if (!result) {
    $("timeline").innerHTML = "";
    $("leave").textContent = "No trip";
    $("detail").textContent = "The timetable cannot reach the arrival time. Check route.js.";
    return;
  }
  drawTimeline();
  $("leave").textContent = toText(result.leave);
  $("target").textContent = `To arrive by ${toText(toMinutes(settings.arrivalTime) - settings.safetyMinutes)} (${settings.safetyMinutes} minutes before ${settings.arrivalTime})`;
  $("steps").innerHTML = [
    `Leave home at <b>${toText(result.leave)}</b>.`,
    `Take the train at <b>${toText(result.trainDeparture)}</b>. It arrives at ${toText(result.trainArrival)}.`,
    `Take the bus at <b>${toText(result.busDeparture)}</b>.`,
    `You arrive at <b>${toText(result.arrive)}</b>.`,
  ].map((s) => `<li>${s}</li>`).join("");
  $("latest").textContent = latest
    ? `The latest time to leave is ${toText(latest.leave)}. After this time, you arrive late.`
    : "";
  $("warn").textContent = `Warning at ${toText(result.notifyAt)} (${settings.warnMinutes} minutes before you leave).`;

  const minutesLeft = Math.round(result.leave - nowMinutes());
  $("countdown").textContent =
    minutesLeft >= 0
      ? `${minutesLeft} ${minutesLeft === 1 ? "minute" : "minutes"} until you must leave.`
      : "The leave time for today has passed.";
}

function canNotify() {
  return "Notification" in window;
}

function notify() {
  if (!result || !canNotify()) return;
  try {
    new Notification("Leave soon", {
      body: `Leave home at ${toText(result.leave)} to arrive by ${settings.arrivalTime}.`,
    });
  } catch (error) {
    // Some mobile browsers, for example Chrome on Android, do not allow this call.
    $("status").textContent = "This browser cannot show a notification from this page.";
  }
}

function schedule() {
  clearTimeout(timerId);
  timerId = null;
  if (!result || !canNotify() || Notification.permission !== "granted") return;
  const wait = (result.notifyAt - nowMinutes()) * 60 * 1000;
  if (wait <= 0) {
    $("status").textContent = "The warning time for today has passed.";
    return;
  }
  timerId = setTimeout(notify, wait);
  $("status").textContent = "Notification is set. Keep this page open.";
}

$("enable").addEventListener("click", async () => {
  if (!("Notification" in window)) {
    $("status").textContent = "This browser does not support notifications.";
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission === "granted") schedule();
  else $("status").textContent = "Notifications are blocked. Allow them in the browser.";
});

$("test").addEventListener("click", () => {
  if (!canNotify()) $("status").textContent = "This browser does not support notifications.";
  else if (!result) $("status").textContent = "There is no trip, so there is nothing to show.";
  else if (Notification.permission === "granted") notify();
  else $("status").textContent = "Click \"Turn on notification\" first.";
});

render();
setInterval(render, 30 * 1000);
schedule();
