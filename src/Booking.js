import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
  customer_name: { type: String, required: true },
  customer_phone: { type: String, required: true },
  customer_email: { type: String, default: "" },
  appointment_time: { type: String, required: true }, // human-readable display, e.g. "Nov 26, 10:00 AM"
  appointment_at: { type: Date, index: true }, // real date+time, used for reminders & slot capacity (new bookings only)
  reminder_sent: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ["booking_confirmed", "appointment_reminder", "booking_completed", "booking_cancelled", "cancellation_requested"],
    default: "booking_confirmed"
  }
}, { timestamps: true });

export default mongoose.model("Booking", bookingSchema);
