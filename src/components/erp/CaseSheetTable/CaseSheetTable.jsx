import { useMemo, useRef, useState } from "react";
import {
  addCustomerDocument,
  listDocumentsBySource,
  readFileAsDataUrl,
} from "../../../utils/customerDocuments";
import styles from "./CaseSheetTable.module.css";

function CaseSheetTable({
  title,
  description,
  columns,
  initialRows,
  createEmptyRow,
  actions = [],
  documentLabels = {},
  documentUploadSource,
}) {
  const [rows, setRows] = useState(() => initialRows.map((row) => ({ ...row })));
  const [query, setQuery] = useState("");
  const [docRefresh, setDocRefresh] = useState(0);
  const fileInputRef = useRef(null);
  const uploadRowRef = useRef(null);

  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((row) =>
      Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(q)),
    );
  }, [query, rows]);

  const docCountByConsumer = useMemo(() => {
    if (!documentUploadSource) return {};
    void docRefresh;
    const counts = {};
    for (const doc of listDocumentsBySource(documentUploadSource)) {
      const cn = doc.consumerNo;
      if (!cn) continue;
      counts[cn] = (counts[cn] || 0) + 1;
    }
    return counts;
  }, [documentUploadSource, docRefresh]);

  const updateCell = (rowRef, key, value) => {
    setRows((prev) =>
      prev.map((row) => (row === rowRef ? { ...row, [key]: value } : row)),
    );
  };

  const handleGenerate = (actionKey, row) => {
    if (!row.consumerNo?.trim()) {
      window.alert("Please enter Consumer No. manually before generating documents.");
      return;
    }
    const label = documentLabels[actionKey] ?? "Document";
    window.alert(
      `${label} will be generated for Consumer No. ${row.consumerNo} (${row.customerName || "Customer"}).`,
    );
  };

  const openUploadForRow = (row) => {
    if (!row.consumerNo?.trim()) {
      window.alert("Enter Consumer No. first, then upload customer documents.");
      return;
    }
    uploadRowRef.current = row;
    fileInputRef.current?.click();
  };

  const onFilesSelected = async (event) => {
    const row = uploadRowRef.current;
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!row || !files.length || !documentUploadSource) return;

    try {
      for (const file of files) {
        const dataUrl = await readFileAsDataUrl(file);
        await addCustomerDocument({
          consumerNo: row.consumerNo,
          source: documentUploadSource,
          category: "customer-document",
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          dataUrl,
          subfolder: "uploads",
        });
      }
      setDocRefresh((n) => n + 1);
      window.alert(
        `${files.length} file(s) saved to Sale Sheet customer folder for ${row.consumerNo}.`,
      );
    } catch (err) {
      window.alert(err.message || "Upload failed.");
    }
  };

  const renderCell = (col, row) => {
    if (col.type === "select") {
      const options = col.options ?? [];
      return (
        <select
          className={styles.cellSelect}
          value={row[col.key] ?? ""}
          onChange={(e) => updateCell(row, col.key, e.target.value)}
          aria-label={col.label}
        >
          <option value="">Select kW</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    return (
      <input
        className={`${styles.cellInput} ${col.isPrimaryId ? styles.manualIdInput : ""}`}
        type="text"
        value={row[col.key] ?? ""}
        onChange={(e) => updateCell(row, col.key, e.target.value)}
        placeholder={col.placeholder || col.label}
        aria-label={col.label}
      />
    );
  };

  const showUpload = Boolean(documentUploadSource);

  return (
    <section className={styles.sheet}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className={styles.hiddenFile}
        onChange={onFilesSelected}
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
      />
      <header className={styles.toolbar}>
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className={styles.toolbarActions}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by consumer no., name..."
            className={styles.search}
          />
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setRows((prev) => [...prev, createEmptyRow()])}
          >
            + Add Row
          </button>
          <button type="button" className={styles.btnOutline}>
            Export Excel
          </button>
        </div>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Sr. No.</th>
              {columns.map((col) => (
                <th key={col.key} className={col.isPrimaryId ? styles.primaryCol : undefined}>
                  {col.label}
                  {col.isPrimaryId ? " (Manual Main ID)" : ""}
                </th>
              ))}
              {showUpload && <th>Customer Documents</th>}
              {actions.map((action) => (
                <th key={action.key}>{action.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, rowIndex) => {
              const consumerKey = String(row.consumerNo || "").trim().toUpperCase();
              const docCount = consumerKey ? docCountByConsumer[consumerKey] || 0 : 0;

              return (
                <tr key={`${consumerKey || "row"}-${rowIndex}`}>
                  <td>{rowIndex + 1}</td>
                  {columns.map((col) => (
                    <td key={col.key} className={col.isPrimaryId ? styles.primaryCell : undefined}>
                      {renderCell(col, row)}
                    </td>
                  ))}
                  {showUpload && (
                    <td className={styles.docCell}>
                      <button
                        type="button"
                        className={styles.uploadBtn}
                        onClick={() => openUploadForRow(row)}
                      >
                        Upload
                      </button>
                      <span className={styles.docCount}>
                        {docCount} file{docCount === 1 ? "" : "s"}
                      </span>
                    </td>
                  )}
                  {actions.map((action) => (
                    <td key={action.key}>
                      <button
                        type="button"
                        className={
                          action.tone === "gold"
                            ? `${styles.actionBtn} ${styles.actionBtnGold}`
                            : styles.actionBtn
                        }
                        onClick={() => handleGenerate(action.key, row)}
                      >
                        Generate
                      </button>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default CaseSheetTable;
