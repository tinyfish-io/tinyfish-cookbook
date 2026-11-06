import { Link, NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "About", short: "About", end: true },
  { to: "/analyze", label: "Analyze Claim", short: "Analyze" },
  { to: "/community", label: "Community Fact-Checks", short: "Community" },
];

export default function Navbar() {
  return (
    <header className="navbar">
      <nav className="navbar-pill" aria-label="Main navigation">
        <Link to="/" className="navbar-brand" aria-label="TruthLens home">
          {/* Replace frontend/public/logo.svg with your own logo (same file name). */}
          <img src="/logo.svg" alt="" />
          <span>TruthLens</span>
        </Link>
        <span className="navbar-divider" aria-hidden="true" />

        {links.map(({ to, label, short, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => (isActive ? "navbar-link active" : "navbar-link")}
          >
            <span className="label-full">{label}</span>
            <span className="label-short">{short}</span>
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
