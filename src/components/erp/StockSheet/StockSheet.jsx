import { useEffect, useMemo, useState } from "react";
import {
  listPurchaseStockDetailRows,
  listStockSheetRows,
  STOCK_SYNC_EVENT,
  repairPurchaseStockFromHistory,
  syncStockFromCurrentPurchaseDraft,
} from "../../../utils/stockStorage";
import styles from "./StockSheet.module.css";

function formatSerialPreview(serialNumbers) {
  const text = String(serialNumbers || "").trim();
  if (!text) return "—";
  const first = text.split("\n")[0];
  const count = text.split("\n").filter(Boolean).length;
  return count > 1 ? `${first} (+${count - 1})` : first;
}

function StockSheet() {
  const [rows, setRows] = useState(() => listStockSheetRows());
  const [detailRows, setDetailRows] = useState(() => listPurchaseStockDetailRows());
  const [query, setQuery] = useState("");
  const [detailQuery, setDetailQuery] = useState("");

  const refresh = () => {
    setRows(listStockSheetRows());
    setDetailRows(listPurchaseStockDetailRows());
  };

  useEffect(() => {
    repairPurchaseStockFromHistory();
    refresh();
    const onSync = () => refresh();
    window.addEventListener(STOCK_SYNC_EVENT, onSync);
    return () => window.removeEventListener(STOCK_SYNC_EVENT, onSync);
  }, []);

  const handleSyncFromDraft = () => {
    const result = syncStockFromCurrentPurchaseDraft();
    refresh();
    if (!result.ok) {
      if (result.reason === "no_draft") {
        window.alert("Purchase draft me invoice / items nahi mile.");
        return;
      }
      if (result.reason === "purchase_not_saved") {
        window.alert("Pehle Purchase Sheet se bill save karein, phir stock sync try karein.");
        return;
      }
      if (result.reason === "missing_invoice") {
        window.alert("Invoice number missing hai.");
        return;
      }
      if (result.reason === "no_stock_lines") {
        window.alert("Item name aur qty bhariye — tabhi stock update hoga.");
        return;
      }
    }
    if (result.skipped) {
      window.alert("Is invoice ka stock pehle se update ho chuka hai.");
      return;
    }
    if (result.updatedLines > 0) {
      window.alert(`${result.updatedLines} item(s) ka stock update ho gaya.`);
      return;
    }
    window.alert("Stock update nahi hua — item name aur qty check karein.");
  };

  const handleRepair = () => {
    const { fixed } = repairPurchaseStockFromHistory();
    refresh();
    window.alert(
      fixed > 0
        ? `${fixed} purchase bill(s) se stock dubara sync ho gaya.`
        : "Koi nayi sync nahi mili — purchase me items / qty check karein ya Draft se sync try karein.",
    );
  };

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter(
      (row) =>
        row.itemCode?.toLowerCase().includes(q) ||
        row.itemName?.toLowerCase().includes(q) ||
        row.category?.toLowerCase().includes(q) ||
        row.warehouse?.toLowerCase().includes(q),
    );
  }, [query, rows]);

  const filteredDetail = useMemo(() => {
    if (!detailQuery.trim()) return detailRows;
    const q = detailQuery.toLowerCase();
    return detailRows.filter(
      (row) =>
        row.invoiceNo?.toLowerCase().includes(q) ||
        row.supplier?.toLowerCase().includes(q) ||
        row.itemName?.toLowerCase().includes(q),
    );
  }, [detailQuery, detailRows]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, r) => {
          acc.in += Number(r.qtyIn) || 0;
          acc.out += Number(r.qtyOut) || 0;
          acc.balance += Number(r.balance) || 0;
          return acc;
        },
        { in: 0, out: 0, balance: 0 },
      ),
    [filtered],
  );

  return (
    <section className={styles.sheet}>
      <header className={styles.toolbar}>
        <div>
          <h1>Stock Sheet</h1>
          <p>
            Upar product-wise balance; neeche har purchase bill ki line detail (invoice, supplier, qty,
            serial).
          </p>
        </div>
        <div className={styles.toolbarActions}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search summary..."
            className={styles.search}
          />
          <button type="button" className={styles.btnOutline} onClick={handleRepair}>
            Purchase se stock repair
          </button>
          <button type="button" className={styles.btnOutline} onClick={handleSyncFromDraft}>
            Draft se stock sync
          </button>
          <button type="button" className={styles.btnOutline} onClick={refresh}>
            Refresh
          </button>
        </div>
      </header>

      <div className={styles.tableWrap}>
        <h2 className={styles.sectionTitle}>Stock Summary</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Item Code</th>
              <th>Product</th>
              <th>Category</th>
              <th>Warehouse</th>
              <th className={styles.num}>In</th>
              <th className={styles.num}>Out</th>
              <th className={styles.num}>Balance</th>
              <th>Unit</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, index) => (
              <tr
                key={`${row.itemCode}-${row.itemName}-${index}`}
                className={row.balance > 0 ? styles.rowHasStock : undefined}
              >
                <td>{index + 1}</td>
                <td>{row.itemCode}</td>
                <td>{row.itemName}</td>
                <td>{row.category}</td>
                <td>{row.warehouse}</td>
                <td className={styles.num}>{row.qtyIn}</td>
                <td className={styles.num}>{row.qtyOut}</td>
                <td className={`${styles.num} ${styles.balanceCell}`}>{row.balance}</td>
                <td>{row.unit}</td>
              </tr>
            ))}
          </tbody>
          {filtered.length ? (
            <tfoot>
              <tr>
                <td colSpan={5} className={styles.footLabel}>
                  Total (filtered)
                </td>
                <td className={styles.num}>{totals.in}</td>
                <td className={styles.num}>{totals.out}</td>
                <td className={`${styles.num} ${styles.balanceCell}`}>{totals.balance}</td>
                <td />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <div className={styles.detailSection}>
        <div className={styles.detailHead}>
          <h2 className={styles.sectionTitle}>Purchase Stock Detail</h2>
          <input
            type="search"
            value={detailQuery}
            onChange={(e) => setDetailQuery(e.target.value)}
            placeholder="Search invoice, supplier, item..."
            className={styles.search}
          />
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice No.</th>
                <th>Supplier</th>
                <th>Item</th>
                <th className={styles.num}>Qty</th>
                <th>Unit</th>
                <th className={styles.num}>Rate</th>
                <th>Serial</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredDetail.map((row) => (
                <tr key={row.id}>
                  <td>{row.invoiceDate || "—"}</td>
                  <td>{row.invoiceNo}</td>
                  <td>{row.supplier || "—"}</td>
                  <td>{row.itemName}</td>
                  <td className={styles.num}>{row.qty}</td>
                  <td>{row.unit}</td>
                  <td className={styles.num}>{row.rate}</td>
                  <td className={styles.serialCell}>{formatSerialPreview(row.serialNumbers)}</td>
                  <td>
                    {row.stockSynced === false ? (
                      <span className={styles.pendingBadge}>Stock pending</span>
                    ) : (
                      <span className={styles.syncedBadge}>In stock</span>
                    )}
                  </td>
                </tr>
              ))}
              {!filteredDetail.length ? (
                <tr>
                  <td colSpan={9} className={styles.empty}>
                    Abhi koi purchase line detail nahi — Purchase save karte waqt items + qty zaroori
                    hain.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

export default StockSheet;
