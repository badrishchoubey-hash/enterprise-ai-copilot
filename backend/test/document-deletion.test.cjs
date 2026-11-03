const { test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Documents = require("../dist/models/Document.js").default;
const Chunks = require("../dist/models/DocumentChunk.js").default;
const Messages = require("../dist/models/Message.js").default;
const storage = require("../dist/config/cloudinary.js");
const { deleteAdminDocument } = require("../dist/services/adminKnowledgeService.js");

function fixture(t, destroy, status = "completed", cleanupFailure) {
  const calls = [];
  const session = {};
  const document = {
    _id: new mongoose.Types.ObjectId(), uploadedBy: new mongoose.Types.ObjectId(),
    name: "policy.pdf", type: "pdf", status, visibility: "organization",
    storageProvider: "cloudinary", storageKey: "nexa/documents/admin/policy.pdf",
  };
  t.mock.method(Documents, "findById", () => ({ async exec() { return document; } }));
  t.mock.method(storage, "getCloudinary", () => ({ uploader: {
    async destroy(key, options) {
      calls.push("cloudinary");
      assert.equal(key, document.storageKey);
      assert.deepEqual(options, { resource_type: "raw", type: "authenticated", invalidate: true });
      return destroy();
    },
  } }));
  t.mock.method(mongoose.connection, "transaction", async (work) => {
    calls.push("transaction");
    return work(session);
  });
  function query(name, result) {
    return { session(value) { assert.equal(value, session); return this; }, async exec() {
      calls.push(name);
      if (name === "chunks" && cleanupFailure) throw cleanupFailure;
      return result;
    } };
  }
  t.mock.method(Chunks, "deleteMany", (filter) => {
    assert.deepEqual(filter, { documentId: document._id });
    return query("chunks", { deletedCount: 1 });
  });
  t.mock.method(Messages, "updateMany", (filter, update) => {
    assert.deepEqual(filter, { "citations.documentId": document._id });
    assert.deepEqual(update, { $pull: { citations: { documentId: document._id } } });
    return query("citations", { modifiedCount: 1 });
  });
  t.mock.method(Documents, "deleteOne", (filter) => {
    assert.deepEqual(filter, { _id: document._id });
    return query("document", { deletedCount: 1 });
  });
  return { calls, document };
}

test("document deletion confirms Cloudinary removal before transactional database cleanup", async (t) => {
  const { calls, document } = fixture(t, async () => ({ result: "ok" }));
  const result = await deleteAdminDocument(document._id.toString());
  assert.equal(result.id, document._id.toString());
  assert.deepEqual(calls, ["cloudinary", "transaction", "chunks", "citations", "document"]);
});

test("already removed Cloudinary assets allow database deletion to be retried", async (t) => {
  const { calls, document } = fixture(t, async () => ({ result: "not found" }));
  await deleteAdminDocument(document._id.toString());
  assert.equal(calls.at(-1), "document");
});

test("Cloudinary request failures preserve all database records", async (t) => {
  const { calls, document } = fixture(t, async () => { throw new Error("provider unavailable"); });
  await assert.rejects(deleteAdminDocument(document._id.toString()), { code: "DOCUMENT_STORAGE_DELETE_FAILED", statusCode: 502 });
  assert.deepEqual(calls, ["cloudinary"]);
});

for (const response of [undefined, {}, { result: "error" }, { result: "queued" }]) {
  test(`unconfirmed Cloudinary response ${JSON.stringify(response)} blocks database deletion`, async (t) => {
    const { calls, document } = fixture(t, async () => response);
    await assert.rejects(deleteAdminDocument(document._id.toString()), { code: "DOCUMENT_STORAGE_DELETE_FAILED" });
    assert.deepEqual(calls, ["cloudinary"]);
  });
}

test("database cleanup failures abort the transaction before deleting the document reference", async (t) => {
  const failure = new Error("database cleanup failed");
  const { calls, document } = fixture(t, async () => ({ result: "ok" }), "completed", failure);
  await assert.rejects(deleteAdminDocument(document._id.toString()), (error) => error === failure);
  assert.deepEqual(calls, ["cloudinary", "transaction", "chunks"]);
});

test("processing documents cannot lose their file through deletion", async (t) => {
  const { calls, document } = fixture(t, async () => ({ result: "ok" }), "processing");
  await assert.rejects(deleteAdminDocument(document._id.toString()), { code: "DOCUMENT_PROCESSING", statusCode: 409 });
  assert.deepEqual(calls, []);
});
