import { useEffect, useMemo, useRef, useState } from "react";
import { searchProducts } from "../../../utils/productStorage";
import styles from "./ProductItemSearch.module.css";

function ProductItemSearch({ value, onSelect, placeholder }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
    setOpen(false);
  }, [value]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    return searchProducts(query, 15);
  }, [query]);

  const pick = (product) => {
    onSelect(product);
    setQuery(product.itemName);
    setOpen(false);
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <input
        className={styles.input}
        value={query}
        placeholder={placeholder || "Search item from Product Sheet…"}
        onChange={(e) => {
          const v = e.target.value;
          setQuery(v);
          setOpen(Boolean(v.trim()));
        }}
        onFocus={() => {
          if (query.trim()) setOpen(true);
        }}
      />
      {open && query.trim() && results.length > 0 ? (
        <ul className={styles.list} role="listbox">
          {results.map((p) => (
            <li key={p.id}>
              <button type="button" className={styles.option} onClick={() => pick(p)}>
                <strong>{p.itemName}</strong>
                <span>
                  {p.category} · HSN {p.hsn}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && query.trim() && results.length === 0 ? (
        <p className={styles.hint}>Product Sheet me pehle item add karein.</p>
      ) : null}
    </div>
  );
}

export default ProductItemSearch;
