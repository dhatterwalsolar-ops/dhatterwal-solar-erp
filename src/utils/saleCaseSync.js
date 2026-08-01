import { formatSetupDetail } from "../constants/bomRegistry";
import { lookupCustomer } from "../constants/customerRegistry";
import { getBomMaterialsForConsumer } from "./bomSheetStorage";
import { getConsumerReference } from "./consumerReference";
import { loadSaleCaseRows, saveSaleCaseRows } from "./saleCaseStorage";

/** Fired when sale rows in storage were refreshed from Loan/Cash Case data. */
export const SALE_CASE_SYNC_EVENT = "dhatterwal-sale-case-sync";

/**
 * Pull latest customer + setup detail from Loan/Cash (and name/load overrides)
 * while keeping sale-specific columns.
 */
export function mergeSaleRowWithCaseSheets(row) {
  if (!row || row.isBackupEntry) return row;
  const trimmed = String(row.consumerNo || "").trim();
  if (!trimmed) return row;

  const customer = lookupCustomer(trimmed);
  const ref = getConsumerReference(trimmed) || String(row.reference || "").trim();
  if (!customer) {
    return ref && ref !== String(row.reference || "").trim() ? { ...row, reference: ref } : row;
  }

  const bom = getBomMaterialsForConsumer(trimmed);
  return {
    ...row,
    consumerNo: customer.consumerNo,
    customerName: customer.customerName,
    fatherName: customer.fatherName,
    address: customer.address,
    mobile: customer.mobile || row.mobile,
    setupKw: customer.setupKw,
    setupDetail: formatSetupDetail(bom),
    reference: ref,
  };
}

export function mergeSaleRowsWithCaseSheets(rows) {
  return (rows || []).map(mergeSaleRowWithCaseSheets);
}

/** Update persisted sale rows whenever Loan/Cash case data changes. */
export function refreshSavedSaleRowsFromCaseSheets() {
  const rows = loadSaleCaseRows();
  const next = mergeSaleRowsWithCaseSheets(rows);
  const changed = JSON.stringify(next) !== JSON.stringify(rows);
  if (!changed) {
    window.dispatchEvent(new Event(SALE_CASE_SYNC_EVENT));
    return;
  }
  try {
    saveSaleCaseRows(next);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(SALE_CASE_SYNC_EVENT));
}

export function loadSaleCaseRowsSyncedWithCaseSheets() {
  return mergeSaleRowsWithCaseSheets(loadSaleCaseRows());
}
