import { useState } from "react";
import "./landing.css";
import "./Login.css";
import Header from "../components/Header.jsx";
import FooterWaves from "../components/FooterWaves.jsx";
import CaptchaImage from "../components/CaptchaImage.jsx";
import { useAuth } from "../api/auth-context.js";



function PersonIcon() {
  return (
    <svg
      className="field-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20c1.4-3.2 4.2-5 7.5-5s6.1 1.8 7.5 5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      className="field-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function EyeIcon({ hidden }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {hidden ? (
        <>
          <path d="M3 3l18 18" />
          <path d="M10.6 5.1A9.8 9.8 0 0 1 12 5c5.5 0 9 5.5 9 7a12.9 12.9 0 0 1-2.4 3.4" />
          <path d="M6.4 6.9C3.9 8.6 3 10.8 3 12c0 1.5 3.5 7 9 7a9.9 9.9 0 0 0 4.6-1.1" />
          <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
        </>
      ) : (
        <>
          <path d="M3 12c0-1.5 3.5-7 9-7s9 5.5 9 7-3.5 7-9 7-9-5.5-9-7z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captcha, setCaptcha] = useState("");
  const [captchaNonce, setCaptchaNonce] = useState(0); // bump to reload the SVG
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (!username.trim() || !password || !captcha.trim()) {
      setError("Username, password and captcha are required.");
      return;
    }

    setLoading(true);
    try {
      await login({
        username: username.trim(),
        password,
        captcha: captcha.trim(),
      });
      try {
        if (typeof sessionStorage !== "undefined") sessionStorage.clear();
      } catch {}
      const returnTo = new URLSearchParams(window.location.search).get("returnTo");
      const destination = returnTo && returnTo.startsWith("/elections/") && !returnTo.startsWith("//")
        ? returnTo
        : "/home";
      window.location.assign(destination);
    } catch (err) {
      setLoading(false);
      setError(err?.message || "Login failed. Please try again.");
      // The backend consumes one captcha per attempt — fetch a fresh one.
      setCaptcha("");
      setCaptchaNonce((n) => n + 1);
    }
  }

  return (
    <main className="login-page">
      <div className="page-overlay" />

      <Header />

      <section className="login-main">
        <form className="login-card" onSubmit={handleSubmit}>
          <h1>Login to Portal</h1>

          <p className="login-subtitle">
            Access the District Election Commission Portal
          </p>

          <label className="field">
            <PersonIcon />
            <input
              type="text"
              name="username"
              placeholder="Enter Username / ID"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>

          <label className="field">
            <LockIcon />
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Enter Password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowPassword((shown) => !shown)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              <EyeIcon hidden={!showPassword} />
            </button>
          </label>
         <br />

          <CaptchaImage key={captchaNonce} onError={setError} />

          <label className="field">
            <input
              type="text"
              name="captcha"
              placeholder="Enter the above captcha"
              autoComplete="off"
              value={captcha}
              onChange={(event) => setCaptcha(event.target.value)}
              required
            />
          </label>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="login-submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="login-spinner" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              <>
                Login
                <span>→</span>
              </>
            )}
          </button>

          <p className="login-secured">
            Secured by{" "}
            <strong>Andhra Pradesh State Election Commission</strong>
          </p>
        </form>
      </section>

      <FooterWaves />
    </main>
  );
}

export default Login;
