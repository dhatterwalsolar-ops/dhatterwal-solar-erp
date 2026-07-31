import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  SETTINGS_OTP_MOBILE,
  SETTINGS_OTP_MOBILE_DISPLAY,
  buildSeriesPreview,
} from "../../constants/settingsDefaults";
import { ROUTES } from "../../constants/routes";
import { getAuthSession } from "../../utils/authSession";
import { ACCESS_PROFILES, isAdminSession } from "../../utils/erpAccess";
import {
  loadLoginUsers,
  removeLoginUser,
  saveLoginUsers,
  settingsUsersFromLogins,
  upsertLoginUser,
} from "../../utils/erpLoginUsers";
import {
  appendActivityLog,
  getActivityLog,
  getSettingsState,
  saveInvoiceSeries,
  saveQuotationSeries,
  saveUsers,
} from "../../utils/settingsStorage";
import {
  ACCOUNT_TYPES,
  createEmptyPaymentAccount,
  isLimitAccountType,
  loadPaymentAccounts,
  savePaymentAccounts,
} from "../../utils/paymentAccountStorage";
import { apiSendOtp, apiVerifyOtp } from "../../utils/messagingApi";
import InvoiceFormatSettings from "./InvoiceFormatSettings";
import LoanQuotationFormatSettings from "./LoanQuotationFormatSettings";
import styles from "./SettingsPage.module.css";

const TABS = [
  { id: "general", label: "General Settings", icon: "⚙" },
  { id: "users", label: "User Management", icon: "👤" },
  { id: "invoice", label: "Invoice Series", icon: "🧾" },
  { id: "invoiceFormat", label: "Invoice Format", icon: "🖨" },
  { id: "quotation", label: "Quotation Series", icon: "📄" },
  { id: "loanQuotationFormat", label: "Loan Quotation Format", icon: "📝" },
  { id: "paymentTypes", label: "Payment Types", icon: "💳" },
  { id: "security", label: "Security & OTP", icon: "🔒" },
  { id: "activity", label: "Activity Log", icon: "📋" },
];

const EMPTY_USER_FORM = {
  loginId: "",
  userName: "",
  userType: "Staff",
  accessProfile: "staff",
  password: "",
};

function SettingsPage() {
  const session = getAuthSession();
  const [activeTab, setActiveTab] = useState("general");
  const [state, setState] = useState(() => {
    const base = getSettingsState();
    const logins = loadLoginUsers();
    return { ...base, users: settingsUsersFromLogins(logins) };
  });
  const [paymentAccounts, setPaymentAccounts] = useState(() => loadPaymentAccounts());
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [showAddUser, setShowAddUser] = useState(false);

  const invoicePreview = useMemo(
    () => buildSeriesPreview(state.invoiceSeries),
    [state.invoiceSeries],
  );
  const quotationPreview = useMemo(
    () => buildSeriesPreview(state.quotationSeries),
    [state.quotationSeries],
  );

  if (!isAdminSession(session)) {
    return <Navigate to={ROUTES.DASHBOARD} replace />;
  }

  const refreshUsersFromLogins = (logins) => {
    const users = settingsUsersFromLogins(logins);
    setState((s) => ({ ...s, users }));
    saveUsers(users);
    return users;
  };

  const requireOtp = async () => {
    if (!otpSent) {
      window.alert("Pehle Send OTP dabayein.");
      return false;
    }
    try {
      const data = await apiVerifyOtp({ purpose: "settings", code: otp.trim() });
      if (!data.ok) {
        window.alert(data.error || "Galat OTP.");
        return false;
      }
      return true;
    } catch (err) {
      window.alert(err?.message || "OTP verify fail.");
      return false;
    }
  };

  const sendOtp = async () => {
    setOtpBusy(true);
    try {
      const data = await apiSendOtp({
        purpose: "settings",
        mobile: SETTINGS_OTP_MOBILE,
      });
      setOtpSent(true);
      if (data.demo && data.demoOtp) {
        window.alert(
          `Demo OTP ${data.mobileDisplay || SETTINGS_OTP_MOBILE_DISPLAY} (SMS live nahi):\n\n${data.demoOtp}\n\nLive SMS ke liye server/.env me SMS_PROVIDER=msg91|twilio set karein.`,
        );
      } else {
        window.alert(
          `OTP SMS ${data.mobileDisplay || SETTINGS_OTP_MOBILE_DISPLAY} par bhej diya gaya.`,
        );
      }
    } catch (err) {
      window.alert(err?.message || "OTP send fail. API server chalu hai?");
    } finally {
      setOtpBusy(false);
    }
  };

  const updateInvoice = async () => {
    if (!(await requireOtp())) return;
    saveInvoiceSeries(state.invoiceSeries);
    appendActivityLog({
      user: session?.displayName ?? "Admin",
      action: "Invoice series updated",
    });
    window.alert("Invoice series updated.");
  };

  const updateQuotation = async () => {
    if (!(await requireOtp())) return;
    saveQuotationSeries(state.quotationSeries);
    appendActivityLog({
      user: session?.displayName ?? "Admin",
      action: "Quotation series updated",
    });
    window.alert("Quotation series updated.");
  };

  const managePasswords = async () => {
    if (!(await requireOtp())) return;
    const logins = loadLoginUsers();
    const adminPass = window.prompt("New Admin password:", "");
    if (adminPass === null) return;
    const staffPass = window.prompt("New Staff password (blank = skip staff):", "");
    if (staffPass === null) return;
    const next = logins.map((u) => {
      if (u.role === "admin" && adminPass.trim()) {
        return { ...u, password: adminPass.trim() };
      }
      if (u.role === "staff" && staffPass.trim()) {
        return { ...u, password: staffPass.trim() };
      }
      return u;
    });
    refreshUsersFromLogins(saveLoginUsers(next));
    appendActivityLog({
      user: session?.displayName ?? "Admin",
      action: "Passwords updated",
    });
    window.alert("Passwords update ho gaye — naya login inhi se chalega (shared ERP).");
  };

  const editUserRow = async (userId) => {
    if (!(await requireOtp())) return;
    const logins = loadLoginUsers();
    const user = logins.find((u) => u.userId === userId);
    if (!user) return;
    const name = window.prompt("Display name:", user.displayName);
    if (name === null) return;
    const pass = window.prompt("Naya password (blank = same rakho):", "");
    if (pass === null) return;
    const rolePick = window.prompt("Role — Admin ya Staff:", user.roleLabel);
    if (rolePick === null) return;
    const role = String(rolePick).toLowerCase().includes("admin") ? "admin" : "staff";
    const profileKeys = Object.keys(ACCESS_PROFILES).join(", ");
    const profilePick = window.prompt(
      `Access profile (${profileKeys}):`,
      user.accessProfile || (role === "admin" ? "admin" : "staff"),
    );
    if (profilePick === null) return;
    try {
      const next = upsertLoginUser({
        userId: user.userId,
        displayName: name.trim() || user.displayName,
        password: pass.trim() || user.password,
        role,
        accessProfile: String(profilePick).trim() || (role === "admin" ? "admin" : "staff"),
      });
      refreshUsersFromLogins(next);
      appendActivityLog({
        user: session?.displayName ?? "Admin",
        action: `User updated: ${user.userId}`,
      });
    } catch (err) {
      window.alert(err?.message || "Update fail.");
    }
  };

  const deleteUserRow = async (userId) => {
    if (!(await requireOtp())) return;
    if (!window.confirm(`User "${userId}" delete karein?`)) return;
    try {
      const next = removeLoginUser(userId);
      refreshUsersFromLogins(next);
      appendActivityLog({
        user: session?.displayName ?? "Admin",
        action: `User deleted: ${userId}`,
      });
    } catch (err) {
      window.alert(err?.message || "Delete fail.");
    }
  };

  const addNewUser = async () => {
    if (!(await requireOtp())) return;
    const loginId = String(userForm.loginId || "").trim();
    const userName = String(userForm.userName || "").trim();
    const password = String(userForm.password || "").trim();
    const accessProfile = String(userForm.accessProfile || "").trim() || "staff";
    const profile = ACCESS_PROFILES[accessProfile];
    const role = profile?.role || (userForm.userType === "Admin" ? "admin" : "staff");
    if (!loginId || !userName || !password) {
      window.alert("Login ID, Name aur Password sab bharna zaroori hai.");
      return;
    }
    const exists = loadLoginUsers().some(
      (u) => u.userId.toLowerCase() === loginId.toLowerCase(),
    );
    if (exists) {
      window.alert("Ye Login ID pehle se hai — dusra ID choose karein.");
      return;
    }
    try {
      const next = upsertLoginUser({
        userId: loginId,
        displayName: userName,
        password,
        role,
        accessProfile,
      });
      refreshUsersFromLogins(next);
      appendActivityLog({
        user: session?.displayName ?? "Admin",
        action: `User added: ${loginId} (${accessProfile})`,
      });
      setUserForm(EMPTY_USER_FORM);
      setShowAddUser(false);
      window.alert(`User add ho gaya.\nLogin ID: ${loginId}\nAb isi se ERP login kar sakte ho.`);
    } catch (err) {
      window.alert(err?.message || "Add user fail.");
    }
  };

  const showPasswordBlock = activeTab === "general" || activeTab === "users";
  const showInvoice = activeTab === "general" || activeTab === "invoice";
  const showQuotation = activeTab === "general" || activeTab === "quotation";
  const showPaymentTypes = activeTab === "general" || activeTab === "paymentTypes";

  const updatePaymentAccount = (id, patch) => {
    setPaymentAccounts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );
  };

  const addPaymentAccount = () => {
    setPaymentAccounts((prev) => [...prev, createEmptyPaymentAccount()]);
  };

  const removePaymentAccount = (id) => {
    if (paymentAccounts.length <= 1) {
      window.alert("Kam se kam ek payment account hona chahiye.");
      return;
    }
    if (!window.confirm("Is account ko hata dein?")) return;
    setPaymentAccounts((prev) => prev.filter((a) => a.id !== id));
  };

  const savePaymentTypes = () => {
    const invalid = paymentAccounts.some((a) => !a.name?.trim());
    if (invalid) {
      window.alert("Har account ka naam likhein.");
      return;
    }
    const names = paymentAccounts.map((a) => a.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) {
      window.alert("Duplicate account naam allowed nahi.");
      return;
    }
    const limitBad = paymentAccounts.some((a) => {
      if (!isLimitAccountType(a.accountType)) return false;
      return !(Number(a.totalLimit) > 0);
    });
    if (limitBad) {
      window.alert("Limit / Credit Limit accounts me Total Limit (₹) > 0 set karein.");
      return;
    }
    savePaymentAccounts(paymentAccounts);
    appendActivityLog({
      user: session?.displayName ?? "Admin",
      action: "Payment type / account balances updated",
    });
    window.alert("Payment accounts save ho gaye — Payment Sheet dropdown me dikhenge.");
  };

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link to={ROUTES.DASHBOARD}>Dashboard</Link>
        <span aria-hidden="true">›</span>
        <span>Settings</span>
      </nav>

      <div className={styles.otpBanner}>
        <span className={styles.bannerIcon} aria-hidden="true">
          🛡
        </span>
        <p>
          For security reasons, all critical settings require OTP verification on your registered
          mobile number <strong>{SETTINGS_OTP_MOBILE_DISPLAY}</strong>
        </p>
      </div>

      <div className={styles.layout}>
        <aside className={styles.settingsNav}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? `${styles.navItem} ${styles.navActive}` : styles.navItem}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className={styles.navIcon}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </aside>

        <div className={styles.content}>
          {activeTab === "security" && (
            <section className={styles.card}>
              <h2>Security &amp; OTP</h2>
              <p className={styles.cardHint}>
                Registered mobile for OTP: <strong>{SETTINGS_OTP_MOBILE}</strong>
              </p>
              <p className={styles.cardHint}>
                Critical changes (password, invoice/quotation series) need OTP from this number.
              </p>
            </section>
          )}

          {activeTab === "activity" && (
            <section className={styles.card}>
              <h2>Activity Log</h2>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Date &amp; Time</th>
                    <th>User</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {getActivityLog().length === 0 ? (
                    <tr>
                      <td colSpan={3}>No activity yet.</td>
                    </tr>
                  ) : (
                    getActivityLog().map((row, index) => (
                      <tr key={`${row.at || ""}-${row.user || ""}-${index}`}>
                        <td>
                          {row.at
                            ? new Date(row.at).toLocaleString("en-IN")
                            : "—"}
                        </td>
                        <td>{row.user || "—"}</td>
                        <td>{row.action || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          )}

          {activeTab === "invoiceFormat" && <InvoiceFormatSettings session={session} />}
          {activeTab === "loanQuotationFormat" && (
            <LoanQuotationFormatSettings session={session} />
          )}

          {showPasswordBlock && (
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h2>User Management</h2>
                <div className={styles.formatActions}>
                  <button
                    type="button"
                    className={styles.btnPurple}
                    onClick={async () => {
                      if (!(await requireOtp())) return;
                      setShowAddUser((v) => !v);
                    }}
                  >
                    {showAddUser ? "Close Form" : "+ Add User"}
                  </button>
                  <button type="button" className={styles.btnManage} onClick={managePasswords}>
                    Manage Passwords
                  </button>
                </div>
              </div>
              <p className={styles.cardHint}>
                Naye users yahan add karo — Login ID + password se shared ERP pe login hoga. Critical
                actions ke liye pehle OTP bhejo.
              </p>

              {showAddUser ? (
                <div className={styles.addUserBox}>
                  <h3 className={styles.subHead}>Add new user</h3>
                  <div className={styles.seriesGrid}>
                    <label>
                      Login ID *
                      <input
                        value={userForm.loginId}
                        onChange={(e) =>
                          setUserForm((f) => ({ ...f, loginId: e.target.value.trim() }))
                        }
                        placeholder="e.g. ravi"
                      />
                    </label>
                    <label>
                      Display name *
                      <input
                        value={userForm.userName}
                        onChange={(e) => setUserForm((f) => ({ ...f, userName: e.target.value }))}
                        placeholder="e.g. Ravi Kumar"
                      />
                    </label>
                    <label>
                      User type *
                      <select
                        value={userForm.userType}
                        onChange={(e) => setUserForm((f) => ({ ...f, userType: e.target.value }))}
                      >
                        <option value="Staff">Staff</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </label>
                    <label>
                      Access excess *
                      <select
                        value={userForm.accessProfile}
                        onChange={(e) => {
                          const accessProfile = e.target.value;
                          const profile = ACCESS_PROFILES[accessProfile];
                          setUserForm((f) => ({
                            ...f,
                            accessProfile,
                            userType:
                              profile?.role === "admin" ? "Admin" : "Staff",
                          }));
                        }}
                      >
                        {Object.values(ACCESS_PROFILES).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Password *
                      <input
                        type="text"
                        value={userForm.password}
                        onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
                        placeholder="Login password"
                      />
                    </label>
                  </div>
                  <div className={styles.formatActions} style={{ marginTop: "0.75rem" }}>
                    <button type="button" className={styles.btnPurple} onClick={addNewUser}>
                      Save User
                    </button>
                    <button
                      type="button"
                      className={styles.btnOutline}
                      onClick={() => {
                        setShowAddUser(false);
                        setUserForm(EMPTY_USER_FORM);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}

              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Login ID</th>
                    <th>User Type</th>
                    <th>Access Excess</th>
                    <th>User Name</th>
                    <th>Password</th>
                    <th>Last Updated</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {state.users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <code>{user.loginId || user.id}</code>
                      </td>
                      <td>
                        <span
                          className={
                            user.userType === "Admin" ? styles.badgeAdmin : styles.badgeStaff
                          }
                        >
                          {user.userType}
                        </span>
                      </td>
                      <td style={{ fontSize: "0.75rem", maxWidth: "11rem" }}>
                        {user.accessProfileLabel || user.accessProfile || "—"}
                      </td>
                      <td>{user.userName}</td>
                      <td className={styles.masked}>{user.passwordMask}</td>
                      <td>{user.lastUpdated}</td>
                      <td>
                        <div className={styles.userActions}>
                          <button
                            type="button"
                            className={styles.iconBtn}
                            onClick={() => editUserRow(user.id)}
                            aria-label={`Edit ${user.userName}`}
                            title="Edit"
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className={styles.btnDangerSmall}
                            onClick={() => deleteUserRow(user.id)}
                            title="Delete user"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {showInvoice && (
            <section className={styles.card}>
              <h2>Invoice Series Settings</h2>
              <div className={styles.seriesGrid}>
                <label>
                  Prefix (Start)
                  <input
                    value={state.invoiceSeries.prefix}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        invoiceSeries: { ...s.invoiceSeries, prefix: e.target.value },
                      }))
                    }
                  />
                </label>
                <label>
                  Next Number
                  <input
                    value={state.invoiceSeries.nextNumber}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        invoiceSeries: { ...s.invoiceSeries, nextNumber: e.target.value },
                      }))
                    }
                  />
                </label>
                <label>
                  Suffix (End)
                  <input
                    value={state.invoiceSeries.suffix}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        invoiceSeries: { ...s.invoiceSeries, suffix: e.target.value },
                      }))
                    }
                  />
                </label>
                <label>
                  Separator (blank = no dash)
                  <input
                    value={state.invoiceSeries.separator ?? "-"}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        invoiceSeries: { ...s.invoiceSeries, separator: e.target.value },
                      }))
                    }
                    placeholder="leave empty for DS/323/2026-27"
                  />
                </label>
                <label className={styles.previewField}>
                  Preview
                  <input className={styles.previewInput} value={invoicePreview} readOnly />
                </label>
              </div>
              <button type="button" className={styles.btnPurple} onClick={updateInvoice}>
                Update Series
              </button>
            </section>
          )}

          {showQuotation && (
            <section className={styles.card}>
              <h2>Quotation Series Settings</h2>
              <div className={styles.seriesGrid}>
                <label>
                  Prefix (Start)
                  <input
                    value={state.quotationSeries.prefix}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        quotationSeries: { ...s.quotationSeries, prefix: e.target.value },
                      }))
                    }
                  />
                </label>
                <label>
                  Next Number
                  <input
                    value={state.quotationSeries.nextNumber}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        quotationSeries: { ...s.quotationSeries, nextNumber: e.target.value },
                      }))
                    }
                  />
                </label>
                <label>
                  Suffix (End)
                  <input
                    value={state.quotationSeries.suffix}
                    onChange={(e) =>
                      setState((s) => ({
                        ...s,
                        quotationSeries: { ...s.quotationSeries, suffix: e.target.value },
                      }))
                    }
                  />
                </label>
                <label className={styles.previewField}>
                  Preview
                  <input className={styles.previewInput} value={quotationPreview} readOnly />
                </label>
              </div>
              <button type="button" className={styles.btnOrange} onClick={updateQuotation}>
                Update Series
              </button>
            </section>
          )}

          {showPaymentTypes && (
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <h2>Payment Types &amp; Account Balance</h2>
                  <p className={styles.cardHint}>
                    Account Name + Account Type set karein. Saving/Current: opening balance.
                    Limit / Credit Limit (OD / Credit Card): Total Limit + Used Payment. Used
                    negative me dikhega; Payment Given se used badhega. Limit cross hone par Over
                    dikhega — daily hisaab Total Payment dashboard me.
                  </p>
                </div>
                <button type="button" className={styles.btnManage} onClick={addPaymentAccount}>
                  + Add Account
                </button>
              </div>
              <div className={styles.tableScroll}>
                <table className={styles.dataTable}>
                  <thead>
                    <tr>
                      <th>Account Name</th>
                      <th>Account Type</th>
                      <th>Opening Balance (₹)</th>
                      <th>Total Limit (₹)</th>
                      <th>Used Payment (₹)</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentAccounts.map((acc) => {
                      const limitType = isLimitAccountType(acc.accountType);
                      return (
                        <tr key={acc.id}>
                          <td>
                            <input
                              className={styles.inlineInput}
                              value={acc.name}
                              onChange={(e) =>
                                updatePaymentAccount(acc.id, { name: e.target.value })
                              }
                              placeholder="e.g. Credit Card, Sonu Online, Canara 7411"
                            />
                          </td>
                          <td>
                            <select
                              className={styles.inlineInput}
                              value={acc.accountType || "Saving"}
                              onChange={(e) => {
                                const accountType = e.target.value;
                                updatePaymentAccount(acc.id, {
                                  accountType,
                                  ...(isLimitAccountType(accountType)
                                    ? {}
                                    : { totalLimit: 0, usedPayment: 0 }),
                                });
                              }}
                            >
                              {ACCOUNT_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              className={styles.inlineInput}
                              type="number"
                              min="0"
                              step="0.01"
                              disabled={limitType}
                              value={limitType ? "" : acc.currentBalance}
                              onChange={(e) =>
                                updatePaymentAccount(acc.id, {
                                  currentBalance: e.target.value,
                                })
                              }
                              placeholder={limitType ? "N/A" : "0"}
                              title={
                                limitType
                                  ? "Limit accounts me opening balance nahi — Total Limit / Used use karein"
                                  : "Opening balance"
                              }
                            />
                          </td>
                          <td>
                            <input
                              className={styles.inlineInput}
                              type="number"
                              min="0"
                              step="0.01"
                              disabled={!limitType}
                              value={limitType ? acc.totalLimit : ""}
                              onChange={(e) =>
                                updatePaymentAccount(acc.id, {
                                  totalLimit: e.target.value,
                                })
                              }
                              placeholder={limitType ? "e.g. 200000" : "—"}
                            />
                          </td>
                          <td>
                            <input
                              className={styles.inlineInput}
                              type="number"
                              min="0"
                              step="0.01"
                              disabled={!limitType}
                              value={limitType ? acc.usedPayment : ""}
                              onChange={(e) =>
                                updatePaymentAccount(acc.id, {
                                  usedPayment: e.target.value,
                                })
                              }
                              placeholder={limitType ? "Already used" : "—"}
                              title="Manual used — live used = ye + Payment Given (negative me dikhega)"
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className={styles.btnDangerSmall}
                              onClick={() => removePaymentAccount(acc.id)}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button type="button" className={styles.btnPurple} onClick={savePaymentTypes}>
                Save Payment Accounts
              </button>
            </section>
          )}

          <section className={styles.otpFooter}>
            <h3>Secure Settings with OTP Verification</h3>
            <p>Save/update se pehle registered mobile par OTP verify karein.</p>
            <div className={styles.otpRow}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter 6 digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <button
                type="button"
                className={styles.btnSendOtp}
                onClick={sendOtp}
                disabled={otpBusy}
              >
                {otpBusy ? "Sending…" : "Send OTP"}
              </button>
            </div>
            <p className={styles.otpNote}>OTP will be sent to {SETTINGS_OTP_MOBILE}</p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
