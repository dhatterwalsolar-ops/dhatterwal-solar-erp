import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { ensureSiteOrderInStorage } from "../../utils/siteOrderStorage";
import { buildSiteStockCatalog, stockCatalogNames } from "../../utils/siteStockCatalog";
import { resolveSiteOrder } from "../../utils/siteOrderUrl";
import { submitSiteInstallationForm } from "../../utils/siteOrderStockSubmit";
import styles from "./SiteOrderFormPage.module.css";

const INVERTER_KW_OPTIONS = ["02 KW", "03 KW", "05 KW"];
const STAND_OPTIONS = ["02 KW", "03 KW", "05 KW", "OTHER"];

function catalogFromOrder(order) {
  const fromOrder = order?.stockCatalog;
  if (
    fromOrder &&
    (fromOrder.panels?.length ||
      fromOrder.inverters?.length ||
      fromOrder.wires?.length ||
      fromOrder.acBoxes?.length ||
      fromOrder.dcBoxes?.length ||
      fromOrder.laItems?.length ||
      fromOrder.earthingItems?.length)
  ) {
    return {
      panels: fromOrder.panels || [],
      inverters: fromOrder.inverters || [],
      acBoxes: fromOrder.acBoxes || [],
      dcBoxes: fromOrder.dcBoxes || [],
      wires: fromOrder.wires || [],
      laItems: fromOrder.laItems || [],
      earthingItems: fromOrder.earthingItems || [],
    };
  }
  try {
    const live = buildSiteStockCatalog();
    return {
      panels: stockCatalogNames(live.panels),
      inverters: stockCatalogNames(live.inverters),
      acBoxes: stockCatalogNames(live.acBoxes),
      dcBoxes: stockCatalogNames(live.dcBoxes),
      wires: stockCatalogNames(live.wires),
      laItems: stockCatalogNames(live.laItems),
      earthingItems: stockCatalogNames(live.earthingItems),
    };
  } catch {
    return {
      panels: [],
      inverters: [],
      acBoxes: [],
      dcBoxes: [],
      wires: [],
      laItems: [],
      earthingItems: [],
    };
  }
}

function StockSelect({ id, label, value, onChange, options, required, hint }) {
  const list = options || [];
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      {list.length > 0 ? (
        <select id={id} value={value} onChange={onChange} required={required}>
          <option value="">{required ? "Select…" : "Optional — select…"}</option>
          {list.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      ) : (
        <>
          <input
            id={id}
            type="text"
            value={value}
            onChange={onChange}
            placeholder={required ? "Stock list empty — name likhein" : "Optional"}
            required={required}
          />
          <p className={styles.hint}>
            {hint ||
              "Product Sheet / stock me item nahi — office ERP pe Product Sheet me add karein."}
          </p>
        </>
      )}
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
    const list = Array.isArray(order?.defaultMembers) ? order.defaultMembers : [];
    return [...new Set(list.map((n) => String(n || "").trim()).filter(Boolean))];
  }, [order?.defaultMembers]);

  const stock = useMemo(() => catalogFromOrder(order), [order]);

  const [teamMembers, setTeamMembers] = useState([]);
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
    if (stock.panels[0]) setPanelName(stock.panels[0]);
    if (stock.inverters[0]) setInverterName(stock.inverters[0]);
    ensureSiteOrderInStorage(order);
  }, [order, memberOptions, stock.panels, stock.inverters]);

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
      setError("Panel name stock se select karein.");
      return;
    }
    if (!(Number(panelQty) > 0)) {
      setError("Panel quantity fill karein.");
      return;
    }
    if (!String(inverterName || "").trim()) {
      setError("Inverter name stock se select karein.");
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
            {done ? "Submitted" : "Pending — stock se select karke bharein"}
          </span>
          <p className={styles.hint}>
            Panel / Inverter / AC-DC Box / Wire — sirf stock me maujood names select karein taaki
            stock sahi update ho.
          </p>
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
                  Is Team Leader ke Helpers Labour Detail me add nahi mile.
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
              <h2>Panel (stock)</h2>
              <div className={styles.grid2}>
                <StockSelect
                  id="panel-name"
                  label="Panel name *"
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
              <h2>Inverter (stock)</h2>
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
                  label="Inverter name *"
                  value={inverterName}
                  onChange={(e) => setInverterName(e.target.value)}
                  options={stock.inverters}
                  required
                />
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
              <h2>Wire (optional — stock name + meter)</h2>
              <p className={styles.hint}>
                Wire optional hai. Agar meter bharein to pehle stock se wire name select karein.
              </p>
              <StockSelect
                id="dc-wire-name"
                label="DC Wire name (optional)"
                value={dcWireName}
                onChange={(e) => setDcWireName(e.target.value)}
                options={stock.wires}
              />
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
                  disabled={!dcWireName}
                />
              </div>
              <StockSelect
                id="copper-wire-name"
                label="Copper Wire name (optional)"
                value={copperWireName}
                onChange={(e) => setCopperWireName(e.target.value)}
                options={stock.wires}
              />
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
                  disabled={!copperWireName}
                />
              </div>
              <StockSelect
                id="main-wire-name"
                label="Main Wire name (optional)"
                value={mainWireName}
                onChange={(e) => setMainWireName(e.target.value)}
                options={stock.wires}
              />
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
                  disabled={!mainWireName}
                />
              </div>
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
