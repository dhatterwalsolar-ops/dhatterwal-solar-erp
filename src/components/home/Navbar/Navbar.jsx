import { useEffect, useRef, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ROUTES } from "../../../constants/routes";
import styles from "./Navbar.module.css";

const NAV_ITEMS = [
  { label: "Home", to: ROUTES.HOME, hash: "" },
  { label: "About Us", to: ROUTES.HOME, hash: "#why-choose" },
  { label: "Our Services", to: ROUTES.HOME, hash: "#services" },
  { label: "Products", to: ROUTES.HOME, hash: "#products" },
  { label: "Projects", to: ROUTES.HOME, hash: "#projects" },
  { label: "Why Solar?", to: ROUTES.HOME, hash: "#why-solar" },
  { label: "Contact Us", to: ROUTES.HOME, hash: "#consultation" },
  { label: "Service Query", to: ROUTES.PUBLIC_QUERY, hash: "" },
];

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const loginRef = useRef(null);

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    const handleClick = (event) => {
      if (loginRef.current && !loginRef.current.contains(event.target)) {
        setLoginOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return (
    <header className={styles.siteHeader}>
      <nav className={styles.navbar} aria-label="Primary">
        <div className={`container ${styles.inner}`}>
          <Link to={ROUTES.HOME} className={styles.brand} onClick={closeMenu}>
            <span className={styles.logoIcon} aria-hidden="true">
              <svg viewBox="0 0 48 48">
                <circle cx="24" cy="14" r="8" fill="#ffcc00" />
                <path d="M8 38h32l-4-14H12l-4 14z" fill="#006622" />
                <path d="M14 24h20v4H14z" fill="#004d00" />
              </svg>
            </span>
            <span className={styles.brandText}>
              <span className={styles.brandTitle}>DHATTERWAL SOLAR ENERGY SYSTEM</span>
              <span className={styles.brandSub}>POWERING YOUR FUTURE WITH CLEAN ENERGY</span>
            </span>
          </Link>

          <button
            type="button"
            className={`${styles.toggle} ${menuOpen ? styles.toggleActive : ""}`}
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="sr-only">Toggle menu</span>
            <span className={styles.toggleBar} />
            <span className={styles.toggleBar} />
            <span className={styles.toggleBar} />
          </button>

          <div
            id="primary-navigation"
            className={`${styles.panel} ${menuOpen ? styles.panelOpen : ""}`}
          >
            <ul className={styles.menu}>
              {NAV_ITEMS.map((item) => (
                <li key={item.label}>
                  <NavLink
                    to={`${item.to}${item.hash}`}
                    className={({ isActive }) =>
                      isActive && item.label === "Home" ? styles.menuActive : undefined
                    }
                    onClick={closeMenu}
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
            <div className={styles.actions}>
              <a href="#consultation" className={styles.quoteBtn} onClick={closeMenu}>
                <SendIcon />
                GET A QUOTE
              </a>
              <div className={styles.loginWrap} ref={loginRef}>
                <button
                  type="button"
                  className={styles.loginBtn}
                  aria-expanded={loginOpen}
                  onClick={(e) => {
                    e.stopPropagation();
                    setLoginOpen((open) => !open);
                  }}
                >
                  <LockIcon />
                  LOGIN
                  <span className={styles.caret} aria-hidden="true">
                    ▾
                  </span>
                </button>
                {loginOpen && (
                  <div className={styles.loginMenu}>
                    <Link to={ROUTES.LOGIN} className={styles.loginOption} onClick={closeMenu}>
                      <strong>Admin Login</strong>
                      <span>Full ERP access</span>
                    </Link>
                    <Link
                      to={`${ROUTES.LOGIN}?role=staff`}
                      className={styles.loginOption}
                      onClick={closeMenu}
                    >
                      <strong>Staff Login</strong>
                      <span>Operations & sales</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 11l18-8-8 18-2-7-8-3z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 10V8a5 5 0 0 1 10 0v2h1a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1zm2 0h6V8a3 3 0 0 0-6 0v2z" />
    </svg>
  );
}

export default Navbar;
