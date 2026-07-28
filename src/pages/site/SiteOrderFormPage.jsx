import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { DAILY_TEAM_MEMBERS } from "../../constants/labourEmployees";
import { ensureSiteOrderInStorage } from "../../utils/siteOrderStorage";
import { resolveSiteOrder } from "../../utils/siteOrderUrl";
import { listAvailableSerials, listStockProductsByCategory } from "../../utils/stockSerialInventory";
import { listStockSheetRows } from "../../utils/stockStorage";
import { submitSiteInstallationForm } from "../../utils/siteOrderStockSubmit";
import styles from "./SiteOrderFormPage.module.css";

function emptyPanelSerials(count) {
  return Array.from({ length: Math.max(1, count) }, () => "");
}

function SiteOrderFormPage() {
  const { orderId } = useParams();
  const location = useLocation();
  const order = useMemo(
    () => resolveSiteOrder(orderId, location.search),
    [orderId, location.search],
  );

  const panelSerialOptions = useMemo(
    () => listAvailableSerials({ category: "PANEL" }),
    [order?.id],
  );
  const inverterSerialOptions = useMemo(
    () => listAvailableSerials({ category: "INVERTER" }),
    [order?.id],
  );
  const inverterProducts = useMemo(() => listStockProductsByCategory("INVERTER"), []);
  const stockRows = useMemo(() => listStockSheetRows(), [order?.id]);

  const allowManualSerials = panelSerialOptions.length === 0 && inverterSerialOptions.length === 0;

  const wireProducts = useMemo(
    () => stockRows.filter((r) => String(r.category).toUpperCase() === "WIRE" && r.balance > 0),
    [stockRows],
  );

  const countProducts = useMemo(
    () =>
      stockRows.filter((r) => {
        const cat = String(r.category).toUpperCase();
        return (
          r.balance > 0 &&
          (cat === "AC BOX" ||
            cat === "DC BOX" ||
            cat === "GENERAL" ||
            cat === "STAND" ||
            cat === "CONDUTER")
        );
      }),
    [stockRows],
  );

  const [teamMembers, setTeamMembers] = useState([]);
  const [panelSerials, setPanelSerials] = useState([]);
  const [panelProductName, setPanelProductName] = useState("Solar Panel");
  const [inverterName, setInverterName] = useState("");
  const [inverterSerial, setInverterSerial] = useState("");
  const [wireLines, setWireLines] = useState([]);
  const [countLines, setCountLines] = useState([]);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!order) return;
    setDone(order.status === "submitted");
    setTeamMembers(order.defaultMembers ?? []);
    setPanelSerials(emptyPanelSerials(order.panelCount || 4));
    setPanelProductName(panelSerialOptions[0]?.itemName || "Solar Panel");
    setInverterName(inverterProducts[0]?.itemName || "");
    setInverterSerial("");
    setWireLines(
      wireProducts.slice(0, 8).map((r) => ({
        productId: "",
        itemName: r.itemName,
        category: "WIRE",
        qtyMtr: "",
      })),
    );
    setCountLines(
      countProducts.slice(0, 12).map((r) => ({
        productId: "",
        itemName: r.itemName,
        category: r.category,
        unit: r.unit || "NOS",
        qty: "",
      })),
    );
    ensureSiteOrderInStorage(order);
  }, [order, panelSerialOptions, inverterProducts, wireProducts, countProducts]);

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

  const updatePanelSerial = (index, value) => {
    setPanelSerials((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setError("");
    ensureSiteOrderInStorage(order);

    const result = submitSiteInstallationForm(order, {
      teamMembers,
      panelSerials,
      panelProductName,
      inverterName,
      inverterSerial,
      wireLines,
      countLines,
      allowManualSerials,
    });
    if (!result.ok) {
      setError(result.message || "Submit fail.");
      return;
    }
    setDone(true);
    window.alert(
      allowManualSerials
        ? "Form save ho gaya. Stock update ke liye yeh link office ERP wale computer par bhi open karke submit karein."
        : `Site form save ho gaya. Stock se ${result.issuedLines} line(s) less ho gayi.`,
    );
  };

  return (
    <div className={styles.sitePage}>
      <div className={styles.card}>
        <header className={styles.head}>
          <h1>Site Installation Form</h1>
          <p className={styles.meta}>
            <strong>{order.customerName}</strong> · {order.consumerNo}
            <br />
            {order.fatherName ? <>Father/Husband: {order.fatherName}<br /></> : null}
            {order.address}
            <br />
            Setup: {order.setupKw} · Team: {order.teamWork}
            <br />
            Site date: {order.siteDate}
          </p>
          <span className={`${styles.badge} ${done ? styles.badgeDone : ""}`}>
            {done ? "Submitted" : "Pending — detail bharein"}
          </span>
          {allowManualSerials ? (
            <p className={styles.hint}>
              Is device par stock list nahi hai — serial manually likhein. Stock kam karne ke liye
              form office ERP browser par submit karein.
            </p>
          ) : null}
        </header>

        {done ? (
          <p className={styles.hint}>Form submit ho chuka hai.</p>
        ) : (
          <form onSubmit={handleSubmit}>
            {error ? <div className={styles.errorBox}>{error}</div> : null}

            <section className={styles.section}>
              <h2>Team ke saath kaam karne wale employee</h2>
              <div className={styles.members}>
                {DAILY_TEAM_MEMBERS.map((name) => (
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
            </section>

            <section className={styles.section}>
              <h2>Panel detail ({order.panelCount} panel)</h2>
              {panelSerials.map((val, idx) => (
                <div className={styles.field} key={`panel-${idx}`}>
                  <label htmlFor={`panel-serial-${idx}`}>Panel {idx + 1} serial</label>
                  {panelSerialOptions.length > 0 ? (
                    <select
                      id={`panel-serial-${idx}`}
                      value={val}
                      onChange={(e) => updatePanelSerial(idx, e.target.value)}
                      required
                    >
                      <option value="">Select serial</option>
                      {panelSerialOptions.map((opt) => (
                        <option key={`${opt.serial}-${idx}`} value={opt.serial}>
                          {opt.serial} ({opt.itemName})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`panel-serial-${idx}`}
                      type="text"
                      value={val}
                      onChange={(e) => updatePanelSerial(idx, e.target.value)}
                      placeholder="Panel serial number"
                      required
                    />
                  )}
                </div>
              ))}
            </section>

            <section className={styles.section}>
              <h2>Inverter</h2>
              <div className={styles.field}>
                <label htmlFor="inv-name">Inverter name</label>
                <select
                  id="inv-name"
                  value={inverterName}
                  onChange={(e) => setInverterName(e.target.value)}
                >
                  {(inverterProducts.length
                    ? inverterProducts
                    : [{ id: "manual", itemName: formInverterFallback(order) }]
                  ).map((p) => (
                    <option key={p.id} value={p.itemName}>
                      {p.itemName}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label htmlFor="inv-serial">Inverter serial</label>
                {inverterSerialOptions.length > 0 ? (
                  <select
                    id="inv-serial"
                    value={inverterSerial}
                    onChange={(e) => setInverterSerial(e.target.value)}
                    required
                  >
                    <option value="">Select serial</option>
                    {inverterSerialOptions.map((opt) => (
                      <option key={opt.serial} value={opt.serial}>
                        {opt.serial} ({opt.itemName})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="inv-serial"
                    type="text"
                    value={inverterSerial}
                    onChange={(e) => setInverterSerial(e.target.value)}
                    placeholder="Inverter serial number"
                    required
                  />
                )}
              </div>
            </section>

            <section className={styles.section}>
              <h2>Wire (meter me)</h2>
              {wireLines.length === 0 ? (
                <p className={styles.hint}>Wire stock list khali — office ERP par qty update hogi.</p>
              ) : (
                wireLines.map((line, idx) => (
                  <div className={styles.field} key={`wire-${line.itemName}-${idx}`}>
                    <label>{line.itemName}</label>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      placeholder="Meter"
                      value={line.qtyMtr}
                      onChange={(e) => {
                        const v = e.target.value;
                        setWireLines((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, qtyMtr: v } : row)),
                        );
                      }}
                    />
                  </div>
                ))
              )}
            </section>

            <section className={styles.section}>
              <h2>Qty items (ACDB, DCDB, earthing, LA, pit cover, …)</h2>
              {countLines.length === 0 ? (
                <p className={styles.hint}>Stock item list khali — office par submit karein.</p>
              ) : (
                countLines.map((line, idx) => (
                  <div className={styles.field} key={`cnt-${line.itemName}-${idx}`}>
                    <label>
                      {line.itemName} ({line.unit})
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Qty"
                      value={line.qty}
                      onChange={(e) => {
                        const v = e.target.value;
                        setCountLines((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, qty: v } : row)),
                        );
                      }}
                    />
                  </div>
                ))
              )}
            </section>

            <button type="submit" className={styles.submit}>
              Submit
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function formInverterFallback(order) {
  return order.setupKw ? `Inverter (${order.setupKw})` : "Inverter";
}

export default SiteOrderFormPage;
