// Generates the list of bookable time slots for a business on a given date,
// based on its working hours and slot length. The container runs with
// TZ=Asia/Kolkata (see docker-compose.yml), so Date math here is in IST.

function parseHHMM(str) {
  const [h, m] = str.split(":").map(Number);
  return { h, m };
}

function formatLabel(date) {
  return date.toLocaleString("en-IN", {
    day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true
  });
}

// dateStr: "YYYY-MM-DD". Returns [{ time: "HH:MM", label, iso, isPast }]
export function generateSlotsForDate(business, dateStr) {
  const duration = business.slot_duration_minutes || 30;
  const start = parseHHMM(business.working_hours_start || "09:00");
  const end = parseHHMM(business.working_hours_end || "18:00");

  const [y, m, d] = dateStr.split("-").map(Number);
  const now = new Date();
  const slots = [];

  let cursor = new Date(y, m - 1, d, start.h, start.m, 0, 0);
  const endTime = new Date(y, m - 1, d, end.h, end.m, 0, 0);

  while (cursor < endTime) {
    slots.push({
      time: cursor.toTimeString().slice(0, 5), // "HH:MM", 24h — used to submit the booking
      time12: cursor.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }), // "10:00 am" — used for display
      label: formatLabel(cursor),
      iso: cursor.toISOString(),
      isPast: cursor < now
    });
    cursor = new Date(cursor.getTime() + duration * 60000);
  }

  return slots;
}

// Combines a date + "HH:MM" into a real Date object (business's local time).
export function combineDateTime(dateStr, timeStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const { h, m: min } = parseHHMM(timeStr);
  return new Date(y, m - 1, d, h, min, 0, 0);
}

export function formatDisplayTime(date) {
  return date.toLocaleString("en-IN", {
    weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true
  });
}
