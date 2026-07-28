import { useEffect, useMemo, useState } from "react";
import {
  LABOUR_SALARY_TYPES,
  LABOUR_TEAM_TYPES,
  LABOUR_DAYS_PER_MONTH,
  computeEmployeeBalance,
  computeMonthlyFromDaily,
  createEmptyLabourEmployee,
} from "../../../constants/labourEmployeeForm";
import { listPaymentsForEmployee } from "../../../utils/labourPaymentStorage";
import styles from "./AddEmployeeSheet.module.css";

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function emptyDailyPayment() {
  return { date: todayStr(), days: "1", amount: "", remark: "" };
}

function emptySalaryPayment() {
  return { date: todayStr(), amount: "", remark: "" };
}

function AddEmployeeSheet({ open, initial, onClose, onSave }) {
  const [form, setForm] = useState(() => createEmptyLabourEmployee());
  const [addDailyPay, setAddDailyPay] = useState(false);
  const [addSalaryPay, setAddSalaryPay] = useState(false);
  const [dailyPay, setDailyPay] = useState(emptyDailyPayment);
  const [salaryPay, setSalaryPay] = useState(emptySalaryPayment);
  const [history, setHistory] = useState([]);

  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    if (!open) return;
    if (initial?.id) {
      setForm({
        ...createEmptyLabourEmployee(),
        ...initial,
        fatherName: initial.fatherName ?? "",
        role: initial.role ?? "",
        dailyWage: initial.dailyWage ?? "",
        monthlySalary: initial.monthlySalary ?? "",
      });
      setHistory(listPaymentsForEmployee(initial.id));
    } else {
      setForm(createEmptyLabourEmployee());
      setHistory([]);
    }
    setAddDailyPay(false);
    setAddSalaryPay(false);
    setDailyPay(emptyDailyPayment());
    setSalaryPay(emptySalaryPayment());
  }, [open, initial]);

  const monthlyFromDailyPreview = useMemo(
    () => computeMonthlyFromDaily(form.dailyWage),
    [form.dailyWage],
  );

  const dailyAmountPreview = useMemo(() => {
    const days = Number(dailyPay.days) || 0;
    const wage = Number(form.dailyWage) || 0;
    if (dailyPay.amount) return Number(dailyPay.amount) || 0;
    return days * wage;
  }, [dailyPay, form.dailyWage]);

  if (!open) return null;

  const handleSave = () => {
    if (!form.name?.trim()) {
      window.alert("Employee name zaroori hai.");
      return;
    }
    if (!form.mobile?.trim()) {
      window.alert("Mobile number zaroori hai (WhatsApp / site form ke liye).");
      return;
    }

    const dailyWage = Number(form.dailyWage) || 0;
    let monthlySalary = Number(form.monthlySalary) || 0;

    if (form.salaryType === LABOUR_SALARY_TYPES.DAILY) {
      monthlySalary = computeMonthlyFromDaily(dailyWage);
    } else if (form.salaryType === LABOUR_SALARY_TYPES.MONTHLY) {
      if (!(monthlySalary > 0)) {
        window.alert("Monthly salary amount enter karein.");
        return;
      }
    }

    let wagesPaidTotal = Number(form.wagesPaidTotal) || 0;
    let salaryPaidTotal = Number(form.salaryPaidTotal) || 0;
    const pendingPayments = [];

    if (addDailyPay && form.salaryType === LABOUR_SALARY_TYPES.DAILY) {
      const amt = dailyPay.amount ? Number(dailyPay.amount) : dailyAmountPreview;
      if (!(amt > 0)) {
        window.alert("Daily labour payment amount enter karein.");
        return;
      }
      pendingPayments.push({
        type: "daily-wages",
        date: dailyPay.date,
        amount: amt,
        days: Number(dailyPay.days) || 0,
        remark: dailyPay.remark,
      });
      wagesPaidTotal += amt;
    }

    if (addSalaryPay && form.salaryType === LABOUR_SALARY_TYPES.MONTHLY) {
      const amt = Number(salaryPay.amount) || 0;
      if (!(amt > 0)) {
        window.alert("Salary payment amount enter karein.");
        return;
      }
      pendingPayments.push({
        type: "monthly-salary",
        date: salaryPay.date,
        amount: amt,
        days: 0,
        remark: salaryPay.remark,
      });
      salaryPaidTotal += amt;
    }

    const employee = {
      ...form,
      id: form.id || `emp-${Date.now()}`,
      name: form.name.trim(),
      fatherName: form.fatherName?.trim() || "",
      role: form.role || "",
      mobile: form.mobile.trim(),
      dailyWage,
      monthlySalary,
      wagesPaidTotal,
      salaryPaidTotal,
      advanceTaken: Number(form.advanceTaken) || 0,
    };
    employee.balance = computeEmployeeBalance(employee);

    onSave(employee, pendingPayments);
  };

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-employee-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 id="add-employee-title">{isEdit ? "Edit Employee" : "Add Employee"}</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className={styles.body}>
          <section className={styles.section}>
            <h3>Basic detail</h3>
            <div className={styles.grid}>
              <label>
                Employee Name *
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Poora naam"
                />
              </label>
              <label>
                Father Name
                <input
                  value={form.fatherName}
                  onChange={(e) => setForm((f) => ({ ...f, fatherName: e.target.value }))}
                  placeholder="Father / husband name"
                />
              </label>
              <label>
                Team Type (optional)
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                >
                  <option value="">Select…</option>
                  {LABOUR_TEAM_TYPES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Mobile Number * (WhatsApp / site form)
                <input
                  value={form.mobile}
                  onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                  placeholder="10 digit mobile"
                  inputMode="tel"
                />
              </label>
            </div>
            <p className={styles.hint}>
              Team Leader select karne par Sale Sheet se isi mobile par site Google / ERP form
              WhatsApp ho sakta hai.
            </p>
          </section>

          <section className={styles.section}>
            <h3>Salary (optional)</h3>
            <div className={styles.grid}>
              <label className={styles.span2}>
                Salary Type
                <select
                  value={form.salaryType}
                  onChange={(e) => setForm((f) => ({ ...f, salaryType: e.target.value }))}
                >
                  <option value="">Select…</option>
                  <option value={LABOUR_SALARY_TYPES.MONTHLY}>Monthly Salary</option>
                  <option value={LABOUR_SALARY_TYPES.DAILY}>Daily Wages</option>
                </select>
              </label>

              {form.salaryType === LABOUR_SALARY_TYPES.MONTHLY && (
                <label className={styles.span2}>
                  Monthly Salary (₹) *
                  <input
                    type="number"
                    min="0"
                    value={form.monthlySalary}
                    onChange={(e) => setForm((f) => ({ ...f, monthlySalary: e.target.value }))}
                    placeholder="Fixed monthly salary"
                  />
                </label>
              )}

              {form.salaryType === LABOUR_SALARY_TYPES.DAILY && (
                <>
                  <label>
                    Daily Wage (₹) *
                    <input
                      type="number"
                      min="0"
                      value={form.dailyWage}
                      onChange={(e) => setForm((f) => ({ ...f, dailyWage: e.target.value }))}
                      placeholder="Per day"
                    />
                  </label>
                  <div className={styles.monthlyPreview}>
                    <span className={styles.monthlyPreviewLabel}>Monthly calculation</span>
                    <strong>
                      ₹ {monthlyFromDailyPreview.toLocaleString("en-IN")} / month
                    </strong>
                    <span className={styles.monthlyPreviewSub}>
                      ({LABOUR_DAYS_PER_MONTH} din × daily wage)
                    </span>
                  </div>
                </>
              )}
            </div>
          </section>

          {form.salaryType === LABOUR_SALARY_TYPES.DAILY && (
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h3>Daily labour payment (save ke sath)</h3>
                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={addDailyPay}
                    onChange={(e) => setAddDailyPay(e.target.checked)}
                  />
                  Abhi daily payment add karein
                </label>
              </div>
              {addDailyPay ? (
                <div className={styles.grid}>
                  <label>
                    Date
                    <input
                      value={dailyPay.date}
                      onChange={(e) => setDailyPay((p) => ({ ...p, date: e.target.value }))}
                    />
                  </label>
                  <label>
                    Days
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={dailyPay.days}
                      onChange={(e) => setDailyPay((p) => ({ ...p, days: e.target.value }))}
                    />
                  </label>
                  <label>
                    Amount (₹)
                    <input
                      type="number"
                      min="0"
                      value={dailyPay.amount}
                      onChange={(e) => setDailyPay((p) => ({ ...p, amount: e.target.value }))}
                      placeholder={String(dailyAmountPreview || "")}
                    />
                  </label>
                  <label className={styles.span2}>
                    Remark
                    <input
                      value={dailyPay.remark}
                      onChange={(e) => setDailyPay((p) => ({ ...p, remark: e.target.value }))}
                    />
                  </label>
                </div>
              ) : (
                <p className={styles.hint}>Optional — save par daily wages record add ho jayegi.</p>
              )}
            </section>
          )}

          {form.salaryType === LABOUR_SALARY_TYPES.MONTHLY && (
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <h3>Salary payment (save ke sath)</h3>
                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={addSalaryPay}
                    onChange={(e) => setAddSalaryPay(e.target.checked)}
                  />
                  Abhi salary payment add karein
                </label>
              </div>
              {addSalaryPay ? (
                <div className={styles.grid}>
                  <label>
                    Date
                    <input
                      value={salaryPay.date}
                      onChange={(e) => setSalaryPay((p) => ({ ...p, date: e.target.value }))}
                    />
                  </label>
                  <label>
                    Salary Amount (₹)
                    <input
                      type="number"
                      min="0"
                      value={salaryPay.amount}
                      onChange={(e) => setSalaryPay((p) => ({ ...p, amount: e.target.value }))}
                    />
                  </label>
                  <label className={styles.span2}>
                    Remark
                    <input
                      value={salaryPay.remark}
                      onChange={(e) => setSalaryPay((p) => ({ ...p, remark: e.target.value }))}
                    />
                  </label>
                </div>
              ) : (
                <p className={styles.hint}>Optional — save par salary payment record add ho jayegi.</p>
              )}
            </section>
          )}

          {isEdit && history.length > 0 ? (
            <section className={styles.section}>
              <h3>Payment History</h3>
              <ul className={styles.historyList}>
                {history.slice(0, 8).map((p) => (
                  <li key={p.id}>
                    {p.date} — {p.type === "daily-wages" ? "Daily" : "Salary"} — ₹
                    {Number(p.amount).toLocaleString("en-IN")}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.btnPrimary} onClick={handleSave}>
            Save
          </button>
          <button type="button" className={styles.btnGhost} onClick={onClose}>
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
}

export default AddEmployeeSheet;
