import bcrypt        from "bcrypt";
import jwt           from "jsonwebtoken";
import { UserModel } from "../models/userModel.js";

const SALT_ROUNDS = 10;

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, phone_number: user.phone_number },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

export const AuthService = {

  async register({ name, email, phone_number, password }) {
    const exists = await UserModel.findByPhone(phone_number);
    if (exists) {
      const err = new Error("Phone number already registered");
      err.status = 409;
      throw err;
    }
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);
    const user   = await UserModel.create({ name, email, phone_number, password: hashed });
    return { user, token: signToken(user) };
  },

  async login({ phone_number, password }) {
    const record = await UserModel.findByPhone(phone_number);
    // Constant-time comparison even when user not found (mitigates timing attacks)
    const dummy  = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
    const match  = await bcrypt.compare(password, record?.password ?? dummy);

    if (!record || !match) {
      const err = new Error("Invalid phone number or password");
      err.status = 401;
      throw err;
    }

    const { password: _pw, ...safeUser } = record;
    return { user: safeUser, token: signToken(safeUser) };
  },

  async resetPassword({ phone_number, new_password }) {
    const user = await UserModel.findByPhone(phone_number);
    if (!user) {
      const err = new Error("No account found for that phone number");
      err.status = 404;
      throw err;
    }
    const hashed = await bcrypt.hash(new_password, SALT_ROUNDS);
    await UserModel.updatePassword(phone_number, hashed);
    return true;
  },
};
