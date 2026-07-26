import { SETUP_KW_OPTIONS } from "./loanCase";

export const CASH_CASE_COLUMNS = [
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
];

export const CASH_CASE_SAMPLE_ROWS = [
  {
    date: "20/07/2025",
    consumerNo: "CN-C240701",
    customerName: "Amit Sharma",
    fatherName: "Rajesh Sharma",
    address: "Sector 14, Rohtak, Haryana",
    setupKw: "02 kW",
    reference: "Self",
  },
  {
    date: "19/07/2025",
    consumerNo: "CN-C240702",
    customerName: "Neha Gupta",
    fatherName: "Anil Gupta",
    address: "Model Town, Jind, Haryana",
    setupKw: "05 kW",
    reference: "Dealer",
  },
];

export function createEmptyCashRow() {
  return {
    date: "",
    consumerNo: "",
    customerName: "",
    fatherName: "",
    address: "",
    setupKw: "",
    reference: "",
  };
}
