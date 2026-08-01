import { useEffect, useMemo, useState } from "react";
import { clearAllInvoicesForFreshStart } from "../../utils/clearAllInvoices";
import { clearSaleRowsForInvoice } from "../../utils/clearSaleInvoiceLink";
import { getInvoiceFileRecords } from "../../utils/invoiceStorage";
import { deleteInvoiceCompletely } from "../../utils/tempInvoiceDelete";
import { appendActivityLog } from "../../utils/settingsStorage";
import styles from "./SettingsPage.module.css";

function typeLabel(row) {
  if (row.invoiceKind === "net-meter") return "Net Meter";
  if (!row.withGst) return "Without GST";
  return "With GST";
}

/** Settings — single invoice delete + delete all (Admin). */
function InvoiceClearSettings({ session }) {
  const [records, setRecords] = useState(() => getInvoiceFileRecords());
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => setRecords(getInvoiceFileRecords());

  useEffect(() => {
    const onSync = () => refresh();
    window.addEventListener("dhatterwal-invoice-file-sync", onSync);
    return () => window.removeEventListener("dhatterwal-invoice-file-sync", onSync);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return records;
    const q = query.toLowerCase();
    return records.filter(
      (row) =>
        String(row.srNo).includes(q) ||
        row.invoiceNo?.toLowerCase().includes(q) ||
        row.customerName?.toLowerCase().includes(q) ||
        row.consumerNo?.toLowerCase().includes(q) ||
        typeLabel(row).toLowerCase().includes(q),
    );
  }, [records, query]);

  const handleDeleteOne = (row) => {
    if (
      !window.confirm(
        `Invoice ${row.invoiceNo} (Sr. ${row.srNo}) delete karein?\n\n` +
          `${row.customerName || ""} — ${typeLabel(row)}\n` +
          "Sale Sheet se ye invoice clear ho jayegi. Dubara generate kar sakte ho.",
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const result = deleteInvoiceCompletely(row.id);
      if (!result.ok) {
        window.alert(result.error || "Delete fail.");
        return;
      }
      clearSaleRowsForInvoice(result.invoice);
      refresh();
      appendActivityLog({
        user: session?.displayName ?? "Admin",
        action: `Invoice deleted: ${row.invoiceNo}`,
      });
      window.alert(`Invoice ${row.invoiceNo} delete ho gayi.`);
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAll = () => {
    if (!records.length) {
      window.alert("Invoice File pehle se khali hai.");
      return;
    }
    if (
      !window.confirm(
        `SAARI ${records.length} invoices DELETE karein?\nUndo nahi hoga. Continue?`,
      )
    ) {
      return;
    }
    if (!window.confirm("Last confirm: Saari invoices permanently delete?")) return;

    setBusy(true);
    try {
      const result = clearAllInvoicesForFreshStart();
      refresh();
      appendActivityLog({
        user: session?.displayName ?? "Admin",
        action: `All invoices deleted from Settings (${result.invoiceCount})`,
      });
      window.alert(
        `Done — ${result.invoiceCount} invoices delete.\nAb series set karke naye invoices banao.`,
      );
    } catch (err) {
      window.alert(err?.message || "Delete fail.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h2>Delete Invoice (single / all)</h2>
          <p className={styles.cardHint}>
            Galat invoice ho to neeche list se <strong>Delete</strong> dabao — sirf wahi invoice
            hategi. Ya saari invoices ek saath delete. Sirf Admin.
          </p>
        </div>
        <button
          type="button"
          className={styles.btnDangerSmall}
          disabled={busy || records.length === 0}
          onClick={handleDeleteAll}
        >
          Delete All
        </button>
      </div>

      <p className={styles.cardHint}>
        Total: <strong>{records.length}</strong>
      </p>

      <div className={styles.seriesGrid} style={{ marginBottom: "0.75rem" }}>
        <label className={styles.previewField}>
          Search invoice
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Invoice no / name / consumer..."
          />
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className={styles.cardHint}>Koi invoice nahi mili.</p>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Sr.</th>
                <th>Invoice No.</th>
                <th>Type</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>{row.srNo}</td>
                  <td>{row.invoiceNo}</td>
                  <td>{typeLabel(row)}</td>
                  <td>{row.date}</td>
                  <td>
                    {row.customerName || "—"}
                    <br />
                    <span style={{ fontSize: "0.7rem", opacity: 0.75 }}>{row.consumerNo}</span>
                  </td>
                  <td>₹{Number(row.totalAmount || 0).toLocaleString("en-IN")}</td>
                  <td>
                    <button
                      type="button"
                      className={styles.btnDangerSmall}
                      disabled={busy}
                      onClick={() => handleDeleteOne(row)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default InvoiceClearSettings;
