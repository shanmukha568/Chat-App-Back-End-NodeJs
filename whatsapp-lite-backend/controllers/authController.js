import { AuthService } from "../services/authService.js";
import { ok, created, fail } from "../utils/response.js";
import { validateRegister, validateLogin, validateResetPassword } from "../utils/validate.js";
import { normalizeUser } from "../utils/normalize.js";

export const AuthController = {

  async register(req, res, next) {
    try {
      const errors = validateRegister(req.body);
      if (errors.length) return fail(res, "Validation failed", 400, errors);
      const { user, token } = await AuthService.register(req.body);
      return created(res, { user: normalizeUser(user), token }, "Registered successfully");
    } catch (err) { next(err); }
  },

  async login(req, res, next) {
    try {
      const errors = validateLogin(req.body);
      if (errors.length) return fail(res, "Validation failed", 400, errors);
      const { user, token } = await AuthService.login(req.body);
      return ok(res, { user: normalizeUser(user), token }, "Login successful");
    } catch (err) { next(err); }
  },

  async resetPassword(req, res, next) {
    try {
      const errors = validateResetPassword(req.body);
      if (errors.length) return fail(res, "Validation failed", 400, errors);
      await AuthService.resetPassword(req.body);
      return ok(res, {}, "Password reset successfully");
    } catch (err) { next(err); }
  },
};
