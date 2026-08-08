import { useEffect, useMemo, useState } from "react";
import {
  PRODUCT_CATEGORIES,
  createDraftProductRow,
} from "../../../constants/productSheet";
import {
  deleteProduct,
  loadProducts,
  upsertProduct,
} from "../../../utils/productStorage";
import {
  applyManualStockIn,
  getProductStockPreview,
  STOCK_SYNC_EVENT,
} from "../../../utils/stockStorage";
import styles from "./ProductSheet.module.css";

const EMPTY_FORM = {
  itemName: "",
  category: "",
  hsn: "",
  stockQty: "",
  rate: "",
};

function formatQty(n) {
  const v = Number(n) || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

function ProductSheet() {
  const [products, setProducts] = useState(() => loadProducts());
  const [drafts, setDrafts] = useState([]);
  const [query, setQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [stockTick, setStockTick] = useState(0);

  const refresh = () => setProducts(loadProducts());

  useEffect(() => {
    const bump = () => setStockTick((n) => n + 1);
    window.addEventListener(STOCK_SYNC_EVENT, bump);
    return () => window.removeEventListener(STOCK_SYNC_EVENT, bump);
  }, []);

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

  const previewFor = (row) => {
    void stockTick;
    if (row.isDraft) {
      return getProductStockPreview({ itemName: row.itemName });
    }
    return getProductStockPreview({ productId: row.id, itemName: row.itemName });
  };

  const modalPreview = useMemo(() => {
    void stockTick;
    return getProductStockPreview({ itemName: form.itemName });
  }, [form.itemName, stockTick]);

  const persistProductWithStock = (row) => {
    const itemName = String(row.itemName || "").trim();
    const category = String(row.category || "").trim();
    const hsn = String(row.hsn || "").trim();
    const stockQty = String(row.stockQty ?? "").trim();
    const rate = String(row.rate ?? "").trim();

    if (!itemName) {
      window.alert("Item name zaroori hai.");
      return false;
    }
    if (!category) {
      window.alert("Category select karein.");
      return false;
    }
    if (!hsn) {
      window.alert("HSN Code likhein.");
      return false;
    }

    const qtyNum = Number(stockQty);
    if (stockQty !== "" && (Number.isNaN(qtyNum) || qtyNum < 0)) {
      window.alert("Stock qty sahi number likhein.");
      return false;
    }
    const rateNum = Number(rate);
    if (rate !== "" && (Number.isNaN(rateNum) || rateNum < 0)) {
      window.alert("Rate sahi number likhein.");
      return false;
    }

    const saved = upsertProduct({
      id: row.isDraft ? undefined : row.id,
      itemName,
      category,
      hsn,
      rate: rate !== "" ? rateNum : Number(row.rate) || 0,
    });

    if (qtyNum > 0) {
      const stockResult = applyManualStockIn({
        productId: saved.id || row.id,
        itemName,
        category,
        hsn,
        qty: qtyNum,
        rate: rateNum || 0,
        note: "Product Sheet — today stock",
      });
      if (!stockResult.ok) {
        window.alert(stockResult.message || "Item save hua, lekin stock add fail.");
        return true;
      }
      window.alert(
        `Item save + stock add.\n` +
          `Add qty: ${formatQty(qtyNum)}\n` +
          `Naya balance: ${formatQty(stockResult.balance)}`,
      );
    } else {
      window.alert("Item save ho gaya — Purchase / Stock Sheet me dikhega.");
    }
    return true;
  };

  const saveProduct = (row) => {
    if (!persistProductWithStock(row)) return;
    if (row.isDraft) {
      setDrafts((prev) => prev.filter((d) => d.id !== row.id));
    }
    refresh();
    setStockTick((n) => n + 1);
  };

  const saveModal = () => {
    if (!persistProductWithStock({ ...form, isDraft: true })) return;
    refresh();
    setStockTick((n) => n + 1);
    setForm(EMPTY_FORM);
    setModalOpen(false);
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
            Item add karte waqt <strong>Preview Balance</strong> (abhi kitna stock hai),{" "}
            <strong>Stock</strong> (aaj kitna add karna hai) aur <strong>Rate</strong> bhariye —
            save pe Stock Sheet me balance update ho jayega.
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
              <th>Preview Balance</th>
              <th>Stock (Add)</th>
              <th>Rate</th>
              <th>Save</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className={styles.empty}>
                  Koi item nahi — Add Row ya Add Item se shuru karein.
                </td>
              </tr>
            ) : (
              filtered.map((row, index) => {
                const isDraft = Boolean(row.isDraft);
                const preview = previewFor(row);
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
                    <td className={styles.numCell} title="Abhi Stock Sheet me jo balance hai">
                      {formatQty(preview.balance)}
                    </td>
                    <td>
                      {isDraft ? (
                        <input
                          className={styles.numInput}
                          type="number"
                          min="0"
                          step="any"
                          value={row.stockQty ?? ""}
                          onChange={(e) => updateDraft(row.id, { stockQty: e.target.value })}
                          placeholder="Today qty"
                        />
                      ) : (
                        <input
                          className={styles.numInput}
                          type="number"
                          min="0"
                          step="any"
                          value={row.stockQty ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setProducts((prev) =>
                              prev.map((p) => (p.id === row.id ? { ...p, stockQty: v } : p)),
                            );
                          }}
                          placeholder="+ qty"
                        />
                      )}
                    </td>
                    <td>
                      {isDraft ? (
                        <input
                          className={styles.numInput}
                          type="number"
                          min="0"
                          step="any"
                          value={row.rate ?? ""}
                          onChange={(e) => updateDraft(row.id, { rate: e.target.value })}
                          placeholder={preview.lastRate ? String(preview.lastRate) : "Rate"}
                        />
                      ) : (
                        <input
                          className={styles.numInput}
                          type="number"
                          min="0"
                          step="any"
                          value={row.rate ?? preview.lastRate ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setProducts((prev) =>
                              prev.map((p) => (p.id === row.id ? { ...p, rate: v } : p)),
                            );
                          }}
                          placeholder="Rate"
                        />
                      )}
                    </td>
                    <td>
                      {isDraft ? (
                        <button
                          type="button"
                          className={styles.btnSave}
                          onClick={() => saveProduct(row)}
                        >
                          Save
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.btnSave}
                          onClick={() =>
                            saveProduct({
                              ...row,
                              isDraft: false,
                              stockQty: row.stockQty ?? "",
                              rate: row.rate ?? preview.lastRate ?? "",
                            })
                          }
                        >
                          {Number(row.stockQty) > 0 ? "Save + Stock" : "Update"}
                        </button>
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
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onClick={() => setModalOpen(false)}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Add Item + Today Stock</h2>
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
            <label className={styles.field}>
              Preview Balance (abhi)
              <input
                className={styles.readonly}
                value={formatQty(modalPreview.balance)}
                readOnly
                title="Stock Sheet me current balance"
              />
            </label>
            <label className={styles.field}>
              Stock (aaj add)
              <input
                type="number"
                min="0"
                step="any"
                value={form.stockQty}
                onChange={(e) => setForm((f) => ({ ...f, stockQty: e.target.value }))}
                placeholder="e.g. 50"
              />
            </label>
            <label className={styles.field}>
              Rate
              <input
                type="number"
                min="0"
                step="any"
                value={form.rate}
                onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
                placeholder={
                  modalPreview.lastRate ? `Last: ${modalPreview.lastRate}` : "e.g. 1200"
                }
              />
            </label>
            <p className={styles.hint}>
              Save ke baad Stock = Preview + aaj ka Stock. Stock Sheet me bhi dikhega.
            </p>
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
