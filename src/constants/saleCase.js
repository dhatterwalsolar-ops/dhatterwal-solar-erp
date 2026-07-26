export const SALE_CASE_SAMPLE_ROWS = [
  {
    date: "20/07/2025",
    consumerNo: "CN-240701",
    customerName: "Ramesh Kumar",
    fatherName: "Suresh Kumar",
    address: "VPO Dhatterwal, Rohtak, Haryana",
    setupKw: "02 kW",
    setupDetail: "",
    amount: "210000",
  },
];

export function createEmptySaleRow() {
  return {
    date: "",
    consumerNo: "",
    customerName: "",
    fatherName: "",
    address: "",
    setupKw: "",
    setupDetail: "",
    amount: "",
  };
}
