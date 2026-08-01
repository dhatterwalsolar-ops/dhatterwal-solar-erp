import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../../constants/routes";
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
import { createEmptySaleRow } from "../../../constants/saleCase";
import {
  getSaleTeamMembersDisplay,
  getSaleTeamWorkOptions,
  LABOUR_EMPLOYEES_SYNC_EVENT,
  LABOUR_TEAM_MAPPING_SYNC_EVENT,
  syncTeamsFromLabourEmployees,
} from "../../../utils/labourTeamMappingStorage";
import {
  loadSaleCaseRows,
  SALE_SETUP_DETAIL_SYNC_EVENT,
  saveSaleCaseRows,
} from "../../../utils/saleCaseStorage";
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
  getCustomerDocumentCountMap,
  listCustomerDocuments,
  readFileAsDataUrl,
} from "../../../utils/customerDocuments";
import CustomerFolderModal from "./CustomerFolderModal";
import {
  attachEinvoiceToInvoice,
  attachEwayBillToInvoice,
  findInvoiceForSaleRow,
  findNetMeterInvoiceForSaleRow,
  getInvoiceById,
  getInvoiceLookupMaps,
  issueNetMeterInvoice,
  issueSaleInvoice,
  listAvailableNetMeterInvoicesForWithoutGst,
  peekNextInvoiceSerial,
} from "../../../utils/invoiceStorage";
import { apiGenerateGstEinvoice } from "../../../utils/gstApiClient";
import { getInvoiceFormat } from "../../../utils/invoiceFormatStorage";
import {
  clearedNetMeterInvoiceFields,
  clearedSaleInvoiceFields,
  deleteInvoiceCompletely,
} from "../../../utils/tempInvoiceDelete";
import { getAuthSession } from "../../../utils/authSession";
import {
  buildConsumerReferenceMap,
  consumerMatchesReference,
} from "../../../utils/consumerReference";
import { flushErpPushNow } from "../../../utils/erpStorage";
import {
  canChangeOrDelete,
  getSaleReferenceFilter,
  isSaleInvoiceDownloadOnly,
} from "../../../utils/erpAccess";
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
  EWAY_ITEM_AMOUNT_LIMIT,
  invoiceAllowsEwayBill,
  invoiceNeedsEwayBill,
} from "../../../utils/ewayThreshold";
import { resolveProductHsn } from "../../../utils/saleInvoiceCompute";
import { ensureProductItem } from "../../../utils/productStorage";
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
import { billBomFromSaleRow } from "../../../utils/bomBillFromSale";
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
  const fromBom = formatSetupDetail(bom);
  const hasRealBom =
    bom &&
    String(bom.panelDetail || "").trim() &&
    String(bom.panelDetail || "").trim() !== "—" &&
    String(bom.inverterSerial || "").trim() &&
    String(bom.inverterSerial || "").trim() !== "—";
  return {
    ...row,
    setupDetail: hasRealBom ? fromBom : row.setupDetail || fromBom,
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
  const navigate = useNavigate();
  const [rows, setRows] = useState(() => reloadSaleRowsFromStorage());
  const session = getAuthSession();
  const saleRefFilter = getSaleReferenceFilter(session);
  const invoiceDownloadOnly = isSaleInvoiceDownloadOnly(session);
  /** Sale delete sirf Admin — sab staff pe hide. OTP nahi. */
  const canDelete = canChangeOrDelete(session);
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
    nmSearch: "",
    selectedNmNo: "",
    selectedNmDate: "",
    reuseInvoiceNo: "",
    reuseDate: "",
    replaceInvoiceId: "",
    isRegenerate: false,
  });
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [netMeterRow, setNetMeterRow] = useState(null);
  const [netMeterForm, setNetMeterForm] = useState({
    itemName: "Net Meter Single Phase",
    meterSrNo: "",
    applicationNo: "",
    meterCompanyName: "",
    hsn: "",
    amount: "",
    gstPercent: "18",
    previewInvoiceNo: "",
    reuseInvoiceNo: "",
    reuseDate: "",
    replaceInvoiceId: "",
    isRegenerate: false,
  });
  const [netMeterBusy, setNetMeterBusy] = useState(false);
  const [ewayContext, setEwayContext] = useState(null);
  const [ewayDistance, setEwayDistance] = useState("");
  const [ewayBusy, setEwayBusy] = useState(false);
  const [ewayResult, setEwayResult] = useState(null);
  const [completeRow, setCompleteRow] = useState(null);
  const [folderRow, setFolderRow] = useState(null);
  const [docRefresh, setDocRefresh] = useState(0);
  const [lanUrlDraft, setLanUrlDraft] = useState(() => getSavedPublicAppBaseUrl());
  const [linkBaseTick, setLinkBaseTick] = useState(0);
  const consumerSyncTimers = useRef(new Map());
  const suppressReloadRef = useRef(false);
  const saveTimerRef = useRef(null);
  const heavySaveTimerRef = useRef(null);

  /* Debounced save: typing pe BOM/Customer Detail sync mat chalao (lag ka main cause). */
  useEffect(() => {
    const data = rows.filter((r) => !r.isBackupEntry);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      suppressReloadRef.current = true;
      saveSaleCaseRows(data, { syncBom: false, syncCustomerDetail: false });
      window.setTimeout(() => {
        suppressReloadRef.current = false;
      }, 100);
    }, 450);

    if (heavySaveTimerRef.current) clearTimeout(heavySaveTimerRef.current);
    heavySaveTimerRef.current = setTimeout(() => {
      suppressReloadRef.current = true;
      saveSaleCaseRows(data, { syncBom: true, syncCustomerDetail: true });
      window.setTimeout(() => {
        suppressReloadRef.current = false;
      }, 150);
    }, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (heavySaveTimerRef.current) clearTimeout(heavySaveTimerRef.current);
    };
  }, [rows]);

  useEffect(() => {
    const reloadFromCaseSheets = () => {
      if (suppressReloadRef.current) return;
      setRows(reloadSaleRowsFromStorage());
    };
    const refreshBackups = () => {
      if (suppressReloadRef.current) return;
      setRows(reloadSaleRowsFromStorage());
    };
    /* SALE_BOM_SYNC pe full reload mat — khud ke save se loop + lag */
    window.addEventListener(SALE_CASE_SYNC_EVENT, reloadFromCaseSheets);
    window.addEventListener(SALE_SETUP_DETAIL_SYNC_EVENT, reloadFromCaseSheets);
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
      window.removeEventListener(SALE_SETUP_DETAIL_SYNC_EVENT, reloadFromCaseSheets);
      window.removeEventListener(BACKUP_ENTRY_SYNC_EVENT, refreshBackups);
      window.removeEventListener(LOAN_CASE_SYNC_EVENT, reloadFromCaseSheets);
      window.removeEventListener(CASH_CASE_SYNC_EVENT, reloadFromCaseSheets);
      window.removeEventListener(SITE_ORDER_SYNC_EVENT, onSiteOrder);
    };
  }, []);

  const consumerRefMap = useMemo(() => {
    if (!saleRefFilter) return null;
    return buildConsumerReferenceMap();
  }, [saleRefFilter, rows]);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (saleRefFilter) {
      /* Loan/Cash Reference se match — Sale row pe galat/empty reference ignore */
      list = list.filter((row) =>
        consumerMatchesReference(
          row.consumerNo,
          saleRefFilter,
          row.reference,
          consumerRefMap,
        ),
      );
    }
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter((row) =>
      Object.values(row).some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [query, rows, saleRefFilter, consumerRefMap]);

  const rowIndexByRef = useMemo(() => {
    const map = new Map();
    rows.forEach((row, index) => map.set(row, index));
    return map;
  }, [rows]);

  const [teamTick, setTeamTick] = useState(0);
  const invoiceMaps = useMemo(() => getInvoiceLookupMaps(), [rows, docRefresh]);
  const teamWorkOptions = useMemo(() => {
    void teamTick;
    return getSaleTeamWorkOptions();
  }, [teamTick]);
  const docCountMap = useMemo(() => {
    void docRefresh;
    return getCustomerDocumentCountMap();
  }, [docRefresh, rows]);

  useEffect(() => {
    try {
      syncTeamsFromLabourEmployees();
    } catch {
      /* ignore */
    }
    const refreshTeams = () => setTeamTick((n) => n + 1);
    window.addEventListener(LABOUR_TEAM_MAPPING_SYNC_EVENT, refreshTeams);
    window.addEventListener(LABOUR_EMPLOYEES_SYNC_EVENT, refreshTeams);
    window.addEventListener("dhatterwal-labour-sync", refreshTeams);
    return () => {
      window.removeEventListener(LABOUR_TEAM_MAPPING_SYNC_EVENT, refreshTeams);
      window.removeEventListener(LABOUR_EMPLOYEES_SYNC_EVENT, refreshTeams);
      window.removeEventListener("dhatterwal-labour-sync", refreshTeams);
    };
  }, []);

  const closeSaleModals = () => {
    setInvoiceRow(null);
    setNetMeterRow(null);
    setEwayContext(null);
    setEwayResult(null);
    setCompleteRow(null);
    setFolderRow(null);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") closeSaleModals();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    if (!canDelete) {
      window.alert("Delete sirf Admin kar sakta hai.");
      return;
    }
    const label = row.consumerNo?.trim() || row.customerName?.trim() || "ye row";
    if (!window.confirm(`"${label}" ko Sale Sheet se delete karein?`)) return;
    if (row.isBackupEntry && row.entryId) {
      deleteBackupEntry(row.entryId);
    }
    setRows((prev) => {
      const next = prev.filter((r) => !rowsMatch(r, row));
      /* Turant save + server push — warna poll purani entry wapas la sakta hai */
      saveSaleCaseRows(next.filter((r) => !r.isBackupEntry), {
        syncBom: false,
        syncCustomerDetail: true,
      });
      flushErpPushNow();
      return next;
    });
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
        `Team "${teamWork}" set.\n\nOffice WhatsApp se *${createdOrder.teamLeaderName}* (${teamWork}) ko site form bhejein?\n\nConsumer: ${row.customerName || "—"} (${row.consumerNo})`,
      )
    ) {
      void openWhatsAppSiteOrder(createdOrder, { skipConfirm: true });
    }
  };

  const siteFormHrefForRow = (row) => {
    /* Always refresh defaultMembers from Labour Detail */
    const order = upsertSiteOrderForSaleRow(row);
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
    const order = upsertSiteOrderForSaleRow(row);
    if (!order) return;
    if (!order.teamLeaderMobile) {
      window.alert("Team leader mobile nahi mila — Labour Details check karein.");
      return;
    }
    void openWhatsAppSiteOrder(order);
  };

  const openBomForRow = (row) => {
    if (!row.consumerNo?.trim()) {
      window.alert("Consumer No. zaroori hai.");
      return;
    }
    const date = String(row.date || "").trim() || new Date().toLocaleDateString("en-GB");
    const params = new URLSearchParams({
      date,
      consumer: String(row.consumerNo).trim().toUpperCase(),
    });
    navigate(`${ROUTES.BOM_SHEET}?${params.toString()}`);
  };

  const okBillBomForRow = (row) => {
    if (!row.consumerNo?.trim()) {
      window.alert("Consumer No. zaroori hai.");
      return;
    }
    if (row.siteOrderStatus !== "submitted" && !row.bomBilled) {
      window.alert(
        "Pehle Team Leader site / BOM form submit karein.\nUske baad OK / Bill BOM dabayein — stock se items kam honge aur BOM pe site kharch set hoga.",
      );
      return;
    }
    const confirmOk = window.confirm(
      `OK / Bill BOM?\n\nConsumer: ${row.consumerNo}\nTeam: ${row.teamWork || "—"}\n\nTeam Leader ne jo items fill kiye hain wo stock se kam honge, aur BOM Sheet me site kharch (File/Dept/Net Meter/02 KW/Auto Rent + Total) update hoga.`,
    );
    if (!confirmOk) return;

    const result = billBomFromSaleRow(row);
    if (!result.ok) {
      window.alert(result.message || "Bill BOM fail.");
      return;
    }
    setRows(reloadSaleRowsFromStorage());
    setDocRefresh((n) => n + 1);
    const bits = [];
    if (result.issuedLines) bits.push(`Stock: ${result.issuedLines} line(s) kam`);
    if (result.stockMessage) bits.push(result.stockMessage);
    bits.push(`Total Kharch: ₹${Number(result.totalKharch || 0).toLocaleString("en-IN")}`);
    window.alert(`BOM OK / Bill ho gaya.\n\n${bits.join("\n")}`);
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
    const existing = findInvoiceForSaleRow(row) || getInvoiceById(row.invoiceId);
    const keepNo = String(
      row.invoiceNo || row.reservedInvoiceNo || existing?.invoiceNo || "",
    ).trim();
    const keepDate = String(
      row.invoiceDate || row.reservedInvoiceDate || existing?.date || "",
    ).trim();
    const replaceId = String(existing?.id || row.invoiceId || "").trim();
    const items = resolveInvoiceItemDetails(row);
    const availableNm = listAvailableNetMeterInvoicesForWithoutGst({
      consumerNo: row.consumerNo,
      excludeInvoiceId: replaceId,
    });
    const preferred =
      availableNm.find((n) => n.invoiceNo === row.netMeterInvoiceNo) ||
      availableNm.find((n) => n.invoiceNo === keepNo) ||
      availableNm[0] ||
      null;
    setInvoiceRow(row);
    setInvoiceForm({
      amount: row.amount || existing?.totalAmount || "",
      pinCode: row.invoicePinCode || existing?.pinCode || "",
      station: row.invoiceStation || existing?.station || "",
      panelName: items.panelName || existing?.panelName || "",
      inverterName: items.inverterName || existing?.inverterName || "",
      inverterSerial: items.inverterSerial || existing?.inverterSerial || "",
      vehicleNo: row.vehicleNo || existing?.vehicleNo || "",
      previewInvoiceNo: keepNo || peekNextInvoiceSerial(),
      nmSearch: "",
      selectedNmNo: preferred?.invoiceNo || "",
      selectedNmDate: preferred?.date || "",
      reuseInvoiceNo: keepNo,
      reuseDate: keepDate,
      replaceInvoiceId: replaceId,
      isRegenerate: Boolean(keepNo),
    });
  };

  const patchInvoiceForm = (key, value) => {
    setInvoiceForm((prev) => ({ ...prev, [key]: value }));
  };

  const openCompleteModal = (row) => {
    if (!requireConsumerRow(row)) return;
    setCompleteRow(row);
  };

  const openFolderModal = (row) => {
    if (!row.consumerNo?.trim()) {
      window.alert("Enter Consumer No. to open customer document folder.");
      return;
    }
    setFolderRow(row);
    setDocRefresh((n) => n + 1);
  };

  const openEwayModalForRow = (row, kind = "sale") => {
    const isNet = kind === "net-meter";
    const invoice = isNet
      ? findNetMeterInvoiceForSaleRow(row) || getInvoiceById(row.netMeterInvoiceId)
      : findInvoiceForSaleRow(row) ||
        getInvoiceById(row.invoiceId) || {
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

    if (!invoice?.invoiceNo && !invoice?.id) {
      window.alert(isNet ? "Pehle Net Meter Invoice generate karein." : "Pehle Generate Invoice karein.");
      return;
    }

    const gstInvoice = {
      ...invoice,
      invoiceKind: isNet ? "net-meter" : invoice.invoiceKind || "sale",
      withGst: isNet ? true : Boolean(invoice.withGst ?? row.invoiceWithGst),
    };
    if (!invoiceAllowsEwayBill(gstInvoice)) {
      window.alert(
        "E-Way Bill sirf With GST invoice pe banta hai.\nGenerate Invoice → “With GST + E-Way Bill” choose karein.",
      );
      return;
    }

    const existingEwayNo = isNet ? row.netMeterEwayBillNo : row.ewayBillNo;
    setEwayResult(
      existingEwayNo
        ? {
            ewayBillNo: existingEwayNo,
            distanceKm: (isNet ? row.netMeterEwayDistanceKm : row.ewayDistanceKm) || "",
            validUpto: (isNet ? row.netMeterEwayValidUpto : row.ewayValidUpto) || "",
          }
        : null,
    );
    setEwayDistance((isNet ? row.netMeterEwayDistanceKm : row.ewayDistanceKm) || "");
    setEwayContext({
      saleRow: row,
      invoice: gstInvoice,
      kind: isNet ? "net-meter" : "sale",
    });
  };

  const openNetMeterModal = (row) => {
    if (!requireConsumerRow(row)) return;
    const existing =
      findNetMeterInvoiceForSaleRow(row) || getInvoiceById(row.netMeterInvoiceId);
    const keepNo = String(
      row.netMeterInvoiceNo || row.reservedNetMeterInvoiceNo || existing?.invoiceNo || "",
    ).trim();
    const keepDate = String(existing?.date || "").trim();
    const replaceId = String(existing?.id || row.netMeterInvoiceId || "").trim();
    const itemName = existing?.itemName || "Net Meter Single Phase";
    ensureProductItem({
      itemName,
      category: "GENERAL",
      hsn: existing?.hsn || "90283010",
    });
    setNetMeterRow(row);
    setNetMeterForm({
      itemName,
      meterSrNo: existing?.meterSrNo || "",
      applicationNo: existing?.applicationNo || "",
      meterCompanyName: existing?.meterCompanyName || "",
      hsn: existing?.hsn || resolveProductHsn(itemName, "90283010"),
      amount: existing?.totalAmount || existing?.taxableAmount || "",
      gstPercent:
        existing?.gstPercent != null && existing?.gstPercent !== ""
          ? String(existing.gstPercent)
          : "18",
      previewInvoiceNo: keepNo || peekNextInvoiceSerial(),
      reuseInvoiceNo: keepNo,
      reuseDate: keepDate,
      replaceInvoiceId: replaceId,
      isRegenerate: Boolean(keepNo),
    });
  };

  const patchNetMeterForm = (key, value) => {
    setNetMeterForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "itemName") {
        next.hsn = resolveProductHsn(value, prev.hsn || "90283010");
      }
      return next;
    });
  };

  const downloadRowInvoice = async (row) => {
    const inv = findInvoiceForSaleRow(row) || getInvoiceById(row.invoiceId);
    if (inv?.id) {
      try {
        await saveInvoiceDocumentToFolder({
          ...inv,
          ewayBillNo: inv.ewayBillNo || row.ewayBillNo || "",
        });
      } catch {
        /* ignore — fall through to existing file */
      }
    }
    const doc = findInvoiceDocument(
      row.consumerNo,
      row.invoiceNo,
      row.invoiceWithGst === false ? "without-gst" : "with-gst",
    );
    if (!doc) {
      window.alert("Invoice file folder me nahi mili. Open folder check karein.");
      return;
    }
    downloadInvoiceDoc(doc);
  };

  const downloadNetMeterInvoice = async (row) => {
    const inv =
      findNetMeterInvoiceForSaleRow(row) || getInvoiceById(row.netMeterInvoiceId);
    if (inv?.id) {
      try {
        await saveInvoiceDocumentToFolder({
          ...inv,
          ewayBillNo: inv.ewayBillNo || row.netMeterEwayBillNo || "",
        });
      } catch {
        /* ignore */
      }
    }
    const doc = findInvoiceDocument(row.consumerNo, row.netMeterInvoiceNo, "net-meter");
    if (!doc) {
      window.alert("Net Meter Invoice file folder me nahi mili.");
      return;
    }
    downloadInvoiceDoc(doc);
  };

  const downloadRowEway = (row, kind = "sale") => {
    const ewayNo = kind === "net-meter" ? row.netMeterEwayBillNo : row.ewayBillNo;
    const doc = findEwayDocument(row.consumerNo, ewayNo);
    if (!doc) {
      window.alert("E-Way Bill file folder me nahi mili.");
      return;
    }
    downloadInvoiceDoc(doc);
  };

  const deleteRowInvoice = (row) => {
    if (!canDelete) {
      window.alert("Invoice delete sirf Admin kar sakta hai.");
      return;
    }
    const invoice = findInvoiceForSaleRow(row);
    if (!invoice?.id) {
      window.alert("Invoice record nahi mili.");
      return;
    }
    if (
      !window.confirm(
        `Invoice ${invoice.invoiceNo} delete karein?\n\nInvoice File, payment, folder files hatenge. Phir dubara Generate Invoice kar sakte ho.`,
      )
    ) {
      return;
    }
    const result = deleteInvoiceCompletely(invoice.id);
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
    window.alert(
      `Invoice ${invoice.invoiceNo} delete ho gayi. Dubara Generate pe yahi number wapas lagega.`,
    );
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
      window.alert(withGst ? "Amount With Tax sahi bharen." : "Amount sahi bharen.");
      return;
    }
    if (!withGst && !String(invoiceForm.selectedNmNo || "").trim()) {
      window.alert(
        "Without GST ke liye Net Meter Invoice number select karein (jo abhi free ho).",
      );
      return;
    }

    setInvoiceBusy(true);
    try {
      let invoice = issueSaleInvoice({
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
        linkedNetMeterInvoiceNo: withGst ? "" : invoiceForm.selectedNmNo,
        reuseInvoiceNo: withGst ? invoiceForm.reuseInvoiceNo : "",
        reuseDate: withGst ? invoiceForm.reuseDate : "",
        replaceInvoiceId: invoiceForm.replaceInvoiceId,
      });

      /* With GST → GST E-Invoice IRN API */
      if (withGst && invoice.id) {
        const format = getInvoiceFormat();
        const irnRes = await apiGenerateGstEinvoice({
          invoiceNo: invoice.invoiceNo,
          invoiceId: invoice.id,
          consumerNo: invoice.consumerNo,
          customerName: invoice.customerName,
          address: invoice.address,
          mobile: invoice.mobile,
          pinCode,
          station,
          vehicleNo,
          setupKw: invoice.setupKw,
          taxableAmount: invoice.taxableAmount,
          gstAmount: invoice.gstAmount,
          totalAmount: invoice.totalAmount,
          sellerGstin: format.gstin,
          placeOfSupply: format.placeOfSupply || invoice.placeOfSupply,
          lines: invoice.lines,
          date: invoice.date,
        });
        if (irnRes?.ok && irnRes.irn) {
          attachEinvoiceToInvoice(invoice.id, irnRes);
          invoice = getInvoiceById(invoice.id) || {
            ...invoice,
            irn: irnRes.irn,
            ackNo: irnRes.ackNo,
            ackDate: irnRes.ackDate,
          };
        } else if (irnRes && !irnRes.ok) {
          console.warn("[GST E-Invoice]", irnRes.error);
        }
      }

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
                irn: invoice.irn || "",
                ewayBillNo: "",
                ewayDistanceKm: "",
                ewayValidUpto: "",
                reservedInvoiceNo: "",
                reservedInvoiceDate: "",
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
      /* With GST → E-Way Bill modal auto (GST se linked) */
      if (withGst) {
        setEwayContext({ saleRow: saleSnapshot, invoice, kind: "sale" });
        const irnLine = invoice.irn ? `\nIRN: ${invoice.irn}` : "\n(IRN demo/API pending — Settings → GST API)";
        const regenNote = invoiceForm.isRegenerate ? " (number same)" : "";
        if (!invoiceNeedsEwayBill(invoice)) {
          window.alert(
            `Invoice ${invoice.invoiceNo} (With GST) ban gayi${regenNote}.${irnLine}\n` +
              `Ab E-Way Bill bana sakte ho (distance km bharo).\n` +
              `Note: ₹${EWAY_ITEM_AMOUNT_LIMIT.toLocaleString("en-IN")} se upar amount pe E-Way zaroori hota hai.`,
          );
        } else if (invoice.irn) {
          window.alert(
            `Invoice ${invoice.invoiceNo} + IRN ready${regenNote}.\nAb E-Way Bill (distance) complete karein.`,
          );
        } else if (invoiceForm.isRegenerate) {
          window.alert(`Invoice ${invoice.invoiceNo} re-generate ho gayi (number same).`);
        }
      } else {
        setEwayContext(null);
        window.alert(
          invoiceForm.isRegenerate
            ? `Invoice ${invoice.invoiceNo} (Without GST) re-generate — number same.\nE-Way Bill ke liye With GST invoice generate karein.`
            : `Invoice ${invoice.invoiceNo} (Without GST) ban gayi.\nE-Way Bill ke liye With GST invoice generate karein.`,
        );
      }
    } catch (err) {
      window.alert(err?.message || "Invoice generate / folder save fail hua.");
    } finally {
      setInvoiceBusy(false);
    }
  };

  const saveNetMeterInvoice = async () => {
    if (!netMeterRow || netMeterBusy) return;

    const itemName = String(netMeterForm.itemName || "").trim();
    const meterSrNo = String(netMeterForm.meterSrNo || "").trim();
    const applicationNo = String(netMeterForm.applicationNo || "").trim();
    const meterCompanyName = String(netMeterForm.meterCompanyName || "").trim();
    const amount = String(netMeterForm.amount || "").trim();
    const gstPercent = String(netMeterForm.gstPercent || "").trim();
    const hsn = String(netMeterForm.hsn || "").trim() || resolveProductHsn(itemName, "90283010");

    if (!itemName) {
      window.alert("Item name bharen (jaise Net Meter Single Phase).");
      return;
    }
    if (!meterSrNo) {
      window.alert("Meter Sr. No. bharen.");
      return;
    }
    if (!applicationNo) {
      window.alert("Application No. bharen.");
      return;
    }
    if (!meterCompanyName) {
      window.alert("Meter Company Name bharen.");
      return;
    }
    if (!amount || !(Number(amount) > 0)) {
      window.alert("Amount sahi bharen.");
      return;
    }
    if (gstPercent === "" || Number.isNaN(Number(gstPercent)) || Number(gstPercent) < 0) {
      window.alert("GST % sahi bharen (0 bhi chalega).");
      return;
    }

    setNetMeterBusy(true);
    try {
      ensureProductItem({ itemName, category: "GENERAL", hsn });
      const invoice = issueNetMeterInvoice({
        consumerNo: netMeterRow.consumerNo,
        customerName: netMeterRow.customerName,
        fatherName: netMeterRow.fatherName,
        address: netMeterRow.address,
        mobile: netMeterRow.mobile,
        setupKw: netMeterRow.setupKw,
        pinCode: netMeterRow.invoicePinCode || "",
        station: netMeterRow.invoiceStation || "",
        vehicleNo: netMeterRow.vehicleNo || "",
        saleRowId: saleRowKey(netMeterRow),
        itemName,
        meterSrNo,
        applicationNo,
        meterCompanyName,
        hsn,
        amount,
        gstPercent,
        reuseInvoiceNo: netMeterForm.reuseInvoiceNo,
        reuseDate: netMeterForm.reuseDate,
        replaceInvoiceId: netMeterForm.replaceInvoiceId,
      });

      await saveInvoiceDocumentToFolder(invoice);

      addCustomerPayment({
        sourceRef: `sale-nm-${invoice.id}`,
        consumerNo: netMeterRow.consumerNo,
        date: invoice.date,
        amount: invoice.totalAmount,
        category: PAYMENT_CATEGORIES.SALE,
        label: `Net Meter Invoice (${invoice.gstType})`,
        reference: invoice.invoiceNo,
        applicationNo: applicationNo || invoice.invoiceNo,
      });
      notifyPaymentSync();

      const saleSnapshot = {
        ...netMeterRow,
        netMeterInvoiceId: invoice.id,
        netMeterInvoiceNo: invoice.invoiceNo,
      };

      setRows((prev) =>
        prev.map((row) =>
          rowsMatch(row, netMeterRow)
            ? {
                ...row,
                netMeterInvoiceId: invoice.id,
                netMeterInvoiceNo: invoice.invoiceNo,
                netMeterEwayBillNo: "",
                netMeterEwayDistanceKm: "",
                netMeterEwayValidUpto: "",
                reservedNetMeterInvoiceNo: "",
              }
            : row,
        ),
      );
      setDocRefresh((n) => n + 1);
      setNetMeterRow(null);
      setEwayResult(null);
      setEwayDistance("");
      if (invoiceNeedsEwayBill(invoice)) {
        setEwayContext({ saleRow: saleSnapshot, invoice, kind: "net-meter" });
      }
    } catch (err) {
      window.alert(err?.message || "Net Meter Invoice save fail hua.");
    } finally {
      setNetMeterBusy(false);
    }
  };

  const deleteNetMeterInvoice = (row) => {
    if (!canDelete) {
      window.alert("Invoice delete sirf Admin kar sakta hai.");
      return;
    }
    const invoice = findNetMeterInvoiceForSaleRow(row);
    if (!invoice?.id) {
      window.alert("Net Meter Invoice record nahi mili.");
      return;
    }
    if (
      !window.confirm(
        `Net Meter Invoice ${invoice.invoiceNo} delete karein?\n\nPhir dubara Net Meter Invoice bana sakte ho.`,
      )
    ) {
      return;
    }
    const result = deleteInvoiceCompletely(invoice.id);
    if (!result.ok) {
      window.alert(result.error || "Delete fail.");
      return;
    }
    setRows((prev) =>
      prev.map((r) => (rowsMatch(r, row) ? clearedNetMeterInvoiceFields(r) : r)),
    );
    setDocRefresh((n) => n + 1);
    if (ewayContext?.invoice?.id === invoice.id) {
      setEwayContext(null);
      setEwayResult(null);
    }
    window.alert(
      `Net Meter Invoice ${invoice.invoiceNo} delete ho gayi. Dubara generate pe yahi number lagega.`,
    );
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
      const isNet = ewayContext.kind === "net-meter";
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

      let updatedInvoice = null;
      if (invoice.id) {
        updatedInvoice = attachEwayBillToInvoice(invoice.id, ewayPayload);
      }
      updatedInvoice = updatedInvoice || {
        ...invoice,
        ewayBillNo: api.ewayBillNo,
        ewayDistanceKm: String(distanceKm),
        ewayValidUpto: api.validUpto || "",
      };
      /* Fresh record from Invoice File so HTML me E-Way No. pakka likhe */
      const fresh = (invoice.id && getInvoiceById(invoice.id)) || updatedInvoice;

      await saveEwayDocumentToFolder(fresh, ewayPayload);
      await saveInvoiceDocumentToFolder({
        ...fresh,
        ewayBillNo: api.ewayBillNo,
        ewayDistanceKm: String(distanceKm),
        ewayValidUpto: api.validUpto || "",
      });

      setRows((prev) =>
        prev.map((row) => {
          const matchSale =
            rowsMatch(row, ewayContext.saleRow) ||
            (isNet
              ? row.netMeterInvoiceId && row.netMeterInvoiceId === invoice.id
              : row.invoiceId && row.invoiceId === invoice.id);
          if (!matchSale) return row;
          if (isNet) {
            return {
              ...row,
              netMeterEwayBillNo: api.ewayBillNo,
              netMeterEwayDistanceKm: String(distanceKm),
              netMeterEwayValidUpto: api.validUpto || "",
            };
          }
          return {
            ...row,
            ewayBillNo: api.ewayBillNo,
            ewayDistanceKm: String(distanceKm),
            ewayValidUpto: api.validUpto || "",
          };
        }),
      );
      setDocRefresh((n) => n + 1);
      setEwayResult(ewayPayload);
      setEwayContext((prev) =>
        prev
          ? {
              ...prev,
              invoice: { ...fresh, ewayBillNo: api.ewayBillNo },
            }
          : prev,
      );
    } catch (err) {
      window.alert(err?.message || "E-Way Bill generate fail hua.");
    } finally {
      setEwayBusy(false);
    }
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
      });
      setDocRefresh((n) => n + 1);
      window.alert(
        `Complete file package created (${included.length} items).\nSaved under:\n${packageFolder}\n\nManifest downloaded to your PC.`,
      );
      setCompleteRow(null);
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
    const cn = String(row.consumerNo || "").trim().toUpperCase();
    if (!cn) return 0;
    return docCountMap.get(cn) || 0;
  };

  return (
    <section className={styles.sheet}>
      <header className={styles.toolbar}>
        <div>
          <h1>Sale Sheet</h1>
          <p>
            {saleRefFilter
              ? `Sirf Reference "${saleRefFilter}" wale customers dikhenge (Loan/Cash Reference).`
              : "Team Work select → Office WhatsApp se team leader ko site form jayega. Form submit ke baad stock / BOM / Setup Detail update."}
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
          {!invoiceDownloadOnly ? (
            <>
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
            </>
          ) : null}
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
            {filteredRows.map((row) => {
              const rowIndex = rowIndexByRef.get(row) ?? 0;
              const rowKey = saleRowKey(row) || row.id || `sale-${rowIndex}`;
              const saleInv =
                findInvoiceForSaleRow(row, invoiceMaps) ||
                (row.invoiceId ? invoiceMaps.byId.get(row.invoiceId) : null);
              return (
              <tr
                key={rowKey}
                className={row.isBackupEntry ? styles.backupRow : undefined}
              >
                <td>
                  {rowIndex + 1}
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
                  <div className={styles.teamWorkCell}>
                    <select
                      className={styles.cellSelect}
                      value={row.teamWork}
                      onChange={(e) => handleTeamWorkChange(row, e.target.value)}
                    >
                      <option value="">Select team</option>
                      {teamWorkOptions.map((team) => (
                        <option key={team} value={team}>
                          {team}
                        </option>
                      ))}
                    </select>
                    {row.teamWork ? (
                      <div className={styles.teamMembersHint} title={getSaleTeamMembersDisplay(row.teamWork)}>
                        {getSaleTeamMembersDisplay(row.teamWork)
                          .split("\n")
                          .map((line) => (
                            <span key={line}>{line}</span>
                          ))}
                      </div>
                    ) : null}
                  </div>
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
                  <div className={styles.setupDetailCell}>
                    <textarea
                      className={styles.setupDetail}
                      value={row.setupDetail}
                      readOnly
                      rows={4}
                    />
                    {row.consumerNo?.trim() ? (
                      <>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => openBomForRow(row)}
                          title="BOM Sheet — is sale date ke hisaab se"
                        >
                          Open BOM
                        </button>
                        <button
                          type="button"
                          className={
                            row.bomBilled
                              ? `${styles.actionBtn} ${styles.actionBtnMuted}`
                              : `${styles.actionBtn} ${styles.actionBtnGold}`
                          }
                          onClick={() => okBillBomForRow(row)}
                          title="Site form items stock se kam + BOM site kharch"
                          disabled={
                            row.siteOrderStatus !== "submitted" && !row.bomBilled
                          }
                        >
                          {row.bomBilled ? "BOM Billed" : "OK / Bill BOM"}
                        </button>
                      </>
                    ) : null}
                  </div>
                </td>
                <td>
                  <div className={styles.invoiceActions}>
                    {invoiceDownloadOnly ? (
                      <>
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
                          </>
                        ) : (
                          <span className={styles.siteFormMuted}>Invoice pending</span>
                        )}
                        {row.netMeterInvoiceNo ? (
                          <>
                            <span className={styles.invoiceNoBadge} title="Net Meter Invoice">
                              NM: {row.netMeterInvoiceNo}
                            </span>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => downloadNetMeterInvoice(row)}
                            >
                              Download Net Meter Inv.
                            </button>
                          </>
                        ) : null}
                      </>
                    ) : row.invoiceNo ? (
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
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => openInvoiceModal(row)}
                          title="Same Invoice No. rahega"
                        >
                          Re-generate Invoice
                        </button>
                        {(() => {
                          const gstInvoice = Boolean(
                            saleInv?.withGst ?? row.invoiceWithGst,
                          );
                          if (!gstInvoice) {
                            return (
                              <span className={styles.siteFormMuted} title="E-Way sirf With GST">
                                E-Way: With GST chahiye
                              </span>
                            );
                          }
                          const needsEway = invoiceNeedsEwayBill(
                            saleInv || {
                              withGst: true,
                              totalAmount: Number(row.amount) || 0,
                              taxableAmount: Number(row.amount) || 0,
                            },
                          );
                          if (row.ewayBillNo) {
                            return (
                              <button
                                type="button"
                                className={`${styles.actionBtn} ${styles.actionBtnGold}`}
                                onClick={() => downloadRowEway(row, "sale")}
                              >
                                Download E-Way ({row.ewayBillNo})
                              </button>
                            );
                          }
                          return (
                            <button
                              type="button"
                              className={`${styles.actionBtn} ${styles.actionBtnGold}`}
                              onClick={() => openEwayModalForRow(row, "sale")}
                            >
                              {needsEway ? "E-Way Bill (GST req.)" : "E-Way Bill (GST)"}
                            </button>
                          );
                        })()}
                        {row.netMeterInvoiceNo ? (
                          <>
                            <span className={styles.invoiceNoBadge} title="Net Meter Invoice">
                              NM: {row.netMeterInvoiceNo}
                            </span>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => downloadNetMeterInvoice(row)}
                            >
                              Download Net Meter Inv.
                            </button>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => openNetMeterModal(row)}
                              title="Same Net Meter Invoice No. rahega"
                            >
                              Re-generate NM
                            </button>
                            {(() => {
                              const nmInv =
                                findNetMeterInvoiceForSaleRow(row) ||
                                getInvoiceById(row.netMeterInvoiceId);
                              const needsEway = invoiceNeedsEwayBill(nmInv);
                              if (!needsEway) return null;
                              return row.netMeterEwayBillNo ? (
                                <button
                                  type="button"
                                  className={`${styles.actionBtn} ${styles.actionBtnGold}`}
                                  onClick={() => downloadRowEway(row, "net-meter")}
                                >
                                  NM E-Way ({row.netMeterEwayBillNo})
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className={`${styles.actionBtn} ${styles.actionBtnGold}`}
                                  onClick={() => openEwayModalForRow(row, "net-meter")}
                                >
                                  NM E-Way Bill (req.)
                                </button>
                              );
                            })()}
                            {canDelete ? (
                              <button
                                type="button"
                                className={styles.deleteInvoiceBtn}
                                onClick={() => deleteNetMeterInvoice(row)}
                              >
                                Delete NM Inv.
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnGold}`}
                            onClick={() => openNetMeterModal(row)}
                          >
                            Net Meter Invoice
                          </button>
                        )}
                        {canDelete ? (
                          <button
                            type="button"
                            className={styles.deleteInvoiceBtn}
                            onClick={() => deleteRowInvoice(row)}
                            title="Galat invoice delete — Admin"
                          >
                            Delete Invoice
                          </button>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={styles.actionBtn}
                          onClick={() => openInvoiceModal(row)}
                          title={
                            row.reservedInvoiceNo
                              ? `Same number: ${row.reservedInvoiceNo}`
                              : undefined
                          }
                        >
                          {row.reservedInvoiceNo ? "Re-generate Invoice" : "Generate Invoice"}
                        </button>
                        {!row.netMeterInvoiceNo ? (
                          <button
                            type="button"
                            className={`${styles.actionBtn} ${styles.actionBtnGold}`}
                            onClick={() => openNetMeterModal(row)}
                            title={
                              row.reservedNetMeterInvoiceNo
                                ? `Same number: ${row.reservedNetMeterInvoiceNo}`
                                : undefined
                            }
                          >
                            {row.reservedNetMeterInvoiceNo
                              ? "Re-generate NM"
                              : "Net Meter Invoice"}
                          </button>
                        ) : (
                          <>
                            <span className={styles.invoiceNoBadge} title="Net Meter Invoice">
                              NM: {row.netMeterInvoiceNo}
                            </span>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => downloadNetMeterInvoice(row)}
                            >
                              Download Net Meter Inv.
                            </button>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              onClick={() => openNetMeterModal(row)}
                              title="Same Net Meter Invoice No. rahega"
                            >
                              Re-generate NM
                            </button>
                            {canDelete ? (
                              <button
                                type="button"
                                className={styles.deleteInvoiceBtn}
                                onClick={() => deleteNetMeterInvoice(row)}
                              >
                                Delete NM Inv.
                              </button>
                            ) : null}
                          </>
                        )}
                      </>
                    )}
                  </div>
                </td>
                <td>
                  {!invoiceDownloadOnly ? (
                    <button
                      type="button"
                      className={`${styles.actionBtn} ${styles.actionBtnGold}`}
                      onClick={() => openCompleteModal(row)}
                    >
                      Generate Complete File
                    </button>
                  ) : (
                    <span className={styles.siteFormMuted}>—</span>
                  )}
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
                  {canDelete ? (
                    <button type="button" className={styles.deleteBtn} onClick={() => deleteRow(row)}>
                      Delete
                    </button>
                  ) : (
                    <span className={styles.siteFormMuted}>—</span>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {invoiceRow && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={closeSaleModals}
        >
          <div
            className={`${styles.modal} ${styles.modalInvoice}`}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{invoiceForm.isRegenerate ? "Re-generate Invoice" : "Generate Invoice"}</h2>
            <p className={styles.invoicePreviewNo}>
              {invoiceForm.isRegenerate ? "Invoice No. (same):" : "Next Invoice No. (series):"}{" "}
              <strong>{invoiceForm.previewInvoiceNo}</strong>
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
                Amount With Tax (₹) *
                <input
                  type="number"
                  value={invoiceForm.amount}
                  onChange={(e) => patchInvoiceForm("amount", e.target.value)}
                  min="0"
                  placeholder="Grand total / tax-inclusive"
                />
              </label>
            </div>

            <p className={styles.modalHint}>
              <strong>With GST</strong> choose karo → invoice GST ke sath banegi aur{" "}
              <strong>E-Way Bill</strong> modal khulega (distance km). Series number Settings se.
              Without GST: Net Meter number reuse — E-Way Bill nahi.
            </p>
            <div className={styles.nmPickBox}>
              <label className={`${styles.modalLabel} ${styles.modalLabelFull}`}>
                Without GST — Net Meter Invoice No. search
                <input
                  value={invoiceForm.nmSearch}
                  onChange={(e) => patchInvoiceForm("nmSearch", e.target.value)}
                  placeholder="Invoice no / name / consumer"
                />
              </label>
              {invoiceForm.selectedNmNo ? (
                <p className={styles.modalHintSmall}>
                  Selected: <strong>{invoiceForm.selectedNmNo}</strong> — Date:{" "}
                  <strong>{invoiceForm.selectedNmDate || "—"}</strong>
                </p>
              ) : (
                <p className={styles.modalHintSmall}>
                  Without GST ke liye koi free Net Meter number select karein.
                </p>
              )}
              <ul className={styles.nmPickList}>
                {listAvailableNetMeterInvoicesForWithoutGst({
                  query: invoiceForm.nmSearch,
                  consumerNo: invoiceRow.consumerNo,
                  excludeInvoiceId: invoiceForm.replaceInvoiceId,
                })
                  .slice(0, 12)
                  .map((nm) => (
                    <li key={nm.id}>
                      <button
                        type="button"
                        className={
                          invoiceForm.selectedNmNo === nm.invoiceNo
                            ? styles.nmPickActive
                            : styles.nmPickBtn
                        }
                        onClick={() =>
                          setInvoiceForm((prev) => ({
                            ...prev,
                            selectedNmNo: nm.invoiceNo,
                            selectedNmDate: nm.date || "",
                          }))
                        }
                      >
                        {nm.invoiceNo} · {nm.date} · {nm.customerName || nm.consumerNo}
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
            <p className={styles.modalHintSmall}>
              With GST {invoiceForm.isRegenerate ? "number (same)" : "next series"}:{" "}
              <strong>{invoiceForm.previewInvoiceNo}</strong>
              {" · "}
              E-Way ₹{EWAY_ITEM_AMOUNT_LIMIT.toLocaleString("en-IN")}+ pe zaroori; GST invoice pe
              hamesha bana sakte ho.
            </p>
            <p className={styles.modalHint}>Choose invoice type:</p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnGold}
                disabled={invoiceBusy}
                onClick={() => generateInvoice(true)}
              >
                {invoiceBusy ? "Generating…" : "With GST + E-Way Bill"}
              </button>
              <button
                type="button"
                className={styles.btnOutline}
                disabled={invoiceBusy || !invoiceForm.selectedNmNo}
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

      {netMeterRow && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={closeSaleModals}
        >
          <div
            className={`${styles.modal} ${styles.modalInvoice}`}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>
              {netMeterForm.isRegenerate ? "Re-generate Net Meter Invoice" : "Net Meter Invoice"}
            </h2>
            <p className={styles.invoicePreviewNo}>
              {netMeterForm.isRegenerate ? "Invoice No. (same):" : "Next Invoice No. (series):"}{" "}
              <strong>{netMeterForm.previewInvoiceNo}</strong>
            </p>
            <div className={styles.partyBox}>
              <strong>Party — {netMeterRow.customerName}</strong>
              <div className={styles.partyGrid}>
                <span>Consumer: {netMeterRow.consumerNo}</span>
                <span>Main Inv: {netMeterRow.invoiceNo || "— (optional)"}</span>
              </div>
            </div>
            <div className={styles.modalFormGrid}>
              <label className={`${styles.modalLabel} ${styles.modalLabelFull}`}>
                Item *
                <input
                  value={netMeterForm.itemName}
                  onChange={(e) => patchNetMeterForm("itemName", e.target.value)}
                  placeholder="Net Meter Single Phase"
                />
              </label>
              <label className={styles.modalLabel}>
                Meter Sr. No. *
                <input
                  value={netMeterForm.meterSrNo}
                  onChange={(e) => patchNetMeterForm("meterSrNo", e.target.value)}
                />
              </label>
              <label className={styles.modalLabel}>
                Application No. *
                <input
                  value={netMeterForm.applicationNo}
                  onChange={(e) => patchNetMeterForm("applicationNo", e.target.value)}
                />
              </label>
              <label className={`${styles.modalLabel} ${styles.modalLabelFull}`}>
                Meter Company Name *
                <input
                  value={netMeterForm.meterCompanyName}
                  onChange={(e) => patchNetMeterForm("meterCompanyName", e.target.value)}
                />
              </label>
              <label className={styles.modalLabel}>
                HSN (Product Sheet)
                <input value={netMeterForm.hsn} readOnly />
              </label>
              <label className={styles.modalLabel}>
                Amount (₹) *
                <input
                  type="number"
                  min="0"
                  value={netMeterForm.amount}
                  onChange={(e) => patchNetMeterForm("amount", e.target.value)}
                />
              </label>
              <label className={styles.modalLabel}>
                GST % *
                <input
                  type="number"
                  min="0"
                  value={netMeterForm.gstPercent}
                  onChange={(e) => patchNetMeterForm("gstPercent", e.target.value)}
                />
              </label>
            </div>
            <p className={styles.modalHintSmall}>
              Amount taxable hogi; GST % us par add hoga. Amount ₹
              {EWAY_ITEM_AMOUNT_LIMIT.toLocaleString("en-IN")} se jyada ho to E-Way Bill jaruri.
            </p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnGold}
                disabled={netMeterBusy}
                onClick={saveNetMeterInvoice}
              >
                {netMeterBusy ? "Saving…" : "Save Net Meter Invoice"}
              </button>
              <button
                type="button"
                className={styles.btnCancel}
                disabled={netMeterBusy}
                onClick={() => setNetMeterRow(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {ewayContext && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={closeSaleModals}
        >
          <div
            className={`${styles.modal} ${styles.modalInvoice}`}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>
              E-Way Bill
              {ewayContext.kind === "net-meter" ? " (Net Meter GST)" : " (With GST Invoice)"}
            </h2>
            <p>
              Invoice <strong>{ewayContext.invoice?.invoiceNo}</strong> —{" "}
              {ewayContext.invoice?.customerName}
              {" · "}
              {ewayContext.invoice?.gstType || "With GST"}
            </p>
            <p className={styles.modalHintSmall}>
              {invoiceNeedsEwayBill(ewayContext.invoice)
                ? `Amount ₹${EWAY_ITEM_AMOUNT_LIMIT.toLocaleString("en-IN")} se jyada — E-Way Bill zaroori.`
                : "GST invoice linked — distance (km) bhar ke E-Way Bill generate karein."}
            </p>
            <div className={styles.partyBox}>
              <div className={styles.partyGrid}>
                <span>Vehicle: {ewayContext.invoice?.vehicleNo || "—"}</span>
                <span>Pin: {ewayContext.invoice?.pinCode || "—"}</span>
                <span>Station: {ewayContext.invoice?.station || "—"}</span>
                <span>
                  {ewayContext.kind === "net-meter"
                    ? `Item: ${ewayContext.invoice?.itemName || "Net Meter"}`
                    : `Panel: ${ewayContext.invoice?.panelName || "—"}`}
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
                      else
                        downloadRowEway(
                          ewayContext.saleRow,
                          ewayContext.kind === "net-meter" ? "net-meter" : "sale",
                        );
                    }}
                  >
                    Download E-Way Bill
                  </button>
                  <button
                    type="button"
                    className={styles.btnOutline}
                    onClick={async () => {
                      const inv = ewayContext.invoice;
                      if (inv) {
                        try {
                          await saveInvoiceDocumentToFolder({
                            ...inv,
                            ewayBillNo:
                              inv.ewayBillNo || ewayResult?.ewayBillNo || "",
                          });
                        } catch {
                          /* ignore */
                        }
                      }
                      const doc = findInvoiceDocument(
                        ewayContext.invoice.consumerNo,
                        ewayContext.invoice.invoiceNo,
                        ewayContext.kind === "net-meter"
                          ? "net-meter"
                          : ewayContext.invoice?.withGst === false
                            ? "without-gst"
                            : "with-gst",
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
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={closeSaleModals}
        >
          <div
            className={`${styles.modal} ${styles.modalWide}`}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Generate Complete File</h2>
            <p>
              <strong>{completeRow.consumerNo}</strong> — {completeRow.customerName} (
              {completeRow.setupKw})
            </p>
            <ul className={styles.checklist}>
              <li>Work OS Safety Certificate (proforma — auto by setup + BOM)</li>
              <li>Annexure: panel, inverter, wire, stand (from BOM / labour form)</li>
              <li>All documents uploaded in Loan Case &amp; Cash Case for this consumer</li>
            </ul>
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
