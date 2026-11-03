const { test } = require("node:test");
const assert = require("node:assert/strict");

process.env.VERCEL = "1";
const app = require("../dist/server.js").default;
const {
  validateUploadMetadata,
} = require("../dist/services/adminKnowledgeService.js");

test("auth, user, and admin routers are mounted only under /api/v1", () => {
  const routers = app.router.stack.filter((layer) => layer.name === "router");
  for (const path of [
    "/api/v1/auth/login",
    "/api/v1/user/profile",
    "/api/v1/admin/users",
    "/api/v1/ai/ask",
  ]) {
    assert.equal(
      routers.some((layer) => layer.match(path)),
      true,
      `${path} should be mounted`,
    );
  }
  for (const path of ["/api/auth/login", "/api/user/profile"]) {
    assert.equal(
      routers.some((layer) => layer.match(path)),
      false,
      `${path} should not be mounted`,
    );
  }
});

test("upload metadata validates supported document formats", () => {
  const input = {
    filename: "handbook.pdf",
    mimeType: "application/pdf",
    fileSize: 1024,
    publicId: "nexa/documents/example",
    version: 1,
  };
  assert.equal(validateUploadMetadata(input).extension, "pdf");
  assert.throws(() => validateUploadMetadata({ ...input, filename: "malware.exe" }), {
    code: "UNSUPPORTED_FILE_TYPE",
  });
});
