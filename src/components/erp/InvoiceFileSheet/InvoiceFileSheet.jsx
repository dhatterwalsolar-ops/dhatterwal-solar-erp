import { useEffect, useMemo, useState } from "react";
import { TEMP_ALLOW_INVOICE_DELETE } from "../../../constants/tempInvoiceDelete";
import {
  getInvoiceFileRecords,
  INVOICE_FILE_SYNC_EVENT,
} from "../../../utils/invoiceStorage";
import {
  clearedSaleInvoiceFields,
  deleteOldInvoiceCompletely,
} from "../../../utils/tempInvoiceDelete";
import { loadSaleCaseRows, saveSaleCaseRows } from "../../../utils/saleCaseStorage";
import { SALE_CASE_SYNC_EVENT } from "../../../utils/saleCaseSync";
import styles from "./InvoiceFileSheet.module.css";

function formatMoney(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function clearSaleRowsForInvoice(invoice) {
  if (!invoice) return;
  const rows = loadSaleCaseRows();
  let changed = false;
  const next = rows.map((row) => {
    const match =
      (invoice.id && row.invoiceId === invoice.id) ||
      (invoice.invoiceNo && row.invoiceNo === invoice.invoiceNo);
    if (!match) return row;
    changed = true;
    return clearedSaleInvoiceFields(row);
  });
  if (changed) {
    saveSaleCaseRows(next);
    window.dispatchEvent(new Event(SALE_CASE_SYNC_EVENT));
  }
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

  const handleDelete = (row) => {
    if (!TEMP_ALLOW_INVOICE_DELETE) return;
    if (
      !window.confirm(
        `TEMP: Invoice ${row.invoiceNo} (Sr. ${row.srNo}) delete karein?\nSale Sheet se bhi invoice clear ho jayegi.`,
      )
    ) {
      return;
    }
    const result = deleteOldInvoiceCompletely(row.id);
    if (!result.ok) {
      window.alert(result.error || "Delete fail.");
      return;
    }
    clearSaleRowsForInvoice(result.invoice);
    setRecords(getInvoiceFileRecords());
  };

  return (
    <section className={styles.sheet}>
      <header className={styles.toolbar}>
        <div>
          <h1>Invoice File</h1>
          <p>
            Har generate par Sr. No. aur serial Settings series se auto badhega.{" "}
            <strong>Date</strong> us din ki hogi jis din invoice generate hua (serial order ke
            hisaab se), sale row ki date se alag ho sakti hai.
            {TEMP_ALLOW_INVOICE_DELETE ? (
              <>
                {" "}
                <em>(TEMP: Delete Invoice available — live pe hata denge.)</em>
              </>
            ) : null}
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
                <th>Invoice No.</th>
                <th>Date</th>
                <th>Customer Name</th>
                <th>Customer Father Name</th>
                <th>Address</th>
                <th>Amount</th>
                <th>GST</th>
                <th>Total Amount</th>
                {TEMP_ALLOW_INVOICE_DELETE ? <th>Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td className={styles.srCol}>{row.srNo}</td>
                  <td className={styles.invoiceNo}>{row.invoiceNo}</td>
                  <td>{row.date}</td>
                  <td>{row.customerName}</td>
                  <td>{row.fatherName || "—"}</td>
                  <td className={styles.addressCell}>{row.address || "—"}</td>
                  <td>{formatMoney(row.taxableAmount)}</td>
                  <td>{formatMoney(row.gstAmount)}</td>
                  <td className={styles.totalCell}>{formatMoney(row.totalAmount)}</td>
                  {TEMP_ALLOW_INVOICE_DELETE ? (
                    <td>
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(row)}
                      >
                        Delete (TEMP)
                      </button>
                    </td>
                  ) : null}
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
