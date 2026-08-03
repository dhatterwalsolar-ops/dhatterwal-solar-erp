import { useState } from "react";
import { Link } from "react-router-dom";
import { CONTACT } from "../../constants/contact";
import { ROUTES } from "../../constants/routes";
import { getApiBase } from "../../utils/erpStorage";
import { compressImageFileToDataUrl } from "../../utils/imageCompress";
import styles from "./PublicQueryPage.module.css";

const empty = {
  customerName: "",
  mobile: "",
  address: "",
  consumerNo: "",
  queryAbout: "",
  detail: "",
};

function PublicQueryPage() {
  const [form, setForm] = useState(empty);
  const [photoData, setPhotoData] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const patch = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const onPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      setPhotoData(dataUrl);
      setPhotoName(file.name || "site-photo.jpg");
    } catch (err) {
      setPhotoData("");
      setPhotoName("");
      setError(err?.message || "Photo upload fail.");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const base = getApiBase() || "https://dhatterwal-solar-erp.onrender.com";
      if (!base) {
        throw new Error("Server URL missing. Baad me try karein ya office ko call karein.");
      }
      const mobile = String(form.mobile).replace(/\D/g, "").slice(-10);
      if (!form.customerName.trim()) throw new Error("Apna naam likhein.");
      if (mobile.length !== 10) throw new Error("Sahi 10 digit mobile likhein.");
      if (!form.address.trim()) throw new Error("Address likhein.");
      if (!form.queryAbout.trim()) throw new Error("Query about likhein.");
      if (!form.detail.trim()) throw new Error("Query detail likhein.");

      const res = await fetch(`${base}/api/public/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: form.customerName.trim(),
          mobile,
          address: form.address.trim(),
          consumerNo: form.consumerNo.trim(),
          queryAbout: form.queryAbout.trim(),
          detail: form.detail.trim(),
          customerPhotoData: photoData || "",
          customerPhotoName: photoName || "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Submit fail. Dubara try karein.");
      }

      setDone(true);
      setForm(empty);
      setPhotoData("");
      setPhotoName("");
    } catch (err) {
      setError(err?.message || "Submit fail.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to={ROUTES.HOME} className={styles.brand}>
          DHATTERWAL SOLAR
        </Link>
        <p className={styles.tag}>Service Query Portal</p>
      </header>

      <main className={styles.card}>
        <h1>Apni Query Submit Karein</h1>
        <p className={styles.lead}>
          Detail + inverter/site photo bhar ke sirf <strong>Submit</strong> dabayein. Office ERP
          automatically action lega — aapke phone pe WhatsApp nahi khulega.
        </p>

        {done ? (
          <div className={styles.success}>
            <strong>Query submit ho gayi.</strong>
            <p>
              Dhanyavaad. Office jaldi contact karega. Zarurat ho to call: {CONTACT.primaryDisplay}
            </p>
            <button type="button" className={styles.btn} onClick={() => setDone(false)}>
              Aur query bhejein
            </button>
            <Link to={ROUTES.HOME} className={styles.linkHome}>
              ← Home
            </Link>
          </div>
        ) : (
          <form className={styles.form} onSubmit={submit}>
            <label>
              Customer name *
              <input
                value={form.customerName}
                onChange={(e) => patch("customerName", e.target.value)}
                required
              />
            </label>
            <label>
              Mobile number *
              <input
                value={form.mobile}
                onChange={(e) => patch("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
                inputMode="numeric"
                required
              />
            </label>
            <label>
              Address *
              <textarea
                rows={2}
                value={form.address}
                onChange={(e) => patch("address", e.target.value)}
                required
              />
            </label>
            <label>
              Consumer No. (agar pata ho)
              <input
                value={form.consumerNo}
                onChange={(e) => patch("consumerNo", e.target.value)}
                placeholder="Optional"
              />
            </label>
            <label>
              Query about *
              <input
                value={form.queryAbout}
                onChange={(e) => patch("queryAbout", e.target.value)}
                placeholder="e.g. Inverter problem / Wiring"
                required
              />
            </label>
            <label>
              Query detail *
              <textarea
                rows={4}
                value={form.detail}
                onChange={(e) => patch("detail", e.target.value)}
                placeholder="Poori problem likhein..."
                required
              />
            </label>
            <label>
              Inverter / site photo (error dikhne ke liye)
              <input type="file" accept="image/*" capture="environment" onChange={onPhoto} />
            </label>
            {photoData ? (
              <div className={styles.previewWrap}>
                <img src={photoData} alt="Upload preview" className={styles.preview} />
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => {
                    setPhotoData("");
                    setPhotoName("");
                  }}
                >
                  Photo hatao
                </button>
              </div>
            ) : (
              <p className={styles.photoHint}>
                Photo optional hai, lekin error dikhane ke liye best hai.
              </p>
            )}
            {error ? <p className={styles.error}>{error}</p> : null}
            <button type="submit" className={styles.btn} disabled={busy}>
              {busy ? "Sending…" : "Submit Query"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}

export default PublicQueryPage;
