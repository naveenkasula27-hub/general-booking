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
  password_hash: { type: String, required: true }
}, { timestamps: true });

export default mongoose.model("Business", businessSchema);
