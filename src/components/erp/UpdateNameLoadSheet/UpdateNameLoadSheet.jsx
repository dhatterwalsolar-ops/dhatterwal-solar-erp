import { useEffect, useMemo, useState } from "react";
import { SETUP_KW_OPTIONS } from "../../../constants/loanCase";
import {
  UPDATE_NAME_LOAD_SUBJECTS,
  calcTotalFees,
  createEmptyUpdateNameLoadRow,
} from "../../../constants/updateNameLoad";
import { lookupCustomer, getBaseCustomer } from "../../../constants/customerRegistry";
import {
  addCustomerPayment,
  notifyPaymentSync,
  PAYMENT_CATEGORIES,
  removePaymentBySourceRef,
} from "../../../utils/customerPaymentLedger";
import { getAuthSession } from "../../../utils/authSession";
import { canChangeOrDelete } from "../../../utils/erpAccess";
import { getPaymentModeNames } from "../../../utils/paymentAccountStorage";
import {
  addPaymentGiven,
  deletePaymentGivenBySourceRef,
} from "../../../utils/paymentManagementStorage";
import {
  loadUpdateNameLoadRows,
  saveNameLoadOverride,
  saveUpdateNameLoadRows,
  upsertUpdateNameLoadRow,
} from "../../../utils/updateNameLoadStorage";
import styles from "./UpdateNameLoadSheet.module.css";

function UpdateNameLoadSheet() {
  const canDelete = canChangeOrDelete(getAuthSession());
  const [rows, setRows] = useState(() => {
    const stored = loadUpdateNameLoadRows();
    if (stored.length) return stored;
    return [createEmptyUpdateNameLoadRow()];
  });
  const [query, setQuery] = useState("");
  const [accountsTick, setAccountsTick] = useState(0);

  const paymentAccounts = useMemo(() => getPaymentModeNames(), [accountsTick]);

  useEffect(() => {
    saveUpdateNameLoadRows(rows);
  }, [rows]);

  useEffect(() => {
    const refresh = () => setAccountsTick((n) => n + 1);
    window.addEventListener("dhatterwal-payment-accounts-sync", refresh);
    return () => window.removeEventListener("dhatterwal-payment-accounts-sync", refresh);
  }, []);

  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((row) =>
      [
        row.consumerNo,
        row.customerName,
        row.subject,
        row.applicationNo,
        row.reference,
        row.paymentAccount,
      ].some((v) => String(v ?? "").toLowerCase().includes(q)),
    );
  }, [query, rows]);

  const patchRow = (rowRef, patch) => {
    setRows((prev) =>
      prev.map((row) => (row === rowRef ? { ...row, ...patch } : row)),
    );
  };

  const syncConsumer = (rowRef, consumerNo) => {
    const customer = lookupCustomer(consumerNo);
    if (!customer) {
      patchRow(rowRef, {
        consumerNo,
        customerName: "",
        fatherName: "",
        address: "",
        mobile: "",
      });
      return;
    }
    patchRow(rowRef, {
      consumerNo: customer.consumerNo,
      customerName: customer.customerName,
      fatherName: customer.fatherName,
      address: customer.address,
      mobile: customer.mobile || "",
    });
  };

  const saveRow = (row) => {
    if (!row.consumerNo?.trim()) {
      window.alert("Consumer Number zaroori hai.");
      return;
    }
    if (!row.subject) {
      window.alert("Subject select karein — Name Change ya Load Update.");
      return;
    }

    const totalFees = calcTotalFees(row.fees, row.affidavitFee);
    const debitAccount = String(row.paymentAccount || "").trim();

    if (totalFees > 0 && !debitAccount) {
      window.alert(
        "Fees / Affidavit Fee ke liye Payment Debit Account select karein\n" +
          "(Azad Credit Card, Sonu Credit Card, HDFC, Canara, Cash… — Settings → Payment Types).",
      );
      return;
    }

    const saved = upsertUpdateNameLoadRow({ ...row, totalFees, paymentAccount: debitAccount });

    const base = getBaseCustomer(row.consumerNo);
    if (row.subject === "Name Change" && row.customerName?.trim() && base) {
      if (row.customerName.trim() !== base.customerName) {
        saveNameLoadOverride(row.consumerNo, { customerName: row.customerName.trim() });
      }
    }
    if (row.subject === "Load Update" && row.newLoadKw?.trim()) {
      saveNameLoadOverride(row.consumerNo, { setupKw: row.newLoadKw.trim() });
    }

    const ledgerRef = `unl-${saved.id}`;
    const givenRef = `pg-unl-${saved.id}`;

    if (totalFees > 0) {
      /* 1) Customer ledger — Customer All Detail Name/Load Fees */
      addCustomerPayment({
        sourceRef: ledgerRef,
        consumerNo: row.consumerNo,
        date: row.date,
        amount: totalFees,
        category: PAYMENT_CATEGORIES.NAME_LOAD,
        label: row.subject,
        reference: row.reference,
        applicationNo: row.applicationNo,
        paymentMode: debitAccount,
        fees: Number(row.fees) || 0,
        affidavitFee: Number(row.affidavitFee) || 0,
      });

      /* 2) Payment Given — selected account se debit */
      addPaymentGiven({
        id: givenRef,
        sourceRef: givenRef,
        date: row.date,
        partyName: `${row.customerName || row.consumerNo} (${row.subject})`,
        partyType: "Name/Load Fee",
        amount: totalFees,
        paymentMode: debitAccount,
        fundingType: "account",
        referenceNo: row.applicationNo || row.reference || row.consumerNo,
        remarks: `Fees ₹${Number(row.fees) || 0} + Affidavit ₹${Number(row.affidavitFee) || 0} — ${row.consumerNo}`,
      });
      notifyPaymentSync();
    } else {
      removePaymentBySourceRef(ledgerRef);
      deletePaymentGivenBySourceRef(givenRef);
      notifyPaymentSync();
    }

    setRows((prev) => prev.map((r) => (r.id === saved.id || r === row ? { ...saved } : r)));

    window.alert(
      `Saved — ${row.consumerNo}\n` +
        `Total Fees ₹${totalFees.toLocaleString("en-IN")}` +
        (totalFees > 0
          ? `\nDebit account: ${debitAccount}\n` +
            `→ Payment Given me debit\n` +
            `→ Customer (${row.customerName || row.consumerNo}) Name/Load Fees me feed`
          : ""),
    );
  };

  const requestDeleteRow = (row) => {
    if (!canDelete) {
      window.alert("Delete sirf Admin kar sakta hai.");
      return;
    }
    const label = row.consumerNo?.trim() || row.customerName?.trim() || "ye row";
    if (!window.confirm(`"${label}" ko sheet se delete karein?`)) return;
    if (row?.id) {
      removePaymentBySourceRef(`unl-${row.id}`);
      deletePaymentGivenBySourceRef(`pg-unl-${row.id}`);
      notifyPaymentSync();
    }
    setRows((prev) => {
      const next = prev.filter((r) => r !== row && r.id !== row.id);
      return next.length ? next : [createEmptyUpdateNameLoadRow()];
    });
  };

  return (
    <section className={styles.sheet}>
      <header className={styles.toolbar}>
        <div>
          <h1>Update Name / Load</h1>
          <p>
            Fees + Affidavit Fee save par <strong>Payment Debit Account</strong> se Payment Given
            me debit hoga (Azad / Sonu Credit Card, HDFC, Canara, Cash…). Us customer ke Name/Load
            Fees Customer All Detail + Payment Sheet me automatic feed. Delete sirf Admin.
          </p>
        </div>
        <div className={styles.toolbarActions}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className={styles.search}
          />
          <button
            type="button"
            className={styles.btnAdd}
            onClick={() => setRows((prev) => [createEmptyUpdateNameLoadRow(), ...prev])}
          >
            + Add Row
          </button>
        </div>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Sr. No.</th>
              <th>Date</th>
              <th>Consumer Number</th>
              <th>Consumer Name</th>
              <th>Consumer Father Name</th>
              <th>Address</th>
              <th>Mobile Number</th>
              <th>Subject</th>
              <th>Application No.</th>
              <th>Fees</th>
              <th>Affidavit Fee</th>
              <th>Total Fees</th>
              <th>Payment Debit Account</th>
              <th>Reference</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, index) => {
              const totalFees = calcTotalFees(row.fees, row.affidavitFee);
              const nameEditable = row.subject === "Name Change";

              return (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>
                    <input
                      className={styles.cellInput}
                      value={row.date}
                      onChange={(e) => patchRow(row, { date: e.target.value })}
                      placeholder="DD/MM/YYYY"
                    />
                  </td>
                  <td>
                    <input
                      className={`${styles.cellInput} ${styles.idInput}`}
                      value={row.consumerNo}
                      onChange={(e) => patchRow(row, { consumerNo: e.target.value })}
                      onBlur={(e) => syncConsumer(row, e.target.value)}
                      placeholder="Consumer No."
                    />
                  </td>
                  <td>
                    <input
                      className={nameEditable ? styles.cellInput : styles.readOnly}
                      value={row.customerName}
                      onChange={(e) => patchRow(row, { customerName: e.target.value })}
                      readOnly={!nameEditable}
                      title={nameEditable ? "Name Change ke liye edit karein" : "Auto from case"}
                    />
                  </td>
                  <td>
                    <input className={styles.readOnly} value={row.fatherName} readOnly />
                  </td>
                  <td>
                    <input className={styles.readOnly} value={row.address} readOnly />
                  </td>
                  <td>
                    <input
                      className={styles.cellInput}
                      value={row.mobile}
                      onChange={(e) => patchRow(row, { mobile: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      className={styles.cellSelect}
                      value={row.subject}
                      onChange={(e) => patchRow(row, { subject: e.target.value })}
                    >
                      <option value="">Select</option>
                      {UPDATE_NAME_LOAD_SUBJECTS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    {row.subject === "Load Update" ? (
                      <select
                        className={styles.loadSelect}
                        value={row.newLoadKw}
                        onChange={(e) => patchRow(row, { newLoadKw: e.target.value })}
                      >
                        <option value="">New load (kW)</option>
                        {SETUP_KW_OPTIONS.map((kw) => (
                          <option key={kw} value={kw}>
                            {kw}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </td>
                  <td>
                    <input
                      className={styles.cellInput}
                      value={row.applicationNo}
                      onChange={(e) => patchRow(row, { applicationNo: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className={styles.numInput}
                      value={row.fees}
                      onChange={(e) => patchRow(row, { fees: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className={styles.numInput}
                      value={row.affidavitFee}
                      onChange={(e) => patchRow(row, { affidavitFee: e.target.value })}
                    />
                  </td>
                  <td className={styles.totalCell}>
                    ₹{totalFees.toLocaleString("en-IN")}
                  </td>
                  <td>
                    <select
                      className={styles.cellSelect}
                      value={row.paymentAccount || ""}
                      onChange={(e) => patchRow(row, { paymentAccount: e.target.value })}
                      title="Payment Sheet accounts — fees isi se debit"
                    >
                      <option value="">Select account…</option>
                      {paymentAccounts.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      className={styles.cellInput}
                      value={row.reference}
                      onChange={(e) => patchRow(row, { reference: e.target.value })}
                    />
                  </td>
                  <td className={styles.actionCell}>
                    <button type="button" className={styles.btnSave} onClick={() => saveRow(row)}>
                      Save
                    </button>
                    {canDelete ? (
                      <button
                        type="button"
                        className={styles.btnDelete}
                        onClick={() => requestDeleteRow(row)}
                        title="Admin only — delete"
                      >
                        Delete
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default UpdateNameLoadSheet;
