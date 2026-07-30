import { useEffect, useMemo, useState } from "react";
import { getAuthSession } from "../../../utils/authSession";
import { lookupCustomer } from "../../../constants/customerRegistry";
import {
  QUERY_SHEET_SYNC_EVENT,
  addQuery,
  createEmptyQuery,
  deleteQuery,
  loadQueries,
  updateQuery,
} from "../../../utils/querySheetStorage";
import styles from "./QuerySheet.module.css";

const STATUS_OPTIONS = ["Pending", "In Progress", "Resolved"];

function QuerySheet() {
  const session = getAuthSession();
  const [rows, setRows] = useState(() => loadQueries());
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(() =>
    createEmptyQuery({ createdBy: session?.displayName || session?.userId || "" }),
  );

  useEffect(() => {
    const reload = () => setRows(loadQueries());
    window.addEventListener(QUERY_SHEET_SYNC_EVENT, reload);
    return () => window.removeEventListener(QUERY_SHEET_SYNC_EVENT, reload);
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
    }));
  };

  const saveForm = () => {
    if (!String(form.queryAbout || "").trim()) {
      window.alert("Kis cheez ki query hai — woh zaroor likhein.");
      return;
    }
    if (!String(form.detail || "").trim()) {
      window.alert("Query detail zaroor likhein.");
      return;
    }
    addQuery({
      ...form,
      queryAbout: String(form.queryAbout).trim(),
      detail: String(form.detail).trim(),
      consumerNo: String(form.consumerNo || "").trim(),
      customerName: String(form.customerName || "").trim(),
      createdBy: session?.displayName || session?.userId || form.createdBy || "",
    });
    setRows(loadQueries());
    setModalOpen(false);
  };

  const setStatus = (id, status) => {
    updateQuery(id, { status });
    setRows(loadQueries());
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
            Yahan query add karein — kis cheez ki query hai aur full detail. Status update bhi yahi
            se.
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

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Sr.</th>
              <th>Date</th>
              <th>Consumer No.</th>
              <th>Customer</th>
              <th>Query About</th>
              <th>Detail</th>
              <th>Status</th>
              <th>By</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className={styles.empty}>
                  Koi query nahi — + Add Query se shuru karein.
                </td>
              </tr>
            ) : (
              filtered.map((row, index) => (
                <tr key={row.id}>
                  <td>{index + 1}</td>
                  <td>{row.date || "—"}</td>
                  <td>{row.consumerNo || "—"}</td>
                  <td>{row.customerName || "—"}</td>
                  <td className={styles.about}>{row.queryAbout}</td>
                  <td className={styles.detail}>{row.detail}</td>
                  <td>
                    <select
                      className={styles.cellSelect}
                      value={row.status || "Pending"}
                      onChange={(e) => setStatus(row.id, e.target.value)}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{row.createdBy || "—"}</td>
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen ? (
        <div className={styles.modalBackdrop} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true">
            <h2>Add Query</h2>
            <label className={styles.field}>
              Consumer No.
              <input
                value={form.consumerNo}
                onChange={(e) => setForm((f) => ({ ...f, consumerNo: e.target.value }))}
                onBlur={onConsumerBlur}
                placeholder="Optional"
              />
            </label>
            <label className={styles.field}>
              Customer name
              <input
                value={form.customerName}
                onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                placeholder="Optional"
              />
            </label>
            <label className={styles.field}>
              Kis cheez ki query hai? *
              <input
                value={form.queryAbout}
                onChange={(e) => setForm((f) => ({ ...f, queryAbout: e.target.value }))}
                placeholder="e.g. Net meter delay / Payment / Documents"
              />
            </label>
            <label className={styles.field}>
              Query detail *
              <textarea
                className={styles.textarea}
                rows={4}
                value={form.detail}
                onChange={(e) => setForm((f) => ({ ...f, detail: e.target.value }))}
                placeholder="Poori detail likhein..."
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
    </section>
  );
}

export default QuerySheet;
