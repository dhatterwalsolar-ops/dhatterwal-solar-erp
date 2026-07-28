import { useEffect, useMemo, useRef, useState } from "react";
import {
  INVOICE_TYPES,
  PAYMENT_MODES,
  UNITS,
  PURCHASE_GST_OPTIONS,
  purchaseGstLabel,
  normalizePurchaseItemTax,
  calcLineAmount,
  calcPurchaseTotals,
  createEmptyPurchaseItem,
  serializePurchaseLineItems,
  createFreshPurchaseFormState,
} from "../../../constants/purchaseSheet";
import { loadPurchaseDraft, savePurchaseDraft, clearPurchaseDraft } from "../../../utils/purchaseStorage";
import {
  savePurchaseHistoryRecord,
  findPurchaseHistoryByInvoiceNo,
} from "../../../utils/purchaseHistoryStorage";
import { applyPurchaseStockIn } from "../../../utils/stockStorage";
import { extractSerialsFromImageFile } from "../../../utils/serialNumberOcr";
import SupplierPartySearch from "./SupplierPartySearch";
import ProductItemSearch from "./ProductItemSearch";
import { Link } from "react-router-dom";
import { ROUTES } from "../../../constants/routes";
import styles from "./PurchaseSheet.module.css";

function PurchaseSheet() {
  const fresh = createFreshPurchaseFormState();
  const [step, setStep] = useState(fresh.step);
  const [party, setParty] = useState(fresh.party);
  const [items, setItems] = useState(fresh.items);
  const serialPhotoRef = useRef(null);
  const [ocrRowId, setOcrRowId] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(null);
  const [formResetKey, setFormResetKey] = useState(0);

  const resetToNewEntry = () => {
    const next = createFreshPurchaseFormState();
    setParty(next.party);
    setItems(next.items);
    setStep(1);
    setFormResetKey((k) => k + 1);
    clearPurchaseDraft();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleNewEntry = () => {
    const hasDraftData =
      Boolean(party.supplier?.trim()) ||
      Boolean(party.invoiceNo?.trim()) ||
      items.some((i) => i.itemName?.trim() || Number(i.qty) > 0);
    if (hasDraftData && !window.confirm("Form clear karke nayi purchase entry shuru karein?")) {
      return;
    }
    resetToNewEntry();
  };

  useEffect(() => {
    const draft = loadPurchaseDraft();
    if (!draft) return;
    if (draft.party) setParty((p) => ({ ...p, ...draft.party }));
    if (draft.items?.length) {
      setItems(
        draft.items.map((row) => ({
          ...row,
          tax: normalizePurchaseItemTax(row.tax),
        })),
      );
    }
    if (draft.step) setStep(draft.step);
  }, []);

  const totals = useMemo(() => calcPurchaseTotals(items), [items]);

  const duplicateSavedInvoice = useMemo(
    () => findPurchaseHistoryByInvoiceNo(party.invoiceNo),
    [party.invoiceNo],
  );

  const updateParty = (key, value) => setParty((p) => ({ ...p, [key]: value }));

  const applyPartyFields = (fields) => {
    setParty((p) => ({ ...p, ...fields }));
  };

  const pickSerialPhoto = (rowId) => {
    setOcrRowId(rowId);
    serialPhotoRef.current?.click();
  };

  const onSerialPhotoSelected = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    const rowId = ocrRowId;
    if (!file || !rowId) return;

    setOcrLoading(rowId);
    try {
      const { serials } = await extractSerialsFromImageFile(file);
      if (!serials.length) {
        window.alert(
          "Photo se serial detect nahi hua. Clear photo try karein ya serial manually likhein.",
        );
        return;
      }
      setItems((prev) =>
        prev.map((row) => {
          if (row.id !== rowId) return row;
          return {
            ...row,
            serialNumbers: serials.join("\n"),
            qty: serials.length,
          };
        }),
      );
      window.alert(`${serials.length} serial number auto-fill ho gaye.`);
    } catch {
      window.alert("Serial photo read nahi ho payi. Dobara try karein.");
    } finally {
      setOcrLoading(null);
      setOcrRowId(null);
    }
  };

  const updateItem = (id, key, value) => {
    setItems((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const nextValue = key === "tax" ? normalizePurchaseItemTax(value) : value;
        return { ...row, [key]: nextValue };
      }),
    );
  };

  const applyProductToRow = (rowId, product) => {
    setItems((prev) =>
      prev.map((row) => {
        if (row.id !== rowId) return row;
        return {
          ...row,
          productId: product.id,
          itemName: product.itemName,
          category: product.category,
          hsn: product.hsn,
        };
      }),
    );
  };

  const addItem = () => setItems((prev) => [...prev, createEmptyPurchaseItem()]);
  const removeItem = (id) => setItems((prev) => prev.filter((r) => r.id !== id));
  const clearItems = () => {
    if (window.confirm("Clear all items?")) setItems([]);
  };

  const persistDraft = (nextStep = step) => {
    savePurchaseDraft({ party, items, step: nextStep, savedAt: new Date().toISOString() });
  };

  const goNext = () => {
    if (step === 1) {
      if (!party.supplier?.trim() || !party.invoiceNo?.trim()) {
        window.alert("Supplier and Invoice Number required.");
        return;
      }
      setStep(2);
      persistDraft(2);
      return;
    }
    if (step === 2) {
      if (!items.length) {
        window.alert("Add at least one item.");
        return;
      }
      setStep(3);
      persistDraft(3);
    }
  };

  const saveFinal = () => {
    if (duplicateSavedInvoice) {
      window.alert(
        `Invoice "${party.invoiceNo.trim()}" pehle se save hai (${duplicateSavedInvoice.supplier}, ${duplicateSavedInvoice.invoiceDate}).\n\nEk hi invoice number par sirf ek baar entry save hogi — dubara save nahi hoga.`,
      );
      return;
    }

    persistDraft(3);
    const lineItems = serializePurchaseLineItems(items);
    const result = savePurchaseHistoryRecord({
      id: `pur-${Date.now()}`,
      invoiceNo: party.invoiceNo.trim(),
      invoiceDate: party.invoiceDate,
      supplier: party.supplier,
      taxableAmount: totals.subTotal,
      gstAmount: totals.taxTotal,
      totalAmount: totals.grandTotal,
      roundOff: totals.roundOff,
      grandTotal: totals.grandRounded,
      paymentMode: party.paymentMode,
      items: lineItems,
      savedAt: new Date().toISOString(),
    });

    if (!result.ok) {
      if (result.reason === "duplicate") {
        window.alert(
          `Invoice "${party.invoiceNo.trim()}" pehle se save hai. Duplicate entry nahi banegi.`,
        );
      } else {
        window.alert("Purchase save nahi ho paya. Invoice number check karein.");
      }
      return;
    }

    const savedInvoiceNo = party.invoiceNo.trim();
    const stockResult = applyPurchaseStockIn({
      invoiceNo: savedInvoiceNo,
      invoiceDate: party.invoiceDate,
      supplier: party.supplier,
      items: lineItems,
    });

    const stockNote =
      stockResult.updatedLines > 0
        ? `\n\nStock Sheet: ${stockResult.updatedLines} item(s) me qty add ho gayi.`
        : stockResult.skipped
          ? "\n\nStock pehle se is invoice ke liye update ho chuka hai."
          : "\n\nStock: koi qty add nahi hui (item name / qty check karein).";

    window.alert(
      `Purchase ${savedInvoiceNo} saved. Grand Total: ₹${totals.grandRounded.toLocaleString("en-IN")} — Reports me dikhega.${stockNote}\n\nPurchase List tab me poori entry aur items dekh sakte hain.`,
    );

    resetToNewEntry();
  };

  const formatMoney = (n) => `₹ ${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  return (
    <div className={styles.page}>
      <nav className={styles.breadcrumb}>
        <span>Home</span> › <span>Purchase</span> › <strong>New Purchase</strong>
      </nav>

      <div className={styles.pageToolbar}>
        <button type="button" className={styles.btnNewEntry} onClick={handleNewEntry}>
          + New Entry
        </button>
        <span className={styles.pageToolbarHint}>
          Nayi bill khali form se · neeche list se purani entry delete kar sakte hain
        </span>
      </div>

      <div className={styles.stepper}>
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            type="button"
            className={
              step === n ? `${styles.step} ${styles.stepActive}` : step > n ? `${styles.step} ${styles.stepDone}` : styles.step
            }
            onClick={() => n < step && setStep(n)}
          >
            <span className={styles.stepNo}>{step > n ? "✓" : n}</span>
            {n === 1 && "Party & Invoice Details"}
            {n === 2 && "Item Details"}
            {n === 3 && "Review & Save"}
          </button>
        ))}
      </div>

      {step === 1 && (
        <div className={styles.stepBody}>
          <section className={styles.card}>
            <h2>Party Details</h2>
            <div className={styles.grid2}>
              <SupplierPartySearch
                key={`supplier-${formResetKey}`}
                party={party}
                onApply={applyPartyFields}
              />
              <label>
                Contact Person
                <input
                  className={party.supplierId ? styles.autoField : undefined}
                  value={party.contactPerson}
                  onChange={(e) => updateParty("contactPerson", e.target.value)}
                />
              </label>
              <label>
                Mobile Number
                <input
                  className={party.supplierId ? styles.autoField : undefined}
                  value={party.mobile}
                  onChange={(e) => updateParty("mobile", e.target.value)}
                />
              </label>
              <label>
                GSTIN
                <input
                  className={party.supplierId ? styles.autoField : undefined}
                  value={party.gstin}
                  onChange={(e) => updateParty("gstin", e.target.value)}
                />
              </label>
              <label className={styles.span2}>
                Address
                <textarea
                  rows={2}
                  className={party.supplierId ? styles.autoField : undefined}
                  value={party.address}
                  onChange={(e) => updateParty("address", e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className={styles.card}>
            <h2>Invoice Details</h2>
            <div className={styles.grid3}>
              <label>
                Invoice Type
                <select value={party.invoiceType} onChange={(e) => updateParty("invoiceType", e.target.value)}>
                  {INVOICE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Invoice Number
                <input value={party.invoiceNo} onChange={(e) => updateParty("invoiceNo", e.target.value)} />
                {duplicateSavedInvoice ? (
                  <span className={styles.invoiceDuplicateHint} role="status">
                    Yeh invoice pehle se save hai — dubara final save duplicate nahi banayega.
                  </span>
                ) : null}
              </label>
              <label>
                Invoice Date
                <input value={party.invoiceDate} onChange={(e) => updateParty("invoiceDate", e.target.value)} />
              </label>
              <label>
                Delivery Date
                <input value={party.deliveryDate} onChange={(e) => updateParty("deliveryDate", e.target.value)} />
              </label>
              <label>
                Payment Mode
                <select value={party.paymentMode} onChange={(e) => updateParty("paymentMode", e.target.value)}>
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Reference / Challan No.
                <input value={party.referenceNo} onChange={(e) => updateParty("referenceNo", e.target.value)} />
              </label>
            </div>
          </section>
        </div>
      )}

      {step === 2 && (
        <div className={styles.stepBody}>
          <input
            ref={serialPhotoRef}
            type="file"
            accept="image/*"
            capture="environment"
            className={styles.hiddenFile}
            onChange={onSerialPhotoSelected}
          />
          <div className={styles.itemToolbar}>
            <button type="button" className={styles.btnBlue} onClick={addItem}>
              + Add Item
            </button>
            <button type="button" className={styles.btnGreen} onClick={() => window.alert("Import — connect Excel later.")}>
              Import Items
            </button>
            <button type="button" className={styles.btnRed} onClick={clearItems}>
              Clear All
            </button>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.itemTable}>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Item Category</th>
                  <th>Item Name</th>
                  <th>HSN / SAC</th>
                  <th>Serial Number</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Rate (₹)</th>
                  <th>GST</th>
                  <th>Amount (₹)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, index) => (
                  <tr key={row.id}>
                    <td>{index + 1}</td>
                    <td>
                      <input
                        className={styles.readOnlyCell}
                        value={row.category}
                        readOnly
                        title="Product Sheet se auto"
                      />
                    </td>
                    <td>
                      <ProductItemSearch
                        value={row.itemName}
                        onSelect={(product) => applyProductToRow(row.id, product)}
                      />
                    </td>
                    <td>
                      <input
                        className={styles.readOnlyCell}
                        value={row.hsn}
                        readOnly
                        title="Product Sheet se auto"
                      />
                    </td>
                    <td>
                      <textarea
                        rows={2}
                        value={row.serialNumbers}
                        onChange={(e) => updateItem(row.id, "serialNumbers", e.target.value)}
                      />
                      <button
                        type="button"
                        className={styles.serialPhotoBtn}
                        disabled={ocrLoading === row.id}
                        onClick={() => pickSerialPhoto(row.id)}
                      >
                        {ocrLoading === row.id ? "Reading…" : "📷 Upload serial photo"}
                      </button>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={row.qty}
                        onChange={(e) => updateItem(row.id, "qty", Number(e.target.value))}
                      />
                    </td>
                    <td>
                      <select value={row.unit} onChange={(e) => updateItem(row.id, "unit", e.target.value)}>
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        value={row.rate}
                        onChange={(e) => updateItem(row.id, "rate", Number(e.target.value))}
                      />
                    </td>
                    <td>
                      <select
                        value={normalizePurchaseItemTax(row.tax)}
                        onChange={(e) => updateItem(row.id, "tax", Number(e.target.value))}
                        aria-label="GST rate"
                      >
                        {PURCHASE_GST_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className={styles.amountCell}>{calcLineAmount(row).toLocaleString("en-IN")}</td>
                    <td>
                      <button type="button" className={styles.delBtn} onClick={() => removeItem(row.id)}>
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className={styles.reviewLayout}>
          <div className={styles.reviewMain}>
            <section className={styles.card}>
              <div className={styles.cardHeadRow}>
                <h2>Party &amp; Invoice Summary</h2>
                <button type="button" className={styles.btnEdit} onClick={() => setStep(1)}>
                  Edit
                </button>
              </div>
              <p>
                <strong>{party.supplier}</strong> — {party.contactPerson} — {party.mobile}
              </p>
              <p>GSTIN: {party.gstin}</p>
              <p>{party.address}</p>
              <p>
                {party.invoiceType} · {party.invoiceNo} · {party.invoiceDate} · {party.paymentMode}
              </p>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeadRow}>
                <h2>Item Summary</h2>
                <button type="button" className={styles.btnEdit} onClick={() => setStep(2)}>
                  Edit
                </button>
              </div>
              <table className={styles.summaryTable}>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Name</th>
                    <th>HSN</th>
                    <th>Serial</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>GST</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id}>
                      <td>{row.category}</td>
                      <td>{row.itemName}</td>
                      <td>{row.hsn}</td>
                      <td className={styles.serialPreview}>{row.serialNumbers.split("\n")[0]}…</td>
                      <td>
                        {row.qty} {row.unit}
                      </td>
                      <td>{row.rate}</td>
                      <td>{purchaseGstLabel(row.tax)}</td>
                      <td>{calcLineAmount(row).toLocaleString("en-IN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <label className={styles.notesLabel}>
              Notes
              <textarea rows={3} value={party.notes} onChange={(e) => updateParty("notes", e.target.value)} />
            </label>
          </div>

          <aside className={styles.reviewSide}>
            <section className={styles.sideCard}>
              <h3>Amount Summary</h3>
              <dl className={styles.amountDl}>
                <div>
                  <dt>Sub Total</dt>
                  <dd>{formatMoney(totals.subTotal)}</dd>
                </div>
                <div>
                  <dt>Taxable Amount</dt>
                  <dd>{formatMoney(totals.subTotal)}</dd>
                </div>
                <div>
                  <dt>Total GST</dt>
                  <dd>{formatMoney(totals.taxTotal)}</dd>
                </div>
                <div>
                  <dt>Round Off</dt>
                  <dd>{formatMoney(totals.roundOff)}</dd>
                </div>
              </dl>
              <p className={styles.grandTotal}>{formatMoney(totals.grandRounded)}</p>
            </section>

            <section className={styles.sideCard}>
              <h3>Quick Actions</h3>
              <ul className={styles.quickList}>
                <li>Download PDF</li>
                <li>Print Invoice</li>
                <li>Send to Supplier</li>
                <li>Duplicate Entry</li>
              </ul>
            </section>

            <section className={styles.sideCard}>
              <h3>Attachments</h3>
              <div className={styles.dropZone}>PDF, JPG, PNG — upload (coming soon)</div>
            </section>

            <section className={styles.sideCard}>
              <h3>Tip</h3>
              <p className={styles.sideTip}>
                Save ke baad form khali ho jata hai. Saved bills aur sari items{" "}
                <Link to={ROUTES.PURCHASE_LIST}>Purchase List</Link> tab me dekhein.
              </p>
            </section>
          </aside>
        </div>
      )}

      <footer className={styles.totalsBar}>
        <span>Items: {totals.itemCount}</span>
        <span>Total Qty: {totals.totalQty}</span>
        <span>Sub Total: {formatMoney(totals.subTotal)}</span>
        <span>GST Total: {formatMoney(totals.taxTotal)}</span>
        <span className={styles.grandBar}>Grand Total: {formatMoney(totals.grandRounded)}</span>
      </footer>

      <div className={styles.actionsBar}>
        <button type="button" className={styles.btnNewEntryBar} onClick={handleNewEntry}>
          New Entry
        </button>
        {step > 1 && (
          <button type="button" className={styles.btnBack} onClick={() => setStep((s) => s - 1)}>
            Back
          </button>
        )}
        {step < 3 && (
          <button type="button" className={styles.btnNext} onClick={goNext}>
            Save &amp; Next
          </button>
        )}
        {step === 3 && (
          <>
            <button type="button" className={styles.btnBack} onClick={() => persistDraft(3)}>
              Save as Draft
            </button>
            <button
              type="button"
              className={styles.btnSave}
              onClick={saveFinal}
              disabled={Boolean(duplicateSavedInvoice)}
              title={
                duplicateSavedInvoice
                  ? "Yeh invoice number pehle se save hai"
                  : undefined
              }
            >
              Save &amp; Create Purchase
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default PurchaseSheet;
