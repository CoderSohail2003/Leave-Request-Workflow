from flask import Flask, jsonify, request, send_from_directory

from workflow import store
from workflow.state_machine import STATE_LABELS, InvalidTransition, UnknownStatus

app = Flask(__name__, static_folder="public", static_url_path="")
store.seed_demo_data()


class BadRequest(Exception):
    def __init__(self, message: str):
        super().__init__(message)
        self.status_code = 400


def require_fields(body: dict, fields: list[str]) -> None:
    missing = [f for f in fields if not str((body or {}).get(f, "")).strip()]
    if missing:
        raise BadRequest(f"Missing required field(s): {', '.join(missing)}")


@app.errorhandler(BadRequest)
@app.errorhandler(InvalidTransition)
@app.errorhandler(UnknownStatus)
def handle_known(err):
    payload = {"error": str(err), "states": STATE_LABELS}
    if isinstance(err, InvalidTransition):
        payload.update(err.details)
    return jsonify(payload), err.status_code


@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.post("/requests")
def create_request():
    body = request.get_json(silent=True) or {}
    require_fields(body, ["employeeId", "employeeName", "leaveType", "startDate", "endDate", "reason"])
    created = store.create_request(body)
    return jsonify(created), 201


@app.get("/requests")
def list_requests():
    return jsonify(store.list_requests(request.args.get("status")))


@app.get("/requests/<request_id>")
def get_request(request_id: str):
    found = store.get_request(request_id)
    if not found:
        return jsonify({"error": f"Leave request {request_id} not found."}), 404
    return jsonify(store.to_public(found))


@app.get("/requests/<request_id>/timeline")
def get_timeline(request_id: str):
    found = store.get_request(request_id)
    if not found:
        return jsonify({"error": f"Leave request {request_id} not found."}), 404
    public = store.to_public(found)
    return jsonify(
        {
            "id": public["id"],
            "status": public["status"],
            "statusLabel": public["statusLabel"],
            "timeline": public["timeline"],
        }
    )


@app.post("/requests/<request_id>/transition")
def transition(request_id: str):
    body = request.get_json(silent=True) or {}
    require_fields(body, ["actorId", "action", "comment"])
    updated = store.transition_request(request_id, body)
    if not updated:
        return jsonify({"error": f"Leave request {request_id} not found."}), 404
    return jsonify(updated)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=3000, debug=False)
