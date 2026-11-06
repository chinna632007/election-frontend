import { useState, useEffect } from "react";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Municipal from "./pages/Municipal.jsx";
import Phase1 from "./pages/Phase1.jsx";
import Phase2 from "./pages/Phase2.jsx";
import Phase3 from "./pages/Phase3.jsx";
import Training from "./pages/Training.jsx";
import Settings from "./pages/Settings.jsx";
import Fields from "./pages/Fields.jsx";
import { routeListeners, navigateTo } from "./utils/navigation.js";

function App() {
  const [path, setPath] = useState(() => (typeof window !== "undefined" ? window.location.pathname : "/"));

  useEffect(() => {
    const handleLocationChange = (next) => {
      const p = typeof next === "string" ? next : window.location.pathname;
      setPath(p);
    };

    routeListeners.add(handleLocationChange);
    const onPopState = () => handleLocationChange(window.location.pathname);
    window.addEventListener("popstate", onPopState);

    const handleDocumentClick = (e) => {
      const anchor = e.target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (
        href &&
        href.startsWith("/") &&
        !href.startsWith("//") &&
        !anchor.getAttribute("target") &&
        !anchor.hasAttribute("download") &&
        e.button === 0 &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        e.preventDefault();
        navigateTo(href);
      }
    };

    document.addEventListener("click", handleDocumentClick);

    return () => {
      routeListeners.delete(handleLocationChange);
      window.removeEventListener("popstate", onPopState);
      document.removeEventListener("click", handleDocumentClick);
    };
  }, []);

  // Phase 1 – Excel eligible-list upload (dedicated page, shared by both types)
  if (path.startsWith("/elections/municipal/phase-1")) {
    return <Phase1 context="municipal" />;
  }
  if (path.startsWith("/elections/panchayat/phase-1")) {
    return <Phase1 context="panchayat" />;
  }

  // Phase 2 – Officer ranking & assignment (Presiding / Polling split)
  if (path.startsWith("/elections/municipal/phase-2")) {
    return <Phase2 context="municipal" />;
  }
  if (path.startsWith("/elections/panchayat/phase-2")) {
    return <Phase2 context="panchayat" />;
  }

  // Phase 3 – Ballot allocation (backend-driven)
  if (path.startsWith("/elections/municipal/phase-3")) {
    return <Phase3 context="municipal" />;
  }
  if (path.startsWith("/elections/panchayat/phase-3")) {
    return <Phase3 context="panchayat" />;
  }

  // Training – Time Scheduling (slot allocation, teams fetched from Phase 3)
  if (path.startsWith("/elections/municipal/training")) {
    return <Training context="municipal" />;
  }
  if (path.startsWith("/elections/panchayat/training")) {
    return <Training context="panchayat" />;
  }

  // Fields — Data schema customization (admin knobs, no code changes)
  if (path.startsWith("/elections/municipal/fields")) {
    const entity = path.endsWith("/personnel") ? "personnel" : "station";
    return <Fields entity={entity} />;
  }
  if (path.startsWith("/elections/panchayat/fields")) {
    const entity = path.endsWith("/personnel") ? "personnel" : "station";
    return <Fields entity={entity} />;
  }

  // Settings — Customization Center (admin knobs, no code changes)
  if (path.startsWith("/elections/municipal/settings")) {
    return <Settings />;
  }
  if (path.startsWith("/elections/panchayat/settings")) {
    return <Settings />;
  }

  // Municipal elections pages
  if (path.startsWith("/elections/municipal") || path.startsWith("/elections/panchayat")) {
    return <Municipal />;
  }

  // Direct shortcut / fallback routes (defaulting to municipal context)
  if (path.startsWith("/phase-1")) {
    return <Phase1 context="municipal" />;
  }
  if (path.startsWith("/phase-2")) {
    return <Phase2 context="municipal" />;
  }
  if (path.startsWith("/phase-3")) {
    return <Phase3 context="municipal" />;
  }
  if (path.startsWith("/training")) {
    return <Training context="municipal" />;
  }

  // Public landing page (/home or root /)
  if (path.startsWith("/home") || path === "/") {
    return <Landing />;
  }

  // Login page
  if (path.startsWith("/login")) {
    return <Login />;
  }

  // Default fallback: Landing page
  return <Landing />;
}

export default App;

