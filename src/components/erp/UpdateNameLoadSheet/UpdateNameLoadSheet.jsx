import { useEffect, useMemo, useState } from "react";
import { SETUP_KW_OPTIONS } from "../../../constants/loanCase";
import {
  UPDATE_NAME_LOAD_SUBJECTS,
  calcTotalFees,
  createEmptyUpdateNameLoadRow,
  isNameLoadPaymentLocked,
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

function parseEnGbDate(value) {
  const parts = String(value || "")
    .trim()
    .split(/[/-]/);
  if (parts.length !== 3) return null;
  const [dd, mm, yyyy] = parts.map((p) => Number(p));
  if (!dd || !mm || !yyyy) return null;
  const d = new Date(yyyy, mm - 1, dd);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Loan/Cash jaisa — nayi entry upar. */
function sortNameLoadNewestFirst(list) {
  return [...(list || [])].sort((a, b) => {
    const da = parseEnGbDate(a?.date)?.getTime() ?? 0;
    const db = parseEnGbDate(b?.date)?.getTime() ?? 0;
    if (db !== da) return db - da;
    return String(b?.id || "").localeCompare(String(a?.id || ""));
  });
}

function UpdateNameLoadSheet() {
  const canDelete = canChangeOrDelete(getAuthSession());
  const [rows, setRows] = useState(() => {
    const stored = loadUpdateNameLoadRows();
    if (stored.length) return sortNameLoadNewestFirst(stored);
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
    const list = sortNameLoadNewestFirst(rows);
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter((row) =>
      [
        row.consumerNo,
        row.customerName,
        row.fatherName,
        row.address,
        row.mobile,
        row.subject,
        row.applicationNo,
        row.reference,
        row.paymentAccount,
      ].some((v) => String(v ?? "").toLowerCase().includes(q)),
    );
  }, [query, rows]);

  const patchRow = (rowRef, patch) => {
    setRows((prev) =>
      prev.map((row) => (row === rowRef || row.id === rowRef.id ? { ...row, ...patch } : row)),
    );
  };

  const addEntry = () => {
    const empty = createEmptyUpdateNameLoadRow();
    empty.date = new Date().toLocaleDateString("en-GB");
    setRows((prev) => sortNameLoadNewestFirst([empty, ...prev]));
  };

  /** Loan/Cash jaisa: Consumer No. pe auto-fill; naya consumer ho to manually fill. */
  const syncConsumer = (rowRef, consumerNo) => {
    const typed = String(consumerNo || "").trim();
    const customer = lookupCustomer(typed);
    if (!customer) {
      patchRow(rowRef, { consumerNo: typed.toUpperCase() });
      return;
    }
    patchRow(rowRef, {
      consumerNo: customer.consumerNo,
      customerName: customer.customerName || rowRef.customerName || "",
      fatherName: customer.fatherName || rowRef.fatherName || "",
      address: customer.address || rowRef.address || "",
      mobile: customer.mobile || rowRef.mobile || "",
    });
  };

  const saveRow = (row) => {
    if (!row.consumerNo?.trim()) {
      window.alert("Consumer Number zaroori hai.");
      return;
    }
    if (!row.customerName?.trim()) {
      window.alert("Consumer Name zaroori hai — Loan/Cash ki tarah fill karein.");
      return;
    }
    if (!row.subject) {
      window.alert("Subject select karein — Name Change ya Load Update.");
      return;
    }
    if (row.subject === "Load Update" && !String(row.newLoadKw || "").trim()) {
      window.alert("Load Update ke liye New load (kW) select karein.");
      return;
    }

    const paymentLocked = isNameLoadPaymentLocked(row);
    const totalFees = calcTotalFees(row.fees, row.affidavitFee);
    const debitAccount = String(row.paymentAccount || "").trim();

    if (!paymentLocked && totalFees > 0 && !debitAccount) {
      window.alert(
        "Fees / Affidavit Fee ke liye Payment Debit Account select karein\n" +
          "(Azad Credit Card, Sonu Credit Card, HDFC, Canara, Cash… — Settings → Payment Types).",
      );
      return;
    }

    const saved = upsertUpdateNameLoadRow({ ...row, totalFees, paymentAccount: debitAccount });

    const base = getBaseCustomer(row.consumerNo);
    if (row.subject === "Name Change" && row.customerName?.trim()) {
      if (!base || row.customerName.trim() !== base.customerName) {
        saveNameLoadOverride(row.consumerNo, { customerName: row.customerName.trim() });
      }
    }
    if (row.subject === "Load Update" && row.newLoadKw?.trim()) {
      saveNameLoadOverride(row.consumerNo, { setupKw: row.newLoadKw.trim() });
    }

    const ledgerRef = `unl-${saved.id}`;
    const givenRef = `pg-unl-${saved.id}`;

    /* Payment sirf pehli baar save pe — dobara fill/update nahi */
    if (!paymentLocked && totalFees > 0) {
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
    }

    setRows((prev) => prev.map((r) => (r.id === saved.id || r === row ? { ...saved } : r)));

    window.alert(
      paymentLocked
        ? `Updated — ${row.consumerNo}\nPayment pehle save ho chuka hai — Fees / Account change nahi hoga.`
        : `Saved — ${row.consumerNo}\n` +
            `Total Fees ₹${totalFees.toLocaleString("en-IN")}` +
            (totalFees > 0
              ? `\nDebit account: ${debitAccount}\n` +
                `→ Payment Given me debit\n` +
                `→ Customer Name/Load Fees me feed\n` +
                `(Ab payment dobara change nahi hoga)`
              : "\n(Ab payment fields lock — dobara fill/update nahi)"),
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
            Loan / Cash Case jaisi entry: <strong>+ Add Entry</strong> → Date, Consumer No., Name,
            Father, Address, Mobile fill karein. Consumer Loan/Cash me ho to auto-fill; naya
            consumer ho to manually likhein. Save par fees Payment Debit Account se debit + lock.
            Delete sirf Admin.
          </p>
        </div>
        <div className={styles.toolbarActions}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search consumer / name..."
            className={styles.search}
          />
          <button type="button" className={styles.btnAdd} onClick={addEntry}>
            + Add Entry
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
              const payLocked = isNameLoadPaymentLocked(row);
              const srNo = filteredRows.length - index;

              return (
                <tr key={row.id} className={payLocked ? styles.rowLocked : undefined}>
                  <td>
                    {srNo}
                    {payLocked ? (
                      <span className={styles.lockedBadge} title="Payment locked after save">
                        Locked
                      </span>
                    ) : null}
                  </td>
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
                      className={styles.cellInput}
                      value={row.customerName}
                      onChange={(e) => patchRow(row, { customerName: e.target.value })}
                      placeholder="Customer name"
                      title="Loan/Cash jaisa — manually fill ya Consumer No. se auto"
                    />
                  </td>
                  <td>
                    <input
                      className={styles.cellInput}
                      value={row.fatherName}
                      onChange={(e) => patchRow(row, { fatherName: e.target.value })}
                      placeholder="Father / Husband"
                    />
                  </td>
                  <td>
                    <input
                      className={styles.cellInput}
                      value={row.address}
                      onChange={(e) => patchRow(row, { address: e.target.value })}
                      placeholder="Address"
                    />
                  </td>
                  <td>
                    <input
                      className={styles.cellInput}
                      value={row.mobile}
                      onChange={(e) => patchRow(row, { mobile: e.target.value })}
                      placeholder="Mobile"
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
                      className={payLocked ? styles.readOnly : styles.numInput}
                      value={row.fees}
                      onChange={(e) => {
                        if (payLocked) return;
                        patchRow(row, { fees: e.target.value });
                      }}
                      readOnly={payLocked}
                      title={
                        payLocked
                          ? "Save ke baad Fees change nahi ho sakti"
                          : "Fees"
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className={payLocked ? styles.readOnly : styles.numInput}
                      value={row.affidavitFee}
                      onChange={(e) => {
                        if (payLocked) return;
                        patchRow(row, { affidavitFee: e.target.value });
                      }}
                      readOnly={payLocked}
                      title={
                        payLocked
                          ? "Save ke baad Affidavit Fee change nahi ho sakti"
                          : "Affidavit Fee"
                      }
                    />
                  </td>
                  <td className={styles.totalCell}>
                    ₹{totalFees.toLocaleString("en-IN")}
                  </td>
                  <td>
                    <select
                      className={payLocked ? styles.readOnlySelect : styles.cellSelect}
                      value={row.paymentAccount || ""}
                      onChange={(e) => {
                        if (payLocked) return;
                        patchRow(row, { paymentAccount: e.target.value });
                      }}
                      disabled={payLocked}
                      title={
                        payLocked
                          ? "Save ke baad Payment Account change nahi hoga"
                          : "Payment Sheet accounts — fees isi se debit"
                      }
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
