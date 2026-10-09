STATES = {
    "DRAFT": "DRAFT",
    "SUBMITTED": "SUBMITTED",
    "MANAGER_APPROVED": "MANAGER_APPROVED",
    "HR_APPROVED": "HR_APPROVED",
    "COMPLETED": "COMPLETED",
    "REJECTED": "REJECTED",
}

PIPELINE = [
    STATES["DRAFT"],
    STATES["SUBMITTED"],
    STATES["MANAGER_APPROVED"],
    STATES["HR_APPROVED"],
    STATES["COMPLETED"],
]

STATE_LABELS = {
    "DRAFT": "Draft",
    "SUBMITTED": "Submitted",
    "MANAGER_APPROVED": "Manager Approved",
    "HR_APPROVED": "HR Approved",
    "COMPLETED": "Completed",
    "REJECTED": "Rejected",
}

TRANSITIONS = {
    "DRAFT": {"submit": "SUBMITTED"},
    "SUBMITTED": {"approve": "MANAGER_APPROVED", "reject": "REJECTED"},
    "MANAGER_APPROVED": {"approve": "HR_APPROVED", "reject": "REJECTED"},
    "HR_APPROVED": {"approve": "COMPLETED", "reject": "REJECTED"},
    "COMPLETED": {},
    "REJECTED": {},
}

STATUS_ALIASES = {
    "draft": "DRAFT",
    "submitted": "SUBMITTED",
    "pending_manager": "SUBMITTED",
    "manager_approved": "MANAGER_APPROVED",
    "pending_hr": "MANAGER_APPROVED",
    "hr_approved": "HR_APPROVED",
    "pending_complete": "HR_APPROVED",
    "completed": "COMPLETED",
    "rejected": "REJECTED",
}


class InvalidTransition(Exception):
    def __init__(self, message: str, details: dict):
        super().__init__(message)
        self.details = details
        self.status_code = 422


class UnknownStatus(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.status_code = 400


def allowed_transitions(state: str) -> list[dict]:
    mapping = TRANSITIONS.get(state, {})
    return [
        {
            "action": action,
            "nextState": next_state,
            "nextStateLabel": STATE_LABELS[next_state],
        }
        for action, next_state in mapping.items()
    ]


def resolve_status_filter(raw: str | None) -> str | None:
    if not raw:
        return None
    key = raw.strip().lower().replace(" ", "_").replace("-", "_")
    if key in STATUS_ALIASES:
        return STATUS_ALIASES[key]
    upper = raw.strip().upper().replace(" ", "_").replace("-", "_")
    if upper in STATES:
        return STATES[upper]
    raise UnknownStatus(
        f'Unknown status filter "{raw}". Use a workflow state or alias such as '
        "pending_manager, pending_hr, draft, completed, rejected."
    )


def apply_transition(current_state: str, action: str | None) -> str:
    normalized = (action or "").strip().lower()
    next_state = TRANSITIONS.get(current_state, {}).get(normalized)
    if not next_state:
        allowed = allowed_transitions(current_state)
        allowed_text = (
            "none (terminal state)"
            if not allowed
            else ", ".join(
                f"{t['action']} -> {t['nextStateLabel']} ({t['nextState']})" for t in allowed
            )
        )
        raise InvalidTransition(
            f'Invalid transition: action "{normalized or "(empty)"}" is not allowed from '
            f"{STATE_LABELS[current_state]} ({current_state}). Allowed: {allowed_text}.",
            {
                "currentState": current_state,
                "currentStateLabel": STATE_LABELS[current_state],
                "attemptedAction": normalized or None,
                "allowedTransitions": allowed,
            },
        )
    return next_state
