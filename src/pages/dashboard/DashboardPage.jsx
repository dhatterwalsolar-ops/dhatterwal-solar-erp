import { Link } from "react-router-dom";
import { ErpIcon } from "../../components/erp/ErpIcon";
import { ROUTES } from "../../constants/routes";
import styles from "./DashboardPage.module.css";

const STAT_CARDS = [
  { title: "Total Loan Cases", value: "12", note: "Active Loan Cases", tone: "green", icon: "loan", to: ROUTES.LOAN_CASE },
  { title: "Total Cash Cases", value: "18", note: "This Month", tone: "yellow", icon: "cash", to: ROUTES.CASH_CASE },
  { title: "Today's Sales", value: "₹2,45,000", note: "5 Invoices", tone: "blue", icon: "sale", to: ROUTES.SALE_SHEET },
  { title: "Today's Purchases", value: "₹1,20,000", note: "3 Purchases", tone: "purple", icon: "purchase", to: ROUTES.PURCHASE_SHEET },
  { title: "Available Stock", value: "156", note: "Products in Stock", tone: "orange", icon: "stock", to: ROUTES.STOCK_SHEET },
  { title: "Pending Queries", value: "07", note: "Requires Action", tone: "red", icon: "query", to: ROUTES.QUERY_PENDING },
];

const QUICK_ACTIONS = [
  { label: "+ New Customer", to: ROUTES.CUSTOMER_DETAIL, tone: "green" },
  { label: "New Loan Case", to: ROUTES.LOAN_CASE, tone: "dark" },
  { label: "New Cash Sale", to: ROUTES.CASH_CASE, tone: "gold" },
  { label: "Stock Entry", to: ROUTES.STOCK_SHEET, tone: "blue" },
  { label: "Purchase Entry", to: ROUTES.PURCHASE_SHEET, tone: "orange" },
  { label: "Payment Entry", to: ROUTES.PAYMENT_SHEET, tone: "purple" },
];

const LOW_STOCK = [
  ["540W Mono Panel", "Panel", "8", "Low Stock"],
  ["5kW Hybrid Inverter", "Inverter", "3", "Low Stock"],
  ["Battery 5kWh", "Battery", "2", "Low Stock"],
  ["MC4 Connector Pair", "Accessory", "15", "Low Stock"],
  ["DC Cable 4mm", "Accessory", "6", "Low Stock"],
];

const TASKS = [
  ["Loan Follow-up — Ramesh Kumar", "10:30 AM"],
  ["Pending Payment — Green Homes", "12:00 PM"],
  ["Site Visit — Jind Project", "2:30 PM"],
  ["Query Reply — Net Metering", "4:00 PM"],
];

function DashboardPage() {
  return (
    <div className={styles.page}>
      <section className={styles.statsGrid}>
        {STAT_CARDS.map((card) => (
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

      <section className={styles.quickActions}>
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.label}
            to={action.to}
            className={`${styles.actionBtn} ${styles[`action_${action.tone}`]}`}
          >
            {action.label}
          </Link>
        ))}
      </section>

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

        <article className={styles.panel}>
          <h2>Today&apos;s Important Tasks</h2>
          <ul className={styles.tasks}>
            {TASKS.map(([title, time]) => (
              <li key={title}>
                <span className={styles.taskDot} />
                <div>
                  <p>{title}</p>
                  <small>{time}</small>
                </div>
              </li>
            ))}
          </ul>
        </article>
      </section>

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
    </div>
  );
}

export default DashboardPage;
