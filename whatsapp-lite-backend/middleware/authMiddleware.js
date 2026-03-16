import jwt             from "jsonwebtoken";
import { unauthorized } from "../utils/response.js";

/**
 * Middleware: verify JWT Bearer token.
 * On success attaches decoded payload to req.user:
 *   { id, name, phone_number, iat, exp }
 */
export function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token  = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

  if (!token) return unauthorized(res, "No token provided");

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    const message =
      err.name === "TokenExpiredError" ? "Token expired" : "Invalid token";
    return unauthorized(res, message);
  }
}
