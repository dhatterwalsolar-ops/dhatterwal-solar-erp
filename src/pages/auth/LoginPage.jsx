import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AUTH_ROLES, DEMO_ACCOUNTS } from "../../constants/auth";
import { BRANCH_MD, CONTACT } from "../../constants/contact";
import { ROUTES } from "../../constants/routes";
import { setAuthSession } from "../../utils/authSession";
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
    const demo = DEMO_ACCOUNTS[role];
    setUserId(demo.userId);
    setPassword("");
    setError("");
  }, [role]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const demo = DEMO_ACCOUNTS[role];

    if (userId.trim() !== demo.userId || password !== demo.password) {
      setError("Invalid User ID or password for selected role.");
      return;
    }

    setAuthSession({
      role,
      roleLabel: demo.roleLabel,
      displayName: demo.displayName,
      userId: demo.userId,
      remember,
      loggedInAt: new Date().toISOString(),
    });

    navigate(ROUTES.DASHBOARD, { replace: true });
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
          Branch MD: <strong>{BRANCH_MD}</strong>
        </p>

        <p className={styles.brandText}>
          Secure login for admin and staff teams. Manage loan cases, sales,
          purchases, stock, GST and customer records from one dashboard.
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

            <button type="submit" className={styles.submitBtn}>
              Sign in as {role === AUTH_ROLES.ADMIN ? "Admin" : "Staff"}
            </button>
          </form>

          <p className={styles.demoHint}>
            Demo: Admin <code>admin / admin123</code> · Staff <code>staff / staff123</code>
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
