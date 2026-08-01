import { useEffect, useState } from "react";
import { computeEmployeeBalance } from "../../../constants/labourEmployeeForm";
import styles from "./AddEmployeeSheet.module.css";

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function AdvancePaymentSheet({ open, employees, initialEmployeeId, onClose, onSave }) {
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(todayStr);
  const [amount, setAmount] = useState("");
  const [remark, setRemark] = useState("");

  useEffect(() => {
    if (!open) return;
    setEmployeeId(initialEmployeeId || employees[0]?.id || "");
    setDate(todayStr());
    setAmount("");
    setRemark("");
  }, [open, initialEmployeeId, employees]);

  if (!open) return null;

  const selected = employees.find((e) => e.id === employeeId);

  const handleSave = () => {
    if (!employeeId) {
      window.alert("Employee select karein.");
      return;
    }
    const amt = Number(amount) || 0;
    if (!(amt > 0)) {
      window.alert("Advance amount (₹) enter karein.");
      return;
    }
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) {
      window.alert("Employee nahi mila.");
      return;
    }
    const next = {
      ...emp,
      advanceTaken: (Number(emp.advanceTaken) || 0) + amt,
    };
    next.balance = computeEmployeeBalance(next);
    onSave(next, {
      type: "advance",
      date: date.trim() || todayStr(),
      amount: amt,
      days: 0,
      remark: remark.trim(),
    });
  };

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="advance-pay-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 id="advance-pay-title">Advance Payment</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className={styles.body}>
          <section className={styles.section}>
            <h3>Employee advance fill karein</h3>
            <div className={styles.grid}>
              <label className={styles.span2}>
                Employee *
                <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
                  <option value="">Select employee…</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.role || "—"}) — Adv ₹
                      {Number(e.advanceTaken || 0).toLocaleString("en-IN")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Date
                <input value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label>
                Advance Amount (₹) *
                <input
                  type="number"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 2000"
                />
              </label>
              <label className={styles.span2}>
                Remark
                <input
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="Advance reason / note"
                />
              </label>
            </div>
            {selected ? (
              <p className={styles.hint}>
                Current advance: ₹{Number(selected.advanceTaken || 0).toLocaleString("en-IN")} —
                Balance: ₹{Number(selected.balance || 0).toLocaleString("en-IN")}
              </p>
            ) : (
              <p className={styles.hint}>Save par advance total badhega aur payment history me record hoga.</p>
            )}
          </section>
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.btnPrimary} onClick={handleSave}>
            Save Advance
          </button>
          <button type="button" className={styles.btnGhost} onClick={onClose}>
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
}

export default AdvancePaymentSheet;
