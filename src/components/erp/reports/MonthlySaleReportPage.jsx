import { useMemo, useState } from "react";
import {
  MONTH_OPTIONS,
  filterSaleInvoices,
  formatReportMoney,
  mapSaleRows,
  sumSaleRows,
} from "../../../utils/reportCalculations";
import styles from "./Reports.module.css";

function defaultFilters() {
  const d = new Date();
  return {
    month: String(d.getMonth() + 1),
    year: String(d.getFullYear()),
    invoiceType: "all",
  };
}

function MonthlySaleReportPage() {
  const [filters, setFilters] = useState(defaultFilters);

  const rows = useMemo(() => {
    const inv = filterSaleInvoices(filters.month, filters.year, filters.invoiceType);
    return mapSaleRows(inv);
  }, [filters]);

  const totals = useMemo(() => sumSaleRows(rows), [rows]);

  const exportCsv = () => {
    const header = ["Invoice No", "Date", "Customer", "Taxable", "CGST", "SGST", "IGST", "Total GST", "Amount"];
    const lines = rows.map((r) =>
      [r.invoiceNo, r.invoiceDate, r.customerName, r.taxable, r.cgst, r.sgst, r.igst, r.totalGst, r.invoiceAmount].join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monthly-sale-${filters.month}-${filters.year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className={styles.breadcrumb}>
        Home › Reports › <strong>Monthly Sale Report</strong>
      </div>
      <div className={styles.pageHead}>
        <div>
          <h1>Monthly Sale Report</h1>
        </div>
        <div className={styles.headActions}>
          <button type="button" className={styles.btnExport} onClick={exportCsv}>
            Export
          </button>
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
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label>
          Invoice Type
          <select
            value={filters.invoiceType}
            onChange={(e) => setFilters((f) => ({ ...f, invoiceType: e.target.value }))}
          >
            <option value="all">All</option>
            <option value="with-gst">With GST</option>
            <option value="without-gst">Without GST</option>
          </select>
        </label>
      </div>

      <div className={styles.summaryStrip} style={{ margin: "0.85rem 0" }}>
        <div className={styles.summaryChip}>
          <span>Total Invoices</span>
          <strong>{totals.count}</strong>
        </div>
        <div className={styles.summaryChip}>
          <span>Total Sales Amount</span>
          <strong>₹ {formatReportMoney(totals.invoiceAmount)}</strong>
        </div>
        <div className={styles.summaryChip}>
          <span>Total Taxable</span>
          <strong>₹ {formatReportMoney(totals.taxable)}</strong>
        </div>
        <div className={styles.summaryChip}>
          <span>Total GST (Output)</span>
          <strong>₹ {formatReportMoney(totals.totalGst)}</strong>
        </div>
      </div>

      <div className={styles.tablePanel}>
        <div className={styles.tableScroll}>
          <table className={styles.reportTable}>
            <thead>
              <tr>
                <th>#</th>
                <th>Invoice No.</th>
                <th>Invoice Date</th>
                <th>Customer Name</th>
                <th className={styles.num}>Taxable (₹)</th>
                <th className={styles.num}>CGST (₹)</th>
                <th className={styles.num}>SGST (₹)</th>
                <th className={styles.num}>IGST (₹)</th>
                <th className={styles.num}>Total GST (₹)</th>
                <th className={styles.num}>Invoice Amount (₹)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11}>Is month me koi invoice nahi — Sale Sheet se generate karein.</td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.invoiceNo + r.sr}>
                    <td>{r.sr}</td>
                    <td>{r.invoiceNo}</td>
                    <td>{r.invoiceDate}</td>
                    <td>{r.customerName}</td>
                    <td className={styles.num}>{formatReportMoney(r.taxable)}</td>
                    <td className={styles.num}>{formatReportMoney(r.cgst)}</td>
                    <td className={styles.num}>{formatReportMoney(r.sgst)}</td>
                    <td className={styles.num}>{formatReportMoney(r.igst)}</td>
                    <td className={styles.num}>{formatReportMoney(r.totalGst)}</td>
                    <td className={styles.num}>{formatReportMoney(r.invoiceAmount)}</td>
                    <td className={styles.statusPaid}>{r.status}</td>
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 ? (
              <tfoot>
                <tr>
                  <td colSpan={4}>Total</td>
                  <td className={styles.num}>{formatReportMoney(totals.taxable)}</td>
                  <td className={styles.num}>{formatReportMoney(totals.cgst)}</td>
                  <td className={styles.num}>{formatReportMoney(totals.sgst)}</td>
                  <td className={styles.num}>{formatReportMoney(totals.igst)}</td>
                  <td className={styles.num}>{formatReportMoney(totals.totalGst)}</td>
                  <td className={styles.num}>{formatReportMoney(totals.invoiceAmount)}</td>
                  <td />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>
    </div>
  );
}

export default MonthlySaleReportPage;
