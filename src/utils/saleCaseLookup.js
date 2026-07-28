import { loadSaleCaseRowsSyncedWithCaseSheets } from "./saleCaseSync";

function normalizeConsumerNo(value) {
  return String(value || "").trim().toUpperCase();
}

export function findSaleRowByConsumerNo(consumerNo) {
  const key = normalizeConsumerNo(consumerNo);
  if (!key) return null;
  return (
    loadSaleCaseRowsSyncedWithCaseSheets().find(
      (row) => normalizeConsumerNo(row.consumerNo) === key,
    ) ?? null
  );
}
