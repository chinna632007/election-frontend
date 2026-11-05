/**
* Thin fetch wrapper around the polling-duty backend.
*
* All requests are same-origin through the Vite dev proxy ("/api" -> backend,
* see vite.config.js). `credentials: "include"` is REQUIRED because the backend
* authenticates with an express-session cookie (connect.sid).
*
* Backend response convention: `{ ok: true, ... }` on success,
* `{ ok: false, error: "message" }` on failure.
*/

const API_BASE = import.meta.env.VITE_API_BASE || "/api";
let loginRedirectStarted = false;

/** Error carrying the HTTP status and the raw backend payload (if any). */
export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function parseResponse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Core request helper. Throws ApiError on network failure, non-2xx status, or
 * an `{ ok: false }` body — so callers only handle the happy path.
 */
export async function request(path, { method = "GET", body, signal } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: "include",
      signal,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    throw new ApiError(
      "Cannot reach the server. Is the backend running?",
      0,
      cause
    );
  }

  const data = await parseResponse(res);

  if (!res.ok || (data && data.ok === false)) {
    const message =
      (data && (data.error || data.message)) || `Request failed (${res.status})`;
    if (res.status === 401 && typeof window !== "undefined" &&
      window.location.pathname !== "/login" && !loginRedirectStarted) {
      loginRedirectStarted = true;
      const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const loginUrl = new URL("/login", window.location.origin);
      loginUrl.searchParams.set("returnTo", returnTo);
      window.location.replace(loginUrl.toString());
    }
    throw new ApiError(message, res.status, data);
  }

  return data;
}

/** Read a File as a base64 string (no data-URL prefix). */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new ApiError("Could not read the selected file.", 0));
    reader.readAsDataURL(file);
  });
}

/* ------------------------------- Auth ---------------------------------- */

/** Fetch the captcha SVG markup. Backend also stores the answer in session. */
export function getCaptcha(signal) {
  return fetch(`${API_BASE}/auth/captcha`, { credentials: "include", signal }).then(
    (res) => {
      if (!res.ok) {
        throw new ApiError(`Failed to load captcha (${res.status})`, res.status);
      }
      return res.text();
    }
  );
}

export const login = (creds) =>
  request("/auth/login", { method: "POST", body: creds });

export const logout = () => request("/auth/logout", { method: "POST" });

export const me = () => request("/auth/me");

export const listUsers = () => request("/auth/users");

export const deleteUser = (id) =>
  request(`/auth/users/${encodeURIComponent(id)}`, { method: "DELETE" });

/* ---------------------------- Workflow state -------------------------- */

export const getWorkflowData = (context, phase) =>
  request(`/workflow/${encodeURIComponent(context)}/${encodeURIComponent(phase)}`);

export const saveWorkflowData = (context, phase, value) =>
  request(`/workflow/${encodeURIComponent(context)}/${encodeURIComponent(phase)}`, {
    method: "PUT",
    body: { value },
  });

export const clearWorkflowData = (context, phase) =>
  request(`/workflow/${encodeURIComponent(context)}/${encodeURIComponent(phase)}`, {
    method: "DELETE",
  });

/** Release/clear workflow data for a given context and phase. */
export const release = (context, phase) => clearWorkflowData(context, phase);

/* ------------------------------ Imports -------------------------------- */

/** Upload one personnel proforma workbook (base64 JSON payload). */
export function uploadPersonnel(file, signal, requestId) {
  return fileToBase64(file).then((dataBase64) =>
    request(
      "/imports/personnel",
      { method: "POST", body: { fileName: file.name, dataBase64, ...(requestId ? { requestId } : {}) }, signal }
    )
  );
}

export const listBatches = () => request("/imports/batches");

export const getBatchPersonnel = (id) =>
  request(`/imports/batches/${id}/personnel`);

// Training: PO / APO separate allocation (work_mandal based).
export const getTrainingPAApoBatches = () =>
  request(`/imports/training/po-apo-batches`);
export const getBatchRejected = (id) =>
  request(`/imports/batches/${id}/rejected`);

/* --------------------- Micro Observer intake ------------------------- */

/**
 * Upload the separate Micro Observer file (bank staff: emp_mo shape).
 * Same base64-JSON format as personnel. Replaces the whole MO list;
 * rejected rows (incl. medical designations) are returned, not stored.
 */
export function uploadMicroObservers(file, signal) {
  return fileToBase64(file).then((dataBase64) =>
    request(
      "/imports/micro-observers",
      { method: "POST", body: { fileName: file.name, dataBase64 }, signal }
    )
  );
}

/** Upload training-locations workbook (venues for training batches). */
export function uploadTrainingLocations(file, signal) {
  return fileToBase64(file).then((dataBase64) =>
    request(
      "/imports/training-locations",
      { method: "POST", body: { fileName: file.name, dataBase64 }, signal }
    )
  );
}

/** Upload training-*sessions* workbook (schedule; title, session_type, mandal, venue, ...). */
export function uploadTrainingSessions(file, signal) {
  return fileToBase64(file).then((dataBase64) =>
    request(
      "/imports/training-sessions",
      { method: "POST", body: { fileName: file.name, dataBase64 }, signal }
    )
  );
}

/** Upload mandal-adjacency workbook (Mandal_Name, Near_Mandal_Names).
 * Replaces the whole table — drives near-mandal posting (Stage 2 + Stage 3). */
export function uploadMandalAdjacency(file, signal) {
  return fileToBase64(file).then((dataBase64) =>
    request(
      "/imports/mandal-adjacency",
      { method: "POST", body: { fileName: file.name, dataBase64 }, signal }
    )
  );
}

/** Read the current mandal-adjacency table (count + rows). */
export function listMandalAdjacency(signal) {
  return request("/imports/mandal-adjacency", { method: "GET", signal });
}

/** List training locations (venues). */
export const listTrainingLocations = () => request("/imports/training-locations");

/** List uploaded Micro Observers (authority/admin/staff). */
export const listMicroObservers = () => request("/imports/micro-observers");

/* --------------------------- Phase 3 – ballots --------------------------- */

/**
 * Upload the ballot register + Phase-2 officer lists; the backend parses the
 * register and allocates officers to ballots (one officer per ballot, never
 * reused; shortfall surfaced per row). Same base64-JSON convention as the
 * other uploads (no multipart needed); session cookie rides along because
 * `request()` sends credentials.
 */
export function allocateBallots({ file, presidingOfficers, pollingOfficers }, signal) {
  return fileToBase64(file).then((dataBase64) =>
    request("/randomization/ballot-allocation", {
      method: "POST",
      body: {
        fileName: file.name,
        dataBase64,
        presidingOfficers: presidingOfficers || [],
        pollingOfficers: pollingOfficers || [],
      },
      signal,
    })
  );
}

/* --------------------------- Polling stations ---------------------------- */

/** Import polling stations (validated JSON array shaped like the 003 schema). */
export const importStations = (fileName, stations) =>
  request('/master-data/stations', { method: 'POST', body: { fileName, stations } });

/** List polling stations (paginated server-side; page/limit optional). */
export const listStations = (params = {}) => {
  const qs = new URLSearchParams();
  if (params.batchId) qs.set('batchId', params.batchId);
  if (params.page) qs.set('page', params.page);
  if (params.limit) qs.set('limit', params.limit);
  const q = qs.toString() ? `?${qs}` : '';
  return request(`/master-data/stations${q}`);
};

/** List station import batches (kind='polling_stations'). */
export const listStationBatches = () => request('/master-data/stations/batches');

/* ---------------------------- Randomization ------------------------------ */

/**
 * Run the full allocation chain (Stage 1 -> Stage 2 + MO -> Stage 3).
 * Body: { electionConfiguration, designationRules, officeIdOverrides,
 *         personnelImportBatchId, stationImportBatchId, districtId, seed }.
 */
export const runAllocation = (body) =>
  request('/randomization/run', { method: 'POST', body });

/** Authorised disclosure of a completed Stage 3 mapping (records confirmer). */
export const publishAllocation = (stage3Run) =>
  request('/randomization/publish', { method: 'POST', body: { stage3Run } });

/* ----------------------------- Notifications ----------------------------- */

/** Provider/channel configuration status (read-only for all auth'd users). */
export const notificationChannels = () => request('/notifications/channels');

/** Render per-recipient messages without sending (authority/admin). */
export const previewNotifications = (body) =>
  request('/notifications/preview', { method: 'POST', body });

/** Authorised dispatch; requires confirmAllocation: true in body. */
export const sendNotifications = (body) =>
  request('/notifications/send', { method: 'POST', body });

/** Delivery-attempt records (authority/admin). */
export const notificationDeliveries = () => request('/notifications/deliveries');

/**
 * Send the Stage-3 duty notification for ONE team (authority/admin).
 * The server loads members + mobiles from the frozen roster, so the body
 * only carries the team code plus the explicit confirmation flag.
 */
export const sendTeamNotification = (teamCode) =>
  request('/notifications/send-team', {
    method: 'POST',
    body: { teamCode, confirmAllocation: true },
  });

/* -------------------------------- Reports -------------------------------- */

/** Last allocation run report (authority/admin). */
export const allocationReport = () => request('/reports/allocation');

/** Import data counts (all authenticated roles). */
export const summaryReport = () => request('/reports/summary');

/* -------------------------------- Training ------------------------------- */

/** List training batches (batch_no / mandal / location / member_count). */
export const listTrainingBatches = () => request('/training/batches');

/** Members of one training batch (id, employee_id, employee_name, rank, mandals). */
export const getBatchMembers = (id) =>
  request(`/training/batches/${id}/members`);

/** Candidate training locations for a batch (same mandal only). */
export const getBatchLocations = (id) =>
  request(`/training/batches/${id}/locations`);

/** Admin assigns (or clears) a batch's training location. locationId: number | null. */
export const assignBatchLocation = (batchId, locationId) =>
  request(`/training/batches/${batchId}/location`, {
    method: 'PATCH',
    body: { locationId },
  });

/** Remove a personnel member from a training batch (persisted). */
export const removeBatchMember = (batchId, personnelId) =>
  request(`/training/batches/${batchId}/members/${personnelId}`, {
    method: 'DELETE',
  });
export const listTrainingSessions = () => request('/training/sessions');

/** Create a training session (authority/admin). */
export const createTrainingSession = (body) =>
  request('/training/sessions', { method: 'POST', body });

/** Attendance for one session (all authenticated users). */
export const trainingAttendance = (id) =>
  request(`/training/sessions/${id}/attendance`);

/** Mark attendance records (authority/admin). Body: { records: [...] }. */
export const markTrainingAttendance = (id, records) =>
  request(`/training/sessions/${id}/attendance`, {
    method: 'POST',
    body: { records },
  });

/* --------------------------- Manual appointments -------------------------- */
/* Stage Officer II / counting team — admin picks personnel (not randomized). */

/** List manual appointments (optionally by orderKind). */
export const listOrderAssignments = (orderKind) =>
  request(`/imports/order-assignments${orderKind ? `?orderKind=${encodeURIComponent(orderKind)}` : ''}`);

/** Create a manual appointment (authority/admin). */
export const createOrderAssignment = (body) =>
  request('/imports/order-assignments', { method: 'POST', body });

/** Update a manual appointment's role/team/table/body/person (authority/admin). */
export const updateOrderAssignment = (id, body) =>
  request(`/imports/order-assignments/${id}`, { method: 'PATCH', body });

/** Delete a manual appointment (authority/admin). */
export const deleteOrderAssignment = (id) =>
  request(`/imports/order-assignments/${id}`, { method: 'DELETE' });

/** Generate the order .docx for an appointment (returns base64). */
export const generateOrder = (id) =>
  request(`/imports/order-assignments/${id}/generate`, { method: 'POST' });

/** Edit a personnel record (authority/admin). Allow-listed fields only. */
export const editPersonnel = (id, body) =>
  request(`/imports/personnel/${id}`, { method: 'PATCH', body });

/* ----------------------------- Training orders ---------------------------- */
/* PO/APO separate tables (migration 013). Built-in templates + ZIP download. */

/** Wipe + allocate PO/APO/OPO batches from the last Stage-2 run (duty mandal; MO remains separate). */
export const allocateTrainingOrders = () =>
  request('/imports/training-orders/allocate', { method: 'POST', body: {} });

/** Wipe every non-auth table (keeps users + roles). POST /imports/training-orders/wipe-all-data. */
export const wipeAllTrainingOrders = () =>
  request('/imports/training-orders/wipe-all-data', { method: 'POST', body: {} });

/** Generate one DOCX per PO, APO, or OPO (built-in templates). Body: { group }. */
export const generateTrainingOrders = (group, schedule = {}) =>
  request('/imports/training-orders/generate', {
    method: 'POST',
    body: { group, ...schedule },
  });

/** @deprecated use generateTrainingOrders */
export const printTrainingOrder = (body) =>
  generateTrainingOrders(body?.trainingGroup || body?.group || 'PO');

export const listTrainingOrders = (params) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  }
  const qs = q.toString();
  return request(`/imports/training-orders${qs ? `?${qs}` : ''}`);
};

/* ------------------------------ Settings ------------------------------- */

/** List admin-editable customization knobs (staff sees the public subset). */
export const listSettings = () => request('/settings');

/** Update one setting by key. Body: { value }. */
export const updateSetting = (key, value) =>
  request(`/settings/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body: { value },
  });

/** Recent setting changes audit trail (authority/admin). */
export const listSettingChanges = (limit) =>
  request(`/settings/changes${limit ? `?limit=${encodeURIComponent(String(limit))}` : ''}`);

/* ------------------------------ Fields ------------------------------- */

/** List admin-definable fields for an entity (personnel|station). */
export const listFields = (entity) => request(`/fields/${encodeURIComponent(entity)}`);

/** Create a custom field. */
export const createField = (input) =>
  request("/fields", { method: "POST", body: input });

/** Update a field by id (core fields: label/export only). */
export const updateField = (id, input) =>
  request(`/fields/${encodeURIComponent(id)}`, { method: "PATCH", body: input });

/** Soft-deactivate a custom field. */
export const deactivateField = (id) =>
  request(`/fields/${encodeURIComponent(id)}`, { method: "DELETE" });

export const listPoApoBatches = (group) =>
  request(`/imports/training-orders/batches?group=${encodeURIComponent(group)}`);

export const getPoApoBatchMembers = (group, id) =>
  request(`/imports/training-orders/batches/${id}/members?group=${encodeURIComponent(group)}`);

export const getPoApoBatchLocations = (group, id) =>
  request(`/imports/training-orders/batches/${id}/locations?group=${encodeURIComponent(group)}`);

/** Assign or clear a PO/APO/OPO batch location; locationId is a MongoDB ObjectId string or null. */
export const assignPoApoBatchLocation = (group, id, locationId) =>
  request(`/imports/training-orders/batches/${id}/location`, {
    method: 'PATCH',
    body: { group, locationId },
  });

async function triggerBlobDownload(res, fallbackName) {
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') || '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const fileName = match ? match[1] : fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { ok: true, fileName };
}

/** Download ZIP of generated orders. group: 'PO' | 'APO' | 'OPO' | 'ALL' */
export async function downloadTrainingOrdersZip(group = 'ALL') {
  let res;
  try {
    const q = encodeURIComponent(group || 'ALL');
    res = await fetch(`${API_BASE}/imports/training-orders/download-zip?group=${q}`, {
      credentials: 'include',
    });
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running?', 0);
  }
  if (!res.ok) {
    let message = `Download failed (${res.status})`;
    try {
      const data = JSON.parse(await res.text());
      if (data && (data.error || data.message)) message = data.error || data.message;
    } catch { /* non-JSON */ }
    throw new ApiError(message, res.status);
  }
  return triggerBlobDownload(res, `training-orders-${group || 'ALL'}.zip`);
}

/** Single order DOCX. */
export async function downloadTrainingOrder(group, id) {
  let res;
  try {
    res = await fetch(
      `${API_BASE}/imports/training-orders/${encodeURIComponent(group)}/${id}/download`,
      { credentials: 'include' }
    );
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running?', 0);
  }
  if (!res.ok) {
    let message = `Download failed (${res.status})`;
    try {
      const data = JSON.parse(await res.text());
      if (data && (data.error || data.message)) message = data.error || data.message;
    } catch { /* non-JSON */ }
    throw new ApiError(message, res.status);
  }
  return triggerBlobDownload(res, `training-order-${id}.docx`);
}
