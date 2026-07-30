import { useMemo, useState } from "react";
import {
  getLoanQuotationFormat,
  readFileAsDataUrlLimited,
  resetLoanQuotationFormat,
  saveLoanQuotationFormat,
} from "../../utils/loanQuotationFormatStorage";
import { buildLoanQuotationFormatPreviewHtml } from "../../utils/loanQuotationDocuments";
import { appendActivityLog } from "../../utils/settingsStorage";
import styles from "./SettingsPage.module.css";

function LoanQuotationFormatSettings({ session }) {
  const [format, setFormat] = useState(() => getLoanQuotationFormat());
  const [savedTick, setSavedTick] = useState(0);

  const previewHtml = useMemo(
    () => buildLoanQuotationFormatPreviewHtml(format),
    [format, savedTick],
  );

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

  const onSignPick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrlLimited(file);
      patch("signDataUrl", dataUrl);
    } catch (err) {
      window.alert(err?.message || "Signature upload fail.");
    }
  };

  const installSharePercent = Math.max(0, 100 - (Number(format.solarSharePercent) || 0));

  const save = () => {
    if (!format.legalName?.trim()) {
      window.alert("Company name zaroori hai.");
      return;
    }
    const ok = saveLoanQuotationFormat(format);
    if (!ok) {
      window.alert("Save fail — image bahut badi ho sakti hai.");
      return;
    }
    appendActivityLog({
      user: session?.displayName ?? "Admin",
      action: "Loan Quotation format updated",
    });
    setSavedTick((n) => n + 1);
    window.alert("Loan Quotation format save ho gaya. Loan Case → Generate Quotation isi format me aayega.");
  };

  const reset = () => {
    if (!window.confirm("Loan Quotation format default par reset karein?")) return;
    const next = resetLoanQuotationFormat();
    setFormat(next);
    setSavedTick((n) => n + 1);
    appendActivityLog({
      user: session?.displayName ?? "Admin",
      action: "Loan Quotation format reset",
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
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <h2>Loan Quotation Format</h2>
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
        Sample jaisa <strong>Sales Quotation</strong> format. Item-1: setup KW + DCR PANNEL / ONGRID
        INVERTER auto. Item-2 details sample jaisi. Loan Case → Generate Quotation. Series: Settings →
        Quotation Series. Pehle se save format ho to <strong>Reset Default</strong> se naya sample
        defaults lao.
      </p>

      <div className={styles.formatLayout}>
        <div className={styles.formatFields}>
          <h3 className={styles.subHead}>Logo</h3>
          <div className={styles.logoRow}>
            {format.logoDataUrl ? (
              <img src={format.logoDataUrl} alt="Quotation logo" className={styles.logoPreview} />
            ) : (
              <div className={styles.logoPlaceholder}>Default logo</div>
            )}
            <div className={styles.logoButtons}>
              <label className={styles.btnManage}>
                Upload Logo
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
              <input value={format.telEmailLine} onChange={(e) => patch("telEmailLine", e.target.value)} />
            </label>
            <label>
              Billed to label
              <input value={format.billedToLabel} onChange={(e) => patch("billedToLabel", e.target.value)} />
            </label>
          </div>

          <h3 className={styles.subHead}>Item lines &amp; GST split</h3>
          <p className={styles.cardHint}>
            Setup se auto: <strong>02 KW DCR PANNEL</strong> / <strong>02 KW ONGRID INVERTER</strong>{" "}
            (03 KW / 05 KW bhi setup ke hisaab se). Installation details sample jaisi fixed.
          </p>
          <div className={styles.seriesGrid}>
            <label className={styles.fullWidth}>
              Solar item title
              <input value={format.solarItemTitle} onChange={(e) => patch("solarItemTitle", e.target.value)} />
            </label>
            <label>
              Panel detail label
              <input
                value={format.panelDetailLabel || "DCR PANNEL"}
                onChange={(e) => patch("panelDetailLabel", e.target.value)}
              />
            </label>
            <label>
              Inverter detail label
              <input
                value={format.inverterDetailLabel || "ONGRID INVERTER"}
                onChange={(e) => patch("inverterDetailLabel", e.target.value)}
              />
            </label>
            <label className={styles.fullWidth}>
              Installation item title
              <input value={format.installItemTitle} onChange={(e) => patch("installItemTitle", e.target.value)} />
            </label>
            <label className={styles.fullWidth}>
              Installation detail lines (one per line)
              <textarea
                className={styles.termsArea}
                rows={3}
                value={(format.installDetailLines || []).join("\n")}
                onChange={(e) => patch("installDetailLines", e.target.value.split("\n"))}
              />
            </label>
            <label>
              Solar HSN
              <input value={format.solarHsn} onChange={(e) => patch("solarHsn", e.target.value)} />
            </label>
            <label>
              Install HSN
              <input value={format.installHsn} onChange={(e) => patch("installHsn", e.target.value)} />
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
              Install share % (auto)
              <input type="number" value={installSharePercent} readOnly />
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
          </div>

          <h3 className={styles.subHead}>Bank details</h3>
          {format.banks.map((bank, index) => (
            <div key={`bank-${index}`} className={styles.bankBlock}>
              <div className={styles.seriesGrid}>
                <label>
                  Bank name
                  <input value={bank.name} onChange={(e) => patchBank(index, "name", e.target.value)} />
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
                  <input value={bank.ifsc} onChange={(e) => patchBank(index, "ifsc", e.target.value)} />
                </label>
                <label>
                  Branch
                  <input value={bank.branch} onChange={(e) => patchBank(index, "branch", e.target.value)} />
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
              onChange={(e) => patch("terms", e.target.value.split("\n"))}
            />
          </label>

          <h3 className={styles.subHead}>Signatures</h3>
          <div className={styles.logoRow}>
            {format.signDataUrl ? (
              <img src={format.signDataUrl} alt="Sign" className={styles.signPreview} />
            ) : (
              <div className={styles.logoPlaceholder}>No digital sign</div>
            )}
            <div className={styles.logoButtons}>
              <label className={styles.btnManage}>
                Upload Digital Sign
                <input type="file" accept="image/*" className={styles.hiddenFile} onChange={onSignPick} />
              </label>
              {format.signDataUrl ? (
                <button type="button" className={styles.btnOutline} onClick={() => patch("signDataUrl", "")}>
                  Remove Sign
                </button>
              ) : null}
            </div>
          </div>
          <div className={styles.seriesGrid}>
            <label className={styles.fullWidth}>
              Signatory for
              <input value={format.signatoryFor} onChange={(e) => patch("signatoryFor", e.target.value)} />
            </label>
            <label>
              Authorised label
              <input value={format.authorisedLabel} onChange={(e) => patch("authorisedLabel", e.target.value)} />
            </label>
            <label>
              Receiver label
              <input value={format.receiverLabel} onChange={(e) => patch("receiverLabel", e.target.value)} />
            </label>
          </div>
        </div>

        <div className={styles.previewPane}>
          <h3 className={styles.subHead}>Live preview</h3>
          <iframe title="Loan quotation preview" className={styles.previewFrame} srcDoc={previewHtml} />
          <div className={styles.sampleRef}>
            <h3 className={styles.subHead}>Uploaded sample (reference)</h3>
            <img src="/loan-quotation-format-sample.png" alt="Loan quotation format sample" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default LoanQuotationFormatSettings;
