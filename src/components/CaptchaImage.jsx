import { useCallback, useEffect, useState } from "react";
import { getCaptcha } from "../api/client.js";

/**
 * Renders the backend SVG captcha (GET /api/auth/captcha) and offers a reload
 * button. The actual answer is typed by the user in Login.jsx; the backend
 * consumes one captcha per login attempt, so Login reloads this (by changing
 * its `key`) after every failed attempt.
 *
 * State updates happen inside promise continuations rather than synchronously
 * in the effect, so the initial fetch doesn't trigger a cascading render.
 */
export default function CaptchaImage({ onError }) {
  const [svg, setSvg] = useState("");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    return getCaptcha()
      .then((text) => setSvg(text))
      .catch((err) => {
        setSvg("");
        onError?.(err?.message || "Failed to load captcha. Please refresh.");
      })
      .finally(() => setLoading(false));
  }, [onError]);

  useEffect(() => {
    reload();
  }, [reload]);

  function handleReload() {
    setLoading(true);
    reload();
  }

  return (
    <div className="captcha-image">
      <div className="captcha-image-box" aria-label="Captcha image" role="img">
        {loading ? (
          <span className="captcha-image-loading">Loading…</span>
        ) : (
          <div
            className="captcha-image-svg"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        )}
      </div>
      <button
        type="button"
        className="captcha-image-refresh"
        onClick={handleReload}
        aria-label="Reload captcha"
        title="Reload captcha"
      >
        ⟳
      </button>
    </div>
  );
}
