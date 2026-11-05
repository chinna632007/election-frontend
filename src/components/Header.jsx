import { useAuth } from "../api/auth-context.js";

/**
 * Shared site Header — used on every page (Home, Login, Municipal,
 * Panchayat, Phase 1, ...) so the top bar is identical everywhere.
 * Styling lives in landing.css (.header, .brand, .login-btn, ...).
 *
 * Auth is driven by the AuthProvider (see api/AuthProvider.jsx): on mount it
 * verifies the session against GET /api/auth/me. When a user is signed in the
 * Login button is replaced by a signed-in chip plus a Logout action.
 */
function Header() {
  const { user, status, logout } = useAuth();

  async function handleLogout() {
    try {
      await logout();
    } finally {
      window.location.assign("/login");
    }
  }

  const displayName = user?.username || "User";
  const signedIn = status === "authenticated" && Boolean(user);

  return (
    <header className="header">
      <a href="/home" className="brand" style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}>
        <img
          className="emblem"
          src="/assets/ap-logo.svg"
          alt="Election Commission emblem"
        />

        <div className="brand-info">
          <h2>District Election Commission</h2>
          <h3>Kakinada District</h3>
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
              onClick={handleLogout}
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
            Kakinada
            <br />
            District
          </strong>
        </div>
      </div>
    </header>
  );
}

export default Header;

