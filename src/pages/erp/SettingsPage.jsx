import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  SETTINGS_ACTIVITY_LOG,
  SETTINGS_OTP_MOBILE,
  SETTINGS_OTP_MOBILE_DISPLAY,
  buildSeriesPreview,
} from "../../constants/settingsDefaults";
import { ROUTES } from "../../constants/routes";
import { getAuthSession } from "../../utils/authSession";
import { isAdminSession } from "../../utils/erpAccess";
import {
  appendActivityLog,
  getSettingsState,
  saveInvoiceSeries,
  saveQuotationSeries,
  saveUsers,
} from "../../utils/settingsStorage";
import {
  createEmptyPaymentAccount,
  loadPaymentAccounts,
  savePaymentAccounts,
} from "../../utils/paymentAccountStorage";
import InvoiceFormatSettings from "./InvoiceFormatSettings";
import styles from "./SettingsPage.module.css";

const TABS = [
  { id: "general", label: "General Settings", icon: "⚙" },
  { id: "users", label: "User Management", icon: "👤" },
  { id: "invoice", label: "Invoice Series", icon: "🧾" },
  { id: "invoiceFormat", label: "Invoice Format", icon: "🖨" },
  { id: "quotation", label: "Quotation Series", icon: "📄" },
  { id: "paymentTypes", label: "Payment Types", icon: "💳" },
  { id: "security", label: "Security & OTP", icon: "🔒" },
  { id: "activity", label: "Activity Log", icon: "📋" },
];

function SettingsPage() {
  const session = getAuthSession();
  const [activeTab, setActiveTab] = useState("general");
  const [state, setState] = useState(() => getSettingsState());
  const [paymentAccounts, setPaymentAccounts] = useState(() => loadPaymentAccounts());
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const demoOtp = "482916";

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

  const requireOtp = () => {
    if (!otpSent) {
      window.alert("Pehle Send OTP dabayein.");
      return false;
    }
    if (otp.trim() !== demoOtp) {
      window.alert("Galat OTP. Demo OTP check karein (Send OTP ke baad alert me dikhega).");
      return false;
    }
    return true;
  };

  const sendOtp = () => {
    setOtpSent(true);
    window.alert(
      `Demo OTP ${SETTINGS_OTP_MOBILE_DISPLAY} par bheja gaya:\n\n${demoOtp}\n\n(Backend connect hone par asli SMS aayega.)`,
    );
  };

  const updateInvoice = () => {
    if (!requireOtp()) return;
    saveInvoiceSeries(state.invoiceSeries);
    appendActivityLog({
      user: session?.displayName ?? "Admin",
      action: "Invoice series updated",
    });
    window.alert("Invoice series updated.");
  };

  const updateQuotation = () => {
    if (!requireOtp()) return;
    saveQuotationSeries(state.quotationSeries);
    appendActivityLog({
      user: session?.displayName ?? "Admin",
      action: "Quotation series updated",
    });
    window.alert("Quotation series updated.");
  };

  const managePasswords = () => {
    if (!requireOtp()) return;
    const adminPass = window.prompt("New Admin password (demo):", "");
    if (adminPass === null) return;
    const staffPass = window.prompt("New Staff password (demo):", "");
    if (staffPass === null) return;
    const today = new Date().toLocaleDateString("en-GB");
    const users = state.users.map((u) => ({
      ...u,
      lastUpdated: today,
      passwordMask: "********",
    }));
    setState((s) => ({ ...s, users }));
    saveUsers(users);
    appendActivityLog({
      user: session?.displayName ?? "Admin",
      action: "Passwords updated for Admin & Staff",
    });
    window.alert("Passwords updated (demo — login abhi bhi auth.js demo se chalega jab tak backend na ho).");
  };

  const editUserRow = (userId) => {
    if (!requireOtp()) return;
    const user = state.users.find((u) => u.id === userId);
    if (!user) return;
    const name = window.prompt("User name:", user.userName);
    if (name === null) return;
    const users = state.users.map((u) =>
      u.id === userId
        ? { ...u, userName: name, lastUpdated: new Date().toLocaleDateString("en-GB") }
        : u,
    );
    setState((s) => ({ ...s, users }));
    saveUsers(users);
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
                  {SETTINGS_ACTIVITY_LOG.map((row) => (
                    <tr key={row.join("-")}>
                      <td>{row[0]}</td>
                      <td>{row[1]}</td>
                      <td>{row[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {activeTab === "invoiceFormat" && <InvoiceFormatSettings session={session} />}

          {showPasswordBlock && (
            <section className={styles.card}>
              <div className={styles.cardHead}>
                <h2>Admin &amp; Staff Password Management</h2>
                <button type="button" className={styles.btnManage} onClick={managePasswords}>
                  Manage Passwords
                </button>
              </div>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>User Type</th>
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
                        <span
                          className={
                            user.userType === "Admin" ? styles.badgeAdmin : styles.badgeStaff
                          }
                        >
                          {user.userType}
                        </span>
                      </td>
                      <td>{user.userName}</td>
                      <td className={styles.masked}>{user.passwordMask}</td>
                      <td>{user.lastUpdated}</td>
                      <td>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => editUserRow(user.id)}
                          aria-label={`Edit ${user.userName}`}
                        >
                          ✎
                        </button>
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
                    Har account me abhi jo balance hai wo yahan set karein. Payment Received / Given
                    ke baad Total Payment dashboard me: Settings balance + Received − Given dikhega.
                  </p>
                </div>
                <button type="button" className={styles.btnManage} onClick={addPaymentAccount}>
                  + Add Account
                </button>
              </div>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>Payment Type / Account Name</th>
                    <th>Current Balance (₹)</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentAccounts.map((acc) => (
                    <tr key={acc.id}>
                      <td>
                        <input
                          className={styles.inlineInput}
                          value={acc.name}
                          onChange={(e) => updatePaymentAccount(acc.id, { name: e.target.value })}
                          placeholder="e.g. Cash, Online Sonu, Canara 7411"
                        />
                      </td>
                      <td>
                        <input
                          className={styles.inlineInput}
                          type="number"
                          min="0"
                          step="0.01"
                          value={acc.currentBalance}
                          onChange={(e) =>
                            updatePaymentAccount(acc.id, {
                              currentBalance: e.target.value,
                            })
                          }
                          placeholder="0"
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
                  ))}
                </tbody>
              </table>
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
              <button type="button" className={styles.btnSendOtp} onClick={sendOtp}>
                Send OTP
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
