export const LABOUR_SALARY_TYPES = {
  DAILY: "daily-wages",
  MONTHLY: "monthly-salary",
};

export const LABOUR_SALARY_TYPE_LABELS = {
  "": "Not set",
  "daily-wages": "Daily Wages",
  "monthly-salary": "Monthly Salary",
};

/** Team type (optional) — WhatsApp site form ke liye Team Leader mobile. */
export const LABOUR_TEAM_TYPES = ["Team Leader", "Helper", "Transporter"];

export const LABOUR_DAYS_PER_MONTH = 26;

export function computeMonthlyFromDaily(dailyWage) {
  return (Number(dailyWage) || 0) * LABOUR_DAYS_PER_MONTH;
}

export function createEmptyLabourEmployee() {
  return {
    id: "",
    name: "",
    fatherName: "",
    role: "",
    mobile: "",
    salaryType: "",
    dailyWage: "",
    monthlySalary: "",
    advanceTaken: 0,
    balance: 0,
    wagesPaidTotal: 0,
    salaryPaidTotal: 0,
    status: "Active",
  };
}

export function computeEmployeeBalance(emp) {
  const advance = Number(emp.advanceTaken) || 0;
  const wagesPaid = Number(emp.wagesPaidTotal) || 0;
  const salaryPaid = Number(emp.salaryPaidTotal) || 0;
  const monthly = Number(emp.monthlySalary) || 0;
  const daily = Number(emp.dailyWage) || 0;
  const base =
    emp.salaryType === LABOUR_SALARY_TYPES.DAILY
      ? computeMonthlyFromDaily(daily)
      : emp.salaryType === LABOUR_SALARY_TYPES.MONTHLY
        ? monthly
        : monthly || computeMonthlyFromDaily(daily);
  return Math.max(0, base - advance - wagesPaid - salaryPaid);
}

export function resolveEmployeeMonthlySalary(emp) {
  if (emp.salaryType === LABOUR_SALARY_TYPES.MONTHLY) {
    return Number(emp.monthlySalary) || 0;
  }
  if (emp.salaryType === LABOUR_SALARY_TYPES.DAILY) {
    return computeMonthlyFromDaily(emp.dailyWage);
  }
  const monthly = Number(emp.monthlySalary) || 0;
  if (monthly > 0) return monthly;
  return computeMonthlyFromDaily(emp.dailyWage);
}
