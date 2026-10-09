const express = require("express");
const store = require("./store");
const { STATE_LABELS } = require("./stateMachine");

const router = express.Router();

function requireFields(body, fields) {
  const missing = fields.filter((f) => {
    const value = body?.[f];
    return value === undefined || value === null || String(value).trim() === "";
  });
  if (missing.length) {
    const error = new Error(`Missing required field(s): ${missing.join(", ")}`);
    error.statusCode = 400;
    throw error;
  }
}

router.post("/requests", (req, res, next) => {
  try {
    requireFields(req.body || {}, [
      "employeeId",
      "employeeName",
      "leaveType",
      "startDate",
      "endDate",
      "reason",
    ]);
    const created = store.createRequest({
      ...req.body,
      actorId: req.body.actorId || req.body.employeeId,
    });
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

router.get("/requests", (req, res, next) => {
  try {
    res.json(store.listRequests(req.query.status));
  } catch (err) {
    next(err);
  }
});

router.get("/requests/:id/timeline", (req, res, next) => {
  try {
    const request = store.getRequest(req.params.id);
    if (!request) {
      return res.status(404).json({ error: `Leave request ${req.params.id} not found.` });
    }
    const publicRequest = store.toPublic(request);
    res.json({
      id: publicRequest.id,
      status: publicRequest.status,
      statusLabel: publicRequest.statusLabel,
      timeline: publicRequest.timeline,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/requests/:id", (req, res, next) => {
  try {
    const request = store.getRequest(req.params.id);
    if (!request) {
      return res.status(404).json({ error: `Leave request ${req.params.id} not found.` });
    }
    res.json(store.toPublic(request));
  } catch (err) {
    next(err);
  }
});

router.post("/requests/:id/transition", (req, res, next) => {
  try {
    requireFields(req.body || {}, ["actorId", "action", "comment"]);
    const updated = store.transitionRequest(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ error: `Leave request ${req.params.id} not found.` });
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.use((err, _req, res, _next) => {
  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.message,
    ...(err.details || {}),
    states: STATE_LABELS,
  });
});

module.exports = router;
