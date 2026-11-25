// Polls for confirmed bookings whose appointment is coming up within each
// business's reminder window, and fires the reminder WhatsApp/email once.
// Only works for bookings with a real appointment_at (made via the date/slot
// picker) — legacy free-text bookings have no appointment_at and are skipped.
import Booking from "./Booking.js";
import Business from "./Business.js";
import { notifyEngine } from "./engine.js";

export async function runReminderSweep() {
  try {
    const now = new Date();

    // Find confirmed, not-yet-reminded bookings with a real appointment time
    // that's still in the future. We check each business's own window below,
    // since reminder_hours_before can differ per business.
    const candidates = await Booking.find({
      status: "booking_confirmed",
      reminder_sent: false,
      appointment_at: { $exists: true, $gte: now }
    }).populate("business");

    for (const booking of candidates) {
      const business = booking.business;
      if (!business) continue;

      const hoursBefore = business.reminder_hours_before || 2;
      const windowStart = new Date(booking.appointment_at.getTime() - hoursBefore * 60 * 60 * 1000);

      if (now >= windowStart) {
        booking.status = "appointment_reminder";
        booking.reminder_sent = true;
        await booking.save();
        await notifyEngine("appointment_reminder", booking, business);
        console.log(`Reminder sent: ${booking.customer_name} (${business.business_name}) for ${booking.appointment_time}`);
      }
    }
  } catch (err) {
    console.error("Reminder sweep failed:", err.message);
  }
}

export function startReminderScheduler(intervalMinutes = 5) {
  console.log(`Reminder scheduler started (checking every ${intervalMinutes} min)`);
  runReminderSweep(); // run once at startup too
  setInterval(runReminderSweep, intervalMinutes * 60 * 1000);
}
