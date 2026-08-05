import { useEffect, useState } from "react";
import { fetchGstApiStatus } from "../../utils/gstApiClient";
import styles from "./SettingsPage.module.css";

function GstApiSettings() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const res = await fetchGstApiStatus();
      setStatus(res);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <section className={styles.card}>
      <div className={styles.cardHead}>
        <div>
          <h2>GST Invoice + E-Way Bill API</h2>
          <p className={styles.cardHint}>
            Sale → With GST invoice pe <strong>E-Invoice IRN</strong> API call hoti hai; E-Way Bill
            modal se <strong>E-Way generate</strong> API. Abhi default <strong>demo</strong> mode
            hai — live NIC/GSP ke liye Railway env set karein.
          </p>
        </div>
        <button type="button" className={styles.btnOutline} disabled={busy} onClick={load}>
          {busy ? "Checking…" : "Refresh status"}
        </button>
      </div>

      {status ? (
        <div className={styles.seriesGrid}>
          <label>
            Provider
            <input readOnly value={status.provider || "—"} />
          </label>
          <label>
            Configured
            <input readOnly value={status.configured ? "Yes" : "No"} />
          </label>
          <label>
            GSTIN set
            <input readOnly value={status.gstinSet ? "Yes" : "No"} />
          </label>
          <label className={styles.previewField}>
            Status
            <input className={styles.previewInput} readOnly value={status.message || status.error || "—"} />
          </label>
        </div>
      ) : (
        <p className={styles.cardHint}>Status load ho raha hai…</p>
      )}

      <h3 className={styles.subHead} style={{ marginTop: "1rem" }}>
        Railway / server/.env (live GSP)
      </h3>
      <ol className={styles.cardHint} style={{ paddingLeft: "1.2rem", lineHeight: 1.55 }}>
        <li>
          <code>GST_API_PROVIDER=demo</code> — test IRN / EWB (abhi)
        </li>
        <li>
          Live: <code>GST_API_PROVIDER=http</code>
        </li>
        <li>
          <code>GST_API_BASE_URL=</code> aapka GSP URL (ClearTax / MasterGST / NIC sandbox…)
        </li>
        <li>
          <code>GST_API_KEY</code> / <code>GST_API_SECRET</code> ya username/password
        </li>
        <li>
          <code>GST_GSTIN=06JKPPK6453K1ZE</code> (company GSTIN)
        </li>
        <li>
          Paths (optional): <code>GST_EWAY_PATH</code>, <code>GST_EINVOICE_PATH</code>
        </li>
        <li>Save → Railway redeploy</li>
      </ol>
      <p className={styles.cardHint}>
        API endpoints: <code>POST /api/gst/eway/generate</code> ·{" "}
        <code>POST /api/gst/einvoice/generate</code> · <code>GET /api/gst/status</code>
      </p>
    </section>
  );
}

export default GstApiSettings;
