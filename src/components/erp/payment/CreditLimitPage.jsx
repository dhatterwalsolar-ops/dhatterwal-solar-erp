import { useEffect, useState } from "react";
import {
  CREDIT_FACILITY_SYNC_EVENT,
  CREDIT_FACILITY_TYPE_LABELS,
  CREDIT_FACILITY_TYPES,
  createEmptyCreditFacility,
} from "../../../constants/creditFacility";
import { getPaymentModeNames } from "../../../utils/paymentAccountStorage";
import {
  availableCredit,
  deleteCreditFacility,
  listCreditFacilities,
  listCreditTransactions,
  payCreditBill,
  recordCreditUsage,
  upsertCreditFacility,
} from "../../../utils/creditFacilityStorage";
import { formatPaymentDate, formatPaymentMoney } from "../../../utils/paymentManagementStorage";
import styles from "./PaymentManagement.module.css";

function CreditLimitPage() {
  const [facilities, setFacilities] = useState(() => listCreditFacilities());
  const [txns, setTxns] = useState(() => listCreditTransactions());
  const [accounts, setAccounts] = useState(() => getPaymentModeNames());
  const [editFacility, setEditFacility] = useState(null);

  const [useForm, setUseForm] = useState({
    facilityId: "",
    date: formatPaymentDate(),
    partyName: "",
    partyType: "Supplier",
    amount: "",
    referenceNo: "",
    remarks: "",
  });

  const [billForm, setBillForm] = useState({
    facilityId: "",
    date: formatPaymentDate(),
    amount: "",
    payFromAccount: "",
    referenceNo: "",
    remarks: "",
  });

  const refresh = () => {
    setFacilities(listCreditFacilities());
    setTxns(listCreditTransactions());
    setAccounts(getPaymentModeNames());
  };

  useEffect(() => {
    refresh();
    window.addEventListener(CREDIT_FACILITY_SYNC_EVENT, refresh);
    return () => window.removeEventListener(CREDIT_FACILITY_SYNC_EVENT, refresh);
  }, []);

  const startAddFacility = () => {
    setEditFacility(createEmptyCreditFacility());
  };

  const saveFacility = () => {
    if (!editFacility?.name?.trim()) {
      window.alert("Naam zaroori hai (e.g. HDFC Credit Card, Canara OD).");
      return;
    }
    upsertCreditFacility(editFacility);
    setEditFacility(null);
    refresh();
  };

  const onPayBill = () => {
    const result = payCreditBill(billForm);
    if (!result.ok) {
      window.alert(result.message);
      return;
    }
    window.alert(`Bill payment ₹${formatPaymentMoney(result.paid)} save ho gayi.`);
    setBillForm({
      facilityId: "",
      date: formatPaymentDate(),
      amount: "",
      payFromAccount: accounts[0] || "",
      referenceNo: "",
      remarks: "",
    });
    refresh();
  };

  const onUseCredit = () => {
    if (!useForm.facilityId) {
      window.alert("Credit / limit select karein.");
      return;
    }
    const result = recordCreditUsage(useForm);
    if (!result.ok) {
      window.alert(result.message);
      return;
    }
    window.alert("Credit se payment record ho gayi (used limit update).");
    setUseForm({
      facilityId: "",
      date: formatPaymentDate(),
      partyName: "",
      partyType: "Supplier",
      amount: "",
      referenceNo: "",
      remarks: "",
    });
    refresh();
  };

  return (
    <div>
      <div className={styles.breadcrumb}>
        Home › <strong>Payments</strong> › Credit &amp; Bank Limit
      </div>
      <div className={styles.pageHead}>
        <div>
          <h1>Credit Card &amp; Bank Limit</h1>
          <p>
            Bank se limit ya credit card add karein, payment unse use karein, aur bill pay karke used
            limit wapas kam karein. Bill payment aapke cash/bank account se Payment Given me jati hai.
          </p>
        </div>
        <button type="button" className={styles.btnAddReceived} onClick={startAddFacility}>
          + Add Limit / Credit Card
        </button>
      </div>

      {editFacility ? (
        <section className={styles.formPanel}>
          <h2 style={{ fontSize: "0.9375rem", marginBottom: "0.65rem" }}>
            {editFacility.createdAt ? "Edit" : "New"} Credit / Limit
          </h2>
          <div className={styles.formGrid}>
            <label>
              Type
              <select
                value={editFacility.type}
                onChange={(e) => setEditFacility((f) => ({ ...f, type: e.target.value }))}
              >
                <option value={CREDIT_FACILITY_TYPES.BANK_LIMIT}>Bank Limit / OD</option>
                <option value={CREDIT_FACILITY_TYPES.CREDIT_CARD}>Credit Card</option>
              </select>
            </label>
            <label>
              Name
              <input
                value={editFacility.name}
                onChange={(e) => setEditFacility((f) => ({ ...f, name: e.target.value }))}
                placeholder="HDFC Credit Card / Canara OD"
              />
            </label>
            <label>
              Bank Name
              <input
                value={editFacility.bankName}
                onChange={(e) => setEditFacility((f) => ({ ...f, bankName: e.target.value }))}
              />
            </label>
            <label>
              Sanctioned Limit (₹)
              <input
                type="number"
                min="0"
                value={editFacility.limitAmount}
                onChange={(e) =>
                  setEditFacility((f) => ({ ...f, limitAmount: e.target.value }))
                }
              />
            </label>
            <label>
              Used (₹) — manual adjust
              <input
                type="number"
                min="0"
                value={editFacility.usedAmount}
                onChange={(e) =>
                  setEditFacility((f) => ({ ...f, usedAmount: e.target.value }))
                }
              />
            </label>
            <label>
              Current Bill Due (₹)
              <input
                type="number"
                min="0"
                value={editFacility.billDueAmount}
                onChange={(e) =>
                  setEditFacility((f) => ({ ...f, billDueAmount: e.target.value }))
                }
              />
            </label>
            <label>
              Bill Due Date
              <input
                value={editFacility.billDueDate}
                onChange={(e) => setEditFacility((f) => ({ ...f, billDueDate: e.target.value }))}
                placeholder="DD/MM/YYYY"
              />
            </label>
            <label className={styles.span2}>
              Remarks
              <input
                value={editFacility.remarks}
                onChange={(e) => setEditFacility((f) => ({ ...f, remarks: e.target.value }))}
              />
            </label>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.btnPrimary} onClick={saveFacility}>
              Save
            </button>
            <button type="button" className={styles.btnGhost} onClick={() => setEditFacility(null)}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      <section className={styles.tablePanel}>
        <div className={styles.tableTitle}>MERE LIMIT / CREDIT CARDS</div>
        <div className={styles.tableScroll}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>TYPE</th>
                <th>NAME</th>
                <th>BANK</th>
                <th>LIMIT (₹)</th>
                <th>USED (₹)</th>
                <th>AVAILABLE (₹)</th>
                <th>BILL DUE</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {facilities.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "1rem" }}>
                    Abhi koi limit / credit card add nahi — upar button se add karein.
                  </td>
                </tr>
              ) : (
                facilities.map((f) => (
                  <tr key={f.id}>
                    <td>{CREDIT_FACILITY_TYPE_LABELS[f.type] || f.type}</td>
                    <td>{f.name}</td>
                    <td>{f.bankName || "—"}</td>
                    <td className={styles.num}>₹ {formatPaymentMoney(f.limitAmount)}</td>
                    <td className={`${styles.num} ${styles.amountOut}`}>
                      ₹ {formatPaymentMoney(f.usedAmount)}
                    </td>
                    <td className={`${styles.num} ${styles.amountIn}`}>
                      ₹ {formatPaymentMoney(availableCredit(f))}
                    </td>
                    <td>
                      ₹ {formatPaymentMoney(f.billDueAmount)}
                      {f.billDueDate ? ` · ${f.billDueDate}` : ""}
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => setEditFacility({ ...f })}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={() => {
                            if (window.confirm(`Delete ${f.name}?`)) {
                              deleteCreditFacility(f.id);
                              refresh();
                            }
                          }}
                        >
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className={styles.pendingGrid} style={{ marginTop: "1rem" }}>
        <section className={styles.formPanel}>
          <h2 style={{ fontSize: "0.875rem", color: "var(--color-green-dark)" }}>
            Credit / Limit se payment use karein
          </h2>
          <div className={styles.formGrid}>
            <label>
              Limit / Card
              <select
                value={useForm.facilityId}
                onChange={(e) => setUseForm((f) => ({ ...f, facilityId: e.target.value }))}
              >
                <option value="">Select…</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} (Avail ₹{formatPaymentMoney(availableCredit(f))})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input
                value={useForm.date}
                onChange={(e) => setUseForm((f) => ({ ...f, date: e.target.value }))}
              />
            </label>
            <label>
              Party Name
              <input
                value={useForm.partyName}
                onChange={(e) => setUseForm((f) => ({ ...f, partyName: e.target.value }))}
              />
            </label>
            <label>
              Amount (₹)
              <input
                type="number"
                min="0"
                value={useForm.amount}
                onChange={(e) => setUseForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </label>
            <label className={styles.span2}>
              Remark
              <input
                value={useForm.remarks}
                onChange={(e) => setUseForm((f) => ({ ...f, remarks: e.target.value }))}
              />
            </label>
          </div>
          <button type="button" className={styles.btnPrimary} onClick={onUseCredit}>
            Record Credit Payment
          </button>
        </section>

        <section className={styles.formPanel}>
          <h2 style={{ fontSize: "0.875rem", color: "var(--color-green-dark)" }}>
            Bill pay karein (limit settle)
          </h2>
          <div className={styles.formGrid}>
            <label>
              Limit / Card
              <select
                value={billForm.facilityId}
                onChange={(e) => setBillForm((f) => ({ ...f, facilityId: e.target.value }))}
              >
                <option value="">Select…</option>
                {facilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} (Used ₹{formatPaymentMoney(f.usedAmount)})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Pay from Account
              <select
                value={billForm.payFromAccount}
                onChange={(e) => setBillForm((f) => ({ ...f, payFromAccount: e.target.value }))}
              >
                <option value="">Select bank/cash…</option>
                {accounts.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input
                value={billForm.date}
                onChange={(e) => setBillForm((f) => ({ ...f, date: e.target.value }))}
              />
            </label>
            <label>
              Amount (₹)
              <input
                type="number"
                min="0"
                value={billForm.amount}
                onChange={(e) => setBillForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </label>
            <label className={styles.span2}>
              Remark
              <input
                value={billForm.remarks}
                onChange={(e) => setBillForm((f) => ({ ...f, remarks: e.target.value }))}
              />
            </label>
          </div>
          <button type="button" className={styles.btnAddGiven} onClick={onPayBill}>
            Pay Bill / Settle Limit
          </button>
        </section>
      </div>

      <section className={styles.tablePanel} style={{ marginTop: "1rem" }}>
        <div className={styles.tableTitle}>Credit / Limit History</div>
        <div className={styles.tableScroll}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>DATE</th>
                <th>FACILITY</th>
                <th>TYPE</th>
                <th>AMOUNT (₹)</th>
                <th>DETAIL</th>
              </tr>
            </thead>
            <tbody>
              {txns.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "1rem" }}>
                    Abhi koi entry nahi.
                  </td>
                </tr>
              ) : (
                txns.map((t) => (
                  <tr key={t.id}>
                    <td>{t.date}</td>
                    <td>{t.facilityName}</td>
                    <td>{t.type === "bill-payment" ? "Bill Paid" : "Credit Used"}</td>
                    <td className={styles.num}>₹ {formatPaymentMoney(t.amount)}</td>
                    <td>
                      {t.type === "usage"
                        ? `${t.partyName || "—"} ${t.remarks || ""}`
                        : `From ${t.payFromAccount || "—"} ${t.remarks || ""}`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default CreditLimitPage;
