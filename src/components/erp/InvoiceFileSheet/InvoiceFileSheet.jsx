import { useEffect, useMemo, useState } from "react";
import { TEMP_ALLOW_INVOICE_DELETE } from "../../../constants/tempInvoiceDelete";
import {
  getInvoiceFileRecords,
  INVOICE_FILE_SYNC_EVENT,
  listAvailableNetMeterInvoicesForWithoutGst,
  peekNextInvoiceSerial,
} from "../../../utils/invoiceStorage";
import {
  clearedNetMeterInvoiceFields,
  clearedSaleInvoiceFields,
  deleteOldInvoiceCompletely,
} from "../../../utils/tempInvoiceDelete";
import { loadSaleCaseRows, saveSaleCaseRows } from "../../../utils/saleCaseStorage";
import { SALE_CASE_SYNC_EVENT } from "../../../utils/saleCaseSync";
import styles from "./InvoiceFileSheet.module.css";

function formatMoney(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function invoiceTypeLabel(row) {
  if (row.invoiceKind === "net-meter") return "Net Meter";
  if (!row.withGst) return "Without GST";
  return "With GST";
}

function clearSaleRowsForInvoice(invoice) {
  if (!invoice) return;
  const rows = loadSaleCaseRows();
  let changed = false;
  const next = rows.map((row) => {
    const isNet = invoice.invoiceKind === "net-meter";
    const match = isNet
      ? (invoice.id && row.netMeterInvoiceId === invoice.id) ||
        (invoice.invoiceNo && row.netMeterInvoiceNo === invoice.invoiceNo)
      : (invoice.id && row.invoiceId === invoice.id) ||
        (invoice.invoiceNo && row.invoiceNo === invoice.invoiceNo);
    if (!match) return row;
    changed = true;
    return isNet ? clearedNetMeterInvoiceFields(row) : clearedSaleInvoiceFields(row);
  });
  if (changed) {
    saveSaleCaseRows(next);
    window.dispatchEvent(new Event(SALE_CASE_SYNC_EVENT));
  }
}

function InvoiceFileSheet() {
  const [records, setRecords] = useState(() => getInvoiceFileRecords());
  const [query, setQuery] = useState("");
  const [nextSerial, setNextSerial] = useState(() => peekNextInvoiceSerial());
  const [nmSearch, setNmSearch] = useState("");

  useEffect(() => {
    const refresh = () => {
      setRecords(getInvoiceFileRecords());
      setNextSerial(peekNextInvoiceSerial());
    };
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
        row.date?.includes(q) ||
        invoiceTypeLabel(row).toLowerCase().includes(q) ||
        String(row.linkedNetMeterInvoiceNo || "")
          .toLowerCase()
          .includes(q),
    );
  }, [records, query]);

  const freeNmNumbers = useMemo(
    () => listAvailableNetMeterInvoicesForWithoutGst({ query: nmSearch }),
    [nmSearch, records],
  );

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
    setNextSerial(peekNextInvoiceSerial());
  };

  return (
    <section className={styles.sheet}>
      <header className={styles.toolbar}>
        <div>
          <h1>Invoice File</h1>
          <p>
            <strong>With GST</strong> + <strong>Net Meter</strong> Settings series se naya number
            lete hain — list yahan auto update hoti hai. Next series:{" "}
            <strong>{nextSerial}</strong>.
            <br />
            <strong>Without GST</strong> pe Net Meter wala number + date reuse hoti hai; used number
            dubara nahi katega.
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
            placeholder="Search name, date, type, Sr..."
          />
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => {
              setRecords(getInvoiceFileRecords());
              setNextSerial(peekNextInvoiceSerial());
            }}
          >
            Refresh
          </button>
        </div>
      </header>

      <div className={styles.seriesPanel}>
        <div className={styles.seriesCard}>
          <h3>Series (With GST / Net Meter)</h3>
          <p>
            Next number: <strong>{nextSerial}</strong>
          </p>
        </div>
        <div className={styles.seriesCard}>
          <h3>Without GST — free Net Meter numbers</h3>
          <input
            type="search"
            className={styles.search}
            value={nmSearch}
            onChange={(e) => setNmSearch(e.target.value)}
            placeholder="Search Net Meter invoice no..."
          />
          {freeNmNumbers.length === 0 ? (
            <p className={styles.emptyMini}>Koi free Net Meter number nahi (ya sab use ho gaye).</p>
          ) : (
            <ul className={styles.nmFreeList}>
              {freeNmNumbers.slice(0, 20).map((nm) => (
                <li key={nm.id}>
                  <strong>{nm.invoiceNo}</strong> · {nm.date} · {nm.customerName || nm.consumerNo}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className={styles.tableWrap}>
        {filtered.length === 0 ? (
          <p className={styles.empty}>
            Abhi koi invoice nahi. Sale Sheet → Generate Invoice / Net Meter se pehli entry yahan
            aayegi.
          </p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Sr. No.</th>
                <th>Invoice No.</th>
                <th>Type</th>
                <th>Date</th>
                <th>Customer Name</th>
                <th>Customer Father Name</th>
                <th>Address</th>
                <th>Amount</th>
                <th>GST</th>
                <th>Total Amount</th>
                <th>Linked NM No.</th>
                {TEMP_ALLOW_INVOICE_DELETE ? <th>Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td className={styles.srCol}>{row.srNo}</td>
                  <td className={styles.invoiceNo}>{row.invoiceNo}</td>
                  <td>{invoiceTypeLabel(row)}</td>
                  <td>{row.date}</td>
                  <td>{row.customerName}</td>
                  <td>{row.fatherName || "—"}</td>
                  <td className={styles.addressCell}>{row.address || "—"}</td>
                  <td>{formatMoney(row.taxableAmount)}</td>
                  <td>{formatMoney(row.gstAmount)}</td>
                  <td className={styles.totalCell}>{formatMoney(row.totalAmount)}</td>
                  <td>{row.linkedNetMeterInvoiceNo || "—"}</td>
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
