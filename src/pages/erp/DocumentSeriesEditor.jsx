import { useMemo, useState } from "react";
import { buildSeriesPreview } from "../../constants/settingsDefaults";
import {
  appendActivityLog,
  getSettingsState,
  saveInvoiceSeries,
  saveQuotationSeries,
} from "../../utils/settingsStorage";
import InvoiceClearSettings from "./InvoiceClearSettings";
import styles from "./SettingsPage.module.css";

/**
 * Invoice / Quotation number series editor — Format tabs ke andar use.
 * kind: "invoice" | "quotation"
 */
function DocumentSeriesEditor({ kind = "invoice", session }) {
  const isInvoice = kind === "invoice";
  const [series, setSeries] = useState(() => {
    const state = getSettingsState();
    return isInvoice ? { ...state.invoiceSeries } : { ...state.quotationSeries };
  });

  const preview = useMemo(() => buildSeriesPreview(series), [series]);

  const patch = (key, value) => {
    setSeries((s) => ({ ...s, [key]: value }));
  };

  const save = () => {
    const nextNumber = String(series.nextNumber || "").trim();
    if (!nextNumber) {
      window.alert("Next Number zaroori hai.");
      return;
    }
    if (isInvoice) {
      saveInvoiceSeries(series);
      appendActivityLog({
        user: session?.displayName ?? "Admin",
        action: "Invoice series updated (Format tab)",
      });
      window.alert(`Invoice series save: ${preview}`);
    } else {
      saveQuotationSeries(series);
      appendActivityLog({
        user: session?.displayName ?? "Admin",
        action: "Quotation series updated (Format tab)",
      });
      window.alert(`Quotation series save: ${preview}`);
    }
  };

  return (
    <>
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h2>{isInvoice ? "Invoice Series" : "Quotation Series"}</h2>
          <p className={styles.cardHint}>
            {isInvoice
              ? "Sale → Generate Invoice isi series se naya number lega."
              : "Loan Case → Generate Quotation isi series se naya number lega."}{" "}
            Prefix / Next Number / Suffix change karke Update Series dabayein.
          </p>
        </div>
      </div>
      <div className={styles.seriesGrid}>
        <label>
          Prefix (Start)
          <input
            value={series.prefix ?? ""}
            onChange={(e) => patch("prefix", e.target.value)}
            placeholder={isInvoice ? "DS/" : "DS/Q/"}
          />
        </label>
        <label>
          Next Number *
          <input
            value={series.nextNumber ?? ""}
            onChange={(e) => patch("nextNumber", e.target.value)}
            placeholder={isInvoice ? "323" : "000045"}
          />
        </label>
        <label>
          Suffix (End)
          <input
            value={series.suffix ?? ""}
            onChange={(e) => patch("suffix", e.target.value)}
            placeholder="/2026-27"
          />
        </label>
        {isInvoice ? (
          <label>
            Separator (blank = no dash)
            <input
              value={series.separator ?? ""}
              onChange={(e) => patch("separator", e.target.value)}
              placeholder="leave empty for DS/323/2026-27"
            />
          </label>
        ) : (
          <label>
            Separator (optional)
            <input
              value={series.separator ?? ""}
              onChange={(e) => patch("separator", e.target.value)}
              placeholder="blank OK"
            />
          </label>
        )}
        <label className={styles.previewField}>
          Preview
          <input className={styles.previewInput} value={preview} readOnly />
        </label>
      </div>
      <button
        type="button"
        className={isInvoice ? styles.btnPurple : styles.btnOrange}
        onClick={save}
      >
        Update Series
      </button>
    </section>
    {isInvoice ? <InvoiceClearSettings session={session} /> : null}
    </>
  );
}

export default DocumentSeriesEditor;
