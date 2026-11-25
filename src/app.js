import "dotenv/config";
import dns from "dns";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import Booking from "./Booking.js";
import Business from "./Business.js";
import { notifyEngine } from "./engine.js";
import { hashPassword, comparePassword, signBusinessToken, setSessionCookie, clearSessionCookie, requireAuth } from "./auth.js";

// This sandbox doesn't hand Node's resolver the system DNS servers it needs
// for mongodb+srv:// SRV lookups, even though the OS resolver works fine.
// Force a public resolver so Atlas SRV records resolve reliably.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(cookieParser());

// ---------- Auth: signup / login / logout / me ----------

app.post("/api/signup", async (req, res) => {
  try {
    const { business_name, slug, owner_email, owner_phone, password } = req.body;
    if (!business_name || !slug || !owner_email || !password) {
      return res.status(400).json({ error: "business_name, slug, owner_email and password are required" });
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({ error: "slug can only contain lowercase letters, numbers and hyphens" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const existingSlug = await Business.findOne({ slug });
    if (existingSlug) return res.status(409).json({ error: "That booking page name is already taken" });

    const existingEmail = await Business.findOne({ owner_email: owner_email.toLowerCase() });
    if (existingEmail) return res.status(409).json({ error: "An account with that email already exists" });

    const password_hash = await hashPassword(password);
    const business = await Business.create({ business_name, slug, owner_email, owner_phone, password_hash });

    const token = signBusinessToken(business);
    setSessionCookie(res, token);

    res.status(201).json({ business_name: business.business_name, slug: business.slug });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create account" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { owner_email, password } = req.body;
    if (!owner_email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const business = await Business.findOne({ owner_email: owner_email.toLowerCase() });
    if (!business) return res.status(401).json({ error: "Invalid email or password" });

    const ok = await comparePassword(password, business.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });

    const token = signBusinessToken(business);
    setSessionCookie(res, token);

    res.json({ business_name: business.business_name, slug: business.slug });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not log in" });
  }
});

app.post("/api/logout", (req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, async (req, res) => {
  const business = await Business.findById(req.businessId);
  if (!business) return res.status(401).json({ error: "Not logged in" });
  res.json({ business_name: business.business_name, slug: business.slug, owner_email: business.owner_email });
});

// ---------- Public, slug-scoped customer routes (no login needed) ----------

app.get("/api/:slug/info", async (req, res) => {
  const business = await Business.findOne({ slug: req.params.slug });
  if (!business) return res.status(404).json({ error: "No business found for that link" });
  res.json({ business_name: business.business_name, slug: business.slug });
});

app.post("/api/:slug/bookings", async (req, res) => {
  try {
    const business = await Business.findOne({ slug: req.params.slug });
    if (!business) return res.status(404).json({ error: "No business found for that link" });

    const { customer_name, customer_phone, appointment_time } = req.body;
    if (!customer_name || !customer_phone || !appointment_time) {
      return res.status(400).json({ error: "customer_name, customer_phone and appointment_time are required" });
    }

    const booking = await Booking.create({ business: business._id, customer_name, customer_phone, appointment_time });
    await notifyEngine("booking_confirmed", booking, business);

    res.status(201).json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create booking" });
  }
});

app.get("/api/:slug/bookings/by-phone/:phone", async (req, res) => {
  const business = await Business.findOne({ slug: req.params.slug });
  if (!business) return res.status(404).json({ error: "No business found for that link" });

  const bookings = await Booking.find({
    business: business._id,
    customer_phone: req.params.phone,
    status: { $in: ["booking_confirmed", "appointment_reminder", "cancellation_requested"] }
  }).sort({ createdAt: -1 });
  res.json(bookings);
});

app.post("/api/:slug/bookings/:id/request-cancellation", async (req, res) => {
  try {
    const business = await Business.findOne({ slug: req.params.slug });
    if (!business) return res.status(404).json({ error: "No business found for that link" });

    const booking = await Booking.findOne({ _id: req.params.id, business: business._id });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (!["booking_confirmed", "appointment_reminder"].includes(booking.status)) {
      return res.status(400).json({ error: "This booking can't be cancelled right now" });
    }

    booking.status = "cancellation_requested";
    await booking.save();
    await notifyEngine("cancellation_requested", booking, business);

    res.json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not request cancellation" });
  }
});

// ---------- Owner-only dashboard routes (login required) ----------

app.get("/api/dashboard/bookings", requireAuth, async (req, res) => {
  const bookings = await Booking.find({ business: req.businessId }).sort({ createdAt: -1 });
  res.json(bookings);
});

app.patch("/api/dashboard/bookings/:id/status", requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["booking_confirmed", "appointment_reminder", "booking_completed", "booking_cancelled"];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(", ")}` });
    }

    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, business: req.businessId },
      { status },
      { new: true }
    );
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const business = await Business.findById(req.businessId);
    await notifyEngine(status, booking, business);

    res.json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update booking" });
  }
});

app.patch("/api/dashboard/bookings/:id/approve-cancellation", requireAuth, async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, business: req.businessId });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.status !== "cancellation_requested") {
      return res.status(400).json({ error: "No pending cancellation request for this booking" });
    }

    booking.status = "booking_cancelled";
    await booking.save();

    const business = await Business.findById(req.businessId);
    await notifyEngine("booking_cancelled", booking, business);

    res.json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not approve cancellation" });
  }
});

app.patch("/api/dashboard/bookings/:id/reject-cancellation", requireAuth, async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, business: req.businessId });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.status !== "cancellation_requested") {
      return res.status(400).json({ error: "No pending cancellation request for this booking" });
    }

    booking.status = "booking_confirmed";
    await booking.save();

    const business = await Business.findById(req.businessId);
    await notifyEngine("cancellation_rejected", booking, business);

    res.json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not reject cancellation" });
  }
});

// ---------- Pages ----------
// Legacy links (used in the unitywebworks.com homepage card) keep working
// by redirecting to the "demo" business's pages.
app.get("/book.html", (req, res) => res.redirect("/demo/book"));
app.get("/dashboard.html", (req, res) => res.redirect("/dashboard"));

// Every business's public booking page: /:slug/book
// (the slug itself is read client-side from the URL)
app.get("/:slug/book", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "book.html"));
});

app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "dashboard.html"));
});

app.use(express.static(path.join(__dirname, "..", "public")));

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
