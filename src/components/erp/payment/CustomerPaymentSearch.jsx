import { useEffect, useMemo, useRef, useState } from "react";
import { searchPaymentCustomers } from "../../../utils/paymentCustomerSearch";
import styles from "./CustomerPaymentSearch.module.css";

function CustomerPaymentSearch({ value, onSelect }) {
  const [query, setQuery] = useState(value?.customerName || value?.consumerNo || "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    setQuery(value?.customerName || value?.consumerNo || "");
  }, [value?.consumerNo, value?.customerName]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const results = useMemo(() => searchPaymentCustomers(query), [query]);

  const pick = (customer) => {
    onSelect(customer);
    setQuery(customer.customerName || customer.consumerNo);
    setOpen(false);
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <label className={styles.label}>
        Customer Name
        <input
          type="search"
          className={styles.input}
          value={query}
          placeholder="Search name, consumer no., mobile..."
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      </label>
      {open && results.length > 0 ? (
        <div className={styles.dropdown} role="listbox">
          {results.map((c) => (
            <button
              key={c.consumerNo}
              type="button"
              className={styles.option}
              onClick={() => pick(c)}
            >
              <strong>
                {c.customerName} — {c.consumerNo}
              </strong>
              <span>
                {c.fatherName} · {c.address} · {c.mobile}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className={styles.addLink}
        onClick={() => window.alert("Naya customer Loan / Cash Case me add karein — yahan search me aa jayega.")}
      >
        + Naya customer add karein
      </button>
    </div>
  );
}

export default CustomerPaymentSearch;
