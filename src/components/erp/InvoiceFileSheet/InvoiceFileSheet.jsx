import { useEffect, useMemo, useState } from "react";
import { getAuthSession } from "../../../utils/authSession";
import { clearAllInvoicesForFreshStart } from "../../../utils/clearAllInvoices";
import { clearSaleRowsForInvoice } from "../../../utils/clearSaleInvoiceLink";
import { isAdminSession } from "../../../utils/erpAccess";
import {
  getInvoiceFileRecords,
  INVOICE_FILE_SYNC_EVENT,
  listAvailableNetMeterInvoicesForWithoutGst,
  peekNextInvoiceSerial,
} from "../../../utils/invoiceStorage";
import { deleteInvoiceCompletely } from "../../../utils/tempInvoiceDelete";
import styles from "./InvoiceFileSheet.module.css";

function formatMoney(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function invoiceTypeLabel(row) {
  if (row.invoiceKind === "net-meter") return "Net Meter";
  if (!row.withGst) return "Without GST";
  return "With GST";
}

function InvoiceFileSheet() {
  const session = getAuthSession();
  const isAdmin = isAdminSession(session);
  const [records, setRecords] = useState(() => getInvoiceFileRecords());
  const [query, setQuery] = useState("");
  const [nextSerial, setNextSerial] = useState(() => peekNextInvoiceSerial());
  const [nmSearch, setNmSearch] = useState("");
  const [clearBusy, setClearBusy] = useState(false);

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
    if (!isAdmin) {
      window.alert("Invoice delete sirf Admin kar sakta hai.");
      return;
    }
    if (
      !window.confirm(
        `Invoice ${row.invoiceNo} (Sr. ${row.srNo}) delete karein?\n` +
          `${row.customerName || ""} — ${invoiceTypeLabel(row)}\n\n` +
          "Sale Sheet se ye invoice clear ho jayegi. Phir dubara Generate Invoice kar sakte ho.",
      )
    ) {
      return;
    }
    const result = deleteInvoiceCompletely(row.id);
    if (!result.ok) {
      window.alert(result.error || "Delete fail.");
      return;
    }
    clearSaleRowsForInvoice(result.invoice);
    setRecords(getInvoiceFileRecords());
    setNextSerial(peekNextInvoiceSerial());
    window.alert(`Invoice ${row.invoiceNo} delete ho gayi.`);
  };

  const handleDeleteAll = () => {
    if (!isAdmin) {
      window.alert("Sirf Admin saari invoices delete kar sakta hai.");
      return;
    }
    if (!records.length) {
      window.alert("Invoice File pehle se khali hai.");
      return;
    }
    const ok = window.confirm(
      `SAARI ${records.length} invoices DELETE karein?\n\n` +
        "• Invoice File khali\n" +
        "• Sale Sheet se invoice numbers clear\n" +
        "• Sale invoice payments hatenge\n\n" +
        "Ye undo nahi hoga. Continue?",
    );
    if (!ok) return;
    if (!window.confirm("Last confirm: Saari purani invoices permanently delete?")) return;
    setClearBusy(true);
    try {
      const result = clearAllInvoicesForFreshStart();
      setRecords(getInvoiceFileRecords());
      setNextSerial(peekNextInvoiceSerial());
      window.alert(
        `Done — ${result.invoiceCount} invoices delete.\n` +
          `Ab Settings me series set karke naye invoices banao.`,
      );
    } catch (err) {
      window.alert(err?.message || "Delete all fail.");
    } finally {
      setClearBusy(false);
    }
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
            {isAdmin ? (
              <>
                {" "}
                <em>Admin: galat invoice pe Delete dabao — sirf wahi entry hategi.</em>
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
          {isAdmin ? (
            <button
              type="button"
              className={styles.deleteAllBtn}
              disabled={clearBusy || records.length === 0}
              onClick={handleDeleteAll}
            >
              {clearBusy ? "Deleting…" : "Delete All Invoices"}
            </button>
          ) : null}
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
                {isAdmin ? <th>Action</th> : null}
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
                  {isAdmin ? (
                    <td>
                      <button
                        type="button"
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(row)}
                      >
                        Delete
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
