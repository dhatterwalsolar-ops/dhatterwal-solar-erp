const KEY = "dhatterwal_labour_employee_payments";

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function listPaymentsForEmployee(employeeId) {
  return readAll().filter((p) => p.employeeId === employeeId);
}

export function addLabourEmployeePayment(entry) {
  const record = {
    id: entry.id || `lpay-${Date.now()}`,
    employeeId: entry.employeeId,
    type: entry.type,
    date: entry.date || "",
    amount: Number(entry.amount) || 0,
    days: Number(entry.days) || 0,
    remark: entry.remark || "",
    createdAt: new Date().toISOString(),
  };
  const list = readAll();
  list.unshift(record);
  writeAll(list);
  return record;
}

export function deletePaymentsForEmployee(employeeId) {
  writeAll(readAll().filter((p) => p.employeeId !== employeeId));
}
