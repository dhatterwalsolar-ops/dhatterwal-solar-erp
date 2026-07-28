import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ensureBomSeedFromRegistry,
  fileTotalAmount,
  lineAmount,
  loadBomSheetFiles,
  syncBomFilesFromSaleRows,
  updateBomFileItems,
} from "../../../utils/bomSheetStorage";
import { loadSaleCaseRows, SALE_BOM_SYNC_EVENT, saveSaleCaseRows } from "../../../utils/saleCaseStorage";
import styles from "./BomSheet.module.css";

function formatMoney(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function BomSheet() {
  const [files, setFiles] = useState([]);
  const [query, setQuery] = useState("");

  const refresh = useCallback(() => {
    ensureBomSeedFromRegistry();
    const saleRows = loadSaleCaseRows();
    syncBomFilesFromSaleRows(saleRows);
    setFiles(loadBomSheetFiles());
  }, []);

  useEffect(() => {
    refresh();
    const onSync = () => refresh();
    window.addEventListener(SALE_BOM_SYNC_EVENT, onSync);
    return () => window.removeEventListener(SALE_BOM_SYNC_EVENT, onSync);
  }, [refresh]);

  const filteredFiles = useMemo(() => {
    if (!query.trim()) return files;
    const q = query.toLowerCase();
    return files.filter(
      (file) =>
        file.consumerNo?.toLowerCase().includes(q) ||
        file.customerName?.toLowerCase().includes(q) ||
        file.teamWork?.toLowerCase().includes(q) ||
        file.setupKw?.toLowerCase().includes(q),
    );
  }, [files, query]);

  const updateItem = (consumerNo, itemKey, field, value) => {
    const file = files.find((f) => f.consumerNo === consumerNo);
    if (!file) return;
    const nextItems = file.items.map((row) => {
      if (row.key !== itemKey) return row;
      const updated = {
        ...row,
        [field]: field === "rate" || field === "qty" ? Number(value) || 0 : value,
      };
      return updated;
    });
    updateBomFileItems(consumerNo, nextItems);
    setFiles(loadBomSheetFiles());
  };

  const pullFromSale = () => {
    const saleRows = loadSaleCaseRows();
    syncBomFilesFromSaleRows(saleRows);
    saveSaleCaseRows(saleRows);
    setFiles(loadBomSheetFiles());
  };

  return (
    <section className={styles.sheet}>
      <header className={styles.toolbar}>
        <div>
          <h1>BOM Sheet</h1>
          <p>
            Har Sale Sheet entry ke liye yahan site BOM file auto banegi — Work Team ke hisaab se
            panel, inverter, wire, stand ki detail. Har item ka alag rate likhein; last column me
            line amount aur file ka total kharch dikhega.
          </p>
        </div>
        <div className={styles.toolbarActions}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search consumer / team..."
            className={styles.search}
          />
          <button type="button" className={styles.btnOutline} onClick={pullFromSale}>
            Sync from Sale Sheet
          </button>
        </div>
      </header>

      {filteredFiles.length === 0 ? (
        <p className={styles.empty}>
          Abhi koi BOM file nahi. Pehle Sale Sheet me Consumer No. ke saath row add karein — data
          yahan automatic aa jayega.
        </p>
      ) : (
        <div className={styles.fileList}>
          {filteredFiles.map((file) => {
            const total = file.totalAmount ?? fileTotalAmount(file.items);
            return (
              <article key={file.consumerNo} className={styles.fileCard}>
                <div className={styles.fileHead}>
                  <div>
                    <h2>
                      {file.consumerNo}
                      {file.customerName ? ` — ${file.customerName}` : ""}
                    </h2>
                    <p className={styles.fileMeta}>
                      Setup: {file.setupKw || "—"} · Sale Date: {file.saleDate || "—"} · Labour
                      Date: {file.materials?.labourDate || "—"}
                      <br />
                      {file.address || ""}
                    </p>
                    {file.teamWork ? (
                      <span className={styles.teamBadge}>Work Team: {file.teamWork}</span>
                    ) : (
                      <span className={styles.teamBadge}>Work Team: (Sale Sheet se select karein)</span>
                    )}
                  </div>
                  <div className={styles.grandTotalBox}>
                    <div className={styles.grandLabel}>Total kharch (is file par)</div>
                    <div className={styles.grandValue}>{formatMoney(total)}</div>
                  </div>
                </div>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Item</th>
                        <th>Site detail (saman)</th>
                        <th>Qty</th>
                        <th>Unit</th>
                        <th>Rate (₹)</th>
                        <th>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {file.items.map((row, index) => (
                        <tr key={row.key}>
                          <td>{index + 1}</td>
                          <td>{row.itemName}</td>
                          <td className={styles.detailCell}>{row.detail}</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              className={styles.numInput}
                              value={row.qty}
                              onChange={(e) =>
                                updateItem(file.consumerNo, row.key, "qty", e.target.value)
                              }
                            />
                          </td>
                          <td>{row.unit}</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              className={styles.numInput}
                              value={row.rate}
                              onChange={(e) =>
                                updateItem(file.consumerNo, row.key, "rate", e.target.value)
                              }
                            />
                          </td>
                          <td className={styles.amountCell}>{formatMoney(lineAmount(row))}</td>
                        </tr>
                      ))}
                      <tr className={styles.totalRow}>
                        <td colSpan={6}>Total Amount</td>
                        <td className={styles.amountCell}>{formatMoney(total)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default BomSheet;
