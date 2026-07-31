import { SALE_TEAM_WORK_OPTIONS } from "../constants/saleCase";
import {
  getSaleTeamLeaderConfig,
  SALE_TEAM_LEADER_MAP,
} from "../constants/saleTeamMapping";
import { getLabourEmployees } from "./labourEmployeeStorage";
import { loadSaleCaseRows } from "./saleCaseStorage";

function normalizeConsumer(value) {
  return String(value || "").trim().toUpperCase();
}

/** Install team from Sale Sheet for this consumer (first priority). */
export function getInstallTeamWorkForConsumer(consumerNo) {
  const key = normalizeConsumer(consumerNo);
  if (!key) return "";
  const row = loadSaleCaseRows().find(
    (r) => normalizeConsumer(r.consumerNo) === key && String(r.teamWork || "").trim(),
  );
  return row ? String(row.teamWork).trim() : "";
}

/**
 * Team leaders for Query transfer.
 * Install team (sale sheet) pehle, phir baaki Sale teams, phir other Labour TLs.
 */
export function listQueryTeamLeaders(preferredTeamWork = "") {
  const preferred = String(preferredTeamWork || "").trim().toUpperCase();
  const seen = new Set();
  const list = [];

  const push = (teamWork, cfg, priority) => {
    if (!cfg?.leaderName) return;
    const mobile = String(cfg.mobile || "").replace(/\D/g, "");
    const key = `${cfg.leaderName}|${mobile}|${teamWork}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({
      teamWork,
      leaderName: cfg.leaderName,
      mobile,
      priority,
      label: `${teamWork} — ${cfg.leaderName}${mobile ? ` (${mobile})` : ""}`,
    });
  };

  if (preferred) {
    const cfg = getSaleTeamLeaderConfig(preferred);
    if (cfg) push(cfg.teamLabel || preferred, cfg, 0);
  }

  SALE_TEAM_WORK_OPTIONS.forEach((team, index) => {
    if (team.toUpperCase() === preferred) return;
    const cfg = getSaleTeamLeaderConfig(team);
    if (cfg) push(team, cfg, 1 + index);
  });

  Object.keys(SALE_TEAM_LEADER_MAP).forEach((team, index) => {
    if (SALE_TEAM_WORK_OPTIONS.some((t) => t.toUpperCase() === team.toUpperCase())) return;
    const cfg = getSaleTeamLeaderConfig(team);
    if (cfg) push(team, cfg, 50 + index);
  });

  getLabourEmployees()
    .filter((e) => String(e.role || "").toLowerCase() === "team leader")
    .forEach((e, index) => {
      const name = String(e.name || "").trim();
      const mobile = String(e.mobile || "").replace(/\D/g, "");
      if (!name) return;
      const already = list.some(
        (x) =>
          x.leaderName.toLowerCase() === name.toLowerCase() ||
          (mobile && x.mobile === mobile),
      );
      if (already) return;
      push(`${name} TEAM`, { leaderName: name, mobile }, 100 + index);
    });

  return list.sort((a, b) => a.priority - b.priority || a.leaderName.localeCompare(b.leaderName));
}
