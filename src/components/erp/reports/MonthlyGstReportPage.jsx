import { useMemo, useState } from "react";
import {
  MONTH_OPTIONS,
  buildGstMonthSummary,
  formatReportMoney,
} from "../../../utils/reportCalculations";
import styles from "./Reports.module.css";

function defaultFilters() {
  const d = new Date();
  return {
    month: String(d.getMonth() + 1),
    year: String(d.getFullYear()),
  };
}

function MonthlyGstReportPage() {
  const [filters, setFilters] = useState(defaultFilters);

  const gst = useMemo(
    () => buildGstMonthSummary(filters.month, filters.year),
    [filters],
  );

  const monthRows = useMemo(() => {
    return MONTH_OPTIONS.map((m) => {
      const row = buildGstMonthSummary(String(Number(m.value)), filters.year);
      return { month: m.label, ...row };
    });
  }, [filters.year]);

  const ytd = monthRows.reduce(
    (acc, r) => {
      acc.saleTaxable += r.saleTaxable;
      acc.outputGst += r.outputGst;
      acc.purchaseTaxable += r.purchaseTaxable;
      acc.inputGst += r.inputGst;
      acc.netGst += r.netGst;
      return acc;
    },
    { saleTaxable: 0, outputGst: 0, purchaseTaxable: 0, inputGst: 0, netGst: 0 },
  );

  return (
    <div>
      <div className={styles.breadcrumb}>
        Home › Reports › <strong>Monthly GST Report</strong>
      </div>
      <div className={styles.pageHead}>
        <h1>Monthly GST Report (Sale &amp; Purchase GST Summary)</h1>
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
      </div>

      <div className={styles.gstDual} style={{ margin: "0.85rem 0" }}>
        <article className={styles.gstCard}>
          <h3>Sale (Output GST)</h3>
          <dl>
            <dt>Taxable Amount</dt>
            <dd>₹ {formatReportMoney(gst.saleTaxable)}</dd>
            <dt>Total Output GST</dt>
            <dd>₹ {formatReportMoney(gst.outputGst)}</dd>
          </dl>
        </article>
        <article className={styles.gstCard}>
          <h3>Purchase (Input GST)</h3>
          <dl>
            <dt>Taxable Amount</dt>
            <dd>₹ {formatReportMoney(gst.purchaseTaxable)}</dd>
            <dt>Total Input GST</dt>
            <dd>₹ {formatReportMoney(gst.inputGst)}</dd>
          </dl>
        </article>
      </div>

      <div className={styles.tablePanel}>
        <div className={styles.tableScroll}>
          <table className={styles.reportTable}>
            <thead>
              <tr>
                <th>Month</th>
                <th className={styles.num}>Sale Taxable (₹)</th>
                <th className={styles.num}>Output GST (₹)</th>
                <th className={styles.num}>Purchase Taxable (₹)</th>
                <th className={styles.num}>Input GST (₹)</th>
                <th className={styles.num}>Net GST</th>
              </tr>
            </thead>
            <tbody>
              {monthRows.map((r) => (
                <tr key={r.month}>
                  <td>{r.month}</td>
                  <td className={styles.num}>{formatReportMoney(r.saleTaxable)}</td>
                  <td className={styles.num}>{formatReportMoney(r.outputGst)}</td>
                  <td className={styles.num}>{formatReportMoney(r.purchaseTaxable)}</td>
                  <td className={styles.num}>{formatReportMoney(r.inputGst)}</td>
                  <td className={styles.num}>
                    <span className={r.netGst >= 0 ? styles.netPayable : styles.netRefund}>
                      ₹ {formatReportMoney(Math.abs(r.netGst))} ({r.netLabel})
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total (YTD)</td>
                <td className={styles.num}>{formatReportMoney(ytd.saleTaxable)}</td>
                <td className={styles.num}>{formatReportMoney(ytd.outputGst)}</td>
                <td className={styles.num}>{formatReportMoney(ytd.purchaseTaxable)}</td>
                <td className={styles.num}>{formatReportMoney(ytd.inputGst)}</td>
                <td className={styles.num}>₹ {formatReportMoney(Math.abs(ytd.netGst))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

export default MonthlyGstReportPage;
