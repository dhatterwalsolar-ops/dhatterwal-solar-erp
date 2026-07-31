import { useEffect, useMemo, useRef, useState } from "react";
import { getAuthSession } from "../../../utils/authSession";
import { lookupCustomer } from "../../../constants/customerRegistry";
import { canCloseQueryWithRemark } from "../../../utils/erpAccess";
import { readFileAsDataUrl } from "../../../utils/customerDocuments";
import {
  QUERY_SHEET_SYNC_EVENT,
  QUERY_STATUS,
  addQuery,
  createEmptyQuery,
  deleteQuery,
  isQueryResolved,
  loadQueries,
  updateQuery,
} from "../../../utils/querySheetStorage";
import {
  getInstallTeamWorkForConsumer,
  listQueryTeamLeaders,
} from "../../../utils/queryTeamLeaders";
import {
  openWhatsAppQueryAdminCloseToCustomer,
  openWhatsAppQueryAssignFlow,
  openWhatsAppQuerySolvedToCustomer,
  processPendingQueryStaffAlerts,
} from "../../../utils/queryWhatsApp";
import styles from "./QuerySheet.module.css";

function QuerySheet() {
  const session = getAuthSession();
  const canAdminClose = canCloseQueryWithRemark(session);
  const photoRef = useRef(null);
  const photoRowRef = useRef(null);
  const [rows, setRows] = useState(() => loadQueries());
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [closeRow, setCloseRow] = useState(null);
  const [closeRemark, setCloseRemark] = useState("");
  const [form, setForm] = useState(() =>
    createEmptyQuery({ createdBy: session?.displayName || session?.userId || "" }),
  );

  useEffect(() => {
    const reload = () => {
      setRows(loadQueries());
      processPendingQueryStaffAlerts();
    };
    reload();
    window.addEventListener(QUERY_SHEET_SYNC_EVENT, reload);
    window.addEventListener("dhatterwal-erp-cloud-sync", reload);
    return () => {
      window.removeEventListener(QUERY_SHEET_SYNC_EVENT, reload);
      window.removeEventListener("dhatterwal-erp-cloud-sync", reload);
    };
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((row) =>
      Object.values(row).some((v) => String(v || "").toLowerCase().includes(q)),
    );
  }, [rows, search]);

  const openAdd = () => {
    setForm(
      createEmptyQuery({ createdBy: session?.displayName || session?.userId || "" }),
    );
    setModalOpen(true);
  };

  const onConsumerBlur = () => {
    const hit = lookupCustomer(form.consumerNo);
    if (!hit) return;
    setForm((f) => ({
      ...f,
      customerName: f.customerName || hit.customerName || hit.name || "",
      mobile: f.mobile || hit.mobile || "",
      address: f.address || hit.address || "",
    }));
  };

  const saveForm = () => {
    if (!String(form.customerName || "").trim()) {
      window.alert("Customer name zaroor likhein.");
      return;
    }
    if (!String(form.mobile || "").replace(/\D/g, "").match(/^\d{10}$/)) {
      window.alert("Mobile number 10 digit likhein.");
      return;
    }
    if (!String(form.address || "").trim()) {
      window.alert("Address zaroor likhein.");
      return;
    }
    if (!String(form.queryAbout || "").trim()) {
      window.alert("Query about zaroor likhein.");
      return;
    }
    if (!String(form.detail || "").trim()) {
      window.alert("Query detail zaroor likhein.");
      return;
    }
    addQuery({
      ...form,
      customerName: String(form.customerName).trim(),
      mobile: String(form.mobile).replace(/\D/g, "").slice(-10),
      address: String(form.address).trim(),
      queryAbout: String(form.queryAbout).trim(),
      detail: String(form.detail).trim(),
      consumerNo: String(form.consumerNo || "").trim(),
      status: QUERY_STATUS.PENDING,
      source: "erp",
      createdBy: session?.displayName || session?.userId || form.createdBy || "",
    });
    setRows(loadQueries());
    setModalOpen(false);
  };

  const leadersForRow = (row) => {
    const preferred =
      row.assignedTeamWork || getInstallTeamWorkForConsumer(row.consumerNo);
    return listQueryTeamLeaders(preferred);
  };

  const assignLeader = async (row, teamWork) => {
    if (!teamWork || isQueryResolved(row)) return;
    const leaders = leadersForRow(row);
    const pick = leaders.find((l) => l.teamWork === teamWork);
    if (!pick) {
      window.alert("Team leader nahi mila.");
      return;
    }
    if (!pick.mobile || pick.mobile.length !== 10) {
      window.alert(
        `${pick.leaderName} ka mobile Labour Details me set karein — phir transfer karein.`,
      );
      return;
    }

    const customerMobileOk = /\d{10}$/.test(
      String(row.mobile || "").replace(/\D/g, "").slice(-10),
    );

    const updated = updateQuery(row.id, {
      assignedTeamWork: pick.teamWork,
      assignedLeaderName: pick.leaderName,
      assignedLeaderMobile: pick.mobile,
      assignedAt: new Date().toISOString(),
      status: QUERY_STATUS.PENDING,
    });
    setRows(loadQueries());

    const payload =
      updated || {
        ...row,
        assignedTeamWork: pick.teamWork,
        assignedLeaderName: pick.leaderName,
        assignedLeaderMobile: pick.mobile,
      };

    /* Pehle TL ko customer-name wali query WhatsApp — Office WhatsApp se */
    await openWhatsAppQueryAssignFlow(payload);

    if (!customerMobileOk) {
      window.alert(
        `Team Leader ${pick.leaderName} ko WhatsApp bhej diya / khol diya.\n\n` +
          `Customer mobile incomplete — customer ko TL detail baad me tab jayegi jab 10-digit mobile sheet me ho.`,
      );
    }
  };

  const pickPhoto = (row) => {
    if (isQueryResolved(row) && row.closedVia === "admin") {
      window.alert("Ye query admin ne close kar di — TL photo ki zarurat nahi.");
      return;
    }
    photoRowRef.current = row;
    photoRef.current?.click();
  };

  const onPhotoSelected = async (event) => {
    const file = event.target.files?.[0];
    const row = photoRowRef.current;
    event.target.value = "";
    if (!file || !row) return;
    if (!file.type.startsWith("image/")) {
      window.alert("Sirf image / photo upload karein.");
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const updated = updateQuery(row.id, {
        photoData: dataUrl,
        photoName: file.name,
        photoUploadedAt: new Date().toISOString(),
        photoUploadedBy: session?.displayName || session?.userId || "",
        closedVia: "team_leader",
        closedBy: session?.displayName || session?.userId || "",
        closedAt: new Date().toISOString(),
        status: QUERY_STATUS.RESOLVED,
      });
      setRows(loadQueries());
      window.alert(
        'Fix photo save — query Resolved.\nAb customer ko "Your query solved" WhatsApp khulega.',
      );
      openWhatsAppQuerySolvedToCustomer(updated || row, { skipConfirm: true });
    } catch {
      window.alert("Photo read fail. Dubara try karein.");
    }
  };

  const confirmAdminClose = () => {
    if (!closeRow) return;
    const remark = String(closeRemark || "").trim();
    if (!remark) {
      window.alert("Close remark zaroor likhein — yahi customer WhatsApp pe jayega.");
      return;
    }
    const updated = updateQuery(closeRow.id, {
      closeRemark: remark,
      closedBy: session?.displayName || session?.userId || "",
      closedAt: new Date().toISOString(),
      closedVia: "admin",
      status: QUERY_STATUS.RESOLVED,
    });
    setRows(loadQueries());
    setCloseRow(null);
    setCloseRemark("");
    window.alert("Query admin se close — customer ko remark WhatsApp pe jayega.");
    openWhatsAppQueryAdminCloseToCustomer(updated || { ...closeRow, closeRemark: remark }, {
      skipConfirm: true,
    });
  };

  const remove = (row) => {
    if (!window.confirm("Is query ko delete karein?")) return;
    deleteQuery(row.id);
    setRows(loadQueries());
  };

  return (
    <section className={styles.sheet}>
      <header className={styles.toolbar}>
        <div>
          <h1>Query Sheet</h1>
          <p>
            Transfer → Team Leader select: Office WhatsApp se TL ko customer-name wali query jayegi.
            Website photo yahan dikhegi. Query close: Team Leader
            fix photo submit (customer ko &quot;Your query solved&quot;) — ya Admin/Jagdeep remark
            se close (remark customer WhatsApp).
          </p>
        </div>
        <div className={styles.toolbarActions}>
          <input
            type="search"
            className={styles.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search queries..."
          />
          <button type="button" className={styles.btnPrimary} onClick={openAdd}>
            + Add Query
          </button>
        </div>
      </header>

      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        className={styles.hiddenFile}
        onChange={onPhotoSelected}
      />

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Sr.</th>
              <th>Date</th>
              <th>Source</th>
              <th>Customer / Mobile</th>
              <th>Address / Query</th>
              <th>Customer photo</th>
              <th>Transfer → Team Leader</th>
              <th>Status / Close</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className={styles.empty}>
                  Koi query nahi — + Add Query ya website form se aayegi.
                </td>
              </tr>
            ) : (
              filtered.map((row, index) => {
                const leaders = leadersForRow(row);
                const pending = !isQueryResolved(row);
                return (
                  <tr key={row.id} className={pending ? styles.rowPending : undefined}>
                    <td>{index + 1}</td>
                    <td>{row.date || "—"}</td>
                    <td>
                      <span className={row.source === "public" ? styles.tagWeb : styles.tagErp}>
                        {row.source === "public" ? "Website" : "ERP"}
                      </span>
                      <div className={styles.by}>{row.createdBy || "—"}</div>
                    </td>
                    <td>
                      <strong>{row.customerName || "—"}</strong>
                      <div>{row.mobile || "—"}</div>
                      {row.consumerNo ? (
                        <div className={styles.muted}>CN: {row.consumerNo}</div>
                      ) : null}
                    </td>
                    <td>
                      <div className={styles.detail}>{row.address || "—"}</div>
                      <div className={styles.about}>{row.queryAbout || "—"}</div>
                      <div className={styles.detail}>{row.detail || "—"}</div>
                    </td>
                    <td>
                      {row.customerPhotoData ? (
                        <a href={row.customerPhotoData} target="_blank" rel="noreferrer">
                          <img
                            src={row.customerPhotoData}
                            alt="Customer site"
                            className={styles.thumb}
                          />
                        </a>
                      ) : (
                        <span className={styles.muted}>No photo</span>
                      )}
                    </td>
                    <td>
                      <select
                        className={styles.cellSelect}
                        value={row.assignedTeamWork || ""}
                        disabled={!pending}
                        onChange={(e) => assignLeader(row, e.target.value)}
                      >
                        <option value="">— Select Team Leader —</option>
                        {leaders.map((l) => (
                          <option key={l.label} value={l.teamWork}>
                            {l.priority === 0 ? `★ ${l.label}` : l.label}
                          </option>
                        ))}
                      </select>
                      {row.assignedLeaderName ? (
                        <div className={styles.assigned}>
                          {row.assignedLeaderName}
                          <br />
                          {row.assignedLeaderMobile || ""}
                        </div>
                      ) : null}
                    </td>
                    <td>
                      <span className={pending ? styles.statusPending : styles.statusOk}>
                        {pending
                          ? "Pending"
                          : row.closedVia === "admin"
                            ? "Closed (Admin)"
                            : "Resolved (TL)"}
                      </span>
                      {row.closeRemark ? (
                        <div className={styles.remark}>Remark: {row.closeRemark}</div>
                      ) : null}
                      <div className={styles.photoActions}>
                        {row.photoData ? (
                          <a href={row.photoData} target="_blank" rel="noreferrer">
                            Fix photo
                          </a>
                        ) : null}
                        {pending ? (
                          <button
                            type="button"
                            className={styles.btnSmall}
                            onClick={() => pickPhoto(row)}
                          >
                            TL: Upload fix photo
                          </button>
                        ) : null}
                        {pending && canAdminClose ? (
                          <button
                            type="button"
                            className={styles.btnAdminClose}
                            onClick={() => {
                              setCloseRow(row);
                              setCloseRemark("");
                            }}
                          >
                            Admin close + remark
                          </button>
                        ) : null}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.btnDel}
                        onClick={() => remove(row)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modalOpen ? (
        <div className={styles.modalBackdrop} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true">
            <h2>Add Query</h2>
            <label className={styles.field}>
              Consumer No. (optional)
              <input
                value={form.consumerNo}
                onChange={(e) => setForm((f) => ({ ...f, consumerNo: e.target.value }))}
                onBlur={onConsumerBlur}
              />
            </label>
            <label className={styles.field}>
              Customer name *
              <input
                value={form.customerName}
                onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
              />
            </label>
            <label className={styles.field}>
              Mobile number *
              <input
                value={form.mobile}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    mobile: e.target.value.replace(/\D/g, "").slice(0, 10),
                  }))
                }
                inputMode="numeric"
              />
            </label>
            <label className={styles.field}>
              Address *
              <textarea
                className={styles.textarea}
                rows={2}
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </label>
            <label className={styles.field}>
              Query about *
              <input
                value={form.queryAbout}
                onChange={(e) => setForm((f) => ({ ...f, queryAbout: e.target.value }))}
              />
            </label>
            <label className={styles.field}>
              Query detail *
              <textarea
                className={styles.textarea}
                rows={4}
                value={form.detail}
                onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))}
              />
            </label>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnCancel}
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={saveForm}>
                Save Query
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {closeRow ? (
        <div className={styles.modalBackdrop} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true">
            <h2>Admin close — remark</h2>
            <p className={styles.muted}>
              {closeRow.customerName} ({closeRow.mobile}) — ye remark customer WhatsApp pe jayega.
            </p>
            <label className={styles.field}>
              Close remark *
              <textarea
                className={styles.textarea}
                rows={4}
                value={closeRemark}
                onChange={(e) => setCloseRemark(e.target.value)}
                placeholder="e.g. Warranty expire / Customer se baat ho gayi / Duplicate query"
              />
            </label>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.btnCancel}
                onClick={() => {
                  setCloseRow(null);
                  setCloseRemark("");
                }}
              >
                Cancel
              </button>
              <button type="button" className={styles.btnPrimary} onClick={confirmAdminClose}>
                Close + WhatsApp customer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default QuerySheet;
