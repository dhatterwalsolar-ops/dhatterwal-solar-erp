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
import {
  clearCaseDeleteOtpSession,
  getCaseDeleteOtpMobileDisplay,
  sendCaseDeleteOtp,
  verifyCaseDeleteOtp,
} from "../../../utils/caseDeleteOtp";
import {
  loadUpdateNameLoadRows,
  saveNameLoadOverride,
  saveUpdateNameLoadRows,
  upsertUpdateNameLoadRow,
} from "../../../utils/updateNameLoadStorage";
import styles from "./UpdateNameLoadSheet.module.css";

function UpdateNameLoadSheet() {
  const [rows, setRows] = useState(() => {
    const stored = loadUpdateNameLoadRows();
    if (stored.length) return stored;
    return [createEmptyUpdateNameLoadRow()];
  });
  const [query, setQuery] = useState("");
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null);
  const [deleteOtp, setDeleteOtp] = useState("");
  const [deleteOtpSent, setDeleteOtpSent] = useState(false);

  useEffect(() => {
    saveUpdateNameLoadRows(rows);
  }, [rows]);

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
    const saved = upsertUpdateNameLoadRow({ ...row, totalFees });

    const base = getBaseCustomer(row.consumerNo);
    if (row.subject === "Name Change" && row.customerName?.trim() && base) {
      if (row.customerName.trim() !== base.customerName) {
        saveNameLoadOverride(row.consumerNo, { customerName: row.customerName.trim() });
      }
    }
    if (row.subject === "Load Update" && row.newLoadKw?.trim()) {
      saveNameLoadOverride(row.consumerNo, { setupKw: row.newLoadKw.trim() });
    }

    if (totalFees > 0) {
      addCustomerPayment({
        sourceRef: `unl-${saved.id}`,
        consumerNo: row.consumerNo,
        date: row.date,
        amount: totalFees,
        category: PAYMENT_CATEGORIES.NAME_LOAD,
        label: row.subject,
        reference: row.reference,
        applicationNo: row.applicationNo,
      });
      notifyPaymentSync();
    }

    window.alert(
      `Saved — ${row.consumerNo}. Total Fees ₹${totalFees.toLocaleString("en-IN")} Payment Sheet & Customer All Detail me add ho gayi.`,
    );
  };

  const closeDeleteOtpModal = () => {
    setPendingDeleteRow(null);
    setDeleteOtp("");
    setDeleteOtpSent(false);
    clearCaseDeleteOtpSession();
  };

  const requestDeleteRow = (row) => {
    const label = row.consumerNo?.trim() || row.customerName?.trim() || "ye row";
    setPendingDeleteRow({ row, label });
    setDeleteOtp("");
    setDeleteOtpSent(false);
    clearCaseDeleteOtpSession();
  };

  const handleSendDeleteOtp = () => {
    const { demoOtp } = sendCaseDeleteOtp();
    setDeleteOtpSent(true);
    window.alert(
      `Delete OTP ${getCaseDeleteOtpMobileDisplay()} par bheja gaya:\n\n${demoOtp}\n\n(Backend connect hone par asli SMS aayega.)`,
    );
  };

  const performDeleteRow = (row) => {
    if (row?.id) {
      removePaymentBySourceRef(`unl-${row.id}`);
      notifyPaymentSync();
    }
    setRows((prev) => {
      const next = prev.filter((r) => r !== row && r.id !== row.id);
      return next.length ? next : [createEmptyUpdateNameLoadRow()];
    });
  };

  const confirmDeleteWithOtp = () => {
    if (!deleteOtpSent) {
      window.alert("Pehle Send OTP dabayein.");
      return;
    }
    if (!verifyCaseDeleteOtp(deleteOtp)) {
      window.alert("Galat OTP. Send OTP ke baad alert me diya gaya OTP enter karein.");
      return;
    }
    if (pendingDeleteRow?.row) {
      performDeleteRow(pendingDeleteRow.row);
    }
    closeDeleteOtpModal();
  };

  return (
    <section className={styles.sheet}>
      {pendingDeleteRow ? (
        <div
          className={styles.deleteModalBackdrop}
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDeleteOtpModal();
          }}
        >
          <div className={styles.deleteModal} role="dialog" aria-labelledby="unl-delete-otp-title">
            <h2 id="unl-delete-otp-title" className={styles.deleteModalTitle}>
              Row delete — OTP verify
            </h2>
            <p className={styles.deleteModalText}>
              &quot;{pendingDeleteRow.label}&quot; delete karne se pehle registered mobile par OTP
              verify karein.
            </p>
            <p className={styles.deleteModalMobile}>
              OTP bheja jayega: {getCaseDeleteOtpMobileDisplay()}
            </p>
            <div className={styles.deleteOtpRow}>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6 digit OTP"
                value={deleteOtp}
                onChange={(e) => setDeleteOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className={styles.deleteOtpInput}
              />
              <button type="button" className={styles.deleteSendOtpBtn} onClick={handleSendDeleteOtp}>
                Send OTP
              </button>
            </div>
            <div className={styles.deleteModalActions}>
              <button type="button" className={styles.btnOutline} onClick={closeDeleteOtpModal}>
                Cancel
              </button>
              <button type="button" className={styles.deleteConfirmBtn} onClick={confirmDeleteWithOtp}>
                Verify &amp; Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <header className={styles.toolbar}>
        <div>
          <h1>Update Name / Load</h1>
          <p>
            Consumer No. par detail auto aati hai. Save par fees Payment Sheet me jati hai aur
            Customer All Detail me Name/Load + Sale payments ke saath total dikhega. Delete sirf
            OTP verify ke baad.
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
                    <button
                      type="button"
                      className={styles.btnDelete}
                      onClick={() => requestDeleteRow(row)}
                      title="OTP verify ke baad delete"
                    >
                      Delete
                    </button>
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
