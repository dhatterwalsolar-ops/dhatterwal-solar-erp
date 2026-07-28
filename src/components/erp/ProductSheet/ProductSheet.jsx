import { useMemo, useState } from "react";
import {
  PRODUCT_CATEGORIES,
  createDraftProductRow,
} from "../../../constants/productSheet";
import {
  deleteProduct,
  loadProducts,
  upsertProduct,
} from "../../../utils/productStorage";
import styles from "./ProductSheet.module.css";

function ProductSheet() {
  const [products, setProducts] = useState(() => loadProducts());
  const [drafts, setDrafts] = useState([]);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    itemName: "",
    category: "",
    hsn: "",
  });

  const refresh = () => setProducts(loadProducts());

  const allRows = useMemo(() => [...drafts, ...products], [drafts, products]);

  const filtered = useMemo(() => {
    if (!query.trim()) return allRows;
    const q = query.toLowerCase();
    return allRows.filter(
      (row) =>
        row.itemName?.toLowerCase().includes(q) ||
        row.category?.toLowerCase().includes(q) ||
        row.hsn?.includes(q),
    );
  }, [allRows, query]);

  const saveProduct = (row) => {
    if (!row.itemName?.trim()) {
      window.alert("Item name zaroori hai.");
      return;
    }
    if (!row.category) {
      window.alert("Category select karein.");
      return;
    }
    if (!row.hsn?.trim()) {
      window.alert("HSN Code likhein.");
      return;
    }
    upsertProduct({
      id: row.isDraft ? undefined : row.id,
      itemName: row.itemName.trim(),
      category: row.category,
      hsn: row.hsn.trim(),
    });
    if (row.isDraft) {
      setDrafts((prev) => prev.filter((d) => d.id !== row.id));
    }
    refresh();
    window.alert("Item save ho gaya — Purchase Sheet me search karte hi milega.");
  };

  const saveModal = () => {
    if (!form.itemName?.trim() || !form.category || !form.hsn?.trim()) {
      window.alert("Item name, category aur HSN code bhariye.");
      return;
    }
    upsertProduct({
      itemName: form.itemName.trim(),
      category: form.category,
      hsn: form.hsn.trim(),
    });
    refresh();
    setForm({ itemName: "", category: "", hsn: "" });
    setModalOpen(false);
    window.alert("Item save ho gaya — Purchase Sheet me search karte hi milega.");
  };

  const updateDraft = (id, patch) => {
    setDrafts((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  return (
    <section className={styles.sheet}>
      <header className={styles.toolbar}>
        <div>
          <h1>Product Sheet</h1>
          <p>
            Yahan items add karein — Purchase entry me item search karte hi naam, category aur
            HSN automatic aa jayega; wahan sirf quantity, rate aur save karna hai.
          </p>
        </div>
        <div className={styles.toolbarActions}>
          <input
            type="search"
            className={styles.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search item..."
          />
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setDrafts((prev) => [createDraftProductRow(), ...prev])}
          >
            + Add Row
          </button>
          <button type="button" className={styles.btnGold} onClick={() => setModalOpen(true)}>
            + Add Item
          </button>
        </div>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Sr. No.</th>
              <th>Item Name</th>
              <th>Category</th>
              <th>HSN Code</th>
              <th>Save</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  Koi item nahi — Add Row ya Add Item se shuru karein.
                </td>
              </tr>
            ) : (
              filtered.map((row, index) => {
                const isDraft = Boolean(row.isDraft);
                return (
                  <tr key={row.id}>
                    <td>{index + 1}</td>
                    <td>
                      {isDraft ? (
                        <input
                          className={styles.cellInput}
                          value={row.itemName}
                          onChange={(e) => updateDraft(row.id, { itemName: e.target.value })}
                          placeholder="Item name"
                        />
                      ) : (
                        row.itemName
                      )}
                    </td>
                    <td>
                      {isDraft ? (
                        <select
                          className={styles.cellSelect}
                          value={row.category}
                          onChange={(e) => updateDraft(row.id, { category: e.target.value })}
                        >
                          <option value="">Category</option>
                          {PRODUCT_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      ) : (
                        row.category
                      )}
                    </td>
                    <td>
                      {isDraft ? (
                        <input
                          className={styles.cellInput}
                          value={row.hsn}
                          onChange={(e) => updateDraft(row.id, { hsn: e.target.value })}
                          placeholder="HSN"
                        />
                      ) : (
                        row.hsn
                      )}
                    </td>
                    <td>
                      {isDraft ? (
                        <button type="button" className={styles.btnSave} onClick={() => saveProduct(row)}>
                          Save
                        </button>
                      ) : (
                        "Saved"
                      )}
                    </td>
                    <td>
                      {!isDraft ? (
                        <button
                          type="button"
                          className={styles.btnDel}
                          onClick={() => {
                            if (window.confirm(`Delete ${row.itemName}?`)) {
                              deleteProduct(row.id);
                              refresh();
                            }
                          }}
                        >
                          Delete
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.btnDel}
                          onClick={() => setDrafts((prev) => prev.filter((d) => d.id !== row.id))}
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modalOpen ? (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setModalOpen(false)}>
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Add Item</h2>
            <label className={styles.field}>
              Item Name
              <input
                value={form.itemName}
                onChange={(e) => setForm((f) => ({ ...f, itemName: e.target.value }))}
                placeholder="e.g. Mono 550W Panel"
              />
            </label>
            <label className={styles.field}>
              Category
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                <option value="">Select category</option>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              HSN Code
              <input
                value={form.hsn}
                onChange={(e) => setForm((f) => ({ ...f, hsn: e.target.value }))}
                placeholder="85414011"
              />
            </label>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnCancel} onClick={() => setModalOpen(false)}>
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={saveModal}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default ProductSheet;
