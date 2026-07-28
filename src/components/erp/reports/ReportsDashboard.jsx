import { Link } from "react-router-dom";
import { ROUTES } from "../../../constants/routes";
import {
  MONTH_OPTIONS,
  buildDashboardSummary,
  formatReportMoney,
} from "../../../utils/reportCalculations";
import styles from "./Reports.module.css";

function currentMonthYear() {
  const d = new Date();
  return { month: String(d.getMonth() + 1), year: String(d.getFullYear()) };
}

function ReportsDashboard() {
  const { month, year } = currentMonthYear();
  const summary = buildDashboardSummary(month, year);

  return (
    <div>
      <div className={styles.breadcrumb}>
        Home › <strong>Reports</strong> › Reports Dashboard
      </div>
      <div className={styles.pageHead}>
        <div>
          <h1>Reports Dashboard</h1>
          <p>Monthly sale, purchase, stock aur GST reports — reference layout ke hisaab se.</p>
        </div>
      </div>

      <div className={styles.cardsGrid}>
        <article className={`${styles.reportCard} ${styles.cardSale}`}>
          <div className={styles.cardIcon}>🛒</div>
          <h2>Monthly Sale Report</h2>
          <p>Invoice File / sale invoices se auto data</p>
          <Link to={ROUTES.REPORTS_SALE} className={styles.cardBtn}>
            View Report
          </Link>
        </article>
        <article className={`${styles.reportCard} ${styles.cardPurchase}`}>
          <div className={styles.cardIcon}>🧺</div>
          <h2>Monthly Purchase Report</h2>
          <p>Purchase save history se supplier-wise GST</p>
          <Link to={ROUTES.REPORTS_PURCHASE} className={styles.cardBtn}>
            View Report
          </Link>
        </article>
        <article className={`${styles.reportCard} ${styles.cardStock}`}>
          <div className={styles.cardIcon}>📦</div>
          <h2>Monthly Stock Report</h2>
          <p>Product catalog + movement summary</p>
          <Link to={ROUTES.REPORTS_STOCK} className={styles.cardBtn}>
            View Report
          </Link>
        </article>
        <article className={`${styles.reportCard} ${styles.cardGst}`}>
          <div className={styles.cardIcon}>🧾</div>
          <h2>Monthly GST Report</h2>
          <p>Output vs Input GST reconciliation</p>
          <Link to={ROUTES.REPORTS_GST} className={styles.cardBtn}>
            View Report
          </Link>
        </article>
      </div>

      <section style={{ marginTop: "1.25rem" }}>
        <h2 style={{ fontSize: "0.9375rem", color: "var(--color-green-dark)", marginBottom: "0.65rem" }}>
          Report Summary (This Month — {MONTH_OPTIONS.find((m) => m.value === month.padStart(2, "0"))?.label}{" "}
          {year})
        </h2>
        <div className={styles.kpiRow}>
          <div className={`${styles.kpi} ${styles.kpiSales}`}>
            <label>Total Sales</label>
            <strong>₹ {formatReportMoney(summary.totalSales)}</strong>
            <small>{summary.saleCount} invoices</small>
          </div>
          <div className={`${styles.kpi} ${styles.kpiPurchase}`}>
            <label>Total Purchase</label>
            <strong>₹ {formatReportMoney(summary.totalPurchase)}</strong>
            <small>{summary.purchaseCount} bills</small>
          </div>
          <div className={`${styles.kpi} ${styles.kpiStock}`}>
            <label>Total Stock Value</label>
            <strong>₹ {formatReportMoney(summary.totalStockValue)}</strong>
            <small>Catalog based</small>
          </div>
          <div className={`${styles.kpi} ${styles.kpiOutGst}`}>
            <label>Output GST (Sale)</label>
            <strong>₹ {formatReportMoney(summary.outputGst)}</strong>
          </div>
          <div className={`${styles.kpi} ${styles.kpiInGst}`}>
            <label>Input GST (Purchase)</label>
            <strong>₹ {formatReportMoney(summary.inputGst)}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ReportsDashboard;
