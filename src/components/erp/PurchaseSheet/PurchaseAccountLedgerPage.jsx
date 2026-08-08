import { useEffect, useMemo, useRef, useState } from "react";
import { PAYMENT_MGMT_SYNC_EVENT } from "../../../utils/paymentManagementStorage";
import { PURCHASE_HISTORY_SYNC_EVENT } from "../../../utils/purchaseHistoryStorage";
import {
  buildAllSupplierAccountSummary,
  buildSupplierAccountLedger,
  formatLedgerMoney,
  searchSupplierLedgerNames,
} from "../../../utils/supplierAccountLedger";
import styles from "./PurchaseAccountLedger.module.css";

function PurchaseAccountLedgerPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [tick, setTick] = useState(0);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const refresh = () => setTick((n) => n + 1);
    window.addEventListener(PURCHASE_HISTORY_SYNC_EVENT, refresh);
    window.addEventListener(PAYMENT_MGMT_SYNC_EVENT, refresh);
    return () => {
      window.removeEventListener(PURCHASE_HISTORY_SYNC_EVENT, refresh);
      window.removeEventListener(PAYMENT_MGMT_SYNC_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setSuggestOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const suggestions = useMemo(
    () => searchSupplierLedgerNames(query).slice(0, 12),
    [query, tick],
  );

  const summaryRows = useMemo(
    () => buildAllSupplierAccountSummary(query),
    [query, tick],
  );

  const ledger = useMemo(() => {
    if (!selected) return null;
    return buildSupplierAccountLedger(selected);
  }, [selected, tick]);

  const balanceClass =
    ledger && ledger.totals.balance > 0.009
      ? styles.due
      : styles.ok;

  const pickSupplier = (name) => {
    setSelected(name);
    setQuery(name);
    setSuggestOpen(false);
  };

  const clearSelected = () => {
    setSelected("");
    setQuery("");
    setSuggestOpen(false);
  };

  return (
    <div className={styles.page}>
      <div className={styles.breadcrumb}>
        Home › Purchase Sheet › <strong>Account Ledger</strong>
      </div>
      <div className={styles.pageHead}>
        <h1>Account Ledger</h1>
        <p>
          Supplier ke naam se search karein — kitna saman liya, kitni payment di, aur kitna balance
          pending hai.
        </p>
      </div>

      <div className={styles.searchBar} ref={wrapRef}>
        <label htmlFor="supplier-ledger-search">Supplier Name Search</label>
        <div className={styles.searchRow}>
          <input
            id="supplier-ledger-search"
            type="search"
            placeholder="Supplier naam type karein…"
            value={query}
            autoComplete="off"
            onChange={(e) => {
              setQuery(e.target.value);
              setSuggestOpen(true);
            }}
            onFocus={() => setSuggestOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && suggestions[0]) {
                e.preventDefault();
                pickSupplier(suggestions[0]);
              }
            }}
          />
          {selected ? (
            <button type="button" className={styles.btnGhost} onClick={clearSelected}>
              Clear
            </button>
          ) : null}
          {suggestions[0] && query.trim() ? (
            <button
              type="button"
              className={`${styles.btnGhost} ${styles.btnPrimary}`}
              onClick={() => pickSupplier(suggestions[0])}
            >
              Open Ledger
            </button>
          ) : null}
        </div>
        {suggestOpen && suggestions.length > 0 ? (
          <ul className={styles.suggestList} role="listbox">
            {suggestions.map((name) => (
              <li key={name}>
                <button type="button" onClick={() => pickSupplier(name)}>
                  {name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {ledger ? (
        <>
          <div className={styles.summaryStrip}>
            <div className={styles.summaryCard}>
              <span>Supplier</span>
              <strong style={{ fontSize: "0.95rem" }}>{ledger.supplierName}</strong>
            </div>
            <div className={styles.summaryCard}>
              <span>Total Saman (Purchase)</span>
              <strong>{formatLedgerMoney(ledger.totals.totalPurchase)}</strong>
            </div>
            <div className={styles.summaryCard}>
              <span>Payment Di</span>
              <strong>{formatLedgerMoney(ledger.totals.paymentGiven)}</strong>
            </div>
            <div className={styles.summaryCard}>
              <span>Cash / UPI pe Bill</span>
              <strong>{formatLedgerMoney(ledger.totals.cashUpiSettled)}</strong>
            </div>
            <div className={styles.summaryCard}>
              <span>Total Paid</span>
              <strong>{formatLedgerMoney(ledger.totals.totalPaid)}</strong>
            </div>
            <div className={`${styles.summaryCard} ${balanceClass}`}>
              <span>Balance (Pending)</span>
              <strong>{formatLedgerMoney(ledger.totals.balance)}</strong>
            </div>
          </div>
          <p className={styles.hint}>
            Total Paid = Payment Given sheet + Cash/UPI purchase bills. Balance = Total Purchase −
            Total Paid.
          </p>

          <div className={styles.detailGrid}>
            <section>
              <h2 className={styles.sectionTitle}>
                Purchase Bills ({ledger.totals.billCount})
              </h2>
              <div className={styles.tableWrap}>
                {ledger.purchases.length === 0 ? (
                  <div className={styles.empty}>Is supplier ki koi purchase bill nahi.</div>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Invoice</th>
                        <th>Mode</th>
                        <th className={styles.num}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.purchases.map((p) => (
                        <tr key={p.id}>
                          <td>{p.invoiceDate || "—"}</td>
                          <td>{p.invoiceNo || "—"}</td>
                          <td>{p.paymentMode || "—"}</td>
                          <td className={styles.num}>{formatLedgerMoney(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            <section>
              <h2 className={styles.sectionTitle}>
                Payments Di ({ledger.totals.paymentCount})
              </h2>
              <div className={styles.tableWrap}>
                {ledger.payments.length === 0 ? (
                  <div className={styles.empty}>
                    Payment Given sheet me is supplier ki payment nahi mili.
                  </div>
                ) : (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Mode</th>
                        <th>Ref / Invoice</th>
                        <th className={styles.num}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledger.payments.map((g) => (
                        <tr key={g.id}>
                          <td>{g.date || "—"}</td>
                          <td>{g.paymentMode || "—"}</td>
                          <td>{g.referenceNo || "—"}</td>
                          <td className={styles.num}>{formatLedgerMoney(g.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </div>
        </>
      ) : (
        <>
          <h2 className={styles.sectionTitle}>All Suppliers</h2>
          <p className={styles.hint}>
            Row pe click karke us supplier ka full account ledger kholiye.
          </p>
          <div className={styles.tableWrap}>
            {summaryRows.length === 0 ? (
              <div className={styles.empty}>
                Abhi koi supplier purchase / payment nahi mili. Pehle Purchase Entry ya Payment
                Given add karein.
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Sr</th>
                    <th>Supplier</th>
                    <th className={styles.num}>Bills</th>
                    <th className={styles.num}>Total Saman</th>
                    <th className={styles.num}>Total Paid</th>
                    <th className={styles.num}>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((row, idx) => (
                    <tr
                      key={row.supplierName}
                      onClick={() => pickSupplier(row.supplierName)}
                      className={
                        selected === row.supplierName ? styles.active : undefined
                      }
                    >
                      <td>{idx + 1}</td>
                      <td>{row.supplierName}</td>
                      <td className={styles.num}>{row.billCount}</td>
                      <td className={styles.num}>
                        {formatLedgerMoney(row.totalPurchase)}
                      </td>
                      <td className={styles.num}>{formatLedgerMoney(row.totalPaid)}</td>
                      <td className={styles.num}>{formatLedgerMoney(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default PurchaseAccountLedgerPage;
