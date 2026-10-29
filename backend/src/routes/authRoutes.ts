import { Router } from "express";
import {
  login,
  logout,
  refresh,
  register,
} from "../controllers/authController.js";
import { rateLimit } from "../middleware/rateLimit.js";
import {
  handleValidationErrors,
  loginValidation,
  refreshValidation,
  registrationValidation,
  validateObjectBody,
} from "../middleware/validation.js";

const router = Router();
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
router.use(validateObjectBody, authLimit);
router.post(
  "/register",
  registrationValidation,
  handleValidationErrors,
  register,
);
router.post("/login", loginValidation, handleValidationErrors, login);
router.post("/refresh", refreshValidation, handleValidationErrors, refresh);
router.post("/logout", logout);
export default router;
