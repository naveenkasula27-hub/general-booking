// One-off manual test: creates a booking 5 hours from now (outside the
// default 2-hour reminder window) for the demo business, runs the sweep,
// and confirms it is correctly left untouched.
import "dotenv/config";
import dns from "dns";
import mongoose from "mongoose";
import Business from "../src/Business.js";
import Booking from "../src/Booking.js";
import { runReminderSweep } from "../src/reminders.js";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected");

  const demo = await Business.findOne({ slug: "demo" });

  const appointment_at = new Date(Date.now() + 5 * 60 * 60 * 1000); // 5 hours from now
  const test = await Booking.create({
    business: demo._id,
    customer_name: "ReminderSweepTest-TooFar",
    customer_phone: "917729069137",
    appointment_time: appointment_at.toLocaleString(),
    appointment_at,
    status: "booking_confirmed",
    reminder_sent: false
  });
  console.log("Created test booking:", test._id.toString(), "for", appointment_at.toISOString());

  console.log("Running reminder sweep...");
  await runReminderSweep();

  const after = await Booking.findById(test._id);
  console.log("After sweep — status:", after.status, "| reminder_sent:", after.reminder_sent, "(expected: unchanged, booking_confirmed / false)");

  // cleanup both test bookings
  await Booking.deleteMany({ customer_name: { $in: ["ReminderSweepTest", "ReminderSweepTest-TooFar"] } });
  console.log("Cleaned up test bookings.");

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
