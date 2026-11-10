import "dotenv/config";
import dns from "dns";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import Booking from "./Booking.js";
import { notifyEngine } from "./engine.js";

// This sandbox doesn't hand Node's resolver the system DNS servers it needs
// for mongodb+srv:// SRV lookups, even though the OS resolver works fine.
// Force a public resolver so Atlas SRV records resolve reliably.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// Customer creates a booking
app.post("/api/bookings", async (req, res) => {
  try {
    const { customer_name, customer_phone, appointment_time } = req.body;
    if (!customer_name || !customer_phone || !appointment_time) {
      return res.status(400).json({ error: "customer_name, customer_phone and appointment_time are required" });
    }

    const booking = await Booking.create({ customer_name, customer_phone, appointment_time });
    await notifyEngine("booking_confirmed", booking);

    res.status(201).json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create booking" });
  }
});

// Owner dashboard lists all bookings, newest first
app.get("/api/bookings", async (req, res) => {
  const bookings = await Booking.find().sort({ createdAt: -1 });
  res.json(bookings);
});

// Owner changes a booking's status -> triggers the matching WhatsApp/email alert
app.patch("/api/bookings/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["booking_confirmed", "appointment_reminder", "booking_completed", "booking_cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });
    }

    const booking = await Booking.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    await notifyEngine(status, booking);

    res.json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update booking" });
  }
});

const start = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("MongoDB connected");

    const port = process.env.PORT || 8001;
    app.listen(port, () => console.log(`general-booking running on port ${port}`));
  } catch (err) {
    console.error("DB connection failed:", err);
  }
};

start();
