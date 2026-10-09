const { randomUUID } = require("crypto");
const {
  STATES,
  STATE_LABELS,
  PIPELINE,
  allowedTransitions,
  applyTransition,
  resolveStatusFilter,
} = require("./stateMachine");

const requests = new Map();

function nowIso() {
  return new Date().toISOString();
}

function appendEvent(request, { actorId, action, fromState, toState, comment }) {
  const event = {
    id: randomUUID(),
    actorId,
    action,
    fromState,
    fromStateLabel: fromState ? STATE_LABELS[fromState] : null,
    toState,
    toStateLabel: STATE_LABELS[toState],
    comment,
    timestamp: nowIso(),
  };
  request.timeline.push(event);
  request.updatedAt = event.timestamp;
  return event;
}

function toPublic(request) {
  return {
    id: request.id,
    employeeId: request.employeeId,
    employeeName: request.employeeName,
    leaveType: request.leaveType,
    startDate: request.startDate,
    endDate: request.endDate,
    reason: request.reason,
    status: request.status,
    statusLabel: STATE_LABELS[request.status],
    pipeline: PIPELINE,
    allowedTransitions: allowedTransitions(request.status),
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    timeline: request.timeline,
  };
}

function createRequest({ employeeId, employeeName, leaveType, startDate, endDate, reason, actorId }) {
  const id = randomUUID();
  const createdAt = nowIso();
  const request = {
    id,
    employeeId,
    employeeName,
    leaveType,
    startDate,
    endDate,
    reason,
    status: STATES.DRAFT,
    createdAt,
    updatedAt: createdAt,
    timeline: [],
  };
  appendEvent(request, {
    actorId: actorId || employeeId,
    action: "create",
    fromState: null,
    toState: STATES.DRAFT,
    comment: "Leave request created in Draft.",
  });
  requests.set(id, request);
  return toPublic(request);
}

function getRequest(id) {
  return requests.get(id) || null;
}

function listRequests(statusFilter) {
  const resolved = resolveStatusFilter(statusFilter);
  if (statusFilter && resolved === undefined) {
    const error = new Error(
      `Unknown status filter "${statusFilter}". Use a workflow state or alias such as pending_manager, pending_hr, draft, completed, rejected.`
    );
    error.statusCode = 400;
    throw error;
  }
  const items = [...requests.values()]
    .filter((r) => (resolved ? r.status === resolved : true))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map(toPublic);
  return { filter: resolved, count: items.length, items };
}

function transitionRequest(id, { actorId, action, comment }) {
  const request = requests.get(id);
  if (!request) return null;
  const fromState = request.status;
  const toState = applyTransition(fromState, action);
  request.status = toState;
  appendEvent(request, {
    actorId,
    action: String(action).trim().toLowerCase(),
    fromState,
    toState,
    comment,
  });
  return toPublic(request);
}

function seedDemoData() {
  createRequest({
    employeeId: "emp-101",
    employeeName: "Aisha Khan",
    leaveType: "annual",
    startDate: "2026-10-20",
    endDate: "2026-10-22",
    reason: "Family wedding",
  });

  const pendingManager = createRequest({
    employeeId: "emp-102",
    employeeName: "Rohit Mehta",
    leaveType: "sick",
    startDate: "2026-10-12",
    endDate: "2026-10-13",
    reason: "Medical appointment",
  });
  transitionRequest(pendingManager.id, {
    actorId: "emp-102",
    action: "submit",
    comment: "Submitting for manager review.",
  });

  const pendingHr = createRequest({
    employeeId: "emp-103",
    employeeName: "Priya Nair",
    leaveType: "annual",
    startDate: "2026-11-02",
    endDate: "2026-11-06",
    reason: "Diwali travel",
  });
  transitionRequest(pendingHr.id, {
    actorId: "emp-103",
    action: "submit",
    comment: "Please approve leave for Diwali.",
  });
  transitionRequest(pendingHr.id, {
    actorId: "mgr-7",
    action: "approve",
    comment: "Coverage confirmed on the team.",
  });
}

module.exports = {
  createRequest,
  getRequest,
  listRequests,
  transitionRequest,
  toPublic,
  seedDemoData,
};
