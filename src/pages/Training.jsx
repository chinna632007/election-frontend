/**
 * Training – PO/APO and MO Training Allocation, Venue Assignment, and Order Generation.
 * Incorporates actual uploaded Excel fields, allocated team, and polling station data.
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import "./Phase1.css";
import "./Training.css";
import Header from "../components/Header.jsx";
import WorkflowNavigation from "../components/WorkflowNavigation.jsx";
import {
  allocateTrainingOrders,
  generateTrainingOrders,
  listPoApoBatches,
  downloadTrainingOrdersZip,
  uploadTrainingLocations,
  listTrainingLocations,
  wipeAllTrainingOrders,
  getWorkflowData,
  saveWorkflowData,
  getBatchPersonnel,
} from "../api/client.js";

const PAGE_SIZE = 10; // Exactly 10 rows per page matching before phase sheets
const VENUE_PAGE_SIZE = 10; // 10 rows per page for remaining venues
const MAX_BATCH_CAPACITY = 100;

function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 16, height: 16 }}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 16, height: 16 }}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 15, height: 15, marginRight: 6 }}>
      <path d="M12 3v12" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 14, height: 14 }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 14, height: 14 }}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function CloudUpIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: 15, height: 15 }}>
      <path d="M16 16l-4-4-4 4" />
      <path d="M12 12v9" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

export default function Training({ context } = {}) {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const isMunicipal = context === "municipal" || (context == null && !path.includes("panchayat"));
  const contextLabel = isMunicipal ? "Municipal" : "Panchayat";
  const backHref = isMunicipal ? "/elections/municipal" : "/elections/panchayat";
  const workflowContext = (context === "panchayat" || path.includes("panchayat")) ? "panchayat" : "municipal";

  // Workflow snapshots
  const [phase1Data, setPhase1Data] = useState(null);
  const [phase2Rows, setPhase2Rows] = useState([]);
  const [phase3Rows, setPhase3Rows] = useState([]);
  const [personnelMap, setPersonnelMap] = useState(new Map());

  // Training state (PO/APO and MO only, OPO removed)
  const [trainingCategory, setTrainingCategory] = useState("PO-APO"); // "PO-APO" | "MO"
  const [exportCategory, setExportCategory] = useState("PO-APO"); // "PO-APO" | "MO" | "BOTH"
  const [trainingDate, setTrainingDate] = useState("");
  const [poApoTime, setPoApoTime] = useState("10:00"); // Morning 10:00 AM
  const [moTime, setMoTime] = useState("14:00"); // Afternoon 02:00 PM (different time for MO)
  const [poApoTrainingRows, setPoApoTrainingRows] = useState([]);
  const [moTrainingRows, setMoTrainingRows] = useState([]);

  // Batch management
  const [batchGroup, setBatchGroup] = useState("PO");
  const [, setBatches] = useState([]);
  const [trainingPage, setTrainingPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  // Venues / Locations
  const [allLocations, setAllLocations] = useState([]);
  const [locCount, setLocCount] = useState(null);
  const [uploadingLoc, setUploadingLoc] = useState(false);
  const [locMsg, setLocMsg] = useState(null);
  const [showRemainingVenues, setShowRemainingVenues] = useState(false);
  const [remainingVenuesPage, setRemainingVenuesPage] = useState(1);

  // Status & messages
  const [allocating, setAllocating] = useState(false);
  const [allocateMsg, setAllocateMsg] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState(null);
  const [zipping, setZipping] = useState(false);
  const [wiping, setWiping] = useState(false);
  const [wipeMsg, setWipeMsg] = useState(null);
  const [error, setError] = useState(null);

  // Load all workflow data across phases
  const loadWorkflowState = useCallback(async () => {
    try {
      const sessionUploaded = typeof sessionStorage !== "undefined"
        ? sessionStorage.getItem(`phase1_session_uploaded_${workflowContext}`)
        : null;
      if (!sessionUploaded) {
        setPhase1Data(null);
        setPhase2Rows([]);
        setPhase3Rows([]);
        setPoApoTrainingRows([]);
        setMoTrainingRows([]);
        setBatches([]);
        return;
      }

      const [p1, p2, p3, tr, locData] = await Promise.all([
        getWorkflowData(workflowContext, "phase1").catch(() => null),
        getWorkflowData(workflowContext, "phase2").catch(() => null),
        getWorkflowData(workflowContext, "phase3").catch(() => null),
        getWorkflowData(workflowContext, "training").catch(() => null),
        listTrainingLocations().catch(() => null),
      ]);

      setPhase1Data(p1?.value || null);
      const p2List = Array.isArray(p2?.value?.rows) ? p2.value.rows : [];
      setPhase2Rows(p2List);
      const p3List = Array.isArray(p3?.value?.rows) ? p3.value.rows : [];
      setPhase3Rows(p3List);

      if (locData) {
        const locList = Array.isArray(locData.locations) ? locData.locations : [];
        setAllLocations(locList);
        setLocCount(locData.count ?? locList.length);
      }

      // Restore saved training state only if prerequisites exist
      if (tr?.value) {
        if (p2List.length === 0 || p3List.length === 0) {
          clearWorkflowData(workflowContext, "training").catch(() => {});
          setPoApoTrainingRows([]);
          setMoTrainingRows([]);
        } else {
          if (tr.value.trainingDate) setTrainingDate(tr.value.trainingDate);
          if (tr.value.poApoTime) setPoApoTime(tr.value.poApoTime);
          else if (tr.value.trainingTime) setPoApoTime(tr.value.trainingTime);
          if (tr.value.moTime) setMoTime(tr.value.moTime);
          if (Array.isArray(tr.value.poApoTrainingRows)) setPoApoTrainingRows(tr.value.poApoTrainingRows);
          if (Array.isArray(tr.value.moTrainingRows)) setMoTrainingRows(tr.value.moTrainingRows);
        }
      }

      // Fetch Phase 1 personnel details if batch ID exists
      const batchId = p1?.value?.batchId;
      if (batchId) {
        try {
          const detail = await getBatchPersonnel(batchId);
          const pList = Array.isArray(detail?.personnel) ? detail.personnel : [];
          const map = new Map();
          for (const p of pList) {
            const id = String(p.employee_id || p.employeeId || "").trim();
            if (id) map.set(id, p);
          }
          setPersonnelMap(map);
        } catch {
          // Best effort
        }
      }
    } catch (e) {
      console.warn("Failed to load workflow state:", e);
    }
  }, [workflowContext]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadWorkflowState();
      try {
        const batchData = await listPoApoBatches(batchGroup).catch(() => ({ batches: [] }));
        if (cancelled) return;
        setBatches(Array.isArray(batchData?.batches) ? batchData.batches : []);
      } catch (e) {
        if (!cancelled) setError(e.message || "Failed to load batches");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [batchGroup, loadWorkflowState]);

  // Prerequisites check
  const isPhase1Ready = Boolean(phase1Data?.batchId || phase1Data?.summary?.approved > 0 || personnelMap.size > 0);
  const isPhase2Ready = phase2Rows.length > 0;
  const isPhase3Ready = phase3Rows.length > 0;
  const isScheduleReady = Boolean(trainingDate && poApoTime && (locCount > 0 || allLocations.length > 0));
  const canGenerateTraining = isPhase1Ready && isPhase2Ready && isPhase3Ready && isScheduleReady;

  // Training Context Helper
  const getTrainingContext = () => {
    // Group phase2Rows by team
    const teamMap = new Map();
    for (const r of phase2Rows) {
      if (!r.teamCode) continue;
      if (!teamMap.has(r.teamCode)) {
        teamMap.set(r.teamCode, {
          teamCode: r.teamCode,
          postingMandal: r.postingMandal,
          po: null,
          apo: null,
          mo: null,
        });
      }
      const entry = teamMap.get(r.teamCode);
      const role = String(r.role || r.teamRole || "").trim().toLowerCase();
      if (r.isMicroObserver || role === "micro observer" || role === "mo") {
        entry.mo = r;
      } else if (role.includes("presiding") && !role.includes("asst") && !role.includes("assistant")) {
        entry.po = r;
      } else if (role.includes("asst") || role.includes("assistant") || role === "apo") {
        entry.apo = r;
      }
    }

    // Build station map from Phase 3 rows
    const stationByTeam = new Map();
    for (const st of phase3Rows) {
      if (st.teamCode && st.teamCode !== "—") {
        stationByTeam.set(st.teamCode, st);
      }
    }
    const allTeamCodes = Array.from(teamMap.keys());
    allTeamCodes.forEach((code, idx) => {
      if (!stationByTeam.has(code) && phase3Rows.length > 0) {
        stationByTeam.set(code, phase3Rows[idx % phase3Rows.length]);
      }
    });

    const venuesPool = allLocations.length > 0 ? allLocations : [
      { id: 1, location_name: "Govt Junior College, Kakinada", mandal: "Kakinada Urban" },
      { id: 2, location_name: "Municipal High School, Kakinada", mandal: "Kakinada Urban" },
      { id: 3, location_name: "PR Govt Degree College, Kakinada", mandal: "Kakinada Urban" },
      { id: 4, location_name: "Collectorate Conference Hall, Kakinada", mandal: "Kakinada Urban" },
    ];

    // Partition venues so MO venues are distinct and separate from PO/APO venues
    const totalVenueCount = venuesPool.length;
    const poApoVenueSliceEnd = Math.max(1, Math.min(totalVenueCount - 1, Math.floor(totalVenueCount * 0.75)));
    const poApoAvailableVenues = totalVenueCount > 1 ? venuesPool.slice(0, poApoVenueSliceEnd) : venuesPool;
    const moAvailableVenues = totalVenueCount > 1 ? venuesPool.slice(poApoVenueSliceEnd) : [
      { id: 999, location_name: "Collectorate Meeting Hall (Micro Observer Centre)", mandal: "District HQ" }
    ];

    const poApoTimeFormatted = `${poApoTime} (Morning Session - 10:00 AM)`;
    const moTimeFormatted = `${moTime} (Afternoon Session - 02:00 PM)`;

    return {
      teamMap,
      stationByTeam,
      allTeamCodes,
      venuesPool,
      poApoAvailableVenues,
      moAvailableVenues,
      poApoTimeFormatted,
      moTimeFormatted,
    };
  };

  const generatePoApoRows = (ctx) => {
    const { teamMap, stationByTeam, poApoAvailableVenues, poApoTimeFormatted } = ctx;
    const byMandal = new Map();
    for (const [teamCode, entry] of teamMap.entries()) {
      const st = stationByTeam.get(teamCode);
      const mandal = st?.mandal || entry.postingMandal || entry.po?.workMandal || "Kakinada Urban";
      if (!byMandal.has(mandal)) byMandal.set(mandal, []);
      byMandal.get(mandal).push({ teamCode, entry, station: st });
    }

    const generatedPoApo = [];
    let globalTeamIdx = 0;

    for (const [mandal, teams] of byMandal.entries()) {
      const mandalPoVenues = poApoAvailableVenues.filter(
        (l) => String(l.mandal || "").trim().toLowerCase() === mandal.trim().toLowerCase()
      );

      for (let i = 0; i < teams.length; i += MAX_BATCH_CAPACITY) {
        const batchIndex = Math.floor(i / MAX_BATCH_CAPACITY) + 1;
        const chunk = teams.slice(i, i + MAX_BATCH_CAPACITY);

        for (const item of chunk) {
          const { teamCode, entry, station } = item;
          const psLabel = station?.psNo ? `PS #${station.psNo}` : (station?.ballotId || "Allotted in Phase 3");

          const venueObj = mandalPoVenues.length > 0
            ? mandalPoVenues[globalTeamIdx % mandalPoVenues.length]
            : poApoAvailableVenues[globalTeamIdx % poApoAvailableVenues.length];
          const venue = venueObj?.location_name || `${mandal} Govt Junior College, Hall ${globalTeamIdx + 1}`;
          globalTeamIdx += 1;

          const rawPo = entry.po ? (personnelMap.get(String(entry.po.employeeId || "").trim()) || {}) : {};
          const poName = entry.po?.employeeName || rawPo.employee_name || "—";
          const poId = entry.po?.employeeId || "—";
          const poDesignation = entry.po?.designation || rawPo.designation || "Presiding Officer";
          const poDepartment = rawPo.department_code || rawPo.department || "—";
          const poMobile = entry.po?.mobileNo || rawPo.mobile_no || "—";

          const rawApo = entry.apo ? (personnelMap.get(String(entry.apo.employeeId || "").trim()) || {}) : {};
          const apoName = entry.apo?.employeeName || rawApo.employee_name || "—";
          const apoId = entry.apo?.employeeId || "—";
          const apoDesignation = entry.apo?.designation || rawApo.designation || "Assistant Presiding Officer";
          const apoDepartment = rawApo.department_code || rawApo.department || "—";
          const apoMobile = entry.apo?.mobileNo || rawApo.mobile_no || "—";

          generatedPoApo.push({
            teamCode,
            pollingStation: psLabel,
            stationNo: station?.psNo || "—",
            ballotId: station?.ballotId || "—",
            dutyMandal: mandal,
            batchNo: batchIndex,
            trainingVenue: venue,
            trainingDate,
            trainingTime: poApoTimeFormatted,
            status: "Allocated",

            poId,
            poName,
            poDesignation,
            poDepartment,
            poMobile,

            apoId,
            apoName,
            apoDesignation,
            apoDepartment,
            apoMobile,
          });
        }
      }
    }
    return generatedPoApo;
  };

  const generateMoRows = (ctx) => {
    const { teamMap, stationByTeam, allTeamCodes, moAvailableVenues, moTimeFormatted } = ctx;
    const generatedMo = [];
    const distinctMoRows = [];
    const moSeen = new Set();

    allTeamCodes.forEach((code) => {
      const entry = teamMap.get(code);
      if (entry?.mo && !moSeen.has(entry.mo.employeeId)) {
        moSeen.add(entry.mo.employeeId);
        distinctMoRows.push({ ...entry.mo, teamCode: code });
      }
    });

    phase2Rows
      .filter((r) => r.isMicroObserver && !moSeen.has(r.employeeId))
      .forEach((mo) => {
        moSeen.add(mo.employeeId);
        distinctMoRows.push(mo);
      });

    distinctMoRows.forEach((mo, idx) => {
      const st = stationByTeam.get(mo.teamCode);
      const mandal = st?.mandal || mo.postingMandal || mo.workMandal || "Kakinada Urban";
      const moVenueObj = moAvailableVenues[idx % moAvailableVenues.length];
      const moVenue = moVenueObj?.location_name || `${mandal} Collectorate Training Hall ${idx + 1}`;

      generatedMo.push({
        teamCode: mo.teamCode || "—",
        pollingStation: st?.psNo ? `PS #${st.psNo}` : (st?.ballotId || "Allotted in Phase 3"),
        stationNo: st?.psNo || "—",
        dutyMandal: mandal,
        batchNo: Math.floor(idx / MAX_BATCH_CAPACITY) + 1,
        trainingVenue: moVenue,
        trainingDate,
        trainingTime: moTimeFormatted,
        status: "Allocated",
        employeeId: mo.employeeId || "—",
        employeeName: mo.employeeName || "—",
        designation: mo.designation || "Micro Observer",
        department: mo.bankName || "Banking / Central Govt",
        mobile: mo.mobileNo || "—",
        role: "Micro Observer",
      });
    });

    return generatedMo;
  };

  // 1. Independent PO/APO Venue & Schedule Allocation
  const runAllocatePoApo = async () => {
    if (!canGenerateTraining) {
      setError("Please ensure all 4 prerequisites (Phase 1, Phase 2, Phase 3, and Training Schedule) are ready.");
      return;
    }
    try {
      setError(null);
      setAllocating(true);
      setAllocateMsg(null);

      const ctx = getTrainingContext();
      const newPoApo = generatePoApoRows(ctx);

      await saveWorkflowData(workflowContext, "training", {
        trainingDate,
        poApoTime,
        moTime,
        poApoTrainingRows: newPoApo,
        moTrainingRows,
        allocatedAt: new Date().toISOString(),
      });

      setPoApoTrainingRows(newPoApo);
      setAllocateMsg(
        `Successfully allocated training for ${newPoApo.length} Teams (PO & APO trained together at morning session ${poApoTime} in assigned venues).`
      );
    } catch (e) {
      setError(e.message || "Failed to allocate PO/APO training");
    } finally {
      setAllocating(false);
    }
  };

  // 2. Independent MO Venue & Schedule Allocation
  const runAllocateMo = async () => {
    if (!canGenerateTraining) {
      setError("Please ensure all 4 prerequisites (Phase 1, Phase 2, Phase 3, and Training Schedule) are ready.");
      return;
    }
    try {
      setError(null);
      setAllocating(true);
      setAllocateMsg(null);

      const ctx = getTrainingContext();
      const newMo = generateMoRows(ctx);

      await saveWorkflowData(workflowContext, "training", {
        trainingDate,
        poApoTime,
        moTime,
        poApoTrainingRows,
        moTrainingRows: newMo,
        allocatedAt: new Date().toISOString(),
      });

      setMoTrainingRows(newMo);
      setAllocateMsg(
        `Successfully allocated training for ${newMo.length} Micro Observers (trained separately at afternoon session ${moTime} in dedicated distinct venues).`
      );
    } catch (e) {
      setError(e.message || "Failed to allocate Micro Observer training");
    } finally {
      setAllocating(false);
    }
  };

  // 3. Combined Allocation for both PO/APO and MO
  const runAllocateBoth = async () => {
    if (!canGenerateTraining) {
      setError("Please ensure all 4 prerequisites (Phase 1, Phase 2, Phase 3, and Training Schedule) are ready.");
      return;
    }
    try {
      setError(null);
      setAllocating(true);
      setAllocateMsg(null);

      const ctx = getTrainingContext();
      const newPoApo = generatePoApoRows(ctx);
      const newMo = generateMoRows(ctx);

      await saveWorkflowData(workflowContext, "training", {
        trainingDate,
        poApoTime,
        moTime,
        poApoTrainingRows: newPoApo,
        moTrainingRows: newMo,
        allocatedAt: new Date().toISOString(),
      });

      setPoApoTrainingRows(newPoApo);
      setMoTrainingRows(newMo);

      try {
        await allocateTrainingOrders();
        const batchData = await listPoApoBatches(batchGroup);
        setBatches(Array.isArray(batchData?.batches) ? batchData.batches : []);
      } catch {
        // Backend secondary orders
      }

      setAllocateMsg(
        `Successfully allocated training for ${newPoApo.length} Teams (PO & APO at morning session) and ${newMo.length} Micro Observers (at separate afternoon session & distinct venues).`
      );
    } catch (e) {
      setError(e.message || "Failed to generate training allocation");
    } finally {
      setAllocating(false);
    }
  };

  const runAllocateTraining = runAllocateBoth;

  // Remaining / unassigned venues logic (venues in allLocations not assigned to either PO/APO or MO)
  const usedVenueNames = useMemo(() => {
    const set = new Set();
    poApoTrainingRows.forEach((r) => {
      if (r.trainingVenue) set.add(String(r.trainingVenue).trim().toLowerCase());
    });
    moTrainingRows.forEach((r) => {
      if (r.trainingVenue) set.add(String(r.trainingVenue).trim().toLowerCase());
    });
    return set;
  }, [poApoTrainingRows, moTrainingRows]);

  const remainingVenues = useMemo(() => {
    if (!allLocations || allLocations.length === 0) return [];
    if (usedVenueNames.size === 0) return allLocations;
    return allLocations.filter((loc) => !usedVenueNames.has(String(loc.location_name || "").trim().toLowerCase()));
  }, [allLocations, usedVenueNames]);

  const remVenueTotalPages = Math.max(1, Math.ceil(remainingVenues.length / VENUE_PAGE_SIZE));
  const safeRemVenuePage = Math.min(Math.max(1, remainingVenuesPage), remVenueTotalPages);
  const remVenueStartIdx = (safeRemVenuePage - 1) * VENUE_PAGE_SIZE;
  const pagedRemVenues = remainingVenues.slice(remVenueStartIdx, remVenueStartIdx + VENUE_PAGE_SIZE);

  // Download remaining venues Excel with perfect column widths
  const downloadRemainingVenuesExcel = () => {
    if (!remainingVenues.length) return;
    const wb = XLSX.utils.book_new();
    const rows = remainingVenues.map((v, idx) => ({
      "S.No": idx + 1,
      "Venue / Location Name": v.location_name || "—",
      "Mandal": v.mandal || "—",
      "Capacity": v.capacity || 100,
      "Contact Person": v.contact_person || "—",
      "Contact Mobile": v.mobile || "—",
      "Status": "Available / Unused",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 8 },  // S.No
      { wch: 36 }, // Venue Name
      { wch: 20 }, // Mandal
      { wch: 12 }, // Capacity
      { wch: 24 }, // Contact Person
      { wch: 18 }, // Contact Mobile
      { wch: 22 }, // Status
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Remaining Venues");
    XLSX.writeFile(wb, "remaining-training-venues.xlsx");
  };

  // Download training data as Excel with perfect column widths
  const downloadTrainingExcel = (category) => {
    const wb = XLSX.utils.book_new();

    // 1. PO/APO sheet
    if (category === "PO-APO" || category === "BOTH" || category === "ALL") {
      if (poApoTrainingRows.length === 0) {
        if (category === "PO-APO") {
          alert("No generated PO/APO training data found. Please run training allocation first.");
          return;
        }
      } else {
        const poApoData = poApoTrainingRows.map((r, index) => ({
          "S.No": index + 1,
          "Team Code": r.teamCode,
          "Polling Station No.": r.stationNo || r.pollingStation,
          "Duty Mandal": r.dutyMandal,
          "Presiding Officer (PO) ID": r.poId,
          "PO Name": r.poName,
          "PO Designation": r.poDesignation,
          "PO Department": r.poDepartment,
          "PO Mobile No": r.poMobile,
          "Asst Presiding Officer (APO) ID": r.apoId,
          "APO Name": r.apoName,
          "APO Designation": r.apoDesignation,
          "APO Department": r.apoDepartment,
          "APO Mobile No": r.apoMobile,
          "Training Batch": `Batch ${r.batchNo}`,
          "Training Venue Place": r.trainingVenue,
          "Training Date": r.trainingDate,
          "Session & Time": r.trainingTime,
          "Status": r.status,
        }));
        const wsPoApo = XLSX.utils.json_to_sheet(poApoData);
        wsPoApo["!cols"] = [
          { wch: 8 },  // S.No
          { wch: 14 }, // Team Code
          { wch: 20 }, // Polling Station No.
          { wch: 20 }, // Duty Mandal
          { wch: 18 }, // PO ID
          { wch: 28 }, // PO Name
          { wch: 26 }, // PO Designation
          { wch: 24 }, // PO Department
          { wch: 16 }, // PO Mobile
          { wch: 18 }, // APO ID
          { wch: 28 }, // APO Name
          { wch: 26 }, // APO Designation
          { wch: 24 }, // APO Department
          { wch: 16 }, // APO Mobile
          { wch: 15 }, // Training Batch
          { wch: 36 }, // Training Venue Place
          { wch: 16 }, // Training Date
          { wch: 26 }, // Session & Time
          { wch: 14 }, // Status
        ];
        XLSX.utils.book_append_sheet(wb, wsPoApo, "PO_APO_Training");
      }
    }

    // 2. MO sheet
    if (category === "MO" || category === "BOTH" || category === "ALL") {
      if (moTrainingRows.length === 0) {
        if (category === "MO") {
          alert("No generated Micro Observer training data found. Please run training allocation first.");
          return;
        }
      } else {
        const moData = moTrainingRows.map((r, index) => ({
          "S.No": index + 1,
          "Team Code": r.teamCode,
          "Polling Station No.": r.stationNo || r.pollingStation,
          "Duty Mandal": r.dutyMandal,
          "Micro Observer ID": r.employeeId,
          "MO Officer Name": r.employeeName,
          "Designation": r.designation,
          "Bank / Central Dept": r.department,
          "Mobile No": r.mobile,
          "Training Batch": `Batch ${r.batchNo}`,
          "Training Venue Place": r.trainingVenue,
          "Training Date": r.trainingDate,
          "Session & Time": r.trainingTime,
          "Status": r.status,
        }));
        const wsMo = XLSX.utils.json_to_sheet(moData);
        wsMo["!cols"] = [
          { wch: 8 },  // S.No
          { wch: 14 }, // Team Code
          { wch: 20 }, // Polling Station No.
          { wch: 20 }, // Duty Mandal
          { wch: 18 }, // MO ID
          { wch: 28 }, // MO Name
          { wch: 24 }, // Designation
          { wch: 26 }, // Bank / Dept
          { wch: 16 }, // Mobile
          { wch: 15 }, // Training Batch
          { wch: 36 }, // Training Venue Place
          { wch: 16 }, // Training Date
          { wch: 26 }, // Session & Time
          { wch: 14 }, // Status
        ];
        XLSX.utils.book_append_sheet(wb, wsMo, "MO_Training");
      }
    }

    // 3. Append Remaining / Unassigned Venues sheet to the workbook
    if (remainingVenues.length > 0) {
      const remData = remainingVenues.map((v, index) => ({
        "S.No": index + 1,
        "Venue / Training Place": v.location_name || "—",
        "Mandal": v.mandal || "—",
        "Capacity": v.capacity || 100,
        "Contact Person": v.contact_person || "—",
        "Contact Mobile": v.mobile || "—",
        "Status": "Available / Unused",
      }));
      const wsRem = XLSX.utils.json_to_sheet(remData);
      wsRem["!cols"] = [
        { wch: 8 },  // S.No
        { wch: 36 }, // Venue Name
        { wch: 20 }, // Mandal
        { wch: 12 }, // Capacity
        { wch: 24 }, // Contact Person
        { wch: 18 }, // Contact Mobile
        { wch: 22 }, // Status
      ];
      XLSX.utils.book_append_sheet(wb, wsRem, "Remaining_Venues");
    }

    if (wb.SheetNames.length === 0) {
      alert("No data available to export. Please generate training allocation first.");
      return;
    }

    const fileName =
      category === "BOTH" || category === "ALL"
        ? "training-po-apo-and-mo-allocation.xlsx"
        : `training-${category.toLowerCase()}-allocation.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // Current view rows based on category (PO-APO or MO)
  const activeTrainingRows = useMemo(() => {
    const list = trainingCategory === "PO-APO" ? poApoTrainingRows : moTrainingRows;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => {
      if (trainingCategory === "PO-APO") {
        return [
          r.teamCode,
          r.poId,
          r.poName,
          r.poDesignation,
          r.apoId,
          r.apoName,
          r.apoDesignation,
          r.dutyMandal,
          r.trainingVenue,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);
      }
      return [r.employeeId, r.employeeName, r.designation, r.teamCode, r.dutyMandal, r.trainingVenue]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [trainingCategory, poApoTrainingRows, moTrainingRows, searchQuery]);

  const trainingPageCount = Math.max(1, Math.ceil(activeTrainingRows.length / PAGE_SIZE));
  const safeTrainingPage = Math.min(trainingPage, trainingPageCount);
  const pagedTrainingRows = activeTrainingRows.slice(
    (safeTrainingPage - 1) * PAGE_SIZE,
    safeTrainingPage * PAGE_SIZE
  );

  const runLocUpload = async (file) => {
    if (!file) return;
    try {
      setError(null);
      setLocMsg(null);
      setUploadingLoc(true);
      const data = await uploadTrainingLocations(file);
      const locs = await listTrainingLocations();
      const list = Array.isArray(locs?.locations) ? locs.locations : [];
      setAllLocations(list);
      setLocCount(locs?.count ?? list.length);
      const n = data?.acceptedRows ?? data?.count ?? data?.replaced ?? list.length ?? 0;
      const rejectedNote = data?.rejectedRows ? ` (${data.rejectedRows} row(s) skipped)` : "";
      setLocMsg(`Uploaded ${n} training location${n === 1 ? "" : "s"}${rejectedNote}.`);
    } catch (e) {
      setError(e.message || "Locations upload failed");
    } finally {
      setUploadingLoc(false);
    }
  };

  const runGenerate = async (group) => {
    try {
      setError(null);
      setGenerateMsg(null);
      setGenerating(true);
      const data = await generateTrainingOrders(group);
      setGenerateMsg(
        `${group}: generated ${data.generated ?? 0} of ${data.totalMembers ?? 0} orders` +
          (data.skippedNoLocation ? ` (${data.skippedNoLocation} without venue yet)` : "")
      );
    } catch (e) {
      setError(e.message || "Generate failed");
    } finally {
      setGenerating(false);
    }
  };

  const runZip = async (group) => {
    try {
      setError(null);
      setZipping(true);
      await downloadTrainingOrdersZip(group);
    } catch (e) {
      setError(e.message || "ZIP download failed");
    } finally {
      setZipping(false);
    }
  };

  const runWipeAll = async () => {
    if (!window.confirm("This will clear training allocations. Continue?")) return;
    try {
      setError(null);
      setWipeMsg(null);
      setWiping(true);
      await wipeAllTrainingOrders();
      setBatches([]);
      setPoApoTrainingRows([]);
      setMoTrainingRows([]);
      setWipeMsg("Cleaned training data successfully.");
    } catch (e) {
      setError(e.message || "Wipe failed");
    } finally {
      setWiping(false);
    }
  };

  return (
    <div className="tr-page p1-page">
      <Header />

      <main className="p1-content">
        <div className="tr-back-row">
          <a href={backHref} aria-label={`Back to ${contextLabel} Elections`}>
            <ChevronLeft /> Back to {contextLabel} Elections
          </a>
        </div>

        {/* 1. PREREQUISITES READINESS STATUS CARD */}
        <section className="p1-card" aria-label="Training Prerequisites">
          <div className="p1-card-head">
            <span className="p1-card-title">Training Allocation — Prerequisites &amp; Schedule</span>
          </div>
          <p className="tr-hint" style={{ marginBottom: 14 }}>
            Training allocation requires verified personnel from Phase 1, formed teams from Phase 2, allocated polling stations from Phase 3, and venue/session details.
          </p>

          <div className="p1-stats" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginBottom: 16 }}>
            <div className={`p1-stat ${isPhase1Ready ? "p1-stat-ok" : "p1-stat-bad"}`}>
              <span className="p1-stat-icon">{isPhase1Ready ? <CheckIcon /> : <WarnIcon />}</span>
              <div className="p1-stat-meta">
                <span className="p1-stat-label">1. Phase 1: Validated Input</span>
                <span className="p1-stat-num" style={{ fontSize: 14 }}>
                  {isPhase1Ready ? `${personnelMap.size || phase1Data?.summary?.approved || "Available"} Approved` : "Pending Upload"}
                </span>
              </div>
            </div>

            <div className={`p1-stat ${isPhase2Ready ? "p1-stat-ok" : "p1-stat-bad"}`}>
              <span className="p1-stat-icon">{isPhase2Ready ? <CheckIcon /> : <WarnIcon />}</span>
              <div className="p1-stat-meta">
                <span className="p1-stat-label">2. Phase 2: Formed Teams</span>
                <span className="p1-stat-num" style={{ fontSize: 14 }}>
                  {isPhase2Ready ? `${phase2Rows.length} Officers Formed` : "Pending Formation"}
                </span>
              </div>
            </div>

            <div className={`p1-stat ${isPhase3Ready ? "p1-stat-ok" : "p1-stat-bad"}`}>
              <span className="p1-stat-icon">{isPhase3Ready ? <CheckIcon /> : <WarnIcon />}</span>
              <div className="p1-stat-meta">
                <span className="p1-stat-label">3. Phase 3: Station Allocation</span>
                <span className="p1-stat-num" style={{ fontSize: 14 }}>
                  {isPhase3Ready ? `${phase3Rows.length} Stations Allotted` : "Pending Allocation"}
                </span>
              </div>
            </div>

            <div className={`p1-stat ${isScheduleReady ? "p1-stat-ok" : "p1-stat-bad"}`}>
              <span className="p1-stat-icon">{isScheduleReady ? <CheckIcon /> : <WarnIcon />}</span>
              <div className="p1-stat-meta">
                <span className="p1-stat-label">4. Schedule &amp; Venues</span>
                <span className="p1-stat-num" style={{ fontSize: 14 }}>
                  {isScheduleReady ? `${locCount || allLocations.length} Venues Ready` : "Pending Schedule"}
                </span>
              </div>
            </div>
          </div>

          {/* Schedule Inputs & Actions */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14, padding: "14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
            <label className="tr-manual-field">
              <span>Training Date *</span>
              <input
                type="date"
                value={trainingDate}
                onChange={(e) => setTrainingDate(e.target.value)}
                required
              />
            </label>

            <label className="tr-manual-field">
              <span>PO/APO Session Time *</span>
              <input
                type="time"
                value={poApoTime}
                onChange={(e) => setPoApoTime(e.target.value)}
                required
                title="PO & APO attend at the SAME time and SAME place"
              />
            </label>

            <label className="tr-manual-field">
              <span>MO Session Time (Different) *</span>
              <input
                type="time"
                value={moTime}
                onChange={(e) => setMoTime(e.target.value)}
                required
                title="Micro Observers attend at a DIFFERENT time and DIFFERENT place"
              />
            </label>

            <label className="tr-upload-venues-btn" style={{ cursor: uploadingLoc ? "wait" : "pointer" }}>
              <CloudUpIcon />
              <span>{uploadingLoc ? "Uploading venues…" : "Upload venues (.xlsx)"}</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                hidden
                disabled={uploadingLoc}
                onChange={(e) => {
                  const f = e.target.files && e.target.files[0];
                  e.target.value = "";
                  runLocUpload(f);
                }}
              />
            </label>

            <div className="tr-allocation-controls">
              <button
                type="button"
                className="tr-allocate-btn"
                disabled={!canGenerateTraining || allocating}
                onClick={runAllocateBoth}
                title="Allocate training venues for PO/APO and Micro Observers"
              >
                {allocating ? "Allocating…" : "Allocate Venues"}
              </button>
            </div>
          </div>

          {locMsg && (
            <div className="tr-hint" role="status" style={{ fontSize: 13, color: "#059669", fontWeight: 600, marginBottom: 8 }}>
              {locMsg}
            </div>
          )}

          {!canGenerateTraining && (
            <p className="tr-hint" style={{ color: "#b45309", background: "#fef3c7", padding: "8px 12px", borderRadius: 6 }}>
              ⚠ Training generation is disabled until all 4 requirements are ready: Phase 1 employee validation, Phase 2 team formation, Phase 3 polling station allocation, and training date/time/venues.
            </p>
          )}

          {allocateMsg && <div className="p1-note" role="status" style={{ marginTop: 10 }}>{allocateMsg}</div>}
          {error && <div className="tr-error" role="alert" style={{ marginTop: 10 }}>{error}</div>}
        </section>

        {/* 2. GENERATED TRAINING ALLOCATION VIEW & DOWNLOAD (BY CATEGORY: PO/APO or MO) */}
        <section className="p1-card" aria-label="Generated Training Data">
          <div className="p1-card-head" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div>
              <span className="p1-card-title">Generated Training Venue Allocation</span>
              <p className="tr-hint" style={{ margin: "4px 0 0", fontSize: 13, color: "#0d2c56" }}>
                PO/APO trained together (same time &amp; place per team); Micro Observers trained separately (different time &amp; different venue).
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, color: "#0d2c56" }}>
                Category:
                <select
                  value={trainingCategory}
                  onChange={(e) => {
                    setTrainingCategory(e.target.value);
                    setTrainingPage(1);
                  }}
                  className="tr-view-select"
                  aria-label="Select Training View Category"
                >
                  <option value="PO-APO">PO/APO (Presiding &amp; Asst Presiding)</option>
                  <option value="MO">MO (Micro Observers)</option>
                </select>
              </label>

              {/* Download Category Dropdown – selects export category without auto-downloading */}
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, color: "#0d2c56" }}>
                Export:
                <select
                  className="tr-download-dropdown"
                  value={exportCategory}
                  onChange={(e) => setExportCategory(e.target.value)}
                  title="Select training category to export"
                  aria-label="Select Training Export Category"
                >
                  <option value="PO-APO">PO/APO Training</option>
                  <option value="MO">Micro Observer (MO) Training</option>
                  <option value="BOTH">Both PO/APO &amp; MO Training</option>
                </select>
              </label>

              {/* Adjacent Download Button – initiates download only on user click */}
              <button
                type="button"
                className="p1-mini-btn tr-export-btn"
                onClick={() => downloadTrainingExcel(exportCategory)}
                disabled={
                  exportCategory === "PO-APO" ? poApoTrainingRows.length === 0 :
                  exportCategory === "MO" ? moTrainingRows.length === 0 :
                  (poApoTrainingRows.length === 0 && moTrainingRows.length === 0)
                }
                style={{ background: "#059669", color: "#fff", display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700 }}
                title={`Download ${exportCategory === "PO-APO" ? "PO/APO" : exportCategory === "MO" ? "MO" : "Both"} training data in Excel format`}
              >
                <DownloadIcon /> Download {exportCategory === "PO-APO" ? "PO/APO" : exportCategory === "MO" ? "MO" : "Both"} (Excel)
              </button>
            </div>
          </div>

          <div style={{ margin: "10px 0 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <span className="tr-hint">
              Showing <strong>{activeTrainingRows.length}</strong> {trainingCategory === "PO-APO" ? "PO & APO team" : "Micro Observer"} training records (10 per page).
            </span>

            <input
              type="search"
              className="p1-search"
              placeholder="Search by ID, name, designation, team, mandal, or venue..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setTrainingPage(1);
              }}
              style={{ maxWidth: 360 }}
            />
          </div>

          <div className="tr-table-wrap">
            {trainingCategory === "PO-APO" && (
              <table className="tr-table">
                <thead>
                  <tr>
                    <th style={{ width: 45 }}>S.No</th>
                    <th style={{ width: 95 }}>Team Code</th>
                    <th style={{ width: 115 }}>Polling Station</th>
                    <th style={{ width: 110 }}>Duty Mandal</th>
                    <th style={{ minWidth: 185, width: 200 }}>Presiding Officer (PO)</th>
                    <th style={{ minWidth: 185, width: 200 }}>Assistant Presiding Officer (APO)</th>
                    <th style={{ width: 80 }}>Batch</th>
                    <th style={{ minWidth: 185, width: 210 }}>Training Venue Place</th>
                    <th style={{ minWidth: 155, width: 165 }}>Date &amp; Time (Morning)</th>
                    <th style={{ width: 95 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTrainingRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="tr-empty" style={{ padding: "30px", textAlign: "center" }}>
                        {poApoTrainingRows.length === 0
                          ? "No training allocation generated yet. Verify the 4 prerequisites above and click 'Generate Training Allocation'."
                          : "No PO/APO training records match the search query."}
                      </td>
                    </tr>
                  ) : (
                    pagedTrainingRows.map((r, idx) => (
                      <tr key={`${r.teamCode}-${idx}`}>
                        <td className="tr-cell">{(safeTrainingPage - 1) * PAGE_SIZE + idx + 1}</td>
                        <td className="tr-cell p1-mono p3-teamcode-cell">{r.teamCode}</td>
                        <td className="tr-cell p1-strong">{r.pollingStation}</td>
                        <td className="tr-cell">{r.dutyMandal}</td>
                        <td className="tr-cell">
                          <div className="tr-officer-cell">
                            <span className="p1-strong tr-officer-name po-name">{r.poName}</span>
                            <span className="tr-sub-detail tr-nowrap">{r.poId} · {r.poDesignation}</span>
                            {r.poMobile && r.poMobile !== "—" && (
                              <span className="tr-sub-detail tr-nowrap">📱 {r.poMobile}</span>
                            )}
                          </div>
                        </td>
                        <td className="tr-cell">
                          <div className="tr-officer-cell">
                            <span className="p1-strong tr-officer-name apo-name">{r.apoName}</span>
                            <span className="tr-sub-detail tr-nowrap">{r.apoId} · {r.apoDesignation}</span>
                            {r.apoMobile && r.apoMobile !== "—" && (
                              <span className="tr-sub-detail tr-nowrap">📱 {r.apoMobile}</span>
                            )}
                          </div>
                        </td>
                        <td className="tr-cell">Batch {r.batchNo}</td>
                        <td className="tr-cell">
                          <span className="tr-venue-badge tr-venue-assigned">{r.trainingVenue}</span>
                        </td>
                        <td className="tr-cell">
                          <div><strong>{r.trainingDate}</strong></div>
                          <div style={{ fontSize: "11.5px", color: "#1e3a8a" }}>{r.trainingTime}</div>
                        </td>
                        <td className="tr-cell tr-status">{r.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {trainingCategory === "MO" && (
              <table className="tr-table">
                <thead>
                  <tr>
                    <th style={{ width: 45 }}>S.No</th>
                    <th style={{ width: 110 }}>Employee ID</th>
                    <th style={{ minWidth: 160 }}>Officer Name</th>
                    <th style={{ minWidth: 160 }}>Bank / Department</th>
                    <th style={{ width: 120 }}>Role</th>
                    <th style={{ width: 95 }}>Team Code</th>
                    <th style={{ width: 115 }}>Polling Station</th>
                    <th style={{ width: 110 }}>Duty Mandal</th>
                    <th style={{ width: 110 }}>Mobile</th>
                    <th style={{ minWidth: 190 }}>Training Venue Place (Separate)</th>
                    <th style={{ minWidth: 155, width: 165 }}>Date &amp; Time (Afternoon)</th>
                    <th style={{ width: 95 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTrainingRows.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="tr-empty" style={{ padding: "30px", textAlign: "center" }}>
                        {moTrainingRows.length === 0
                          ? "No Micro Observer training records generated yet. Click 'Generate Training Allocation'."
                          : "No Micro Observer training records match the search query."}
                      </td>
                    </tr>
                  ) : (
                    pagedTrainingRows.map((r, idx) => (
                      <tr key={`${r.employeeId}-${idx}`}>
                        <td className="tr-cell">{(safeTrainingPage - 1) * PAGE_SIZE + idx + 1}</td>
                        <td className="tr-cell p1-mono">{r.employeeId}</td>
                        <td className="tr-cell p1-strong">{r.employeeName}</td>
                        <td className="tr-cell">{r.department}</td>
                        <td className="tr-cell"><span className="tr-group-badge tr-group-mo">{r.role}</span></td>
                        <td className="tr-cell p1-mono p3-teamcode-cell">{r.teamCode}</td>
                        <td className="tr-cell">{r.pollingStation}</td>
                        <td className="tr-cell">{r.dutyMandal}</td>
                        <td className="tr-cell p1-mono">{r.mobile}</td>
                        <td className="tr-cell">
                          <span className="tr-venue-badge tr-venue-assigned" style={{ background: "#fef3c7", color: "#92400e", borderColor: "#fde68a" }}>
                            {r.trainingVenue}
                          </span>
                        </td>
                        <td className="tr-cell">
                          <div><strong>{r.trainingDate}</strong></div>
                          <div style={{ fontSize: "11.5px", color: "#92400e" }}>{r.trainingTime}</div>
                        </td>
                        <td className="tr-cell tr-status">{r.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>

          {trainingPageCount > 1 && (
            <div className="p1-pagination" style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="p1-page-info">
                Showing {(safeTrainingPage - 1) * PAGE_SIZE + 1} to {Math.min(safeTrainingPage * PAGE_SIZE, activeTrainingRows.length)} of {activeTrainingRows.length} records (Page {safeTrainingPage} of {trainingPageCount})
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  className="p1-page-btn"
                  onClick={() => setTrainingPage((p) => Math.max(1, p - 1))}
                  disabled={safeTrainingPage === 1}
                >
                  Previous
                </button>
                {Array.from({ length: trainingPageCount }, (_, i) => i + 1).map((p) => (
                  <button
                    key={`tr-page-${p}`}
                    type="button"
                    className={`p1-page-btn${p === safeTrainingPage ? " is-active" : ""}`}
                    onClick={() => setTrainingPage(p)}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  className="p1-page-btn"
                  onClick={() => setTrainingPage((p) => Math.min(trainingPageCount, p + 1))}
                  disabled={safeTrainingPage >= trainingPageCount}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>

        {/* 3. REMAINING VENUE PLACES SECTION (PRESENT BELOW THE ALLOCATED TRAINING SECTION) */}
        <section className="p1-card tr-remaining-venues-card" style={{ marginTop: 20, marginBottom: 16, border: "1px solid #fed7aa", background: "#fffaf5" }}>
          <div className="p1-card-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <span className="p1-card-title" style={{ color: "#c2410c" }}>
                Remaining / Available Venue Places ({remainingVenues.length})
              </span>
              <p className="p1-hint" style={{ margin: "4px 0 0", fontSize: 13, color: "#9a3412" }}>
                Venues that have not been allocated to training batches (showing 10 per page).
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                className={`tr-toggle-rem-btn ${showRemainingVenues ? "is-open" : ""}`}
                onClick={() => {
                  setShowRemainingVenues((v) => !v);
                  setRemainingVenuesPage(1);
                }}
                title="Toggle remaining venue places table"
              >
                {showRemainingVenues ? "Close Remaining Venues ✕" : `Show Remaining Venues (${remainingVenues.length})`}
              </button>
              <button
                type="button"
                className="p1-mini-btn"
                style={{ background: "#ea580c", color: "#fff", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6 }}
                onClick={downloadRemainingVenuesExcel}
                disabled={remainingVenues.length === 0}
              >
                <DownloadIcon /> Download Remaining Venues (Excel)
              </button>
            </div>
          </div>

          {showRemainingVenues && (
            <>
              <div className="tr-table-wrap" style={{ marginTop: 12 }}>
                <table className="tr-table">
                  <thead>
                    <tr>
                      <th style={{ width: 50 }}>S.No</th>
                      <th>Venue / Training Place</th>
                      <th style={{ width: 140 }}>Mandal</th>
                      <th style={{ width: 90 }}>Capacity</th>
                      <th>Contact Person</th>
                      <th style={{ width: 130 }}>Phone / Mobile</th>
                      <th style={{ width: 130 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRemVenues.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="tr-empty" style={{ textAlign: "center", padding: 20 }}>
                          No remaining venues available. All venues have been allocated.
                        </td>
                      </tr>
                    ) : (
                      pagedRemVenues.map((v, idx) => (
                        <tr key={`rem-venue-${v.id || idx}`}>
                          <td className="tr-cell p1-mono">{remVenueStartIdx + idx + 1}</td>
                          <td className="tr-cell p1-strong">{v.location_name || "—"}</td>
                          <td className="tr-cell">{v.mandal || "—"}</td>
                          <td className="tr-cell p1-mono">{v.capacity || 100}</td>
                          <td className="tr-cell">{v.contact_person || "—"}</td>
                          <td className="tr-cell p1-mono">{v.mobile || "—"}</td>
                          <td className="tr-cell">
                            <span className="p1-status p1-status-approved">Available</span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* 10 rows pagination */}
              {remVenueTotalPages > 1 && (
                <div className="p1-pagination" style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span className="p1-page-info">
                    Showing {remVenueStartIdx + 1} to {Math.min(remVenueStartIdx + VENUE_PAGE_SIZE, remainingVenues.length)} of {remainingVenues.length} remaining venues
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      className="p1-page-btn"
                      onClick={() => setRemainingVenuesPage((p) => Math.max(1, p - 1))}
                      disabled={safeRemVenuePage <= 1}
                    >
                      Previous
                    </button>
                    {Array.from({ length: remVenueTotalPages }, (_, i) => i + 1).map((p) => (
                      <button
                        key={`rem-v-p-${p}`}
                        type="button"
                        className={`p1-page-btn${p === safeRemVenuePage ? " is-active" : ""}`}
                        onClick={() => setRemainingVenuesPage(p)}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="p1-page-btn"
                      onClick={() => setRemainingVenuesPage((p) => Math.min(remVenueTotalPages, p + 1))}
                      disabled={safeRemVenuePage >= remVenueTotalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <WorkflowNavigation
          context={workflowContext}
          step="training"
          canContinue={poApoTrainingRows.length > 0}
          disabledReason="Generate training allocations before proceeding."
        />
      </main>
    </div>
  );
}