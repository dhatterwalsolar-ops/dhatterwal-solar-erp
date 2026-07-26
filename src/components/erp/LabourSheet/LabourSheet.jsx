import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lookupCustomer } from "../../../constants/customerRegistry";
import {
  DEFAULT_INSTALLATION,
  DEFAULT_LEAVE_ROWS,
  INSTALLATION_ITEM_ROWS,
  LABOUR_HELPERS,
  LABOUR_TEAM_LEADERS,
  buildBomRows,
  buildWorkSummary,
  calcWorkingHours,
} from "../../../constants/labourSheet";
import { loadLabourEntryDraft, saveLabourEntry } from "../../../utils/labourEntryStorage";
import { readFileAsDataUrl } from "../../../utils/customerDocuments";
import styles from "./LabourSheet.module.css";

const ALL_ATTENDANCE = [
  ...LABOUR_TEAM_LEADERS.map((w) => ({ ...w, group: "tl" })),
  ...LABOUR_HELPERS.map((w) => ({ ...w, group: "helper" })),
];

const MONTH_DAYS = 26;

function todayMeta() {
  const d = new Date();
  return {
    date: d.toLocaleDateString("en-GB"),
    day: d.toLocaleDateString("en-IN", { weekday: "long" }),
    time: d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }),
  };
}

function initialMonthlyMap() {
  const map = {};
  ALL_ATTENDANCE.forEach((w, i) => {
    const present = Math.max(18, MONTH_DAYS - (i % 5) - 2);
    map[w.id] = {
      presentDays: present,
      absentDays: MONTH_DAYS - present,
      leaveDays: 0,
      deduction: w.type === "Team Leader" ? 200 : 100,
      advance: w.type === "Team Leader" ? 1000 : 500,
    };
  });
  return map;
}

function LabourSheet() {
  const meta = todayMeta();
  const [general, setGeneral] = useState({
    date: meta.date,
    day: meta.day,
    teamLeader: "Ravi Kumar",
    mobile: "9876543210",
    billNo: "CN-240702",
    customerName: "Sunita Devi",
    siteAddress: "Near Bus Stand, Jind, Haryana",
    workType: "On Grid",
    installationType: "5 KW",
    startTime: "09:00",
    endTime: "17:30",
  });
  const [installation, setInstallation] = useState({ ...DEFAULT_INSTALLATION });
  const [presentIds, setPresentIds] = useState(() => new Set(["tl-1", "tl-2", "h-1", "h-2", "h-3", "h-4", "h-5"]));
  const [monthlyMap, setMonthlyMap] = useState(initialMonthlyMap);
  const [leaveRows, setLeaveRows] = useState(() => DEFAULT_LEAVE_ROWS.map((r) => ({ ...r })));
  const [sitePhotos, setSitePhotos] = useState([]);
  const photoInputRef = useRef(null);

  useEffect(() => {
    const draft = loadLabourEntryDraft();
    if (!draft) return;
    if (draft.general) setGeneral((g) => ({ ...g, ...draft.general }));
    if (draft.installation) setInstallation((i) => ({ ...i, ...draft.installation }));
    if (draft.presentIds) setPresentIds(new Set(draft.presentIds));
    if (draft.leaveRows) setLeaveRows(draft.leaveRows);
    if (draft.sitePhotos) setSitePhotos(draft.sitePhotos);
  }, []);

  const workingHours = useMemo(
    () => calcWorkingHours(general.startTime, general.endTime),
    [general.startTime, general.endTime],
  );

  const bomRows = useMemo(() => buildBomRows(installation), [installation]);
  const workSummary = useMemo(() => buildWorkSummary(installation), [installation]);

  const attendanceRows = useMemo(
    () =>
      ALL_ATTENDANCE.map((w) => ({
        name: w.name,
        type: w.type,
        status: presentIds.has(w.id) ? "PRESENT" : "ABSENT",
      })),
    [presentIds],
  );

  const salaryRows = useMemo(() => {
    return ALL_ATTENDANCE.map((w) => {
      const m = monthlyMap[w.id] || {
        presentDays: 0,
        absentDays: 0,
        leaveDays: 0,
        deduction: 0,
        advance: 0,
      };
      const gross = m.presentDays * w.wage;
      const net = gross - m.deduction - m.advance;
      return {
        id: w.id,
        name: w.name,
        type: w.type,
        wage: w.wage,
        ...m,
        gross,
        net,
      };
    });
  }, [monthlyMap]);

  const footerStats = useMemo(() => {
    const present = presentIds.size;
    return {
      total: ALL_ATTENDANCE.length,
      tl: LABOUR_TEAM_LEADERS.length,
      helper: LABOUR_HELPERS.length,
      present,
      absent: ALL_ATTENDANCE.length - present,
    };
  }, [presentIds]);

  const togglePresent = (id) => {
    setPresentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const updateGeneral = (key, value) => setGeneral((g) => ({ ...g, [key]: value }));

  const searchBill = () => {
    const customer = lookupCustomer(general.billNo);
    if (!customer) {
      window.alert("Bill / Consumer No. not found in Loan or Cash Case.");
      return;
    }
    setGeneral((g) => ({
      ...g,
      billNo: customer.consumerNo,
      customerName: customer.customerName,
      siteAddress: customer.address,
      installationType: customer.setupKw || g.installationType,
    }));
  };

  const onPhotosPick = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    const items = [];
    for (const file of files.slice(0, 6)) {
      const dataUrl = await readFileAsDataUrl(file);
      items.push({ name: file.name, dataUrl });
    }
    setSitePhotos((prev) => [...prev, ...items].slice(0, 6));
  };

  const submitEntry = useCallback(() => {
    const payload = {
      general,
      installation,
      presentIds: [...presentIds],
      leaveRows,
      sitePhotos,
      workingHours,
      bomRows,
      savedAt: new Date().toISOString(),
    };
    saveLabourEntry(payload);
    window.alert("Today's labour entry saved successfully.");
  }, [general, installation, presentIds, leaveRows, sitePhotos, workingHours, bomRows]);

  return (
    <div className={styles.labourPage}>
      <header className={styles.sheetBanner}>
        <div className={styles.brand}>
          <span className={styles.brandIcon} aria-hidden="true">
            ☀
          </span>
          <div>
            <p className={styles.brandTitle}>DHATTERWAL</p>
            <p className={styles.brandSub}>SOLAR ENERGY SYSTEM</p>
          </div>
        </div>
        <h1 className={styles.bannerTitle}>LABOUR SHEET (DAILY ENTRY)</h1>
      </header>

      <div className={styles.topGrid}>
        <section className={styles.panel}>
          <div className={styles.fieldGrid4}>
            <label>
              Date
              <input value={general.date} onChange={(e) => updateGeneral("date", e.target.value)} />
            </label>
            <label>
              Day
              <input value={general.day} onChange={(e) => updateGeneral("day", e.target.value)} />
            </label>
            <label>
              Team Leader
              <input
                value={general.teamLeader}
                onChange={(e) => updateGeneral("teamLeader", e.target.value)}
              />
            </label>
            <label>
              Mobile No.
              <input value={general.mobile} onChange={(e) => updateGeneral("mobile", e.target.value)} />
            </label>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.panelGreen}`}>
          <h2 className={styles.panelHead}>Site / Bill Details</h2>
          <div className={styles.fieldGrid3}>
            <label className={styles.billField}>
              Bill No.
              <span className={styles.billRow}>
                <input
                  value={general.billNo}
                  onChange={(e) => updateGeneral("billNo", e.target.value)}
                />
                <button type="button" className={styles.searchBtn} onClick={searchBill}>
                  🔍
                </button>
              </span>
            </label>
            <label>
              Customer Name
              <input
                value={general.customerName}
                onChange={(e) => updateGeneral("customerName", e.target.value)}
              />
            </label>
            <label className={styles.span2}>
              Site Address
              <textarea
                rows={2}
                value={general.siteAddress}
                onChange={(e) => updateGeneral("siteAddress", e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.panelYellow}`}>
          <div className={styles.fieldGrid5}>
            <label>
              Work Type
              <input value={general.workType} onChange={(e) => updateGeneral("workType", e.target.value)} />
            </label>
            <label>
              Installation Type
              <input
                value={general.installationType}
                onChange={(e) => updateGeneral("installationType", e.target.value)}
              />
            </label>
            <label>
              Start Time
              <input
                type="time"
                value={general.startTime}
                onChange={(e) => updateGeneral("startTime", e.target.value)}
              />
            </label>
            <label>
              End Time
              <input
                type="time"
                value={general.endTime}
                onChange={(e) => updateGeneral("endTime", e.target.value)}
              />
            </label>
            <label>
              Total Working Hours
              <input className={styles.readOnly} value={workingHours || "—"} readOnly />
            </label>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.panelPurple} ${styles.attendancePick}`}>
          <h2 className={styles.panelHeadPurple}>Today&apos;s Worker Attendance (Select Present)</h2>
          <div className={styles.attendanceCols}>
            <div>
              <p className={styles.attGroup}>Team Leader (5)</p>
              <ul className={styles.checkList}>
                {LABOUR_TEAM_LEADERS.map((w) => (
                  <li key={w.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={presentIds.has(w.id)}
                        onChange={() => togglePresent(w.id)}
                      />
                      {w.name} (TL)
                    </label>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className={styles.attGroup}>Helper (15)</p>
              <ul className={styles.checkList}>
                {LABOUR_HELPERS.map((w) => (
                  <li key={w.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={presentIds.has(w.id)}
                        onChange={() => togglePresent(w.id)}
                      />
                      {w.name}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>

      <div className={styles.midGrid}>
        <section className={styles.installPanel}>
          <h2 className={styles.blueHead}>Installation Details</h2>
          <table className={styles.detailTable}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Details</th>
                <th>Remarks / Serial No.</th>
              </tr>
            </thead>
            <tbody>
              {INSTALLATION_ITEM_ROWS.map((row) => {
                if (row.isPhotos) {
                  return (
                    <tr key={row.key}>
                      <td>{row.label}</td>
                      <td colSpan={2}>
                        <input
                          ref={photoInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className={styles.hiddenFile}
                          onChange={onPhotosPick}
                        />
                        <button
                          type="button"
                          className={styles.uploadPhotosBtn}
                          onClick={() => photoInputRef.current?.click()}
                        >
                          Upload Images
                        </button>
                        <div className={styles.photoGrid}>
                          {sitePhotos.map((p) => (
                            <img key={p.name + p.dataUrl.slice(0, 24)} src={p.dataUrl} alt={p.name} />
                          ))}
                          {sitePhotos.length === 0 &&
                            [1, 2, 3, 4].map((n) => (
                              <div key={n} className={styles.photoPlaceholder}>
                                Photo {n}
                              </div>
                            ))}
                        </div>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    <td>
                      {row.multiline ? (
                        <textarea
                          rows={4}
                          value={installation[row.key] ?? ""}
                          onChange={(e) =>
                            setInstallation((prev) => ({ ...prev, [row.key]: e.target.value }))
                          }
                        />
                      ) : (
                        <input
                          value={installation[row.key] ?? ""}
                          onChange={(e) =>
                            setInstallation((prev) => ({ ...prev, [row.key]: e.target.value }))
                          }
                        />
                      )}
                    </td>
                    <td className={styles.remarkCell}>—</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <div className={styles.midRight}>
          <section>
            <h2 className={styles.greenHead}>BOM / Material Consumption (Auto from above)</h2>
            <table className={styles.compactTable}>
              <thead>
                <tr>
                  <th>Material Name</th>
                  <th>Qty Used</th>
                  <th>Unit</th>
                  <th>Stock Before</th>
                  <th>Stock After</th>
                </tr>
              </thead>
              <tbody>
                {bomRows.map((row) => (
                  <tr key={row.material}>
                    <td>{row.material}</td>
                    <td>{row.qtyUsed}</td>
                    <td>{row.unit}</td>
                    <td>{row.stockBefore}</td>
                    <td>{row.stockAfter}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className={styles.workSummaryBox}>
            <h3 className={styles.summaryTitle}>Work Summary</h3>
            <div className={styles.summaryGrid}>
              <p>
                <span>Total Panel</span>
                <strong>{workSummary.totalPanel}</strong>
              </p>
              <p>
                <span>Total Inverter</span>
                <strong>{workSummary.totalInverter}</strong>
              </p>
              <p>
                <span>Total DC Wire</span>
                <strong>{workSummary.totalDcWire}</strong>
              </p>
              <p>
                <span>Total AC Wire</span>
                <strong>{workSummary.totalAcWire}</strong>
              </p>
              <p className={styles.statusRow}>
                <span>Installation Status</span>
                <strong
                  className={
                    workSummary.status === "COMPLETED" ? styles.statusDone : styles.statusProgress
                  }
                >
                  {workSummary.status}
                </strong>
              </p>
            </div>
          </section>

          <section>
            <h2 className={styles.orangeHead}>Attendance Summary (Auto)</h2>
            <table className={styles.compactTable}>
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Type</th>
                  <th>Attendance</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRows.map((row) => (
                  <tr key={row.name + row.type}>
                    <td>{row.name}</td>
                    <td>{row.type}</td>
                    <td
                      className={
                        row.status === "PRESENT" ? styles.presentCell : styles.absentCell
                      }
                    >
                      {row.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>

      <div className={styles.bottomGrid}>
        <section className={styles.salarySection}>
          <h2 className={styles.blueHeadWide}>Monthly Salary Summary (Auto Calculation)</h2>
          <div className={styles.tableScroll}>
            <table className={styles.salaryTable}>
              <thead>
                <tr>
                  <th>Employee Name</th>
                  <th>Type</th>
                  <th>Total Days in Month</th>
                  <th>Present Days</th>
                  <th>Absent Days</th>
                  <th>Leave Days</th>
                  <th>Per Day Wage (₹)</th>
                  <th>Gross Amount (₹)</th>
                  <th>Deduction (₹)</th>
                  <th>Advance (₹)</th>
                  <th>Net Payable (₹)</th>
                </tr>
              </thead>
              <tbody>
                {salaryRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.type}</td>
                    <td>{MONTH_DAYS}</td>
                    <td>{row.presentDays}</td>
                    <td>{row.absentDays}</td>
                    <td>{row.leaveDays}</td>
                    <td>{row.wage}</td>
                    <td>{row.gross.toLocaleString("en-IN")}</td>
                    <td>{row.deduction}</td>
                    <td>{row.advance}</td>
                    <td className={styles.netCell}>{row.net.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.notesSection}>
          <h2 className={styles.purpleHead}>Leave / Holiday Record</h2>
          <table className={styles.compactTable}>
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Date</th>
                <th>Type</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {leaveRows.map((row, idx) => (
                <tr key={idx}>
                  <td>
                    <input
                      value={row.employeeName}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLeaveRows((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, employeeName: v } : r)),
                        );
                      }}
                    />
                  </td>
                  <td>
                    <input
                      value={row.date}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLeaveRows((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, date: v } : r)),
                        );
                      }}
                    />
                  </td>
                  <td>
                    <input
                      value={row.type}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLeaveRows((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, type: v } : r)),
                        );
                      }}
                    />
                  </td>
                  <td>
                    <input
                      value={row.remarks}
                      onChange={(e) => {
                        const v = e.target.value;
                        setLeaveRows((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, remarks: v } : r)),
                        );
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.notesBox}>
            <h3>Important Notes</h3>
            <ol>
              <li>Team Leader must fill this form daily after site work.</li>
              <li>Attendance is auto saved from present selection.</li>
              <li>Material will be deducted from stock automatically (BOM section).</li>
              <li>Salary is auto calculated from present days and wage rate.</li>
              <li>Upload clear site photos for every installation.</li>
            </ol>
          </div>

          <button type="button" className={styles.submitBtn} onClick={submitEntry}>
            SUBMIT TODAY&apos;S ENTRY
          </button>
          <p className={styles.submitHint}>( DATA WILL BE SAVED AUTOMATICALLY )</p>
        </section>
      </div>

      <footer className={styles.statsBar}>
        <span>Total Workers: {footerStats.total}</span>
        <span>Team Leader: {footerStats.tl}</span>
        <span>Helper: {footerStats.helper}</span>
        <span>Today Present: {footerStats.present}</span>
        <span>Today Absent: {footerStats.absent}</span>
        <span className={styles.statsRight}>
          Entry By: {general.teamLeader.toUpperCase()} (TEAM LEADER) &nbsp;|&nbsp; Date &amp; Time:{" "}
          {meta.time}
        </span>
      </footer>
    </div>
  );
}

export default LabourSheet;
