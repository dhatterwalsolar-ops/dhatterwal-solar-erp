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
import { getAuthSession } from "../../../utils/authSession";
import { canChangeOrDelete } from "../../../utils/erpAccess";
import {
  downloadVendorAgreementPdf,
  generateVendorAgreementPdf,
  saveVendorAgreementToFolder,
} from "../../../utils/vendorAgreementPdf";
import {
  GENERATE_FILE_DISCOMS,
  GENERATE_FILE_SUBDIVISIONS,
  GENERATE_FILE_TABS,
} from "../../../constants/generateCaseFiles";
import {
  buildGenerateCaseContext,
  downloadCaseFile,
  generateAllCaseFiles,
  resolveCaseFileProducts,
  saveCaseFilesToFolder,
} from "../../../utils/generateCaseFiles";
import {
  downloadLoanQuotationDoc,
  findLoanQuotationDocument,
  generateAndSaveLoanQuotation,
  openLoanQuotationHtml,
  parseLoanAmount,
} from "../../../utils/loanQuotationDocuments";
import { peekNextQuotationSerial } from "../../../utils/quotationSerial";
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
  rowEditLock = false,
}) {
  /** Delete sirf Admin — staff pe button hide. OTP nahi. */
  const canDelete = Boolean(enableRowDelete) && canChangeOrDelete(getAuthSession());
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
  const [editingRowIds, setEditingRowIds] = useState(() => new Set());
  const [vendorBusyKey, setVendorBusyKey] = useState("");
  const [vendorForm, setVendorForm] = useState(null);
  const vendorPdfCache = useRef(new Map());
  const [filesForm, setFilesForm] = useState(null);
  const [filesBusy, setFilesBusy] = useState(false);
  const [quotationForm, setQuotationForm] = useState(null);
  const [quotationBusy, setQuotationBusy] = useState(false);

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

  const requestDeleteRow = (row) => {
    if (!canDelete) {
      window.alert("Delete sirf Admin kar sakta hai.");
      return;
    }
    const label = row.consumerNo?.trim() || row.customerName?.trim() || "ye row";
    if (!window.confirm(`"${label}" ko sheet se delete karein?`)) return;
    performDeleteRow(row);
  };

  const deleteRow = requestDeleteRow;

  const cacheKeyForRow = (row) =>
    `${documentUploadSource || "case"}:${row._rowId || row.entryId || row.consumerNo || ""}`;

  const openVendorForm = (row) => {
    if (!row.consumerNo?.trim()) {
      window.alert("Please enter Consumer No. manually before generating documents.");
      return;
    }
    setVendorForm({
      row,
      customerName: row.customerName || "",
      fatherName: row.fatherName || "",
      address: row.address || "",
      nameRelation: row.nameRelation === "W/O" || row.nameRelation === "D/O" ? row.nameRelation : "S/O",
    });
  };

  const closeVendorForm = () => {
    if (vendorBusyKey) return;
    setVendorForm(null);
  };

  const patchVendorForm = (key, value) => {
    setVendorForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const confirmVendorGenerate = async () => {
    if (!vendorForm?.row) return;
    const customerName = String(vendorForm.customerName || "").trim();
    const fatherName = String(vendorForm.fatherName || "").trim();
    const address = String(vendorForm.address || "").trim();
    const nameRelation = vendorForm.nameRelation === "W/O" || vendorForm.nameRelation === "D/O"
      ? vendorForm.nameRelation
      : "S/O";

    if (!customerName) {
      window.alert("Consumer Name bharna zaroori hai.");
      return;
    }
    if (!fatherName) {
      window.alert("Father/Husband Name bharna zaroori hai (S/O ya W/O format).");
      return;
    }
    if (!address) {
      window.alert("Address bharna zaroori hai (Village, District).");
      return;
    }

    const row = vendorForm.row;
    const filledRow = {
      ...row,
      customerName,
      fatherName,
      address,
      nameRelation,
    };
    const cacheKey = cacheKeyForRow(row);
    setVendorBusyKey(cacheKey);
    try {
      const pdf = await generateVendorAgreementPdf(filledRow);
      vendorPdfCache.current.set(cacheKey, pdf);
      /* Pehle download — folder save fail ho to bhi PDF mil jaye */
      downloadVendorAgreementPdf(pdf);
      const saved = await saveVendorAgreementToFolder(pdf);

      setRows((prev) =>
        prev.map((r) => {
          const same =
            (row._rowId && r._rowId === row._rowId) ||
            (row.entryId && r.entryId === row.entryId) ||
            (!row._rowId &&
              !row.entryId &&
              r.consumerNo &&
              r.consumerNo === row.consumerNo &&
              !r.isBackupEntry);
          if (!same) return r;
          return {
            ...r,
            customerName,
            fatherName,
            address,
            nameRelation,
            vendorAgreementReady: true,
            vendorAgreementFile: pdf.fileName,
            vendorAgreementAt: new Date().toLocaleString("en-IN"),
          };
        }),
      );
      setDocRefresh((n) => n + 1);
      setVendorForm(null);
      window.alert(
        saved
          ? `Vendor Agreement ready.\n${customerName} ${nameRelation} ${fatherName}\nPDF download + customer folder me save.`
          : `Vendor Agreement PDF download ho gayi.\n${customerName} ${nameRelation} ${fatherName}\n(Folder save skip — file bari / storage full; download use karein.)`,
      );
    } catch (err) {
      console.error("[Vendor Agreement]", err);
      window.alert(err?.message || "Vendor Agreement generate fail hua.");
    } finally {
      setVendorBusyKey("");
    }
  };

  const handleDownloadVendor = async (row) => {
    const cacheKey = cacheKeyForRow(row);
    let pdf = vendorPdfCache.current.get(cacheKey);
    if (!pdf) {
      try {
        setVendorBusyKey(cacheKey);
        pdf = await generateVendorAgreementPdf(row);
        vendorPdfCache.current.set(cacheKey, pdf);
      } catch (err) {
        window.alert(err?.message || "Download ke liye PDF ban nahi payi. Pehle Generate karein.");
        setVendorBusyKey("");
        return;
      } finally {
        setVendorBusyKey("");
      }
    }
    downloadVendorAgreementPdf(pdf);
  };

  const handleGenerate = (actionKey, row) => {
    if (actionKey === "vendor") {
      openVendorForm(row);
      return;
    }
    if (actionKey === "quotation") {
      openQuotationForm(row);
      return;
    }
    if (actionKey === "generateFiles") {
      openGenerateFilesForm(row);
      return;
    }
    if (!row.consumerNo?.trim()) {
      window.alert("Please enter Consumer No. manually before generating documents.");
      return;
    }
    const label = documentLabels[actionKey] ?? "Document";
    window.alert(
      `${label} will be generated for Consumer No. ${row.consumerNo} (${row.customerName || "Customer"}).`,
    );
  };

  const openQuotationForm = (row) => {
    if (!row.consumerNo?.trim()) {
      window.alert("Pehle Consumer No. enter karein.");
      return;
    }
    if (!row.customerName?.trim()) {
      window.alert("Customer name zaroori hai.");
      return;
    }
    const prefill = parseLoanAmount(row.loanPayment);
    const existingNo = String(row.quotationNo || "").trim();
    setQuotationForm({
      row,
      amount: prefill > 0 ? String(prefill) : "",
      previewNo: existingNo || peekNextQuotationSerial(),
      isRegenerate: Boolean(existingNo),
    });
  };

  const closeQuotationForm = () => {
    if (quotationBusy) return;
    setQuotationForm(null);
  };

  const confirmLoanQuotation = async (withGst) => {
    if (!quotationForm?.row || quotationBusy) return;
    const amount = parseLoanAmount(quotationForm.amount);
    if (!(amount > 0)) {
      window.alert("Amount With Tax sahi bharen.");
      return;
    }
    setQuotationBusy(true);
    try {
      const result = await generateAndSaveLoanQuotation(quotationForm.row, {
        amount,
        withGst,
      });
      setRows((prev) =>
        prev.map((r) => {
          const row = quotationForm.row;
          const same =
            (row._rowId && r._rowId === row._rowId) ||
            (row.entryId && r.entryId === row.entryId) ||
            (!row._rowId &&
              !row.entryId &&
              r.consumerNo &&
              r.consumerNo === row.consumerNo &&
              !r.isBackupEntry);
          if (!same) return r;
          return {
            ...r,
            loanPayment: quotationForm.amount,
            quotationReady: true,
            quotationNo: result.quotationNo,
            quotationAt: new Date().toLocaleString("en-IN"),
            quotationWithGst: withGst,
          };
        }),
      );
      setDocRefresh((n) => n + 1);
      openLoanQuotationHtml(result.html);
      setQuotationForm(null);
      window.alert(
        quotationForm.isRegenerate
          ? `Quotation re-generate ho gayi — number same: ${result.quotationNo}`
          : `Quotation ${result.quotationNo} generate ho gayi (folder + download).`,
      );
    } catch (err) {
      window.alert(err?.message || "Quotation generate fail hua.");
    } finally {
      setQuotationBusy(false);
    }
  };

  const downloadRowQuotation = (row) => {
    const doc = findLoanQuotationDocument(row.consumerNo, row.quotationNo);
    if (!doc) {
      window.alert("Quotation file folder me nahi mili. Dubara Generate karein.");
      return;
    }
    downloadLoanQuotationDoc(doc);
  };

  const openGenerateFilesForm = (row) => {
    if (!row.consumerNo?.trim()) {
      window.alert("Please enter Consumer No. manually before generating documents.");
      return;
    }
    const products = resolveCaseFileProducts(row.consumerNo, row.setupKw);
    setFilesForm({
      row,
      tab: "setup",
      discom: row.discom || "UHBVN",
      subdivision: row.subdivision || "",
      products,
    });
  };

  const closeGenerateFilesForm = () => {
    if (filesBusy) return;
    setFilesForm(null);
  };

  const patchFilesForm = (key, value) => {
    setFilesForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const confirmGenerateFiles = async () => {
    if (!filesForm?.row) return;
    const discom = String(filesForm.discom || "").trim();
    const subdivision = String(filesForm.subdivision || "").trim();
    if (!discom) {
      window.alert("Discom select karein (UHBVN / DHBVN).");
      return;
    }
    if (!subdivision) {
      window.alert("Sub Division Name bharna zaroori hai.");
      return;
    }

    setFilesBusy(true);
    try {
      const result = generateAllCaseFiles(filesForm.row, { discom, subdivision });
      await saveCaseFilesToFolder(result, documentUploadSource || "loan");

      setRows((prev) =>
        prev.map((r) => {
          const row = filesForm.row;
          const same =
            (row._rowId && r._rowId === row._rowId) ||
            (row.entryId && r.entryId === row.entryId) ||
            (!row._rowId &&
              !row.entryId &&
              r.consumerNo &&
              r.consumerNo === row.consumerNo &&
              !r.isBackupEntry);
          if (!same) return r;
          return {
            ...r,
            discom,
            subdivision,
            generateFilesReady: true,
            generateFilesAt: new Date().toLocaleString("en-IN"),
          };
        }),
      );
      setDocRefresh((n) => n + 1);

      result.files.forEach((f) => downloadCaseFile(f));
      setFilesForm(null);
      window.alert(
        `3 PDF files generate ho gayi.\nDiscom: ${discom}\nSub Division: ${subdivision}\nPanel: ${result.ctx.products.panelName}\nInverter: ${result.ctx.products.inverterName}`,
      );
    } catch (err) {
      window.alert(err?.message || "Generate Files fail hua.");
    } finally {
      setFilesBusy(false);
    }
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
      {quotationForm ? (
        <div className={styles.deleteBackdrop} role="presentation" onClick={closeQuotationForm}>
          <div
            className={`${styles.deleteModal} ${styles.vendorModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="quotation-form-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="quotation-form-title" className={styles.vendorModalTitle}>
              {quotationForm.isRegenerate ? "Re-generate Loan Quotation" : "Generate Loan Quotation"}
            </h2>
            <p className={styles.deleteHint}>
              Consumer <strong>{quotationForm.row.consumerNo}</strong> —{" "}
              {quotationForm.row.customerName}
              <br />
              {quotationForm.isRegenerate ? "Quotation No. (same):" : "Next Quotation No.:"}{" "}
              <strong>{quotationForm.previewNo}</strong>
              <br />
              Format: Settings → Loan Quotation Format (sirf billing address)
            </p>
            <label className={styles.vendorField}>
              Amount With Tax (₹) *
              <input
                type="number"
                min="0"
                value={quotationForm.amount}
                onChange={(e) =>
                  setQuotationForm((prev) =>
                    prev ? { ...prev, amount: e.target.value } : prev,
                  )
                }
                placeholder="Grand total / tax-inclusive"
              />
            </label>
            <p className={styles.deleteHint}>
              With GST: amount tax-inclusive — taxable + 5%/18% auto. Without GST: yahi total.
            </p>
            <div className={styles.deleteActions}>
              <button
                type="button"
                className={styles.deleteCancelBtn}
                disabled={quotationBusy}
                onClick={closeQuotationForm}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.vendorConfirmBtn}
                disabled={quotationBusy}
                onClick={() => confirmLoanQuotation(true)}
              >
                {quotationBusy ? "Generating…" : "With GST"}
              </button>
              <button
                type="button"
                className={styles.downloadBtn}
                disabled={quotationBusy}
                onClick={() => confirmLoanQuotation(false)}
              >
                Without GST
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {vendorForm ? (
        <div
          className={styles.deleteModalBackdrop}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeVendorForm();
          }}
        >
          <div
            className={`${styles.deleteModal} ${styles.vendorModal}`}
            role="dialog"
            aria-labelledby="vendor-form-title"
          >
            <h2 id="vendor-form-title" className={styles.vendorModalTitle}>
              Generate Vendor Agreement
            </h2>
            <p className={styles.deleteModalText}>
              Consumer No. <strong>{vendorForm.row.consumerNo}</strong> — Name / Father / Address
              bhariye. Uploaded scanned form ki <strong>........</strong> dotted lines pe fill
              hoga (Second Party jaisa bold underline).
            </p>

            <label className={styles.vendorField}>
              Consumer Name *
              <input
                value={vendorForm.customerName}
                onChange={(e) => patchVendorForm("customerName", e.target.value)}
                placeholder="e.g. Sohan Lal"
                autoFocus
              />
            </label>
            <label className={styles.vendorField}>
              Relation *
              <select
                value={vendorForm.nameRelation || "S/O"}
                onChange={(e) => patchVendorForm("nameRelation", e.target.value)}
              >
                <option value="S/O">S/O — Son of (Male)</option>
                <option value="W/O">W/O — Wife of (Lady)</option>
                <option value="D/O">D/O — Daughter of</option>
              </select>
            </label>
            <label className={styles.vendorField}>
              Father / Husband Name *
              <input
                value={vendorForm.fatherName}
                onChange={(e) => patchVendorForm("fatherName", e.target.value)}
                placeholder="e.g. Ram Singh"
              />
            </label>
            <label className={styles.vendorField}>
              Address (Village, District) *
              <textarea
                rows={2}
                value={vendorForm.address}
                onChange={(e) => patchVendorForm("address", e.target.value)}
                placeholder="e.g. VPO Muwana, District Jind, Haryana"
              />
            </label>

            <div className={styles.vendorPreview}>
              <div>
                <span>Agreement Name:</span>{" "}
                <strong>
                  {(() => {
                    const n = String(vendorForm.customerName || "").trim();
                    const f = String(vendorForm.fatherName || "").trim();
                    const rel = vendorForm.nameRelation || "S/O";
                    if (n && f) return `${n} ${rel} ${f}`.toUpperCase();
                    return n.toUpperCase() || "—";
                  })()}
                </strong>
              </div>
              <div>
                <span>Agreement Address:</span>{" "}
                <strong>{String(vendorForm.address || "").trim().toUpperCase() || "—"}</strong>
              </div>
            </div>

            <div className={styles.deleteModalActions}>
              <button
                type="button"
                className={styles.btnOutline}
                onClick={closeVendorForm}
                disabled={Boolean(vendorBusyKey)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.vendorConfirmBtn}
                onClick={confirmVendorGenerate}
                disabled={Boolean(vendorBusyKey)}
              >
                {vendorBusyKey ? "Generating…" : "Create Vendor Agreement"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {filesForm ? (
        <div
          className={styles.deleteModalBackdrop}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeGenerateFilesForm();
          }}
        >
          <div
            className={`${styles.deleteModal} ${styles.filesModal}`}
            role="dialog"
            aria-labelledby="files-form-title"
          >
            <h2 id="files-form-title" className={styles.vendorModalTitle}>
              Generate Files
            </h2>
            <p className={styles.deleteModalText}>
              Consumer <strong>{filesForm.row.consumerNo}</strong> —{" "}
              {filesForm.row.customerName || "Customer"}. Discom / Sub Division fill karke
              3 PDF files generate hongi (Work Completion, Vendor Completion, Safety). Product
              names Team Leader form / BOM se aate hain.
            </p>

            <div className={styles.filesTabs} role="tablist">
              {GENERATE_FILE_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  className={
                    filesForm.tab === tab.id
                      ? `${styles.filesTab} ${styles.filesTabActive}`
                      : styles.filesTab
                  }
                  onClick={() => patchFilesForm("tab", tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {filesForm.tab === "setup" ? (
              <div className={styles.filesTabPanel}>
                <label className={styles.vendorField}>
                  Discom *
                  <select
                    value={filesForm.discom}
                    onChange={(e) => patchFilesForm("discom", e.target.value)}
                  >
                    {GENERATE_FILE_DISCOMS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.vendorField}>
                  Sub Division Name *
                  <input
                    list="generate-file-subdivisions"
                    value={filesForm.subdivision}
                    onChange={(e) => patchFilesForm("subdivision", e.target.value)}
                    placeholder="e.g. X53 - PUNDRI"
                  />
                  <datalist id="generate-file-subdivisions">
                    {GENERATE_FILE_SUBDIVISIONS.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </label>
                <div className={styles.vendorPreview}>
                  <div>
                    <span>Panel (Team Leader / BOM):</span>{" "}
                    <strong>{filesForm.products?.panelName || "—"}</strong>
                  </div>
                  <div>
                    <span>Inverter:</span>{" "}
                    <strong>{filesForm.products?.inverterName || "—"}</strong>
                  </div>
                  <div>
                    <span>Source:</span>{" "}
                    <strong>
                      {filesForm.products?.source === "team-leader"
                        ? "Team Leader form"
                        : "BOM / default"}
                    </strong>
                  </div>
                </div>
              </div>
            ) : (
              <div className={styles.filesTabPanel}>
                {(() => {
                  const tab = GENERATE_FILE_TABS.find((t) => t.id === filesForm.tab);
                  const preview = buildGenerateCaseContext(filesForm.row, {
                    discom: filesForm.discom,
                    subdivision: filesForm.subdivision || "(Sub Division)",
                  });
                  return (
                    <>
                      <p className={styles.deleteModalText}>
                        <strong>{tab?.label}</strong> — customer / Discom / products se fill
                        hogi.
                      </p>
                      <div className={styles.vendorPreview}>
                        <div>
                          Name: <strong>{preview.partyName || "—"}</strong>
                        </div>
                        <div>
                          Address: <strong>{preview.address || "—"}</strong>
                        </div>
                        <div>
                          Discom:{" "}
                          <strong>
                            {filesForm.discom} / {filesForm.subdivision || "—"}
                          </strong>
                        </div>
                        <div>
                          Panel: <strong>{preview.products.panelName}</strong>
                        </div>
                        <div>
                          Inverter: <strong>{preview.products.inverterName}</strong>
                        </div>
                      </div>
                      {tab?.templateUrl ? (
                        <p className={styles.filesTemplateNote}>
                          Original template:{" "}
                          <a href={tab.templateUrl} download={tab.templateName}>
                            {tab.templateName}
                          </a>
                        </p>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            )}

            <div className={styles.deleteModalActions}>
              <button
                type="button"
                className={styles.btnOutline}
                onClick={closeGenerateFilesForm}
                disabled={filesBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.vendorConfirmBtn}
                onClick={confirmGenerateFiles}
                disabled={filesBusy}
              >
                {filesBusy ? "Generating…" : "Generate All Files"}
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
              {rowEditLock || canDelete ? <th>Action</th> : null}
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
                  {actions.map((action) => {
                    const busy =
                      (action.key === "vendor" && vendorBusyKey === cacheKeyForRow(row)) ||
                      (action.key === "quotation" && quotationBusy);
                    const vendorReady = action.key === "vendor" && row.vendorAgreementReady;
                    const quotationReady = action.key === "quotation" && row.quotationReady;
                    return (
                      <td key={action.key}>
                        <div className={styles.actionStack}>
                          <button
                            type="button"
                            className={
                              action.tone === "gold"
                                ? `${styles.actionBtn} ${styles.actionBtnGold}`
                                : styles.actionBtn
                            }
                            disabled={busy}
                            onClick={() => handleGenerate(action.key, row)}
                          >
                            {action.key === "vendor" && busy
                              ? "Generating…"
                              : action.key === "quotation" && busy
                                ? "Generating…"
                                : vendorReady || quotationReady
                                  ? "Re-generate"
                                  : "Generate"}
                          </button>
                          {action.key === "vendor" && vendorReady ? (
                            <button
                              type="button"
                              className={styles.downloadBtn}
                              disabled={busy}
                              onClick={() => handleDownloadVendor(row)}
                            >
                              Download Vendor Agreement
                            </button>
                          ) : null}
                          {action.key === "quotation" && quotationReady ? (
                            <button
                              type="button"
                              className={styles.downloadBtn}
                              disabled={busy}
                              onClick={() => downloadRowQuotation(row)}
                              title={row.quotationNo || ""}
                            >
                              Download Quotation
                              {row.quotationNo ? ` (${row.quotationNo})` : ""}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    );
                  })}
                  {rowEditLock || canDelete ? (
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
                      {canDelete ? (
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={() => deleteRow(row)}
                          title="Admin only — delete"
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
