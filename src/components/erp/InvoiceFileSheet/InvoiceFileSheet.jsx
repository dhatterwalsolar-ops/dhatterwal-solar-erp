import { useEffect, useMemo, useState } from "react";
import {
  getInvoiceFileRecords,
  INVOICE_FILE_SYNC_EVENT,
} from "../../../utils/invoiceStorage";
import styles from "./InvoiceFileSheet.module.css";

function formatMoney(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function InvoiceFileSheet() {
  const [records, setRecords] = useState(() => getInvoiceFileRecords());
  const [query, setQuery] = useState("");

  useEffect(() => {
    const refresh = () => setRecords(getInvoiceFileRecords());
    window.addEventListener(INVOICE_FILE_SYNC_EVENT, refresh);
    return () => window.removeEventListener(INVOICE_FILE_SYNC_EVENT, refresh);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return records;
    const q = query.toLowerCase();
    return records.filter(
      (row) =>
        String(row.srNo).includes(q) ||
        row.invoiceNo?.toLowerCase().includes(q) ||
        row.customerName?.toLowerCase().includes(q) ||
        row.fatherName?.toLowerCase().includes(q) ||
        row.address?.toLowerCase().includes(q) ||
        row.date?.includes(q),
    );
  }, [records, query]);

  return (
    <section className={styles.sheet}>
      <header className={styles.toolbar}>
        <div>
          <h1>Invoice File</h1>
          <p>
            Har generate par Sr. No. aur serial Settings series se auto badhega.{" "}
            <strong>Date</strong> us din ki hogi jis din invoice generate hua (serial order ke
            hisaab se), sale row ki date se alag ho sakti hai.
          </p>
        </div>
        <div className={styles.toolbarActions}>
          <input
            type="search"
            className={styles.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, date, Sr..."
          />
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => setRecords(getInvoiceFileRecords())}
          >
            Refresh
          </button>
        </div>
      </header>

      <div className={styles.tableWrap}>
        {filtered.length === 0 ? (
          <p className={styles.empty}>
            Abhi koi invoice nahi. Sale Sheet → Generate Invoice se pehli entry yahan aayegi.
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Sr. No.</th>
                <th>Date</th>
                <th>Customer Name</th>
                <th>Customer Father Name</th>
                <th>Address</th>
                <th>Amount</th>
                <th>GST</th>
                <th>Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td className={styles.srCol}>{row.srNo}</td>
                  <td>{row.date}</td>
                  <td>{row.customerName}</td>
                  <td>{row.fatherName || "—"}</td>
                  <td className={styles.addressCell}>{row.address || "—"}</td>
                  <td>{formatMoney(row.taxableAmount)}</td>
                  <td>{formatMoney(row.gstAmount)}</td>
                  <td className={styles.totalCell}>{formatMoney(row.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export default InvoiceFileSheet;
