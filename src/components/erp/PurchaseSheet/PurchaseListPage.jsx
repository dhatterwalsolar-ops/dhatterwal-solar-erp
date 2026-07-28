import { useEffect, useMemo, useState, Fragment } from "react";
import { Link } from "react-router-dom";
import { purchaseGstLabel, calcLineAmount } from "../../../constants/purchaseSheet";
import {
  loadPurchaseHistory,
  deletePurchaseHistoryRecord,
  PURCHASE_HISTORY_SYNC_EVENT,
  normalizePurchaseInvoiceNo,
} from "../../../utils/purchaseHistoryStorage";
import { reversePurchaseStockForInvoice } from "../../../utils/stockStorage";
import { ROUTES } from "../../../constants/routes";
import styles from "./PurchaseSheet.module.css";

function formatMoney(n) {
  return `₹ ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
}

function serialPreview(text) {
  const lines = String(text || "")
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!lines.length) return "—";
  if (lines.length <= 2) return lines.join(", ");
  return `${lines.slice(0, 2).join(", ")} (+${lines.length - 2} more)`;
}

function PurchaseListPage() {
  const [rows, setRows] = useState(() => loadPurchaseHistory());
  const [expandedId, setExpandedId] = useState(null);
  const [query, setQuery] = useState("");

  const refresh = () => setRows(loadPurchaseHistory());

  useEffect(() => {
    const onHistory = () => refresh();
    window.addEventListener(PURCHASE_HISTORY_SYNC_EVENT, onHistory);
    return () => window.removeEventListener(PURCHASE_HISTORY_SYNC_EVENT, onHistory);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const hay = [
        row.invoiceNo,
        row.supplier,
        row.invoiceDate,
        row.paymentMode,
        ...(row.items || []).flatMap((it) => [it.itemName, it.category, it.hsn]),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, query]);

  const handleDelete = (row) => {
    const label = `${row.invoiceNo} — ${row.supplier}`;
    if (
      !window.confirm(
        `"${label}" saved entry delete karein?\n\nStock is invoice ki qty reverse ho jayegi (jahan ledger tha).`,
      )
    ) {
      return;
    }
    reversePurchaseStockForInvoice(row.invoiceNo);
    const result = deletePurchaseHistoryRecord(row.id);
    if (!result.ok) {
      window.alert("Entry delete nahi ho payi.");
      return;
    }
    if (expandedId === row.id) setExpandedId(null);
    refresh();
    window.alert(`"${row.invoiceNo}" delete ho gayi.`);
  };

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb}>
        <span>Home</span> › <span>Purchase</span> › <strong>Purchase List</strong>
      </nav>

      <section className={styles.savedSection}>
        <div className={styles.savedHead}>
          <div>
            <h2 className={styles.savedTitle}>Purchase List</h2>
            <p className={styles.savedSub}>
              Final save ki hui sab bills — har bill ke neeche items (kya kharida) dikhenge. Delete se
              stock reverse hoga.
            </p>
          </div>
          <Link to={ROUTES.PURCHASE_NEW} className={styles.btnNewEntrySecondary}>
            + New Entry
          </Link>
        </div>

        <label className={styles.listSearch}>
          <span className={styles.listSearchLabel}>Search</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Invoice, supplier, item name…"
            className={styles.listSearchInput}
          />
        </label>

        <div className={styles.savedTableWrap}>
          <table className={styles.savedTable}>
            <thead>
              <tr>
                <th>Sr.</th>
                <th>Invoice No.</th>
                <th>Date</th>
                <th>Supplier</th>
                <th>Payment</th>
                <th className={styles.numCol}>Grand Total (₹)</th>
                <th>Items</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className={styles.savedEmpty}>
                    {rows.length === 0
                      ? "Abhi koi saved purchase nahi — New Entry tab se pehli bill save karein."
                      : "Search ke liye koi match nahi mila."}
                  </td>
                </tr>
              ) : (
                filtered.map((row, index) => {
                  const itemList = row.items || [];
                  const isOpen = expandedId === row.id;
                  return (
                    <Fragment key={row.id}>
                      <tr>
                        <td>{index + 1}</td>
                        <td>{row.invoiceNo}</td>
                        <td>{row.invoiceDate}</td>
                        <td>{row.supplier}</td>
                        <td>{row.paymentMode || "—"}</td>
                        <td className={styles.numCol}>
                          {(row.grandTotal ?? row.totalAmount ?? 0).toLocaleString("en-IN")}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.btnViewItems}
                            onClick={() => toggleExpand(row.id)}
                          >
                            {isOpen ? "Hide" : "View"} ({itemList.length})
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.btnDeleteEntry}
                            onClick={() => handleDelete(row)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className={styles.itemsDetailRow}>
                          <td colSpan={8}>
                            {itemList.length === 0 ? (
                              <p className={styles.itemsDetailEmpty}>
                                Is save me item detail record nahi hai (purani entry). Nayi save par
                                items dikhenge.
                              </p>
                            ) : (
                              <table className={styles.itemsDetailTable}>
                                <thead>
                                  <tr>
                                    <th>#</th>
                                    <th>Item</th>
                                    <th>Category</th>
                                    <th>HSN</th>
                                    <th className={styles.numCol}>Qty</th>
                                    <th>Unit</th>
                                    <th className={styles.numCol}>Rate</th>
                                    <th>GST</th>
                                    <th className={styles.numCol}>Line Total</th>
                                    <th>Serials</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {itemList.map((it, i) => {
                                    const line = calcLineAmount(it);
                                    return (
                                      <tr key={`${row.id}-it-${i}`}>
                                        <td>{i + 1}</td>
                                        <td>{it.itemName || "—"}</td>
                                        <td>{it.category || "—"}</td>
                                        <td>{it.hsn || "—"}</td>
                                        <td className={styles.numCol}>{it.qty ?? 0}</td>
                                        <td>{it.unit || "—"}</td>
                                        <td className={styles.numCol}>
                                          {Number(it.rate || 0).toLocaleString("en-IN")}
                                        </td>
                                        <td>{purchaseGstLabel(it.tax)}</td>
                                        <td className={styles.numCol}>{formatMoney(line)}</td>
                                        <td className={styles.serialCol}>{serialPreview(it.serialNumbers)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                            <p className={styles.itemsDetailMeta}>
                              Invoice key: {normalizePurchaseInvoiceNo(row.invoiceNo)}
                            </p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default PurchaseListPage;
