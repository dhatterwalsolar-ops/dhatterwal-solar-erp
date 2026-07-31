import { erpGetItem, erpRemoveItem, erpSetItem } from "./erpStorage";

const KEY = "dhatterwal_labour_employees";

export function getLabourEmployees() {
  try {
    const raw = erpGetItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [];
    return list.map((e) => normalizeEmployee(e));
  } catch {
    return [];
  }
}

function normalizeEmployee(e) {
  return {
    salaryType: "",
    fatherName: "",
    role: "",
    wagesPaidTotal: 0,
    salaryPaidTotal: 0,
    ...e,
    fatherName: String(e.fatherName || "").trim(),
    dailyWage: Number(e.dailyWage) || 0,
    monthlySalary: Number(e.monthlySalary) || 0,
    advanceTaken: Number(e.advanceTaken) || 0,
    balance: Number(e.balance) || 0,
    wagesPaidTotal: Number(e.wagesPaidTotal) || 0,
    salaryPaidTotal: Number(e.salaryPaidTotal) || 0,
  };
}

export function saveLabourEmployees(list) {
  try {
    erpSetItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event("dhatterwal-labour-employees-sync"));
  } catch {
    /* ignore */
  }
}
