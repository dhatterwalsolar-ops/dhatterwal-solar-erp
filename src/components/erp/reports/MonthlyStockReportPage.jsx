import { useMemo, useState } from "react";
import { PRODUCT_CATEGORIES } from "../../../constants/productSheet";
import {
  MONTH_OPTIONS,
  buildStockReportRows,
  formatReportMoney,
  sumStockRows,
} from "../../../utils/reportCalculations";
import styles from "./Reports.module.css";

function defaultFilters() {
  const d = new Date();
  return {
    month: String(d.getMonth() + 1),
    year: String(d.getFullYear()),
    category: "all",
  };
}

function MonthlyStockReportPage() {
  const [filters, setFilters] = useState(defaultFilters);

  const rows = useMemo(() => buildStockReportRows(filters.category), [filters.category]);
  const totals = useMemo(() => sumStockRows(rows), [rows]);

  return (
    <div>
      <div className={styles.breadcrumb}>
        Home › Reports › <strong>Monthly Stock Report</strong>
      </div>
      <div className={styles.pageHead}>
        <h1>Monthly Stock Report</h1>
        <div className={styles.headActions}>
          <button type="button" className={styles.btnPrint} onClick={() => window.print()}>
            Print
          </button>
        </div>
      </div>

      <div className={styles.filterBar}>
        <label>
          Select Month
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
          Select Year
          <select value={filters.year} onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}>
            {[2025, 2026].map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label>
          Item Category
          <select
            value={filters.category}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
          >
            <option value="all">All</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.tablePanel} style={{ marginTop: "0.85rem" }}>
        <div className={styles.tableScroll}>
          <table className={styles.reportTable}>
            <thead>
              <tr>
                <th>#</th>
                <th>Item Name</th>
                <th>HSN / SAC</th>
                <th className={styles.num}>Opening Qty</th>
                <th className={styles.num}>Purchase Qty</th>
                <th className={styles.num}>Sale Qty</th>
                <th className={styles.num}>Closing Qty</th>
                <th>Unit</th>
                <th className={styles.num}>Rate (₹)</th>
                <th className={styles.num}>Stock Value (₹)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.itemName}>
                  <td>{r.sr}</td>
                  <td>{r.itemName}</td>
                  <td>{r.hsn}</td>
                  <td className={styles.num}>{r.openingQty}</td>
                  <td className={styles.num}>{r.purchaseQty}</td>
                  <td className={styles.num}>{r.saleQty}</td>
                  <td className={styles.num}>{r.closingQty}</td>
                  <td>{r.unit}</td>
                  <td className={styles.num}>{formatReportMoney(r.rate)}</td>
                  <td className={styles.num}>{formatReportMoney(r.stockValue)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={9} style={{ textAlign: "right" }}>
                  Total Stock Value
                </td>
                <td className={styles.num}>₹ {formatReportMoney(totals.stockValue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

export default MonthlyStockReportPage;
