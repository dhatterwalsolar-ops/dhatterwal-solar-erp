import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  DAILY_TEAM_MEMBERS,
  INSTALLATION_STATUS_OPTIONS,
  TEAM_LEADER_OPTIONS,
} from "../../../constants/labourEmployees";
import { calcWorkingHours } from "../../../constants/labourSheet";
import { ROUTES } from "../../../constants/routes";
import { SALE_CASE_SYNC_EVENT } from "../../../utils/saleCaseSync";
import { readFileAsDataUrl } from "../../../utils/customerDocuments";
import { buildDailyLabourFieldsFromConsumer } from "../../../utils/labourDailyConsumerSync";
import { openLabourDailyWhatsAppToLeader } from "../../../utils/labourDailyWhatsApp";
import { saveLabourEntry } from "../../../utils/labourEntryStorage";
import { getLabourEmployees } from "../../../utils/labourEmployeeStorage";
import {
  LABOUR_TEAM_MAPPING_SYNC_EVENT,
  loadTeamMappings,
} from "../../../utils/labourTeamMappingStorage";
import styles from "./DailyLabourWorkPage.module.css";

function emptyForm() {
  return {
    date: new Date().toLocaleDateString("en-GB"),
    consumerNo: "",
    customerName: "",
    setupKw: "",
    setupDetail: "",
    teamWork: "",
    teamLeader: TEAM_LEADER_OPTIONS[0] || "",
    siteAddress: "",
    startTime: "09:00",
    endTime: "17:30",
    installStatus: "In Progress",
    workDetails: "",
    materialDone: "",
    remarks: "",
  };
}

function DailyLabourWorkPage() {
  const [form, setForm] = useState(emptyForm);
  const [selectedMembers, setSelectedMembers] = useState(() => new Set());
  const [photos, setPhotos] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const photoRef = useRef(null);
  const consumerSyncTimer = useRef(null);

  const [teamMappings, setTeamMappings] = useState(() => loadTeamMappings());

  const teamLeaderOptions = useMemo(() => {
    const fromDb = getLabourEmployees()
      .filter((e) => String(e.role).toLowerCase() === "team leader")
      .map((e) => e.name);
    const fromMap = teamMappings.map((m) => m.leader);
    return [...new Set([...TEAM_LEADER_OPTIONS, ...fromDb, ...fromMap])];
  }, [teamMappings]);

  const memberOptions = useMemo(() => {
    const fromEmp = getLabourEmployees()
      .filter((e) => String(e.role).toLowerCase() === "helper")
      .map((e) => e.name);
    const fromMap = teamMappings.flatMap((m) => m.members || []);
    return [...new Set([...DAILY_TEAM_MEMBERS, ...fromEmp, ...fromMap])];
  }, [teamMappings]);

  const hours = useMemo(
    () => calcWorkingHours(form.startTime, form.endTime),
    [form.startTime, form.endTime],
  );

  useEffect(() => {
    const refresh = () => setTeamMappings(loadTeamMappings());
    window.addEventListener(LABOUR_TEAM_MAPPING_SYNC_EVENT, refresh);
    return () => window.removeEventListener(LABOUR_TEAM_MAPPING_SYNC_EVENT, refresh);
  }, []);

  const summary = useMemo(
    () => ({
      leader: form.teamLeader,
      consumerNo: form.consumerNo,
      setup: form.setupKw,
      address: form.siteAddress,
      members: [...selectedMembers].join(", ") || "—",
      time: `${form.startTime} – ${form.endTime} (${hours || "—"} hrs)`,
      status: form.installStatus,
    }),
    [form, selectedMembers, hours],
  );

  const applyConsumerSync = (consumerNo) => {
    const patch = buildDailyLabourFieldsFromConsumer(consumerNo);
    setForm((f) => ({
      ...f,
      consumerNo: patch.consumerNo,
      customerName: patch.customerName,
      siteAddress: patch.siteAddress,
      setupKw: patch.setupKw,
      setupDetail: patch.setupDetail,
      teamWork: patch.teamWork,
      teamLeader: patch.teamLeader || f.teamLeader,
      workDetails: patch.workDetails || f.workDetails,
      materialDone: patch.materialDone || f.materialDone,
    }));
    if (patch.teamLeader) {
      const mapping = loadTeamMappings().find(
        (m) => m.leader.toLowerCase() === String(patch.teamLeader).toLowerCase(),
      );
      if (mapping?.members?.length) {
        setSelectedMembers(new Set(mapping.members));
      }
    }
  };

  useEffect(() => {
    const refresh = () => {
      if (form.consumerNo?.trim()) applyConsumerSync(form.consumerNo);
    };
    window.addEventListener(SALE_CASE_SYNC_EVENT, refresh);
    return () => window.removeEventListener(SALE_CASE_SYNC_EVENT, refresh);
  }, [form.consumerNo]);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const onConsumerChange = (value) => {
    update("consumerNo", value);
    if (consumerSyncTimer.current) clearTimeout(consumerSyncTimer.current);
    consumerSyncTimer.current = setTimeout(() => {
      if (String(value || "").trim().length >= 3) applyConsumerSync(value);
    }, 450);
  };

  const syncConsumerNow = () => {
    if (!form.consumerNo?.trim()) {
      window.alert("Pehle Consumer Number likhein.");
      return;
    }
    applyConsumerSync(form.consumerNo);
    if (!form.customerName) {
      window.alert("Sale Sheet / Loan / Cash me yeh Consumer No. nahi mila.");
    }
  };

  const toggleMember = (name) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const onPhotos = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    const items = [];
    for (const file of files.slice(0, 4)) {
      items.push({ name: file.name, dataUrl: await readFileAsDataUrl(file) });
    }
    setPhotos((p) => [...p, ...items].slice(0, 4));
  };

  const resetForm = () => {
    setSubmitted(false);
    setPhotos([]);
    setSelectedMembers(new Set());
    setForm(emptyForm());
  };

  const submitWork = () => {
    if (!form.consumerNo?.trim()) {
      window.alert("Consumer Number zaroori hai.");
      return;
    }
    saveLabourEntry({
      general: { ...form, billNo: form.consumerNo },
      presentMembers: [...selectedMembers],
      sitePhotos: photos,
      workingHours: hours,
      savedAt: new Date().toISOString(),
    });
    setSubmitted(true);
    window.alert("Daily labour work save ho gaya.");
  };

  const sendWhatsAppForm = () => {
    if (!form.consumerNo?.trim()) {
      window.alert("Consumer Number bharein — Sale Sheet se detail aayegi.");
      return;
    }
    openLabourDailyWhatsAppToLeader(form);
  };

  const steps = [
    { label: "Work Submitted", done: submitted },
    { label: "Attendance Updated", done: submitted },
    { label: "BOM Updated", done: submitted },
    { label: "Stock Updated", done: submitted },
    { label: "Salary Updated", done: submitted },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <Link to={ROUTES.LABOUR_SHEET} className={styles.back}>
          ← Main Menu
        </Link>
        <h1>2. DAILY LABOUR WORK ENTRY</h1>
        <p className={styles.headSub}>
          Consumer No. Sale Sheet se match — setup detail auto. Team leader ko WhatsApp par
          Google Form (labour / work update).
        </p>
      </header>

      <div className={styles.layout}>
        <div className={styles.formCol}>
          <div className={styles.row3}>
            <label>
              Date
              <input value={form.date} onChange={(e) => update("date", e.target.value)} />
            </label>
            <label>
              Consumer Number
              <span className={styles.billRow}>
                <input
                  value={form.consumerNo}
                  onChange={(e) => onConsumerChange(e.target.value)}
                  onBlur={syncConsumerNow}
                  placeholder="Sale Sheet wala CN"
                />
                <button type="button" onClick={syncConsumerNow} title="Sale Sheet se load">
                  ↻
                </button>
              </span>
            </label>
            <label>
              Customer Name
              <input className={styles.readOnly} readOnly value={form.customerName} placeholder="Auto" />
            </label>
          </div>

          <div className={styles.row2}>
            <label>
              Setup (kW)
              <input className={styles.readOnly} readOnly value={form.setupKw} placeholder="Auto" />
            </label>
            <label>
              Sale Team Work
              <input className={styles.readOnly} readOnly value={form.teamWork} placeholder="Auto" />
            </label>
          </div>

          <label className={styles.full}>
            Setup Detail (Sale Sheet / BOM)
            <textarea
              className={styles.readOnlyArea}
              readOnly
              rows={4}
              value={form.setupDetail}
              placeholder="Consumer No. dalne par auto aayega"
            />
          </label>

          <div className={styles.row2}>
            <label>
              Team Leader
              <select
                value={form.teamLeader}
                onChange={(e) => update("teamLeader", e.target.value)}
              >
                {teamLeaderOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Site Address
              <input value={form.siteAddress} onChange={(e) => update("siteAddress", e.target.value)} />
            </label>
          </div>

          <section className={styles.block}>
            <h3>Select Helper / Team Members</h3>
            <div className={styles.memberGrid}>
              {memberOptions.map((name) => (
                <label key={name} className={styles.memberCheck}>
                  <input
                    type="checkbox"
                    checked={selectedMembers.has(name)}
                    onChange={() => toggleMember(name)}
                  />
                  {name}
                </label>
              ))}
            </div>
          </section>

          <div className={styles.row4}>
            <label>
              Start Time
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => update("startTime", e.target.value)}
              />
            </label>
            <label>
              End Time
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => update("endTime", e.target.value)}
              />
            </label>
            <label>
              Total Working Hours
              <input className={styles.readOnly} readOnly value={hours || "—"} />
            </label>
            <label>
              Installation Status
              <select
                value={form.installStatus}
                onChange={(e) => update("installStatus", e.target.value)}
              >
                {INSTALLATION_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className={styles.full}>
            Labour / Work Details
            <textarea
              rows={3}
              value={form.workDetails}
              onChange={(e) => update("workDetails", e.target.value)}
              placeholder="Aaj site par kya kaam hua"
            />
          </label>
          <label className={styles.full}>
            Material / Work Done
            <textarea
              rows={2}
              value={form.materialDone}
              onChange={(e) => update("materialDone", e.target.value)}
            />
          </label>
          <label className={styles.full}>
            Remarks
            <textarea rows={2} value={form.remarks} onChange={(e) => update("remarks", e.target.value)} />
          </label>

          <section className={styles.block}>
            <h3>Upload Site Photos</h3>
            <input ref={photoRef} type="file" accept="image/*" multiple className={styles.hidden} onChange={onPhotos} />
            <button type="button" className={styles.chooseFiles} onClick={() => photoRef.current?.click()}>
              Choose Files
            </button>
            <div className={styles.photoRow}>
              {photos.map((p) => (
                <img key={p.name} src={p.dataUrl} alt={p.name} />
              ))}
            </div>
          </section>

          <div className={styles.formActions}>
            <button type="button" className={styles.waBtn} onClick={sendWhatsAppForm}>
              WhatsApp Google Form (Team Leader)
            </button>
            <button type="button" className={styles.submit} onClick={submitWork}>
              SAVE
            </button>
            <button type="button" className={styles.reset} onClick={resetForm}>
              RESET
            </button>
          </div>
        </div>

        <aside className={styles.sideCol}>
          <section className={styles.sideCard}>
            <h3>TEAM MAPPING</h3>
            <ul>
              {teamMappings.map((row) => (
                <li key={row.leader}>
                  <strong>{row.leader}</strong>
                  <span> → {row.members.join(", ") || "—"}</span>
                </li>
              ))}
            </ul>
            <p style={{ fontSize: "0.7rem", opacity: 0.8, marginTop: "0.5rem" }}>
              Update: Labour Details → Update Team Detail
            </p>
          </section>

          <section className={styles.sideCard}>
            <h3>TODAY&apos;S TEAM SUMMARY</h3>
            <dl>
              <div>
                <dt>Team Leader</dt>
                <dd>{summary.leader}</dd>
              </div>
              <div>
                <dt>Consumer No.</dt>
                <dd>{summary.consumerNo || "—"}</dd>
              </div>
              <div>
                <dt>Setup</dt>
                <dd>{summary.setup || "—"}</dd>
              </div>
              <div>
                <dt>Site</dt>
                <dd>{summary.address}</dd>
              </div>
              <div>
                <dt>Team</dt>
                <dd>{summary.members}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>{summary.time}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <span className={styles.pill}>{summary.status}</span>
                </dd>
              </div>
            </dl>
          </section>

          <section className={styles.sideCard}>
            <h3>TODAY&apos;S WORK STATUS</h3>
            <ul className={styles.stepper}>
              {steps.map((step) => (
                <li key={step.label} className={step.done ? styles.stepDone : styles.stepPending}>
                  <span className={styles.stepDot}>{step.done ? "✓" : "○"}</span>
                  {step.label}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

export default DailyLabourWorkPage;
