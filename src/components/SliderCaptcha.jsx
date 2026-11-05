import { useRef, useState } from "react";

const HANDLE = 46; // keep in sync with .captcha-handle width in Login.css
const THRESHOLD = 0.9; // drag >= this fraction of the track to verify

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12h13" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

function SliderCaptcha({ onChange }) {
  const trackRef = useRef(null);
  const handleRef = useRef(null);
  const drag = useRef({ startX: 0, startPos: 0, max: 0 });
  const posRef = useRef(0);

  const [pos, setPos] = useState(0);
  const [max, setMax] = useState(0);
  const [verified, setVerified] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [fail, setFail] = useState(false);

  function updatePos(value) {
    posRef.current = value;
    setPos(value);
  }

  function emit(value) {
    setVerified(value);
    if (onChange) onChange(value);
  }

  function handlePointerDown(event) {
    if (verified) return;
    const track = trackRef.current;
    const handle = handleRef.current;
    if (!track || !handle) return;

    const maxPos = Math.max(0, track.clientWidth - HANDLE);
    drag.current = { startX: event.clientX, startPos: posRef.current, max: maxPos };
    setMax(maxPos);
    setDragging(true);
    setFail(false);

    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      /* pointer capture unsupported — fall back to window listeners below */
    }
  }

  function handlePointerMove(event) {
    if (!dragging || verified) return;
    const { startX, startPos, max: maxPos } = drag.current;
    const next = Math.min(maxPos, Math.max(0, startPos + (event.clientX - startX)));
    updatePos(next);
  }

  function finish() {
    if (!dragging || verified) return;
    setDragging(false);
    const { max: maxPos } = drag.current;
    const reached = maxPos > 0 && posRef.current >= maxPos * THRESHOLD;

    if (reached) {
      updatePos(maxPos);
      emit(true);
    } else {
      updatePos(0);
      setFail(true);
      emit(false);
      window.setTimeout(() => setFail(false), 500);
    }
  }

  function reset() {
    updatePos(0);
    setVerified(false);
    setDragging(false);
    setFail(false);
    if (onChange) onChange(false);
  }

  function handleKeyDown(event) {
    if (verified) return;
    const step = Math.max(12, (max || 200) / 12);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const next = Math.min(max || step, posRef.current + step);
      updatePos(next);
      if ((max || step) > 0 && next >= (max || step) * THRESHOLD) {
        updatePos(max || step);
        emit(true);
      }
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      updatePos(Math.max(0, posRef.current - step));
    }
  }

  const fillWidth = `calc(${pos}px + ${HANDLE}px)`;

  return (
    <div
      className={`captcha${verified ? " is-verified" : ""}${
        fail ? " is-fail" : ""
      }${dragging ? " is-dragging" : ""}`}
    >
      <div className="captcha-track" ref={trackRef}>
        <div className="captcha-fill" style={{ width: fillWidth }} />

        <span className="captcha-hint">
          {verified ? "Verified" : "Slide to verify"}
        </span>

        <button
          type="button"
          ref={handleRef}
          className="captcha-handle"
          style={{ transform: `translateX(${pos}px)` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finish}
          onPointerCancel={finish}
          onKeyDown={handleKeyDown}
          disabled={verified}
          role="slider"
          aria-label="Slide to verify you are human"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={max > 0 ? Math.round((pos / max) * 100) : 0}
          aria-disabled={verified}
        >
          {verified ? <CheckIcon /> : <ArrowIcon />}
        </button>
      </div>

      <button
        type="button"
        className="captcha-reset"
        onClick={reset}
        aria-label="Reset verification"
      >
        <RefreshIcon />
      </button>
    </div>
  );
}

export default SliderCaptcha;
