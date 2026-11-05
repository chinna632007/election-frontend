import { useEffect, useMemo, useRef, useState } from "react";
import "./landing.css";
import "./Phase1.css";
import Header from "../components/Header.jsx";
import WorkflowNavigation from "../components/WorkflowNavigation.jsx";
import {
  uploadPersonnel,
  getBatchPersonnel,
  getBatchRejected,
  getWorkflowData,
  saveWorkflowData,
} from "../api/client.js";

/**
 * Phase 1 – Employee Validation
 * -----------------------------
 * The user uploads an Employee Excel proforma. The workbook is sent to the
 * backend (POST /api/imports/personnel) which validates every row and returns
 * an import-batch summary plus the rejected rows. Accepted personnel are then
 * fetched with GET /api/imports/batches/:id/personnel. This page renders both.
 *
 * Backend response (POST /api/imports/personnel):
 *   { ok, batch: { id, totalRows, acceptedRows, rejectedRows },
 *     rejected: [ { sheetRow, employeeId, reasons: [codes] } ] }
 * Personnel response (GET /api/imports/batches/:id/personnel):
 *   { ok, batch: {...}, count, personnel: [ <full personnel rows> ] }
 *
 * `normalizeRow` maps each backend record onto the table below (tolerant of
 * snake_case personnel fields). USE_MOCK = true previews the UI with fabricated
 * demo data (no backend required).
 */

const USE_MOCK = false;
const ACCEPTED = [".xlsx", ".xls", ".csv"];
const PAGE_SIZE = 10;
const UPLOAD_REQUEST_STORAGE_KEY = "phase1-upload-request";

function createUploadRequestId() {
  return globalThis.crypto?.randomUUID?.()
    || `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function fileIdentity(file) {
  const metadata = `${file.name}\0${file.size}\0${file.lastModified}`;
  if (!globalThis.crypto?.subtle || typeof file.arrayBuffer !== "function") return metadata;

  const bytes = await file.arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${metadata}\0${hash}`;
}

async function uploadRequestFor(file, requestRef) {
  const identity = await fileIdentity(file);
  if (requestRef.current?.identity === identity) return requestRef.current;

  try {
    const saved = JSON.parse(sessionStorage.getItem(UPLOAD_REQUEST_STORAGE_KEY) || "null");
    if (saved?.identity === identity && typeof saved.id === "string") {
      requestRef.current = saved;
      return saved;
    }
  } catch {
    // Continue with an in-memory request key when storage is unavailable.
  }

  const next = { identity, id: createUploadRequestId() };
  requestRef.current = next;
  try {
    sessionStorage.setItem(UPLOAD_REQUEST_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // The in-memory key still protects ordinary retries in this page session.
  }
  return next;
}

function clearUploadRequest(requestRef) {
  requestRef.current = null;
  try {
    sessionStorage.removeItem(UPLOAD_REQUEST_STORAGE_KEY);
  } catch {
    // Storage is optional; the upload result is already resolved.
  }
}
/**
 * Table column definitions – rendered in the EXACT order of the Employee
 * proforma workbook (sheet "DATA", header row). Each entry maps a column to
 * the normalized row key produced by `normalizeRow`. `cell` optionally picks
 * a CSS class for the <td>. The final "Status" column is an app-added
 * validation badge and is intentionally kept at the end.
 */
const COLUMNS = [
  { key: "sno", label: "Sl. No." },
  { key: "employeeId", label: "Employee ID No.", cell: "p1-mono" },
  { key: "employeeName", label: "Employee Name", cell: "p1-strong" },
  { key: "designation", label: "Designation" },
  { key: "gender", label: "Gender (M/F)" },
  { key: "age", label: "Age" },
  { key: "aadharNumber", label: "Aadhar Number", cell: "p1-mono" },
  { key: "languagesKnown", label: "Languages Known" },
  { key: "employmentSector", label: "Central / State / PSU / Private / Others" },
  { key: "scaleOfPay", label: "Scale of Pay" },
  { key: "basicPay", label: "Basic Pay" },
  { key: "gazettedStatus", label: "Gazetted / Non-Gazetted" },
  { key: "dateOfBirth", label: "Date of Birth (dd.mm.yyyy)", cell: "p1-mono" },
  { key: "dateOfRetirement", label: "Date of Retirement (dd.mm.yyyy)", cell: "p1-mono" },
  { key: "employmentType", label: "Type of Employment" },
  { key: "assemblyConstituency", label: "Assembly Constituency Enrolled" },
  { key: "partNo", label: "Part No. / Vote Sl. No.", cell: "p1-mono" },
  { key: "voterId", label: "Voter ID (EPIC Number)", cell: "p1-mono" },
  { key: "residenceAddress", label: "Residence Address" },
  { key: "residenceConstituencyCode", label: "Residence Constituency Code", cell: "p1-mono" },
  { key: "residenceConstituencyName", label: "Residency Constituency Name" },
  { key: "workMandal", label: "Work Mandal" },
  { key: "workingConstituencyCode", label: "Working Constituency Code", cell: "p1-mono" },
  { key: "workingConstituencyName", label: "Working Constituency Name" },
  { key: "nativeMandal", label: "Native Mandal" },
  { key: "nativeConstituencyCode", label: "Native Constituency Code", cell: "p1-mono" },
  { key: "nativeConstituencyName", label: "Native Constituency Name" },
  { key: "previousPollDuty", label: "Previous Worked as PO / APO / OPO" },
  { key: "mobileNo", label: "Mobile No.", cell: "p1-mono" },
  { key: "serviceInDistrict", label: "Total Service in District (Last 4 Years)" },
  { key: "phCategory", label: "PH Category (PH-%)" },
  { key: "criminalCaseEci", label: "Criminal Case / ECI Restriction" },
  { key: "exceeded3Years", label: "Exceeded 3 Years (Yes/No)" },
  { key: "eciCeoOrderDetails", label: "ECI / CEO Order Details" },
  { key: "remarks", label: "Remarks", cell: "p1-remarks" },
  { key: "status", label: "Status", badge: true },
];

/**
 * Columns for the clearly labeled "Rejected Officers" section.
 * Shows ALL identifying fields along with sequential S.No, Reason for Rejection,
 * and complete personnel attributes from the uploaded spreadsheet.
 */
const REJECTED_COLUMNS = [
  { key: "sno", label: "Sl. No.", cell: "p1-mono" },
  { key: "employeeId", label: "Employee ID No.", cell: "p1-mono" },
  { key: "employeeName", label: "Employee Name", cell: "p1-strong" },
  { key: "designation", label: "Designation" },
  { key: "remarks", label: "Reason for Rejection", cell: "p1-remarks" },
  { key: "gender", label: "Gender (M/F)" },
  { key: "age", label: "Age" },
  { key: "aadharNumber", label: "Aadhar Number", cell: "p1-mono" },
  { key: "languagesKnown", label: "Languages Known" },
  { key: "employmentSector", label: "Central / State / PSU / Private / Others" },
  { key: "scaleOfPay", label: "Scale of Pay" },
  { key: "basicPay", label: "Basic Pay" },
  { key: "gazettedStatus", label: "Gazetted / Non-Gazetted" },
  { key: "dateOfBirth", label: "Date of Birth (dd.mm.yyyy)", cell: "p1-mono" },
  { key: "dateOfRetirement", label: "Date of Retirement (dd.mm.yyyy)", cell: "p1-mono" },
  { key: "employmentType", label: "Type of Employment" },
  { key: "assemblyConstituency", label: "Assembly Constituency Enrolled" },
  { key: "partNo", label: "Part No. / Vote Sl. No.", cell: "p1-mono" },
  { key: "voterId", label: "Voter ID (EPIC Number)", cell: "p1-mono" },
  { key: "residenceAddress", label: "Residence Address" },
  { key: "residenceConstituencyCode", label: "Residence Constituency Code", cell: "p1-mono" },
  { key: "residenceConstituencyName", label: "Residency Constituency Name" },
  { key: "workMandal", label: "Work Mandal" },
  { key: "workingConstituencyCode", label: "Working Constituency Code", cell: "p1-mono" },
  { key: "workingConstituencyName", label: "Working Constituency Name" },
  { key: "nativeMandal", label: "Native Mandal" },
  { key: "nativeConstituencyCode", label: "Native Constituency Code", cell: "p1-mono" },
  { key: "nativeConstituencyName", label: "Native Constituency Name" },
  { key: "previousPollDuty", label: "Previous Worked as PO / APO / OPO" },
  { key: "mobileNo", label: "Mobile No.", cell: "p1-mono" },
  { key: "serviceInDistrict", label: "Total Service in District (Last 4 Years)" },
  { key: "phCategory", label: "PH Category (PH-%)" },
  { key: "criminalCaseEci", label: "Criminal Case / ECI Restriction" },
  { key: "exceeded3Years", label: "Exceeded 3 Years (Yes/No)" },
  { key: "eciCeoOrderDetails", label: "ECI / CEO Order Details" },
  { key: "status", label: "Status", badge: true },
];

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

function CloudUpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 16l-4-4-4 4" />
      <path d="M12 12v9" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
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

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
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

function Spinner() {
  return <span className="p1-spinner" aria-hidden="true" />;
}

/* ------------------------------ helpers ------------------------------- */

function pick(obj, ...keys) {
  if (!obj || typeof obj !== "object") return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && String(v).trim() !== "" && String(v).trim() !== "—") return v;
  }
  // Case-insensitive & punctuation-stripped fallback
  const entries = Object.entries(obj);
  for (const k of keys) {
    const targetNorm = String(k).toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const [realKey, val] of entries) {
      if (val !== undefined && val !== null && String(val).trim() !== "" && String(val).trim() !== "—") {
        const normReal = realKey.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (normReal === targetNorm) return val;
      }
    }
  }
  return undefined;
}

function pickByRegex(obj, regex) {
  if (!obj || typeof obj !== "object") return undefined;
  for (const [key, value] of Object.entries(obj)) {
    if (regex.test(key) && value !== undefined && value !== null && String(value).trim() !== "" && String(value).trim() !== "—") {
      return value;
    }
  }
  return undefined;
}

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Render a DATE value as dd.mm.yyyy. The pg driver serializes DATE columns
 * as full ISO strings ("YYYY-MM-DD" or "YYYY-MM-DDT...Z"); values already in
 * dd.mm.yyyy (or anything unrecognized) pass through untouched.
 */
function formatDate(v) {
  if (v === null || v === undefined || v === "") return "—";
  const m = String(v).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(v).trim() === "" ? "—" : v;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

function statusKey(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("reject")) return "rejected";
  if (s.includes("approve") || s.includes("eligib") || s.includes("valid")) return "approved";
  return "review";
}

function formatValidationReasons(reasons) {
  const values = Array.isArray(reasons) ? reasons : [reasons];
  return values
    .filter((reason) => reason !== null && reason !== undefined && String(reason).trim())
    .map((reason) => {
      const code = String(reason).trim();
      if (code === "ph_category_not_eligible" || code === "ph_category_is_yes") {
        return "PH Category: Officer is Physically Handicapped (Ineligible for polling duty)";
      }
      if (code === "invalid_elector_id") {
        return "Invalid Elector ID / Voter ID (EPIC number format invalid, placeholder, or unrecognized)";
      }
      if (code === "medical_designation_not_eligible") {
        return "Medical / clinical designation not eligible for polling duty";
      }
      if (code === "below_minimum_age") {
        return "Below minimum age requirement (under 18)";
      }
      if (code === "age_dob_age_mismatch") {
        return "Discrepancy between recorded Date of Birth and Age column";
      }
      if (code === "duplicate_employee_id_in_file") {
        return "Duplicate Employee ID within file";
      }
      if (code === "employee_name_required") {
        return "Employee name is required";
      }
      if (code === "employee_id_required") {
        return "Employee ID is required";
      }
      if (code === "date_of_birth_unparseable") {
        return "Invalid date format for Date of Birth (expected DD.MM.YYYY)";
      }
      if (code === "date_of_retirement_unparseable") {
        return "Invalid date format for Date of Retirement (expected DD.MM.YYYY)";
      }
      return code.replace(/_/g, " ");
    })
    .join("; ") || "No reason provided";
}

/** Map one backend row (any casing) onto the table shape. */
function normalizeRow(raw, index) {
  const statusRaw = pick(raw, "status", "Status", "result", "validationStatus");
  const status = statusRaw ? String(statusRaw) : "Needs Review";
  return {
    sno: num(pick(raw, "sno", "sNo", "sl_no", "serialNo", "slNo", "S.No", "Sl. No."), index + 1),
    employeeId: pick(raw, "employeeId", "employeeID", "empId", "EmployeeID", "EmployeeId", "employee_id", "Employee ID No.", "Employee ID", "Employee ID No", "Emp ID", "Emp Id", "EMP ID", "emp_id", "empid", "Employee Code", "employeeCode", "employee_code", "id", "Id", "ID") || pickByRegex(raw, /emp.*id|employee.*code|emp.*code/i) || "—",
    employeeName: pick(raw, "employeeName", "name", "Name", "employee_name", "Employee Name", "emp_name") || pickByRegex(raw, /emp.*name|officer.*name|^name$/i) || "—",
    designation: pick(raw, "designation", "Designation", "post", "Post") || pickByRegex(raw, /designation|post/i) || "—",
    gender: pick(raw, "gender", "Gender", "sex", "Gender (M/F)", "gender (m/f)") || pickByRegex(raw, /^gender|^sex/i) || "—",
    age: pick(raw, "age", "Age") || pickByRegex(raw, /^age$/i) || "—",
    aadharNumber: pick(raw, "aadharNumber", "aadhar_number", "aadhar", "Aadhar Number", "aadhaar_number", "aadhaar", "Aadhaar Number") || pickByRegex(raw, /aadha?ar/i) || "—",
    languagesKnown: pick(raw, "languagesKnown", "languages_known", "languages", "Languages Known") || pickByRegex(raw, /language/i) || "—",
    employmentSector: pick(raw, "employmentSector", "employment_sector", "sector", "organizationType", "Central/ State/ PSU / Private/ Others", "central/ state/ psu / private/ others") || pickByRegex(raw, /sector/i) || "—",
    scaleOfPay: pick(raw, "scaleOfPay", "scale_of_pay", "scale", "Scale of Pay", "scale_pay") || pickByRegex(raw, /scale/i) || "—",
    basicPay: pick(raw, "basicPay", "basic_pay", "pay", "Basic Pay", "basic") || pickByRegex(raw, /basic.*pay|^pay$/i) || "—",
    gazettedStatus: pick(raw, "gazettedStatus", "gazetted_status", "gazetted", "Gazetted/ Non-Gazetted", "gazetted/ non-gazetted") || pickByRegex(raw, /gazetted/i) || "—",
    dateOfBirth: formatDate(pick(raw, "dateOfBirth", "date_of_birth", "dob", "DOB", "Date of Birth (dd.mm.yyyy)", "date of birth") || pickByRegex(raw, /birth|dob/i)),
    dateOfRetirement: formatDate(pick(raw, "dateOfRetirement", "date_of_retirement", "dor", "DOR", "Date of Retirement (dd.mm.yyyy)", "date of retirement") || pickByRegex(raw, /retire|dor/i)),
    employmentType: pick(raw, "employmentType", "employment_type", "EmploymentType", "type_of_employment", "Type of Employment (Regular/ Out-sourcing / Contract basis)", "Type Of Employment (Regular/ Out-sourcing / Contract basis)") || pickByRegex(raw, /employment.*type|type.*employment/i) || "—",
    assemblyConstituency: pick(raw, "assemblyConstituency", "assembly_constituency", "enrolledAssemblyConstituency", "enrolled_assembly_constituency", "Assembly Constituency Where He/she Enrolled the Name", "assembly constituency where he/she enrolled the name") || pickByRegex(raw, /enrolled.*assembly|assembly.*enrolled/i) || "—",
    partNo: pick(raw, "partNo", "partNoVoteSlNo", "part_no", "part_no_vote_sl_no", "partSlNo", "voteSlNo", "Part No. /Vote Sl. No.", "part no. /vote sl. no.") || pickByRegex(raw, /part.*no|vote.*sl/i) || "—",
    voterId: pick(raw, "voterId", "voter_id", "voterID", "epicNumber", "epic", "epic_no", "epicNo", "electorId", "elector_id", "elector_number", "electorPhotoIdentityCard", "Voter ID (EPIC Number)", "voter id (epic number)", "Voter ID", "voter id", "voter id no", "voter id no.", "epic_number") || pickByRegex(raw, /voter|epic|elector/i) || "—",
    residenceAddress: pick(raw, "residenceAddress", "residence_address", "address", "Residence Address", "residence address") || pickByRegex(raw, /residence.*address|address/i) || "—",
    residenceConstituencyCode: pick(raw, "residenceConstituencyCode", "residence_constituency_code", "Residence Constituency Code", "residence constituency code") || "—",
    residenceConstituencyName: pick(raw, "residenceConstituencyName", "residence_constituency_name", "residencyConstituencyName", "Residency Constituency Name", "residency constituency name") || "—",
    workMandal: pick(raw, "workMandal", "work_mandal", "WorkMandal", "mandal", "working_mandal", "Working Mandal", "work mandal") || pickByRegex(raw, /work.*mandal|working.*mandal/i) || "—",
    workingConstituencyCode: pick(raw, "workingConstituencyCode", "working_constituency_code", "Working Constituency Code", "working constituency code") || "—",
    workingConstituencyName: pick(raw, "workingConstituencyName", "working_constituency_name", "Working Constituency Name", "working constituency name") || "—",
    nativeMandal: pick(raw, "nativeMandal", "native_mandal", "Native Mandal", "native mandal") || pickByRegex(raw, /native.*mandal/i) || "—",
    nativeConstituencyCode: pick(raw, "nativeConstituencyCode", "native_constituency_code", "Native Constituency Code", "native constituency code") || "—",
    nativeConstituencyName: pick(raw, "nativeConstituencyName", "native_constituency_name", "Native Constituency Name", "native constituency name") || "—",
    previousPollDuty: pick(raw, "previousPollDuty", "previousPoDuty", "previous_poll_duty", "previous_po_duty", "previousWorked", "Previous Worked as PO/ APO/ OPO", "previous worked as po/ apo/ opo") || "—",
    mobileNo: pick(raw, "mobileNo", "mobile_no", "mobile", "phone", "Mobile No.", "mobile no.", "mobile no") || pickByRegex(raw, /mobile|phone/i) || "—",
    serviceInDistrict: pick(raw, "serviceInDistrict", "serviceInDistrict4y", "service_in_district", "service_in_district_4y", "ServiceInDistrict", "service", "Total Service in Present District from Last 4 Years ( In all Cadres)", "total service in present district from last 4 years ( in all cadres)") || "—",
    phCategory: pick(raw, "phCategory", "ph_category", "PHCategory", "ph", "Whether He/she belongs  PH category (PH-%)", "whether he/she belongs ph category (ph-%)") || "—",
    criminalCaseEci: pick(raw, "criminalCaseEciRestriction", "criminalCaseEci", "criminalCaseOrEciOrders", "criminalCase", "CriminalCaseECIRestriction", "criminal_case_or_eci_orders", "eciRestriction", "eci_restriction", "criminalCasesPending") || "—",
    exceeded3Years: pick(raw, "exceeded3Years", "exceeded_3_years", "exceededThreeYears", "Whether exceeded 3 Years (Yes/No)", "whether exceeded 3 years (yes/no)") || "—",
    eciCeoOrderDetails: pick(raw, "eciCeoOrderDetails", "eci_ceo_order_details", "eciOrderDetails", "eciOrderNo", "If there are any order from ECI/ CEO against the Person that not to Participate in Election? (Yes/No) If So, Details of Order No.") || "—",
    status,
    remarks: pick(raw, "remarks", "Remarks", "remark", "note") || "—",
  };
}

/** Backend summary (or computed from rows). */
function normalizeSummary(data, rows) {
  const s = (data && (data.summary || data.stats)) || {};
  const count = (k) => rows.filter((r) => statusKey(r.status) === k).length;
  return {
    total: num(pick(s, "total", "totalRecords", "count", "records"), rows.length),
    approved: num(pick(s, "approved", "eligible", "valid", "pass"), count("approved")),
    rejected: num(pick(s, "rejected", "invalid", "fail"), count("rejected")),
    needsReview: num(pick(s, "needsReview", "needs_review", "review", "pending"), count("review")),
  };
}

/* ------------------------------- mock --------------------------------- */

const NAMES = [
  "Ramesh Kumar", "S. Lakshmi", "Ravi Teja", "P. Anitha", "Suresh Babu", "K. Swathi",
  "Venkatesh M", "L. Prasad", "Deepika Rani", "G. Nagesh", "Mohan Rao", "Jyothi K",
  "Sai Krishna", "Padma V", "Naga Raju", "Srinu B", "Bhavani P", "Kiran Kumar",
  "Vani L", "Ravi Kumar", "Nageswara Rao", "Sujatha", "Anil Chowdary", "Ramya S",
  "Krishna M", "Manjula", "Teja S", "Saritha", "Praveen R", "Lalitha",
  "Hari Prasad", "Swapna", "Mahesh B", "Rajesh K", "Sunitha", "Gopi N",
  "Vijaya Lakshmi", "Arun Kumar", "Devi Prasad", "Kavitha",
];
const DESIGNATIONS = [
  "Assistant Engineer", "Junior Assistant", "Senior Assistant", "Office Superintendent",
  "Data Entry Operator", "Clerk", "Driver", "Typist", "Record Assistant",
];
const MANDALS = ["Hyderabad", "Kakinada", "Rajanagaram", "Peddapuram", "Amalapuram", "Samalkot", "Pithapuram", "Tuni"];
const SERVICE = ["12 yrs", "4 yrs", "2 yrs", "5 yrs", "1 yr", "3 yrs", "8 yrs", "15 yrs", "6 yrs"];
const PH = ["No", "No", "No", "No", "No", "No", "5 yrs PH-40%", "3 yrs PH-40%"];
const SECTORS = ["State", "State", "State", "PSU", "Central", "Private"];
const LANGUAGES = ["Telugu, English", "Telugu", "Telugu, Hindi", "Telugu, English, Urdu", "English, Hindi"];
const SCALES = ["5200-20200", "2650-4160", "2920-4900", "9310-22460", "6100-12810"];
const GAZETTED = ["Non-Gazetted", "Non-Gazetted", "Non-Gazetted", "Gazetted"];
const PREV_DUTY = ["No", "Yes (PO)", "Yes (APO)", "No", "Yes (OPO)"];

function buildMock() {
  const statuses = [];
  for (let i = 0; i < 96; i++) statuses.push("Approved");
  for (let i = 0; i < 24; i++) statuses.push("Rejected");
  for (let i = 0; i < 8; i++) statuses.push("Needs Review");

  // deterministic shuffle so every page has a realistic mix
  let seed = 20241013;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = statuses.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [statuses[i], statuses[j]] = [statuses[j], statuses[i]];
  }

  const rows = statuses.map((status, i) => ({
    sno: i + 1,
    employeeId: "EMP" + String(i + 1).padStart(3, "0"),
    employeeName: NAMES[i % NAMES.length],
    designation: DESIGNATIONS[i % DESIGNATIONS.length],
    gender: i % 2 === 0 ? "M" : "F",
    age: 24 + ((i * 13) % 34),
    aadharNumber: "XXXX-XXXX-" + String(1000 + ((i * 137) % 8999)),
    languagesKnown: LANGUAGES[i % LANGUAGES.length],
    employmentSector: SECTORS[i % SECTORS.length],
    scaleOfPay: SCALES[i % SCALES.length],
    basicPay: "₹" + (18000 + ((i * 2357) % 42000)).toLocaleString("en-IN"),
    gazettedStatus: GAZETTED[i % GAZETTED.length],
    dateOfBirth: "0" + (1 + (i % 9)) + ".0" + (1 + (i % 8)) + "." + (1960 + (i % 30)),
    dateOfRetirement: "31.03." + (2026 + (1 + (i % 20))),
    employmentType: i % 5 === 0 ? "Contract" : "Regular",
    assemblyConstituency: "AC-" + String(1 + (i % 45)).padStart(2, "0") + " – " + MANDALS[i % MANDALS.length],
    partNo: String(10 + (i % 200)) + " / " + String(1 + (i % 900)),
    voterId: "ABC" + String(1000000 + (i * 137)) + "X",
    residenceAddress: (1 + (i % 120)) + "-" + (i % 90) + ", " + MANDALS[i % MANDALS.length],
    residenceConstituencyCode: "AC-" + String(1 + (i % 45)).padStart(2, "0"),
    residenceConstituencyName: MANDALS[(i + 1) % MANDALS.length],
    workMandal: MANDALS[i % MANDALS.length],
    workingConstituencyCode: "AC-" + String(1 + (i % 45)).padStart(2, "0"),
    workingConstituencyName: MANDALS[i % MANDALS.length],
    nativeMandal: MANDALS[(i + 2) % MANDALS.length],
    nativeConstituencyCode: "AC-" + String(1 + ((i + 2) % 45)).padStart(2, "0"),
    nativeConstituencyName: MANDALS[(i + 2) % MANDALS.length],
    previousPollDuty: PREV_DUTY[i % PREV_DUTY.length],
    mobileNo: "9" + String(100000000 + i * 137).slice(0, 9),
    serviceInDistrict: SERVICE[i % SERVICE.length],
    phCategory: PH[i % PH.length],
    criminalCaseEci:
      status === "Rejected"
        ? i % 2 === 0
          ? "Pending case"
          : "ECI restriction"
        : status === "Needs Review"
          ? "Under verification"
          : "None",
    exceeded3Years: i % 3 === 0 ? "Yes" : "No",
    eciCeoOrderDetails: status === "Rejected" && i % 2 === 1 ? "ECI Order No. ECI/2024/" + (100 + i) : "—",
    status: PH[i % PH.length] !== "No" ? "Rejected" : status,
    remarks: PH[i % PH.length] !== "No"
      ? "PH Category: Officer is Physically Handicapped (Ineligible for polling duty)"
      : status === "Rejected"
        ? "Exempted / Ineligible by election validation rules"
        : "—",
  }));

  return {
    summary: {
      total: rows.length,
      approved: rows.filter((r) => statusKey(r.status) === "approved").length,
      rejected: rows.filter((r) => statusKey(r.status) === "rejected").length,
      needsReview: rows.filter((r) => statusKey(r.status) === "review").length,
    },
    rows,
  };
}

function mockUpload() {
  return new Promise((resolve) => setTimeout(() => resolve(buildMock()), 900));
}

/* ---------------------------- pagination ------------------------------ */

function pageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, 2, 3, 4, 5, total]);
  for (let i = current - 1; i <= current + 1; i++) {
    if (i > 0 && i <= total) set.add(i);
  }
  const sorted = [...set].sort((a, b) => a - b);
  const out = [];
  let prev;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

/* ---------------------------- sub-components -------------------------- */

function StatusBadge({ status }) {
  const key = statusKey(status);
  const Icon = key === "approved" ? CheckIcon : key === "rejected" ? CrossIcon : WarnIcon;
  return (
    <span className={`p1-badge p1-badge-${key}`}>
      <Icon />
      {status}
    </span>
  );
}

/* ------------------------------- page --------------------------------- */

export default function Phase1({ context = "municipal" }) {
  const isMunicipal = context === "municipal";
  const contextLabel = isMunicipal ? "Municipal Elections" : "Gram Panchayat Elections";
  const backHref = isMunicipal ? "/elections/municipal" : "/elections/panchayat";

  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | uploading | done | error
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState(null); // { summary, rows }

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | approved | rejected
  const [empFilter, setEmpFilter] = useState("all"); // all | Regular | Contract
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [rejectedPage, setRejectedPage] = useState(1);

  const inputRef = useRef(null);
  const uploadRequestRef = useRef(null);

  // Load the context's batch marker, then render the personnel records from MongoDB.
  useEffect(() => {
    if (USE_MOCK) return;
    let cancelled = false;
    (async () => {
      try {
        const saved = await getWorkflowData(context, "phase1");
        const batchId = saved?.value?.batchId;
        const batchSummary = saved?.value?.summary;
        if (!batchId) {
          setResult({ summary: { total: 0, approved: 0, rejected: 0, needsReview: 0 }, rows: [], batchId: null });
          setStatus("idle");
          return;
        }

        const [detail, rejData] = await Promise.all([
          getBatchPersonnel(batchId),
          getBatchRejected(batchId),
        ]);
        if (cancelled) return;

        const personnel = Array.isArray(detail?.personnel) ? detail.personnel : [];
        const rejected = Array.isArray(rejData?.rejected) ? rejData.rejected : [];
        const batch = detail?.batch || {};

        const acceptedRows = personnel.map((p) =>
          normalizeRow({ ...p, status: "Approved" })
        );
        const rejectedRows = rejected.map((r, i) => {
          const vals = r.rawValues || r.raw_values || r.values || {};
          return normalizeRow(
            {
              ...vals,
              sno: r.sheetRow || i + 1,
              employeeId: r.employeeId || pick(vals, "employee_id", "employeeId", "Employee ID No.", "Employee ID", "emp_id", "empid") || "—",
              employeeName: pick(vals, "employee_name", "employeeName", "name", "Name") || r.employeeId || "—",
              status: "Rejected",
              remarks: formatValidationReasons(r.reasons),
            },
            i
          );
        });
        const rows = [...acceptedRows, ...rejectedRows];

        // If batch in MongoDB has 0 rows, reflect empty state
        if (rows.length === 0 && !batch.id) {
          clearWorkflowData(context, "phase1").catch(() => {});
          setResult({ summary: { total: 0, approved: 0, rejected: 0, needsReview: 0 }, rows: [], batchId: null });
          setStatus("idle");
          return;
        }

        const summary = batchSummary || {
          total: batch.total_rows ?? batch.totalRows ?? rows.length,
          approved: batch.accepted_rows ?? batch.acceptedRows ?? acceptedRows.length,
          rejected: batch.rejected_rows ?? batch.rejectedRows ?? rejectedRows.length,
          needsReview: 0,
        };
        setResult({ summary, rows, batchId });
        setStatus("done");
      } catch (error) {
        if (!cancelled) {
          // If the batch was deleted directly in MongoDB Compass, reset to clean empty state
          if (error && (error.status === 404 || String(error.message || "").toLowerCase().includes("not found"))) {
            clearWorkflowData(context, "phase1").catch(() => {});
            setResult({ summary: { total: 0, approved: 0, rejected: 0, needsReview: 0 }, rows: [], batchId: null });
            setStatus("idle");
            return;
          }
          setStatus("error");
          setErrorMsg(error?.message || "Failed to load saved Phase 1 data from MongoDB.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [context]);

  function validateAndSet(next) {
    if (!next) return;
    const lower = next.name.toLowerCase();
    const ok = ACCEPTED.some((ext) => lower.endsWith(ext));
    if (!ok) {
      setFile(null);
      clearUploadRequest(uploadRequestRef);
      setStatus("error");
      setErrorMsg("Unsupported file type. Please upload an .xlsx, .xls or .csv file.");
      return;
    }
    setFile(next);
    setStatus("idle");
    setErrorMsg("");
    setResult(null);
  }

  function onDrop(e) {
    e.preventDefault();
    setDragActive(false);
    validateAndSet(e.dataTransfer.files?.[0]);
  }

  function onPick(e) {
    validateAndSet(e.target.files?.[0]);
  }

  async function upload() {
    if (!file) {
      setStatus("error");
      setErrorMsg("Please choose an Employee Excel file first.");
      return;
    }
    setStatus("uploading");
    setErrorMsg("");
    try {
      let rows;
      let summary;
      let batchId;

      if (USE_MOCK) {
        // Standalone UI preview: fabricate a batch without the backend.
        const data = await mockUpload();
        rows = (Array.isArray(data.rows) ? data.rows : []).map(normalizeRow);
        summary = normalizeSummary(data, rows);
      } else {
        // Real backend: 1) upload the workbook (validate + store accepted AND
        // rejected rows in one transaction), 2) read the STORED rows back from
        // the DB. Option B (fail-closed): if the DB read fails OR returns
        // nothing while the batch claims rows, throw and show the error —
        // never render local-file rows as "Approved" (old fake-green bug).
        const uploadRequest = await uploadRequestFor(file, uploadRequestRef);
        const upload = await uploadPersonnel(file, undefined, uploadRequest.id);
        // Backend returns the id as batch.id (also tolerate batch.batchId).
        batchId = upload?.batch?.id ?? upload?.batch?.batchId;
        const rejected = Array.isArray(upload?.rejected) ? upload.rejected : [];
        if (!batchId) {
          throw new Error('Upload succeeded but returned no batch id — data was NOT saved. Please re-upload.');
        }

        const detail = await getBatchPersonnel(batchId);
        const personnel = Array.isArray(detail?.personnel) ? detail.personnel : [];
        const expectedAccepted = upload?.batch?.acceptedRows ?? personnel.length;
        if (expectedAccepted > 0 && personnel.length === 0) {
          throw new Error(
            `Batch ${batchId} reports ${expectedAccepted} accepted row(s) but the stored data could not be read — showing nothing instead of fake data. Please re-upload.`
          );
        }

        // Accepted rows -> "Approved"; rejected rows -> "Rejected" (with reasons).
        // NOTE: the backend denied-list endpoint returns employeeId + reasons +
        // raw_values; it does NOT return employeeName, so read the name from the
        // original row (raw_values uses snake_case keys) rather than r.employeeName,
        // which is always undefined.
        const acceptedRows = personnel.map((p) =>
          normalizeRow({ ...p, status: "Approved" })
        );
        const rejectedRows = rejected.map((r, i) => {
          const vals = r.rawValues || r.raw_values || r.values || {};
          return normalizeRow(
            {
              ...vals,
              sno: r.sheetRow || i + 1,
              employeeId: r.employeeId || pick(vals, "employee_id", "employeeId", "Employee ID No.", "Employee ID", "emp_id", "empid") || "—",
              employeeName: pick(vals, "employee_name", "employeeName", "name", "Name") || r.employeeId || "—",
              status: "Rejected",
              remarks: formatValidationReasons(r.reasons),
            },
            i
          );
        });

        rows = [...acceptedRows, ...rejectedRows];
        summary = {
          total: upload?.batch?.totalRows ?? rows.length,
          approved: upload?.batch?.acceptedRows ?? acceptedRows.length,
          rejected: upload?.batch?.rejectedRows ?? rejectedRows.length,
          needsReview: 0,
        };
        await saveWorkflowData(context, "phase1", { batchId, summary, rows });
      }

      setResult({ summary, rows, batchId });
      setQuery("");
      setStatusFilter("all");
      setEmpFilter("all");
      setPage(1);
      setStatus("done");
      clearUploadRequest(uploadRequestRef);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Something went wrong during upload.");
    }
  }

  function reset() {
    setFile(null);
    clearUploadRequest(uploadRequestRef);
    setResult(null);
    setStatus("idle");
    setErrorMsg("");
    setQuery("");
    setStatusFilter("all");
    setEmpFilter("all");
    setFiltersOpen(false);
    setPage(1);
    setRejectedPage(1);
    if (inputRef.current) inputRef.current.value = "";
  }

  const rows = useMemo(() => result?.rows ?? [], [result]);
  const invalidRows = useMemo(
    () => rows.filter((row) => statusKey(row.status) === "rejected"),
    [rows]
  );
  const summary = result?.summary ?? { total: 0, approved: 0, rejected: 0, needsReview: 0 };

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter !== "all") {
      list = list.filter((r) => statusKey(r.status) === statusFilter);
    }
    if (empFilter !== "all") {
      list = list.filter(
        (r) => String(r.employmentType).toLowerCase() === empFilter.toLowerCase()
      );
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.employeeName, r.employeeId, r.designation].join(" ").toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, statusFilter, empFilter, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const end = Math.min(safePage * PAGE_SIZE, filtered.length);
  const pages = pageList(safePage, pageCount);

  // Rejected / Invalid officers - with dedicated 10 rows per page pagination
  const filteredRejected = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return invalidRows;
    return invalidRows.filter((r) =>
      [r.employeeName, r.employeeId, r.designation, r.workMandal, r.phCategory, r.remarks]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [invalidRows, query]);

  const rejectedPageCount = Math.max(1, Math.ceil(filteredRejected.length / PAGE_SIZE));
  const safeRejectedPage = Math.min(rejectedPage, rejectedPageCount);
  const rejectedPageRows = filteredRejected.slice(
    (safeRejectedPage - 1) * PAGE_SIZE,
    safeRejectedPage * PAGE_SIZE
  );
  const rejectedStart = filteredRejected.length === 0 ? 0 : (safeRejectedPage - 1) * PAGE_SIZE + 1;
  const rejectedEnd = Math.min(safeRejectedPage * PAGE_SIZE, filteredRejected.length);
  const rejectedPages = pageList(safeRejectedPage, rejectedPageCount);

  return (
    <main className="p1-page">
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
          <span>Phase 1</span>
          <span className="p1-crumb-sep">/</span>
          <span className="p1-crumb-current">Employee Validation</span>
        </nav>

        {/* title + info box */}
        <section className="p1-title-row">
          <div className="p1-title">
            <span className="p1-title-icon">
              <PeopleIcon />
            </span>
            <div>
              <h1>Phase 1 – Employee Validation</h1>
              <p>Upload the Employee Excel file and validate the records against election eligibility rules.</p>
            </div>
          </div>
          <aside className="p1-infobox">
            <span className="p1-infobox-icon">
              <InfoIcon />
            </span>
            <p>
              Ensure that the uploaded file contains all mandatory fields. The system will validate
              the data and mark each record as Approved or Rejected based on the eligibility rules.
            </p>
          </aside>
        </section>

        {/* upload + validate */}
        <section className="p1-upload-grid">
          <div className="p1-upload-card">
            <h2 className="p1-card-title">
              <span className="p1-card-title-icon">
                <CloudUpIcon />
              </span>
              Upload Employee Excel File
            </h2>

            <div
              className={`p1-drop${dragActive ? " is-drag" : ""}`}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
              }}
            >
              <span className="p1-drop-icon">
                <CloudUpIcon />
              </span>
              <strong>Drag &amp; drop your Excel file here</strong>
              <span className="p1-drop-or">or</span>
              <button
                type="button"
                className="p1-browse"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                Browse Files
              </button>
              <span className="p1-drop-hint">Supported format: .xlsx&nbsp;&nbsp;|&nbsp;&nbsp;Max file size: 10 MB</span>
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED.join(",")}
                onChange={onPick}
                hidden
              />
            </div>

            {file && (
              <div className="p1-filechip">
                <span className="p1-filechip-icon">
                  <DocIcon />
                </span>
                <span className="p1-filechip-name">{file.name}</span>
                <span className="p1-filechip-size">
                  {(file.size / 1024).toFixed(1)} KB
                </span>
                <button
                  type="button"
                  className="p1-filechip-clear"
                  onClick={reset}
                  aria-label="Remove file"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          <div className="p1-validate-col">
            <button
              type="button"
              className="p1-validate-btn"
              onClick={upload}
              disabled={!file || status === "uploading"}
            >
              {status === "uploading" ? (
                <>
                  <Spinner /> Validating…
                </>
              ) : (
                <>
                  <CheckIcon /> Validate
                </>
              )}
            </button>
            <p className="p1-validate-note">
              <span className="p1-validate-note-icon">
                <InfoIcon />
              </span>
              Click the Validate button after uploading the file. The system will check eligibility
              and update the status of each record.
            </p>
          </div>
        </section>

        {status === "error" && (
          <div className="p1-alert p1-alert-error" role="alert">
            <span className="p1-alert-icon">
              <CrossIcon />
            </span>
            <span>{errorMsg}</span>
          </div>
        )}

        {result && (
          <section className="p1-result">
            {/* toolbar: chips + search + filters */}
            <div className="p1-toolbar">
              <div className="p1-chips">
                <button
                  type="button"
                  className={`p1-chip p1-chip-all${statusFilter === "all" ? " is-active" : ""}`}
                  onClick={() => {
                    setStatusFilter("all");
                    setPage(1);
                  }}
                >
                  All Records <b>({summary.total})</b>
                </button>
                <button
                  type="button"
                  className={`p1-chip p1-chip-approved${statusFilter === "approved" ? " is-active" : ""}`}
                  onClick={() => {
                    setStatusFilter("approved");
                    setPage(1);
                  }}
                >
                  <CheckIcon /> Approved <b>({summary.approved})</b>
                </button>
                {summary.rejected > 0 ? (
                <button
                  type="button"
                  className={`p1-chip p1-chip-rejected${statusFilter === "rejected" ? " is-active" : ""}`}
                  onClick={() => {
                    setStatusFilter("rejected");
                    setPage(1);
                  }}
                >
                  <CrossIcon /> Rejected <b>({summary.rejected})</b>
                </button>
              ) : null}
              </div>

              <div className="p1-tools">
                <div className="p1-search-wrap">
                  <span className="p1-search-icon">
                    <SearchIcon />
                  </span>
                  <input
                    type="search"
                    className="p1-search"
                    placeholder="Search by name, Employee ID, designation..."
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                      setRejectedPage(1);
                    }}
                  />
                </div>

                <div
                  className="p1-filter"
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) setFiltersOpen(false);
                  }}
                >
                  <button
                    type="button"
                    className={`p1-filter-btn${filtersOpen ? " is-open" : ""}`}
                    onClick={() => setFiltersOpen((o) => !o)}
                    aria-expanded={filtersOpen}
                  >
                    <FilterIcon /> Filters
                  </button>
                  {filtersOpen && (
                    <div className="p1-filter-pop">
                      <span className="p1-filter-label">Employment Type</span>
                      <div className="p1-filter-opts">
                        {["all", "Regular", "Contract"].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            className={`p1-filter-opt${empFilter === opt ? " is-active" : ""}`}
                            onClick={() => {
                              setEmpFilter(opt);
                              setPage(1);
                            }}
                          >
                            {opt === "all" ? "All" : opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* stats */}
            <div className="p1-stats">
              <div className="p1-stat p1-stat-total">
                <span className="p1-stat-icon">
                  <DocIcon />
                </span>
                <div className="p1-stat-meta">
                  <span className="p1-stat-label">Total Records</span>
                  <span className="p1-stat-num">{summary.total}</span>
                </div>
              </div>
              <div className="p1-stat p1-stat-ok">
                <span className="p1-stat-icon">
                  <CheckIcon />
                </span>
                <div className="p1-stat-meta">
                  <span className="p1-stat-label">Approved</span>
                  <span className="p1-stat-num">{summary.approved}</span>
                </div>
              </div>
              <div className="p1-stat p1-stat-bad">
                <span className="p1-stat-icon">
                  <CrossIcon />
                </span>
                <div className="p1-stat-meta">
                  <span className="p1-stat-label">Rejected</span>
                  <span className="p1-stat-num">{summary.rejected}</span>
                </div>
              </div>
              <div className="p1-stat p1-stat-review">
                <span className="p1-stat-icon">
                  <WarnIcon />
                </span>
                <div className="p1-stat-meta">
                  <span className="p1-stat-label">Needs Review</span>
                  <span className="p1-stat-num">{summary.needsReview}</span>
                </div>
              </div>
            </div>

            {/* table */}
            <div className="p1-table-wrap">
              <table className="p1-table">
                <thead>
                  <tr>
                    {COLUMNS.map((c) => (
                      <th key={c.key}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={COLUMNS.length} className="p1-empty">
                        No matching records.
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((r) => (
                      <tr key={`${r.sno}-${r.employeeId}`}>
                        {COLUMNS.map((c) => (
                          <td key={c.key} className={c.cell}>
                            {c.badge ? <StatusBadge status={r.status} /> : (r[c.key] !== undefined && r[c.key] !== null && String(r[c.key]).trim() !== "" ? r[c.key] : "—")}
                          </td>
                        ))}
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
                    <span key={`dots-${idx}`} className="p1-page-dots">
                      …
                    </span>
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
            <section className="p1-invalid-data" aria-label="Rejected Officers">
              <div className="p1-invalid-head">
                <h2>Rejected Officers</h2>
                <span>{invalidRows.length} rejected record{invalidRows.length === 1 ? "" : "s"}</span>
              </div>
              <p className="p1-invalid-note">
                Officers rejected during validation (due to Physically Handicapped / PH category, invalid elector/voter ID, medical/clinical designations, age outside 18–60 limits, invalid/missing dates, duplicate entries, or mandatory field discrepancies) are excluded from election duty.
              </p>
              {invalidRows.length > 0 ? (
                <>
                  <div className="p1-table-wrap">
                    <table className="p1-table">
                      <thead>
                        <tr>
                          {REJECTED_COLUMNS.map((c) => (
                            <th key={c.key}>{c.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rejectedPageRows.length === 0 ? (
                          <tr>
                            <td colSpan={REJECTED_COLUMNS.length} className="p1-empty">
                              No rejected officers match the search criteria.
                            </td>
                          </tr>
                        ) : (
                          rejectedPageRows.map((row, index) => {
                            const serialNo = (safeRejectedPage - 1) * PAGE_SIZE + index + 1;
                            return (
                              <tr key={`${row.employeeId || 'rej'}-${index}`}>
                                {REJECTED_COLUMNS.map((c) => (
                                  <td key={c.key} className={c.cell}>
                                    {c.key === "sno" ? serialNo : c.badge ? <StatusBadge status={row.status || "Rejected"} /> : (row[c.key] || "—")}
                                  </td>
                                ))}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Rejected table pagination – 10 rows per page */}
                  <div className="p1-pagination">
                    <span className="p1-page-info">
                      Showing {rejectedStart} to {rejectedEnd} of {filteredRejected.length} rejected records
                    </span>
                    <div className="p1-pages">
                      <button
                        type="button"
                        className="p1-page-btn p1-page-nav"
                        onClick={() => setRejectedPage(safeRejectedPage - 1)}
                        disabled={safeRejectedPage <= 1}
                        aria-label="Previous rejected page"
                      >
                        <ChevronLeft />
                      </button>
                      {rejectedPages.map((p, idx) =>
                        p === "…" ? (
                          <span key={`rej-dots-${idx}`} className="p1-page-dots">…</span>
                        ) : (
                          <button
                            key={`rej-page-${p}`}
                            type="button"
                            className={`p1-page-btn${p === safeRejectedPage ? " is-active" : ""}`}
                            onClick={() => setRejectedPage(p)}
                          >
                            {p}
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        className="p1-page-btn p1-page-nav"
                        onClick={() => setRejectedPage(safeRejectedPage + 1)}
                        disabled={safeRejectedPage >= rejectedPageCount}
                        aria-label="Next rejected page"
                      >
                        <ChevronRight />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="p1-empty">No rejected officers reported for this dataset.</p>
              )}
            </section>
          </section>
        )}

        <WorkflowNavigation
          context={context}
          step="phase1"
          canContinue={Number(result?.summary?.approved || 0) > 0}
          disabledReason="Upload and validate at least one approved employee before continuing."
        />
      </div>
    </main>
  );
}
