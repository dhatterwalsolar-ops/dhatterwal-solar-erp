import { useEffect, useMemo, useState } from "react";
import {
  CUSTOMER_PAYMENT_SYNC_EVENT,
  listAllPayments,
} from "../../../utils/customerPaymentLedger";
import styles from "./PaymentSheet.module.css";

function formatMoney(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

const CATEGORY_LABELS = {
  "name-load": "Name / Load Fees",
  sale: "Sale Invoice",
  "received-manual": "Payment Received (Manual)",
  "loan-credit": "Loan Amount (Bank Credit)",
  "loan-margin": "Margin Money (Loan Case)",
};

function PaymentSheet() {
  const [payments, setPayments] = useState(() => listAllPayments());
  const [query, setQuery] = useState("");

  useEffect(() => {
    const refresh = () => setPayments(listAllPayments());
    refresh();
    window.addEventListener(CUSTOMER_PAYMENT_SYNC_EVENT, refresh);
    return () => window.removeEventListener(CUSTOMER_PAYMENT_SYNC_EVENT, refresh);
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return payments;
    const q = query.toLowerCase();
    return payments.filter(
      (p) =>
        p.consumerNo?.toLowerCase().includes(q) ||
        p.label?.toLowerCase().includes(q) ||
        p.reference?.toLowerCase().includes(q) ||
        p.applicationNo?.toLowerCase().includes(q),
    );
  }, [payments, query]);

  const total = filtered.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  return (
    <section className={styles.sheet}>
      <header className={styles.toolbar}>
        <div>
          <h1>Payment Sheet</h1>
          <p>
            Update Name/Load Save aur Sale Sheet invoice se payments yahan automatic aati hain.
          </p>
        </div>
        <div className={styles.toolbarActions}>
          <input
            type="search"
            className={styles.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search consumer..."
          />
          <span className={styles.sumBadge}>Filtered total: {formatMoney(total)}</span>
        </div>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Sr.</th>
              <th>Date</th>
              <th>Consumer No.</th>
              <th>Type</th>
              <th>Detail</th>
              <th>Application / Invoice</th>
              <th>Reference</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.empty}>
                  Abhi koi auto payment nahi — Update Name/Load Save ya Sale Invoice generate karein.
                </td>
              </tr>
            ) : (
              filtered.map((p, i) => (
                <tr key={p.id}>
                  <td>{i + 1}</td>
                  <td>{p.date}</td>
                  <td>{p.consumerNo}</td>
                  <td>{CATEGORY_LABELS[p.category] || p.category}</td>
                  <td>{p.label}</td>
                  <td>{p.applicationNo || p.sourceRef?.replace("sale-", "")}</td>
                  <td>{p.reference}</td>
                  <td className={styles.amount}>{formatMoney(p.amount)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default PaymentSheet;
