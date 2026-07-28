import { SETUP_KW_OPTIONS, SEVA_OPTIONS } from "./loanCase";

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
  { key: "fatherName", label: "Father/Husband Name", type: "text" },
  { key: "address", label: "Address", type: "text" },
  { key: "mobile", label: "Mobile Number", type: "text" },
  {
    key: "setupKw",
    label: "Setup (kW)",
    type: "select",
    options: SETUP_KW_OPTIONS,
  },
  { key: "reference", label: "Reference", type: "text" },
  {
    key: "seva",
    label: "Seva",
    type: "select",
    options: SEVA_OPTIONS,
  },
];

export const CASH_CASE_SAMPLE_ROWS = [
  {
    date: "20/07/2025",
    consumerNo: "CN-C240701",
    customerName: "Amit Sharma",
    fatherName: "Rajesh Sharma",
    address: "Sector 14, Rohtak, Haryana",
    mobile: "9992891723",
    setupKw: "02 kW",
    reference: "Self",
    seva: "",
  },
  {
    date: "19/07/2025",
    consumerNo: "CN-C240702",
    customerName: "Neha Gupta",
    fatherName: "Anil Gupta",
    address: "Model Town, Jind, Haryana",
    mobile: "9812345678",
    setupKw: "05 kW",
    reference: "Dealer",
    seva: "",
  },
];

export function createEmptyCashRow() {
  return {
    _rowId: `cash-row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: "",
    consumerNo: "",
    customerName: "",
    fatherName: "",
    address: "",
    mobile: "",
    setupKw: "",
    reference: "",
    seva: "",
  };
}
