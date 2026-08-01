import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  bomFileSiteDate,
  BOM_CHARGE_FIELDS,
  chargesSubtotal,
  computeTotalKharch,
  fileTotalAmount,
  isDirectReference,
  lineAmount,
  loadBomSheetFiles,
  normalizeBomDate,
  STAND_PAYMENT_OPTIONS,
  syncBomFilesFromSaleRows,
  todayBomDateEnGb,
  updateBomCharges,
  updateBomFileItems,
  updateBomStandPaymentType,
} from "../../../utils/bomSheetStorage";
import { scheduleBomSheetFolderSave } from "../../../utils/bomSheetDocuments";
import {
  loadSaleCaseRows,
  SALE_BOM_SYNC_EVENT,
  saveSaleCaseRows,
} from "../../../utils/saleCaseStorage";
import styles from "./BomSheet.module.css";

function formatMoney(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/** en-GB DD/MM/YYYY → input[type=date] YYYY-MM-DD */
function enGbToIso(enGb) {
  const m = String(enGb || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return "";
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function isoToEnGb(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function BomSheet() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [files, setFiles] = useState([]);
  const [query, setQuery] = useState("");
  const [showAllDates, setShowAllDates] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => {
    const fromUrl = normalizeBomDate(searchParams.get("date") || "");
    return fromUrl || todayBomDateEnGb();
  });
  const highlightConsumer = String(searchParams.get("consumer") || "")
    .trim()
    .toUpperCase();

  const refresh = useCallback(() => {
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

  useEffect(() => {
    const fromUrl = normalizeBomDate(searchParams.get("date") || "");
    if (fromUrl) {
      setSelectedDate(fromUrl);
      setShowAllDates(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (!highlightConsumer) return undefined;
    const t = window.setTimeout(() => {
      const el = document.getElementById(`bom-file-${highlightConsumer}`);
      el?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 200);
    return () => window.clearTimeout(t);
  }, [highlightConsumer, files, selectedDate, showAllDates]);

  const filteredFiles = useMemo(() => {
    let list = files;
    if (!showAllDates && selectedDate) {
      const day = normalizeBomDate(selectedDate);
      list = list.filter((file) => bomFileSiteDate(file) === day);
    }
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(
      (file) =>
        file.consumerNo?.toLowerCase().includes(q) ||
        file.customerName?.toLowerCase().includes(q) ||
        file.teamWork?.toLowerCase().includes(q) ||
        file.setupKw?.toLowerCase().includes(q) ||
        file.reference?.toLowerCase().includes(q),
    );
  }, [files, query, selectedDate, showAllDates]);

  const updateItem = (consumerNo, itemKey, field, value) => {
    const file = files.find((f) => f.consumerNo === consumerNo);
    if (!file) return;
    const nextItems = file.items.map((row) => {
      if (row.key !== itemKey) return row;
      return {
        ...row,
        [field]: field === "rate" || field === "qty" ? Number(value) || 0 : value,
      };
    });
    updateBomFileItems(consumerNo, nextItems);
    setFiles(loadBomSheetFiles());
    scheduleBomSheetFolderSave(consumerNo);
  };

  const changeStandType = (consumerNo, type) => {
    updateBomStandPaymentType(consumerNo, type);
    setFiles(loadBomSheetFiles());
    scheduleBomSheetFolderSave(consumerNo);
  };

  const changeCharge = (consumerNo, key, value) => {
    updateBomCharges(consumerNo, { [key]: value });
    setFiles(loadBomSheetFiles());
    scheduleBomSheetFolderSave(consumerNo);
  };

  const changeReferencePayment = (consumerNo, value) => {
    updateBomCharges(consumerNo, { referencePayment: value });
    setFiles(loadBomSheetFiles());
    scheduleBomSheetFolderSave(consumerNo);
  };

  const pullFromSale = () => {
    const saleRows = loadSaleCaseRows();
    syncBomFilesFromSaleRows(saleRows);
    saveSaleCaseRows(saleRows);
    setFiles(loadBomSheetFiles());
  };

  const onDateChange = (iso) => {
    const enGb = isoToEnGb(iso) || todayBomDateEnGb();
    setSelectedDate(enGb);
    setShowAllDates(false);
    const next = new URLSearchParams(searchParams);
    next.set("date", enGb);
    setSearchParams(next, { replace: true });
  };

  return (
    <section className={styles.sheet}>
      <header className={styles.toolbar}>
        <div>
          <h1>BOM Sheet</h1>
          <p>
            Site saman + File/Department/Net Meter/02 KW/Auto Rent charges. Reference agar Direct
            nahi hai to manual payment fill karein. Total Kharch = materials + charges + reference.
          </p>
          <p className={styles.dateHint}>
            {showAllDates
              ? `All dates · ${filteredFiles.length} file(s)`
              : `Daily site — ${selectedDate || "—"} · ${filteredFiles.length} file(s)`}
          </p>
        </div>
        <div className={styles.toolbarActions}>
          <label className={styles.dateLabel}>
            Site date
            <input
              type="date"
              value={enGbToIso(selectedDate)}
              onChange={(e) => onDateChange(e.target.value)}
              className={styles.dateInput}
              disabled={showAllDates}
            />
          </label>
          <label className={styles.allDatesToggle}>
            <input
              type="checkbox"
              checked={showAllDates}
              onChange={(e) => setShowAllDates(e.target.checked)}
            />
            All dates
          </label>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search consumer / team / reference..."
            className={styles.search}
          />
          <button type="button" className={styles.btnOutline} onClick={pullFromSale}>
            Sync from Sale Sheet
          </button>
        </div>
      </header>

      {filteredFiles.length === 0 ? (
        <p className={styles.empty}>
          {showAllDates
            ? "Abhi koi BOM file nahi. Pehle Sale Sheet me Consumer No. ke saath row add karein."
            : `Is date (${selectedDate}) ki koi BOM file nahi. All dates try karein ya Sale Sheet se Open BOM.`}
        </p>
      ) : (
        <div className={styles.fileList}>
          {filteredFiles.map((file) => {
            const materialsTotal = file.totalAmount ?? fileTotalAmount(file.items);
            const totalKharch = file.totalKharch ?? computeTotalKharch(file);
            const charges = file.charges || {};
            const directRef = isDirectReference(file.reference);
            const isHighlight =
              highlightConsumer &&
              String(file.consumerNo || "").toUpperCase() === highlightConsumer;
            return (
              <article
                key={file.consumerNo}
                id={`bom-file-${file.consumerNo}`}
                className={`${styles.fileCard} ${isHighlight ? styles.fileCardHighlight : ""}`}
              >
                <div className={styles.fileHead}>
                  <div>
                    <h2>
                      {file.consumerNo}
                      {file.customerName ? ` — ${file.customerName}` : ""}
                    </h2>
                    <p className={styles.fileMeta}>
                      Setup: {file.setupKw || "—"} · Sale Date: {file.saleDate || "—"} · Site /
                      Labour Date: {bomFileSiteDate(file) || "—"}
                      <br />
                      Reference: <strong>{file.reference || "—"}</strong>
                      <br />
                      {file.address || ""}
                    </p>
                    {file.teamWork ? (
                      <span className={styles.teamBadge}>Work Team: {file.teamWork}</span>
                    ) : (
                      <span className={styles.teamBadge}>
                        Work Team: (Sale Sheet se select karein)
                      </span>
                    )}
                  </div>
                  <div className={styles.grandTotalBox}>
                    <div className={styles.grandLabel}>Total Kharch (site)</div>
                    <div className={styles.grandValue}>{formatMoney(totalKharch)}</div>
                    <div className={styles.subTotalHint}>
                      Materials {formatMoney(materialsTotal)} + Charges{" "}
                      {formatMoney(chargesSubtotal(charges))}
                      {!directRef
                        ? ` + Ref ${formatMoney(file.referencePayment || 0)}`
                        : " + Ref ₹0 (Direct)"}
                    </div>
                  </div>
                </div>

                <div className={styles.chargesWrap}>
                  <h3 className={styles.chargesTitle}>Site fixed / other kharch</h3>
                  <div className={styles.chargesGrid}>
                    {BOM_CHARGE_FIELDS.map((f) => (
                      <label key={f.key} className={styles.chargeField}>
                        {f.label}
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className={styles.numInput}
                          value={charges[f.key] ?? f.defaultValue ?? 0}
                          onChange={(e) =>
                            changeCharge(file.consumerNo, f.key, e.target.value)
                          }
                          title={f.manual ? "Manual fill" : "Default set — change allowed"}
                        />
                      </label>
                    ))}
                    <label className={styles.chargeField}>
                      Reference payment
                      {directRef ? (
                        <input
                          type="number"
                          className={styles.numInput}
                          value={0}
                          readOnly
                          title="Direct reference — payment nahi"
                        />
                      ) : (
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className={styles.numInput}
                          value={file.referencePayment ?? 0}
                          onChange={(e) =>
                            changeReferencePayment(file.consumerNo, e.target.value)
                          }
                          placeholder="Manual payment"
                          title="Direct ke alawa reference — manual payment"
                        />
                      )}
                      <span className={styles.chargeHint}>
                        {directRef
                          ? "Direct — payment lock (₹0)"
                          : file.reference
                            ? `${file.reference} — manual`
                            : "Reference set nahi"}
                      </span>
                    </label>
                    <div className={styles.chargeField}>
                      Total Kharch
                      <div className={styles.totalKharchBox}>{formatMoney(totalKharch)}</div>
                    </div>
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
                          <td className={styles.detailCell}>
                            {row.key === "stand" ? (
                              <div className={styles.standCell}>
                                <select
                                  className={styles.standSelect}
                                  value={
                                    row.standPaymentType ||
                                    file.materials?.standPaymentType ||
                                    "02 KW"
                                  }
                                  onChange={(e) =>
                                    changeStandType(file.consumerNo, e.target.value)
                                  }
                                  title="Stand payment type — rate Rate column me fill karein"
                                >
                                  {STAND_PAYMENT_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>
                                      {opt}
                                    </option>
                                  ))}
                                </select>
                                <span className={styles.standDetail}>{row.detail}</span>
                              </div>
                            ) : (
                              row.detail
                            )}
                          </td>
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
                              placeholder={row.key === "stand" ? "Daily rate" : ""}
                            />
                          </td>
                          <td className={styles.amountCell}>{formatMoney(lineAmount(row))}</td>
                        </tr>
                      ))}
                      <tr className={styles.totalRow}>
                        <td colSpan={6}>Materials total</td>
                        <td className={styles.amountCell}>{formatMoney(materialsTotal)}</td>
                      </tr>
                      <tr className={styles.totalRow}>
                        <td colSpan={6}>Total Kharch (site)</td>
                        <td className={styles.amountCell}>{formatMoney(totalKharch)}</td>
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
