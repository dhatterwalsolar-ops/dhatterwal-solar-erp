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
  attachEwayBillToInvoice,
  findInvoiceForSaleRow,
  getInvoiceById,
  issueSaleInvoice,
  peekNextInvoiceSerial,
} from "../../../utils/invoiceStorage";
import {
  clearedSaleInvoiceFields,
  deleteOldInvoiceCompletely,
} from "../../../utils/tempInvoiceDelete";
import { TEMP_ALLOW_INVOICE_DELETE } from "../../../constants/tempInvoiceDelete";
import {
  downloadInvoiceDoc,
  findEwayDocument,
  findInvoiceDocument,
  openHtmlDocument,
  saveEwayDocumentToFolder,
  saveInvoiceDocumentToFolder,
} from "../../../utils/saleInvoiceDocuments";
import { resolveInvoiceItemDetails } from "../../../utils/saleInvoiceItems";
import { callEwayGenerateApi } from "../../../utils/ewayBillApi";
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
  const [invoiceForm, setInvoiceForm] = useState({
    amount: "",
    pinCode: "",
    station: "",
    panelName: "",
    inverterName: "",
    inverterSerial: "",
    vehicleNo: "",
    previewInvoiceNo: "",
  });
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [ewayContext, setEwayContext] = useState(null);
  const [ewayDistance, setEwayDistance] = useState("");
  const [ewayBusy, setEwayBusy] = useState(false);
  const [ewayResult, setEwayResult] = useState(null);
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
    if (row.invoiceNo) {
      window.alert(
        `Is sale par pehle se invoice hai: ${row.invoiceNo}. Download Invoice / E-Way Bill use karein.`,
      );
      return;
    }
    const items = resolveInvoiceItemDetails(row);
    setInvoiceRow(row);
    setInvoiceForm({
      amount: row.amount || "",
      pinCode: row.invoicePinCode || "",
      station: row.invoiceStation || "",
      panelName: items.panelName,
      inverterName: items.inverterName,
      inverterSerial: items.inverterSerial,
      vehicleNo: row.vehicleNo || "",
      previewInvoiceNo: peekNextInvoiceSerial(),
    });
  };

  const patchInvoiceForm = (key, value) => {
    setInvoiceForm((prev) => ({ ...prev, [key]: value }));
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

  const openEwayModalForRow = (row) => {
    if (!row.invoiceId && !row.invoiceNo) {
      window.alert("Pehle Generate Invoice karein.");
      return;
    }
    const invoice = getInvoiceById(row.invoiceId) || {
      id: row.invoiceId,
      invoiceNo: row.invoiceNo,
      consumerNo: row.consumerNo,
      customerName: row.customerName,
      vehicleNo: row.vehicleNo,
      pinCode: row.invoicePinCode,
      station: row.invoiceStation,
      panelName: row.invoicePanelName,
      inverterName: row.invoiceInverterName,
      inverterSerial: row.invoiceInverterSerial,
      setupKw: row.setupKw,
      taxableAmount: Number(row.amount) || 0,
      totalAmount: Number(row.amount) || 0,
      gstType: row.invoiceGstType || "",
      date: row.invoiceDate || "",
      withGst: row.invoiceWithGst,
    };
    setEwayResult(
      row.ewayBillNo
        ? {
            ewayBillNo: row.ewayBillNo,
            distanceKm: row.ewayDistanceKm || "",
            validUpto: row.ewayValidUpto || "",
          }
        : null,
    );
    setEwayDistance(row.ewayDistanceKm || "");
    setEwayContext({ saleRow: row, invoice });
  };

  const downloadRowInvoice = (row) => {
    const doc = findInvoiceDocument(row.consumerNo, row.invoiceNo);
    if (!doc) {
      window.alert("Invoice file folder me nahi mili. Open folder check karein.");
      return;
    }
    downloadInvoiceDoc(doc);
  };

  const downloadRowEway = (row) => {
    const doc = findEwayDocument(row.consumerNo, row.ewayBillNo);
    if (!doc) {
      window.alert("E-Way Bill file folder me nahi mili.");
      return;
    }
    downloadInvoiceDoc(doc);
  };

  const deleteRowInvoice = (row) => {
    if (!TEMP_ALLOW_INVOICE_DELETE) {
      window.alert("Invoice delete live site pe available nahi hoga.");
      return;
    }
    const invoice = findInvoiceForSaleRow(row);
    if (!invoice?.id) {
      window.alert("Invoice record nahi mili.");
      return;
    }
    if (
      !window.confirm(
        `TEMP: Invoice ${invoice.invoiceNo} delete karein?\n\nInvoice File, payment, folder files hatenge. Phir dubara Generate Invoice kar sakte ho.`,
      )
    ) {
      return;
    }
    const result = deleteOldInvoiceCompletely(invoice.id);
    if (!result.ok) {
      window.alert(result.error || "Delete fail.");
      return;
    }
    setRows((prev) =>
      prev.map((r) => (rowsMatch(r, row) ? clearedSaleInvoiceFields(r) : r)),
    );
    setDocRefresh((n) => n + 1);
    if (ewayContext?.invoice?.id === invoice.id) {
      setEwayContext(null);
      setEwayResult(null);
    }
    window.alert(`Invoice ${invoice.invoiceNo} delete ho gayi. Ab naya generate kar sakte ho.`);
  };

  const generateInvoice = async (withGst) => {
    if (!invoiceRow || invoiceBusy) return;

    const pinCode = String(invoiceForm.pinCode || "").trim();
    const station = String(invoiceForm.station || "").trim();
    const vehicleNo = String(invoiceForm.vehicleNo || "").trim();
    const amount = String(invoiceForm.amount || "").trim();

    if (!pinCode || pinCode.length < 6) {
      window.alert("Pin Code (6 digit) bharna zaroori hai.");
      return;
    }
    if (!station) {
      window.alert("Station fill karein.");
      return;
    }
    if (!vehicleNo) {
      window.alert("Vehicle Number fill karein.");
      return;
    }
    if (!amount || !(Number(amount) > 0)) {
      window.alert("Taxable Amount sahi bharen.");
      return;
    }

    setInvoiceBusy(true);
    try {
      const invoice = issueSaleInvoice({
        consumerNo: invoiceRow.consumerNo,
        customerName: invoiceRow.customerName,
        fatherName: invoiceRow.fatherName,
        address: invoiceRow.address,
        mobile: invoiceRow.mobile,
        setupKw: invoiceRow.setupKw,
        amount,
        withGst,
        pinCode,
        station,
        panelName: invoiceForm.panelName,
        inverterName: invoiceForm.inverterName,
        inverterSerial: invoiceForm.inverterSerial,
        vehicleNo,
        saleRowId: saleRowKey(invoiceRow),
      });

      await saveInvoiceDocumentToFolder(invoice);

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
          rowsMatch(row, invoiceRow)
            ? {
                ...row,
                amount,
                invoiceId: invoice.id,
                invoiceNo: invoice.invoiceNo,
                invoiceWithGst: invoice.withGst,
                invoiceGstType: invoice.gstType,
                invoiceDate: invoice.date,
                invoicePinCode: invoice.pinCode,
                invoiceStation: invoice.station,
                invoicePanelName: invoice.panelName,
                invoiceInverterName: invoice.inverterName,
                invoiceInverterSerial: invoice.inverterSerial,
                vehicleNo: invoice.vehicleNo,
              }
            : row,
        ),
      );
      setDocRefresh((n) => n + 1);

      const saleSnapshot = {
        ...invoiceRow,
        amount,
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        vehicleNo: invoice.vehicleNo,
        invoicePinCode: invoice.pinCode,
        invoiceStation: invoice.station,
      };

      setInvoiceRow(null);
      setEwayResult(null);
      setEwayDistance("");
      setEwayContext({ saleRow: saleSnapshot, invoice });
    } catch (err) {
      window.alert(err?.message || "Invoice generate / folder save fail hua.");
    } finally {
      setInvoiceBusy(false);
    }
  };

  const generateEwayBill = async () => {
    if (!ewayContext?.invoice || ewayBusy) return;
    const distanceKm = String(ewayDistance || "").trim();
    if (!distanceKm || !(Number(distanceKm) > 0)) {
      window.alert("Distance (km) fill karein.");
      return;
    }

    setEwayBusy(true);
    setEwayResult(null);
    try {
      const invoice = ewayContext.invoice;
      const api = await callEwayGenerateApi({
        invoiceNo: invoice.invoiceNo,
        consumerNo: invoice.consumerNo,
        vehicleNo: invoice.vehicleNo,
        pinCode: invoice.pinCode,
        station: invoice.station,
        distanceKm,
      });

      if (!api.ok) {
        window.alert(api.error || "E-Way Bill API failed.");
        return;
      }

      const ewayPayload = {
        ewayBillNo: api.ewayBillNo,
        distanceKm: Number(distanceKm),
        validUpto: api.validUpto,
      };

      const updatedInvoice = attachEwayBillToInvoice(invoice.id, ewayPayload) || {
        ...invoice,
        ewayBillNo: api.ewayBillNo,
      };

      await saveEwayDocumentToFolder(updatedInvoice, ewayPayload);
      await saveInvoiceDocumentToFolder({
        ...updatedInvoice,
        ewayBillNo: api.ewayBillNo,
      });

      setRows((prev) =>
        prev.map((row) =>
          rowsMatch(row, ewayContext.saleRow) ||
          (row.invoiceId && row.invoiceId === invoice.id)
            ? {
                ...row,
                ewayBillNo: api.ewayBillNo,
                ewayDistanceKm: String(distanceKm),
                ewayValidUpto: api.validUpto || "",
              }
            : row,
        ),
      );
      setDocRefresh((n) => n + 1);
      setEwayResult(ewayPayload);
      setEwayContext((prev) =>
        prev
          ? {
              ...prev,
              invoice: { ...updatedInvoice, ewayBillNo: api.ewayBillNo },
            }
          : prev,
      );
    } catch (err) {
      window.alert(err?.message || "E-Way Bill generate fail hua.");
    } finally {
      setEwayBusy(false);
    }
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
                  <div className={styles.invoiceActions}>
                    {row.invoiceNo ? (
                      <>
                        <span className={styles.invoiceNoBadge} title="Invoice number">
                          {row.invoiceNo}
                        </span>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => downloadRowInvoice(row)}
                        >
                          Download Invoice
                        </button>
                        {row.ewayBillNo ? (
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnGold}`}
                            onClick={() => downloadRowEway(row)}
                          >
                            Download E-Way ({row.ewayBillNo})
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnGold}`}
                            onClick={() => openEwayModalForRow(row)}
                          >
                            E-Way Bill
                          </button>
                        )}
                        {TEMP_ALLOW_INVOICE_DELETE ? (
                          <button
                            type="button"
                            className={styles.deleteInvoiceBtn}
                            onClick={() => deleteRowInvoice(row)}
                            title="Temporary — live pe hata denge"
                          >
                            Delete Invoice (TEMP)
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <button
                        type="button"
                        className={styles.actionBtn}
                        onClick={() => openInvoiceModal(row)}
                      >
                        Generate Invoice
                      </button>
                    )}
                  </div>
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
          <div className={`${styles.modal} ${styles.modalInvoice}`} role="dialog" aria-modal="true">
            <h2>Generate Invoice</h2>
            <p className={styles.invoicePreviewNo}>
              Next Invoice No. (series): <strong>{invoiceForm.previewInvoiceNo}</strong>
            </p>

            <div className={styles.partyBox}>
              <strong>Party detail (Sale Sheet)</strong>
              <div className={styles.partyGrid}>
                <span>Consumer: {invoiceRow.consumerNo}</span>
                <span>Mobile: {invoiceRow.mobile || "—"}</span>
                <span>Name: {invoiceRow.customerName}</span>
                <span>Father/Husband: {invoiceRow.fatherName || "—"}</span>
                <span className={styles.partyFull}>Address: {invoiceRow.address || "—"}</span>
                <span>Setup: {invoiceRow.setupKw || "—"}</span>
              </div>
            </div>

            <div className={styles.modalFormGrid}>
              <label className={styles.modalLabel}>
                Pin Code *
                <input
                  value={invoiceForm.pinCode}
                  onChange={(e) => patchInvoiceForm("pinCode", e.target.value)}
                  placeholder="6 digit"
                  maxLength={6}
                />
              </label>
              <label className={styles.modalLabel}>
                Station *
                <input
                  value={invoiceForm.station}
                  onChange={(e) => patchInvoiceForm("station", e.target.value)}
                  placeholder="Delivery station / place"
                />
              </label>
              <label className={`${styles.modalLabel} ${styles.modalLabelFull}`}>
                Panel Name (Setup Detail)
                <input
                  value={invoiceForm.panelName}
                  onChange={(e) => patchInvoiceForm("panelName", e.target.value)}
                />
              </label>
              <label className={styles.modalLabel}>
                Inverter Name
                <input
                  value={invoiceForm.inverterName}
                  onChange={(e) => patchInvoiceForm("inverterName", e.target.value)}
                />
              </label>
              <label className={styles.modalLabel}>
                Inverter Sr. No.
                <input
                  value={invoiceForm.inverterSerial}
                  onChange={(e) => patchInvoiceForm("inverterSerial", e.target.value)}
                />
              </label>
              <label className={styles.modalLabel}>
                Vehicle Number *
                <input
                  value={invoiceForm.vehicleNo}
                  onChange={(e) => patchInvoiceForm("vehicleNo", e.target.value.toUpperCase())}
                  placeholder="HRXXAB1234"
                />
              </label>
              <label className={styles.modalLabel}>
                Taxable Amount (₹) *
                <input
                  type="number"
                  value={invoiceForm.amount}
                  onChange={(e) => patchInvoiceForm("amount", e.target.value)}
                  min="0"
                />
              </label>
            </div>

            <p className={styles.modalHint}>Choose invoice type:</p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnGold}
                disabled={invoiceBusy}
                onClick={() => generateInvoice(true)}
              >
                {invoiceBusy ? "Generating…" : "With GST (5% + 18%)"}
              </button>
              <button
                type="button"
                className={styles.btnOutline}
                disabled={invoiceBusy}
                onClick={() => generateInvoice(false)}
              >
                Without GST
              </button>
              <button
                type="button"
                className={styles.btnCancel}
                disabled={invoiceBusy}
                onClick={() => setInvoiceRow(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {ewayContext && (
        <div className={styles.modalBackdrop} role="presentation">
          <div className={`${styles.modal} ${styles.modalInvoice}`} role="dialog" aria-modal="true">
            <h2>E-Way Bill</h2>
            <p>
              Invoice <strong>{ewayContext.invoice?.invoiceNo}</strong> —{" "}
              {ewayContext.invoice?.customerName}
            </p>
            <div className={styles.partyBox}>
              <div className={styles.partyGrid}>
                <span>Vehicle: {ewayContext.invoice?.vehicleNo || "—"}</span>
                <span>Pin: {ewayContext.invoice?.pinCode || "—"}</span>
                <span>Station: {ewayContext.invoice?.station || "—"}</span>
                <span>
                  Panel: {ewayContext.invoice?.panelName || "—"}
                </span>
              </div>
            </div>

            {!ewayResult ? (
              <>
                <label className={styles.modalLabel}>
                  Distance (km) *
                  <input
                    type="number"
                    min="1"
                    value={ewayDistance}
                    onChange={(e) => setEwayDistance(e.target.value)}
                    placeholder="e.g. 45"
                  />
                </label>
                <p className={styles.modalHintSmall}>
                  Generate pe API data match karke E-Way Bill number issue hoga. Invoice + E-Way Bill
                  customer Open folder (Invoices) me save honge.
                </p>
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.btnGold}
                    disabled={ewayBusy}
                    onClick={generateEwayBill}
                  >
                    {ewayBusy ? "Matching API…" : "Generate E-Way Bill"}
                  </button>
                  <button
                    type="button"
                    className={styles.btnCancel}
                    disabled={ewayBusy}
                    onClick={() => setEwayContext(null)}
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className={styles.ewaySuccess}>Successfully — E-Way Bill generated</p>
                <p>
                  E-Way Bill No.: <strong>{ewayResult.ewayBillNo}</strong>
                  {ewayResult.validUpto ? (
                    <>
                      <br />
                      Valid upto: {ewayResult.validUpto}
                    </>
                  ) : null}
                </p>
                <div className={styles.modalActions}>
                  <button
                    type="button"
                    className={styles.btnGold}
                    onClick={() => {
                      const doc = findEwayDocument(
                        ewayContext.invoice.consumerNo,
                        ewayResult.ewayBillNo,
                      );
                      if (doc) openHtmlDocument(doc);
                      else downloadRowEway(ewayContext.saleRow);
                    }}
                  >
                    Download E-Way Bill
                  </button>
                  <button
                    type="button"
                    className={styles.btnOutline}
                    onClick={() => {
                      const doc = findInvoiceDocument(
                        ewayContext.invoice.consumerNo,
                        ewayContext.invoice.invoiceNo,
                      );
                      if (doc) openHtmlDocument(doc);
                    }}
                  >
                    Download Invoice
                  </button>
                  <button
                    type="button"
                    className={styles.btnCancel}
                    onClick={() => {
                      setEwayContext(null);
                      setEwayResult(null);
                    }}
                  >
                    Done
                  </button>
                </div>
              </>
            )}
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
