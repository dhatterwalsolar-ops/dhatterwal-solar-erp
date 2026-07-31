import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  getOfficeWhatsAppDisplay,
  getOfficeWhatsAppMobile,
  setOfficeWhatsAppMobile,
} from "../../constants/erpWhatsApp";
import { buildSeriesPreview } from "../../constants/settingsDefaults";
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
import { getApiBase } from "../../utils/erpStorage";
import {
  getSiteOrderGoogleFormUrl,
  setSiteOrderGoogleFormUrl,
} from "../../utils/siteOrderWhatsApp";
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
  { id: "security", label: "Security", icon: "🔒" },
  { id: "whatsapp", label: "Office WhatsApp", icon: "💬" },
  { id: "googleForm", label: "Google Form → BOM", icon: "🔗" },
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
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [showAddUser, setShowAddUser] = useState(false);
  const [officeWaMobile, setOfficeWaMobile] = useState(() => getOfficeWhatsAppMobile());
  const [googleFormUrl, setGoogleFormUrl] = useState(() => getSiteOrderGoogleFormUrl());
  const webhookApiUrl = `${(getApiBase() || "https://dhatterwal-solar-erp.onrender.com").replace(/\/$/, "")}/api/public/google-form-bom`;

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

  const updateInvoice = () => {
    saveInvoiceSeries(state.invoiceSeries);
    appendActivityLog({
      user: session?.displayName ?? "Admin",
      action: "Invoice series updated",
    });
    window.alert("Invoice series updated.");
  };

  const updateQuotation = () => {
    saveQuotationSeries(state.quotationSeries);
    appendActivityLog({
      user: session?.displayName ?? "Admin",
      action: "Quotation series updated",
    });
    window.alert("Quotation series updated.");
  };

  const managePasswords = () => {
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

  const editUserRow = (userId) => {
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

  const deleteUserRow = (userId) => {
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

  const addNewUser = () => {
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
          Settings, user change/delete aur sheet row delete sirf <strong>Admin</strong> login se
          allowed hain. Mobile OTP system band hai.
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
              <h2>Security</h2>
              <p className={styles.cardHint}>
                Mobile OTP band hai. Settings page aur row delete sirf Admin role ke paas hain.
                Staff add/edit daily entries kar sakte hain, delete nahi.
              </p>
            </section>
          )}

          {activeTab === "whatsapp" && (
            <section className={styles.card}>
              <h2>Office WhatsApp</h2>
              <p className={styles.cardHint}>
                Sale / Query / Labour ke saare messages <strong>is Office number</strong> se
                jayenge. WhatsApp Web me isi number se QR login rakho. Live API (Meta/Twilio)
                configure ho to bina browser ke bhi isi Business number se send hoga.
              </p>
              <p className={styles.cardHint}>
                Current: <strong>{getOfficeWhatsAppDisplay()}</strong>
              </p>
              <div className={styles.seriesGrid}>
                <label>
                  Office WhatsApp mobile (10 digit)
                  <input
                    value={officeWaMobile}
                    onChange={(e) =>
                      setOfficeWaMobile(e.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                    placeholder="7876686572"
                    inputMode="numeric"
                  />
                </label>
              </div>
              <button
                type="button"
                className={styles.btnPurple}
                onClick={() => {
                  try {
                    const saved = setOfficeWhatsAppMobile(officeWaMobile);
                    setOfficeWaMobile(saved);
                    appendActivityLog({
                      user: session?.displayName ?? "Admin",
                      action: `Office WhatsApp set: ${saved}`,
                    });
                    window.alert(
                      `Office WhatsApp save: ${getOfficeWhatsAppDisplay()}\n\nAb web.whatsapp.com pe isi number se login karke messages bhejo.`,
                    );
                  } catch (err) {
                    window.alert(err?.message || "Save fail.");
                  }
                }}
              >
                Save Office WhatsApp
              </button>
            </section>
          )}

          {activeTab === "googleForm" && (
            <section className={styles.card}>
              <h2>Google Form → BOM (Apps Script)</h2>
              <p className={styles.cardHint}>
                Ab Team Leader WhatsApp me <strong>sirf ERP site form</strong> jata hai (BOM auto).
                Google Form optional / baad ke liye — URL save kar sakte ho, lekin WhatsApp me nahi jayega.
              </p>
              <div className={styles.seriesGrid}>
                <label>
                  Google Form URL (optional — WhatsApp me nahi)
                  <input
                    value={googleFormUrl}
                    onChange={(e) => setGoogleFormUrl(e.target.value)}
                    placeholder="https://docs.google.com/forms/d/e/.../viewform"
                  />
                </label>
              </div>
              <button
                type="button"
                className={styles.btnPurple}
                onClick={() => {
                  setSiteOrderGoogleFormUrl(googleFormUrl);
                  appendActivityLog({
                    user: session?.displayName ?? "Admin",
                    action: "Site Google Form URL saved",
                  });
                  window.alert(
                    "Google Form URL save ho gayi (optional). Team Leader WhatsApp me abhi sirf ERP site form link jata hai.",
                  );
                }}
              >
                Save Google Form URL
              </button>

              <h3 className={styles.subHead} style={{ marginTop: "1.25rem" }}>
                Apps Script setup
              </h3>
              <ol className={styles.cardHint} style={{ paddingLeft: "1.2rem", lineHeight: 1.55 }}>
                <li>Google Form banao (Consumer No., Panel, Inverter Serial, Wires, Stand…)</li>
                <li>Responses → Spreadsheet link karo</li>
                <li>
                  Spreadsheet → Extensions → Apps Script → file{" "}
                  <code>docs/google-apps-script-site-bom.gs</code> paste karo
                </li>
                <li>
                  Script me <code>API_URL</code> ={" "}
                  <code style={{ wordBreak: "break-all" }}>{webhookApiUrl}</code>
                </li>
                <li>
                  Script + Render <code>GOOGLE_FORM_WEBHOOK_SECRET</code> same secret rakho
                </li>
                <li>
                  Trigger: <strong>onFormSubmit</strong> → From spreadsheet → On form submit
                </li>
                <li>Test: Apps Script me <code>testPingErp</code> Run</li>
              </ol>
              <p className={styles.cardHint}>
                Render env: <code>GOOGLE_FORM_WEBHOOK_SECRET=your-secret</code> — phir redeploy.
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
                    onClick={() => setShowAddUser((v) => !v)}
                  >
                    {showAddUser ? "Close Form" : "+ Add User"}
                  </button>
                  <button type="button" className={styles.btnManage} onClick={managePasswords}>
                    Manage Passwords
                  </button>
                </div>
              </div>
              <p className={styles.cardHint}>
                Naye users yahan add karo — Login ID + password se shared ERP pe login hoga. User
                change/delete sirf Admin.
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

        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
