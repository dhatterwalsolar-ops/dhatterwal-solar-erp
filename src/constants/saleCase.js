export const SALE_TEAM_WORK_OPTIONS = [
  "AMAN TEAM",
  "BALINDER TEAM",
  "SUKHWINDER TEAM",
  "RAVINDER TEAM",
];

export const SALE_CASE_SAMPLE_ROWS = [
  {
    date: "20/07/2025",
    consumerNo: "CN-240701",
    customerName: "Ramesh Kumar",
    fatherName: "Suresh Kumar",
    address: "VPO Dhatterwal, Rohtak, Haryana",
    mobile: "9992891023",
    setupKw: "02 kW",
    teamWork: "BALINDER TEAM",
    setupDetail: "",
    amount: "210000",
  },
];

export function createEmptySaleRow() {
  return {
    _rowId: `sale-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    date: "",
    consumerNo: "",
    customerName: "",
    fatherName: "",
    address: "",
    mobile: "",
    setupKw: "",
    teamWork: "",
    setupDetail: "",
    amount: "",
    siteOrderId: "",
    siteOrderStatus: "",
  };
}
