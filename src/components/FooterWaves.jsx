function FooterWaves() {
  return (
    <footer className="page-footer" aria-hidden="true">
      <svg
        className="footer-wave footer-wave--left"
        viewBox="0 0 390 160"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient
            id="leftSweepFade"
            x1="0"
            y1="0"
            x2="390"
            y2="0"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0.5" stopColor="#178a4c" stopOpacity="1" />
            <stop offset="1" stopColor="#178a4c" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M-8 33C130 50 260 95 385 172"
          stroke="#f0993a"
          strokeWidth="30"
          fill="none"
        />
        <path
          d="M-8 68C125 85 245 130 355 178"
          stroke="#ffffff"
          strokeWidth="30"
          fill="none"
        />
        <path
          d="M-8 103C120 120 230 160 320 195"
          stroke="#178a4c"
          strokeWidth="30"
          fill="none"
        />
        <path
          d="M-8 145C110 160 260 166 398 172"
          stroke="url(#leftSweepFade)"
          strokeWidth="30"
          fill="none"
        />
      </svg>

      <svg
        className="footer-wave footer-wave--right"
        viewBox="0 0 560 200"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M565 29C470 95 150 155 60 215"
          stroke="#f0993a"
          strokeWidth="10"
          fill="none"
        />
        <path
          d="M565 74C470 140 150 200 60 260"
          stroke="#f0993a"
          strokeWidth="36"
          fill="none"
        />
        <path
          d="M565 119C470 185 150 245 60 305"
          stroke="#ffffff"
          strokeWidth="36"
          fill="none"
        />
        <path
          d="M565 164C470 230 150 290 60 350"
          stroke="#178a4c"
          strokeWidth="36"
          fill="none"
        />
      </svg>
    </footer>
  );
}

export default FooterWaves;