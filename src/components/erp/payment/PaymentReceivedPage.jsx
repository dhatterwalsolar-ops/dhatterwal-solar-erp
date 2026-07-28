import { useEffect, useState } from "react";
import {
  getPaymentModeNames,
  PAYMENT_ACCOUNTS_SYNC_EVENT,
} from "../../../utils/paymentAccountStorage";
import {
  PAYMENT_MGMT_SYNC_EVENT,
  addPaymentReceived,
  deletePaymentReceived,
  formatPaymentDate,
  formatPaymentMoney,
  listReceivedToday,
  sumReceivedToday,
  updatePaymentReceived,
} from "../../../utils/paymentManagementStorage";
import CustomerPaymentSearch from "./CustomerPaymentSearch";
import styles from "./PaymentManagement.module.css";

const emptyCustomer = {
  consumerNo: "",
  customerName: "",
  fatherName: "",
  address: "",
  mobile: "",
};

function emptyForm() {
  const modes = getPaymentModeNames();
  return {
    date: formatPaymentDate(),
    ...emptyCustomer,
    amount: "",
    paymentMode: modes[0] || "Cash",
    referenceNo: "",
    remarks: "",
  };
}

function PaymentReceivedPage() {
  const [paymentModes, setPaymentModes] = useState(() => getPaymentModeNames());
  const [rows, setRows] = useState(() => listReceivedToday());
  const [showForm, setShowForm] = useState(true);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const refresh = () => setRows(listReceivedToday());

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

  const onSave = () => {
    if (!form.consumerNo?.trim()) {
      window.alert("Customer select karein.");
      return;
    }
    const amount = Number(form.amount);
    if (!(amount > 0)) {
      window.alert("Valid received amount enter karein.");
      return;
    }
    const payload = { ...form, amount };
    if (editId) {
      updatePaymentReceived(editId, payload);
    } else {
      addPaymentReceived(payload);
    }
    setForm(emptyForm());
    setEditId(null);
    refresh();
  };

  const onEdit = (row) => {
    setEditId(row.id);
    setForm({
      date: row.date,
      consumerNo: row.consumerNo,
      customerName: row.customerName,
      fatherName: row.fatherName,
      address: row.address,
      mobile: row.mobile,
      amount: String(row.amount),
      paymentMode: row.paymentMode,
      referenceNo: row.referenceNo,
      remarks: row.remarks,
    });
    setShowForm(true);
  };

  const onDelete = (id) => {
    if (!window.confirm("Is payment entry ko delete karein?")) return;
    deletePaymentReceived(id);
    refresh();
  };

  const total = sumReceivedToday();

  return (
    <div className={showForm ? styles.showForm : undefined}>
      <div className={styles.breadcrumb}>
        Home › <strong>Payments</strong> › Payment Received
      </div>
      <div className={styles.pageHead}>
        <div>
          <h1>Payment Received</h1>
          <p>Customer se aayi payment record karein — Customer All Detail payment section me sync hoti hai.</p>
        </div>
        <button
          type="button"
          className={styles.btnAddReceived}
          onClick={() => {
            setShowForm(true);
            setEditId(null);
            setForm(emptyForm());
          }}
        >
          + Add Payment Received
        </button>
      </div>

      <section className={`${styles.formPanel} ${styles.hiddenForm}`}>
        <div className={styles.formGrid}>
          <label>
            Date
            <input
              type="text"
              value={form.date}
              placeholder="DD/MM/YYYY"
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </label>
          <div className={styles.span2}>
            <CustomerPaymentSearch
              value={form}
              onSelect={(c) => setForm((f) => ({ ...f, ...c }))}
            />
          </div>
          <label>
            Received Amount (₹)
            <input
              type="number"
              min="0"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </label>
          <label>
            Payment Mode / Remark
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
            {editId ? "Update Payment" : "Save Payment Received"}
          </button>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => {
              setEditId(null);
              setForm(emptyForm());
            }}
          >
            Clear
          </button>
        </div>
        <p className={styles.note}>
          Note: Payment Customer All Detail &gt; Payment Section me automatically add ho jati hai.
        </p>
      </section>

      <section className={styles.tablePanel}>
        <div className={styles.tableTitle}>TODAY&apos;S PAYMENT RECEIVED LIST</div>
        <div className={styles.tableScroll}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>SR.</th>
                <th>DATE</th>
                <th>CUSTOMER NAME</th>
                <th>FATHER / HUSBAND</th>
                <th>ADDRESS</th>
                <th>RECEIVED (₹)</th>
                <th>PAYMENT MODE</th>
                <th>REFERENCE NO</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "1.5rem" }}>
                    Aaj koi payment received entry nahi.
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={row.id}>
                    <td>{i + 1}</td>
                    <td>{row.date}</td>
                    <td>{row.customerName}</td>
                    <td>{row.fatherName}</td>
                    <td>{row.address}</td>
                    <td className={`${styles.num} ${styles.amountIn}`}>
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
                <td colSpan={5}>TOTAL RECEIVED TODAY</td>
                <td className={`${styles.num} ${styles.amountIn}`} colSpan={4}>
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

export default PaymentReceivedPage;
