import { Router } from "express";
import { postAskQuestion } from "../controllers/aiController.js";
import { authenticateUser } from "../middleware/authenticateUser.js";

const router = Router();
router.post("/ask", authenticateUser, postAskQuestion);

export default router;
