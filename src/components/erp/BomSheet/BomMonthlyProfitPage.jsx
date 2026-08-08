import { useMemo, useState } from "react";
import { MONTH_OPTIONS } from "../../../utils/reportCalculations";
import {
  buildBomMonthlyProfitReport,
  formatBomMoney,
} from "../../../utils/bomMonthlyProfit";
import styles from "./BomManagement.module.css";

function defaultFilters() {
  const d = new Date();
  return {
    month: String(d.getMonth() + 1),
    year: String(d.getFullYear()),
  };
}

function BomMonthlyProfitPage() {
  const [filters, setFilters] = useState(defaultFilters);

  const report = useMemo(
    () => buildBomMonthlyProfitReport(filters.month, filters.year),
    [filters],
  );

  const profitClass =
    report.totals.profit >= 0 ? styles.profit : styles.loss;

  return (
    <div>
      <div className={styles.breadcrumb}>
        Home › BOM Sheet › <strong>Monthly Profit</strong>
      </div>
      <div className={styles.pageHead}>
        <div>
          <h1>BOM Monthly Profit</h1>
          <p>
            Is mahine kitne setup pe kitna kharch, customer se kitna amount mila, labour (stand)
            kitna, aur net monthly profit.
          </p>
        </div>
        <button type="button" className={styles.btnPrint} onClick={() => window.print()}>
          Print
        </button>
      </div>

      <div className={styles.filterBar}>
        <label>
          Month
          <select
            value={filters.month}
            onChange={(e) => setFilters((f) => ({ ...f, month: e.target.value }))}
          >
            {MONTH_OPTIONS.map((m) => (
              <option key={m.value} value={String(Number(m.value))}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Year
          <select
            value={filters.year}
            onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.summaryStrip} style={{ margin: "0.85rem 0" }}>
        <div className={styles.summaryCard}>
          <span>Total Setups</span>
          <strong>{report.setupCount}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>Materials Kharch</span>
          <strong>{formatBomMoney(report.totals.materials)}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>Site Charges</span>
          <strong>{formatBomMoney(report.totals.charges)}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>Labour (Stand)</span>
          <strong>{formatBomMoney(report.totals.labour)}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>Total Kharch</span>
          <strong>{formatBomMoney(report.totals.totalKharch)}</strong>
        </div>
        <div className={styles.summaryCard}>
          <span>Customer se Amount</span>
          <strong>{formatBomMoney(report.totals.totalReceived)}</strong>
        </div>
        <div className={`${styles.summaryCard} ${profitClass}`}>
          <span>Monthly Profit</span>
          <strong>{formatBomMoney(report.totals.profit)}</strong>
        </div>
      </div>

      <p className={styles.hint}>
        Profit = Customer Amount − Total Kharch (materials + charges + reference + stand labour).
        Customer amount = Payment ledger + sale invoices (double-count avoid).
      </p>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Sr</th>
              <th>Date</th>
              <th>Consumer No.</th>
              <th>Customer</th>
              <th>Setup</th>
              <th>Team</th>
              <th className={styles.num}>Materials</th>
              <th className={styles.num}>Charges</th>
              <th className={styles.num}>Labour</th>
              <th className={styles.num}>Total Kharch</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 ? (
              <tr>
                <td colSpan={10} className={styles.empty}>
                  Is mahine koi BOM setup nahi mila.
                </td>
              </tr>
            ) : (
              report.rows.map((r) => (
                <tr key={r.consumerNo}>
                  <td>{r.sr}</td>
                  <td>{r.siteDate || "—"}</td>
                  <td>{r.consumerNo}</td>
                  <td>{r.customerName}</td>
                  <td>{r.setupKw}</td>
                  <td>{r.teamWork}</td>
                  <td className={styles.num}>{formatBomMoney(r.materials)}</td>
                  <td className={styles.num}>{formatBomMoney(r.charges)}</td>
                  <td className={styles.num}>{formatBomMoney(r.labour)}</td>
                  <td className={styles.num}>{formatBomMoney(r.totalKharch)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default BomMonthlyProfitPage;
