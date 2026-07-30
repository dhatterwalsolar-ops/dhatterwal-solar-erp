import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ErpIcon } from "../components/erp/ErpIcon";
import { getPageTitleByPath } from "../constants/erpMenu";
import { CONTACT } from "../constants/contact";
import { ROUTES } from "../constants/routes";
import { clearAuthSession, getAuthSession } from "../utils/authSession";
import {
  getApiToken,
  hydrateFromServer,
  isHydrated,
  logoutCloud,
  startPolling,
} from "../utils/erpStorage";
import { getErpMenuForSession, isAdminSession } from "../utils/erpAccess";
import styles from "./DashboardLayout.module.css";

function formatToday() {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  }).format(new Date());
}

function DashboardLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const session = getAuthSession();
  const pageTitle = getPageTitleByPath(pathname);
  const navItems = getErpMenuForSession(session);
  const displayName = session?.displayName ?? "User";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const [syncReady, setSyncReady] = useState(() => isHydrated());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!session) return;
      if (!getApiToken()) {
        navigate(ROUTES.LOGIN, { replace: true });
        return;
      }
      if (!isHydrated()) {
        try {
          await hydrateFromServer({ uploadLocalIfEmpty: false });
        } catch {
          if (!cancelled) {
            logoutCloud();
            clearAuthSession();
            navigate(ROUTES.LOGIN, { replace: true });
          }
          return;
        }
      } else {
        startPolling();
      }
      if (!cancelled) setSyncReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [session, navigate]);

  const handleLogout = () => {
    logoutCloud();
    clearAuthSession();
    navigate(ROUTES.LOGIN, { replace: true });
  };

  if (!syncReady) {
    return (
      <div className={styles.shell} style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <p>Shared ERP sync ho raha hai…</p>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <NavLink to={ROUTES.DASHBOARD} className={styles.logoBlock} title="Back to Dashboard">
          <span className={styles.logoIcon} aria-hidden="true">
            <svg viewBox="0 0 48 48">
              <circle cx="24" cy="14" r="8" fill="#ffcc00" />
              <path d="M8 38h32l-4-14H12l-4 14z" fill="#3d8bfd" />
              <path d="M14 24h20v4H14z" fill="#ffffff" opacity="0.9" />
            </svg>
          </span>
          <div>
            <p className={styles.logoTitle}>DHATTERWAL</p>
            <p className={styles.logoSub}>SOLAR ENERGY SYSTEM</p>
          </div>
        </NavLink>

        <nav className={styles.nav} aria-label="ERP sheets">
          {navItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.path}
              end={item.key !== "labour" && item.key !== "payment" && item.key !== "reports"}
              className={({ isActive }) =>
                isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
              }
            >
              <span className={styles.navIcon}>
                <ErpIcon name={item.icon} />
              </span>
              <span className={styles.navLabel}>{item.label}</span>
              {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
            </NavLink>
          ))}
        </nav>

        <div className={styles.sidebarBottom}>
          {isAdminSession(session) ? (
            <NavLink
              to={ROUTES.SETTINGS}
              className={({ isActive }) =>
                isActive ? `${styles.settingsLink} ${styles.navLinkActive}` : styles.settingsLink
              }
            >
              <span className={styles.navIcon}>
                <ErpIcon name="settings" />
              </span>
              Settings
            </NavLink>
          ) : null}

          <div className={styles.supportCard}>
            <span className={styles.supportIcon}>
              <ErpIcon name="support" />
            </span>
            <div>
              <p>Support</p>
              <a href={`tel:${CONTACT.primaryTel}`}>{CONTACT.primaryDisplay}</a>
            </div>
          </div>
        </div>
      </aside>

      <div className={styles.mainWrap}>
        <header className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <button type="button" className={styles.menuBtn} aria-label="Menu">
              <span />
              <span />
              <span />
            </button>
            <div>
              <p className={styles.pageTitle}>{pageTitle}</p>
              <p className={styles.welcome}>Welcome, {displayName} · Shared ERP</p>
            </div>
          </div>

          <div className={styles.topbarRight}>
            <div className={styles.dateCard}>
              <span aria-hidden="true">📅</span>
              {formatToday()}
            </div>
            <button type="button" className={styles.notifBtn} aria-label="Notifications">
              🔔
              <span className={styles.notifBadge}>5</span>
            </button>
            <div className={styles.profile}>
              <span className={styles.avatar}>{initials}</span>
              <div>
                <p>{displayName}</p>
                <small>{session?.roleLabel ?? "User"}</small>
              </div>
            </div>
            <button type="button" className={styles.logoutBtn} onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <main className={styles.main}>
          <Outlet />
        </main>

        <footer className={styles.footer}>
          <p>© {new Date().getFullYear()} Dhatterwal Solar Energy System ERP. All Rights Reserved.</p>
          <p>Shared live ERP — same data on every PC</p>
        </footer>
      </div>
    </div>
  );
}

export default DashboardLayout;
