import { useEffect, useMemo, useRef, useState } from "react";
import { BACKUP_ENTRY_SYNC_EVENT } from "../../../constants/backupEntry";
import {
  addBackupEntry,
  backupToSaleRow,
  findBackupByConsumerNo,
  mergeSaleRowsWithBackup,
  patchBackupFromSaleRow,
  upsertBackupEntry,
  deleteBackupEntry,
} from "../../../utils/backupEntryStorage";
import { formatSetupDetail } from "../../../constants/bomRegistry";
import { getBomMaterialsForConsumer } from "../../../utils/bomSheetStorage";
import { lookupCustomer } from "../../../constants/customerRegistry";
import {
  SALE_TEAM_WORK_OPTIONS,
  createEmptySaleRow,
} from "../../../constants/saleCase";
import { loadSaleCaseRows, saveSaleCaseRows } from "../../../utils/saleCaseStorage";
import {
  loadSaleCaseRowsSyncedWithCaseSheets,
  mergeSaleRowWithCaseSheets,
  SALE_CASE_SYNC_EVENT,
} from "../../../utils/saleCaseSync";
import { LOAN_CASE_SYNC_EVENT } from "../../../utils/loanCaseStorage";
import { CASH_CASE_SYNC_EVENT } from "../../../utils/cashCaseStorage";
import { generateCompleteFilePackage } from "../../../utils/completeFileGenerator";
import {
  customerFolderPath,
  listCustomerDocuments,
  readFileAsDataUrl,
} from "../../../utils/customerDocuments";
import CustomerFolderModal from "./CustomerFolderModal";
import {
  issueSaleInvoice,
} from "../../../utils/invoiceStorage";
import {
  addCustomerPayment,
  notifyPaymentSync,
  PAYMENT_CATEGORIES,
} from "../../../utils/customerPaymentLedger";
import { getSaleTeamLeaderConfig } from "../../../constants/saleTeamMapping";
import {
  getSiteOrderById,
  upsertSiteOrderForSaleRow,
  SITE_ORDER_SYNC_EVENT,
} from "../../../utils/siteOrderStorage";
import { openWhatsAppSiteOrder, buildSiteOrderFormUrl } from "../../../utils/siteOrderWhatsApp";
import {
  getPublicAppBaseUrl,
  getSavedPublicAppBaseUrl,
  isLocalhostBaseUrl,
  needsLanUrlForTeamLinks,
  setPublicAppBaseUrl,
} from "../../../utils/siteOrderUrl";
import styles from "./SaleCaseSheet.module.css";

function hydrateSaleRow(row) {
  if (row.isBackupEntry) {
    return { ...row };
  }
  const bom = getBomMaterialsForConsumer(row.consumerNo);
  return {
    ...row,
    setupDetail: row.setupDetail || formatSetupDetail(bom),
  };
}

function ensureSaleRowId(row) {
  if (row._rowId || row.entryId) return row;
  return {
    ...row,
    _rowId: `sale-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  };
}

function saleRowKey(row) {
  return row.entryId || row._rowId || "";
}

function rowsMatch(a, b) {
  if (a === b) return true;
  const ka = saleRowKey(a);
  const kb = saleRowKey(b);
  return Boolean(ka && ka === kb);
}

function applyConsumerLookup(row, consumerNo) {
  const trimmed = String(consumerNo || "").trim();
  if (row.isBackupEntry) {
    const backup = findBackupByConsumerNo(trimmed);
    if (!backup) {
      return { ...row, consumerNo: trimmed };
    }
    return { ...hydrateSaleRow(backupToSaleRow(backup)), entryId: row.entryId };
  }

  const customer = lookupCustomer(trimmed);

  if (!trimmed) {
    return {
      ...row,
      consumerNo: "",
      customerName: "",
      fatherName: "",
      address: "",
      mobile: "",
      setupKw: "",
      setupDetail: "",
    };
  }

  if (!customer) {
    return {
      ...row,
      consumerNo: trimmed,
      customerName: "",
      fatherName: "",
      address: "",
      mobile: "",
      setupKw: "",
      teamWork: row.teamWork,
      setupDetail: "Consumer No. Loan / Cash Case me nahi mila — pehle wahan entry karein.",
    };
  }

  return mergeSaleRowWithCaseSheets({ ...row, consumerNo: trimmed });
}

function reloadSaleRowsFromStorage() {
  return mergeSaleRowsWithBackup(loadSaleCaseRowsSyncedWithCaseSheets())
    .map(ensureSaleRowId)
    .map(hydrateSaleRow);
}

function SaleCaseSheet() {
  const [rows, setRows] = useState(() => reloadSaleRowsFromStorage());
  const [query, setQuery] = useState("");
  const [invoiceRow, setInvoiceRow] = useState(null);
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [completeRow, setCompleteRow] = useState(null);
  const [jointReport, setJointReport] = useState(null);
  const [folderRow, setFolderRow] = useState(null);
  const [docRefresh, setDocRefresh] = useState(0);
  const [lanUrlDraft, setLanUrlDraft] = useState(() => getSavedPublicAppBaseUrl());
  const [linkBaseTick, setLinkBaseTick] = useState(0);
  const jointInputRef = useRef(null);
  const consumerSyncTimers = useRef(new Map());

  useEffect(() => {
    saveSaleCaseRows(rows.filter((r) => !r.isBackupEntry));
  }, [rows]);

  useEffect(() => {
    const reloadFromCaseSheets = () => {
      setRows(reloadSaleRowsFromStorage());
    };
    const refreshBackups = () => {
      setRows(reloadSaleRowsFromStorage());
    };
    window.addEventListener(SALE_CASE_SYNC_EVENT, reloadFromCaseSheets);
    window.addEventListener(BACKUP_ENTRY_SYNC_EVENT, refreshBackups);
    window.addEventListener(LOAN_CASE_SYNC_EVENT, reloadFromCaseSheets);
    window.addEventListener(CASH_CASE_SYNC_EVENT, reloadFromCaseSheets);
    const onSiteOrder = () => {
      setRows((prev) =>
        prev.map((row) => {
          if (!row.siteOrderId) return row;
          const order = getSiteOrderById(row.siteOrderId);
          if (!order) return row;
          return { ...row, siteOrderStatus: order.status };
        }),
      );
    };
    window.addEventListener(SITE_ORDER_SYNC_EVENT, onSiteOrder);
    return () => {
      window.removeEventListener(SALE_CASE_SYNC_EVENT, reloadFromCaseSheets);
      window.removeEventListener(BACKUP_ENTRY_SYNC_EVENT, refreshBackups);
      window.removeEventListener(LOAN_CASE_SYNC_EVENT, reloadFromCaseSheets);
      window.removeEventListener(CASH_CASE_SYNC_EVENT, reloadFromCaseSheets);
      window.removeEventListener(SITE_ORDER_SYNC_EVENT, onSiteOrder);
    };
  }, []);

  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((row) =>
      Object.values(row).some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [query, rows]);

  const updateCell = (rowRef, key, value) => {
    setRows((prev) =>
      prev.map((row) => {
        if (!rowsMatch(row, rowRef)) return row;
        const next = { ...row, [key]: value };
        if (row.isBackupEntry && row.entryId) {
          upsertBackupEntry(patchBackupFromSaleRow(next));
        }
        return next;
      }),
    );
  };

  const scheduleConsumerSync = (rowRef, consumerNo) => {
    const key = saleRowKey(rowRef) || rowRef;
    const timers = consumerSyncTimers.current;
    if (timers.has(key)) clearTimeout(timers.get(key));
    const trimmed = String(consumerNo || "").trim();
    if (trimmed.length < 2) return;
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        setRows((prev) =>
          prev.map((row) =>
            rowsMatch(row, rowRef) ? applyConsumerLookup(row, consumerNo) : row,
          ),
        );
      }, 400),
    );
  };

  const syncConsumerData = (rowRef, consumerNo) => {
    const key = saleRowKey(rowRef) || rowRef;
    const timers = consumerSyncTimers.current;
    if (timers.has(key)) {
      clearTimeout(timers.get(key));
      timers.delete(key);
    }
    setRows((prev) =>
      prev.map((row) =>
        rowsMatch(row, rowRef) ? applyConsumerLookup(row, consumerNo) : row,
      ),
    );
  };

  const handleAddBackupEntry = () => {
    const created = addBackupEntry();
    setRows((prev) => [...prev, hydrateSaleRow(backupToSaleRow(created))]);
  };

  const deleteRow = (row) => {
    const label = row.consumerNo?.trim() || row.customerName?.trim() || "ye row";
    if (!window.confirm(`"${label}" ko Sale Sheet se delete karein?`)) return;
    if (row.isBackupEntry && row.entryId) {
      deleteBackupEntry(row.entryId);
    }
    setRows((prev) => prev.filter((r) => !rowsMatch(r, row)));
  };

  const handleTeamWorkChange = (row, teamWork) => {
    let createdOrder = null;
    setRows((prev) =>
      prev.map((r) => {
        if (!rowsMatch(r, row)) return r;
        const next = { ...r, teamWork };
        if (teamWork?.trim() && next.consumerNo?.trim() && !next.isBackupEntry) {
          createdOrder = upsertSiteOrderForSaleRow(next);
          if (createdOrder) {
            next.siteOrderId = createdOrder.id;
            next.siteOrderStatus = createdOrder.status;
          }
        }
        return next;
      }),
    );

    if (!teamWork?.trim() || row.isBackupEntry) return;
    if (!row.consumerNo?.trim()) {
      window.alert("Pehle Consumer No. bharein, phir Team Work select karein.");
      return;
    }
    if (!getSaleTeamLeaderConfig(teamWork)?.mobile) {
      window.alert("Is team ka leader mobile Labour Details me set karein.");
      return;
    }
    if (
      createdOrder &&
      window.confirm(
        `Team "${teamWork}" set.\n\nSirf *${createdOrder.teamLeaderName}* (${teamWork}) ko WhatsApp par site + Google form link bhejein?\n\nConsumer: ${row.customerName || "—"} (${row.consumerNo})`,
      )
    ) {
      openWhatsAppSiteOrder(createdOrder, { skipConfirm: true });
    }
  };

  const siteFormHrefForRow = (row) => {
    const stored = row.siteOrderId ? getSiteOrderById(row.siteOrderId) : null;
    const order = stored || upsertSiteOrderForSaleRow(row);
    return order ? buildSiteOrderFormUrl(order) : "#";
  };

  const sendSiteFormWhatsApp = (row) => {
    if (!row.consumerNo?.trim()) {
      window.alert("Consumer No. zaroori hai.");
      return;
    }
    if (!row.teamWork?.trim()) {
      window.alert("Team Work select karein.");
      return;
    }
    const order =
      getSiteOrderById(row.siteOrderId) || upsertSiteOrderForSaleRow(row);
    if (!order) return;
    if (!order.teamLeaderMobile) {
      window.alert("Team leader mobile nahi mila — Labour Details check karein.");
      return;
    }
    openWhatsAppSiteOrder(order);
  };

  const requireConsumerRow = (row) => {
    if (!row.consumerNo?.trim()) {
      window.alert("Enter Consumer No. first.");
      return false;
    }
    if (!row.customerName) {
      window.alert("Consumer details not loaded. Re-enter Consumer No.");
      return false;
    }
    return true;
  };

  const openInvoiceModal = (row) => {
    if (!requireConsumerRow(row)) return;
    setInvoiceRow(row);
    setInvoiceAmount(row.amount || "");
  };

  const openCompleteModal = (row) => {
    if (!requireConsumerRow(row)) return;
    setCompleteRow(row);
    setJointReport(null);
  };

  const openFolderModal = (row) => {
    if (!row.consumerNo?.trim()) {
      window.alert("Enter Consumer No. to open customer document folder.");
      return;
    }
    setFolderRow(row);
    setDocRefresh((n) => n + 1);
  };

  const generateInvoice = (withGst) => {
    if (!invoiceRow) return;
    const invoice = issueSaleInvoice({
      consumerNo: invoiceRow.consumerNo,
      customerName: invoiceRow.customerName,
      fatherName: invoiceRow.fatherName,
      address: invoiceRow.address,
      setupKw: invoiceRow.setupKw,
      amount: invoiceAmount,
      withGst,
    });

    addCustomerPayment({
      sourceRef: `sale-${invoice.id}`,
      consumerNo: invoiceRow.consumerNo,
      date: invoice.date,
      amount: invoice.totalAmount,
      category: PAYMENT_CATEGORIES.SALE,
      label: `Sale Invoice (${invoice.gstType})`,
      reference: invoice.invoiceNo,
      applicationNo: invoice.invoiceNo,
    });
    notifyPaymentSync();

    setRows((prev) =>
      prev.map((row) =>
        rowsMatch(row, invoiceRow) ? { ...row, amount: invoiceAmount } : row,
      ),
    );

    window.alert(
      `Invoice ${invoice.invoiceNo} (Sr. ${invoice.srNo}) generated (${invoice.gstType}). Total: ₹${invoice.totalAmount.toLocaleString("en-IN")}${
        withGst ? " — GST Report me bhi dikhega." : "."
      } Invoice File me save ho gaya.`,
    );
    setInvoiceRow(null);
    setInvoiceAmount("");
  };

  const onJointReportPick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setJointReport({ fileName: file.name, dataUrl });
  };

  const runCompleteFile = async () => {
    if (!completeRow) return;
    const bom = getBomMaterialsForConsumer(completeRow.consumerNo);
    try {
      const { packageFolder, included } = await generateCompleteFilePackage({
        customer: {
          consumerNo: completeRow.consumerNo,
          customerName: completeRow.customerName,
          fatherName: completeRow.fatherName,
          address: completeRow.address,
        },
        bom,
        setupKw: completeRow.setupKw,
        date: completeRow.date || new Date().toLocaleDateString("en-GB"),
        jointReportDataUrl: jointReport?.dataUrl,
        jointReportFileName: jointReport?.fileName,
      });
      setDocRefresh((n) => n + 1);
      window.alert(
        `Complete file package created (${included.length} items).\nSaved under:\n${packageFolder}\n\nManifest downloaded to your PC.`,
      );
      setCompleteRow(null);
      setJointReport(null);
    } catch (err) {
      window.alert(err.message || "Could not generate complete file.");
    }
  };

  const folderDocs = useMemo(() => {
    void docRefresh;
    if (!folderRow?.consumerNo) return [];
    return listCustomerDocuments(folderRow.consumerNo);
  }, [folderRow, docRefresh]);

  const teamLinkNeedsLan = useMemo(() => {
    void linkBaseTick;
    return needsLanUrlForTeamLinks();
  }, [linkBaseTick]);

  const saveLanUrl = () => {
    const trimmed = lanUrlDraft.trim();
    if (!trimmed) {
      window.alert("Pehle URL likhein — jaise http://192.168.1.10:5173");
      return;
    }
    if (isLocalhostBaseUrl(trimmed)) {
      window.alert("localhost / 127.0.0.1 mat likhein — apna WiFi IPv4 address use karein.");
      return;
    }
    setPublicAppBaseUrl(trimmed);
    setLinkBaseTick((n) => n + 1);
    window.alert(`Team link URL save: ${getPublicAppBaseUrl()}\n\nAb dubara WhatsApp Form bhejein.`);
  };

  const docCountForRow = (row) => {
    void docRefresh;
    if (!row.consumerNo?.trim()) return 0;
    return listCustomerDocuments(row.consumerNo).length;
  };

  return (
    <section className={styles.sheet}>
      <header className={styles.toolbar}>
        <div>
          <h1>Sale Sheet</h1>
          <p>
            Team Work select par *sirf us team leader* ko WhatsApp (7876686572 Web login).
            Message me consumer naam/detail + Google Form link. ERP form se stock less.
          </p>
        </div>
        <div className={styles.toolbarActions}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sale rows..."
            className={styles.search}
          />
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setRows((prev) => [...prev, createEmptySaleRow()])}
          >
            + Add Row
          </button>
          <button type="button" className={styles.btnBackup} onClick={handleAddBackupEntry}>
            + Backup Entry
          </button>
        </div>
      </header>

      {teamLinkNeedsLan ? (
        <div className={styles.localhostBanner}>
          <strong>ERP abhi localhost par hai</strong>
          <p>
            Team leader ke phone par form tabhi khulega jab link me aapke PC ka <em>WiFi IP</em> ho
            (localhost phone par kaam nahi karta). Pehle <code>npm run dev</code> chalao, phir CMD me{" "}
            <code>ipconfig</code> → IPv4 Address (jaise 192.168.1.10). Neeche URL save karo, phir
            naya WhatsApp bhejo.
          </p>
          <div className={styles.lanUrlRow}>
            <input
              type="url"
              className={styles.lanUrlInput}
              value={lanUrlDraft}
              onChange={(e) => setLanUrlDraft(e.target.value)}
              placeholder="http://192.168.1.10:5173"
            />
            <button type="button" className={styles.lanUrlSave} onClick={saveLanUrl}>
              Save link URL
            </button>
          </div>
          {getSavedPublicAppBaseUrl() ? (
            <p className={styles.lanUrlSaved}>
              Saved: {getSavedPublicAppBaseUrl()} — team leader same WiFi par hon.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Sr. No.</th>
              <th>Date</th>
              <th>Consumer No.</th>
              <th>Consumer Name</th>
              <th>Consumer Father/Husband Name</th>
              <th>Address</th>
              <th>Mobile Number</th>
              <th>Setup</th>
              <th>Team Work</th>
              <th>WhatsApp Site Form</th>
              <th>Setup Detail (from BOM)</th>
              <th>8. Generate Invoice</th>
              <th>9. Generate Complete File</th>
              <th>Customer Folder</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr
                key={saleRowKey(row) || `sale-${rows.indexOf(row)}`}
                className={row.isBackupEntry ? styles.backupRow : undefined}
              >
                <td>
                  {rows.indexOf(row) + 1}
                  {row.isBackupEntry ? <span className={styles.backupBadge}>Backup</span> : null}
                </td>
                <td>
                  <input
                    className={styles.cellInput}
                    value={row.date}
                    onChange={(e) => updateCell(row, "date", e.target.value)}
                    placeholder="DD/MM/YYYY"
                  />
                </td>
                <td>
                  <input
                    className={`${styles.cellInput} ${styles.manualIdInput}`}
                    value={row.consumerNo}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateCell(row, "consumerNo", v);
                      scheduleConsumerSync(row, v);
                    }}
                    onBlur={(e) => syncConsumerData(row, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        syncConsumerData(row, e.currentTarget.value);
                      }
                    }}
                    placeholder="Loan/Cash wala Consumer No."
                  />
                </td>
                <td>
                  <input
                    className={row.isBackupEntry ? styles.cellInput : styles.readOnly}
                    value={row.customerName}
                    readOnly={!row.isBackupEntry}
                    onChange={(e) => updateCell(row, "customerName", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className={row.isBackupEntry ? styles.cellInput : styles.readOnly}
                    value={row.fatherName}
                    readOnly={!row.isBackupEntry}
                    onChange={(e) => updateCell(row, "fatherName", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className={row.isBackupEntry ? styles.cellInput : styles.readOnly}
                    value={row.address}
                    readOnly={!row.isBackupEntry}
                    onChange={(e) => updateCell(row, "address", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    className={styles.cellInput}
                    value={row.mobile}
                    onChange={(e) => updateCell(row, "mobile", e.target.value)}
                    placeholder="Mobile"
                  />
                </td>
                <td>
                  <input
                    className={row.isBackupEntry ? styles.cellInput : styles.readOnly}
                    value={row.setupKw}
                    readOnly={!row.isBackupEntry}
                    onChange={(e) => updateCell(row, "setupKw", e.target.value)}
                  />
                </td>
                <td>
                  <select
                    className={styles.cellSelect}
                    value={row.teamWork}
                    onChange={(e) => handleTeamWorkChange(row, e.target.value)}
                  >
                    <option value="">Select team</option>
                    {SALE_TEAM_WORK_OPTIONS.map((team) => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  {row.teamWork ? (
                    <div className={styles.siteFormCell}>
                      <button
                        type="button"
                        className={styles.waBtn}
                        onClick={() => sendSiteFormWhatsApp(row)}
                      >
                        WhatsApp Team Leader
                      </button>
                      {row.siteOrderId ? (
                        <a
                          className={styles.formLink}
                          href={siteFormHrefForRow(row)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open form
                        </a>
                      ) : null}
                      {row.siteOrderStatus === "submitted" ? (
                        <span className={styles.siteDone}>Stock updated</span>
                      ) : null}
                    </div>
                  ) : (
                    <span className={styles.siteFormMuted}>Optional</span>
                  )}
                </td>
                <td>
                  <textarea
                    className={styles.setupDetail}
                    value={row.setupDetail}
                    readOnly
                    rows={4}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => openInvoiceModal(row)}
                  >
                    Generate Invoice
                  </button>
                </td>
                <td>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.actionBtnGold}`}
                    onClick={() => openCompleteModal(row)}
                  >
                    Generate Complete File
                  </button>
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.folderBtn}
                    onClick={() => openFolderModal(row)}
                  >
                    Open ({docCountForRow(row)})
                  </button>
                </td>
                <td>
                  <button type="button" className={styles.deleteBtn} onClick={() => deleteRow(row)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invoiceRow && (
        <div className={styles.modalBackdrop} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true">
            <h2>Generate Invoice</h2>
            <p>
              Consumer: <strong>{invoiceRow.consumerNo}</strong> —{" "}
              {invoiceRow.customerName}
            </p>
            <label className={styles.modalLabel}>
              Taxable Amount (₹)
              <input
                type="number"
                value={invoiceAmount}
                onChange={(e) => setInvoiceAmount(e.target.value)}
                min="0"
              />
            </label>
            <p className={styles.modalHint}>Choose invoice type:</p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnGold} onClick={() => generateInvoice(true)}>
                With GST (18%)
              </button>
              <button type="button" className={styles.btnOutline} onClick={() => generateInvoice(false)}>
                Without GST
              </button>
              <button type="button" className={styles.btnCancel} onClick={() => setInvoiceRow(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {completeRow && (
        <div className={styles.modalBackdrop} role="presentation">
          <div className={`${styles.modal} ${styles.modalWide}`} role="dialog" aria-modal="true">
            <h2>Generate Complete File</h2>
            <p>
              <strong>{completeRow.consumerNo}</strong> — {completeRow.customerName} (
              {completeRow.setupKw})
            </p>
            <ul className={styles.checklist}>
              <li>Work OS Safety Certificate (proforma — auto by setup + BOM)</li>
              <li>Annexure: panel, inverter, wire, stand (from BOM / labour form)</li>
              <li>All documents uploaded in Loan Case &amp; Cash Case for this consumer</li>
              <li>Joint Report (optional — upload below)</li>
            </ul>
            <input
              ref={jointInputRef}
              type="file"
              className={styles.hiddenFile}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={onJointReportPick}
            />
            <div className={styles.jointRow}>
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => jointInputRef.current?.click()}
              >
                Upload Joint Report
              </button>
              <span className={styles.jointName}>
                {jointReport ? jointReport.fileName : "No joint report selected"}
              </span>
            </div>
            <p className={styles.modalHintSmall}>
              Files save under: {customerFolderPath(completeRow.consumerNo)}/CompleteFile-…
            </p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnGold} onClick={runCompleteFile}>
                Generate &amp; Save to Folder
              </button>
              <button
                type="button"
                className={styles.btnCancel}
                onClick={() => {
                  setCompleteRow(null);
                  setJointReport(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {folderRow && (
        <CustomerFolderModal
          consumerNo={folderRow.consumerNo}
          customerName={folderRow.customerName}
          documents={folderDocs}
          onClose={() => setFolderRow(null)}
        />
      )}
    </section>
  );
}

export default SaleCaseSheet;
