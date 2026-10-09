const STATES = Object.freeze({
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
  MANAGER_APPROVED: "MANAGER_APPROVED",
  HR_APPROVED: "HR_APPROVED",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
});

const PIPELINE = [
  STATES.DRAFT,
  STATES.SUBMITTED,
  STATES.MANAGER_APPROVED,
  STATES.HR_APPROVED,
  STATES.COMPLETED,
];

const STATE_LABELS = {
  [STATES.DRAFT]: "Draft",
  [STATES.SUBMITTED]: "Submitted",
  [STATES.MANAGER_APPROVED]: "Manager Approved",
  [STATES.HR_APPROVED]: "HR Approved",
  [STATES.COMPLETED]: "Completed",
  [STATES.REJECTED]: "Rejected",
};

const TRANSITIONS = {
  [STATES.DRAFT]: { submit: STATES.SUBMITTED },
  [STATES.SUBMITTED]: { approve: STATES.MANAGER_APPROVED, reject: STATES.REJECTED },
  [STATES.MANAGER_APPROVED]: { approve: STATES.HR_APPROVED, reject: STATES.REJECTED },
  [STATES.HR_APPROVED]: { approve: STATES.COMPLETED, reject: STATES.REJECTED },
  [STATES.COMPLETED]: {},
  [STATES.REJECTED]: {},
};

const STATUS_ALIASES = {
  draft: STATES.DRAFT,
  submitted: STATES.SUBMITTED,
  pending_manager: STATES.SUBMITTED,
  manager_approved: STATES.MANAGER_APPROVED,
  pending_hr: STATES.MANAGER_APPROVED,
  hr_approved: STATES.HR_APPROVED,
  pending_complete: STATES.HR_APPROVED,
  completed: STATES.COMPLETED,
  rejected: STATES.REJECTED,
};

function allowedTransitions(state) {
  return Object.entries(TRANSITIONS[state] || {}).map(([action, nextState]) => ({
    action,
    nextState,
    nextStateLabel: STATE_LABELS[nextState],
  }));
}

function resolveStatusFilter(raw) {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (STATUS_ALIASES[key]) return STATUS_ALIASES[key];
  const upper = String(raw).trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (STATES[upper]) return STATES[upper];
  return undefined;
}

function applyTransition(currentState, action) {
  const normalized = String(action || "").trim().toLowerCase();
  const nextState = TRANSITIONS[currentState]?.[normalized];
  if (!nextState) {
    const allowed = allowedTransitions(currentState);
    const allowedText =
      allowed.length === 0
        ? "none (terminal state)"
        : allowed.map((t) => `${t.action} -> ${t.nextStateLabel} (${t.nextState})`).join(", ");
    const error = new Error(
      `Invalid transition: action "${normalized || "(empty)"}" is not allowed from ${STATE_LABELS[currentState]} (${currentState}). Allowed: ${allowedText}.`
    );
    error.statusCode = 422;
    error.details = {
      currentState,
      currentStateLabel: STATE_LABELS[currentState],
      attemptedAction: normalized || null,
      allowedTransitions: allowed,
    };
    throw error;
  }
  return nextState;
}

module.exports = {
  STATES,
  PIPELINE,
  STATE_LABELS,
  TRANSITIONS,
  allowedTransitions,
  resolveStatusFilter,
  applyTransition,
};
