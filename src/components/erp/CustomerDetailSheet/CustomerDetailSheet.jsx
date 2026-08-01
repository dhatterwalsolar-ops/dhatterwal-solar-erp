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
import { CASH_CASE_SYNC_EVENT } from "../../../utils/cashCaseStorage";
import { getAuthSession } from "../../../utils/authSession";
import {
  consumerMatchesReference,
  countCustomersForReference,
  getConsumerReference,
} from "../../../utils/consumerReference";
import {
  canEditCustomerDetailAmounts,
  getCustomerReferenceFilter,
} from "../../../utils/erpAccess";
import { LOAN_CASE_SYNC_EVENT } from "../../../utils/loanCaseStorage";
import { SALE_CASE_SYNC_EVENT } from "../../../utils/saleCaseSync";
import styles from "./CustomerDetailSheet.module.css";

function formatMoney(num) {
  return `₹${num.toLocaleString("en-IN")}`;
}

function rowReference(row) {
  return String(row.reference || getConsumerReference(row.consumerNo) || "").trim();
}

const AMOUNT_EDIT_KEYS = new Set([
  "amount",
  "receivedAmount",
  "receivedDate",
  "receivedRemark",
  "secondReceivedAmount",
  "secondReceivedDate",
  "secondPaymentRemark",
]);

function CustomerDetailSheet() {
  const session = getAuthSession();
  const referenceFilter = getCustomerReferenceFilter(session);
  const amountEditable = canEditCustomerDetailAmounts(session);
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
    window.addEventListener(LOAN_CASE_SYNC_EVENT, refreshFromSale);
    window.addEventListener(CASH_CASE_SYNC_EVENT, refreshFromSale);
    window.addEventListener(CUSTOMER_DETAIL_SALE_SYNC_EVENT, refreshFromSale);
    return () => {
      window.removeEventListener(BACKUP_ENTRY_SYNC_EVENT, refreshFromSale);
      window.removeEventListener(SALE_CASE_SYNC_EVENT, refreshFromSale);
      window.removeEventListener(LOAN_CASE_SYNC_EVENT, refreshFromSale);
      window.removeEventListener(CASH_CASE_SYNC_EVENT, refreshFromSale);
      window.removeEventListener(CUSTOMER_DETAIL_SALE_SYNC_EVENT, refreshFromSale);
    };
  }, []);

  useEffect(() => {
    const onPaymentSync = () => setLedgerTick((n) => n + 1);
    window.addEventListener(CUSTOMER_PAYMENT_SYNC_EVENT, onPaymentSync);
    return () => window.removeEventListener(CUSTOMER_PAYMENT_SYNC_EVENT, onPaymentSync);
  }, []);

  const scopedRows = useMemo(() => {
    if (!referenceFilter) return rows;
    return rows.filter((row) =>
      consumerMatchesReference(row.consumerNo, referenceFilter, row.reference),
    );
  }, [rows, referenceFilter]);

  const filteredRows = useMemo(() => {
    if (!query.trim()) return scopedRows;
    const q = query.toLowerCase();
    return scopedRows.filter((row) => {
      const ref = rowReference(row).toLowerCase();
      if (ref.includes(q)) return true;
      return Object.values(row).some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(q),
      );
    });
  }, [query, scopedRows]);

  const referenceMatchCount = useMemo(() => {
    if (referenceFilter) return scopedRows.length;
    if (!query.trim()) return 0;
    return countCustomersForReference(rows, query);
  }, [query, rows, referenceFilter, scopedRows]);

  const updateCell = (rowRef, key, value) => {
    if (!amountEditable && AMOUNT_EDIT_KEYS.has(key)) return;
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
  const amountFieldClass = amountEditable ? styles.cellInput : styles.readOnly;

  return (
    <section className={styles.sheet}>
      <header className={styles.toolbar}>
        <div>
          <h1>Customer All Detail</h1>
          <p>
            {referenceFilter
              ? `Sirf Reference "${referenceFilter}" wale customers (Loan/Cash entry ke hisaab se).`
              : "Yeh sheet Sale Sheet ki mirror hai. Reference Loan/Cash se aata hai — search me reference likho to uske customers dikhenge."}
          </p>
        </div>
        <div className={styles.toolbarActions}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              referenceFilter
                ? `Search in ${referenceFilter} customers...`
                : "Search consumer, name, reference..."
            }
            className={styles.search}
          />
          {referenceFilter || (query.trim() && referenceMatchCount > 0) ? (
            <span className={styles.refCount} title="Reference filter count">
              {referenceFilter ? `Your reference: ` : "Reference match: "}
              <strong>{referenceMatchCount}</strong> customer
              {referenceMatchCount === 1 ? "" : "s"}
            </span>
          ) : null}
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
              <th>Reference</th>
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
            {filteredRows.map((row, filteredIndex) => {
              const rowIndex = filteredIndex;
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
                      className={styles.readOnly}
                      value={rowReference(row)}
                      readOnly
                      title="Loan / Cash sheet se common reference"
                    />
                  </td>
                  <td>
                    <input
                      className={amountFieldClass}
                      value={row.amount}
                      onChange={(e) => updateCell(row, "amount", e.target.value)}
                      readOnly={!amountEditable}
                      placeholder="Total amount"
                      title={
                        amountEditable
                          ? undefined
                          : "Amount edit allowed nahi (view only)"
                      }
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
                      className={amountFieldClass}
                      value={row.receivedAmount}
                      onChange={(e) => updateCell(row, "receivedAmount", e.target.value)}
                      readOnly={!amountEditable}
                      placeholder="0"
                    />
                  </td>
                  <td>
                    <input
                      className={amountFieldClass}
                      value={row.receivedDate}
                      onChange={(e) => updateCell(row, "receivedDate", e.target.value)}
                      readOnly={!amountEditable}
                      placeholder="DD/MM/YYYY"
                    />
                  </td>
                  <td>
                    <input
                      className={
                        !amountEditable || remarkLocked ? styles.readOnly : styles.cellInput
                      }
                      value={row.receivedRemark}
                      onChange={(e) => updateCell(row, "receivedRemark", e.target.value)}
                      readOnly={!amountEditable || remarkLocked}
                      placeholder={
                        !amountEditable
                          ? "View only"
                          : remarkLocked
                            ? "Auto (Loan bank)"
                            : "Manual remark"
                      }
                    />
                  </td>
                  <td>
                    <input
                      className={amountFieldClass}
                      value={row.secondReceivedAmount}
                      onChange={(e) =>
                        updateCell(row, "secondReceivedAmount", e.target.value)
                      }
                      readOnly={!amountEditable}
                      placeholder="0"
                    />
                  </td>
                  <td>
                    <input
                      className={amountFieldClass}
                      value={row.secondReceivedDate}
                      onChange={(e) =>
                        updateCell(row, "secondReceivedDate", e.target.value)
                      }
                      readOnly={!amountEditable}
                      placeholder="DD/MM/YYYY"
                    />
                  </td>
                  <td>
                    <input
                      className={
                        !amountEditable || remarkLocked ? styles.readOnly : styles.cellInput
                      }
                      value={row.secondPaymentRemark}
                      onChange={(e) =>
                        updateCell(row, "secondPaymentRemark", e.target.value)
                      }
                      readOnly={!amountEditable || remarkLocked}
                      placeholder={
                        !amountEditable
                          ? "View only"
                          : remarkLocked
                            ? "Auto (Loan bank)"
                            : "Manual remark"
                      }
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
