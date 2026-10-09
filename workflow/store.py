from datetime import datetime, timezone
from uuid import uuid4

from .state_machine import (
    PIPELINE,
    STATE_LABELS,
    allowed_transitions,
    apply_transition,
    resolve_status_filter,
)

requests: dict[str, dict] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _append_event(request: dict, *, actor_id: str, action: str, from_state: str | None, to_state: str, comment: str):
    event = {
        "id": str(uuid4()),
        "actorId": actor_id,
        "action": action,
        "fromState": from_state,
        "fromStateLabel": STATE_LABELS.get(from_state) if from_state else None,
        "toState": to_state,
        "toStateLabel": STATE_LABELS[to_state],
        "comment": comment,
        "timestamp": _now(),
    }
    request["timeline"].append(event)
    request["updatedAt"] = event["timestamp"]
    return event


def to_public(request: dict) -> dict:
    return {
        "id": request["id"],
        "employeeId": request["employeeId"],
        "employeeName": request["employeeName"],
        "leaveType": request["leaveType"],
        "startDate": request["startDate"],
        "endDate": request["endDate"],
        "reason": request["reason"],
        "status": request["status"],
        "statusLabel": STATE_LABELS[request["status"]],
        "pipeline": PIPELINE,
        "allowedTransitions": allowed_transitions(request["status"]),
        "createdAt": request["createdAt"],
        "updatedAt": request["updatedAt"],
        "timeline": request["timeline"],
    }


def create_request(payload: dict) -> dict:
    created_at = _now()
    request_id = str(uuid4())
    request = {
        "id": request_id,
        "employeeId": payload["employeeId"].strip(),
        "employeeName": payload["employeeName"].strip(),
        "leaveType": payload["leaveType"].strip(),
        "startDate": payload["startDate"].strip(),
        "endDate": payload["endDate"].strip(),
        "reason": payload["reason"].strip(),
        "status": "DRAFT",
        "createdAt": created_at,
        "updatedAt": created_at,
        "timeline": [],
    }
    actor = (payload.get("actorId") or payload["employeeId"]).strip()
    _append_event(
        request,
        actor_id=actor,
        action="create",
        from_state=None,
        to_state="DRAFT",
        comment="Leave request created in Draft.",
    )
    requests[request_id] = request
    return to_public(request)


def get_request(request_id: str) -> dict | None:
    return requests.get(request_id)


def list_requests(status_filter: str | None) -> dict:
    resolved = resolve_status_filter(status_filter)
    items = [
        to_public(r)
        for r in sorted(requests.values(), key=lambda r: r["updatedAt"], reverse=True)
        if not resolved or r["status"] == resolved
    ]
    return {"filter": resolved, "count": len(items), "items": items}


def transition_request(request_id: str, payload: dict) -> dict | None:
    request = requests.get(request_id)
    if not request:
        return None
    from_state = request["status"]
    to_state = apply_transition(from_state, payload.get("action"))
    request["status"] = to_state
    _append_event(
        request,
        actor_id=payload["actorId"].strip(),
        action=payload["action"].strip().lower(),
        from_state=from_state,
        to_state=to_state,
        comment=payload["comment"].strip(),
    )
    return to_public(request)


def seed_demo_data() -> None:
    create_request(
        {
            "employeeId": "emp-101",
            "employeeName": "Aisha Khan",
            "leaveType": "annual",
            "startDate": "2026-10-20",
            "endDate": "2026-10-22",
            "reason": "Family wedding",
        }
    )

    pending_manager = create_request(
        {
            "employeeId": "emp-102",
            "employeeName": "Rohit Mehta",
            "leaveType": "sick",
            "startDate": "2026-10-12",
            "endDate": "2026-10-13",
            "reason": "Medical appointment",
        }
    )
    transition_request(
        pending_manager["id"],
        {"actorId": "emp-102", "action": "submit", "comment": "Submitting for manager review."},
    )

    pending_hr = create_request(
        {
            "employeeId": "emp-103",
            "employeeName": "Priya Nair",
            "leaveType": "annual",
            "startDate": "2026-11-02",
            "endDate": "2026-11-06",
            "reason": "Diwali travel",
        }
    )
    transition_request(
        pending_hr["id"],
        {"actorId": "emp-103", "action": "submit", "comment": "Please approve leave for Diwali."},
    )
    transition_request(
        pending_hr["id"],
        {"actorId": "mgr-7", "action": "approve", "comment": "Coverage confirmed on the team."},
    )
