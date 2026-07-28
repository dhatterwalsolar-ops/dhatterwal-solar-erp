import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../../../constants/routes";
import { BACKUP_ENTRY_SYNC_EVENT } from "../../../constants/backupEntry";
import { PAYMENT_ACCOUNTS_SYNC_EVENT } from "../../../utils/paymentAccountStorage";
import { CUSTOMER_PAYMENT_SYNC_EVENT } from "../../../utils/customerPaymentLedger";
import {
  PAYMENT_MGMT_SYNC_EVENT,
  buildPendingSummary,
  computeAccountModeBalances,
  formatPaymentMoney,
  getAllTotalPendingPayment,
  getMonthlyPaymentTotals,
  listRecentPaymentTransactions,
} from "../../../utils/paymentManagementStorage";
import { getAllTotalGivenPendingPayment } from "../../../utils/paymentGivenPendingStorage";
import { PURCHASE_HISTORY_SYNC_EVENT } from "../../../utils/purchaseHistoryStorage";
import { GIVEN_PENDING_SOURCES } from "../../../constants/paymentGivenPending";
import styles from "./PaymentManagement.module.css";

function PaymentTotalDashboardPage() {
  const [tick, setTick] = useState(0);
  const [pendingTab, setPendingTab] = useState("receive");

  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener(PAYMENT_MGMT_SYNC_EVENT, refresh);
    window.addEventListener(PAYMENT_ACCOUNTS_SYNC_EVENT, refresh);
    window.addEventListener(CUSTOMER_PAYMENT_SYNC_EVENT, refresh);
    window.addEventListener(BACKUP_ENTRY_SYNC_EVENT, refresh);
    window.addEventListener(PURCHASE_HISTORY_SYNC_EVENT, refresh);
    window.addEventListener("dhatterwal-labour-employees-sync", refresh);
    return () => {
      window.removeEventListener(PAYMENT_MGMT_SYNC_EVENT, refresh);
      window.removeEventListener(PAYMENT_ACCOUNTS_SYNC_EVENT, refresh);
      window.removeEventListener(CUSTOMER_PAYMENT_SYNC_EVENT, refresh);
      window.removeEventListener(BACKUP_ENTRY_SYNC_EVENT, refresh);
      window.removeEventListener(PURCHASE_HISTORY_SYNC_EVENT, refresh);
      window.removeEventListener("dhatterwal-labour-employees-sync", refresh);
    };
  }, []);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const monthly = useMemo(
    () => getMonthlyPaymentTotals(month, year),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick, month, year],
  );
  const accounts = useMemo(() => computeAccountModeBalances(), [tick]);
  const pending = useMemo(() => buildPendingSummary(), [tick]);
  const allPending = useMemo(() => getAllTotalPendingPayment(), [tick]);
  const allGivenPending = useMemo(() => getAllTotalGivenPendingPayment(), [tick]);
  const recent = useMemo(() => listRecentPaymentTransactions(10), [tick]);

  const donutTotal = pending.bucket03 + pending.bucket36 + pending.bucket6plus || 1;
  const p03 = (pending.bucket03 / donutTotal) * 100;
  const p36 = (pending.bucket36 / donutTotal) * 100;
  const donutStyle = {
    background: `conic-gradient(#66bb6a 0 ${p03}%, #ffa726 ${p03}% ${p03 + p36}%, #ef5350 ${p03 + p36}% 100%)`,
  };

  return (
    <div>
      <div className={styles.breadcrumb}>
        Home › <strong>Payments</strong> › Total Payment Dashboard
      </div>
      <div className={styles.pageHead}>
        <div>
          <h1>Total Payment Dashboard</h1>
          <p>Received, given, account balance aur pending summary — reference sheet layout.</p>
        </div>
      </div>

      <div className={styles.kpiRow}>
        <div className={styles.kpi}>
          <label>Total Received (This Month)</label>
          <strong>₹ {formatPaymentMoney(monthly.received)}</strong>
          <small>Manual + Sale / Name-Load sync</small>
        </div>
        <div className={`${styles.kpi} ${styles.kpiGiven}`}>
          <label>Total Given (This Month)</label>
          <strong>₹ {formatPaymentMoney(monthly.given)}</strong>
          <small>Supplier & Labour payouts</small>
        </div>
        <div className={styles.kpi}>
          <label>Net Balance (This Month)</label>
          <strong>₹ {formatPaymentMoney(monthly.net)}</strong>
          <small>Received − Given</small>
        </div>
        <div className={`${styles.kpi} ${styles.kpiPending}`}>
          <label>Total Pending Amount</label>
          <strong>₹ {formatPaymentMoney(allPending.totalPending)}</strong>
          <small>{allPending.partyCount} parties pending</small>
        </div>
        <div className={`${styles.kpi} ${styles.kpiPending}`}>
          <label>Total Pending (Pay Out)</label>
          <strong>₹ {formatPaymentMoney(allGivenPending.totalPending)}</strong>
          <small>Purchase + Labour + Reference</small>
        </div>
        <div className={`${styles.kpi} ${styles.kpiPending}`}>
          <label>Pending (0–3 Months)</label>
          <strong>₹ {formatPaymentMoney(pending.bucket03)}</strong>
        </div>
        <div className={`${styles.kpi} ${styles.kpiPending}`}>
          <label>Pending (3–6 Months)</label>
          <strong>₹ {formatPaymentMoney(pending.bucket36)}</strong>
        </div>
        <div className={`${styles.kpi} ${styles.kpiPending}`}>
          <label>Pending (6+ Months)</label>
          <strong>₹ {formatPaymentMoney(pending.bucket6plus)}</strong>
        </div>
      </div>

      <div className={styles.dashPendingTabs}>
        <button
          type="button"
          className={pendingTab === "receive" ? styles.dashPendingTabActive : styles.dashPendingTab}
          onClick={() => setPendingTab("receive")}
        >
          Pending Receive (Customers)
        </button>
        <button
          type="button"
          className={pendingTab === "given" ? styles.dashPendingTabActive : styles.dashPendingTab}
          onClick={() => setPendingTab("given")}
        >
          Pending Given (Pay Out)
        </button>
      </div>

      {pendingTab === "receive" ? (
        <>
      <div className={styles.pendingHero}>
        <div>
          <label>All Total Pending Payment (Receive)</label>
          <strong>₹ {formatPaymentMoney(allPending.totalPending)}</strong>
        </div>
        <p className={styles.pendingHeroMeta}>
          {allPending.partyCount} customer / party jinki payment abhi pending hai (Customer All
          Detail + received sync ke hisaab se)
        </p>
        <Link to={ROUTES.CUSTOMER_DETAIL} className={styles.quickLink}>
          Customer All Detail
        </Link>
      </div>

      <section className={styles.tablePanel} style={{ marginTop: "1rem" }}>
        <div className={styles.tableTitle}>All Pending Payment — Party Wise List</div>
        <div className={styles.tableScroll}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>SR.</th>
                <th>CONSUMER NO.</th>
                <th>CUSTOMER NAME</th>
                <th>MOBILE</th>
                <th>TYPE</th>
                <th>TOTAL (₹)</th>
                <th>RECEIVED (₹)</th>
                <th>PENDING (₹)</th>
                <th>AGE</th>
              </tr>
            </thead>
            <tbody>
              {allPending.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "1.25rem" }}>
                    Sab customers clear — koi pending payment nahi.
                  </td>
                </tr>
              ) : (
                allPending.rows.map((row, i) => (
                  <tr key={`${row.consumerNo}-${i}`}>
                    <td>{i + 1}</td>
                    <td>{row.consumerNo}</td>
                    <td>
                      {row.customerName}
                      {row.isBackupEntry ? " (Backup)" : ""}
                    </td>
                    <td>{row.mobile || "—"}</td>
                    <td>{row.amountType || "—"}</td>
                    <td className={styles.num}>₹ {formatPaymentMoney(row.totalAmount)}</td>
                    <td className={`${styles.num} ${styles.amountIn}`}>
                      ₹ {formatPaymentMoney(row.grandTotal)}
                    </td>
                    <td className={`${styles.num} ${styles.amountOut}`}>
                      ₹ {formatPaymentMoney(row.pending)}
                    </td>
                    <td>{row.duration} months</td>
                  </tr>
                ))
              )}
            </tbody>
            {allPending.rows.length > 0 ? (
              <tfoot>
                <tr>
                  <td colSpan={7} style={{ fontWeight: 800 }}>
                    ALL TOTAL PENDING PAYMENT
                  </td>
                  <td className={`${styles.num} ${styles.amountOut}`} colSpan={2}>
                    ₹ {formatPaymentMoney(allPending.totalPending)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </section>
        </>
      ) : (
        <>
          <div className={`${styles.pendingHero} ${styles.pendingHeroGiven}`}>
            <div>
              <label>All Total Pending Given Payment</label>
              <strong>₹ {formatPaymentMoney(allGivenPending.totalPending)}</strong>
            </div>
            <p className={styles.pendingHeroMeta}>
              Purchase Sheet (Credit/Cheque/NEFT), Labour Details balance, aur Loan/Cash reference
              commissioner — Payment Given se match hone par pending kam hoti hai.
            </p>
            <div className={styles.givenSourceChips}>
              <span>
                {GIVEN_PENDING_SOURCES.PURCHASE}: ₹{" "}
                {formatPaymentMoney(allGivenPending.bySource[GIVEN_PENDING_SOURCES.PURCHASE] || 0)}
              </span>
              <span>
                {GIVEN_PENDING_SOURCES.LABOUR}: ₹{" "}
                {formatPaymentMoney(allGivenPending.bySource[GIVEN_PENDING_SOURCES.LABOUR] || 0)}
              </span>
              <span>
                {GIVEN_PENDING_SOURCES.REFERENCE}: ₹{" "}
                {formatPaymentMoney(allGivenPending.bySource[GIVEN_PENDING_SOURCES.REFERENCE] || 0)}
              </span>
            </div>
            <div className={styles.heroLinkRow}>
              <Link to={ROUTES.PURCHASE_LIST} className={styles.quickLink}>
                Purchase Sheet
              </Link>
              <Link to={`${ROUTES.LABOUR_SHEET}/details`} className={styles.quickLink}>
                Labour Details
              </Link>
              <Link to={ROUTES.PAYMENT_GIVEN} className={styles.quickLink}>
                Payment Given
              </Link>
            </div>
          </div>

          <section className={styles.tablePanel} style={{ marginTop: "1rem" }}>
            <div className={styles.tableTitle}>Pending Given — Auto from Sheets</div>
            <div className={styles.tableScroll}>
              <table className={styles.dataTable}>
                <thead>
                  <tr>
                    <th>SR.</th>
                    <th>SOURCE</th>
                    <th>PARTY / TYPE</th>
                    <th>REF / INVOICE</th>
                    <th>CUSTOMER</th>
                    <th>PAYABLE (₹)</th>
                    <th>PAID (₹)</th>
                    <th>PENDING (₹)</th>
                    <th>DETAIL</th>
                  </tr>
                </thead>
                <tbody>
                  {allGivenPending.rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: "center", padding: "1.25rem" }}>
                        Koi pay-out pending nahi — ya sab Payment Given me clear ho chuka hai.
                      </td>
                    </tr>
                  ) : (
                    allGivenPending.rows.map((row, i) => (
                      <tr key={row.id}>
                        <td>{i + 1}</td>
                        <td>{row.source}</td>
                        <td>
                          {row.partyName}
                          <br />
                          <small>{row.partyType}</small>
                        </td>
                        <td>{row.referenceLabel || row.invoiceOrRef || "—"}</td>
                        <td>
                          {row.customerName
                            ? `${row.customerName}${row.consumerNo ? ` (${row.consumerNo})` : ""}`
                            : "—"}
                        </td>
                        <td className={styles.num}>₹ {formatPaymentMoney(row.payable)}</td>
                        <td className={`${styles.num} ${styles.amountIn}`}>
                          ₹ {formatPaymentMoney(row.paid)}
                        </td>
                        <td className={`${styles.num} ${styles.amountOut}`}>
                          ₹ {formatPaymentMoney(row.pending)}
                        </td>
                        <td>{row.detail}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {allGivenPending.rows.length > 0 ? (
                  <tfoot>
                    <tr>
                      <td colSpan={7} style={{ fontWeight: 800 }}>
                        ALL TOTAL PENDING GIVEN
                      </td>
                      <td className={`${styles.num} ${styles.amountOut}`} colSpan={2}>
                        ₹ {formatPaymentMoney(allGivenPending.totalPending)}
                      </td>
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </section>
        </>
      )}

      <section className={styles.tablePanel} style={{ marginTop: "1rem" }}>
        <div className={styles.tableTitle}>Account / Payment Mode Wise Balance</div>
        <div className={styles.tableScroll}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>ACCOUNT / MODE</th>
                <th>SETTINGS BALANCE (₹)</th>
                <th>RECEIVED (₹)</th>
                <th>GIVEN (₹)</th>
                <th>TOTAL BALANCE (₹)</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "1rem" }}>
                    Abhi koi movement nahi.
                  </td>
                </tr>
              ) : (
                accounts.map((row) => (
                  <tr key={row.mode}>
                    <td>{row.mode}</td>
                    <td className={styles.num}>₹ {formatPaymentMoney(row.openingBalance)}</td>
                    <td className={`${styles.num} ${styles.amountIn}`}>
                      ₹ {formatPaymentMoney(row.received)}
                    </td>
                    <td className={`${styles.num} ${styles.amountOut}`}>
                      ₹ {formatPaymentMoney(row.given)}
                    </td>
                    <td className={styles.num}>₹ {formatPaymentMoney(row.balance)}</td>
                    <td className={row.status === "Positive" ? styles.statusOk : styles.statusNeg}>
                      {row.status}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className={styles.pendingGrid}>
        <section className={styles.tablePanel}>
          <div className={styles.tableTitle}>Pending Payment Summary</div>
          <div className={styles.donutWrap}>
            <div className={styles.donut} style={donutStyle}>
              <div className={styles.donutHole}>
                Pending
                <br />₹ {formatPaymentMoney(pending.totalPending)}
              </div>
            </div>
            <div className={styles.legend}>
              <div className={styles.legendItem}>
                <span className={styles.swatch} style={{ background: "#66bb6a" }} />
                0–3 months — ₹ {formatPaymentMoney(pending.bucket03)}
              </div>
              <div className={styles.legendItem}>
                <span className={styles.swatch} style={{ background: "#ffa726" }} />
                3–6 months — ₹ {formatPaymentMoney(pending.bucket36)}
              </div>
              <div className={styles.legendItem}>
                <span className={styles.swatch} style={{ background: "#ef5350" }} />
                6+ months — ₹ {formatPaymentMoney(pending.bucket6plus)}
              </div>
            </div>
          </div>
        </section>
        <section className={styles.tablePanel}>
          <div className={styles.tableTitle}>Pending Count (Parties)</div>
          <div className={styles.tableScroll}>
            <table className={styles.dataTable}>
              <thead>
                <tr>
                  <th>DURATION</th>
                  <th>PARTIES</th>
                  <th>AMOUNT (₹)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>0–3 Months</td>
                  <td>{pending.counts.bucket03}</td>
                  <td className={styles.num}>₹ {formatPaymentMoney(pending.bucket03)}</td>
                </tr>
                <tr>
                  <td>3–6 Months</td>
                  <td>{pending.counts.bucket36}</td>
                  <td className={styles.num}>₹ {formatPaymentMoney(pending.bucket36)}</td>
                </tr>
                <tr>
                  <td>6+ Months</td>
                  <td>{pending.counts.bucket6plus}</td>
                  <td className={styles.num}>₹ {formatPaymentMoney(pending.bucket6plus)}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ fontWeight: 800 }}>
                    ALL TOTAL
                  </td>
                  <td className={`${styles.num} ${styles.amountOut}`} style={{ fontWeight: 800 }}>
                    ₹ {formatPaymentMoney(pending.totalPending)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <div className={styles.quickLinks}>
        <Link to={ROUTES.REPORTS_SALE} className={styles.quickLink}>
          Monthly Sale Report
        </Link>
        <Link to={ROUTES.REPORTS_PURCHASE} className={styles.quickLink}>
          Monthly Purchase Report
        </Link>
        <Link to={ROUTES.REPORTS_STOCK} className={styles.quickLink}>
          Stock Report
        </Link>
        <Link to={ROUTES.REPORTS_GST} className={styles.quickLink}>
          GST Reports
        </Link>
        <Link to={ROUTES.CUSTOMER_DETAIL} className={styles.quickLink}>
          Outstanding / Customer Detail
        </Link>
        <Link to={ROUTES.PAYMENT_RECEIVED} className={styles.quickLink}>
          Payment Received
        </Link>
      </div>

      <section className={styles.tablePanel} style={{ marginTop: "1rem" }}>
        <div className={styles.tableTitle}>Recent Transactions</div>
        <div className={styles.tableScroll}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>DATE</th>
                <th>TYPE</th>
                <th>PARTY</th>
                <th>AMOUNT (₹)</th>
                <th>PAYMENT MODE</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((t) => (
                <tr key={`${t.type}-${t.id}`}>
                  <td>{t.date}</td>
                  <td>{t.type}</td>
                  <td>{t.partyName}</td>
                  <td
                    className={`${styles.num} ${t.type === "Given" ? styles.amountOut : styles.amountIn}`}
                  >
                    ₹ {formatPaymentMoney(t.amount)}
                  </td>
                  <td>{t.paymentMode}</td>
                  <td className={styles.statusOk}>{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default PaymentTotalDashboardPage;
