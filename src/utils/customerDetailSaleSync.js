import { createEmptyCustomerDetailRow } from "../constants/customerDetail";
import { lookupCustomerDetailProfile } from "../constants/customerRegistry";
import {
  backupToCustomerRow,
  listBackupEntries,
  mergeSaleRowsWithBackup,
} from "./backupEntryStorage";
import {
  loadCustomerDetailRows,
  saveCustomerDetailRows,
} from "./customerDetailStorage";
import { loadSaleCaseRows, saveSaleCaseRows } from "./saleCaseStorage";
import { mergeSaleRowsWithCaseSheets } from "./saleCaseSync";

export const CUSTOMER_DETAIL_SALE_SYNC_EVENT = "dhatterwal-customer-detail-sale-sync";

function ensureSaleRowId(row) {
  if (row.isBackupEntry) return row;
  if (row._rowId || row.entryId) return row;
  return {
    ...row,
    _rowId: `sale-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  };
}

/** Stable key — same row order/count as Sale Sheet (main + backup). */
export function saleRowKeyForCustomerSync(row) {
  if (row?.isBackupEntry && row.entryId) return `backup-${row.entryId}`;
  return String(row?.entryId || row?._rowId || "").trim();
}

function buildDetailFromSale(sale, existing) {
  const profile = sale.consumerNo?.trim()
    ? lookupCustomerDetailProfile(sale.consumerNo)
    : null;
  const isLoan = profile?.amountType === "Loan";
  const remark = profile?.defaultPaymentRemark || "";
  const base = existing ? { ...existing } : createEmptyCustomerDetailRow();

  return {
    ...base,
    saleRowId: saleRowKeyForCustomerSync(sale),
    consumerNo: sale.consumerNo || "",
    customerName: sale.customerName || base.customerName,
    fatherName: sale.fatherName || base.fatherName,
    address: sale.address || base.address,
    mobile: sale.mobile || base.mobile,
    amount:
      sale.amount !== undefined && String(sale.amount).trim() !== ""
        ? String(sale.amount)
        : base.amount,
    amountType: profile?.amountType || base.amountType,
    receivedRemark: isLoan ? remark : base.receivedRemark,
    secondPaymentRemark: isLoan ? remark : base.secondPaymentRemark,
  };
}

function buildDetailFromBackupSale(sale, existing) {
  const backupEntry = listBackupEntries().find((e) => e.id === sale.entryId);
  const fromBackup = backupEntry ? backupToCustomerRow(backupEntry) : {};
  const base = existing ? { ...existing } : createEmptyCustomerDetailRow();

  return {
    ...base,
    ...fromBackup,
    isBackupEntry: true,
    entryId: sale.entryId,
    saleRowId: saleRowKeyForCustomerSync(sale),
    consumerNo: sale.consumerNo ?? fromBackup.consumerNo ?? "",
    customerName: sale.customerName || fromBackup.customerName || "",
    fatherName: sale.fatherName || fromBackup.fatherName || "",
    address: sale.address || fromBackup.address || "",
    mobile: sale.mobile || fromBackup.mobile || "",
    amount:
      sale.amount !== undefined && String(sale.amount).trim() !== ""
        ? String(sale.amount)
        : fromBackup.amount || base.amount,
    amountType: fromBackup.amountType || base.amountType,
  };
}

/**
 * Customer All Detail = Sale Sheet only (same rows, same order). No manual/sample extras.
 */
export function syncCustomerDetailFromSaleSheet(options = {}) {
  const { dispatchEvent = true } = options;

  const stored = loadSaleCaseRows()
    .filter((r) => !r.isBackupEntry)
    .map(ensureSaleRowId);
  const storedRaw = loadSaleCaseRows().filter((r) => !r.isBackupEntry);
  if (JSON.stringify(stored) !== JSON.stringify(storedRaw)) {
    saveSaleCaseRows(stored, { syncCustomerDetail: false });
  }

  const saleDisplayRows = mergeSaleRowsWithBackup(
    mergeSaleRowsWithCaseSheets(stored),
  );

  const detailRows = loadCustomerDetailRows();
  const existingBySaleId = new Map(
    detailRows.filter((r) => r.saleRowId).map((r) => [r.saleRowId, r]),
  );

  const next = saleDisplayRows.map((sale) => {
    const id = saleRowKeyForCustomerSync(sale);
    const existing = existingBySaleId.get(id);
    if (sale.isBackupEntry) {
      return buildDetailFromBackupSale(sale, existing);
    }
    return buildDetailFromSale(sale, existing);
  });

  if (JSON.stringify(next) !== JSON.stringify(detailRows)) {
    saveCustomerDetailRows(next);
  }

  if (dispatchEvent) {
    window.dispatchEvent(new Event(CUSTOMER_DETAIL_SALE_SYNC_EVENT));
  }

  return next;
}

export function reloadCustomerDetailFromSaleSheet() {
  return syncCustomerDetailFromSaleSheet({ dispatchEvent: false });
}
