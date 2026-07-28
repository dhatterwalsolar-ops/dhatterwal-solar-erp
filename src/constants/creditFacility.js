export const CREDIT_FACILITY_TYPES = {
  BANK_LIMIT: "bank-limit",
  CREDIT_CARD: "credit-card",
};

export const CREDIT_FACILITY_TYPE_LABELS = {
  "bank-limit": "Bank Limit / OD",
  "credit-card": "Credit Card",
};

export const CREDIT_FACILITY_SYNC_EVENT = "dhatterwal-credit-facility-sync";

export function createEmptyCreditFacility() {
  return {
    id: `cf-${Date.now()}`,
    type: CREDIT_FACILITY_TYPES.BANK_LIMIT,
    name: "",
    bankName: "",
    limitAmount: 0,
    usedAmount: 0,
    billDueAmount: 0,
    billDueDate: "",
    remarks: "",
    createdAt: new Date().toISOString(),
  };
}
