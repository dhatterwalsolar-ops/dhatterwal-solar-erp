import { useEffect, useMemo, useState } from "react";
import { BACKUP_ENTRY_SYNC_EVENT } from "../../../constants/backupEntry";
import {
  patchBackupFromCustomerRow,
  upsertBackupEntry,
} from "../../../utils/backupEntryStorage";
import {
  computePaymentTotals,
  parseAmountValue,
} from "../../../constants/customerDetail";
import {
  CUSTOMER_PAYMENT_SYNC_EVENT,
  computeGrandCustomerPayments,
} from "../../../utils/customerPaymentLedger";
import {
  loadCustomerDetailRows,
  saveCustomerDetailRows,
} from "../../../utils/customerDetailStorage";
import {
  CUSTOMER_DETAIL_SALE_SYNC_EVENT,
  syncCustomerDetailFromSaleSheet,
} from "../../../utils/customerDetailSaleSync";
import { SALE_CASE_SYNC_EVENT } from "../../../utils/saleCaseSync";
import styles from "./CustomerDetailSheet.module.css";

function formatMoney(num) {
  return `₹${num.toLocaleString("en-IN")}`;
}

function CustomerDetailSheet() {
  const [rows, setRows] = useState(() => {
    syncCustomerDetailFromSaleSheet({ dispatchEvent: false });
    return loadCustomerDetailRows();
  });
  const [query, setQuery] = useState("");
  const [ledgerTick, setLedgerTick] = useState(0);

  useEffect(() => {
    saveCustomerDetailRows(rows);
  }, [rows]);

  useEffect(() => {
    const refreshFromSale = () => {
      syncCustomerDetailFromSaleSheet({ dispatchEvent: false });
      setRows(loadCustomerDetailRows());
    };
    window.addEventListener(BACKUP_ENTRY_SYNC_EVENT, refreshFromSale);
    window.addEventListener(SALE_CASE_SYNC_EVENT, refreshFromSale);
    window.addEventListener(CUSTOMER_DETAIL_SALE_SYNC_EVENT, refreshFromSale);
    return () => {
      window.removeEventListener(BACKUP_ENTRY_SYNC_EVENT, refreshFromSale);
      window.removeEventListener(SALE_CASE_SYNC_EVENT, refreshFromSale);
      window.removeEventListener(CUSTOMER_DETAIL_SALE_SYNC_EVENT, refreshFromSale);
    };
  }, []);

  useEffect(() => {
    const onPaymentSync = () => setLedgerTick((n) => n + 1);
    window.addEventListener(CUSTOMER_PAYMENT_SYNC_EVENT, onPaymentSync);
    return () => window.removeEventListener(CUSTOMER_PAYMENT_SYNC_EVENT, onPaymentSync);
  }, []);

  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((row) =>
      Object.values(row).some((value) => String(value ?? "").toLowerCase().includes(q)),
    );
  }, [query, rows]);

  const updateCell = (rowRef, key, value) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row !== rowRef) return row;
        const next = { ...row, [key]: value };
        if (row.isBackupEntry && row.entryId) {
          upsertBackupEntry(patchBackupFromCustomerRow(next));
        }
        return next;
      }),
    );
  };

  const isRemarkReadOnly = (row) => row.amountType === "Loan" && !row.isBackupEntry;

  return (
    <section className={styles.sheet}>
      <header className={styles.toolbar}>
        <div>
          <h1>Customer All Detail</h1>
          <p>
            Yeh sheet Sale Sheet ki mirror hai — same rows, same order. Nayi/extra row yahan add nahi
            hoti; Sale me jo entry (ya Backup Entry) hai wahi yahan dikhegi. Payments yahan edit kar
            sakte ho; <strong>Grand Total (All Payments)</strong> sab jagah se.
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
        </div>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Sr. No.</th>
              <th>Consumer Number</th>
              <th>Customer Name</th>
              <th>Customer Father/Husband Name</th>
              <th>Address</th>
              <th>Mobile Number</th>
              <th>Amount (₹)</th>
              <th>Amount Type</th>
              <th>Received Amount</th>
              <th>Received Date</th>
              <th>Received Remark</th>
              <th>2nd Payment Received</th>
              <th>2nd Payment Date</th>
              <th>2nd Payment Remark</th>
              <th>Total Payment Received</th>
              <th>Name/Load Fees</th>
              <th>Sale Payments</th>
              <th>Grand Total (All Payments)</th>
              <th>Total Pending Payment</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const rowIndex = rows.indexOf(row);
              void ledgerTick;
              const { totalReceived, pending } = computePaymentTotals(row);
              const { nameLoad, sale, grandTotal } = computeGrandCustomerPayments(row);
              const pendingAll = Math.max(
                0,
                parseAmountValue(row.amount) - grandTotal,
              );
              const identityLocked = Boolean(row.saleRowId) || row.isBackupEntry;
              const remarkLocked = isRemarkReadOnly(row);

              return (
                <tr
                  key={`${row.saleRowId || row.entryId || row.consumerNo || "cust"}-${rowIndex}`}
                  className={row.isBackupEntry ? styles.backupRow : undefined}
                >
                  <td>
                    {rowIndex + 1}
                    {row.isBackupEntry ? <span className={styles.backupBadge}>Backup</span> : null}
                  </td>
                  <td>
                    <input
                      className={identityLocked ? styles.readOnly : `${styles.cellInput} ${styles.manualIdInput}`}
                      value={row.consumerNo}
                      onChange={(e) => updateCell(row, "consumerNo", e.target.value)}
                      readOnly={identityLocked}
                      placeholder="Consumer No."
                    />
                  </td>
                  <td>
                    <input
                      className={row.isBackupEntry ? styles.cellInput : styles.readOnly}
                      value={row.customerName}
                      readOnly={!row.isBackupEntry}
                      onChange={(e) => updateCell(row, "customerName", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className={row.isBackupEntry ? styles.cellInput : styles.readOnly}
                      value={row.fatherName || ""}
                      readOnly={!row.isBackupEntry}
                      onChange={(e) => updateCell(row, "fatherName", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className={row.isBackupEntry ? styles.cellInput : styles.readOnly}
                      value={row.address}
                      readOnly={!row.isBackupEntry}
                      onChange={(e) => updateCell(row, "address", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className={row.isBackupEntry ? styles.cellInput : styles.readOnly}
                      value={row.mobile || ""}
                      readOnly={!row.isBackupEntry}
                      onChange={(e) => updateCell(row, "mobile", e.target.value)}
                    />
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
                    <input
                      className={row.isBackupEntry ? styles.cellInput : styles.readOnly}
                      value={row.amountType}
                      readOnly={!row.isBackupEntry}
                      onChange={(e) => updateCell(row, "amountType", e.target.value)}
                    />
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
                    <input className={styles.readOnly} value={formatMoney(nameLoad)} readOnly />
                  </td>
                  <td>
                    <input className={styles.readOnly} value={formatMoney(sale)} readOnly />
                  </td>
                  <td>
                    <input
                      className={`${styles.readOnly} ${styles.grandTotal}`}
                      value={formatMoney(grandTotal)}
                      readOnly
                      title="Manual received + Name/Load fees + Sale invoices"
                    />
                  </td>
                  <td>
                    <input
                      className={`${styles.readOnly} ${styles.totalPending}`}
                      value={formatMoney(pendingAll || pending)}
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
