import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const COOKIE_NAME = "gb_session";
const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export async function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

export async function comparePassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

export function signBusinessToken(business) {
  return jwt.sign({ businessId: business._id.toString() }, SECRET, { expiresIn: "30d" });
}

export function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60 * 1000
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

// Reads the session cookie, verifies it, and attaches req.businessId.
// Responds 401 if missing/invalid — use on every owner-only route.
export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Not logged in" });

  try {
    const payload = jwt.verify(token, SECRET);
    req.businessId = payload.businessId;
    next();
  } catch {
    return res.status(401).json({ error: "Session expired, please log in again" });
  }
}

export { COOKIE_NAME };
