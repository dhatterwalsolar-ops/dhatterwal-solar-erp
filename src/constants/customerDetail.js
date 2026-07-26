export const CUSTOMER_DETAIL_SAMPLE_ROWS = [
  {
    consumerNo: "CN-240701",
    customerName: "Ramesh Kumar",
    address: "VPO Dhatterwal, Rohtak, Haryana",
    amount: "210000",
    amountType: "Loan",
    receivedAmount: "42000",
    receivedDate: "18/07/2025",
    receivedRemark: "Bank: State Bank of India, IFSC: SBIN0001234",
    secondReceivedAmount: "",
    secondReceivedDate: "",
    secondPaymentRemark: "Bank: State Bank of India, IFSC: SBIN0001234",
  },
  {
    consumerNo: "CN-C240701",
    customerName: "Amit Sharma",
    address: "Sector 14, Rohtak, Haryana",
    amount: "185000",
    amountType: "Cash",
    receivedAmount: "50000",
    receivedDate: "19/07/2025",
    receivedRemark: "UPI — advance",
    secondReceivedAmount: "25000",
    secondReceivedDate: "20/07/2025",
    secondPaymentRemark: "Cash at office",
  },
];

export function createEmptyCustomerDetailRow() {
  return {
    consumerNo: "",
    customerName: "",
    address: "",
    amount: "",
    amountType: "",
    receivedAmount: "",
    receivedDate: "",
    receivedRemark: "",
    secondReceivedAmount: "",
    secondReceivedDate: "",
    secondPaymentRemark: "",
  };
}

export function parseAmountValue(value) {
  const cleaned = String(value ?? "").replace(/[^\d.]/g, "");
  if (!cleaned) return 0;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

export function computePaymentTotals(row) {
  const totalAmount = parseAmountValue(row.amount);
  const received = parseAmountValue(row.receivedAmount);
  const second = parseAmountValue(row.secondReceivedAmount);
  const totalReceived = received + second;
  const pending = Math.max(0, totalAmount - totalReceived);
  return { totalReceived, pending };
}
