import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AUTH_ROLES, IDLE_LOGOUT_FLAG_KEY } from "../../constants/auth";
import { COMPANY_MD_LABEL, COMPANY_MD_NAME, CONTACT } from "../../constants/contact";
import { ROUTES } from "../../constants/routes";
import { setAuthSession } from "../../utils/authSession";
import { loadLoginUsers } from "../../utils/erpLoginUsers";
import { getApiBase, hydrateFromServer, loginToApi } from "../../utils/erpStorage";
import { purgeDemoCaseDataOnce } from "../../utils/purgeDemoCaseData";
import styles from "./LoginPage.module.css";

function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRole =
    searchParams.get("role") === AUTH_ROLES.STAFF ? AUTH_ROLES.STAFF : AUTH_ROLES.ADMIN;

  const [role, setRole] = useState(initialRole);
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const roleMeta = useMemo(
    () => ({
      [AUTH_ROLES.ADMIN]: {
        title: "Admin Login",
        subtitle: "Full ERP access — reports, settings, approvals",
      },
      [AUTH_ROLES.STAFF]: {
        title: "Staff Login",
        subtitle: "Sales, customers, stock & daily operations",
      },
    }),
    [],
  );

  useEffect(() => {
    setRole(initialRole);
  }, [initialRole]);

  useEffect(() => {
    setUserId("");
    setPassword("");
    setError("");
  }, [role]);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(IDLE_LOGOUT_FLAG_KEY) === "1") {
        sessionStorage.removeItem(IDLE_LOGOUT_FLAG_KEY);
        setError("10 minute tak koi activity nahi mili — aap automatic logout ho gaye. Phir se login karein.");
      }
    } catch {
      /* ignore */
    }
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!getApiBase()) {
        throw new Error("API URL missing. VITE_API_URL set karein.");
      }
      const user = await loginToApi({
        userId: userId.trim(),
        password,
        role,
      });
      await hydrateFromServer({ uploadLocalIfEmpty: false });
      purgeDemoCaseDataOnce();
      loadLoginUsers();
      setAuthSession({
        role: user.role,
        roleLabel: user.roleLabel,
        displayName: user.displayName,
        userId: user.userId,
        accessProfile: user.accessProfile || "",
        remember,
        loggedInAt: new Date().toISOString(),
        cloud: true,
      });
      navigate(ROUTES.DASHBOARD, { replace: true });
    } catch (err) {
      const msg = String(err?.message || "");
      setError(
        msg ||
          "Login fail. Pehle shared ERP API chalao: npm run server (ya Render pe API Resume).",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <aside className={styles.brandPanel}>
        <div className={styles.logoBlock}>
          <span className={styles.logoIcon} aria-hidden="true">
            <svg viewBox="0 0 48 48">
              <circle cx="24" cy="14" r="8" fill="#ffcc00" />
              <path d="M8 38h32l-4-14H12l-4 14z" fill="#3d8bfd" />
              <path d="M14 24h20v4H14z" fill="#006622" />
            </svg>
          </span>
          <div>
            <p className={styles.logoTitle}>DHATTERWAL</p>
            <p className={styles.logoSub}>SOLAR ENERGY SYSTEM</p>
            <p className={styles.logoTag}>ERP Portal</p>
          </div>
        </div>

        <p className={styles.branchMd}>
          {COMPANY_MD_LABEL} — <strong>{COMPANY_MD_NAME}</strong>
        </p>

        <p className={styles.brandText}>
          Shared live ERP — sabhi PC pe same data (API server). Login pe cloud se sync hota hai.
          API: <strong>{getApiBase() || "—"}</strong>
        </p>

        <div className={styles.supportBox}>
          <p className={styles.supportTitle}>Support</p>
          <a href={`tel:${CONTACT.primaryTel}`} className={styles.supportPhone}>
            {CONTACT.primaryDisplay}
          </a>
          <p className={styles.supportMore}>
            {CONTACT.phones.slice(1).map((p) => p.display).join(" · ")}
          </p>
        </div>
      </aside>

      <section className={styles.formPanel}>
        <div className={styles.card}>
          <div className={styles.roleTabs} role="tablist" aria-label="Login role">
            <button
              type="button"
              role="tab"
              aria-selected={role === AUTH_ROLES.ADMIN}
              className={role === AUTH_ROLES.ADMIN ? styles.tabActive : styles.tab}
              onClick={() => setRole(AUTH_ROLES.ADMIN)}
            >
              Admin Login
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={role === AUTH_ROLES.STAFF}
              className={role === AUTH_ROLES.STAFF ? styles.tabActive : styles.tab}
              onClick={() => setRole(AUTH_ROLES.STAFF)}
            >
              Staff Login
            </button>
          </div>

          <div className={styles.roleHeader}>
            <span className={styles.roleBadge} aria-hidden="true">
              {role === AUTH_ROLES.ADMIN ? "A" : "S"}
            </span>
            <div>
              <h1>{roleMeta[role].title}</h1>
              <p>{roleMeta[role].subtitle}</p>
            </div>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label>
              User ID
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                autoComplete="username"
                required
                placeholder={role === AUTH_ROLES.ADMIN ? "admin" : "staff"}
              />
            </label>

            <label>
              Password
              <div className={styles.passwordWrap}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  placeholder="Enter password"
                />
                <button
                  type="button"
                  className={styles.showPass}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            <label className={styles.remember}>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Keep me signed in on this device
            </label>

            {error && (
              <p className={styles.error} role="alert">
                {error}
              </p>
            )}

            <button type="submit" className={styles.submitBtn} disabled={busy}>
              {busy
                ? "Connecting shared ERP…"
                : `Sign in as ${role === AUTH_ROLES.ADMIN ? "Admin" : "Staff"}`}
            </button>
          </form>

          <p className={styles.demoHint}>
            Live ERP login — User ID aur password admin se lein.
            <br />
            Local testing: pehle <code>npm run server</code> chalao.
          </p>

          <Link to={ROUTES.HOME} className={styles.backLink}>
            ← Back to website
          </Link>
        </div>
      </section>
    </div>
  );
}

export default LoginPage;
