import { useEffect, useMemo, useRef, useState } from "react";
import { BACKUP_ENTRY_SYNC_EVENT } from "../../../constants/backupEntry";
import {
  addBackupEntry,
  backupToCashRow,
  backupToLoanRow,
  mergeCashRowsWithBackup,
  mergeLoanRowsWithBackup,
  patchBackupFromCashRow,
  patchBackupFromLoanRow,
  upsertBackupEntry,
  deleteBackupEntry,
} from "../../../utils/backupEntryStorage";
import {
  addCustomerDocument,
  listDocumentsBySource,
  readFileAsDataUrl,
} from "../../../utils/customerDocuments";
import {
  clearCaseDeleteOtpSession,
  getCaseDeleteOtpMobileDisplay,
  sendCaseDeleteOtp,
  verifyCaseDeleteOtp,
} from "../../../utils/caseDeleteOtp";
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
  loadRows,
  onRowsPersist,
  enableBackupEntries = false,
  backupSheetKind = "loan",
  onRowPaymentSync,
  enableRowDelete = true,
  deleteRequiresOtp = false,
  rowEditLock = false,
}) {
  const assignRowId = (row) => {
    if (row._rowId) return row;
    return {
      ...row,
      _rowId: `case-row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    };
  };

  const mergeWithBackup = (main) =>
    backupSheetKind === "cash"
      ? mergeCashRowsWithBackup(main)
      : mergeLoanRowsWithBackup(main);

  const [rows, setRows] = useState(() => {
    const main = (loadRows ? loadRows() : initialRows).map((row) => assignRowId({ ...row }));
    return enableBackupEntries ? mergeWithBackup(main) : main;
  });
  const [query, setQuery] = useState("");
  const [docRefresh, setDocRefresh] = useState(0);
  const fileInputRef = useRef(null);
  const uploadRowRef = useRef(null);
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null);
  const [deleteOtp, setDeleteOtp] = useState("");
  const [deleteOtpSent, setDeleteOtpSent] = useState(false);
  const [editingRowIds, setEditingRowIds] = useState(() => new Set());

  const getRowId = (row) => row._rowId || row.entryId || row.consumerNo || "";

  const isRowEditing = (row) => !rowEditLock || editingRowIds.has(getRowId(row));

  const startRowEdit = (row) => {
    const id = getRowId(row);
    if (!id) return;
    setEditingRowIds((prev) => new Set(prev).add(id));
  };

  const finishRowEdit = (row) => {
    const id = getRowId(row);
    if (onRowPaymentSync) {
      onRowPaymentSync(row);
    }
    setEditingRowIds((prev) => {
      const next = new Set(prev);
      if (id) next.delete(id);
      return next;
    });
  };

  useEffect(() => {
    onRowsPersist?.(rows.filter((r) => !r.isBackupEntry));
  }, [rows, onRowsPersist]);

  useEffect(() => {
    setRows((prev) => {
      let changed = false;
      const next = prev.map((row) => {
        if (row._rowId) return row;
        changed = true;
        return assignRowId(row);
      });
      return changed ? next : prev;
    });
  }, []);

  useEffect(() => {
    if (!enableBackupEntries) return undefined;
    const refreshBackups = () => {
      setRows((prev) => mergeWithBackup(prev.filter((r) => !r.isBackupEntry)));
    };
    window.addEventListener(BACKUP_ENTRY_SYNC_EVENT, refreshBackups);
    return () => window.removeEventListener(BACKUP_ENTRY_SYNC_EVENT, refreshBackups);
  }, [enableBackupEntries, backupSheetKind]);

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
      prev.map((row) => {
        if (row !== rowRef) return row;
        const next = { ...row, [key]: value };
        if (row.isBackupEntry && row.entryId) {
          const patch =
            backupSheetKind === "cash"
              ? patchBackupFromCashRow(next)
              : patchBackupFromLoanRow(next);
          upsertBackupEntry(patch);
        }
        return next;
      }),
    );
  };

  const handleAddBackupEntry = () => {
    const created = addBackupEntry();
    const backupRow =
      backupSheetKind === "cash" ? backupToCashRow(created) : backupToLoanRow(created);
    setRows((prev) => [...prev, backupRow]);
  };

  const performDeleteRow = (row) => {
    if (row.isBackupEntry && row.entryId) {
      deleteBackupEntry(row.entryId);
    }
    setRows((prev) => prev.filter((r) => r !== row));
  };

  const closeDeleteOtpModal = () => {
    setPendingDeleteRow(null);
    setDeleteOtp("");
    setDeleteOtpSent(false);
    clearCaseDeleteOtpSession();
  };

  const requestDeleteRow = (row) => {
    const label = row.consumerNo?.trim() || row.customerName?.trim() || "ye row";
    if (deleteRequiresOtp) {
      setPendingDeleteRow({ row, label });
      setDeleteOtp("");
      setDeleteOtpSent(false);
      clearCaseDeleteOtpSession();
      return;
    }
    if (!window.confirm(`"${label}" ko sheet se delete karein?`)) return;
    performDeleteRow(row);
  };

  const handleSendDeleteOtp = () => {
    const { demoOtp } = sendCaseDeleteOtp();
    setDeleteOtpSent(true);
    window.alert(
      `Delete OTP ${getCaseDeleteOtpMobileDisplay()} par bheja gaya:\n\n${demoOtp}\n\n(Backend connect hone par asli SMS aayega.)`,
    );
  };

  const confirmDeleteWithOtp = () => {
    if (!deleteOtpSent) {
      window.alert("Pehle Send OTP dabayein.");
      return;
    }
    if (!verifyCaseDeleteOtp(deleteOtp)) {
      window.alert("Galat OTP. Send OTP ke baad alert me diya gaya OTP enter karein.");
      return;
    }
    if (pendingDeleteRow?.row) {
      performDeleteRow(pendingDeleteRow.row);
    }
    closeDeleteOtpModal();
  };

  const deleteRow = requestDeleteRow;

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

  const renderCell = (col, row, editing) => {
    if (!editing) {
      const display = row[col.key];
      return (
        <span className={styles.cellReadonly} title={col.label}>
          {display !== undefined && display !== null && String(display).trim() !== ""
            ? String(display)
            : "—"}
        </span>
      );
    }

    if (col.type === "select") {
      const options = col.options ?? [];
      return (
        <select
          className={styles.cellSelect}
          value={row[col.key] ?? ""}
          onChange={(e) => updateCell(row, col.key, e.target.value)}
          aria-label={col.label}
        >
          <option value="">
            {col.key === "setupKw" ? "Select kW" : col.key === "seva" ? "Select Seva" : "Select"}
          </option>
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
        className={`${styles.cellInput} ${col.isPrimaryId ? styles.manualIdInput : ""} ${col.syncCustomerPayment ? styles.syncField : ""}`}
        type="text"
        value={row[col.key] ?? ""}
        onChange={(e) => updateCell(row, col.key, e.target.value)}
        onBlur={(e) => {
          if (rowEditLock) return;
          if (col.syncCustomerPayment && onRowPaymentSync) {
            onRowPaymentSync({ ...row, [col.key]: e.target.value });
          }
        }}
        placeholder={col.placeholder || col.label}
        aria-label={col.label}
      />
    );
  };

  const showUpload = Boolean(documentUploadSource);

  return (
    <section className={styles.sheet}>
      {pendingDeleteRow ? (
        <div
          className={styles.deleteModalBackdrop}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDeleteOtpModal();
          }}
        >
          <div className={styles.deleteModal} role="dialog" aria-labelledby="delete-otp-title">
            <h2 id="delete-otp-title" className={styles.deleteModalTitle}>
              Row delete — OTP verify
            </h2>
            <p className={styles.deleteModalText}>
              &quot;{pendingDeleteRow.label}&quot; delete karne se pehle registered mobile par OTP
              verify karein.
            </p>
            <p className={styles.deleteModalMobile}>
              OTP bheja jayega: {getCaseDeleteOtpMobileDisplay()}
            </p>
            <div className={styles.deleteOtpRow}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6 digit OTP"
                value={deleteOtp}
                onChange={(e) => setDeleteOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className={styles.deleteOtpInput}
              />
              <button type="button" className={styles.deleteSendOtpBtn} onClick={handleSendDeleteOtp}>
                Send OTP
              </button>
            </div>
            <div className={styles.deleteModalActions}>
              <button type="button" className={styles.btnOutline} onClick={closeDeleteOtpModal}>
                Cancel
              </button>
              <button type="button" className={styles.deleteConfirmBtn} onClick={confirmDeleteWithOtp}>
                Verify &amp; Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
            onClick={() => {
              const empty = assignRowId(createEmptyRow());
              setRows((prev) => [...prev, empty]);
              if (rowEditLock) {
                setEditingRowIds((prev) => new Set(prev).add(getRowId(empty)));
              }
            }}
          >
            + Add Row
          </button>
          {enableBackupEntries ? (
            <button type="button" className={styles.btnBackup} onClick={handleAddBackupEntry}>
              + Backup Entry
            </button>
          ) : null}
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
              {rowEditLock || enableRowDelete ? <th>Action</th> : null}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, rowIndex) => {
              const consumerKey = String(row.consumerNo || "").trim().toUpperCase();
              const docCount = consumerKey ? docCountByConsumer[consumerKey] || 0 : 0;
              const editing = isRowEditing(row);

              return (
                <tr
                  key={`${row._rowId || row.entryId || consumerKey || "row"}-${rowIndex}`}
                  className={
                    row.isBackupEntry
                      ? styles.backupRow
                      : editing && rowEditLock
                        ? styles.rowEditing
                        : undefined
                  }
                >
                  <td>
                    {rowIndex + 1}
                    {row.isBackupEntry ? (
                      <span className={styles.backupBadge} title="Synced backup entry">
                        Backup
                      </span>
                    ) : null}
                  </td>
                  {columns.map((col) => (
                    <td key={col.key} className={col.isPrimaryId ? styles.primaryCell : undefined}>
                      {renderCell(col, row, editing)}
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
                  {rowEditLock || enableRowDelete ? (
                    <td className={styles.actionCell}>
                      {rowEditLock ? (
                        editing ? (
                          <button
                            type="button"
                            className={styles.doneBtn}
                            onClick={() => finishRowEdit(row)}
                            title="Edit complete — save ho jayega"
                          >
                            Done
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={styles.editBtn}
                            onClick={() => startRowEdit(row)}
                            title="Row edit karein"
                          >
                            Edit
                          </button>
                        )
                      ) : null}
                      {enableRowDelete ? (
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={() => deleteRow(row)}
                          title="Row delete karein"
                        >
                          Delete
                        </button>
                      ) : null}
                    </td>
                  ) : null}
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
