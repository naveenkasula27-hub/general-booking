import mongoose from "mongoose";

const businessSchema = new mongoose.Schema({
  business_name: { type: String, required: true, trim: true },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: /^[a-z0-9-]+$/
  },
  owner_email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  owner_phone: { type: String, default: "" },
  password_hash: { type: String, required: true },

  // Booking schedule settings (used to generate available time slots)
  slot_duration_minutes: { type: Number, default: 30 },
  working_hours_start: { type: String, default: "09:00" }, // "HH:MM", 24h
  working_hours_end: { type: String, default: "18:00" },
  slot_capacity: { type: Number, default: 1 } // max bookings allowed per slot
}, { timestamps: true });

export default mongoose.model("Business", businessSchema);
