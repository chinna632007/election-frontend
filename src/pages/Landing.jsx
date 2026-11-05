
import "./landing.css";
import Header from "../components/Header.jsx";
import FooterWaves from "../components/FooterWaves.jsx";
const elections = [
  {
    id: "municipal",
    title: "Municipal Elections",
    description:
      "Elections to Municipal Corporations, Municipalities and Nagar Panchayats in Kakinada District",
    image: "/images/municipal.png",
    theme: "municipal",
    link: "/elections/municipal",
  },
  {
    id: "panchayat",
    title: "Panchayat Elections",
    description:
      "Elections to Zilla Parishads, Mandal Parishads and Gram Panchayats in Kakinada District",
    image: "/images/panchayat.png",
    theme: "panchayat",
    link: "/elections/panchayat",
  },
];

function ElectionCard({ election }) {
  const onNav = (e) => {
    e.preventDefault();
    if (typeof window.navigateTo === "function") {
      window.navigateTo(election.link);
    } else {
      window.location.href = election.link;
    }
  };

  return (
    <article
      className={`election-card ${election.theme}`}
      onClick={onNav}
      style={{ cursor: "pointer" }}
    >
      <div className="illustration">
        <img src={election.image} alt={election.title} />
      </div>

      <h2>{election.title}</h2>

      <p>{election.description}</p>

      <a className="details-btn" href={election.link} onClick={onNav}>
        View Details
        <span>→</span>
      </a>
    </article>
  );
}

function Landing() {
  return (
    <main className="landing-page">
      <div className="page-overlay" />

      <Header />

      <section className="welcome-section">
        <h1>
          <span>Welcome to</span>
          District Election Commission
        </h1>

        <h2>Kakinada District</h2>

        <div className="tagline">
          <span className="line" />
          <p>
            Free Fair and Transparent Elections for a Stronger Democracy
          </p>
          <span className="line" />
        </div>
      </section>

      <section className="election-section">
        {elections.map((election) => (
          <ElectionCard
            key={election.id}
            election={election}
          />
        ))}
      </section>

      <FooterWaves />
    </main>
  );
}

export default Landing;