import "./landing.css";
import "./Municipal.css";
import Header from "../components/Header.jsx";
import WorkflowNavigation from "../components/WorkflowNavigation.jsx";

function ClipboardArt() {
  return (
    <svg className="phase-art" viewBox="0 0 140 140" aria-hidden="true">
      <rect x="40" y="34" width="62" height="84" rx="9" fill="#5a97db" />
      <rect x="47" y="44" width="48" height="66" rx="5" fill="#ffffff" />
      <rect x="58" y="26" width="26" height="14" rx="5" fill="#f2b134" />
      <rect x="64" y="20" width="14" height="9" rx="4" fill="#dd9a1c" />

      <g>
        <rect x="53" y="53" width="10" height="10" rx="2" fill="#2fae5e" />
        <path
          d="M55.5 58l2.2 2.2 4-4.6"
          stroke="#ffffff"
          strokeWidth="1.7"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="67" y="56" width="24" height="4" rx="2" fill="#c6d6ea" />

        <rect x="53" y="68" width="10" height="10" rx="2" fill="#2fae5e" />
        <path
          d="M55.5 73l2.2 2.2 4-4.6"
          stroke="#ffffff"
          strokeWidth="1.7"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="67" y="71" width="24" height="4" rx="2" fill="#c6d6ea" />

        <rect x="53" y="83" width="10" height="10" rx="2" fill="#2fae5e" />
        <path
          d="M55.5 88l2.2 2.2 4-4.6"
          stroke="#ffffff"
          strokeWidth="1.7"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="67" y="86" width="17" height="4" rx="2" fill="#c6d6ea" />
      </g>

      <circle cx="101" cy="105" r="15" fill="#28a95b" />
      <path
        d="M94 105.5l4.5 4.5 9-10"
        stroke="#ffffff"
        strokeWidth="3.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BallotBoxArt() {
  return (
    <svg className="phase-art" viewBox="0 0 140 140" aria-hidden="true">
      {/* box */}
      <path d="M38 80 L102 80 L107 124 L33 124 Z" fill="#2f9e5b" />
      <rect x="35" y="72" width="70" height="12" rx="4" fill="#278a50" />
      <rect x="56" y="75" width="30" height="6" rx="3" fill="#175c36" />
      <rect x="33" y="120" width="74" height="7" rx="3" fill="#24814a" />

      {/* ballot paper dropping into slot */}
      <g transform="rotate(-14 74 54)">
        <rect
          x="57"
          y="30"
          width="34"
          height="38"
          rx="3"
          fill="#ffffff"
          stroke="#cfd9e5"
          strokeWidth="1.5"
        />
        <path
          d="M64 41l3.6 3.6 7.4-8.4"
          stroke="#2f9e5b"
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="64" y="51" width="20" height="4" rx="2" fill="#c6d6ea" />
        <rect x="64" y="59" width="14" height="4" rx="2" fill="#c6d6ea" />
      </g>

      {/* arm with sleeve */}
      <g transform="rotate(32 108 34)">
        <rect x="98" y="20" width="44" height="20" rx="10" fill="#3b6fd0" />
      </g>

      {/* hand */}
      <path
        d="M82 30 q4 -10 14 -9 q11 1 12 9 q1 8 -8 11 q-12 4 -18 -11 z"
        fill="#f1b98d"
      />
      <path
        d="M85 27 q7 -6 16 -3"
        stroke="#dd9f74"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BallotListArt() {
  return (
    <svg className="phase-art" viewBox="0 0 140 140" aria-hidden="true">
      {/* ballot / EVM list */}
      <rect
        x="38"
        y="26"
        width="56"
        height="88"
        rx="6"
        fill="#ffffff"
        stroke="#e6d9c6"
        strokeWidth="2"
      />
      <rect x="38" y="26" width="56" height="14" rx="6" fill="#f6ede0" />

      <g>
        <circle cx="52" cy="52" r="6" fill="#ef8c24" />
        <rect x="62" y="49.5" width="24" height="5" rx="2.5" fill="#cfd9e5" />
        <circle cx="52" cy="68" r="6" fill="#3b6fd0" />
        <rect x="62" y="65.5" width="24" height="5" rx="2.5" fill="#cfd9e5" />
        <circle cx="52" cy="84" r="6" fill="#ef8c24" />
        <rect x="62" y="81.5" width="24" height="5" rx="2.5" fill="#cfd9e5" />
        <circle cx="52" cy="100" r="6" fill="#3b6fd0" />
        <rect x="62" y="97.5" width="18" height="5" rx="2.5" fill="#cfd9e5" />
      </g>

      {/* arm with sleeve */}
      <g transform="rotate(-28 116 104)">
        <rect x="104" y="94" width="42" height="20" rx="10" fill="#3b6fd0" />
      </g>

      {/* hand */}
      <path
        d="M84 92 q-6 8 0 15 q6 7 15 4 q10 -3 11 -12 q1 -9 -9 -12 q-10 -3 -17 5 z"
        fill="#f1b98d"
      />
      <path
        d="M86 96 q-4 6 1 12"
        stroke="#dd9f74"
        strokeWidth="2.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TrainingArt() {
  return (
    <svg className="phase-art" viewBox="0 0 150 140" aria-hidden="true">
      {/* presentation board */}
      <rect
        x="68"
        y="30"
        width="66"
        height="48"
        rx="5"
        fill="#ffffff"
        stroke="#7a54c0"
        strokeWidth="3"
      />
      <g fill="#c9b8ec">
        <rect x="77" y="40" width="36" height="5" rx="2.5" />
        <rect x="77" y="51" width="48" height="5" rx="2.5" />
        <rect x="77" y="62" width="28" height="5" rx="2.5" />
      </g>
      <path
        d="M80 78 l-7 22 M122 78 l7 22"
        stroke="#7a54c0"
        strokeWidth="3"
        strokeLinecap="round"
      />

      {/* presenter */}
      <rect x="34" y="96" width="9" height="24" rx="3" fill="#2f3a56" />
      <rect x="45" y="96" width="9" height="24" rx="3" fill="#3a4666" />
      <path d="M33 68 q13 -10 27 0 l3 30 h-33 z" fill="#6b45c4" />
      <path
        d="M57 70 l16 -9"
        stroke="#f1b98d"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <circle cx="47" cy="52" r="10" fill="#f1b98d" />
      <path
        d="M37 50 q2 -12 13 -11 q10 1 11 11 q-6 -5 -12 -4 q-7 1 -12 4 z"
        fill="#3a2f6b"
      />

      {/* audience */}
      <g>
        <rect x="70" y="112" width="24" height="16" rx="7" fill="#2f8f8a" />
        <circle cx="82" cy="104" r="8" fill="#f1b98d" />
        <path
          d="M74 102 q1 -9 9 -8 q8 1 8 8 q-4 -4 -9 -3 q-5 1 -8 3 z"
          fill="#2f2f3a"
        />
      </g>
      <g>
        <rect x="102" y="114" width="24" height="16" rx="7" fill="#3b6fd0" />
        <circle cx="114" cy="106" r="8" fill="#f1b98d" />
        <path
          d="M106 104 q1 -9 9 -8 q8 1 8 8 q-4 -4 -9 -3 q-5 1 -8 3 z"
          fill="#2f2f3a"
        />
      </g>
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 10h16" />
      <path d="M8 3v4M16 3v4" />
    </svg>
  );
}

const phases = [
  {
    id: "phase-1",
    badge: "1",
    title: "Phase 1",
    description:
      "validation of the employees weather they are eligible as volunteers to the elections",
    theme: "phase-blue",
    link: "/elections/municipal/phase-1",
    art: <ClipboardArt />,
  },
  {
    id: "phase-2",
    badge: "2",
    title: "Phase 2",
    description:
      "  partationing the employess as presiding, asst presiding and micro observer officers",
    theme: "phase-green",
    link: "/elections/municipal/phase-2",
    art: <BallotBoxArt />,
  },
  {
    id: "phase-3",
    badge: "3",
    title: "Phase 3",
    description: "alloocating the ballots to the  each team .",
    theme: "phase-orange",
    link: "/elections/municipal/phase-3",
    art: <BallotListArt />,
  },
  {
    id: "training",
    badgeIcon: <CalendarIcon />,
    title: "Training Schedule",
    description: "Training slots allocation for presiding officers and asst presiding officers.",
    theme: "phase-purple",
    link: "/elections/municipal/training",
    art: <TrainingArt />,
  },
];

function PhaseCard({ phase }) {
  const handleNav = (e) => {
    e.preventDefault();
    if (typeof window.navigateTo === "function") {
      window.navigateTo(phase.link);
    } else {
      window.history.pushState(null, "", phase.link);
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.scrollTo(0, 0);
    }
  };

  return (
    <article
      className={`phase-card ${phase.theme}`}
      onClick={handleNav}
      style={{ cursor: "pointer" }}
    >
      <div className="phase-visual">
        <span className="phase-disc">
          <span className="phase-badge">{phase.badgeIcon ?? phase.badge}</span>
          {phase.art}
        </span>
      </div>

      <h3>{phase.title}</h3>

      <p>{phase.description}</p>

      <a
        className="phase-cta"
        href={phase.link}
        onClick={handleNav}
        aria-label={`View details for ${phase.title}`}
      >
        Explore
        <span className="phase-arrow" aria-hidden="true">
          →
        </span>
      </a>

      <svg
        className="card-wave"
        viewBox="0 0 300 70"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 38 C60 12 120 62 180 36 S280 22 300 44 L300 70 L0 70 Z"
          fill="currentColor"
          opacity="0.4"
        />
        <path
          d="M0 56 C70 32 150 74 230 50 S290 46 300 60 L300 70 L0 70 Z"
          fill="currentColor"
          opacity="0.55"
        />
      </svg>
    </article>
  );
}

function Municipal() {
  return (
    <main className="municipal-page">
      <div className="page-overlay" />

      <Header />

      <section className="municipal-hero">
        <div className="hero-aurora" aria-hidden="true">
          <span className="orb orb-1" />
          <span className="orb orb-2" />
          <span className="orb orb-3" />
        </div>

        <div className="hero-copy">
          <p className="hero-kicker">
            <svg
              className="kicker-icon"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 2l2.9 6.26L21.5 9.2l-4.75 4.36L18.2 20.5 12 16.9 5.8 20.5l1.45-6.94L2.5 9.2l6.6-.94z" />
            </svg>
            Municipal Elections
          </p>

          <h2>District Election Commission management</h2>

          <p className="hero-tagline">
            <span>Stay informed</span>
            <i className="sep" />
            <span>Be prepared</span>
            <i className="sep" />
            <span>Build a better city</span>
          </p>

          <ul className="hero-highlights">
            <li>3 Polling Phases</li>
            <li>Staff Training</li>
            <li>Transparent Process</li>
          </ul>
        </div>
      </section>

      <section className="phases-section">
        <div className="phases-head">
          <span className="phases-eyebrow">The Election Process</span>
        </div>
        {phases.map((phase) => (
          <PhaseCard key={phase.id} phase={phase} />
        ))}
      </section>

      <WorkflowNavigation context="municipal" step="overview" />

      <div className="municipal-motto">
        <span className="rule" />
        <p>
          Vote <b>•</b> Participate <b>•</b> Strengthen Democracy
        </p>
        <span className="rule" />
      </div>
    </main>
  );
}

export default Municipal;
