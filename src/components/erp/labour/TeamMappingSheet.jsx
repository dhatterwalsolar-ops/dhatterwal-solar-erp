import { useEffect, useMemo, useState } from "react";
import { getLabourEmployees } from "../../../utils/labourEmployeeStorage";
import {
  getDefaultSaleTeams,
  getDefaultTeamMappings,
  loadSaleTeams,
  loadTeamMappings,
  saveSaleTeams,
  saveTeamMappings,
} from "../../../utils/labourTeamMappingStorage";
import styles from "./AddEmployeeSheet.module.css";
import teamStyles from "./TeamMappingSheet.module.css";

function TeamMappingSheet({ open, onClose, onSaved }) {
  const [mappings, setMappings] = useState([]);
  const [saleTeams, setSaleTeams] = useState([]);

  const leaders = useMemo(() => {
    const fromEmp = getLabourEmployees()
      .filter((e) => String(e.role || "").toLowerCase() === "team leader")
      .map((e) => e.name);
    const fromMap = mappings.map((m) => m.leader);
    return [...new Set([...fromEmp, ...fromMap].filter(Boolean))];
  }, [mappings]);

  const helpers = useMemo(() => {
    return getLabourEmployees()
      .filter((e) => String(e.role || "").toLowerCase() === "helper")
      .map((e) => e.name);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setMappings(loadTeamMappings());
    setSaleTeams(loadSaleTeams());
  }, [open]);

  if (!open) return null;

  const patchMapping = (index, patch) => {
    setMappings((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const patchSale = (index, patch) => {
    setSaleTeams((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const handleSave = () => {
    const nextMap = mappings
      .map((m) => ({
        leader: String(m.leader || "").trim(),
        members: String(m.membersText ?? m.members?.join(", ") ?? "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      }))
      .filter((m) => m.leader);

    const nextSale = saleTeams
      .map((t) => ({
        teamLabel: String(t.teamLabel || "").trim(),
        leaderName: String(t.leaderName || "").trim(),
        mobile: String(t.mobile || "").replace(/\D/g, ""),
      }))
      .filter((t) => t.teamLabel && t.leaderName);

    if (!nextSale.length) {
      window.alert("Kam se kam 1 Sale Team detail rakhein.");
      return;
    }

    saveTeamMappings(nextMap);
    saveSaleTeams(nextSale);
    onSaved?.({ mappings: nextMap, saleTeams: nextSale });
    window.alert("Team detail save ho gayi — Sale WhatsApp / Daily Labour isi se chalega.");
    onClose();
  };

  const resetDefaults = () => {
    if (!window.confirm("Default team mapping restore karein?")) return;
    setMappings(getDefaultTeamMappings());
    setSaleTeams(getDefaultSaleTeams());
  };

  return (
    <div className={styles.backdrop} role="presentation" onClick={onClose}>
      <div
        className={`${styles.sheet} ${teamStyles.wideSheet}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-map-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 id="team-map-title">Update Team Detail</h2>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className={styles.body}>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h3>Sale Sheet teams (Team Work → Leader)</h3>
              <button
                type="button"
                className={teamStyles.miniBtn}
                onClick={() =>
                  setSaleTeams((prev) => [
                    ...prev,
                    { teamLabel: "", leaderName: leaders[0] || "", mobile: "" },
                  ])
                }
              >
                + Add team
              </button>
            </div>
            <p className={styles.hint}>
              Sale me Team Work select hone par isi leader mobile pe WhatsApp / site form jayega.
            </p>
            <div className={teamStyles.list}>
              {saleTeams.map((row, index) => (
                <div key={`sale-${index}`} className={teamStyles.card}>
                  <label>
                    Team label (Sale)
                    <input
                      value={row.teamLabel}
                      onChange={(e) => patchSale(index, { teamLabel: e.target.value })}
                      placeholder="BALINDER TEAM"
                    />
                  </label>
                  <label>
                    Team Leader name
                    <input
                      list="team-leader-options"
                      value={row.leaderName}
                      onChange={(e) => patchSale(index, { leaderName: e.target.value })}
                      placeholder="Balinder Goswami"
                    />
                  </label>
                  <label>
                    Fallback mobile
                    <input
                      value={row.mobile}
                      onChange={(e) => patchSale(index, { mobile: e.target.value })}
                      placeholder="10 digit"
                      inputMode="tel"
                    />
                  </label>
                  <button
                    type="button"
                    className={teamStyles.removeBtn}
                    onClick={() => setSaleTeams((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <datalist id="team-leader-options">
              {leaders.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h3>Leader → Helpers mapping</h3>
              <button
                type="button"
                className={teamStyles.miniBtn}
                onClick={() =>
                  setMappings((prev) => [
                    ...prev,
                    { leader: leaders[0] || "", members: [], membersText: "" },
                  ])
                }
              >
                + Add mapping
              </button>
            </div>
            <p className={styles.hint}>
              Helpers comma se alag likhein. Daily Labour Work me default members isi se select
              hote hain.
              {helpers.length ? ` Active helpers: ${helpers.join(", ")}` : ""}
            </p>
            <div className={teamStyles.list}>
              {mappings.map((row, index) => (
                <div key={`map-${index}`} className={teamStyles.card}>
                  <label>
                    Team Leader
                    <input
                      list="team-leader-options"
                      value={row.leader}
                      onChange={(e) => patchMapping(index, { leader: e.target.value })}
                    />
                  </label>
                  <label className={teamStyles.spanFull}>
                    Helpers (comma separated)
                    <input
                      value={row.membersText ?? row.members?.join(", ") ?? ""}
                      onChange={(e) =>
                        patchMapping(index, {
                          membersText: e.target.value,
                          members: e.target.value
                            .split(",")
                            .map((x) => x.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Rajesh Goswami, Aniket"
                    />
                  </label>
                  <button
                    type="button"
                    className={teamStyles.removeBtn}
                    onClick={() => setMappings((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <footer className={styles.footer}>
          <button type="button" className={styles.btnPrimary} onClick={handleSave}>
            Save Team Detail
          </button>
          <button type="button" className={styles.btnGhost} onClick={resetDefaults}>
            Reset defaults
          </button>
          <button type="button" className={styles.btnGhost} onClick={onClose}>
            Cancel
          </button>
        </footer>
      </div>
    </div>
  );
}

export default TeamMappingSheet;
