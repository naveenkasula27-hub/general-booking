// One-off migration: creates the "demo" business (for existing legacy links
// like /book.html and /dashboard.html) and attaches every pre-multi-tenant
// booking (ones with no `business` field) to it.
import "dotenv/config";
import dns from "dns";
import mongoose from "mongoose";
import Business from "../src/Business.js";
import Booking from "../src/Booking.js";
import { hashPassword } from "../src/auth.js";

dns.setServers(["8.8.8.8", "1.1.1.1"]);

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected");

  let demo = await Business.findOne({ slug: "demo" });
  if (!demo) {
    const password_hash = await hashPassword("demo1234");
    demo = await Business.create({
      business_name: process.env.BUSINESS_NAME || "UnityWebWorks Demo Business",
      slug: "demo",
      owner_email: "demo@unitywebworks.test",
      owner_phone: process.env.OWNER_PHONE || "",
      password_hash
    });
    console.log("Created demo business:", demo.slug, "(login: demo@unitywebworks.test / demo1234)");
  } else {
    console.log("Demo business already exists:", demo.slug);
  }

  const result = await Booking.updateMany(
    { business: { $exists: false } },
    { $set: { business: demo._id } }
  );
  console.log(`Backfilled ${result.modifiedCount} legacy booking(s) onto the demo business.`);

  await mongoose.disconnect();
  console.log("Done.");
};

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
