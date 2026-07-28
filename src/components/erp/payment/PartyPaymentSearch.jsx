import { useEffect, useMemo, useRef, useState } from "react";
import { PARTY_TYPES } from "../../../constants/paymentManagement";
import { getLabourEmployees } from "../../../utils/labourEmployeeStorage";
import { searchSuppliers } from "../../../utils/supplierStorage";
import styles from "./CustomerPaymentSearch.module.css";

function PartyPaymentSearch({ partyName, partyType, onChange }) {
  const [query, setQuery] = useState(partyName || "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    setQuery(partyName || "");
  }, [partyName]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const suppliers = searchSuppliers(query).map((s) => ({
      name: s.name,
      type: PARTY_TYPES.SUPPLIER,
      detail: `${s.contactPerson || "—"} · ${s.mobile || "—"}`,
    }));
    const labour = getLabourEmployees()
      .filter(
        (e) =>
          !q ||
          e.name?.toLowerCase().includes(q) ||
          e.mobile?.includes(q) ||
          e.role?.toLowerCase().includes(q),
      )
      .map((e) => ({
        name: e.name,
        type: PARTY_TYPES.LABOUR,
        detail: `${e.role || "Labour"} · ${e.mobile || "—"}`,
      }));
    return [...suppliers, ...labour].slice(0, 25);
  }, [query]);

  const pick = (item) => {
    onChange({ partyName: item.name, partyType: item.type });
    setQuery(item.name);
    setOpen(false);
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <label className={styles.label}>
        Party (Supplier / Labour)
        <input
          type="search"
          className={styles.input}
          value={query}
          placeholder="Search supplier or labour..."
          onChange={(e) => {
            setQuery(e.target.value);
            onChange({ partyName: e.target.value, partyType });
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
      </label>
      {open && results.length > 0 ? (
        <div className={styles.dropdown}>
          {results.map((item) => (
            <button
              key={`${item.type}-${item.name}`}
              type="button"
              className={styles.option}
              onClick={() => pick(item)}
            >
              <strong>
                {item.name} — {item.type}
              </strong>
              <span>{item.detail}</span>
            </button>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className={styles.addLink}
        onClick={() =>
          window.alert("Supplier Purchase Sheet se ya Labour Details se add ho sakta hai.")
        }
      >
        + Naya party add karein
      </button>
    </div>
  );
}

export default PartyPaymentSearch;
