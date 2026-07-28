import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ErpIcon } from "../../components/erp/ErpIcon";
import { AUTH_ROLES } from "../../constants/auth";
import { ROUTES } from "../../constants/routes";
import { getAuthSession } from "../../utils/authSession";
import {
  FOLLOW_UP_AFTER_DAYS,
  buildTodayFollowUps,
} from "../../utils/dashboardFollowUp";
import styles from "./DashboardPage.module.css";

const ALL_STAT_CARDS = [
  { title: "Total Loan Cases", value: "12", note: "Active Loan Cases", tone: "green", icon: "loan", to: ROUTES.LOAN_CASE },
  { title: "Total Cash Cases", value: "18", note: "This Month", tone: "yellow", icon: "cash", to: ROUTES.CASH_CASE },
  { title: "Today's Sales", value: "₹2,45,000", note: "5 Invoices", tone: "blue", icon: "sale", to: ROUTES.SALE_SHEET },
  { title: "Today's Purchases", value: "₹1,20,000", note: "3 Purchases", tone: "purple", icon: "purchase", to: ROUTES.PURCHASE_NEW },
  { title: "Available Stock", value: "156", note: "Products in Stock", tone: "orange", icon: "stock", to: ROUTES.STOCK_SHEET },
  { title: "Pending Queries", value: "07", note: "Requires Action", tone: "red", icon: "query", to: ROUTES.QUERY_PENDING },
];

const ALL_QUICK_ACTIONS = [
  { label: "+ New Customer", to: ROUTES.CUSTOMER_DETAIL, tone: "green" },
  { label: "New Loan Case", to: ROUTES.LOAN_CASE, tone: "dark" },
  { label: "New Cash Sale", to: ROUTES.CASH_CASE, tone: "gold" },
  { label: "Stock Entry", to: ROUTES.STOCK_SHEET, tone: "blue" },
  { label: "Purchase Entry", to: ROUTES.PURCHASE_NEW, tone: "orange" },
  { label: "Payment Entry", to: ROUTES.PAYMENT_SHEET, tone: "purple" },
];

const LOW_STOCK = [
  ["540W Mono Panel", "Panel", "8", "Low Stock"],
  ["5kW Hybrid Inverter", "Inverter", "3", "Low Stock"],
  ["Battery 5kWh", "Battery", "2", "Low Stock"],
  ["MC4 Connector Pair", "Accessory", "15", "Low Stock"],
  ["DC Cable 4mm", "Accessory", "6", "Low Stock"],
];

function DashboardPage() {
  const session = getAuthSession();
  const isStaff = session?.role === AUTH_ROLES.STAFF;
  const [followRefresh, setFollowRefresh] = useState(0);

  const followUps = useMemo(() => {
    void followRefresh;
    return buildTodayFollowUps();
  }, [followRefresh]);

  const statCards = isStaff
    ? ALL_STAT_CARDS.filter((c) =>
        [ROUTES.LOAN_CASE, ROUTES.CASH_CASE, ROUTES.SALE_SHEET].includes(c.to),
      )
    : ALL_STAT_CARDS;

  const quickActions = isStaff
    ? ALL_QUICK_ACTIONS.filter((a) =>
        [ROUTES.LOAN_CASE, ROUTES.CASH_CASE, ROUTES.SALE_SHEET, ROUTES.LABOUR_SHEET].includes(
          a.to,
        ),
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
            onClick={() => setFollowRefresh((n) => n + 1)}
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
              <h2>Monthly Sales Overview</h2>
              <select defaultValue="month">
                <option value="month">This Month</option>
              </select>
            </div>
            <div className={styles.chart}>
              {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"].map((month, index) => (
                <div key={month} className={styles.barWrap}>
                  <div className={styles.bar} style={{ height: `${45 + index * 8}%` }} />
                  <span>{month}</span>
                </div>
              ))}
            </div>
          </article>

          <article className={styles.panel}>
            <h2>Stock Status (Top 5 Low Stock Items)</h2>
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
                  {LOW_STOCK.map((row) => (
                    <tr key={row[0]}>
                      <td>{row[0]}</td>
                      <td>{row[1]}</td>
                      <td>{row[2]}</td>
                      <td>
                        <span className={styles.lowTag}>{row[3]}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      ) : null}

      {!isStaff ? (
        <section className={styles.bottomGrid}>
          <article className={styles.miniCard}>Pending Labour Payments — ₹45,000</article>
          <article className={styles.miniCard}>Low Stock Alert — 12 items</article>
          <article className={styles.miniCard}>Query Pending Overview — 07 items</article>
          <article className={`${styles.miniCard} ${styles.gstCard}`}>
            <p>GST Due Reminder</p>
            <strong>GSTR-3B for Jun-2025 due on 20 Jul 2025</strong>
            <Link to={ROUTES.GST_REPORT}>File Now</Link>
          </article>
        </section>
      ) : (
        <section className={styles.bottomGrid}>
          <article className={styles.miniCard}>Pending Labour Payments — ₹45,000</article>
        </section>
      )}
    </div>
  );
}

export default DashboardPage;
