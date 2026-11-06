                                                                                                import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import "./Phase1.css"; // reuse shared chrome (page, shell, breadcrumb, title, stats, table, pagination, search…)
import "./Phase2.css"; // Phase 2 specifics (team formation bar, presiding/polling chips + role badges, Excel export bar)
import Header from "../components/Header.jsx";
import WorkflowNavigation from "../components/WorkflowNavigation.jsx";

import {
  uploadMicroObservers,
  listMicroObservers,
  getBatchPersonnel,
  getWorkflowData,
  saveWorkflowData,
  clearWorkflowData,
} from "../api/client.js";

/**
 * Phase 2 – Officer Ranking & Assignment
 * --------------------------------------
 * Consumes the APPROVED employees produced by Phase 1 (Employee Validation) and
 * ranks them. When the user clicks "Partition", the ranked list is split into
 * Presiding Officers (most senior) and Polling Officers (the rest).
 *
 * Data source: approved personnel and team assignments are loaded from the
 * backend, which reads and writes MongoDB.
 */

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

function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-5" />
      <path d="M12 8h.01" />
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

function CloudUpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 13v8" />
      <path d="m8 17 4-4 4 4" />
      <path d="M20.5 14.5A4.5 4.5 0 0 0 18 6.5h-1.3A7 7 0 1 0 5 12.5" />
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

function SplitIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="6" cy="5" r="2.4" />
      <circle cx="18" cy="5" r="2.4" />
      <circle cx="12" cy="19" r="2.4" />
      <path d="M6 7.4V11a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3V7.4" />
      <path d="M12 14v2.6" />
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

/** Extract a leading integer from strings like "12 yrs", "5 yrs PH-40%". */
function serviceYears(s) {
  const m = String(s || "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

/** Higher score = more senior / more experienced → ranked first. */
function rankScore(r) {
  const seniority = /superintendent/i.test(r.designation || "") ? 120
    : /senior/i.test(r.designation || "") ? 90
      : /engineer/i.test(r.designation || "") ? 60
        : 0;
  return seniority + serviceYears(r.serviceInDistrict) * 10 + num(r.age, 0);
}

/** Sort approved rows by rank and stamp each with a 1-based rank. */
function withRanks(rows) {
  return [...rows]
    .sort((a, b) => rankScore(b) - rankScore(a) || String(a.employeeName).localeCompare(String(b.employeeName)))
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/* ------------------------- team formation ---------------------------- */
/*
 * Phase 2 roster grouping. The backend randomization run remains the
 * authoritative allocator; this workflow view groups imported staff.
 */

const CORE_TEAM_SIZE = 6;

const CORE_TEAM_ROLES = Object.freeze([
  "Presiding Officer",
  "Assistant Presiding Officer",
  "1st Other Polling Officer (OPO 1)",
  "2nd Other Polling Officer (OPO 2)",
  "3rd Other Polling Officer (OPO 3)",
  "4th Other Polling Officer (OPO 4)",
]);

/** Unique team code in the backend's PP-<SHORT>-<NNN> shape. */
function buildTeamCode(short, n) {
  return `PP-${short}-${String(n).padStart(3, "0")}`;
}

/**
 * Form the ranked list into polling teams.
 * Team composition (from Phase 1 validated employees):
 *   Slot 0: Presiding Officer (PO)
 *   Slot 1: Assistant Presiding Officer (APO)
 *   Slots 2-5: four Other Polling Officers (OPO 1, OPO 2, OPO 3, OPO 4)
 * Total core team = 6 members; an uploaded MO is the 7th member.
 * Surplus officers not fitting into complete teams are allocated designated
 * reserve duties (Reserve PO, Reserve APO, Reserve OPO) based on rank.
 */
function formTeams(rankedRows, codeShort) {
  const n = rankedRows.length;
  if (n === 0) return [];

  const rowsPerTeam = CORE_TEAM_SIZE;
  let teamCount = Math.floor(n / rowsPerTeam);
  if (teamCount === 0 && n > 0) {
    teamCount = 1; // small pool: one team
  }
  const opNeeded = teamCount * CORE_TEAM_SIZE;
  const operational = rankedRows.slice(0, Math.min(opNeeded, n));
  const leftover = rankedRows.slice(operational.length);
  const teams = [];
  for (let t = 0; t < teamCount; t += 1) {
    const chunk = operational.slice(t * CORE_TEAM_SIZE, (t + 1) * CORE_TEAM_SIZE);
    if (chunk.length === 0) continue;
    teams.push({ chunk, teamCode: buildTeamCode(codeShort, t + 1), teamIndex: t + 1 });
  }
  const out = [];
  for (const tm of teams) {
    const { chunk, teamCode, teamIndex } = tm;
    const teamStatus = chunk.length >= CORE_TEAM_SIZE ? "formed" : "incomplete";
    chunk.forEach((r, i) => {
      const teamRole = CORE_TEAM_ROLES[i] || `Other Polling Officer (OPO ${i - 1})`;
      let generalRole = "Other Polling Officer";
      if (i === 0) generalRole = "Presiding Officer";
      else if (i === 1) generalRole = "Assistant Presiding Officer";

      out.push({
        ...r,
        teamCode,
        teamIndex,
        teamRole,
        role: generalRole,
        teamStatus,
      });
    });
  }
  // Surplus officers not in complete teams: allocate reserve posts based on rank
  leftover.forEach((r, idx) => {
    let reserveRole = "Other Polling Officer";
    let reserveTeamRole = `Reserve Other Polling Officer (Reserve OPO ${Math.max(1, idx - 1)})`;
    if (idx === 0) {
      reserveRole = "Presiding Officer";
      reserveTeamRole = "Reserve Presiding Officer (Reserve PO)";
    } else if (idx === 1) {
      reserveRole = "Assistant Presiding Officer";
      reserveTeamRole = "Reserve Assistant Presiding Officer (Reserve APO)";
    }
    out.push({
      ...r,
      role: reserveRole,
      teamRole: reserveTeamRole,
      reservePost: reserveTeamRole,
      teamStatus: "reserve",
    });
  });
  return out;
}

/**
 * Attach one uploaded Micro Observer (bank staff) to each formed team.
 * MOs come ONLY from the separate MO upload list.
 * Adds one MO to the six-officer core team.
 */
function assignMicroObserversToTeams(rows, moList) {
  const teams = groupIntoTeams(rows.filter((r) => r.teamCode));
  const operational = rows.filter((r) => !r.isMicroObserver);
  const usedMoIds = new Set(
    operational.filter((r) => r.isMicroObserver).map((r) => String(r.employeeId))
  );
  const free = (Array.isArray(moList) ? moList : []).filter(
    (m) => !usedMoIds.has(String(m.employee_id ?? m.employeeId ?? ""))
  );
  const out = [...operational];
  const shortfall = [];
  let cursor = 0;
  for (const tm of teams) {
    if (cursor >= free.length) {
      shortfall.push({ teamCode: tm.teamCode, missing: 1 });
      continue;
    }
    const mo = free[cursor];
    cursor += 1;
    out.push({
      employeeId: mo.employee_id ?? mo.employeeId ?? "—",
      employeeName: mo.employee_name ?? mo.employeeName ?? mo.name ?? "—",
      designation: mo.designation ?? "Micro Observer",
      gender: mo.gender ?? "—",
      age: mo.age ?? "—",
      employmentType: mo.bank_name ?? mo.bankName ?? "Bank / PSU Staff",
      workMandal: mo.working_mandal ?? mo.workMandal ?? "—",
      serviceInDistrict: "—",
      phCategory: "—",
      criminalCaseEci: "—",
      rank: null,
      teamCode: tm.teamCode,
      teamIndex: tm.index,
      teamRole: "Micro Observer",
      role: "Micro Observer",
      teamStatus: "complete",
      isMicroObserver: true,
    });
  }
  return { rows: out, shortfall, assigned: cursor };
}

/** Drop any previous team assignment before re-forming (idempotent re-form). */
function stripTeam(row) {
  const clean = { ...row };
  delete clean.role;
  delete clean.teamCode;
  delete clean.teamIndex;
  delete clean.teamRole;
  delete clean.teamStatus;
  delete clean.isMicroObserver;
  return clean;
}

/** Group flat member rows back into team chunks (unique codes), in team order. */
function groupIntoTeams(rows) {
  const map = new Map();
  rows.forEach((r) => {
    if (!r.teamCode) return;
    if (!map.has(r.teamCode)) {
      map.set(r.teamCode, {
        teamCode: r.teamCode,
        index: r.teamIndex,
        status: r.teamStatus,
        members: [],
      });
    }
    map.get(r.teamCode).members.push(r);
  });
  return [...map.values()].sort((a, b) => a.index - b.index);
}

/** Human label for a team status badge. */
function teamStatusLabel(team) {
  const hasMo = (team.members || []).some((m) => m.isMicroObserver);
  if (hasMo && team.members.length >= 7) return "Complete (7 Members with MO)";
  if (team.members.length >= 6) return "6 Members (1 PO + 1 APO + 4 OPO)";
  return `Incomplete (${team.members.length}/6)`;
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


/* --------------------------- approved loader --------------------------- */

/**
 * Normalize the approved rows returned by the Phase 1 MongoDB import batch.
 * Preserves all columns so full details are available for unassigned/reserve officers.
 */
function loadApproved(personnel) {
  return personnel.map((raw) => {
    const rawVals = raw.rawValues || {};
    return {
      ...rawVals,
      ...raw,
      employeeId: pick(raw, "employeeId", "employeeID", "empId", "EmployeeID", "employee_id") ?? pick(rawVals, "Employee ID", "EmployeeID", "EMP ID", "emp_id") ?? "—",
      employeeName: pick(raw, "employeeName", "name", "employee_name") ?? pick(rawVals, "Employee Name", "Name", "NAME") ?? "—",
      designation: pick(raw, "designation", "Designation") ?? pick(rawVals, "Designation", "DESIGNATION") ?? "—",
      gender: pick(raw, "gender", "Gender", "sex") ?? pick(rawVals, "Gender", "Sex", "GENDER") ?? "—",
      age: pick(raw, "age", "Age") ?? pick(rawVals, "Age", "AGE") ?? "—",
      scaleOfPay: pick(raw, "scaleOfPay", "scale_of_pay", "ScaleOfPay", "payScale", "pay_scale") ?? pick(rawVals, "Scale of Pay", "Pay Scale", "Scale Of Pay", "SCALE OF PAY") ?? "—",
      basicPay: pick(raw, "basicPay", "basic_pay", "BasicPay") ?? pick(rawVals, "Basic Pay", "Basic", "BASIC PAY") ?? "—",
      gazettedStatus: pick(raw, "gazettedStatus", "gazetted_status", "GazettedStatus", "isGazetted", "gazetted") ?? pick(rawVals, "Gazetted / Non-Gazetted", "Gazetted", "Gazetted Status") ?? "—",
      employmentType: pick(raw, "employmentType", "employment_type", "EmploymentType") ?? pick(rawVals, "Employment Type", "Type of Employment", "EMPLOYMENT TYPE") ?? "—",
      workMandal: pick(raw, "workMandal", "work_mandal", "WorkMandal", "mandal") ?? pick(rawVals, "Working Mandal", "Work Mandal", "Working Mandals", "Work Place (Mandal)") ?? "—",
      nativeMandal: pick(raw, "nativeMandal", "native_mandal", "NativeMandal") ?? pick(rawVals, "Native Mandal", "Native Mandals", "Native Place (Mandal)") ?? "—",
      mobileNo: pick(raw, "mobileNo", "mobile_no", "MobileNo", "mobile", "phone") ?? pick(rawVals, "Mobile Number", "Mobile No", "Mobile", "Contact No") ?? "—",
      serviceInDistrict: pick(raw, "serviceInDistrict", "service_in_district", "ServiceInDistrict", "service") ?? pick(rawVals, "Total Service", "Service In District", "Service") ?? "—",
      phCategory: pick(raw, "phCategory", "ph_category", "PHCategory", "ph") ?? pick(rawVals, "PH Category", "PH", "Physical Handicapped") ?? "—",
      criminalCaseEci: pick(raw, "criminalCaseEciRestriction", "criminalCaseEci", "criminal_case_or_eci_orders", "criminalCase", "eciRestriction") ?? "—",
    };
  });
}

/* ---------------------------- sub-components -------------------------- */

function RoleBadge({ role }) {
  if (!role || role === "—") {
    return <span className="p1-badge p1-badge-review">Unassigned</span>;
  }
  if (role.includes("Presiding") && !role.includes("Assistant")) {
    return (
      <span className="p1-badge p2-badge-presiding">
        <TrophyIcon /> {role}
      </span>
    );
  }
  if (role.includes("Assistant Presiding") || role.includes("Assistant Polling") || role.includes("APO")) {
    return (
      <span className="p1-badge p2-badge-apo">
        <BadgeIcon /> {role}
      </span>
    );
  }
  if (role.includes("Micro Observer") || role === "MO") {
    return (
      <span className="p1-badge p2-badge-mo">
        <BadgeIcon /> {role}
      </span>
    );
  }
  // Other Polling Officers (1st OPO, 2nd OPO, 3rd OPO, Reserve OPO)
  return (
    <span className="p1-badge p2-badge-polling">
      <BadgeIcon /> {role}
    </span>
  );
}


/* ---------------------------- excel export ---------------------------- */

const EXPORT_COLS = [
  ["Team Code", 14],
  ["Polling Station", 24],
  ["Officer Category", 16],
  ["Assigned Role", 24],
  ["Employee ID", 14],
  ["Employee Name", 26],
  ["Designation", 24],
  ["Work Mandal", 18],
  ["Team Status", 16],
];

/** Map one team's officers to flat export rows (Excel header order). */
function teamExportRows(team, group) {
  return team.members.filter((member) => {
    if (group === "all") return true;
    if (group === "MO") return Boolean(member.isMicroObserver);
    if (group === "PO-APO") {
      return !member.isMicroObserver &&
        (member.role === "Presiding Officer" || member.role === "Assistant Presiding Officer" || member.teamRole?.includes("Presiding"));
    }
    return member.role === "Other Polling Officer" && !member.isMicroObserver;
  }).map((m) => {
    let cat = "OPO";
    if (m.isMicroObserver) cat = "MO";
    else if (m.role === "Presiding Officer" || m.role === "Assistant Presiding Officer" || m.teamRole?.includes("Presiding")) cat = "PO/APO";
    return {
      "Team Code": team.teamCode || m.teamCode || "—",
      "Polling Station": m.pollingStation || team.pollingStation || "To be allocated in Phase 3",
      "Officer Category": cat,
      "Assigned Role": m.teamRole || m.role,
      "Employee ID": m.employeeId,
      "Employee Name": m.employeeName,
      Designation: m.designation,
      "Work Mandal": m.workMandal,
      "Team Status": teamStatusLabel(team),
    };
  });
}

function exportTeamsExcel(teams, group) {
  const wb = XLSX.utils.book_new();
  const rows = teams.flatMap((team) => teamExportRows(team, group));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = EXPORT_COLS.map(([, wch]) => ({ wch }));
  const sheetName = group === "all" ? "All_Teams" : group === "PO-APO" ? "PO_APO" : group;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const fileName = group === "all" ? "phase2-all-teams.xlsx" : `phase2-${group.toLowerCase()}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

/* ------------------------------- page --------------------------------- */

export default function Phase2({ context = "municipal" }) {
  const isMunicipal = context === "municipal";
  const contextLabel = isMunicipal ? "Municipal Elections" : "Gram Panchayat Elections";
  const backHref = isMunicipal ? "/elections/municipal" : "/elections/panchayat";

  const [approvedSource, setApprovedSource] = useState([]);
  const [sourceBatchId, setSourceBatchId] = useState(null);
  const [workflowError, setWorkflowError] = useState("");
  const [moAssigned, setMoAssigned] = useState(0);
  const [moShortfall, setMoShortfall] = useState([]);
  const [loadedContext, setLoadedContext] = useState(null);
  const [loadingPhase2, setLoadingPhase2] = useState(true);
  const hasData = loadedContext === context && approvedSource.length > 0;

  // rows always carry a rank; role stays "—" until the user forms teams.
  const [rows, setRows] = useState([]);
  const [partitioned, setPartitioned] = useState(false);
  const [busy, setBusy] = useState(false);

  // Separate Micro Observer upload (bank staff) + per-team assignment.
  const moInputRef = useRef(null);
  const [moList, setMoList] = useState([]); // uploaded MO candidates (bank staff)
  const [moStatus, setMoStatus] = useState("idle"); // idle | uploading | done | error
  const [moMsg, setMoMsg] = useState("");
  const [showRemainingMo, setShowRemainingMo] = useState(false);
  const [assigningMo, setAssigningMo] = useState(false);
  const [exportGroup, setExportGroup] = useState("PO-APO");
  const [roleFilter, setRoleFilter] = useState("all"); // all | PO-APO | OPO | MO
  const [teamFilter, setTeamFilter] = useState(null); // team code → only that team's officers
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [remainingMoPage, setRemainingMoPage] = useState(1);
  const [surplusPage, setSurplusPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingPhase2(true);
        setWorkflowError("");
        const sessionUploaded = typeof sessionStorage !== "undefined"
          ? sessionStorage.getItem(`phase1_session_uploaded_${context}`)
          : null;
        if (!sessionUploaded) {
          if (!cancelled) {
            setApprovedSource([]);
            setRows([]);
            setSourceBatchId(null);
            setPartitioned(false);
            setMoList([]);
            setLoadedContext(context);
            setLoadingPhase2(false);
          }
          return;
        }

        const savedPhase1 = await getWorkflowData(context, "phase1");
        const batchId = savedPhase1?.value?.batchId;
        if (!batchId) {
          if (!cancelled) {
            setApprovedSource([]);
            setRows([]);
            setSourceBatchId(null);
            setPartitioned(false);
            setMoList([]);
            setLoadedContext(context);
          }
          return;
        }

        const [detail, savedPhase2] = await Promise.all([
          getBatchPersonnel(batchId),
          getWorkflowData(context, "phase2"),
        ]);
        if (cancelled) return;

        const rawPersonnel = Array.isArray(detail?.personnel) ? detail.personnel : [];
        // Strictly take ONLY the validated / approved employees from Phase 1
        const validatedPersonnel = rawPersonnel.filter((p) => {
          const st = String(p.status || p.eligibilityStatus || "Approved").toLowerCase();
          return st !== "rejected" && st !== "ineligible" && st !== "exempt";
        });
        const source = loadApproved(validatedPersonnel);
        const savedRows = savedPhase2?.value?.sourceBatchId === batchId
          && Array.isArray(savedPhase2?.value?.rows)
          ? savedPhase2.value.rows
          : null;
        setApprovedSource(source);
        setSourceBatchId(batchId);
        setRows(savedRows || withRanks(source));
        setPartitioned(Boolean(savedRows));
        setMoAssigned(savedPhase2?.value?.moAssigned || 0);
        setMoShortfall(Array.isArray(savedPhase2?.value?.moShortfall)
          ? savedPhase2.value.moShortfall
          : []);
        // Restore context-specific MO list if saved; otherwise start with empty [] (never 2000!)
        const savedMoList = Array.isArray(savedPhase2?.value?.moList)
          ? savedPhase2.value.moList
          : [];
        setMoList(savedMoList);
        setWorkflowError("");
        setLoadedContext(context);
      } catch (error) {
        if (!cancelled) {
          if (error && (error.status === 404 || String(error.message || "").toLowerCase().includes("not found"))) {
            clearWorkflowData(context, "phase2").catch(() => {});
            setApprovedSource([]);
            setRows([]);
            setSourceBatchId(null);
            setPartitioned(false);
            setMoList([]);
            setWorkflowError("");
          } else {
            setWorkflowError(error?.message || "Failed to load Phase 2 data from MongoDB.");
          }
          setLoadedContext(context);
        }
      } finally {
        if (!cancelled) setLoadingPhase2(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [context]);

  const presidingCount = rows.filter((r) => r.role === "Presiding Officer").length;
  const apoCount = rows.filter((r) => r.role === "Assistant Presiding Officer").length;
  const opoCount = rows.filter((r) => r.role === "Other Polling Officer").length;
  const microCount = rows.filter((r) => r.isMicroObserver).length;
  const groupedTeams = useMemo(() => groupIntoTeams(rows), [rows]);
  const teamCount = groupedTeams.length;
  const hasExportRows = rows.some((row) => {
    if (exportGroup === "MO") return Boolean(row.isMicroObserver && row.teamCode);
    if (exportGroup === "PO-APO") return !row.isMicroObserver &&
      (row.role === "Presiding Officer" || row.role === "Assistant Presiding Officer");
    return row.role === "Other Polling Officer" && !row.isMicroObserver;
  });
  const canContinue = hasData && partitioned && teamCount > 0 && groupedTeams.every(
    (team) => team.status === "formed" || team.status === "complete" || team.members.length >= 6
  );

  async function runPartition() {
    setBusy(true);
    setWorkflowError("");
    try {
      await new Promise((resolve) => setTimeout(resolve, 450));
      const next = formTeams(withRanks(rows.map(stripTeam)), isMunicipal ? "MUN" : "GPN");
      await saveWorkflowData(context, "phase2", {
        sourceBatchId,
        rows: next,
        moList,
        moAssigned: 0,
        moShortfall: [],
      });
      setRows(next);
      setPartitioned(true);
      setMoAssigned(0);
      setMoShortfall([]);
      setRoleFilter("all");
      setTeamFilter(null);
      setPage(1);
    } catch (error) {
      setWorkflowError(error?.message || "Failed to save Phase 2 data to MongoDB.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPartition() {
    setWorkflowError("");
    try {
      await clearWorkflowData(context, "phase2");
      setRows(withRanks(approvedSource.map(stripTeam)));
      setPartitioned(false);
      setMoAssigned(0);
      setMoShortfall([]);
      setMoList([]);
      setMoMsg("");
      setMoStatus("idle");
      setShowRemainingMo(false);
      setRoleFilter("all");
      setTeamFilter(null);
      setPage(1);
    } catch (error) {
      setWorkflowError(error?.message || "Failed to clear Phase 2 data from MongoDB.");
    }
  }

  /* -------- separate Micro Observer upload (bank staff) + Assign MO ------- */
  async function handleUploadMoFile(f) {
    if (!f) return;
    setMoStatus("uploading");
    setMoMsg("");
    setWorkflowError("");
    try {
      const res = await uploadMicroObservers(f);
      const rejected = Array.isArray(res?.rejected) ? res.rejected : [];
      let list = [];
      try {
        const fetched = await listMicroObservers();
        list = Array.isArray(fetched?.microObservers) ? fetched.microObservers : [];
      } catch {
        list = [];
      }
      setMoList(list);
      setMoStatus("done");
      setMoMsg(
        `MO upload successful: ${res?.acceptedRows ?? list.length} observer(s) loaded.` +
        (rejected.length > 0 ? ` (${rejected.length} invalid/rejected rows).` : "") +
        " Click 'Assign MO to Each Team' to assign."
      );
      // Save to workflow WITHOUT auto-attaching (user must click button to assign)
      await saveWorkflowData(context, "phase2", {
        sourceBatchId,
        rows,
        moList: list,
        moAssigned: 0,
        moShortfall: [],
      });
    } catch (err) {
      setMoStatus("error");
      setMoMsg(err?.message || "Micro Observer upload failed.");
    }
  }

  function onMoPick(e) {
    const f = e.target.files?.[0];
    if (f) {
      handleUploadMoFile(f);
    }
    e.target.value = "";
  }

  async function runAssignMo() {
    if (!partitioned || moList.length === 0) return;
    setAssigningMo(true);
    setWorkflowError("");
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const base = rows.filter((row) => !row.isMicroObserver);
      const { rows: next, shortfall, assigned } = assignMicroObserversToTeams(base, moList);
      await saveWorkflowData(context, "phase2", {
        sourceBatchId,
        rows: next,
        moList,
        moAssigned: assigned,
        moShortfall: shortfall,
      });
      setRows(next);
      setMoAssigned(assigned);
      setMoShortfall(shortfall);
      setRoleFilter("all");
      setTeamFilter(null);
      setPage(1);
    } catch (error) {
      setWorkflowError(error?.message || "Failed to save Micro Observer assignments to MongoDB.");
    } finally {
      setAssigningMo(false);
    }
  }

  async function removeMoData() {
    setWorkflowError("");
    try {
      const cleanedRows = rows.filter((r) => !r.isMicroObserver);
      setRows(cleanedRows);
      setMoList([]);
      setMoAssigned(0);
      setMoShortfall([]);
      setMoMsg("");
      setMoStatus("idle");
      setShowRemainingMo(false);
      await saveWorkflowData(context, "phase2", {
        sourceBatchId,
        rows: cleanedRows,
        moList: [],
        moAssigned: 0,
        moShortfall: [],
      });
    } catch (error) {
      setWorkflowError(error?.message || "Failed to remove MO data from MongoDB.");
    }
  }

  const assignedMoIds = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      if (r.isMicroObserver && r.employeeId) {
        set.add(String(r.employeeId));
      }
    });
    return set;
  }, [rows]);

  const remainingMoList = useMemo(() => {
    if (!Array.isArray(moList)) return [];
    return moList.filter(
      (m) => !assignedMoIds.has(String(m.employee_id ?? m.employeeId ?? ""))
    );
  }, [moList, assignedMoIds]);

  const surplusOfficers = useMemo(
    () => (partitioned ? rows.filter((r) => !r.teamCode && !r.isMicroObserver) : []),
    [rows, partitioned]
  );

  const filtered = useMemo(() => {
    // When partitioned, the main table displays the generated teams.
    // Surplus / unassigned officers are displayed in their own dedicated section below.
    let list = partitioned ? rows.filter((r) => r.teamCode) : rows;
    if (roleFilter === "PO-APO") list = list.filter((row) => !row.isMicroObserver &&
      (row.role === "Presiding Officer" || row.role === "Assistant Presiding Officer")
    );
    if (roleFilter === "OPO") list = list.filter((row) => row.role === "Other Polling Officer" && !row.isMicroObserver);
    if (roleFilter === "MO") list = list.filter((row) => Boolean(row.isMicroObserver && row.teamCode));
    if (teamFilter) list = list.filter((r) => r.teamCode === teamFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.employeeName, r.employeeId, r.designation, r.teamCode, r.teamRole].join(" ").toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, partitioned, roleFilter, teamFilter, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);
  const pages = pageList(safePage, pageCount);

  // Pagination for remaining / standby Micro Observers
  const remainingMoPageCount = Math.max(1, Math.ceil(remainingMoList.length / PAGE_SIZE));
  const safeRemainingMoPage = Math.min(Math.max(1, remainingMoPage), remainingMoPageCount);
  const pagedRemainingMo = remainingMoList.slice((safeRemainingMoPage - 1) * PAGE_SIZE, safeRemainingMoPage * PAGE_SIZE);
  const remMoStart = remainingMoList.length === 0 ? 0 : (safeRemainingMoPage - 1) * PAGE_SIZE + 1;
  const remMoEnd = Math.min(safeRemainingMoPage * PAGE_SIZE, remainingMoList.length);
  const remMoPages = pageList(safeRemainingMoPage, remainingMoPageCount);

  // Pagination for unformed team members / surplus officers
  const surplusPageCount = Math.max(1, Math.ceil(surplusOfficers.length / PAGE_SIZE));
  const safeSurplusPage = Math.min(Math.max(1, surplusPage), surplusPageCount);
  const pagedSurplusOfficers = surplusOfficers.slice((safeSurplusPage - 1) * PAGE_SIZE, safeSurplusPage * PAGE_SIZE);
  const surplusStart = surplusOfficers.length === 0 ? 0 : (safeSurplusPage - 1) * PAGE_SIZE + 1;
  const surplusEnd = Math.min(safeSurplusPage * PAGE_SIZE, surplusOfficers.length);
  const surplusPages = pageList(safeSurplusPage, surplusPageCount);


  return (
    <main className="p1-page p2-page">
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
          <span>Phase 2</span>
          <span className="p1-crumb-sep">/</span>
          <span className="p1-crumb-current">Officer Ranking &amp; Assignment</span>
        </nav>

        {/* title + info box */}
        <section className="p1-title-row">
          <div className="p1-title">
            <span className="p1-title-icon p2-title-icon">
              <PeopleIcon />
            </span>
            <div>
              <h1>Phase 2 – Team Formation</h1>
              <p>Phase 1 approved personnel grouped into polling teams with their team IDs and assigned roles.</p>
            </div>
          </div>
          <aside className="p1-infobox p2-infobox">
            <span className="p1-infobox-icon">
              <InfoIcon />
            </span>
            <p>Each complete team has 1 PO, 1 APO and 4 OPOs. An uploaded Micro Observer is added to the team separately.</p>
          </aside>
        </section>

        {/* loading and error states */}
        {loadingPhase2 && (
          <section className="p2-empty" style={{ padding: "32px", textAlign: "center" }}>
            <span className="p1-spinner" style={{ width: 32, height: 32, margin: "0 auto 12px", display: "block" }} />
            <h2>Loading Phase 2 team data…</h2>
            <p>Fetching validated personnel records and saved team allocations from MongoDB.</p>
          </section>
        )}

        {workflowError && (
          <div className="p1-card tr-error" role="alert" style={{ marginBottom: 16, padding: "14px 18px" }}>
            {workflowError}
          </div>
        )}

        {/* no Phase 1 data yet → prompt the user to complete Phase 1 */}
        {!hasData && !loadingPhase2 && (
          <section className="p2-empty">
            <span className="p2-empty-icon">
              <CloudUpIcon />
            </span>
            <h2>No approved employees yet</h2>
            <p>
              This page ranks and partitions the employees approved in{" "}
              <strong>Phase 1 – Employee Validation</strong>. Please complete Phase 1
              first by uploading and validating the Employee Excel file.
            </p>
            <a className="p2-empty-btn" href={`${backHref}/phase-1`}>
              Go to Phase 1 – Employee Validation
            </a>
          </section>
        )}

        {/* partition action + result (only once Phase 1 has approved data) */}
        {hasData && !loadingPhase2 && (
          <>
            <section className="p2-partition-bar">
              <div className="p2-partition-info">
                <span className="p2-partition-count">
                  <strong>{rows.length}</strong> approved employees ready to assign
                </span>
                <span className="p2-partition-hint">
                  {partitioned
                    ? `Formed ${teamCount} team${teamCount === 1 ? "" : "s"} (${presidingCount} PO, ${apoCount} APO, ${opoCount} OPO; 6 officers per complete team)${microCount > 0 ? `, plus ${microCount} Micro Observers (7 members per team).` : " — upload and assign MO data to make 7 members per team."}`
                    : "Not yet formed — form teams of 1 PO, 1 APO and 4 OPOs."}
                </span>
                {moShortfall.length > 0 && (
                  <span className="p2-partition-warn">
                    {moShortfall.length} team{moShortfall.length === 1 ? "" : "s"} missing a Micro Observer
                    ({moShortfall.map((s) => s.teamCode).join(", ")}) — upload more MO staff and re-assign.
                  </span>
                )}
              </div>
              <div className="p2-partition-actions">
                <button
                  type="button"
                  className="p2-partition-btn"
                  onClick={runPartition}
                  disabled={busy || rows.length === 0}
                >
                  {busy ? (
                    <span className="p1-spinner" aria-hidden="true" />
                  ) : (
                    <SplitIcon />
                  )}
                  {partitioned ? "Re-form Teams" : "Form Teams"}
                </button>
                {partitioned && (
                  <button type="button" className="p2-reset-btn" onClick={resetPartition}>
                    Reset
                  </button>
                )}
              </div>
            </section>

            {/* separate Micro Observer upload (bank staff) + Assign MO */}
            <section className="p2-mo-bar">
              <div className="p2-partition-info">
                <span className="p2-partition-count">
                  <strong>{moList.length}</strong> Micro Observer{moList.length === 1 ? "" : "s"} uploaded
                  {moAssigned > 0 && (
                    <span className="p2-mo-success"><CheckIcon />{moAssigned} assigned</span>
                  )}
                </span>
                <span className="p2-partition-hint">
                  {moList.length === 0
                    ? "Upload the MO spreadsheet (bank staff). Clicking 'Assign MO to Each Team' assigns 1 Micro Observer to each team to reach 6 total members."
                    : moAssigned > 0
                      ? `Micro Observers assigned (${moAssigned} team${moAssigned === 1 ? "" : "s"} have 6 members). Use Re-assign or Cancel as needed.`
                      : "Micro Observers loaded. Click 'Assign MO to Each Team' to assign one observer to each formed team."}
                </span>
                {moMsg && (
                  <span className={moStatus === "error" ? "p2-partition-warn" : "p2-partition-hint"}>
                    {moMsg}
                  </span>
                )}
              </div>
              <div className="p2-partition-actions">
                <input
                  ref={moInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={onMoPick}
                  hidden
                />
                <button
                  type="button"
                  className="p2-partition-btn"
                  onClick={() => moInputRef.current?.click()}
                  disabled={moStatus === "uploading"}
                >
                  {moStatus === "uploading" ? (
                    <span className="p1-spinner" aria-hidden="true" />
                  ) : (
                    <CloudUpIcon />
                  )}
                  {moList.length > 0 ? "Upload New MO Data" : "Upload MO Data"}
                </button>

                {partitioned && moList.length > 0 && (
                  <button
                    type="button"
                    className="p2-partition-btn"
                    onClick={runAssignMo}
                    disabled={assigningMo}
                    title="Assign one uploaded Micro Observer to each team"
                  >
                    {assigningMo ? (
                      <span className="p1-spinner" aria-hidden="true" />
                    ) : (
                      <BadgeIcon />
                    )}
                    {moAssigned > 0 ? "Re-assign MO" : "Assign MO to Each Team"}
                  </button>
                )}

                {moList.length > 0 && (
                  <button
                    type="button"
                    className="p2-mo-remove-btn"
                    onClick={removeMoData}
                    disabled={moStatus === "uploading" || assigningMo}
                    title="Remove uploaded MO data and assignments from this phase"
                  >
                    Cancel / Remove MO Data
                  </button>
                )}

                {moList.length > 0 && (
                  <button
                    type="button"
                    className={`p2-mo-toggle-btn ${showRemainingMo ? "is-active" : ""}`}
                    onClick={() => setShowRemainingMo((cur) => !cur)}
                    title={showRemainingMo ? "Close remaining Micro Observers list" : "Show remaining / standby Micro Observers"}
                  >
                    {showRemainingMo
                      ? "Close Remaining MO Data ✕"
                      : `Show Remaining MO Data (${remainingMoList.length})`}
                  </button>
                )}
              </div>
            </section>

            {/* result */}
            <section className="p1-result">
              {/* toolbar */}
              <div className="p1-toolbar">
                <div className="p1-chips" style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
                  <label className="p2-role-filter">
                    <span>View Generated List</span>
                    <select
                      value={roleFilter}
                      disabled={!partitioned}
                      onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }}
                      aria-label="View Generated List"
                    >
                      <option value="all">No choice</option>
                      <option value="PO-APO">PO/APO</option>
                      <option value="OPO">OPO</option>
                      <option value="MO">MO</option>
                    </select>
                  </label>

                  <div className="p2-download-ctrl" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <label className="p2-role-filter">
                      <span>Download Generated List</span>
                      <select
                        className="p2-export-select"
                        value={exportGroup}
                        disabled={!partitioned}
                        onChange={(event) => setExportGroup(event.target.value)}
                        aria-label="Download Generated List"
                      >
                        <option value="PO-APO">PO/APO</option>
                        <option value="OPO">OPO</option>
                        <option value="MO">MO</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      className="p1-mini-btn p2-btn-compact"
                      onClick={() => exportTeamsExcel(groupedTeams, "all")}
                      disabled={!partitioned || groupedTeams.length === 0}
                      title={!partitioned ? "Complete team formation first" : "Download all teams roster in Excel format"}
                      style={{ background: "#0284c7", color: "#fff", fontWeight: 700 }}
                    >
                      <DownloadIcon /> All Teams
                    </button>
                    <button
                      type="button"
                      className="p1-mini-btn p2-btn-compact"
                      onClick={() => exportTeamsExcel(groupedTeams, exportGroup)}
                      disabled={!partitioned || !hasExportRows}
                      title={!partitioned ? "Complete team formation first" : `Download ${exportGroup === "PO-APO" ? "PO/APO" : exportGroup} Excel`}
                      style={{ background: "#059669", color: "#fff", fontWeight: 700 }}
                    >
                      <DownloadIcon /> {exportGroup === "PO-APO" ? "PO/APO" : exportGroup}
                    </button>
                  </div>
                </div>

                <div className="p1-tools">
                  <div className="p1-search-wrap">
                    <span className="p1-search-icon">
                      <SearchIcon />
                    </span>
                    <input
                      type="search"
                      className="p1-search"
                      placeholder="Search by team code, role, name, Employee ID, or designation..."
                      value={query}
                      onChange={(e) => { setQuery(e.target.value); setPage(1); }}
                    />
                  </div>
                </div>
              </div>

              {/* stats */}
              <div className="p1-stats">
                <div className="p1-stat p1-stat-total">
                  <span className="p1-stat-icon"><CheckIcon /></span>
                  <div className="p1-stat-meta">
                    <span className="p1-stat-label">Approved (Phase 1)</span>
                    <span className="p1-stat-num">{approvedSource.length}</span>
                  </div>
                </div>
                <div className="p1-stat p2-stat-presiding">
                  <span className="p1-stat-icon"><TrophyIcon /></span>
                  <div className="p1-stat-meta">
                    <span className="p1-stat-label">Presiding (PO)</span>
                    <span className="p1-stat-num">{presidingCount}</span>
                  </div>
                </div>
                <div className="p1-stat p2-stat-apo">
                  <span className="p1-stat-icon"><BadgeIcon /></span>
                  <div className="p1-stat-meta">
                    <span className="p1-stat-label">Asst Presiding (APO)</span>
                    <span className="p1-stat-num">{apoCount}</span>
                  </div>
                </div>
                <div className="p1-stat p2-stat-polling">
                  <span className="p1-stat-icon"><BadgeIcon /></span>
                  <div className="p1-stat-meta">
                    <span className="p1-stat-label">Other Polling (OPO)</span>
                    <span className="p1-stat-num">{opoCount}</span>
                  </div>
                </div>
                <div className="p1-stat p2-stat-micro">
                  <span className="p1-stat-icon"><BadgeIcon /></span>
                  <div className="p1-stat-meta">
                    <span className="p1-stat-label">Micro Observers (MO)</span>
                    <span className="p1-stat-num">{partitioned ? microCount : "—"}</span>
                  </div>
                </div>
                <div className="p1-stat p2-stat-teams">
                  <span className="p1-stat-icon"><SplitIcon /></span>
                  <div className="p1-stat-meta">
                    <span className="p1-stat-label">Teams Formed</span>
                    <span className="p1-stat-num">{partitioned ? `${teamCount} (${microCount > 0 ? "7-Member" : "6-Member"})` : "—"}</span>
                  </div>
                </div>

                {partitioned && surplusOfficers.length > 0 && (
                  <div className="p1-stat p1-stat-review">
                    <span className="p1-stat-icon"><PeopleIcon /></span>
                    <div className="p1-stat-meta">
                      <span className="p1-stat-label">Reserve Pool</span>
                      <span className="p1-stat-num">{surplusOfficers.length}</span>
                    </div>
                  </div>
                )}

                <div className="p1-stat p1-stat-ok">
                  <span className="p1-stat-icon"><CheckIcon /></span>
                  <div className="p1-stat-meta">
                    <span className="p1-stat-label">Status</span>
                    <span className="p1-stat-num">{partitioned ? "Formed" : "Pending"}</span>
                  </div>
                </div>
              </div>


              {/* team-code filters */}
              {partitioned && (
                <div className="p2-export-bar">
                  <div className="p2-export-info">
                    <span className="p2-export-title">
                      Filter by Team <span className="p2-teams-count">({teamCount} team{teamCount === 1 ? "" : "s"})</span>
                      {teamFilter && <span className="p2-team-filter-tag">Viewing {teamFilter}</span>}
                    </span>
                    <span className="p2-export-hint">
                      Click a team chip to view its members, or use Show All Teams.
                    </span>
                  </div>
                  <div className="p2-export-actions">
                    <div className="p2-export-row">
                      <button
                        type="button"
                        className="p2-show-all"
                        onClick={() => {
                          setTeamFilter(null);
                          setPage(1);
                        }}
                        disabled={!teamFilter}
                      >
                        Show All Teams
                      </button>
                    </div>
                    <div className="p2-export-chips" role="group" aria-label="Filter officers by team code">
                      {groupedTeams.map((team) => (
                        <button
                          key={team.teamCode}
                          type="button"
                          className={`p2-export-chip${teamFilter === team.teamCode ? " is-active" : ""}`}
                          onClick={() => {
                            setTeamFilter((cur) => (cur === team.teamCode ? null : team.teamCode));
                            setPage(1);
                          }}
                          title={`Show officers of ${team.teamCode}`}
                          aria-pressed={teamFilter === team.teamCode}
                        >
                          {team.teamCode}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}


              {/* table */}
              <div className="p1-table-wrap">
                <table className="p1-table p2-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Team Code</th>
                      <th>Polling Station</th>
                      <th>Employee ID</th>
                      <th>Employee Name</th>
                      <th>Designation</th>
                      <th>Gender</th>
                      <th>Age</th>
                      <th>Employment Type</th>
                      <th>Work Mandal</th>
                      <th>Service in District</th>
                      <th>PH Category</th>
                      <th>Assigned Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="p1-empty">
                          {!partitioned
                            ? "Complete team formation to view or download generated team records."
                            : roleFilter === "OPO"
                              ? "No OPO members are present in the generated teams."
                              : roleFilter === "PO-APO"
                                ? "No PO/APO members are present in the generated teams."
                                : roleFilter === "MO"
                                  ? "No assigned MO members are present in the generated teams."
                                  : "No team records match the selected filter."}
                        </td>
                      </tr>
                    ) : (
                      pageRows.map((r) => (
                        <tr key={`${r.rank}-${r.employeeId}`}>
                          <td className="p2-rank"><span>{r.rank}</span></td>
                          <td className="p1-mono p2-teamcode-cell">{r.teamCode ?? "—"}</td>
                          <td className="p1-mono">{r.pollingStation ?? "Allocated in Phase 3"}</td>
                          <td className="p1-mono">{r.employeeId}</td>
                          <td className="p1-strong">{r.employeeName}</td>
                          <td>{r.designation}</td>
                          <td>{r.gender}</td>
                          <td>{r.age}</td>
                          <td>{r.employmentType}</td>
                          <td>{r.workMandal}</td>
                          <td>{r.serviceInDistrict}</td>
                          <td>{r.phCategory}</td>
                          <td><RoleBadge role={r.teamRole || r.role} /></td>
                        </tr>
                      ))
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
            </section>

            {/* Remaining / Standby Micro Observers Section (Toggled by user) */}
            {showRemainingMo && (
              <section className="p1-invalid-data p2-remaining-mo-section" aria-label="Remaining Micro Observers">
                <div className="p1-invalid-head">
                  <div>
                    <h2>Remaining / Standby Micro Observers</h2>
                    <span className="p1-invalid-count" style={{ marginLeft: 8 }}>
                      {remainingMoList.length} observer{remainingMoList.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="p1-mini-btn"
                    onClick={() => setShowRemainingMo(false)}
                    style={{ cursor: "pointer" }}
                  >
                    Close Remaining MO Data ✕
                  </button>
                </div>
                <p className="p1-invalid-note">
                  The following uploaded Micro Observers (bank/PSU staff) are currently not assigned to any polling team and are available in the reserve observer pool.
                </p>
                <div className="p1-table-wrap">
                  <table className="p1-table">
                    <thead>
                      <tr>
                        <th>Sl. No.</th>
                        <th>Employee ID</th>
                        <th>Officer Name</th>
                        <th>Designation</th>
                        <th>Bank / Organization</th>
                        <th>Working Mandal</th>
                        <th>Mobile No.</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {remainingMoList.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p1-empty">All uploaded Micro Observers are currently assigned to teams.</td>
                        </tr>
                      ) : (
                        pagedRemainingMo.map((mo, idx) => {
                          const serialNo = (safeRemainingMoPage - 1) * PAGE_SIZE + idx + 1;
                          return (
                            <tr key={`rem-mo-${mo.employee_id || mo.employeeId || idx}`}>
                              <td className="p1-mono">{serialNo}</td>
                              <td className="p1-mono">{mo.employee_id ?? mo.employeeId ?? "—"}</td>
                              <td className="p1-strong">{mo.employee_name ?? mo.employeeName ?? mo.name ?? "—"}</td>
                              <td>{mo.designation ?? "Micro Observer"}</td>
                              <td>{mo.bank_name ?? mo.bankName ?? "Bank / PSU Staff"}</td>
                              <td>{mo.working_mandal ?? mo.workMandal ?? "—"}</td>
                              <td className="p1-mono">{mo.mobile_no ?? mo.mobileNo ?? mo.mobile ?? "—"}</td>
                              <td>
                                <span className="p1-badge p2-badge-mo">Standby Reserve MO</span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {remainingMoList.length > 0 && (
                  <div className="p1-pagination">
                    <span className="p1-page-info">
                      Showing {remMoStart} to {remMoEnd} of {remainingMoList.length} remaining observer records
                    </span>
                    <div className="p1-pages">
                      <button
                        type="button"
                        className="p1-page-btn p1-page-nav"
                        onClick={() => setRemainingMoPage(safeRemainingMoPage - 1)}
                        disabled={safeRemainingMoPage <= 1}
                        aria-label="Previous page"
                      >
                        <ChevronLeft />
                      </button>
                      {remMoPages.map((p, idx) =>
                        p === "…" ? (
                          <span key={`dots-mo-${idx}`} className="p1-page-dots">…</span>
                        ) : (
                          <button
                            key={`page-mo-${p}`}
                            type="button"
                            className={`p1-page-btn${p === safeRemainingMoPage ? " is-active" : ""}`}
                            onClick={() => setRemainingMoPage(p)}
                          >
                            {p}
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        className="p1-page-btn p1-page-nav"
                        onClick={() => setRemainingMoPage(safeRemainingMoPage + 1)}
                        disabled={safeRemainingMoPage >= remainingMoPageCount}
                        aria-label="Next page"
                      >
                        <ChevronRight />
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Unformed Team Members / Standby Reserve Officers Section */}
            {partitioned && surplusOfficers.length > 0 && (
              <section className="p1-invalid-data p2-surplus-section" aria-label="Surplus Officers">
                <div className="p1-invalid-head">
                  <div>
                    <h2>Unformed Team Members / Standby Reserve Officers</h2>
                    <span className="p1-invalid-count" style={{ marginLeft: 8 }}>
                      {surplusOfficers.length} officer{surplusOfficers.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <span className="p1-stat-label">Allocated designated reserve duties based on rank</span>
                </div>
                <p className="p1-invalid-note">
                  The following validated personnel were not accommodated into the formed {teamCount} complete 6-member team(s). Each officer has been allocated a designated reserve duty post (Reserve PO, Reserve APO, or Reserve OPO) in accordance with election rules.
                </p>
                <div className="p1-table-wrap">
                  <table className="p1-table">
                    <thead>
                      <tr>
                        <th>Sl. No.</th>
                        <th>Rank</th>
                        <th>Allocated Reserve Post</th>
                        <th>Employee ID</th>
                        <th>Employee Name</th>
                        <th>Designation</th>
                        <th>Gender</th>
                        <th>Age</th>
                        <th>Scale of Pay</th>
                        <th>Basic Pay</th>
                        <th>Gazetted</th>
                        <th>Employment Type</th>
                        <th>Work Mandal</th>
                        <th>Native Mandal</th>
                        <th>Mobile No.</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedSurplusOfficers.map((officer, idx) => {
                        const serialNo = (safeSurplusPage - 1) * PAGE_SIZE + idx + 1;
                        return (
                          <tr key={`${officer.employeeId || 'surplus'}-${idx}`}>
                            <td className="p1-mono">{serialNo}</td>
                            <td className="p2-rank"><span>{officer.rank || serialNo}</span></td>
                            <td>
                              <RoleBadge role={officer.teamRole || officer.reservePost || "Reserve Officer"} />
                            </td>
                            <td className="p1-mono">{officer.employeeId}</td>
                            <td className="p1-strong">{officer.employeeName}</td>
                            <td>{officer.designation}</td>
                            <td>{officer.gender || "—"}</td>
                            <td>{officer.age || "—"}</td>
                            <td className="p1-mono">{officer.scaleOfPay || "—"}</td>
                            <td className="p1-mono">{officer.basicPay || "—"}</td>
                            <td>{officer.gazettedStatus || "—"}</td>
                            <td>{officer.employmentType || "—"}</td>
                            <td>{officer.workMandal || "—"}</td>
                            <td>{officer.nativeMandal || "—"}</td>
                            <td className="p1-mono">{officer.mobileNo || "—"}</td>
                            <td>
                              <span className="p1-badge p1-badge-approved">Standby Reserve</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {surplusOfficers.length > 0 && (
                  <div className="p1-pagination">
                    <span className="p1-page-info">
                      Showing {surplusStart} to {surplusEnd} of {surplusOfficers.length} reserve officer records
                    </span>
                    <div className="p1-pages">
                      <button
                        type="button"
                        className="p1-page-btn p1-page-nav"
                        onClick={() => setSurplusPage(safeSurplusPage - 1)}
                        disabled={safeSurplusPage <= 1}
                        aria-label="Previous page"
                      >
                        <ChevronLeft />
                      </button>
                      {surplusPages.map((p, idx) =>
                        p === "…" ? (
                          <span key={`dots-surplus-${idx}`} className="p1-page-dots">…</span>
                        ) : (
                          <button
                            key={`page-surplus-${p}`}
                            type="button"
                            className={`p1-page-btn${p === safeSurplusPage ? " is-active" : ""}`}
                            onClick={() => setSurplusPage(p)}
                          >
                            {p}
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        className="p1-page-btn p1-page-nav"
                        onClick={() => setSurplusPage(safeSurplusPage + 1)}
                        disabled={safeSurplusPage >= surplusPageCount}
                        aria-label="Next page"
                      >
                        <ChevronRight />
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}

          </>
        )}

        <WorkflowNavigation
          context={context}
          step="phase2"
          canContinue={canContinue}
          disabledReason={!hasData
            ? "Complete Phase 1 and load approved employees first."
            : !partitioned
              ? "Form the polling teams before continuing."
              : "Resolve incomplete teams before continuing."}
        />
      </div>
    </main>
  );
}
