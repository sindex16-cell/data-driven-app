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
  const LEFT = 48;         // Space for the row names.
  const HOME_Y = 66;
  const TRAIN_Y = 126;
  const BUS_Y = 196;
  const WORK_Y = 256;
  const start = result.leave;
  const target = toMinutes(settings.arrivalTime);
  const safeTarget = target - settings.safetyMinutes;
  const end = Math.max(result.arrive, latest ? latest.arrive : 0, target) + 3;
  // Fit the timeline to the width of the page, so it needs no side scroll.
  const width = Math.max(300, $("timeline").clientWidth);
  const PX = (width - LEFT - 14) / (end - start);
  const x = (t) => LEFT + (t - start) * PX;
  const height = 290;
  const parts = [];

  // Four rows: Home, Train, Bus, Work. Time runs from left to right.
  const rows = [["Home", HOME_Y], ["Train", TRAIN_Y], ["Bus", BUS_Y], ["Work", WORK_Y]];
  for (const [name, y] of rows) {
    parts.push(`<text x="0" y="${y + 4}" class="lane">${name}</text>`);
    parts.push(`<line x1="${LEFT}" y1="${y}" x2="${x(end)}" y2="${y}" class="rail"/>`);
  }

  const lanes = [
    { y: TRAIN_Y, list: departures(route.train), every: route.train.every, dy: -12 },
    { y: BUS_Y, list: departures(route.bus), every: route.bus.every, dy: 20 },
  ];
  for (const lane of lanes) {
    // Show a time label on every tick only if the labels do not touch.
    const step = Math.max(1, Math.ceil(30 / (PX * lane.every)));
    lane.list.filter((t) => t >= start && t <= end).forEach((t, i) => {
      parts.push(`<line x1="${x(t)}" y1="${lane.y - 6}" x2="${x(t)}" y2="${lane.y + 6}" class="tick"/>`);
      if (i % step === 0) parts.push(`<text x="${x(t)}" y="${lane.y + lane.dy}" text-anchor="middle" class="time">${toText(t)}</text>`);
    });
  }

  // Red vertical line: the arrival limit. Green dashed vertical line: the arrival goal.
  parts.push(`<line x1="${x(target)}" y1="28" x2="${x(target)}" y2="${height - 6}" class="limit"/>`);
  parts.push(`<text x="${x(target) - 6}" y="10" text-anchor="end" class="limit-text">Limit ${settings.arrivalTime}</text>`);
  parts.push(`<line x1="${x(safeTarget)}" y1="28" x2="${x(safeTarget)}" y2="${height - 6}" class="goal"/>`);
  parts.push(`<text x="${x(safeTarget) - 6}" y="22" text-anchor="end" class="goal-text">Goal ${toText(safeTarget)}</text>`);

  // A trip is one line: Home, walk to the train, train, transfer, bus, walk to Work.
  const points = (p) => [
    [x(p.leave), HOME_Y],
    [x(p.trainDeparture), TRAIN_Y],
    [x(p.trainArrival), TRAIN_Y],
    [x(p.busDeparture), BUS_Y],
    [x(p.busDeparture + route.bus.ride), BUS_Y],
    [x(p.arrive), WORK_Y],
  ].map(([px, py]) => `${px},${py}`).join(" ");
  const label = (cls, t, py, text, dy, anchor) =>
    parts.push(`<text x="${x(t)}" y="${py + dy}" text-anchor="${anchor}" class="mark ${cls}">${text}</text>`);

  // Draw the red trip first, so the green trip is on top.
  if (latest) {
    parts.push(`<polyline points="${points(latest)}" class="trip late"/>`);
    label("late", latest.leave, HOME_Y, `Latest leave ${toText(latest.leave)}`, -28, "start");
    label("late", latest.arrive, WORK_Y, `Latest arrive ${toText(latest.arrive)}`, 36, "end");
  }
  parts.push(`<polyline points="${points(result)}" class="trip safe"/>`);
  label("safe", result.leave, HOME_Y, `Leave ${toText(result.leave)}`, -12, "start");
  label("safe", result.arrive, WORK_Y, `Arrive ${toText(result.arrive)}`, 20, "end");

  $("timeline").innerHTML =
    `<div class="scroll"><svg viewBox="0 0 ${width} ${height}" width="100%" role="img" ` +
    `aria-label="Timeline. Green: leave at ${toText(result.leave)} and arrive at ${toText(result.arrive)}. ` +
    (latest ? `Red: the latest leave time is ${toText(latest.leave)}, and you arrive at ${toText(latest.arrive)}.` : "") +
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
  $("travel").textContent = `Travel time: ${result.arrive - result.leave} minutes.` +
    (latest ? ` For the latest trip: ${latest.arrive - latest.leave} minutes.` : "");
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
window.addEventListener("resize", render);
schedule();
