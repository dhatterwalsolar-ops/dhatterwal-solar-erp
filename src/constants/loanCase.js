export const SETUP_KW_OPTIONS = ["02 kW", "03 kW", "05 kW"];

export const LOAN_CASE_COLUMNS = [
  { key: "date", label: "Date", type: "text" },
  {
    key: "consumerNo",
    label: "Consumer No.",
    type: "manual",
    isPrimaryId: true,
    placeholder: "Enter Consumer No. manually",
  },
  { key: "customerName", label: "Customer Name", type: "text" },
  { key: "fatherName", label: "Father Name", type: "text" },
  { key: "address", label: "Address", type: "text" },
  {
    key: "setupKw",
    label: "Setup (kW)",
    type: "select",
    options: SETUP_KW_OPTIONS,
  },
  { key: "reference", label: "Reference", type: "text" },
  { key: "loanPayment", label: "Loan Payment", type: "text" },
  { key: "marginMoney", label: "Margin Money", type: "text" },
  { key: "bankName", label: "Bank Name", type: "text" },
  { key: "bankIfsc", label: "Bank IFSC Code", type: "text" },
];

export const LOAN_CASE_SAMPLE_ROWS = [
  {
    date: "20/07/2025",
    consumerNo: "CN-240701",
    customerName: "Ramesh Kumar",
    fatherName: "Suresh Kumar",
    address: "VPO Dhatterwal, Rohtak, Haryana",
    setupKw: "02 kW",
    reference: "Self",
    loanPayment: "₹1,68,000",
    marginMoney: "₹42,000",
    bankName: "State Bank of India",
    bankIfsc: "SBIN0001234",
  },
  {
    date: "18/07/2025",
    consumerNo: "CN-240702",
    customerName: "Sunita Devi",
    fatherName: "Ram Kishan",
    address: "Near Bus Stand, Jind, Haryana",
    setupKw: "03 kW",
    reference: "Staff Referral",
    loanPayment: "₹2,10,000",
    marginMoney: "₹52,500",
    bankName: "Punjab National Bank",
    bankIfsc: "PUNB0123456",
  },
];

export function createEmptyLoanRow() {
  return {
    date: "",
    consumerNo: "",
    customerName: "",
    fatherName: "",
    address: "",
    setupKw: "",
    reference: "",
    loanPayment: "",
    marginMoney: "",
    bankName: "",
    bankIfsc: "",
  };
}
