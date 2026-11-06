import { useState, useEffect } from "react";
import { useAuth } from "../api/auth-context.js";
import "./Header.css";

/**
 * Shared site Header — used on every page (Home, Login, Municipal,
 * Panchayat, Phase 1, ...) so the top bar is identical everywhere.
 * Styling lives in landing.css (.header, .brand, .login-btn, ...) and Header.css.
 *
 * Auth is driven by the AuthProvider (see api/AuthProvider.jsx): on mount it
 * verifies the session against GET /api/auth/me. When a user is signed in the
 * Login button is replaced by a signed-in chip plus a Logout action.
 */
function Header() {
  const { user, status, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (!showLogoutConfirm) return;
    function handleKeyDown(e) {
      if (e.key === "Escape" && !isLoggingOut) {
        setShowLogoutConfirm(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showLogoutConfirm, isLoggingOut]);

  async function handleConfirmLogout() {
    setIsLoggingOut(true);
    try {
      try {
        if (typeof sessionStorage !== "undefined") sessionStorage.clear();
      } catch {}
      await logout();
    } finally {
      window.location.assign("/login");
    }
  }

  const displayName = user?.username || "User";
  const signedIn = status === "authenticated" && Boolean(user);

  return (
    <>
      <header className="header">
        <a href="/home" className="brand" style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}>
          <img
            className="emblem"
            src="/assets/ap-logo.svg"
            alt="Election Commission emblem"
          />

          <div className="brand-info">
            <h2>District Election Commission</h2>
           
            <p>Andhra Pradesh State Election Commission</p>
          </div>
        </a>

        <div className="header-actions">
          {signedIn ? (
            <>
              <span className="user-chip" title={`Signed in as ${displayName}`}>
                <svg
                  className="user-avatar"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
                </svg>
                {displayName}
              </span>
              <button
                type="button"
                className="login-btn header-logout"
                onClick={() => setShowLogoutConfirm(true)}
                aria-haspopup="dialog"
                title="Logout"
              >
                <span className="lock-icon" aria-hidden="true">
                  ⏻
                </span>
                Logout
              </button>
            </>
          ) : (
            <a href="/login" className="login-btn">
              <span className="lock-icon">🔒</span>
              Login
            </a>
          )}

          <div className="district-info">
            <img
              className="district-map"
              src="/assets/district-map.png"
              alt="Map of Kakinada district"
            />
            <strong>
             Andhra Pradesh
            </strong>
          </div>
        </div>
      </header>

      {/* Logout confirmation dialog */}
      {showLogoutConfirm && (
        <div
          className="logout-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-modal-title"
          onClick={() => !isLoggingOut && setShowLogoutConfirm(false)}
        >
          <div
            className="logout-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="logout-modal-icon-wrap" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="logout-modal-icon"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </div>

            <h3 id="logout-modal-title" className="logout-modal-title">
              Confirm Logout
            </h3>

            <p className="logout-modal-message">
              Are you sure you want to log out of the District Election Commission portal?
            </p>

            <div className="logout-modal-actions">
              <button
                type="button"
                className="logout-modal-cancel"
                disabled={isLoggingOut}
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="logout-modal-confirm"
                disabled={isLoggingOut}
                onClick={handleConfirmLogout}
              >
                {isLoggingOut ? "Logging out…" : "Yes, Logout"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default Header;
