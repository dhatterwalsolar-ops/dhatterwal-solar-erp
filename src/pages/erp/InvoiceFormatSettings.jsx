import { useMemo, useState } from "react";
import {
  getInvoiceFormat,
  readFileAsDataUrlLimited,
  resetInvoiceFormat,
  saveInvoiceFormat,
} from "../../utils/invoiceFormatStorage";
import { buildInvoiceFormatPreviewHtml } from "../../utils/saleInvoiceDocuments";
import { appendActivityLog } from "../../utils/settingsStorage";
import styles from "./SettingsPage.module.css";

function InvoiceFormatSettings({ session }) {
  const [format, setFormat] = useState(() => getInvoiceFormat());
  const [savedTick, setSavedTick] = useState(0);

  const previewHtml = useMemo(() => buildInvoiceFormatPreviewHtml(format), [format, savedTick]);

  const patch = (key, value) => {
    setFormat((prev) => ({ ...prev, [key]: value }));
  };

  const patchBank = (index, key, value) => {
    setFormat((prev) => {
      const banks = prev.banks.map((b, i) => (i === index ? { ...b, [key]: value } : b));
      return { ...prev, banks };
    });
  };

  const onLogoPick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrlLimited(file);
      patch("logoDataUrl", dataUrl);
    } catch (err) {
      window.alert(err?.message || "Logo upload fail.");
    }
  };

  const save = () => {
    if (!format.legalName?.trim()) {
      window.alert("Company name zaroori hai.");
      return;
    }
    const ok = saveInvoiceFormat(format);
    if (!ok) {
      window.alert("Save fail — logo bahut badi ho sakti hai. Chhoti image try karein.");
      return;
    }
    appendActivityLog({
      user: session?.displayName ?? "Admin",
      action: "Invoice format updated",
    });
    setSavedTick((n) => n + 1);
    window.alert("Invoice format save ho gaya. Nayi Generate Invoice isi format me aayegi.");
  };

  const reset = () => {
    if (!window.confirm("Invoice format default (sample stationery) par reset karein?")) return;
    const next = resetInvoiceFormat();
    setFormat(next);
    setSavedTick((n) => n + 1);
    appendActivityLog({
      user: session?.displayName ?? "Admin",
      action: "Invoice format reset to default",
    });
  };

  const openPreview = () => {
    const w = window.open("", "_blank", "noopener,noreferrer");
    if (!w) {
      window.alert("Popup blocked — preview iframe neeche dekhein.");
      return;
    }
    w.document.write(previewHtml);
    w.document.close();
  };

  return (
    <>
      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2>Invoice Format Editing</h2>
          <div className={styles.formatActions}>
            <button type="button" className={styles.btnOutline} onClick={openPreview}>
              Full Preview
            </button>
            <button type="button" className={styles.btnOutline} onClick={reset}>
              Reset Default
            </button>
            <button type="button" className={styles.btnPurple} onClick={save}>
              Save Format
            </button>
          </div>
        </div>
        <p className={styles.cardHint}>
          Yahan jo format save karoge wahi Sale Sheet → Generate Invoice / Download me dikhega.
          Logo upload karke company details, bank, HSN, item titles edit kar sakte ho.
        </p>

        <div className={styles.formatLayout}>
          <div className={styles.formatFields}>
            <h3 className={styles.subHead}>Logo</h3>
            <div className={styles.logoRow}>
              {format.logoDataUrl ? (
                <img src={format.logoDataUrl} alt="Invoice logo" className={styles.logoPreview} />
              ) : (
                <div className={styles.logoPlaceholder}>Default logo</div>
              )}
              <div className={styles.logoButtons}>
                <label className={styles.btnManage}>
                  Upload Logo Photo
                  <input type="file" accept="image/*" className={styles.hiddenFile} onChange={onLogoPick} />
                </label>
                {format.logoDataUrl ? (
                  <button type="button" className={styles.btnOutline} onClick={() => patch("logoDataUrl", "")}>
                    Remove Logo
                  </button>
                ) : null}
              </div>
            </div>

            <h3 className={styles.subHead}>Company header</h3>
            <div className={styles.seriesGrid}>
              <label>
                Title
                <input value={format.title} onChange={(e) => patch("title", e.target.value)} />
              </label>
              <label>
                Copy label
                <input value={format.copyLabel} onChange={(e) => patch("copyLabel", e.target.value)} />
              </label>
              <label className={styles.fullWidth}>
                Company name
                <input value={format.legalName} onChange={(e) => patch("legalName", e.target.value)} />
              </label>
              <label className={styles.fullWidth}>
                Address
                <input value={format.address} onChange={(e) => patch("address", e.target.value)} />
              </label>
              <label>
                Phones
                <input value={format.phones} onChange={(e) => patch("phones", e.target.value)} />
              </label>
              <label>
                GSTIN
                <input value={format.gstin} onChange={(e) => patch("gstin", e.target.value)} />
              </label>
              <label className={styles.fullWidth}>
                Tel / Email line
                <input
                  value={format.telEmailLine}
                  onChange={(e) => patch("telEmailLine", e.target.value)}
                />
              </label>
              <label>
                Place of Supply
                <input
                  value={format.placeOfSupply}
                  onChange={(e) => patch("placeOfSupply", e.target.value)}
                />
              </label>
              <label>
                Default Transport
                <input
                  value={format.transportDefault}
                  onChange={(e) => patch("transportDefault", e.target.value)}
                />
              </label>
            </div>

            <h3 className={styles.subHead}>Item lines &amp; GST</h3>
            <div className={styles.seriesGrid}>
              <label className={styles.fullWidth}>
                Solar item title
                <input
                  value={format.solarItemTitle}
                  onChange={(e) => patch("solarItemTitle", e.target.value)}
                />
              </label>
              <label className={styles.fullWidth}>
                Installation item title (use {"{setupKw}"})
                <input
                  value={format.installItemTitle}
                  onChange={(e) => patch("installItemTitle", e.target.value)}
                />
              </label>
              <label>
                Solar HSN
                <input value={format.solarHsn} onChange={(e) => patch("solarHsn", e.target.value)} />
              </label>
              <label>
                Install HSN
                <input
                  value={format.installHsn}
                  onChange={(e) => patch("installHsn", e.target.value)}
                />
              </label>
              <label>
                Solar share %
                <input
                  type="number"
                  value={format.solarSharePercent}
                  onChange={(e) => patch("solarSharePercent", e.target.value)}
                />
              </label>
              <label>
                Solar GST %
                <input
                  type="number"
                  value={format.solarGstPercent}
                  onChange={(e) => patch("solarGstPercent", e.target.value)}
                />
              </label>
              <label>
                Install GST %
                <input
                  type="number"
                  value={format.installGstPercent}
                  onChange={(e) => patch("installGstPercent", e.target.value)}
                />
              </label>
              <label>
                Unit
                <input value={format.unitLabel} onChange={(e) => patch("unitLabel", e.target.value)} />
              </label>
            </div>

            <h3 className={styles.subHead}>Bank details</h3>
            {format.banks.map((bank, index) => (
              <div key={`bank-${index}`} className={styles.bankBlock}>
                <div className={styles.seriesGrid}>
                  <label>
                    Bank name
                    <input
                      value={bank.name}
                      onChange={(e) => patchBank(index, "name", e.target.value)}
                    />
                  </label>
                  <label>
                    A/C No.
                    <input
                      value={bank.accountNo}
                      onChange={(e) => patchBank(index, "accountNo", e.target.value)}
                    />
                  </label>
                  <label>
                    IFSC
                    <input
                      value={bank.ifsc}
                      onChange={(e) => patchBank(index, "ifsc", e.target.value)}
                    />
                  </label>
                  <label>
                    Branch
                    <input
                      value={bank.branch}
                      onChange={(e) => patchBank(index, "branch", e.target.value)}
                    />
                  </label>
                </div>
              </div>
            ))}

            <h3 className={styles.subHead}>Terms (one per line)</h3>
            <label className={styles.fullWidth}>
              <textarea
                className={styles.termsArea}
                rows={5}
                value={(format.terms || []).join("\n")}
                onChange={(e) =>
                  patch(
                    "terms",
                    e.target.value.split("\n").map((line) => line),
                  )
                }
              />
            </label>

            <h3 className={styles.subHead}>Signatures</h3>
            <div className={styles.seriesGrid}>
              <label className={styles.fullWidth}>
                Signatory for
                <input
                  value={format.signatoryFor}
                  onChange={(e) => patch("signatoryFor", e.target.value)}
                />
              </label>
              <label>
                Authorised label
                <input
                  value={format.authorisedLabel}
                  onChange={(e) => patch("authorisedLabel", e.target.value)}
                />
              </label>
              <label>
                Receiver label
                <input
                  value={format.receiverLabel}
                  onChange={(e) => patch("receiverLabel", e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className={styles.previewPane}>
            <h3 className={styles.subHead}>Live preview (sample party)</h3>
            <iframe
              title="Invoice format preview"
              className={styles.previewFrame}
              srcDoc={previewHtml}
            />
            <div className={styles.sampleRef}>
              <h3 className={styles.subHead}>Aapka uploaded sample (reference)</h3>
              <img src="/invoice-format-sample.png" alt="Uploaded invoice format sample" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default InvoiceFormatSettings;
