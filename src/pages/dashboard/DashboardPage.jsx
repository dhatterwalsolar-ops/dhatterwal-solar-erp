import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ErpIcon } from "../../components/erp/ErpIcon";
import { AUTH_ROLES } from "../../constants/auth";
import { ROUTES } from "../../constants/routes";
import { getAuthSession } from "../../utils/authSession";
import {
  FOLLOW_UP_AFTER_DAYS,
  buildTodayFollowUps,
} from "../../utils/dashboardFollowUp";
import {
  DASHBOARD_SYNC_EVENTS,
  buildDashboardStatCards,
  getLowStockRows,
  getNotificationCount,
} from "../../utils/dashboardStats";
import styles from "./DashboardPage.module.css";

const ALL_QUICK_ACTIONS = [
  { label: "+ New Customer", to: ROUTES.CUSTOMER_DETAIL, tone: "green" },
  { label: "New Loan Case", to: ROUTES.LOAN_CASE, tone: "dark" },
  { label: "New Cash Sale", to: ROUTES.CASH_CASE, tone: "gold" },
  { label: "New Name/Load", to: ROUTES.UPDATE_NAME_LOAD, tone: "blue" },
  { label: "Stock Entry", to: ROUTES.STOCK_SHEET, tone: "blue" },
  { label: "Purchase Entry", to: ROUTES.PURCHASE_NEW, tone: "orange" },
  { label: "Payment Entry", to: ROUTES.PAYMENT_SHEET, tone: "purple" },
];

function DashboardPage() {
  const session = getAuthSession();
  const isStaff = session?.role === AUTH_ROLES.STAFF;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    DASHBOARD_SYNC_EVENTS.forEach((name) => window.addEventListener(name, bump));
    window.addEventListener("focus", bump);
    return () => {
      DASHBOARD_SYNC_EVENTS.forEach((name) => window.removeEventListener(name, bump));
      window.removeEventListener("focus", bump);
    };
  }, []);

  const followUps = useMemo(() => {
    void tick;
    return buildTodayFollowUps();
  }, [tick]);

  const statCards = useMemo(() => {
    void tick;
    const all = buildDashboardStatCards();
    if (!isStaff) return all;
    return all.filter((c) =>
      [ROUTES.LOAN_CASE, ROUTES.CASH_CASE, ROUTES.SALE_SHEET].includes(c.to),
    );
  }, [tick, isStaff]);

  const lowStock = useMemo(() => {
    void tick;
    return getLowStockRows(5);
  }, [tick]);

  const pendingQueryNote = useMemo(() => {
    void tick;
    const card = buildDashboardStatCards().find((c) => c.to === ROUTES.QUERY_PENDING);
    return card?.value ?? "00";
  }, [tick]);

  const notifCount = useMemo(() => {
    void tick;
    return getNotificationCount();
  }, [tick]);

  const quickActions = isStaff
    ? ALL_QUICK_ACTIONS.filter((a) =>
        [
          ROUTES.LOAN_CASE,
          ROUTES.CASH_CASE,
          ROUTES.UPDATE_NAME_LOAD,
          ROUTES.SALE_SHEET,
          ROUTES.LABOUR_SHEET,
        ].includes(a.to),
      )
    : ALL_QUICK_ACTIONS;

  const followUpSection = (
    <section
      className={`${styles.followUpSection} ${isStaff ? styles.followUpSectionStaff : ""}`}
      aria-labelledby="today-follow-up-heading"
    >
      <div className={styles.followUpHead}>
        <div>
          <h2 id="today-follow-up-heading">Today Follow Up</h2>
          <p>
            Loan apply ya Name/Load update ke {FOLLOW_UP_AFTER_DAYS}+ din ho chuke — aaj call /
            status check karein.
          </p>
        </div>
        <div className={styles.followUpMeta}>
          <span className={styles.followUpCount}>{followUps.length} pending</span>
          <button
            type="button"
            className={styles.followUpRefresh}
            onClick={() => setTick((n) => n + 1)}
          >
            Refresh list
          </button>
        </div>
      </div>

      <div className={styles.followUpTableWrap}>
        {followUps.length === 0 ? (
          <p className={styles.followUpEmpty}>
            Abhi koi {FOLLOW_UP_AFTER_DAYS}-din wala follow-up nahi. Loan Case date ya Update
            Name/Load Save ke baad yahan dikhega.
          </p>
        ) : (
          <table className={styles.followUpTable}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Consumer No.</th>
                <th>Customer Name</th>
                <th>Mobile</th>
                <th>Apply / Update Date</th>
                <th>Days</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {followUps.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span
                      className={
                        item.kind === "loan" ? styles.tagLoanFollow : styles.tagNameLoadFollow
                      }
                    >
                      {item.kindLabel}
                    </span>
                    <span className={styles.followDetail}>{item.detail}</span>
                  </td>
                  <td>{item.consumerNo}</td>
                  <td>{item.customerName}</td>
                  <td>{item.mobile || "—"}</td>
                  <td>{item.referenceDate}</td>
                  <td className={styles.daysCell}>{item.daysAgo} days</td>
                  <td>
                    <Link
                      to={
                        item.kind === "loan" ? ROUTES.LOAN_CASE : ROUTES.UPDATE_NAME_LOAD
                      }
                      className={styles.followLink}
                    >
                      Open sheet →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );

  return (
    <div className={styles.page}>
      {!isStaff ? (
        <section className={styles.statsGrid}>
          {statCards.map((card) => (
            <article key={card.title} className={`${styles.statCard} ${styles[card.tone]}`}>
              <div className={styles.statTop}>
                <span className={styles.statIcon} aria-hidden="true">
                  <ErpIcon name={card.icon} />
                </span>
                <div>
                  <p>{card.title}</p>
                  <strong>{card.value}</strong>
                  <small>{card.note}</small>
                </div>
              </div>
              <Link to={card.to}>View Details →</Link>
            </article>
          ))}
        </section>
      ) : null}

      {isStaff ? (
        <section className={styles.staffStatsRow}>
          {statCards.map((card) => (
            <article key={card.title} className={`${styles.statCard} ${styles[card.tone]}`}>
              <div className={styles.statTop}>
                <span className={styles.statIcon} aria-hidden="true">
                  <ErpIcon name={card.icon} />
                </span>
                <div>
                  <p>{card.title}</p>
                  <strong>{card.value}</strong>
                </div>
              </div>
              <Link to={card.to}>View →</Link>
            </article>
          ))}
        </section>
      ) : null}

      <section className={styles.quickActions}>
        {quickActions.map((action) => (
          <Link
            key={action.label}
            to={action.to}
            className={`${styles.actionBtn} ${styles[`action_${action.tone}`]}`}
          >
            {action.label}
          </Link>
        ))}
      </section>

      {followUpSection}

      {!isStaff ? (
        <section className={styles.midGrid}>
          <article className={styles.panel}>
            <div className={styles.panelHead}>
              <h2>Alerts</h2>
            </div>
            <div className={styles.chart} style={{ alignItems: "stretch", justifyContent: "center" }}>
              <p style={{ margin: "auto", color: "var(--color-text-soft)", textAlign: "center" }}>
                Follow-ups + pending queries: <strong>{notifCount}</strong>
                <br />
                Bell icon upar bhi yahi count dikhata hai.
              </p>
            </div>
          </article>

          <article className={styles.panel}>
            <h2>Stock Status (Top Low Stock Items)</h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Current Stock</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.length === 0 ? (
                    <tr>
                      <td colSpan={4}>Abhi koi low-stock line nahi (balance 1–15).</td>
                    </tr>
                  ) : (
                    lowStock.map((row) => (
                      <tr key={row[0]}>
                        <td>{row[0]}</td>
                        <td>{row[1]}</td>
                        <td>{row[2]}</td>
                        <td>
                          <span className={styles.lowTag}>{row[3]}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : null}

      {!isStaff ? (
        <section className={styles.bottomGrid}>
          <article className={styles.miniCard}>
            Today follow-ups — {followUps.length}
          </article>
          <article className={styles.miniCard}>
            Low Stock Alert — {lowStock.length} items
          </article>
          <article className={styles.miniCard}>
            Query Pending Overview — {pendingQueryNote} items
          </article>
          <article className={`${styles.miniCard} ${styles.gstCard}`}>
            <p>GST Due Reminder</p>
            <strong>Check GST Report for current month filing</strong>
            <Link to={ROUTES.GST_REPORT}>Open GST Report</Link>
          </article>
        </section>
      ) : (
        <section className={styles.bottomGrid}>
          <article className={styles.miniCard}>
            Today follow-ups — {followUps.length}
          </article>
        </section>
      )}
    </div>
  );
}

export default DashboardPage;
