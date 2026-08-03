import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { ensureSiteOrderInStorage } from "../../utils/siteOrderStorage";
import {
  buildSiteCatalogNameMap,
  mergeCatalogNameMaps,
} from "../../utils/siteStockCatalog";
import { resolveSiteOrder } from "../../utils/siteOrderUrl";
import {
  resyncSubmittedSiteFormToCloud,
  submitSiteInstallationForm,
} from "../../utils/siteOrderStockSubmit";
import styles from "./SiteOrderFormPage.module.css";

const INVERTER_KW_OPTIONS = ["02 KW", "03 KW", "05 KW"];
const STAND_OPTIONS = ["02 KW", "03 KW", "05 KW", "OTHER"];

/** Packed WhatsApp catalog + live Stock Sheet — Panel/Inverter/Wire stock se. */
function catalogFromOrder(order) {
  let live = {};
  try {
    live = buildSiteCatalogNameMap();
  } catch {
    live = {};
  }
  return mergeCatalogNameMaps(order?.stockCatalog || {}, live);
}

function StockSelect({ id, label, value, onChange, options, required, hint }) {
  const list = options || [];
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {list.length > 0 ? (
        <select id={id} value={value} onChange={onChange} required={required}>
          <option value="">{required ? "Stock se select…" : "Optional — stock se select…"}</option>
          {list.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      ) : (
        <>
          <select id={id} value="" disabled required={required}>
            <option value="">Stock me item nahi</option>
          </select>
          <p className={styles.hint}>
            {hint ||
              "Stock Sheet me balance nahi — office pe stock check / naya WhatsApp form bhejein."}
          </p>
        </>
      )}
    </div>
  );
}

function WireMeterRow({
  nameId,
  mtrId,
  label,
  name,
  setName,
  mtr,
  setMtr,
  wireOptions,
}) {
  return (
    <div className={styles.grid2}>
      <StockSelect
        id={nameId}
        label={`${label} name (optional)`}
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          if (!e.target.value) setMtr("");
        }}
        options={wireOptions}
      />
      <div className={styles.field}>
        <label htmlFor={mtrId}>{label} meter</label>
        <input
          id={mtrId}
          type="number"
          min="0"
          step="0.1"
          value={mtr}
          onChange={(e) => setMtr(e.target.value)}
          placeholder="Meter fill karein"
          disabled={!name}
        />
      </div>
    </div>
  );
}

function SiteOrderFormPage() {
  const { orderId } = useParams();
  const location = useLocation();
  const order = useMemo(
    () => resolveSiteOrder(orderId, location.search),
    [orderId, location.search],
  );

  const memberOptions = useMemo(() => {
    const fromEmp = Array.isArray(order?.employeeOptions) ? order.employeeOptions : [];
    const fromDefault = Array.isArray(order?.defaultMembers) ? order.defaultMembers : [];
    return [
      ...new Set(
        [...fromEmp, ...fromDefault].map((n) => String(n || "").trim()).filter(Boolean),
      ),
    ];
  }, [order?.employeeOptions, order?.defaultMembers]);

  const suggestedMembers = useMemo(() => {
    const list = Array.isArray(order?.defaultMembers) ? order.defaultMembers : [];
    return [...new Set(list.map((n) => String(n || "").trim()).filter(Boolean))];
  }, [order?.defaultMembers]);

  const stock = useMemo(() => catalogFromOrder(order), [order]);

  const [teamMembers, setTeamMembers] = useState([]);
  const [customMember, setCustomMember] = useState("");
  const [panelName, setPanelName] = useState("");
  const [panelQty, setPanelQty] = useState("");
  const [inverterKw, setInverterKw] = useState("02 KW");
  const [inverterName, setInverterName] = useState("");
  const [inverterSerial, setInverterSerial] = useState("");
  const [acBoxName, setAcBoxName] = useState("");
  const [acBoxQty, setAcBoxQty] = useState("");
  const [dcBoxName, setDcBoxName] = useState("");
  const [dcBoxQty, setDcBoxQty] = useState("");
  const [standKw, setStandKw] = useState("02 KW");
  const [standOther, setStandOther] = useState("");
  const [dcWireName, setDcWireName] = useState("");
  const [dcWireMtr, setDcWireMtr] = useState("");
  const [copperWireName, setCopperWireName] = useState("");
  const [copperWireMtr, setCopperWireMtr] = useState("");
  const [mainWireName, setMainWireName] = useState("");
  const [mainWireMtr, setMainWireMtr] = useState("");
  const [laName, setLaName] = useState("");
  const [laQty, setLaQty] = useState("");
  const [earthingName, setEarthingName] = useState("");
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
    /* Team helpers suggested — TL checkbox se confirm kare kaun saath tha */
    setTeamMembers(suggestedMembers.length ? suggestedMembers : []);
    const kw = String(order.setupKw || "").replace(/\s/g, "").toUpperCase();
    const inferred = kw.includes("05")
      ? "05 KW"
      : kw.includes("03")
        ? "03 KW"
        : "02 KW";
    setInverterKw(inferred);
    setStandKw(inferred);
    setPanelQty(String(order.panelCount || ""));
    if (stock.panels[0]) setPanelName(stock.panels[0]);
    if (stock.inverters[0]) setInverterName(stock.inverters[0]);
    ensureSiteOrderInStorage(order);
  }, [order, suggestedMembers, stock.panels, stock.inverters]);

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

  const addCustomMember = () => {
    const name = String(customMember || "").trim();
    if (!name) return;
    setTeamMembers((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setCustomMember("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    ensureSiteOrderInStorage(order);

    if (!teamMembers.length) {
      setError("Kam se kam 1 employee select karein jo aapke saath kaam kar raha tha.");
      return;
    }
    if (!String(panelName || "").trim()) {
      setError("Panel name Stock Sheet se select karein.");
      return;
    }
    if (!(Number(panelQty) > 0)) {
      setError("Panel quantity fill karein.");
      return;
    }
    if (!String(inverterName || "").trim()) {
      setError("Inverter name Stock Sheet se select karein.");
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
      const wireLines = [];
      if (Number(dcWireMtr) > 0 && String(dcWireName || "").trim()) {
        wireLines.push({
          itemName: String(dcWireName).trim(),
          category: "WIRE",
          qtyMtr: dcWireMtr,
        });
      }
      if (Number(copperWireMtr) > 0 && String(copperWireName || "").trim()) {
        wireLines.push({
          itemName: String(copperWireName).trim(),
          category: "WIRE",
          qtyMtr: copperWireMtr,
        });
      }
      if (Number(mainWireMtr) > 0 && String(mainWireName || "").trim()) {
        wireLines.push({
          itemName: String(mainWireName).trim(),
          category: "WIRE",
          qtyMtr: mainWireMtr,
        });
      }

      const result = await submitSiteInstallationForm(order, {
        teamMembers,
        panelName: String(panelName).trim(),
        panelQty: Number(panelQty),
        inverterKw,
        inverterName: String(inverterName).trim(),
        inverterSerial: String(inverterSerial || "").trim(),
        acBoxName: String(acBoxName || "").trim(),
        acBoxQty,
        dcBoxName: String(dcBoxName || "").trim(),
        dcBoxQty,
        standKw,
        standOther: String(standOther || "").trim(),
        dcWireName: String(dcWireName || "").trim(),
        dcWireMtr,
        copperWireName: String(copperWireName || "").trim(),
        copperWireMtr,
        mainWireName: String(mainWireName || "").trim(),
        mainWireMtr,
        wireLines,
        laName: String(laName || "").trim(),
        laQty,
        earthingName: String(earthingName || "").trim(),
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
      const bits = [];
      if (result.issuedLines) {
        bits.push(`Stock: ${result.issuedLines} line(s) less`);
      }
      if (result.cloudSynced) {
        bits.push("Office BOM Sheet me sync ho gaya.");
      } else {
        bits.push(
          `Office BOM sync pending: ${result.cloudMessage || "internet / API check"}. Neeche Retry dabayein.`,
        );
      }
      window.alert(`Site form save ho gaya.\n\n${bits.join("\n")}`);
    } catch (err) {
      setError(err?.message || "Submit fail.");
    } finally {
      setBusy(false);
    }
  };

  const handleResyncCloud = async () => {
    setError("");
    setBusy(true);
    try {
      ensureSiteOrderInStorage(order);
      const result = await resyncSubmittedSiteFormToCloud(order);
      if (!result.ok) {
        setError(result.message || "Office BOM sync fail.");
        return;
      }
      window.alert(result.message || "Office BOM Sheet me sync ho gaya.");
    } catch (err) {
      setError(err?.message || "Sync fail.");
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
            {done ? "Submitted" : "Pending — Panel / Inverter stock se select"}
          </span>
          <p className={styles.hint}>
            Panel name + Inverter name sirf Stock me jo available hain. Inverter Sr. No. manually
            bharein. Wire optional — name select, sirf meter fill. Yeh form Sale Sheet se optional
            hai.
          </p>
        </header>

        {done ? (
          <div>
            <p className={styles.hint}>
              Form submit ho chuka hai. Agar office BOM Sheet me abhi nahi dikha, neeche button se
              dubara sync karein.
            </p>
            <button
              type="button"
              className={styles.submit}
              disabled={busy}
              onClick={() => void handleResyncCloud()}
            >
              {busy ? "Syncing…" : "Office BOM me bhejein / Retry sync"}
            </button>
            {error ? <div className={styles.errorBox}>{error}</div> : null}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error ? <div className={styles.errorBox}>{error}</div> : null}

            <section className={styles.section}>
              <h2>Saath kaam karne wale employees *</h2>
              <p className={styles.hint}>
                Jo employees aaj aapke saath site pe kaam kar rahe hain, unhe select karein.
              </p>
              {memberOptions.length === 0 ? (
                <p className={styles.hint}>
                  Employee list link me nahi aayi — neeche naam likh kar Add karein. Office se naya
                  WhatsApp form bhejein (Labour Detail sync ke baad).
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
              {teamMembers.some((n) => !memberOptions.includes(n)) ? (
                <div className={styles.members}>
                  {teamMembers
                    .filter((n) => !memberOptions.includes(n))
                    .map((name) => (
                      <label key={`extra-${name}`}>
                        <input
                          type="checkbox"
                          checked
                          onChange={() => toggleMember(name)}
                        />
                        {name}
                      </label>
                    ))}
                </div>
              ) : null}
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label htmlFor="custom-member">Aur employee (name)</label>
                  <input
                    id="custom-member"
                    type="text"
                    value={customMember}
                    onChange={(e) => setCustomMember(e.target.value)}
                    placeholder="Naam likhein"
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="add-member-btn">&nbsp;</label>
                  <button
                    id="add-member-btn"
                    type="button"
                    className={styles.submit}
                    onClick={addCustomMember}
                    style={{ marginTop: 0 }}
                  >
                    Add employee
                  </button>
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <h2>Panel (Stock se select)</h2>
              <div className={styles.grid2}>
                <StockSelect
                  id="panel-name"
                  label="Panel name * (stock)"
                  value={panelName}
                  onChange={(e) => setPanelName(e.target.value)}
                  options={stock.panels}
                  required
                />
                <div className={styles.field}>
                  <label htmlFor="panel-qty">Quantity *</label>
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
              <h2>Inverter (Stock se select)</h2>
              <div className={styles.grid2}>
                <div className={styles.field}>
                  <label htmlFor="inv-kw">Inverter KW</label>
                  <select
                    id="inv-kw"
                    value={inverterKw}
                    onChange={(e) => setInverterKw(e.target.value)}
                  >
                    {INVERTER_KW_OPTIONS.map((kw) => (
                      <option key={kw} value={kw}>
                        {kw}
                      </option>
                    ))}
                  </select>
                </div>
                <StockSelect
                  id="inv-name"
                  label="Inverter name * (stock)"
                  value={inverterName}
                  onChange={(e) => setInverterName(e.target.value)}
                  options={stock.inverters}
                  required
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="inv-serial">Inverter Sr. No. (manually bharein)</label>
                <input
                  id="inv-serial"
                  type="text"
                  value={inverterSerial}
                  onChange={(e) => setInverterSerial(e.target.value)}
                  placeholder="Serial number type karein"
                />
              </div>
            </section>

            <section className={styles.section}>
              <h2>AC Box / DC Box (Product Sheet)</h2>
              <p className={styles.hint}>
                Jo items Product Sheet me AC BOX / DC BOX category se add hain, wahi select
                karein — stock + BOM auto update.
              </p>
              <div className={styles.grid2}>
                <StockSelect
                  id="ac-box-name"
                  label="AC Box name"
                  value={acBoxName}
                  onChange={(e) => setAcBoxName(e.target.value)}
                  options={stock.acBoxes}
                />
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
                    disabled={!acBoxName}
                  />
                </div>
              </div>
              <div className={styles.grid2}>
                <StockSelect
                  id="dc-box-name"
                  label="DC Box name"
                  value={dcBoxName}
                  onChange={(e) => setDcBoxName(e.target.value)}
                  options={stock.dcBoxes}
                />
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
                    disabled={!dcBoxName}
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
            </section>

            <section className={styles.section}>
              <h2>Wire (optional)</h2>
              <p className={styles.hint}>
                Wire optional. Pehle stock se wire name select, phir sirf meter fill karein.
              </p>
              <WireMeterRow
                nameId="dc-wire-name"
                mtrId="dc-wire"
                label="DC Wire"
                name={dcWireName}
                setName={setDcWireName}
                mtr={dcWireMtr}
                setMtr={setDcWireMtr}
                wireOptions={stock.wires}
              />
              <WireMeterRow
                nameId="copper-wire-name"
                mtrId="copper-wire"
                label="Copper Wire"
                name={copperWireName}
                setName={setCopperWireName}
                mtr={copperWireMtr}
                setMtr={setCopperWireMtr}
                wireOptions={stock.wires}
              />
              <WireMeterRow
                nameId="main-wire-name"
                mtrId="main-wire"
                label="Main Wire"
                name={mainWireName}
                setName={setMainWireName}
                mtr={mainWireMtr}
                setMtr={setMainWireMtr}
                wireOptions={stock.wires}
              />
            </section>

            <section className={styles.section}>
              <h2>LA / Earthing (Product Sheet → BOM)</h2>
              <p className={styles.hint}>
                Product Sheet (GENERAL) me LA / Earthing items select karein — submit par stock
                less + BOM Sheet me auto lines.
              </p>
              <StockSelect
                id="la-name"
                label="LA name (optional)"
                value={laName}
                onChange={(e) => setLaName(e.target.value)}
                options={stock.laItems}
              />
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
                  disabled={!laName}
                />
              </div>
              <StockSelect
                id="earth-name"
                label="Earthing name (optional)"
                value={earthingName}
                onChange={(e) => setEarthingName(e.target.value)}
                options={stock.earthingItems}
              />
              <div className={styles.field}>
                <label htmlFor="earth-qty">Earthing quantity</label>
                <input
                  id="earth-qty"
                  type="number"
                  min="0"
                  step="1"
                  value={earthingRodQty}
                  onChange={(e) => setEarthingRodQty(e.target.value)}
                  placeholder="Nos"
                  disabled={!earthingName}
                />
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
              </div>
              <div className={styles.field}>
                <label htmlFor="complete-file">Complete file upload</label>
                <input
                  id="complete-file"
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.zip"
                  onChange={(e) => setCompleteFile(e.target.files?.[0] || null)}
                />
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
