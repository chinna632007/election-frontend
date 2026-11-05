import "./WorkflowNavigation.css";

function routesForContext(context) {
  const base = context === "panchayat" ? "/elections/panchayat" : "/elections/municipal";
  return [
    { step: "overview", href: base, label: "Election Overview" },
    { step: "phase1", href: `${base}/phase-1`, label: "Phase 1 – Employee Validation" },
    { step: "phase2", href: `${base}/phase-2`, label: "Phase 2 – Team Formation" },
    { step: "phase3", href: `${base}/phase-3`, label: "Phase 3 – Ballot Allocation" },
    { step: "training", href: `${base}/training`, label: "Training Schedule" },
  ];
}

function Arrow({ direction }) {
  return direction === "left" ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export default function WorkflowNavigation({
  context,
  step,
  canContinue = true,
  disabledReason = "Complete the current phase before continuing.",
}) {
  const steps = routesForContext(context);
  const index = steps.findIndex((route) => route.step === step);
  const previous = steps[index - 1];
  const next = steps[index + 1];
  const reasonId = `workflow-navigation-reason-${step}`;

  if (index < 0) return null;

  const onNav = (targetUrl) => (e) => {
    e.preventDefault();
    if (typeof window.navigateTo === "function") {
      window.navigateTo(targetUrl);
    } else {
      window.location.href = targetUrl;
    }
  };

  return (
    <nav className="workflow-navigation" aria-label="Election workflow navigation">
      <a
        className="workflow-navigation__control workflow-navigation__back"
        href={previous?.href || "/home"}
        onClick={onNav(previous?.href || "/home")}
      >
        <Arrow direction="left" />
        <span>{`Back to ${previous?.label || "Election Portal"}`}</span>
      </a>

      {next ? (
        <div className="workflow-navigation__next">
          {canContinue ? (
            <a
              className="workflow-navigation__control workflow-navigation__continue"
              href={next.href}
              onClick={onNav(next.href)}
            >
              <span>{`Continue to ${next.label}`}</span>
              <Arrow direction="right" />
            </a>
          ) : (
            <>
              <a
                className="workflow-navigation__control workflow-navigation__continue workflow-navigation__continue--soft"
                href={next.href}
                onClick={onNav(next.href)}
                title={disabledReason}
              >
                <span>{`Proceed to ${next.label}`}</span>
                <Arrow direction="right" />
              </a>
              <span className="workflow-navigation__reason" id={reasonId}>
                {disabledReason}
              </span>
            </>
          )}
        </div>
      ) : (
        <div className="workflow-navigation__next">
          <button
            className="workflow-navigation__control workflow-navigation__continue"
            type="button"
            aria-disabled="true"
            aria-label="Continue unavailable. Training is the final workflow page."
            onClick={(event) => event.preventDefault()}
          >
            <span>Workflow complete</span>
          </button>
          <span className="workflow-navigation__reason" role="status">
            Training is the final workflow step.
          </span>
        </div>
      )}
    </nav>
  );
}