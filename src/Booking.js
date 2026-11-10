import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  customer_name: { type: String, required: true },
  customer_phone: { type: String, required: true },
  appointment_time: { type: String, required: true },
  status: {
    type: String,
    enum: ["booking_confirmed", "appointment_reminder", "booking_completed", "booking_cancelled"],
    default: "booking_confirmed"
  }
}, { timestamps: true });

export default mongoose.model("Booking", bookingSchema);
