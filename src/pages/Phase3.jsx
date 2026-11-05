import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import "./Phase1.css"; // reuse shared chrome (page, shell, breadcrumb, title, stats, table, pagination, search, upload cards…)
import "./Phase3.css"; // Phase 3 specifics (allocate button, allocation badges, slot table)
import Header from "../components/Header.jsx";
import WorkflowNavigation from "../components/WorkflowNavigation.jsx";
import {
  allocateBallots,
  allocationReport,
  sendTeamNotification,
  getWorkflowData,
  saveWorkflowData,
  clearWorkflowData,
  listPoApoBatches,
  getPoApoBatchMembers,
  listTrainingLocations,
} from "../api/client.js";

/**
 * Phase 3 – Ballot Allocation
 * ---------------------------
 * ONE file is uploaded here: the Ballot register. The Presiding / Polling
 * officers produced by Phase 2 are loaded from MongoDB. On clicking
 * "Allocate", the ballot file + the officer lists are POSTed to the backend,
 * which applies the allocation rules (which officer gets which ballot) and
 * returns the allocated list. This page only renders that backend response.
 *
 * Micro-officers live on Phase 2 / Training (not here).
 *
 * Expected backend response:
 *   {
 *     summary: { totalBallots, allocated, presidingCount, pollingCount },
 *     rows: [
 *       { ballotId, ballotUnit/psNo, presidingOfficer, pollingOfficer,
 *         mandal, status, remarks }, ...
 *     ]
 *   }
 *
 * USE_MOCK = true previews the UI with fabricated data (no backend required).
 */

const USE_MOCK = false;
const ACCEPTED = [".xlsx", ".xls", ".csv"];
const PAGE_SIZE = 10;
/* ------------------------------- icons -------------------------------- */

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 9.5 12 3l9 6.5" />
      <path d="M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function CloudUpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 13v8" />
      <path d="m8 17 4-4 4 4" />
      <path d="M20.39 18.39A2 2 0 0 0 22 16.5a2 2 0 0 0-2-2h-1.26A8 8 0 1 0 4 12.75" />
    </svg>
  );
}

function DocIcon({ style } = {}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ width: 14, height: 14, flexShrink: 0, ...style }}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 21h8M12 17v4" />
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4z" />
      <path d="M17 5h2a2 2 0 0 1 0 4h-.5" />
      <path d="M7 5H5a2 2 0 0 0 0 4h.5" />
    </svg>
  );
}

function BadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2 4 6v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V6l-8-4z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.07 0l1.41-1.41a5 5 0 0 0-7.07-7.07L10 5.93" />
      <path d="M14 11a5 5 0 0 0-7.07 0L5.5 12.5a5 5 0 0 0 7.07 7.07L14 18.07" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/* ------------------------------- helpers ------------------------------ */

function pick(obj, ...keys) {
  for (const k of keys) {
    const v = obj?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function statusKey(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("reject") || s.includes("unassign") || s.includes("pend")) return "rejected";
  if (s.includes("approve") || s.includes("allocat") || s.includes("eligib") || s.includes("valid")) return "approved";
  return "review";
}

/** Map a backend row onto the allocation table (tolerant of casing/keys). */
function normalizeRow(raw) {
  const statusRaw = pick(raw, "status", "allocationStatus", "result") || "Allocated";
  const buildingName = pick(raw, "buildingName", "building_name", "building") || "";
  const street = pick(raw, "street", "street_name", "road") || "";
  const locality = pick(raw, "locality", "village", "area") || "";
  const ward = pick(raw, "ward", "ward_name", "ward_number", "wardNo") || "";
  const mandal = pick(raw, "mandal", "workMandal", "wardMandal", "zone") || "—";
  const district = pick(raw, "district", "district_name") || "";
  const pinCode = pick(raw, "pinCode", "pin_code", "pincode", "pin") || "";

  let stationAddress = pick(raw, "stationAddress", "station_address", "address", "completeAddress");
  if (!stationAddress || stationAddress === "—") {
    const parts = [];
    if (buildingName) parts.push(buildingName);
    if (street) parts.push(street);
    if (locality) parts.push(locality);
    if (ward) parts.push(String(ward).toLowerCase().startsWith("ward") ? ward : `Ward ${ward}`);
    if (mandal && mandal !== "—") parts.push(mandal);
    if (district) parts.push(district);
    if (pinCode) parts.push(`PIN: ${pinCode}`);
    stationAddress = parts.join(", ");
  }

  return {
    sno: pick(raw, "sno", "sNo", "srNo", "sl", "serial", "id") ?? "—",
    teamCode: pick(raw, "teamCode", "team_code", "teamId", "team_id") ?? "—",
    ballotId: pick(raw, "ballotId", "ballotID", "ballotNo", "ballot_no", "ballot", "stationId", "station_id") ?? "—",
    psNo: pick(raw, "psNo", "psNumber", "pollingStation", "ps_no", "unit", "ballotUnit", "stationNo", "station_number") ?? "—",
    psName: pick(raw, "psName", "stationName", "location", "pollingStationName", "station_name", "buildingName", "venue") ?? "",
    stationName: pick(raw, "stationName", "station_name", "psName") || "",
    buildingName: buildingName || "—",
    street: street || "—",
    locality: locality || "—",
    ward: ward || "—",
    district: district || "—",
    pinCode: pinCode || "—",
    stationAddress: stationAddress || "—",
    presidingOfficer: pick(raw, "presidingOfficer", "presidingOfficerName", "presiding", "poName", "presiding_officer") ?? "—",
    pollingOfficer: pick(raw, "pollingOfficer", "pollingOfficerName", "polling_officer", "polling", "apoName") ?? "—",
    mandal,
    status: statusRaw,
    remarks: pick(raw, "remarks", "remark", "note", "reason") ?? "",
    _statusKey: statusKey(statusRaw),
  };
}

function normalizeSummary(data, rows) {
  const sum = data?.summary ?? {};
  const approved = num(sum.allocated, rows.filter((r) => r._statusKey === "approved").length);
  return {
    totalBallots: num(sum.totalBallots, rows.length),
    allocated: approved,
    presidingCount: num(sum.presidingCount, new Set(rows.map((r) => r.presidingOfficer).filter((v) => v && v !== "—")).size),
    pollingCount: num(sum.pollingCount, new Set(rows.map((r) => r.pollingOfficer).filter((v) => v && v !== "—")).size),
  };
}

function pageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, current]);
  if (current - 1 > 0) set.add(current - 1);
  if (current + 1 <= total) set.add(current + 1);
  if (current <= 3) { set.add(2); set.add(3); set.add(4); }
  if (current >= total - 2) { set.add(total - 1); set.add(total - 2); set.add(total - 3); }
  const sorted = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out = [];
  let prev;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

/** Team-role groups shown below the Phase 3 allocation table.
 * New formation: 1 PO (Presiding Officer), 1 APO (Assistant Polling Officer,
 * non-gazetted School Assistant), 4 OPOs (Other / normal Polling Officers).
 * MO and any unassigned officer are not assigned here. APO is displayed
 * distinctly from OPO ("normal polling officer").
 */
const PO_ROLES = new Set(["Presiding Officer"]);
const APO_ROLES = new Set(["APO", "Assistant Polling Officer", "Assistant Presiding Officer"]);
const OPO_ROLES = new Set(["OPO", "Other Polling Officer", "Polling Officer"]);
const MO_ROLES = new Set(["MO", "Micro Observer"]);

/** Treat "na" / empty / unknown roles as unassigned — never force them into APO or OPO. */
function isNaRole(role) {
  const r = (role || "").toString().trim().toLowerCase();
  return r === "" || r === "na" || r === "n/a" || r === "null" || r === "undefined";
}

/** Read the officers saved by Phase 2 in MongoDB. */
function loadOfficers(rows, moList = []) {
  if (!Array.isArray(rows))
    return { presiding: [], polling: [], apo: [], opo: [], micro: [], na: [], hasOfficers: false };
  const roleOf = (r) => String(r.role || "").trim();
  const presiding = rows.filter((r) => PO_ROLES.has(roleOf(r))).map((r) => r.employeeName);
  const apo = rows.filter((r) => APO_ROLES.has(roleOf(r))).map((r) => r.employeeName);
  // OPO = normal/other polling officers (distinct from APO).
  const opo = rows.filter((r) => OPO_ROLES.has(roleOf(r))).map((r) => r.employeeName);
  const microFromRows = rows.filter((r) => r.isMicroObserver || MO_ROLES.has(roleOf(r))).map((r) => r.employeeName || r.name);
  const microFromList = Array.isArray(moList) ? moList.map((m) => m.name || m.employeeName || m.officerName).filter(Boolean) : [];
  const micro = microFromRows.length > 0 ? microFromRows : microFromList;
  const na = rows.filter((r) => isNaRole(roleOf(r))).map((r) => r.employeeName);
  // polling = every polling officer (APO + OPO) kept for the Phase 3 allocation API.
  const polling = [...apo, ...opo];
  return {
    presiding,
    polling,
    apo,
    opo,
    micro,
    na,
    hasOfficers: presiding.length + polling.length > 0,
  };
}

/** Build demo allocation data so the page is previewable without a backend. */
function mockAllocate() {
  const presidingPool = ["Venkatesh M", "G. Nagesh", "Sai Krishna", "Hari Prasad", "Suresh Babu"];
  const pollingPool = ["Deepika Rani", "Jyothi K", "Padma V", "Rajesh K", "Swapna", "Krishna M", "Mahesh B", "Sunitha"];
  const mandals = ["Kakinada", "Samalkot", "Pithapuram", "Tuni", "Peddapuram"];
  const rows = [];
  const total = 24;
  for (let i = 1; i <= total; i++) {
    rows.push({
      sno: i,
      ballotId: `BAL-${String(i).padStart(3, "0")}`,
      psNo: `PS-${120 + i}`,
      presidingOfficer: presidingPool[i % presidingPool.length],
      pollingOfficer: pollingPool[i % pollingPool.length],
      mandal: mandals[i % mandals.length],
      status: "Allocated",
      remarks: "",
    });
  }
  const summary = {
    totalBallots: total,
    allocated: total,
    presidingCount: new Set(rows.map((r) => r.presidingOfficer)).size,
    pollingCount: new Set(rows.map((r) => r.pollingOfficer)).size,
  };
  return { summary, rows };
}


/* ---------------------------- sub-components -------------------------- */

function StatusBadge({ row }) {
  if (row._statusKey === "approved") {
    return (
      <span className="p1-badge p1-badge-approved">
        <CheckIcon /> {row.status}
      </span>
    );
  }
  if (row._statusKey === "rejected") {
    return (
      <span className="p1-badge p1-badge-rejected">
        <CrossIcon /> {row.status}
      </span>
    );
  }
  return (
    <span className="p1-badge p1-badge-review">
      {row.status}
    </span>
  );
}

/** A compact officer-count chip used in the "from Phase 2" summary strip. */
function OfficerCount({ icon, label, count, tone }) {
  return (
    <div className={`p3-officer-pill ${tone}`}>
      <span className="p3-officer-pill-icon">{icon}</span>
      <span className="p3-officer-pill-meta">
        <span className="p3-officer-pill-count">{count}</span>
        <span className="p3-officer-pill-label">{label}</span>
      </span>
    </div>
  );
}


/* ------------------------------- page --------------------------------- */

export default function Phase3({ context = "municipal" }) {
  const isMunicipal = context === "municipal";
  const contextLabel = isMunicipal ? "Municipal Elections" : "Gram Panchayat Elections";
  const backHref = isMunicipal ? "/elections/municipal" : "/elections/panchayat";

  // Primary component state
  const [phase2Rows, setPhase2Rows] = useState([]);
  const [phase2MoList, setPhase2MoList] = useState([]);
  const [result, setResult] = useState(null); // { summary, rows }
  const [ballotFile, setBallotFile] = useState(null);
  const ballotInputRef = useRef(null);
  const [ballotDrag, setBallotDrag] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | allocating | done | error
  const [errorMsg, setErrorMsg] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | allocated | rejected
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [showRemainingStations, setShowRemainingStations] = useState(false);
  const [remainingStationsPage, setRemainingStationsPage] = useState(1);
  const [viewCategory, setViewCategory] = useState("all"); // "all" (No choice) | "PO-APO" | "MO"
  const [downloadCategory, setDownloadCategory] = useState("PO-APO"); // "PO-APO" | "MO"

  // Presiding / Polling officers from the Phase 2 MongoDB snapshot.
  const officers = useMemo(() => loadOfficers(phase2Rows, phase2MoList), [phase2Rows, phase2MoList]);

  // Lookup map to find team code for any officer by name or employeeId
  const teamByOfficer = useMemo(() => {
    const map = new Map();
    for (const r of phase2Rows) {
      if (!r.teamCode) continue;
      if (r.employeeName) map.set(String(r.employeeName).trim().toLowerCase(), r.teamCode);
      if (r.employeeId) map.set(String(r.employeeId).trim().toLowerCase(), r.teamCode);
    }
    return map;
  }, [phase2Rows]);

  // Duty allocation (Stage 2 teams -> Stage 3 station allotment) from the last
  // run — verification view. Loaded once; the send button posts per team.
  const [duty, setDuty] = useState(null); // { runAt, stage2, stage3, counts }
  const [dutyError, setDutyError] = useState("");
  const [sendState, setSendState] = useState({}); // teamCode -> { pending, msg, tone }
  const [dutyRoleFilter, setDutyRoleFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    allocationReport()
      .then((data) => {
        if (!cancelled) setDuty(data);
      })
      .catch((e) => {
        if (!cancelled) setDutyError(e.message || "Failed to load duty allocation");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // One row per Stage-2 team with its Stage-3 station joined by teamCode.
  // Members carry the full officer allocation profile (employee ID, designation,
  // MO flag, venue/ballot code + duty mandal from the frozen roster).
  const dutyRows = useMemo(() => {
    const parties = duty?.stage2?.parties || [];
    const assigns = duty?.stage3?.assignments || [];
    const byTeam = new Map(assigns.map((a) => [a.teamCode, a]));
    return parties.map((p) => {
      const members = (p.members || [])
        .map((m) => ({
          employeeId: m.employeeId ?? m.employee_id ?? m.personnelId ?? null,
          name: m.name,
          role: m.role,
          designation: m.designation,
          isMicroObserver: !!m.isMicroObserver,
          workMandal: m.workMandal ?? m.work_mandal ?? null,
          nativeMandal: m.nativeMandal ?? m.native_mandal ?? null,
          venueCode: m.venueCode ?? m.venue_code ?? null,
          dutyMandal: m.dutyMandal ?? m.duty_mandal ?? null,
        }))
        .filter((m) => m.name || m.employeeId);
      return { ...p, members, assignment: byTeam.get(p.teamCode) || null };
    });
  }, [duty]);

  const dutyOfficerRows = useMemo(() => dutyRows.flatMap((team) =>
    (team.members || []).map((member) => ({
      teamCode: team.teamCode || "—",
      role: member.isMicroObserver ? "MO"
        : APO_ROLES.has(String(member.role || "").trim()) ? "APO"
          : OPO_ROLES.has(String(member.role || "").trim()) ? "OPO"
            : PO_ROLES.has(String(member.role || "").trim()) ? "PO"
              : member.role || "Unassigned",
      employeeId: member.employeeId || "—",
      name: member.name || "—",
      designation: member.designation || "—",
      workMandal: member.workMandal || "—",
      nativeMandal: member.nativeMandal || "—",
      station: team.assignment?.stationCode || team.assignment?.stationId || team.assignment?.ballotId || "—",
      mandal: team.assignment?.stationMandal || team.postingMandal || "—",
      stationAddress: [
        team.assignment?.stationName,
        team.assignment?.buildingName,
        team.assignment?.street,
        team.assignment?.locality,
        team.assignment?.ward && `Ward ${team.assignment.ward}`,
        team.assignment?.stationMandal,
        team.assignment?.district,
        team.assignment?.pinCode,
      ].filter(Boolean).join(", ") || "—",
    }))
  ), [dutyRows]);

  const visibleDutyOfficerRows = dutyRoleFilter === "all"
    ? dutyOfficerRows
    : dutyRoleFilter === "PO-APO"
      ? dutyOfficerRows.filter((member) => member.role === "PO" || member.role === "APO")
      : dutyOfficerRows.filter((member) => member.role === dutyRoleFilter);

  // Micro Observer assigned to each team
  const moByTeam = useMemo(() => {
    const map = new Map();
    for (const r of phase2Rows) {
      if (r.teamCode && (r.isMicroObserver || r.role === "Micro Observer" || r.role === "MO" || r.teamRole?.includes("Micro Observer") || r.teamRole?.includes("MO"))) {
        map.set(r.teamCode, r.employeeName || r.name || "—");
      }
    }
    for (const tm of dutyRows) {
      if (!tm.teamCode) continue;
      for (const m of tm.members || []) {
        if (m.isMicroObserver || m.role === "Micro Observer" || m.role === "MO") {
          map.set(tm.teamCode, m.name || m.employeeName || "—");
        }
      }
    }
    if (Array.isArray(phase2MoList)) {
      for (const m of phase2MoList) {
        if (m.teamCode) {
          map.set(m.teamCode, m.employeeName || m.name || m.officerName || "—");
        }
      }
    }
    return map;
  }, [phase2Rows, dutyRows, phase2MoList]);

  const unallocatedStations = useMemo(() => {
    if (!result?.rows) return [];
    return result.rows.filter(
      (r) =>
        r.statusKey === "rejected" ||
        r.statusKey === "pending" ||
        !r.presidingOfficer ||
        String(r.remarks || "").toLowerCase().includes("unassigned") ||
        String(r.remarks || "").toLowerCase().includes("not allotted")
    );
  }, [result]);

  const unallocatedTeams = useMemo(() => {
    return dutyRows.filter((r) => !r.assignment || !r.assignment?.stationId);
  }, [dutyRows]);

  async function onSendNotification(teamCode, memberCount) {
    const confirmed = window.confirm(
      `Send the duty notification for team ${teamCode} to ${memberCount} member(s) via the configured channels (SMS / WhatsApp)?`
    );
    if (!confirmed) return;
    setSendState((s) => ({ ...s, [teamCode]: { pending: true, msg: "" } }));
    try {
      const res = await sendTeamNotification(teamCode);
      const sum = res.summary || {};
      const by = sum.byChannel || {};
      const bits = [];
      for (const ch of ["sms", "whatsapp"]) {
        if (!by[ch]) continue;
        const c = by[ch];
        let bit = `${ch.toUpperCase()}: ${c.delivered || 0} delivered`;
        if (c.failed) bit += `, ${c.failed} failed`;
        if (c.unavailable) bit += `, ${c.unavailable} unavailable`;
        bits.push(bit);
      }
      setSendState((s) => ({
        ...s,
        [teamCode]: {
          pending: false,
          msg: bits.join(" · ") || `Sent ${sum.sent || 0} message(s)`,
          tone: (sum.failed || 0) > 0 ? "warn" : "ok",
        },
      }));
    } catch (e) {
      setSendState((s) => ({
        ...s,
        [teamCode]: { pending: false, msg: e.message || "Send failed", tone: "warn" },
      }));
    }
  }

  useEffect(() => {
    let cancelled = false;
    setPhase2Rows([]);
    setResult(null);
    setStatus("idle");
    setErrorMsg("");
    (async () => {
      try {
        const [phase2, phase3] = await Promise.all([
          getWorkflowData(context, "phase2"),
          getWorkflowData(context, "phase3"),
        ]);
        if (cancelled) return;
        const savedRows = Array.isArray(phase2?.value?.rows) ? phase2.value.rows : [];
        const savedMoList = Array.isArray(phase2?.value?.moList) ? phase2.value.moList : [];
        setPhase2Rows(savedRows);
        setPhase2MoList(savedMoList);

        if (savedRows.length === 0) {
          clearWorkflowData(context, "phase3").catch(() => {});
          setResult({ summary: { total: 0, mapped: 0, unmapped: 0, byRole: {} }, rows: [] });
          setStatus("idle");
          return;
        }

        const savedResult = phase3?.value;
        if (Array.isArray(savedResult?.rows) && savedResult.rows.length > 0) {
          const map = new Map();
          for (const r of savedRows) {
            if (!r.teamCode) continue;
            if (r.employeeName) map.set(String(r.employeeName).trim().toLowerCase(), r.teamCode);
            if (r.employeeId) map.set(String(r.employeeId).trim().toLowerCase(), r.teamCode);
          }
          const mappedRows = savedResult.rows.map((r) => {
            const poKey = String(r.presidingOfficer || "").trim().toLowerCase();
            const opoKey = String(r.pollingOfficer || "").trim().toLowerCase();
            const tc = r.teamCode && r.teamCode !== "—" ? r.teamCode : (map.get(poKey) || map.get(opoKey) || "—");
            return { ...r, teamCode: tc };
          });
          setResult({ summary: savedResult.summary, rows: mappedRows });
          setStatus("done");
        }
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg(error?.message || "Failed to load Phase 3 data from MongoDB.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [context]);

  function validateAndSet(next, setter) {
    if (!next) return;
    const ok = ACCEPTED.some((ext) => next.name.toLowerCase().endsWith(ext));
    if (!ok) {
      setStatus("error");
      setErrorMsg("Unsupported file type. Please upload an .xlsx, .xls or .csv file.");
      return;
    }
    setter(next);
    setErrorMsg("");
    if (status === "error") setStatus("idle");
  }

  function onBallotPick(e) { validateAndSet(e.target.files?.[0], setBallotFile); }
  function onBallotDrop(e) { e.preventDefault(); setBallotDrag(false); validateAndSet(e.dataTransfer.files?.[0], setBallotFile); }

  function clearBallot() {
    setBallotFile(null);
    if (ballotInputRef.current) ballotInputRef.current.value = "";
  }

  async function reset() {
    setErrorMsg("");
    try {
      await clearWorkflowData(context, "phase3");
    } catch (error) {
      setStatus("error");
      setErrorMsg(error?.message || "Failed to clear Phase 3 data from MongoDB.");
      return;
    }
    setBallotFile(null);
    setResult(null);
    setStatus("idle");
    setQuery("");
    setStatusFilter("all");
    setViewCategory("all");
    setDownloadCategory("PO-APO");
    setPage(1);
    if (ballotInputRef.current) ballotInputRef.current.value = "";
  }

  async function allocate() {
    if (!ballotFile) {
      setStatus("error");
      setErrorMsg("Please upload the Ballot Excel file first.");
      return;
    }
    // Fail closed: no Phase-2 officers means every ballot would be
    // "Unassigned" — say so instead of uploading and rendering noise.
    if (!officers.hasOfficers) {
      setStatus("error");
      setErrorMsg("No Presiding/Polling officers found from Phase 2 — complete Phase 2 (Form Teams) first.");
      return;
    }
    setStatus("allocating");
    setErrorMsg("");
    try {
      let data;
      if (USE_MOCK) {
        data = await new Promise((res) => setTimeout(() => res(mockAllocate()), 500));
      } else {
        // Real backend: base64-JSON via the shared client (credentials ride
        // along). POST /api/randomization/ballot-allocation parses the
        // register and allocates the Phase-2 officers to ballots.
        data = await allocateBallots({
          file: ballotFile,
          presidingOfficers: officers.presiding,
          pollingOfficers: officers.polling,
        });
      }
      const rows = (Array.isArray(data?.rows) ? data.rows : []).map((raw) => {
        const row = normalizeRow(raw);
        const poKey = String(row.presidingOfficer || "").trim().toLowerCase();
        const opoKey = String(row.pollingOfficer || "").trim().toLowerCase();
        if (!row.teamCode || row.teamCode === "—") {
          row.teamCode = teamByOfficer.get(poKey) || teamByOfficer.get(opoKey) || "—";
        }
        row.pollingOfficerRole = officers.apo.includes(row.pollingOfficer)
          ? "APO"
          : officers.opo.includes(row.pollingOfficer) ? "OPO" : "Polling Officer";
        return row;
      });
      const summary = normalizeSummary(data, rows);
      const savedAt = Date.now();
      await saveWorkflowData(context, "phase3", { summary, rows, savedAt });
      setResult({ summary, rows });
      setQuery("");
      setStatusFilter("all");
      setPage(1);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Something went wrong during allocation.");
    }
  }

  function sortKeyForTeam(teamCode) {
    if (!teamCode || teamCode === "—") return 999999;
    const numMatch = String(teamCode).match(/\d+/);
    return numMatch ? parseInt(numMatch[0], 10) : 999999;
  }

  function downloadRemainingStationsExcel() {
    if (!unallocatedStations.length) return;
    const wb = XLSX.utils.book_new();
    const rows = unallocatedStations.map((st, idx) => ({
      "S.No": idx + 1,
      "Station ID": st.ballotId || "—",
      "Polling Station No.": st.psNo || "—",
      "Polling Station Name": st.psName || st.stationName || (st.psNo && st.psNo !== "—" ? `PS #${st.psNo}` : "—"),
      "Building Name": st.buildingName || "—",
      "Complete Station Address": st.stationAddress || "—",
      "Ward": st.ward || "—",
      "Mandal": st.mandal || "—",
      "District": st.district || "—",
      "PIN Code": st.pinCode || "—",
      "Status": "Unassigned / Not Allotted",
      "Remarks": st.remarks || "No team allocated",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 8 },
      { wch: 15 },
      { wch: 18 },
      { wch: 32 },
      { wch: 28 },
      { wch: 45 },
      { wch: 16 },
      { wch: 18 },
      { wch: 16 },
      { wch: 12 },
      { wch: 24 },
      { wch: 30 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Remaining Stations");
    XLSX.writeFile(wb, "phase3-remaining-stations.xlsx");
  }

  async function downloadBallotExcel(category = "all") {
    if (!result?.rows?.length) return;

    // Sort in ascending order based on Team ID (not ballot ID)
    const sortedRows = [...result.rows].sort((a, b) => {
      const teamA = (a.teamCode && a.teamCode !== "—")
        ? a.teamCode
        : (teamByOfficer.get(String(a.presidingOfficer || "").trim().toLowerCase()) || teamByOfficer.get(String(a.pollingOfficer || "").trim().toLowerCase()) || "");
      const teamB = (b.teamCode && b.teamCode !== "—")
        ? b.teamCode
        : (teamByOfficer.get(String(b.presidingOfficer || "").trim().toLowerCase()) || teamByOfficer.get(String(b.pollingOfficer || "").trim().toLowerCase()) || "");

      const numA = sortKeyForTeam(teamA);
      const numB = sortKeyForTeam(teamB);
      if (numA !== numB) return numA - numB;
      return String(teamA).localeCompare(String(teamB), undefined, { numeric: true });
    });

    let targetRows = sortedRows;
    if (category === "MO") {
      targetRows = sortedRows.filter((r) => {
        const teamId = (r.teamCode && r.teamCode !== "—")
          ? r.teamCode
          : (teamByOfficer.get(String(r.presidingOfficer || "").trim().toLowerCase())
             || teamByOfficer.get(String(r.pollingOfficer || "").trim().toLowerCase())
             || "—");
        const moName = r.microObserver || moByTeam.get(teamId);
        return moName && moName !== "—";
      });
    }

    const exportRows = targetRows.map((row, idx) => {
      const teamId = (row.teamCode && row.teamCode !== "—")
        ? row.teamCode
        : (teamByOfficer.get(String(row.presidingOfficer || "").trim().toLowerCase()) || teamByOfficer.get(String(row.pollingOfficer || "").trim().toLowerCase()) || "—");
      const moName = row.microObserver || moByTeam.get(teamId) || "—";

      if (category === "PO-APO") {
        return {
          "S.No": idx + 1,
          "Team ID": teamId,
          "Station ID": row.ballotId || "—",
          "Polling Station No.": row.psNo || "—",
          "Polling Station Name": row.psName || row.stationName || (row.psNo && row.psNo !== "—" ? `PS #${row.psNo}` : "—"),
          "Building Name": row.buildingName || "—",
          "Complete Station Address": row.stationAddress || "—",
          "Ward": row.ward || "—",
          "Mandal": row.mandal || "—",
          "District": row.district || "—",
          "PIN Code": row.pinCode || "—",
          "Presiding Officer (PO)": row.presidingOfficer || "—",
          "Polling Officer (APO)": row.pollingOfficer || "—",
          "Allocation Status": row.status || "Allocated",
        };
      }

      if (category === "MO") {
        return {
          "S.No": idx + 1,
          "Team ID": teamId,
          "Station ID": row.ballotId || "—",
          "Polling Station No.": row.psNo || "—",
          "Polling Station Name": row.psName || row.stationName || (row.psNo && row.psNo !== "—" ? `PS #${row.psNo}` : "—"),
          "Building Name": row.buildingName || "—",
          "Complete Station Address": row.stationAddress || "—",
          "Ward": row.ward || "—",
          "Mandal": row.mandal || "—",
          "District": row.district || "—",
          "PIN Code": row.pinCode || "—",
          "Micro Observer (MO)": moName || "—",
          "Allocation Status": row.status || "Allocated",
        };
      }

      return {
        "S.No": idx + 1,
        "Team ID": teamId,
        "Station ID": row.ballotId || "—",
        "Polling Station No.": row.psNo || "—",
        "Polling Station Name": row.psName || row.stationName || (row.psNo && row.psNo !== "—" ? `PS #${row.psNo}` : "—"),
        "Building Name": row.buildingName || "—",
        "Complete Station Address": row.stationAddress || "—",
        "Ward": row.ward || "—",
        "Mandal": row.mandal || "—",
        "District": row.district || "—",
        "PIN Code": row.pinCode || "—",
        "Presiding Officer (PO)": row.presidingOfficer || "—",
        "Polling Officer (APO)": row.pollingOfficer || "—",
        "Micro Observer (MO)": moName || "—",
        "Allocation Status": row.status || "Allocated",
      };
    });

    const trainingByEmployee = new Map();
    let trainingSchedule = {};
    if (dutyRows.length > 0) {
      await Promise.all(["PO", "APO", "OPO"].map(async (group) => {
        try {
          const batchData = await listPoApoBatches(group);
          await Promise.all((batchData.batches || []).map(async (batch) => {
            const memberData = await getPoApoBatchMembers(group, batch.id);
            for (const member of memberData.members || []) {
              const employeeId = String(member.employee_id || "").trim();
              if (!employeeId) continue;
              trainingByEmployee.set(employeeId, {
                group,
                batch: batch.batch_no,
                place: batch.location_name || "Not allocated",
              });
            }
          }));
        } catch {
          // Keep the team/station roster exportable if training batches are not allocated yet.
        }
      }));

      try {
        const [locationData, trainingData] = await Promise.all([
          listTrainingLocations(),
          getWorkflowData(context, "training"),
        ]);
        trainingSchedule = trainingData?.value || {};
        const locationById = new Map((locationData.locations || []).map((location) => [
          String(location.id), location.location_name,
        ]));
        const locationsByEmployee = trainingData?.value?.moTrainingLocations || {};
        for (const team of dutyRows) {
          for (const member of team.members || []) {
            if (!member.isMicroObserver) continue;
            const employeeId = String(member.employeeId || "").trim();
            if (!employeeId) continue;
            const locationId = locationsByEmployee[employeeId];
            trainingByEmployee.set(employeeId, {
              group: "MO",
              batch: "—",
              place: locationById.get(String(locationId)) || "Not allocated",
            });
          }
        }
      } catch {
        // MO place assignments are optional until Training has been completed.
      }
    }

    // Build the primary Allocated Teams & Stations data
    let compactTeamRows = [];
    if (dutyRows.length > 0) {
      compactTeamRows = dutyRows.flatMap((team) => (team.members || []).map((member) => {
        const employeeId = String(member.employeeId || "").trim();
        const role = member.isMicroObserver ? "Micro Observer"
          : APO_ROLES.has(String(member.role || "").trim()) ? "Assistant Presiding Officer"
            : OPO_ROLES.has(String(member.role || "").trim()) ? "Other Polling Officer"
              : PO_ROLES.has(String(member.role || "").trim()) ? "Presiding Officer"
                : member.role || "Polling Officer";
        const memberCategory = member.isMicroObserver ? "MO"
          : (role.includes("Presiding") || role === "PO" || role === "APO") ? "PO/APO"
            : "OPO";
        const training = trainingByEmployee.get(employeeId) || {};
        const assignment = team.assignment || {};
        const stationLabel = [
          assignment.stationCode || assignment.stationId,
          assignment.stationName,
        ].filter(Boolean).join(" - ") || "Allotted in Stage 3";
        return {
          "Team Code": team.teamCode || "—",
          "Polling Station": stationLabel,
          "Station Mandal": assignment.stationMandal || team.postingMandal || "—",
          "Officer Category": memberCategory,
          "Assigned Role": member.teamRole || role,
          "Employee ID": member.employeeId || "—",
          "Employee Name": member.name || "—",
          "Designation": member.designation || "—",
          "Work Mandal": member.workMandal || "—",
          "Training Category": training.group || memberCategory,
          "Training Batch": training.batch ?? "—",
          "Training Venue": training.place || "Not allocated",
          "Training Schedule": trainingSchedule.trainingDate
            ? `${trainingSchedule.trainingDate}${trainingSchedule.trainingTime ? ` at ${trainingSchedule.trainingTime}` : ""}`
            : "Not scheduled",
          "Status": "Allocated",
        };
      }));
    } else if (phase2Rows.length > 0) {
      // Derive team-station allocation from phase2Rows and result.rows
      const stationList = result?.rows || [];
      const teamStationMap = new Map();
      const distinctTeams = [...new Set(phase2Rows.map((r) => r.teamCode).filter(Boolean))];
      distinctTeams.forEach((code, i) => {
        teamStationMap.set(code, stationList[i % stationList.length] || null);
      });

      compactTeamRows = phase2Rows.map((member) => {
        const employeeId = String(member.employeeId || "").trim();
        const assignedStation = teamStationMap.get(member.teamCode) || {};
        const role = member.isMicroObserver ? "Micro Observer"
          : APO_ROLES.has(String(member.role || "").trim()) ? "Assistant Presiding Officer"
            : OPO_ROLES.has(String(member.role || "").trim()) ? "Other Polling Officer"
              : PO_ROLES.has(String(member.role || "").trim()) ? "Presiding Officer"
                : member.role || "Polling Officer";
        const memberCategory = member.isMicroObserver ? "MO"
          : (role.includes("Presiding") || role === "PO" || role === "APO") ? "PO/APO"
            : "OPO";
        const training = trainingByEmployee.get(employeeId) || {};
        return {
          "Team Code": member.teamCode || "—",
          "Polling Station": assignedStation.psNo || assignedStation.ballotId || "Allotted in Phase 3",
          "Station Mandal": assignedStation.mandal || member.workMandal || "—",
          "Officer Category": memberCategory,
          "Assigned Role": member.teamRole || role,
          "Employee ID": member.employeeId || "—",
          "Employee Name": member.employeeName || "—",
          "Designation": member.designation || "—",
          "Work Mandal": member.workMandal || "—",
          "Training Category": training.group || memberCategory,
          "Training Batch": training.batch ?? "—",
          "Training Venue": training.place || "Not allocated",
          "Training Schedule": trainingSchedule.trainingDate
            ? `${trainingSchedule.trainingDate}${trainingSchedule.trainingTime ? ` at ${trainingSchedule.trainingTime}` : ""}`
            : "Not scheduled",
          "Status": "Allocated",
        };
      });
    }

    if (category === "PO-APO") {
      compactTeamRows = compactTeamRows.filter((r) => r["Officer Category"] === "PO/APO");
    } else if (category === "MO") {
      compactTeamRows = compactTeamRows.filter((r) => r["Officer Category"] === "MO");
    }

    const workbook = XLSX.utils.book_new();
    // Place the allocated team data at the top / first sheet of the generated Excel workbook
    if (compactTeamRows.length > 0) {
      compactTeamRows.sort((a, b) => {
        const numA = sortKeyForTeam(a["Team Code"]);
        const numB = sortKeyForTeam(b["Team Code"]);
        if (numA !== numB) return numA - numB;
        return String(a["Team Code"]).localeCompare(String(b["Team Code"]), undefined, { numeric: true });
      });
      const teamSheet = XLSX.utils.json_to_sheet(compactTeamRows);
      teamSheet["!cols"] = [
        { wch: 14 }, // Team Code
        { wch: 24 }, // Polling Station
        { wch: 18 }, // Station Mandal
        { wch: 16 }, // Officer Category
        { wch: 26 }, // Assigned Role
        { wch: 14 }, // Employee ID
        { wch: 24 }, // Employee Name
        { wch: 24 }, // Designation
        { wch: 18 }, // Work Mandal
        { wch: 18 }, // Training Category
        { wch: 15 }, // Training Batch
        { wch: 28 }, // Training Venue
        { wch: 22 }, // Training Schedule
        { wch: 12 }, // Status
      ];
      XLSX.utils.book_append_sheet(
        workbook,
        teamSheet,
        category === "PO-APO" ? "PO-APO Teams & Stations" : category === "MO" ? "MO Teams & Stations" : "Allocated Teams & Stations"
      );
    }

    const stationWs = XLSX.utils.json_to_sheet(exportRows);
    if (category === "PO-APO") {
      stationWs["!cols"] = [
        { wch: 8 },  // S.No
        { wch: 15 }, // Team ID
        { wch: 16 }, // Station ID
        { wch: 18 }, // Polling Station No.
        { wch: 32 }, // Polling Station Name
        { wch: 28 }, // Building Name
        { wch: 45 }, // Complete Station Address
        { wch: 16 }, // Ward
        { wch: 18 }, // Mandal
        { wch: 16 }, // District
        { wch: 12 }, // PIN Code
        { wch: 26 }, // Presiding Officer (PO)
        { wch: 26 }, // Polling Officer (APO)
        { wch: 16 }, // Allocation Status
      ];
      XLSX.utils.book_append_sheet(workbook, stationWs, "PO-APO Station Summary");
    } else if (category === "MO") {
      stationWs["!cols"] = [
        { wch: 8 },  // S.No
        { wch: 15 }, // Team ID
        { wch: 16 }, // Station ID
        { wch: 18 }, // Polling Station No.
        { wch: 32 }, // Polling Station Name
        { wch: 28 }, // Building Name
        { wch: 45 }, // Complete Station Address
        { wch: 16 }, // Ward
        { wch: 18 }, // Mandal
        { wch: 16 }, // District
        { wch: 12 }, // PIN Code
        { wch: 26 }, // Micro Observer (MO)
        { wch: 16 }, // Allocation Status
      ];
      XLSX.utils.book_append_sheet(workbook, stationWs, "MO Station Summary");
    } else {
      stationWs["!cols"] = [
        { wch: 8 },  // S.No
        { wch: 15 }, // Team ID
        { wch: 16 }, // Station ID
        { wch: 18 }, // Polling Station No.
        { wch: 32 }, // Polling Station Name
        { wch: 28 }, // Building Name
        { wch: 45 }, // Complete Station Address
        { wch: 16 }, // Ward
        { wch: 18 }, // Mandal
        { wch: 16 }, // District
        { wch: 12 }, // PIN Code
        { wch: 26 }, // Presiding Officer (PO)
        { wch: 26 }, // Polling Officer (APO)
        { wch: 26 }, // Micro Observer (MO)
        { wch: 16 }, // Allocation Status
      ];
      XLSX.utils.book_append_sheet(workbook, stationWs, "Station Summary");
    }

    if (category === "all") {
      const unassignedExportRows = [];
      unallocatedStations.forEach((st) => {
        unassignedExportRows.push({
          Type: "Polling Station",
          Code: st.psNo || st.ballotId || "—",
          Mandal: st.mandal || "—",
          Status: "Unassigned / Not Allotted",
          Remarks: st.remarks || "No team allocated",
        });
      });
      unallocatedTeams.forEach((tm) => {
        unassignedExportRows.push({
          Type: "Team",
          Code: tm.teamCode || "—",
          Mandal: tm.postingMandal || "—",
          Status: "Reserve Standby Team",
          Remarks: "No polling station allocated",
        });
      });
      if (unassignedExportRows.length > 0) {
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(unassignedExportRows), "Unassigned Data");
      }
    }

    const fileName = category === "all"
      ? "phase3-station-allocation.xlsx"
      : `phase3-station-allocation-${category}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  }

  function downloadDutyRosterExcel() {
    if (visibleDutyOfficerRows.length === 0) return;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(visibleDutyOfficerRows),
      dutyRoleFilter === "all" ? "All Officers" : dutyRoleFilter
    );
    XLSX.writeFile(workbook, `phase3-${dutyRoleFilter}-officers.xlsx`);
  }

  const rows = useMemo(() => result?.rows ?? [], [result]);
  const summary = result?.summary ?? { totalBallots: 0, allocated: 0, presidingCount: 0, pollingCount: 0 };

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter !== "all") {
      list = list.filter((r) => r._statusKey === (statusFilter === "allocated" ? "approved" : "rejected"));
    }
    if (viewCategory === "MO") {
      list = list.filter((r) => {
        const teamId = (r.teamCode && r.teamCode !== "—")
          ? r.teamCode
          : (teamByOfficer.get(String(r.presidingOfficer || "").trim().toLowerCase())
             || teamByOfficer.get(String(r.pollingOfficer || "").trim().toLowerCase())
             || "—");
        const moName = r.microObserver || moByTeam.get(teamId);
        return moName && moName !== "—";
      });
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.teamCode, r.ballotId, r.psNo, r.presidingOfficer, r.pollingOfficer, r.microObserver, r.mandal]
          .join(" ").toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, statusFilter, viewCategory, query, teamByOfficer, moByTeam]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);
  const pages = pageList(safePage, pageCount);

  // Pagination for remaining (unallocated) polling stations (10 rows per page)
  const REM_PAGE_SIZE = 10;
  const remTotalPages = Math.max(1, Math.ceil(unallocatedStations.length / REM_PAGE_SIZE));
  const safeRemPage = Math.min(Math.max(1, remainingStationsPage), remTotalPages);
  const remStartIdx = (safeRemPage - 1) * REM_PAGE_SIZE;
  const pagedRemStations = unallocatedStations.slice(remStartIdx, remStartIdx + REM_PAGE_SIZE);
  const remPages = pageList(safeRemPage, remTotalPages);

  const allocatedCount = rows.filter((r) => r._statusKey === "approved").length;
  const pendingCount = rows.length - allocatedCount;
  const canAllocate = !!ballotFile && status !== "allocating";


  return (
    <main className="p1-page p3-page">
      <div className="page-overlay" />
      <Header />

      <div className="p1-shell">
        {/* breadcrumb */}
        <nav className="p1-breadcrumb" aria-label="Breadcrumb">
          <a href="/home" className="p1-crumb-home" aria-label="Home">
            <HomeIcon />
          </a>
          <span className="p1-crumb-sep">/</span>
          <a href={backHref}>{contextLabel}</a>
          <span className="p1-crumb-sep">/</span>
          <span>Phase 3</span>
          <span className="p1-crumb-sep">/</span>
          <span className="p1-crumb-current">Ballot Allocation</span>
        </nav>

        {/* title + info box */}
        <section className="p1-title-row">
          <div className="p1-title">
            <span className="p1-title-icon">
              <LinkIcon />
            </span>
            <div>
              <h1>Phase 3 – Ballot Allocation</h1>
              <p>
                Upload the Ballot register, then allocate ballots to the
                Presiding and Polling officers using the backend allocation rules.
              </p>
            </div>
          </div>
          <aside className="p1-infobox">
            <span className="p1-infobox-icon">
              <InfoIcon />
            </span>
            <p>
              Presiding &amp; Polling officers are pulled from <strong>Phase 2</strong>. Upload the
              ballot file and click <strong>Allocate Ballots</strong> — the backend assigns each ballot to
              an officer per the rules, and the result is shown below.
            </p>
          </aside>
        </section>

        {/* officers from Phase 2 */}
        <section className="p3-officers">
          <div className="p3-officers-head">
            <span className="p3-officers-title">Officers from Phase 2</span>
            {!officers.hasOfficers && (
              <a className="p3-officers-link" href={`${backHref}/phase-2`}>
                Run Phase 2 first to assign officers →
              </a>
            )}
          </div>
          <div className="p3-officer-pills">
            <OfficerCount tone="p3-tone-presiding" icon={<TrophyIcon />} label="Presiding Officers" count={officers.presiding.length} />
            <OfficerCount tone="p3-tone-apo" icon={<TrophyIcon />} label="APO Officers" count={officers.apo.length} />
            <OfficerCount tone="p3-tone-opo" icon={<BadgeIcon />} label="OPO Officers" count={officers.opo.length} />
            <OfficerCount tone="p3-tone-micro" icon={<PeopleIcon />} label="Micro Observers" count={officers.micro.length} />
          </div>
          {!officers.hasOfficers && (
            <p className="p3-officers-warn">
              No Presiding/APO/Polling officers found. Complete Phase 2 so the backend has officers to
              allocate to — though you may still upload files and allocate.
            </p>
          )}
        </section>

        {/* single upload: ballot register only */}
        <section className="p3-upload-grid p3-upload-single">
          {/* Ballot upload */}
          <div className="p1-upload-card p3-upload-card">
            <h2 className="p1-card-title">
              <span className="p1-card-title-icon">
                <DocIcon />
              </span>
              Upload Ballot Excel File
            </h2>
            <div
              className={`p1-drop${ballotDrag ? " is-drag" : ""}`}
              onClick={() => ballotInputRef.current?.click()}
              onDragEnter={(e) => { e.preventDefault(); setBallotDrag(true); }}
              onDragOver={(e) => { e.preventDefault(); setBallotDrag(true); }}
              onDragLeave={() => setBallotDrag(false)}
              onDrop={onBallotDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") ballotInputRef.current?.click(); }}
            >
              <span className="p1-drop-icon">
                <CloudUpIcon />
              </span>
              <strong>Drag &amp; drop the Ballot file here</strong>
              <span className="p1-drop-or">or</span>
              <button type="button" className="p1-browse" onClick={(e) => { e.stopPropagation(); ballotInputRef.current?.click(); }}>
                Browse Files
              </button>
              <span className="p1-drop-hint">Supported format: .xlsx&nbsp;&nbsp;|&nbsp;&nbsp;Max file size: 10 MB</span>
              <input ref={ballotInputRef} type="file" accept={ACCEPTED.join(",")} onChange={onBallotPick} hidden />
            </div>
            {ballotFile && (
              <div className="p1-filechip">
                <span className="p1-filechip-icon"><DocIcon /></span>
                <span className="p1-filechip-name">{ballotFile.name}</span>
                <span className="p1-filechip-size">{(ballotFile.size / 1024).toFixed(1)} KB</span>
                <button type="button" className="p1-filechip-clear" onClick={clearBallot} aria-label="Remove file">×</button>
              </div>
            )}
          </div>
        </section>

        {/* allocate action */}
        <section className="p3-allocate-row">
          <button type="button" className="p3-allocate-btn" onClick={allocate} disabled={!canAllocate}>
            {status === "allocating" ? (
              <span className="p1-spinner" aria-hidden="true" />
            ) : (
              <LinkIcon />
            )}
            {status === "allocating" ? "Allocating…" : "Allocate Ballots"}
          </button>
          <p className="p1-validate-note">
            <span className="p1-validate-note-icon">
              <InfoIcon />
            </span>
            Upload the ballot file, then click <strong>Allocate Ballots</strong>. The backend applies the
            allocation rules and returns the assigned list, shown below.
          </p>
        </section>


        {status === "error" && (
          <div className="p1-alert p1-alert-error" role="alert">
            <span className="p1-alert-icon">
              <CrossIcon />
            </span>
            <div>{errorMsg}</div>
          </div>
        )}

        {/* results */}
        {result && (
          <section className="p1-result">
            {/* toolbar */}
            <div className="p1-toolbar">
              <div className="p1-chips">
                <button
                  type="button"
                  className={`p1-chip p1-chip-all${statusFilter === "all" ? " is-active" : ""}`}
                  onClick={() => { setStatusFilter("all"); setPage(1); }}
                >
                  All Ballots <b>({summary.totalBallots})</b>
                </button>
                <button
                  type="button"
                  className={`p1-chip p1-chip-approved${statusFilter === "allocated" ? " is-active" : ""}`}
                  onClick={() => { setStatusFilter("allocated"); setPage(1); }}
                >
                  <CheckIcon /> Allocated <b>({allocatedCount})</b>
                </button>
                <button
                  type="button"
                  className={`p1-chip p1-chip-rejected${statusFilter === "pending" ? " is-active" : ""}`}
                  onClick={() => { setStatusFilter("pending"); setPage(1); }}
                >
                  <CrossIcon /> Pending <b>({pendingCount})</b>
                </button>
              </div>

              <div className="p1-tools">
                <div className="p1-search-wrap">
                  <span className="p1-search-icon">
                    <SearchIcon />
                  </span>
                  <input
                    type="search"
                    className="p1-search"
                    placeholder="Search ballot, officer…"
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                  />
                </div>
              </div>
            </div>

            {/* stats */}
            <div className="p1-stats">
              <div className="p1-stat p1-stat-total">
                <span className="p1-stat-icon"><DocIcon /></span>
                <div className="p1-stat-meta">
                  <span className="p1-stat-label">Total Ballots</span>
                  <span className="p1-stat-num">{summary.totalBallots}</span>
                </div>
              </div>
              <div className="p1-stat p1-stat-ok">
                <span className="p1-stat-icon"><CheckIcon /></span>
                <div className="p1-stat-meta">
                  <span className="p1-stat-label">Allocated</span>
                  <span className="p1-stat-num">{summary.allocated}</span>
                </div>
              </div>
              <div className="p1-stat p1-stat-ok">
                <span className="p1-stat-icon"><TrophyIcon /></span>
                <div className="p1-stat-meta">
                  <span className="p1-stat-label">Presiding Used</span>
                  <span className="p1-stat-num">{summary.presidingCount}</span>
                </div>
              </div>
              <div className="p1-stat p1-stat-review">
                <span className="p1-stat-icon"><BadgeIcon /></span>
                <div className="p1-stat-meta">
                  <span className="p1-stat-label">Polling Used</span>
                  <span className="p1-stat-num">{summary.pollingCount}</span>
                </div>
              </div>
            </div>

            {/* post-allocation actions: continue to training */}
            <div className="p3-next-actions">
              <button
                type="button"
                className="p3-download-alloc-btn"
                onClick={() => downloadBallotExcel("all")}
                disabled={!result || status === "allocating"}
                title="Download polling station allocations sorted in ascending order by Team ID"
              >
                <DocIcon /> Download Station Allocation (Excel)
              </button>
              {unallocatedStations.length > 0 && (
                <button
                  type="button"
                  className={`p3-toggle-rem-btn ${showRemainingStations ? "is-open" : ""}`}
                  onClick={() => {
                    setShowRemainingStations((v) => !v);
                    setRemainingStationsPage(1);
                  }}
                  title="Toggle unallocated remaining polling stations view"
                >
                  {showRemainingStations ? "Close Remaining Stations ✕" : `Show Remaining Stations (${unallocatedStations.length})`}
                </button>
              )}
              {result && status === "done" && (
                <span className="p3-next-note">
                  Allocation saved — proceed to training to assign venues and generate orders.
                </span>
              )}
            </div>

            {/* Duty allocation (Stage 2 -> Stage 3): allocated teams & stations shown prominently at TOP */}
            {duty && dutyRows.length > 0 && (
              <section className="p3-duty" style={{ marginTop: "16px", marginBottom: "24px" }}>
                <div className="p3-officers-head">
                  <span className="p3-officers-title">Allocated Teams &amp; Stations (Duty Roster)</span>
                  <div className="p3-roster-actions">
                    <select
                      value={dutyRoleFilter}
                      onChange={(event) => setDutyRoleFilter(event.target.value)}
                      aria-label="Show training allocation category"
                    >
                      <option value="all">All categories</option>
                      <option value="PO-APO">PO/APO</option>
                      <option value="OPO">OPO</option>
                      <option value="MO">MO</option>
                    </select>
                    <button
                      type="button"
                      className="p1-mini-btn"
                      onClick={downloadDutyRosterExcel}
                      disabled={visibleDutyOfficerRows.length === 0}
                    >
                      Download {dutyRoleFilter === "all" ? "All" : dutyRoleFilter === "PO-APO" ? "PO/APO" : dutyRoleFilter} Data
                    </button>
                  </div>
                  {duty?.runAt && (
                    <span className="p3-officer-pill-label">
                      Last run: {new Date(duty.runAt).toLocaleString("en-IN")}
                      {duty.stage3?.status ? ` · Stage 3: ${duty.stage3.status}` : ""}
                      {duty.stage3?.publicationStatus ? ` · ${duty.stage3.publicationStatus}` : ""}
                    </span>
                  )}
                </div>
                {dutyError && <div className="p1-note">⚠ {dutyError}</div>}
                <div className="p1-table-wrap">
                  <table className="p1-table p3-table">
                    <thead>
                      <tr>
                        <th>Team</th>
                        <th>Ballot ID</th>
                        <th>Posting Mandal</th>
                        <th>Allocated Polling Station</th>
                        <th>Station Mandal</th>
                        <th>Complete Station Address</th>
                        <th>Members (name — role)</th>
                        <th>Notification</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dutyRows.map((r) => {
                        const st = sendState[r.teamCode] || {};
                        return (
                          <tr key={r.teamCode}>
                            <td className="p1-strong p1-mono">{r.teamCode}</td>
                            <td className="p1-mono">
                              {r.assignment?.stationId || r.assignment?.ballotId || r.assignment?.venueCode || "—"}
                              {!r.assignment && <span className="p1-remarks"> (not allotted)</span>}
                            </td>
                            <td>{r.postingMandal || "—"}</td>
                            <td className="p1-mono">
                              {r.assignment?.stationName || r.assignment?.stationCode || r.assignment?.stationId || "—"}
                            </td>
                            <td>{r.assignment?.stationMandal || "—"}</td>
                            <td>{[
                              r.assignment?.stationName,
                              r.assignment?.buildingName,
                              r.assignment?.street,
                              r.assignment?.locality,
                              r.assignment?.ward && `Ward ${r.assignment.ward}`,
                              r.assignment?.stationMandal,
                              r.assignment?.district,
                              r.assignment?.pinCode,
                            ].filter(Boolean).join(", ") || "—"}</td>
                            <td>
                              {(r.members || []).filter((member) => {
                                const role = member.isMicroObserver ? "MO"
                                  : APO_ROLES.has(String(member.role || "").trim()) ? "APO"
                                    : OPO_ROLES.has(String(member.role || "").trim()) ? "OPO"
                                      : PO_ROLES.has(String(member.role || "").trim()) ? "PO"
                                        : "Unassigned";
                                return dutyRoleFilter === "all" || role === dutyRoleFilter;
                              }).map((m, i) => (
                                <div key={`${r.teamCode}-${i}`} className="p1-officer-row">
                                  <span className="p1-mono">{m.employeeId || "—"}</span>
                                  <span className="p1-strong">{m.name || "—"}</span>
                                  <span className="p1-remarks">— {m.role}</span>
                                  {m.isMicroObserver ? " (MO)" : ""}
                                  {m.designation ? <span className="p1-remarks">— {m.designation}</span> : ""}
                                  <span className="p1-remarks"> — Work: {m.workMandal || "—"}; Native: {m.nativeMandal || "—"}</span>
                                </div>
                              ))}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="p1-mini-btn"
                                disabled={st.pending}
                                onClick={() => onSendNotification(r.teamCode, (r.members || []).length)}
                              >
                                {st.pending ? "Sending…" : "Send notification"}
                              </button>
                              {st.msg && (
                                <div className="p1-note">
                                  {st.tone === "warn" ? "⚠ " : ""}
                                  {st.msg}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Polling Station Summary table */}
            <div className="p3-officers-head" style={{ marginTop: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
              <span className="p3-officers-title">Polling Station Allocation Summary</span>
              <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                {/* 1. View Generated List dropdown */}
                <label className="p3-control-label" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 700, color: "#1e40af" }}>
                  <span>View Allocation List:</span>
                  <select
                    className="p3-select-compact"
                    value={viewCategory}
                    disabled={!result || rows.length === 0}
                    onChange={(e) => {
                      setViewCategory(e.target.value);
                      setPage(1);
                    }}
                    aria-label="View Allocation List"
                  >
                    <option value="all">No choice</option>
                    <option value="PO-APO">PO/APO</option>
                    <option value="MO">MO</option>
                  </select>
                </label>

                {/* 2. Separate Download dropdown & buttons */}
                <div className="p3-download-ctrl-group" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <label className="p3-control-label" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 700, color: "#065f46" }}>
                    <span>Download Category:</span>
                    <select
                      className="p3-select-compact p3-select-green"
                      value={downloadCategory}
                      disabled={!result || rows.length === 0}
                      onChange={(e) => setDownloadCategory(e.target.value)}
                      aria-label="Download Category"
                    >
                      <option value="PO-APO">PO/APO</option>
                      <option value="MO">MO</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="p3-download-alloc-btn p3-btn-download-cat"
                    onClick={() => downloadBallotExcel(downloadCategory)}
                    disabled={!result || status === "allocating" || rows.length === 0}
                    title={`Download ${downloadCategory === "PO-APO" ? "PO/APO" : "MO"} station allocation Excel`}
                  >
                    <DocIcon /> Download {downloadCategory === "PO-APO" ? "PO/APO" : "MO"} (Excel)
                  </button>
                  <button
                    type="button"
                    className="p3-download-alloc-btn"
                    onClick={() => downloadBallotExcel("all")}
                    disabled={!result || status === "allocating" || rows.length === 0}
                    title="Download all polling station allocations sorted in ascending order by Team ID"
                  >
                    <DocIcon /> Download All (Excel)
                  </button>
                </div>

                {unallocatedStations.length > 0 && (
                  <button
                    type="button"
                    className={`p3-toggle-rem-btn ${showRemainingStations ? "is-open" : ""}`}
                    onClick={() => {
                      setShowRemainingStations((v) => !v);
                      setRemainingStationsPage(1);
                    }}
                    title="Toggle unallocated remaining polling stations list"
                  >
                    {showRemainingStations ? "Close Remaining Stations ✕" : `Show Remaining Stations (${unallocatedStations.length})`}
                  </button>
                )}
              </div>
            </div>

            {/* Remaining Polling Stations toggleable section (10 rows per page) */}
            {showRemainingStations && unallocatedStations.length > 0 && (
              <section className="p1-card p3-remaining-card" style={{ margin: "16px 0", border: "1px solid #fed7aa", background: "#fffaf5" }}>
                <div className="p1-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <span className="p1-card-title" style={{ color: "#c2410c" }}>
                      Remaining / Unassigned Polling Stations ({unallocatedStations.length})
                    </span>
                    <p className="p1-hint" style={{ margin: "4px 0 0", fontSize: 13, color: "#9a3412" }}>
                      Polling stations without an allocated team (showing 10 records per page).
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      type="button"
                      className="p1-mini-btn"
                      style={{ background: "#ea580c", color: "#fff", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}
                      onClick={downloadRemainingStationsExcel}
                    >
                      <DocIcon /> Download Remaining Stations (Excel)
                    </button>
                    <button
                      type="button"
                      className="p1-mini-btn"
                      onClick={() => setShowRemainingStations(false)}
                      style={{ background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" }}
                    >
                      Close ✕
                    </button>
                  </div>
                </div>

                <div className="p1-table-wrap" style={{ marginTop: 12 }}>
                  <table className="p1-table p3-table p3-station-alloc-table">
                    <thead>
                      <tr>
                        <th style={{ width: "45px" }}>S.No</th>
                        <th style={{ width: "110px" }}>Station ID</th>
                        <th style={{ width: "110px" }}>Station No.</th>
                        <th className="p3-col-address">Polling Station &amp; Address</th>
                        <th style={{ width: "120px" }}>Mandal</th>
                        <th style={{ width: "110px" }}>Status</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRemStations.map((st, idx) => (
                        <tr key={`rem-st-${st.ballotId || idx}`}>
                          <td className="p1-mono">{remStartIdx + idx + 1}</td>
                          <td className="p1-mono">{st.ballotId || "—"}</td>
                          <td className="p1-strong p3-station-cell">PS #{st.psNo || "—"}</td>
                          <td className="p3-col-address">
                            {st.psName && st.psName !== "—" && (
                              <div style={{ fontWeight: 600, color: "#0f172a", marginBottom: 2 }}>{st.psName}</div>
                            )}
                            {st.stationAddress && st.stationAddress !== "—" && (
                              <div className="p3-station-addr">{st.stationAddress}</div>
                            )}
                          </td>
                          <td>{st.mandal || "—"}</td>
                          <td><span className="p1-status p1-status-rejected">Unassigned</span></td>
                          <td className="p1-remarks">{st.remarks || "No team assigned"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 10 rows pagination */}
                <div className="p1-pagination" style={{ marginTop: 12 }}>
                  <span className="p1-page-info">
                    Showing {remStartIdx + 1} to {Math.min(remStartIdx + REM_PAGE_SIZE, unallocatedStations.length)} of {unallocatedStations.length} remaining stations
                  </span>
                  <div className="p1-pages">
                    <button
                      type="button"
                      className="p1-page-btn p1-page-nav"
                      onClick={() => setRemainingStationsPage((p) => Math.max(1, p - 1))}
                      disabled={safeRemPage <= 1}
                      aria-label="Previous page"
                    >
                      <ChevronLeft />
                    </button>
                    {remPages.map((p, idx) =>
                      p === "…" ? (
                        <span key={`rem-dots-${idx}`} className="p1-page-dots">…</span>
                      ) : (
                        <button
                          key={`rem-page-${p}`}
                          type="button"
                          className={`p1-page-btn${p === safeRemPage ? " is-active" : ""}`}
                          onClick={() => setRemainingStationsPage(p)}
                        >
                          {p}
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      className="p1-page-btn p1-page-nav"
                      onClick={() => setRemainingStationsPage((p) => Math.min(remTotalPages, p + 1))}
                      disabled={safeRemPage >= remTotalPages}
                      aria-label="Next page"
                    >
                      <ChevronRight />
                    </button>
                  </div>
                </div>
              </section>
            )}

            <div className="p1-table-wrap">
              <table className="p1-table p3-table p3-station-alloc-table">
                <thead>
                  <tr>
                    <th style={{ width: "45px" }}>S.No</th>
                    <th style={{ width: "95px" }}>Team ID</th>
                    <th style={{ width: "105px" }}>Station ID</th>
                    <th className="p3-col-address">Polling Station &amp; Complete Address</th>
                    {(viewCategory === "all" || viewCategory === "PO-APO") && (
                      <th className="p3-col-po">Presiding Officer (PO)</th>
                    )}
                    {(viewCategory === "all" || viewCategory === "PO-APO") && (
                      <th className="p3-col-apo">Polling Officer (APO)</th>
                    )}
                    {(viewCategory === "all" || viewCategory === "MO") && (
                      <th className="p3-col-mo">Micro Observer (MO)</th>
                    )}
                    <th className="p3-col-mandal">Mandal</th>
                    <th style={{ width: "90px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={4 + (viewCategory === "all" ? 3 : viewCategory === "PO-APO" ? 2 : 1) + 2} className="p1-empty">
                        No matching records.
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((r) => {
                      const teamId = (r.teamCode && r.teamCode !== "—")
                        ? r.teamCode
                        : (teamByOfficer.get(String(r.presidingOfficer || "").trim().toLowerCase())
                           || teamByOfficer.get(String(r.pollingOfficer || "").trim().toLowerCase())
                           || "—");
                      const moName = r.microObserver || moByTeam.get(teamId) || "—";
                      return (
                        <tr key={`${r.ballotId}-${r.psNo}`}>
                          <td className="p1-mono">{r.sno}</td>
                          <td className="p1-mono p3-teamcode-cell">{teamId}</td>
                          <td className="p1-mono">{r.ballotId}</td>
                          <td className="p3-col-address">
                            <div className="p3-station-header">
                              <span className="p1-strong p3-station-cell">PS #{r.psNo}{r.psName && r.psName !== "—" ? ` – ${r.psName}` : ""}</span>
                            </div>
                            {r.stationAddress && r.stationAddress !== "—" ? (
                              <div className="p3-station-addr" title={r.stationAddress}>
                                {r.stationAddress}
                              </div>
                            ) : r.psName && r.psName !== "—" ? (
                              <div className="p3-station-addr">{r.psName}</div>
                            ) : null}
                          </td>
                          {(viewCategory === "all" || viewCategory === "PO-APO") && (
                            <td className="p3-col-po">
                              <span className="p3-role presiding">
                                <TrophyIcon /> {r.presidingOfficer}
                              </span>
                            </td>
                          )}
                          {(viewCategory === "all" || viewCategory === "PO-APO") && (
                            <td className="p3-col-apo">
                              <span className="p3-role polling">
                                <BadgeIcon /> {r.pollingOfficer} {r.pollingOfficerRole ? <small>({r.pollingOfficerRole})</small> : null}
                              </span>
                            </td>
                          )}
                          {(viewCategory === "all" || viewCategory === "MO") && (
                            <td className="p3-col-mo">
                              {moName && moName !== "—" ? (
                                <span className="p3-role micro">
                                  <BadgeIcon /> {moName}
                                </span>
                              ) : (
                                <span style={{ color: "#94a3b8" }}>—</span>
                              )}
                            </td>
                          )}
                          <td className="p3-col-mandal">{r.mandal}</td>
                          <td><StatusBadge row={r} /></td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* pagination */}
            <div className="p1-pagination">
              <span className="p1-page-info">
                Showing {start} to {end} of {filtered.length} records
              </span>
              <div className="p1-pages">
                <button
                  type="button"
                  className="p1-page-btn p1-page-nav"
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage <= 1}
                  aria-label="Previous page"
                >
                  <ChevronLeft />
                </button>
                {pages.map((p, idx) =>
                  p === "…" ? (
                    <span key={`dots-${idx}`} className="p1-page-dots">…</span>
                  ) : (
                    <button
                      key={p}
                      type="button"
                      className={`p1-page-btn${p === safePage ? " is-active" : ""}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  )
                )}
                <button
                  type="button"
                  className="p1-page-btn p1-page-nav"
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= pageCount}
                  aria-label="Next page"
                >
                  <ChevronRight />
                </button>
              </div>
            </div>

            {/* Unassigned Data section */}
            {(unallocatedStations.length > 0 || unallocatedTeams.length > 0 || officers.na.length > 0) && (
              <section className="p1-invalid-data p3-unassigned-section" aria-label="Unassigned Stations and Standby Teams" style={{ marginTop: "32px" }}>
                <div className="p1-invalid-head">
                  <h2>Unassigned Data (Stations &amp; Teams)</h2>
                  <span>
                    {unallocatedStations.length} unassigned station{unallocatedStations.length === 1 ? "" : "s"} · {unallocatedTeams.length} reserve team{unallocatedTeams.length === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="p1-invalid-note">
                  Polling stations that did not receive a team assignment or reserve teams not allocated to a station are shown below.
                </p>
                {unallocatedStations.length > 0 && !showRemainingStations && (
                  <div className="p3-unassigned-block" style={{ marginBottom: "20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <h3 style={{ fontSize: "15px", fontWeight: "700", margin: 0, color: "var(--accent-dark)" }}>
                        Unassigned Polling Stations ({unallocatedStations.length})
                      </h3>
                      <button
                        type="button"
                        className="p1-mini-btn"
                        onClick={() => {
                          setShowRemainingStations(true);
                          setRemainingStationsPage(1);
                        }}
                      >
                        Open Remaining Stations (10 rows/page)
                      </button>
                    </div>
                  </div>
                )}
                {unallocatedTeams.length > 0 && (
                  <div className="p3-unassigned-block">
                    <h3 style={{ fontSize: "15px", fontWeight: "700", marginBottom: "8px", color: "var(--accent-dark)" }}>
                      Reserve / Standby Teams ({unallocatedTeams.length})
                    </h3>
                    <div className="p1-table-wrap">
                      <table className="p1-table">
                        <thead>
                          <tr>
                            <th>Sl. No.</th>
                            <th>Team Code</th>
                            <th>Posting Mandal</th>
                            <th>Members</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unallocatedTeams.map((tm, idx) => (
                            <tr key={`unalloc-tm-${tm.teamCode || idx}`}>
                              <td className="p1-mono">{idx + 1}</td>
                              <td className="p1-strong p1-mono">{tm.teamCode}</td>
                              <td>{tm.postingMandal || "—"}</td>
                              <td>
                                {(tm.members || []).map((m, mi) => (
                                  <span key={mi} style={{ marginRight: "12px", display: "inline-block" }}>
                                    {m.name} ({m.role})
                                  </span>
                                ))}
                              </td>
                              <td><span className="p1-status p1-status-approved">Standby Reserve</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            )}
          </section>
        )}

        <WorkflowNavigation
          context={context}
          step="phase3"
          canContinue={Boolean(result && status === "done" && Number(result.summary?.allocated || 0) > 0)}
          disabledReason="Allocate at least one ballot before continuing to training."
        />
      </div>
    </main>
  );
}
