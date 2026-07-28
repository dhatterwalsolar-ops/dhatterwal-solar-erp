import { useEffect, useMemo, useState } from "react";
import {
  getGstInvoices,
  INVOICE_FILE_SYNC_EVENT,
} from "../../../utils/invoiceStorage";
import styles from "./GstReportSheet.module.css";

function GstReportSheet() {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const onSync = () => setRefreshKey((k) => k + 1);
    window.addEventListener(INVOICE_FILE_SYNC_EVENT, onSync);
    return () => window.removeEventListener(INVOICE_FILE_SYNC_EVENT, onSync);
  }, []);

  const invoices = useMemo(() => getGstInvoices(), [refreshKey]);

  const monthlySummary = useMemo(() => {
    const map = {};
    invoices.forEach((inv) => {
      if (!map[inv.monthKey]) {
        map[inv.monthKey] = { taxable: 0, gst: 0, total: 0, count: 0 };
      }
      map[inv.monthKey].taxable += inv.taxableAmount;
      map[inv.monthKey].gst += inv.gstAmount;
      map[inv.monthKey].total += inv.totalAmount;
      map[inv.monthKey].count += 1;
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [invoices]);

  return (
    <section className={styles.sheet}>
      <header className={styles.toolbar}>
        <div>
          <h1>GST Report</h1>
          <p>
            With GST invoices from Sale Sheet appear here automatically (monthly
            summary + invoice list).
          </p>
        </div>
        <button type="button" className={styles.refreshBtn} onClick={() => setRefreshKey((k) => k + 1)}>
          Refresh
        </button>
      </header>

      <div className={styles.summaryGrid}>
        {monthlySummary.length === 0 ? (
          <p className={styles.empty}>No With GST invoices yet. Generate from Sale Sheet.</p>
        ) : (
          monthlySummary.map(([month, data]) => (
            <article key={month} className={styles.summaryCard}>
              <h2>{month}</h2>
              <p>Invoices: {data.count}</p>
              <p>Taxable: ₹{data.taxable.toLocaleString("en-IN")}</p>
              <p>GST (18%): ₹{data.gst.toLocaleString("en-IN")}</p>
              <strong>Total: ₹{data.total.toLocaleString("en-IN")}</strong>
            </article>
          ))
        )}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Sr.</th>
              <th>Invoice No.</th>
              <th>Date</th>
              <th>Consumer No.</th>
              <th>Customer</th>
              <th>Setup</th>
              <th>Taxable</th>
              <th>GST</th>
              <th>Total</th>
              <th>Month</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.srNo}</td>
                <td>{inv.invoiceNo || inv.id}</td>
                <td>{inv.date}</td>
                <td>{inv.consumerNo}</td>
                <td>{inv.customerName}</td>
                <td>{inv.setupKw}</td>
                <td>₹{inv.taxableAmount.toLocaleString("en-IN")}</td>
                <td>₹{inv.gstAmount.toLocaleString("en-IN")}</td>
                <td>₹{inv.totalAmount.toLocaleString("en-IN")}</td>
                <td>{inv.monthKey}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default GstReportSheet;
