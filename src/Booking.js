import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  business: { type: mongoose.Schema.Types.ObjectId, ref: "Business", required: true, index: true },
  customer_name: { type: String, required: true },
  customer_phone: { type: String, required: true },
  appointment_time: { type: String, required: true },
  status: {
    type: String,
    enum: ["booking_confirmed", "appointment_reminder", "booking_completed", "booking_cancelled", "cancellation_requested"],
    default: "booking_confirmed"
  }
}, { timestamps: true });

export default mongoose.model("Booking", bookingSchema);
