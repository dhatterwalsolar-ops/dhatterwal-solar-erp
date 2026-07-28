import { useEffect, useMemo, useRef, useState } from "react";
import { supplierToPartyFields } from "../../../constants/supplierRegistry";
import {
  addSupplier,
  findSupplierByName,
  searchSuppliers,
} from "../../../utils/supplierStorage";
import styles from "./SupplierPartySearch.module.css";

function SupplierPartySearch({ party, onApply }) {
  const [query, setQuery] = useState(party.supplier || "");
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newParty, setNewParty] = useState({
    name: "",
    contactPerson: "",
    mobile: "",
    gstin: "",
    address: "",
  });
  const wrapRef = useRef(null);

  useEffect(() => {
    setQuery(party.supplier || "");
  }, [party.supplier]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return searchSuppliers(q);
  }, [query]);

  const selectSupplier = (supplier) => {
    onApply(supplierToPartyFields(supplier));
    setQuery(supplier.name);
    setOpen(false);
  };

  const onSearchChange = (value) => {
    setQuery(value);
    setOpen(Boolean(value.trim()));
    onApply({ supplier: value, supplierId: "" });
    const exact = findSupplierByName(value);
    if (exact) {
      onApply(supplierToPartyFields(exact));
    }
  };

  const saveNewParty = () => {
    if (!newParty.name.trim()) {
      window.alert("Party name required.");
      return;
    }
    const saved = addSupplier(newParty);
    onApply(supplierToPartyFields(saved));
    setQuery(saved.name);
    setShowAdd(false);
    setOpen(false);
    setNewParty({
      name: "",
      contactPerson: "",
      mobile: "",
      gstin: "",
      address: "",
    });
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <label className={styles.label}>
        Supplier / Party Name
        <span className={styles.searchRow}>
          <input
            type="search"
            value={query}
            placeholder="Search party name, mobile, GSTIN..."
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => {
              if (query.trim()) setOpen(true);
            }}
          />
          <button
            type="button"
            className={styles.searchBtn}
            onClick={() => {
              if (!query.trim()) {
                setOpen(false);
                return;
              }
              setOpen((o) => !o);
            }}
          >
            🔍
          </button>
        </span>
      </label>

      {open && (
        <div className={styles.dropdown}>
          <button
            type="button"
            className={styles.addNew}
            onClick={() => {
              setShowAdd(true);
              setNewParty((p) => ({ ...p, name: query.trim() }));
              setOpen(false);
            }}
          >
            + Add New Party
          </button>
          {!query.trim() ? (
            <p className={styles.empty}>Pehle naam / mobile / GSTIN type karke search karein.</p>
          ) : results.length === 0 ? (
            <p className={styles.empty}>No party found — add new party.</p>
          ) : (
            <ul>
              {results.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => selectSupplier(s)}>
                    <strong>{s.name}</strong>
                    <span>
                      {s.mobile} · {s.gstin}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showAdd && (
        <div className={styles.modalBackdrop} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true">
            <h3>Add New Party</h3>
            <label>
              Party Name
              <input
                value={newParty.name}
                onChange={(e) => setNewParty((p) => ({ ...p, name: e.target.value }))}
              />
            </label>
            <label>
              Contact Person
              <input
                value={newParty.contactPerson}
                onChange={(e) => setNewParty((p) => ({ ...p, contactPerson: e.target.value }))}
              />
            </label>
            <label>
              Mobile
              <input
                value={newParty.mobile}
                onChange={(e) => setNewParty((p) => ({ ...p, mobile: e.target.value }))}
              />
            </label>
            <label>
              GSTIN
              <input
                value={newParty.gstin}
                onChange={(e) => setNewParty((p) => ({ ...p, gstin: e.target.value }))}
              />
            </label>
            <label>
              Address
              <textarea
                rows={2}
                value={newParty.address}
                onChange={(e) => setNewParty((p) => ({ ...p, address: e.target.value }))}
              />
            </label>
            <div className={styles.modalActions}>
              <button type="button" className={styles.save} onClick={saveNewParty}>
                Save Party
              </button>
              <button type="button" className={styles.cancel} onClick={() => setShowAdd(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SupplierPartySearch;
