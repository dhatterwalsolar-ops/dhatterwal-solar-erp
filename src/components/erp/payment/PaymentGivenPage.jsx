import { useEffect, useState } from "react";
import {
  getPaymentModeNames,
  PAYMENT_ACCOUNTS_SYNC_EVENT,
} from "../../../utils/paymentAccountStorage";
import {
  creditFacilityPaymentLabel,
  getCreditFacility,
  listCreditFacilities,
  recordCreditUsage,
} from "../../../utils/creditFacilityStorage";
import { CREDIT_FACILITY_SYNC_EVENT } from "../../../constants/creditFacility";
import {
  PAYMENT_MGMT_SYNC_EVENT,
  addPaymentGiven,
  deletePaymentGiven,
  formatPaymentDate,
  formatPaymentMoney,
  listGivenToday,
  sumGivenToday,
  updatePaymentGiven,
} from "../../../utils/paymentManagementStorage";
import PartyPaymentSearch from "./PartyPaymentSearch";
import styles from "./PaymentManagement.module.css";

function emptyForm() {
  const modes = getPaymentModeNames();
  return {
    date: formatPaymentDate(),
    partyName: "",
    partyType: "Supplier",
    amount: "",
    fundingType: "account",
    creditFacilityId: "",
    paymentMode: modes[0] || "Cash",
    referenceNo: "",
    remarks: "",
  };
}

function PaymentGivenPage() {
  const [paymentModes, setPaymentModes] = useState(() => getPaymentModeNames());
  const [creditFacilities, setCreditFacilities] = useState(() => listCreditFacilities());
  const [rows, setRows] = useState(() => listGivenToday());
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const refresh = () => setRows(listGivenToday());

  useEffect(() => {
    refresh();
    window.addEventListener(PAYMENT_MGMT_SYNC_EVENT, refresh);
    return () => window.removeEventListener(PAYMENT_MGMT_SYNC_EVENT, refresh);
  }, []);

  useEffect(() => {
    const onAccounts = () => setPaymentModes(getPaymentModeNames());
    window.addEventListener(PAYMENT_ACCOUNTS_SYNC_EVENT, onAccounts);
    return () => window.removeEventListener(PAYMENT_ACCOUNTS_SYNC_EVENT, onAccounts);
  }, []);

  useEffect(() => {
    const onCredit = () => setCreditFacilities(listCreditFacilities());
    window.addEventListener(CREDIT_FACILITY_SYNC_EVENT, onCredit);
    return () => window.removeEventListener(CREDIT_FACILITY_SYNC_EVENT, onCredit);
  }, []);

  const onSave = () => {
    if (!form.partyName?.trim()) {
      window.alert("Party select karein.");
      return;
    }
    const amount = Number(form.amount);
    if (!(amount > 0)) {
      window.alert("Valid amount enter karein.");
      return;
    }

    if (form.fundingType === "credit") {
      if (!form.creditFacilityId) {
        window.alert("Credit / limit select karein.");
        return;
      }
      const facility = getCreditFacility(form.creditFacilityId);
      if (!editId) {
        const usage = recordCreditUsage({
          facilityId: form.creditFacilityId,
          amount,
          date: form.date,
          partyName: form.partyName,
          partyType: form.partyType,
          referenceNo: form.referenceNo,
          remarks: form.remarks,
        });
        if (!usage.ok) {
          window.alert(usage.message);
          return;
        }
      }
      const payload = {
        ...form,
        amount,
        fundingType: "credit",
        creditFacilityName: facility?.name || "",
        paymentMode: creditFacilityPaymentLabel(facility),
      };
      if (editId) {
        updatePaymentGiven(editId, payload);
      } else {
        addPaymentGiven(payload);
      }
    } else {
      const payload = { ...form, amount, fundingType: "account" };
      if (editId) {
        updatePaymentGiven(editId, payload);
      } else {
        addPaymentGiven(payload);
      }
    }

    setForm(emptyForm());
    setEditId(null);
    refresh();
  };

  const onEdit = (row) => {
    setEditId(row.id);
    setForm({
      date: row.date,
      partyName: row.partyName,
      partyType: row.partyType,
      amount: String(row.amount),
      fundingType: row.fundingType || "account",
      creditFacilityId: row.creditFacilityId || "",
      paymentMode: row.paymentMode,
      referenceNo: row.referenceNo,
      remarks: row.remarks,
    });
  };

  const onDelete = (id) => {
    if (!window.confirm("Delete this payment given entry?")) return;
    deletePaymentGiven(id);
    refresh();
  };

  const total = sumGivenToday();

  return (
    <div className={styles.showForm}>
      <div className={styles.breadcrumb}>
        Home › <strong>Payments</strong> › Payment Given
      </div>
      <div className={styles.pageHead}>
        <div>
          <h1>Payment Given</h1>
          <p>Supplier / Labour ko di gayi payment — account balance se adjust hoti hai.</p>
        </div>
        <button
          type="button"
          className={styles.btnAddGiven}
          onClick={() => {
            setEditId(null);
            setForm(emptyForm());
          }}
        >
          + Add Payment Given
        </button>
      </div>

      <section className={`${styles.formPanel} ${styles.hiddenForm}`}>
        <div className={styles.formGrid}>
          <label>
            Date
            <input
              type="text"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </label>
          <div className={styles.span2}>
            <PartyPaymentSearch
              partyName={form.partyName}
              partyType={form.partyType}
              onChange={({ partyName, partyType }) =>
                setForm((f) => ({ ...f, partyName, partyType: partyType || f.partyType }))
              }
            />
          </div>
          <label>
            Amount (₹)
            <input
              type="number"
              min="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </label>
          <label>
            Pay From
            <select
              value={form.fundingType}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  fundingType: e.target.value,
                  creditFacilityId: "",
                }))
              }
            >
              <option value="account">Cash / Bank Account</option>
              <option value="credit">Credit Card / Bank Limit</option>
            </select>
          </label>
          {form.fundingType === "credit" ? (
            <label className={styles.span2}>
              Credit / Limit
              <select
                value={form.creditFacilityId}
                onChange={(e) => setForm((f) => ({ ...f, creditFacilityId: e.target.value }))}
              >
                <option value="">Select limit or card…</option>
                {creditFacilities.map((cf) => (
                  <option key={cf.id} value={cf.id}>
                    {cf.name} — Available ₹
                    {Number(
                      (Number(cf.limitAmount) || 0) - (Number(cf.usedAmount) || 0),
                    ).toLocaleString("en-IN")}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Payment Mode / Account
              <select
                value={form.paymentMode}
                onChange={(e) => setForm((f) => ({ ...f, paymentMode: e.target.value }))}
              >
                {paymentModes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Reference No (Optional)
            <input
              value={form.referenceNo}
              onChange={(e) => setForm((f) => ({ ...f, referenceNo: e.target.value }))}
            />
          </label>
          <label className={styles.span2}>
            Remarks (Optional)
            <textarea
              value={form.remarks}
              onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
            />
          </label>
        </div>
        <div className={styles.formActions}>
          <button type="button" className={styles.btnPrimary} onClick={onSave}>
            {editId ? "Update Payment" : "Save Payment Given"}
          </button>
          <button type="button" className={styles.btnGhost} onClick={() => setForm(emptyForm())}>
            Clear
          </button>
        </div>
        <p className={styles.note}>
          Note: Amount selected payment mode / account balance se deduct hoti hai (dashboard me dikhegi).
        </p>
      </section>

      <section className={styles.tablePanel}>
        <div className={styles.tableTitle}>TODAY&apos;S PAYMENT GIVEN LIST</div>
        <div className={styles.tableScroll}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>SR. NO.</th>
                <th>DATE</th>
                <th>PARTY NAME</th>
                <th>TYPE</th>
                <th>AMOUNT (₹)</th>
                <th>PAYMENT MODE</th>
                <th>REFERENCE NO</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "1.5rem" }}>
                    Aaj koi payment given entry nahi.
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={row.id}>
                    <td>{i + 1}</td>
                    <td>{row.date}</td>
                    <td>{row.partyName}</td>
                    <td>{row.partyType}</td>
                    <td className={`${styles.num} ${styles.amountOut}`}>
                      ₹ {formatPaymentMoney(row.amount)}
                    </td>
                    <td>{row.paymentMode}</td>
                    <td>{row.referenceNo || "—"}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <button type="button" className={styles.iconBtn} onClick={() => onEdit(row)}>
                          Edit
                        </button>
                        <button type="button" className={styles.iconBtn} onClick={() => onDelete(row.id)}>
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>TOTAL GIVEN TODAY</td>
                <td className={`${styles.num} ${styles.amountOut}`} colSpan={4}>
                  ₹ {formatPaymentMoney(total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}

export default PaymentGivenPage;
