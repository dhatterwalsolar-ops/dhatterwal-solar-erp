import { useMemo, useState } from "react";
import {
  CUSTOMER_DETAIL_SAMPLE_ROWS,
  computePaymentTotals,
  createEmptyCustomerDetailRow,
} from "../../../constants/customerDetail";
import { lookupCustomerDetailProfile } from "../../../constants/customerRegistry";
import styles from "./CustomerDetailSheet.module.css";

function formatMoney(num) {
  return `₹${num.toLocaleString("en-IN")}`;
}

function CustomerDetailSheet() {
  const [rows, setRows] = useState(() =>
    CUSTOMER_DETAIL_SAMPLE_ROWS.map((row) => ({ ...row })),
  );
  const [query, setQuery] = useState("");

  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((row) =>
      Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(q)),
    );
  }, [query, rows]);

  const updateCell = (rowRef, key, value) => {
    setRows((prev) =>
      prev.map((row) => (row === rowRef ? { ...row, [key]: value } : row)),
    );
  };

  const syncFromCaseSheets = (rowRef, consumerNo) => {
    const profile = lookupCustomerDetailProfile(consumerNo);

    setRows((prev) =>
      prev.map((row) => {
        if (row !== rowRef) return row;

        if (!profile) {
          return {
            ...row,
            consumerNo,
            customerName: "",
            address: "",
            amountType: "",
          };
        }

        const isLoan = profile.amountType === "Loan";
        const remark = profile.defaultPaymentRemark;

        return {
          ...row,
          consumerNo: profile.consumerNo,
          customerName: profile.customerName,
          address: profile.address,
          amountType: profile.amountType,
          receivedRemark: isLoan ? remark : row.receivedRemark,
          secondPaymentRemark: isLoan ? remark : row.secondPaymentRemark,
        };
      }),
    );
  };

  const isRemarkReadOnly = (row) => row.amountType === "Loan";

  return (
    <section className={styles.sheet}>
      <header className={styles.toolbar}>
        <div>
          <h1>Customer All Detail</h1>
          <p>
            Enter Consumer Number — name, address, and Cash/Loan type load from Loan Case
            or Cash Case. Loan rows auto-fill bank name &amp; IFSC in payment remarks;
            Cash remarks are manual. Totals calculate automatically.
          </p>
        </div>
        <div className={styles.toolbarActions}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search consumer, name..."
            className={styles.search}
          />
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setRows((prev) => [...prev, createEmptyCustomerDetailRow()])}
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
              <th>Consumer Number</th>
              <th>Customer Name</th>
              <th>Address</th>
              <th>Amount (₹)</th>
              <th>Amount Type</th>
              <th>Received Amount</th>
              <th>Received Date</th>
              <th>Received Remark</th>
              <th>2nd Payment Received</th>
              <th>2nd Payment Date</th>
              <th>2nd Payment Remark</th>
              <th>Total Payment Received</th>
              <th>Total Pending Payment</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const rowIndex = rows.indexOf(row);
              const { totalReceived, pending } = computePaymentTotals(row);
              const remarkLocked = isRemarkReadOnly(row);

              return (
                <tr key={`${row.consumerNo || "cust"}-${rowIndex}`}>
                  <td>{rowIndex + 1}</td>
                  <td>
                    <input
                      className={`${styles.cellInput} ${styles.manualIdInput}`}
                      value={row.consumerNo}
                      onChange={(e) => updateCell(row, "consumerNo", e.target.value)}
                      onBlur={(e) => syncFromCaseSheets(row, e.target.value)}
                      placeholder="Consumer No."
                    />
                  </td>
                  <td>
                    <input className={styles.readOnly} value={row.customerName} readOnly />
                  </td>
                  <td>
                    <input className={styles.readOnly} value={row.address} readOnly />
                  </td>
                  <td>
                    <input
                      className={styles.cellInput}
                      value={row.amount}
                      onChange={(e) => updateCell(row, "amount", e.target.value)}
                      placeholder="Total amount"
                    />
                  </td>
                  <td>
                    <input className={styles.readOnly} value={row.amountType} readOnly />
                  </td>
                  <td>
                    <input
                      className={styles.cellInput}
                      value={row.receivedAmount}
                      onChange={(e) => updateCell(row, "receivedAmount", e.target.value)}
                      placeholder="0"
                    />
                  </td>
                  <td>
                    <input
                      className={styles.cellInput}
                      value={row.receivedDate}
                      onChange={(e) => updateCell(row, "receivedDate", e.target.value)}
                      placeholder="DD/MM/YYYY"
                    />
                  </td>
                  <td>
                    <input
                      className={remarkLocked ? styles.readOnly : styles.cellInput}
                      value={row.receivedRemark}
                      onChange={(e) => updateCell(row, "receivedRemark", e.target.value)}
                      readOnly={remarkLocked}
                      placeholder={remarkLocked ? "Auto (Loan bank)" : "Manual remark"}
                    />
                  </td>
                  <td>
                    <input
                      className={styles.cellInput}
                      value={row.secondReceivedAmount}
                      onChange={(e) => updateCell(row, "secondReceivedAmount", e.target.value)}
                      placeholder="0"
                    />
                  </td>
                  <td>
                    <input
                      className={styles.cellInput}
                      value={row.secondReceivedDate}
                      onChange={(e) => updateCell(row, "secondReceivedDate", e.target.value)}
                      placeholder="DD/MM/YYYY"
                    />
                  </td>
                  <td>
                    <input
                      className={remarkLocked ? styles.readOnly : styles.cellInput}
                      value={row.secondPaymentRemark}
                      onChange={(e) => updateCell(row, "secondPaymentRemark", e.target.value)}
                      readOnly={remarkLocked}
                      placeholder={remarkLocked ? "Auto (Loan bank)" : "Manual remark"}
                    />
                  </td>
                  <td>
                    <input
                      className={`${styles.readOnly} ${styles.totalReceived}`}
                      value={formatMoney(totalReceived)}
                      readOnly
                    />
                  </td>
                  <td>
                    <input
                      className={`${styles.readOnly} ${styles.totalPending}`}
                      value={formatMoney(pending)}
                      readOnly
                    />
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

export default CustomerDetailSheet;
