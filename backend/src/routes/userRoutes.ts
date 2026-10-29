import { Router } from "express";
import { getMyProfile } from "../controllers/userController.js";
import { authenticateUser } from "../middleware/authenticateUser.js";

const router = Router();

router.get("/profile", authenticateUser, getMyProfile);

export default router;