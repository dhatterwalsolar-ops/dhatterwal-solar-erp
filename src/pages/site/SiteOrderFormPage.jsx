import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { ensureSiteOrderInStorage } from "../../utils/siteOrderStorage";
import { resolveSiteOrder } from "../../utils/siteOrderUrl";
import { submitSiteInstallationForm } from "../../utils/siteOrderStockSubmit";
import styles from "./SiteOrderFormPage.module.css";

const INVERTER_KW_OPTIONS = ["02 KW", "03 KW", "05 KW"];
const STAND_OPTIONS = ["02 KW", "03 KW", "05 KW", "OTHER"];

function SiteOrderFormPage() {
  const { orderId } = useParams();
  const location = useLocation();
  const order = useMemo(
    () => resolveSiteOrder(orderId, location.search),
    [orderId, location.search],
  );

  const memberOptions = useMemo(() => {
    const list = Array.isArray(order?.defaultMembers) ? order.defaultMembers : [];
    return [...new Set(list.map((n) => String(n || "").trim()).filter(Boolean))];
  }, [order?.defaultMembers]);

  const [teamMembers, setTeamMembers] = useState([]);
  const [panelName, setPanelName] = useState("Solar Panel");
  const [panelQty, setPanelQty] = useState("");
  const [inverterKw, setInverterKw] = useState("02 KW");
  const [inverterName, setInverterName] = useState("");
  const [inverterSerial, setInverterSerial] = useState("");
  const [acBoxQty, setAcBoxQty] = useState("");
  const [dcBoxQty, setDcBoxQty] = useState("");
  const [standKw, setStandKw] = useState("02 KW");
  const [standOther, setStandOther] = useState("");
  const [dcWireMtr, setDcWireMtr] = useState("");
  const [copperWireMtr, setCopperWireMtr] = useState("");
  const [mainWireMtr, setMainWireMtr] = useState("");
  const [laQty, setLaQty] = useState("");
  const [earthingRodQty, setEarthingRodQty] = useState("");
  const [siteGpsPhoto, setSiteGpsPhoto] = useState(null);
  const [earthingPhoto, setEarthingPhoto] = useState(null);
  const [completeFile, setCompleteFile] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!order) return;
    setDone(order.status === "submitted");
    setTeamMembers(memberOptions);
    const kw = String(order.setupKw || "").replace(/\s/g, "").toUpperCase();
    const inferred = kw.includes("05")
      ? "05 KW"
      : kw.includes("03")
        ? "03 KW"
        : "02 KW";
    setInverterKw(inferred);
    setStandKw(inferred);
    setPanelQty(String(order.panelCount || ""));
    setInverterName(order.setupKw ? `Inverter (${inferred})` : "Inverter");
    ensureSiteOrderInStorage(order);
  }, [order, memberOptions]);

  if (!order) {
    return (
      <div className={styles.sitePage}>
        <div className={styles.card}>
          <p className={styles.empty}>
            Site form link khul nahi paya. Naya link Sale Sheet se WhatsApp karein — purana link
            expire ho sakta hai.
          </p>
        </div>
      </div>
    );
  }

  const toggleMember = (name) => {
    setTeamMembers((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    ensureSiteOrderInStorage(order);

    if (!String(panelName || "").trim()) {
      setError("Panel name fill karein.");
      return;
    }
    if (!(Number(panelQty) > 0)) {
      setError("Panel quantity fill karein.");
      return;
    }
    if (!siteGpsPhoto) {
      setError("Site GPS photo upload karein.");
      return;
    }
    if (!earthingPhoto) {
      setError("Earthing photo upload karein.");
      return;
    }

    setBusy(true);
    try {
      const result = await submitSiteInstallationForm(order, {
        teamMembers,
        panelName: String(panelName).trim(),
        panelQty: Number(panelQty),
        inverterKw,
        inverterName:
          String(inverterName || "").trim() || `Inverter (${inverterKw})`,
        inverterSerial: String(inverterSerial || "").trim(),
        acBoxQty,
        dcBoxQty,
        standKw,
        standOther: String(standOther || "").trim(),
        dcWireMtr,
        copperWireMtr,
        mainWireMtr,
        laQty,
        earthingRodQty,
        siteGpsPhoto,
        earthingPhoto,
        completeFile,
      });
      if (!result.ok) {
        setError(result.message || "Submit fail.");
        return;
      }
      setDone(true);
      window.alert(
        result.issuedLines
          ? `Site form save ho gaya. Stock se ${result.issuedLines} line(s) less ho gayi.`
          : "Site form save ho gaya (BOM / photos / materials).",
      );
    } catch (err) {
      setError(err?.message || "Submit fail.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.sitePage}>
      <div className={styles.card}>
        <header className={styles.head}>
          <h1>Site Installation Form</h1>
          <p className={styles.meta}>
            <strong>{order.customerName}</strong> · {order.consumerNo}
            <br />
            {order.fatherName ? (
              <>
                Father/Husband: {order.fatherName}
                <br />
              </>
            ) : null}
            {order.address}
            <br />
            Setup: {order.setupKw} · Team: {order.teamWork}
            <br />
            Leader: {order.teamLeaderName || "—"}
            <br />
            Site date: {order.siteDate}
          </p>
          <span className={`${styles.badge} ${done ? styles.badgeDone : ""}`}>
            {done ? "Submitted" : "Pending — detail bharein"}
          </span>
        </header>

        {done ? (
          <p className={styles.hint}>Form submit ho chuka hai.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            {error ? <div className={styles.errorBox}>{error}</div> : null}

            <section className={styles.section}>
              <h2>Team ke saath kaam karne wale employee</h2>
              {memberOptions.length === 0 ? (
                <p className={styles.hint}>
                  Is Team Leader ke Helpers Labour Detail me add nahi mile. Office me Labour Details
                  → Helper + Team Leader link karke naya WhatsApp link bhejein.
                </p>
              ) : (
                <div className={styles.members}>
                  {memberOptions.map((name) => (
                    <label key={name}>
                      <input
                        type="checkbox"
                        checked={teamMembers.includes(name)}
                        onChange={() => toggleMember(name)}
                      />
                      {name}
                    </label>
                  ))}
                </div>
              )}
            </section>

            <section className={styles.section}>
              <h2>Panel</h2>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label htmlFor="panel-name">Panel name</label>
                  <input
                    id="panel-name"
                    type="text"
                    value={panelName}
                    onChange={(e) => setPanelName(e.target.value)}
                    placeholder="Panel name"
                    required
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="panel-qty">Quantity</label>
                  <input
                    id="panel-qty"
                    type="number"
                    min="1"
                    step="1"
                    value={panelQty}
                    onChange={(e) => setPanelQty(e.target.value)}
                    placeholder="Nos"
                    required
                  />
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <h2>Inverter</h2>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label htmlFor="inv-kw">Inverter KW</label>
                  <select
                    id="inv-kw"
                    value={inverterKw}
                    onChange={(e) => {
                      const v = e.target.value;
                      setInverterKw(v);
                      setInverterName((prev) =>
                        !prev || /^Inverter/i.test(prev) ? `Inverter (${v})` : prev,
                      );
                    }}
                  >
                    {INVERTER_KW_OPTIONS.map((kw) => (
                      <option key={kw} value={kw}>
                        {kw}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="inv-name">Inverter name</label>
                  <input
                    id="inv-name"
                    type="text"
                    value={inverterName}
                    onChange={(e) => setInverterName(e.target.value)}
                    placeholder="Inverter model / name"
                  />
                </div>
              </div>
              <div className={styles.field}>
                <label htmlFor="inv-serial">Inverter Sr. No. (optional)</label>
                <input
                  id="inv-serial"
                  type="text"
                  value={inverterSerial}
                  onChange={(e) => setInverterSerial(e.target.value)}
                  placeholder="Inverter serial number"
                />
              </div>
            </section>

            <section className={styles.section}>
              <h2>AC Box / DC Box</h2>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label htmlFor="ac-box">AC Box quantity</label>
                  <input
                    id="ac-box"
                    type="number"
                    min="0"
                    step="1"
                    value={acBoxQty}
                    onChange={(e) => setAcBoxQty(e.target.value)}
                    placeholder="Nos"
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="dc-box">DC Box quantity</label>
                  <input
                    id="dc-box"
                    type="number"
                    min="0"
                    step="1"
                    value={dcBoxQty}
                    onChange={(e) => setDcBoxQty(e.target.value)}
                    placeholder="Nos"
                  />
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <h2>Stand</h2>
              <div className={styles.field}>
                <label htmlFor="stand-kw">Stand KW (BOM payment type)</label>
                <select
                  id="stand-kw"
                  value={standKw}
                  onChange={(e) => setStandKw(e.target.value)}
                >
                  {STAND_OPTIONS.map((kw) => (
                    <option key={kw} value={kw}>
                      {kw}
                    </option>
                  ))}
                </select>
              </div>
              {standKw === "OTHER" ? (
                <div className={styles.field}>
                  <label htmlFor="stand-other">Stand detail (OTHER)</label>
                  <input
                    id="stand-other"
                    type="text"
                    value={standOther}
                    onChange={(e) => setStandOther(e.target.value)}
                    placeholder="Stand type / size"
                  />
                </div>
              ) : null}
              <p className={styles.hint}>
                Stand daily rate BOM Sheet me office manually fill karega.
              </p>
            </section>

            <section className={styles.section}>
              <h2>Wire (meter me — alag alag)</h2>
              <div className={styles.field}>
                <label htmlFor="dc-wire">DC Wire (mtr)</label>
                <input
                  id="dc-wire"
                  type="number"
                  min="0"
                  step="0.1"
                  value={dcWireMtr}
                  onChange={(e) => setDcWireMtr(e.target.value)}
                  placeholder="Meter"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="copper-wire">Copper Wire (mtr)</label>
                <input
                  id="copper-wire"
                  type="number"
                  min="0"
                  step="0.1"
                  value={copperWireMtr}
                  onChange={(e) => setCopperWireMtr(e.target.value)}
                  placeholder="Meter"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="main-wire">Main Wire (mtr)</label>
                <input
                  id="main-wire"
                  type="number"
                  min="0"
                  step="0.1"
                  value={mainWireMtr}
                  onChange={(e) => setMainWireMtr(e.target.value)}
                  placeholder="Meter"
                />
              </div>
            </section>

            <section className={styles.section}>
              <h2>LA / Earthing Rod</h2>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label htmlFor="la-qty">LA quantity</label>
                  <input
                    id="la-qty"
                    type="number"
                    min="0"
                    step="1"
                    value={laQty}
                    onChange={(e) => setLaQty(e.target.value)}
                    placeholder="Nos"
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="earth-qty">Earthing Rod quantity</label>
                  <input
                    id="earth-qty"
                    type="number"
                    min="0"
                    step="1"
                    value={earthingRodQty}
                    onChange={(e) => setEarthingRodQty(e.target.value)}
                    placeholder="Nos"
                  />
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <h2>Photos / Complete file</h2>
              <div className={styles.field}>
                <label htmlFor="gps-photo">Site GPS photo *</label>
                <input
                  id="gps-photo"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => setSiteGpsPhoto(e.target.files?.[0] || null)}
                  required
                />
                {siteGpsPhoto ? (
                  <p className={styles.hint}>Selected: {siteGpsPhoto.name}</p>
                ) : null}
              </div>
              <div className={styles.field}>
                <label htmlFor="earth-photo">Earthing photo *</label>
                <input
                  id="earth-photo"
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => setEarthingPhoto(e.target.files?.[0] || null)}
                  required
                />
                {earthingPhoto ? (
                  <p className={styles.hint}>Selected: {earthingPhoto.name}</p>
                ) : null}
              </div>
              <div className={styles.field}>
                <label htmlFor="complete-file">Complete file upload</label>
                <input
                  id="complete-file"
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.zip"
                  onChange={(e) => setCompleteFile(e.target.files?.[0] || null)}
                />
                {completeFile ? (
                  <p className={styles.hint}>Selected: {completeFile.name}</p>
                ) : (
                  <p className={styles.hint}>Optional — poori site file / PDF</p>
                )}
              </div>
            </section>

            <button type="submit" className={styles.submit} disabled={busy}>
              {busy ? "Saving…" : "Submit"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default SiteOrderFormPage;
