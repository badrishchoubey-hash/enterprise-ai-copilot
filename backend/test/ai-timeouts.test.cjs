const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { AppError } = require("../dist/middleware/appError.js");
const { requestTimeout } = require("../dist/middleware/requestTimeout.js");
const { withAiDeadline } = require("../dist/services/aiDeadlineService.js");

function fakeResponse() {
  return Object.assign(new EventEmitter(), { headersSent: false, writableFinished: false });
}

test("ask requests survive the ordinary 30-second limit and abort at their own deadline", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const previous = {};
  for (const name of ["API_TIMEOUT_MS", "AI_REQUEST_TIMEOUT_MS", "AI_EMBEDDING_TIMEOUT_MS", "GEMINI_CHAT_TIMEOUT_MS"]) {
    previous[name] = process.env[name]; delete process.env[name];
  }
  try {
    const ask = { method: "POST", path: "/api/v1/ai/ask" };
    const normal = { method: "GET", path: "/api/v1/admin/documents" };
    const askErrors = [];
    const normalErrors = [];
    requestTimeout()(ask, fakeResponse(), (error) => { if (error) askErrors.push(error); });
    requestTimeout()(normal, fakeResponse(), (error) => { if (error) normalErrors.push(error); });
    t.mock.timers.tick(30001);
    assert.equal(normalErrors[0].code, "API_TIMEOUT");
    assert.equal(askErrors.length, 0);
    assert.equal(ask.requestSignal.aborted, false);
    t.mock.timers.tick(45000);
    assert.equal(askErrors[0].code, "AI_REQUEST_TIMEOUT");
    assert.equal(ask.requestSignal.aborted, true);
  } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test("provider deadlines abort the operation and preserve the timeout error", async () => {
  let providerSignal;
  const failure = new AppError(504, "timed out", "AI_REQUEST_TIMEOUT");
  await assert.rejects(withAiDeadline((signal) => {
    providerSignal = signal;
    return new Promise(() => {});
  }, 5, failure), (error) => error === failure);
  assert.equal(providerSignal.aborted, true);
});

test("client disconnect cancels active work and a completed response does not", () => {
  for (const completed of [false, true]) {
    const req = { method: "POST", path: "/api/v1/ai/ask" };
    const res = fakeResponse();
    requestTimeout()(req, res, () => {});
    res.writableFinished = completed;
    res.emit("close");
    assert.equal(req.requestSignal.aborted, !completed);
  }
});

test("an already cancelled request does not start a provider call", async () => {
  const controller = new AbortController();
  const failure = new AppError(499, "cancelled", "REQUEST_CANCELLED");
  controller.abort(failure);
  let calls = 0;
  await assert.rejects(withAiDeadline(async () => { calls++; }, 100, new AppError(504, "timeout"), controller.signal), (error) => error === failure);
  assert.equal(calls, 0);
});
