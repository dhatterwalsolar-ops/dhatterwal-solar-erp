export const BACKUP_ENTRY_SYNC_EVENT = "dhatterwal-backup-entry-sync";

export function createEmptyBackupEntry(overrides = {}) {
  return {
    id: overrides.id || `backup-${Date.now()}`,
    date: "",
    consumerNo: "",
    customerName: "",
    fatherName: "",
    address: "",
    mobile: "",
    setupKw: "",
    reference: "",
    seva: "",
    caseType: "",
    loanPayment: "",
    marginMoney: "",
    bankName: "",
    bankIfsc: "",
    teamWork: "",
    setupDetail: "",
    amount: "",
    amountType: "",
    receivedAmount: "",
    receivedDate: "",
    receivedRemark: "",
    secondReceivedAmount: "",
    secondReceivedDate: "",
    secondPaymentRemark: "",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
