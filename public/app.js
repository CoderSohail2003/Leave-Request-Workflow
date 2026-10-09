const listEl = document.getElementById("requestList");
const filterEl = document.getElementById("statusFilter");
const detailEl = document.getElementById("detail");
const emptyEl = document.getElementById("emptyState");
const metaEl = document.getElementById("meta");
const stepperEl = document.getElementById("stepper");
const timelineEl = document.getElementById("timeline");
const actionEl = document.getElementById("action");
const allowedHint = document.getElementById("allowedHint");
const formError = document.getElementById("formError");
const createError = document.getElementById("createError");
const rejectedBanner = document.getElementById("rejectedBanner");
const transitionForm = document.getElementById("transitionForm");

let selectedId = null;
let current = null;

async function api(path, options) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText);
    err.payload = data;
    throw err;
  }
  return data;
}

async function loadList() {
  const status = filterEl.value;
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await api(`/requests${qs}`);
  listEl.innerHTML = "";
  if (!data.items.length) {
    listEl.innerHTML = `<p class="empty">No requests for this filter.</p>`;
    return;
  }
  for (const item of data.items) {
    const btn = document.createElement("button");
    btn.className = `request-card${item.id === selectedId ? " active" : ""}`;
    btn.type = "button";
    const badgeClass =
      item.status === "REJECTED" ? "rejected" : item.status === "COMPLETED" ? "completed" : "";
    btn.innerHTML = `
      <strong>${item.employeeName}</strong>
      <span class="badge ${badgeClass}">${item.statusLabel}</span>
      <small>${item.leaveType} · ${item.startDate} → ${item.endDate}</small>
    `;
    btn.addEventListener("click", () => selectRequest(item.id));
    listEl.appendChild(btn);
  }
}

function lastPipelineState(request) {
  if (request.status !== "REJECTED") return request.status;
  const rejectEvent = [...request.timeline].reverse().find((e) => e.toState === "REJECTED");
  return rejectEvent?.fromState || "SUBMITTED";
}

function renderStepper(request) {
  stepperEl.innerHTML = "";
  const focusState = lastPipelineState(request);
  const currentIndex = request.pipeline.indexOf(focusState);
  const isRejected = request.status === "REJECTED";
  request.pipeline.forEach((state, index) => {
    const li = document.createElement("li");
    const reached = currentIndex >= index;
    const isCurrent = !isRejected && request.status === state;
    li.className = isCurrent ? "current" : reached ? "done" : "";
    if (isRejected && index === currentIndex) li.classList.add("rejected-path");
    const label = state
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    li.innerHTML = `<div class="dot"></div><div class="bar"></div><div class="label">${label}</div>`;
    stepperEl.appendChild(li);
  });
  rejectedBanner.classList.toggle("hidden", !isRejected);
}

function renderDetail(request) {
  current = request;
  emptyEl.classList.add("hidden");
  detailEl.classList.remove("hidden");
  metaEl.innerHTML = `
    <div><span>Employee</span><strong>${request.employeeName} (${request.employeeId})</strong></div>
    <div><span>Status</span><strong>${request.statusLabel}</strong></div>
    <div><span>Dates</span><strong>${request.startDate} → ${request.endDate}</strong></div>
    <div><span>Reason</span><strong>${request.reason}</strong></div>
  `;
  renderStepper(request);
  actionEl.innerHTML = "";
  if (!request.allowedTransitions.length) {
    allowedHint.textContent = "No further transitions. This is a terminal state.";
    transitionForm.querySelector("button").disabled = true;
  } else {
    transitionForm.querySelector("button").disabled = false;
    allowedHint.textContent =
      "Allowed from here: " +
      request.allowedTransitions
        .map((t) => `${t.action} → ${t.nextStateLabel}`)
        .join(" · ");
    for (const t of request.allowedTransitions) {
      const opt = document.createElement("option");
      opt.value = t.action;
      opt.textContent = `${t.action} → ${t.nextStateLabel}`;
      actionEl.appendChild(opt);
    }
  }
  timelineEl.innerHTML = request.timeline
    .slice()
    .reverse()
    .map(
      (e) => `
      <li>
        <div class="who">${e.actorId} · ${e.action}</div>
        <div>${e.fromStateLabel || "—"} → ${e.toStateLabel}</div>
        <div>${e.comment}</div>
        <time>${new Date(e.timestamp).toLocaleString()}</time>
      </li>`
    )
    .join("");
}

async function selectRequest(id) {
  selectedId = id;
  const request = await api(`/requests/${id}`);
  renderDetail(request);
  await loadList();
}

filterEl.addEventListener("change", () => loadList().catch(console.error));

transitionForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  formError.textContent = "";
  if (!selectedId) return;
  try {
    const updated = await api(`/requests/${selectedId}/transition`, {
      method: "POST",
      body: JSON.stringify({
        actorId: document.getElementById("actorId").value,
        action: actionEl.value,
        comment: document.getElementById("comment").value,
      }),
    });
    document.getElementById("comment").value = "";
    renderDetail(updated);
    await loadList();
  } catch (err) {
    formError.textContent = err.message;
  }
});

document.getElementById("createForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  createError.textContent = "";
  const form = e.currentTarget;
  const body = Object.fromEntries(new FormData(form).entries());
  try {
    const created = await api("/requests", { method: "POST", body: JSON.stringify(body) });
    selectedId = created.id;
    renderDetail(created);
    await loadList();
  } catch (err) {
    createError.textContent = err.message;
  }
});

loadList()
  .then(async () => {
    const data = await api("/requests");
    if (data.items[0]) await selectRequest(data.items[0].id);
  })
  .catch((err) => {
    listEl.textContent = err.message;
  });
