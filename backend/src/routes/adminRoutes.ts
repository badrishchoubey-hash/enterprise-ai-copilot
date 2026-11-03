import { Router } from "express";
import {
  deleteAdminUser,
  getAdminUsers,
  patchAdminUser,
  postAdminUser,
} from "../controllers/adminUserController.js";
import {
  deleteAdminDocumentRoute,
  getAdminAnalyticsRoute,
  getAdminDocument,
  getAdminDocumentFile,
  getAdminDocuments,
  getAdminDocumentUploadSignature,
  getAdminKnowledgeBase,
  patchAdminDocument,
  postAdminDocument,
  retryAdminDocumentRoute,
} from "../controllers/adminKnowledgeController.js";
import { authenticateUser } from "../middleware/authenticateUser.js";
import { authorizeRole } from "../middleware/authorizeRole.js";

const router = Router();

router.use(authenticateUser, authorizeRole("admin"));

router.get("/users", getAdminUsers);
router.post("/users", postAdminUser);
router.patch("/users/:userId", patchAdminUser);
router.delete("/users/:userId", deleteAdminUser);

router.get("/documents", getAdminDocuments);
router.post("/documents/upload-signature", getAdminDocumentUploadSignature);
router.post("/documents/upload", postAdminDocument);
router.get("/documents/:documentId/file", getAdminDocumentFile);
router.post("/documents/:documentId/retry", retryAdminDocumentRoute);
router.get("/documents/:documentId", getAdminDocument);
router.patch("/documents/:documentId", patchAdminDocument);
router.delete("/documents/:documentId", deleteAdminDocumentRoute);

router.get("/knowledge-base", getAdminKnowledgeBase);
router.get("/analytics", getAdminAnalyticsRoute);

export default router;
