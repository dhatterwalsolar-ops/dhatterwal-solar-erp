import { SALE_TEAM_LEADER_MAP } from "./saleTeamMappingDefaults";
import { getLabourEmployees } from "../utils/labourEmployeeStorage";
import {
  loadSaleTeams,
  loadTeamMappings,
  resolveSaleTeamConfig,
} from "../utils/labourTeamMappingStorage";

export { SALE_TEAM_LEADER_MAP };

function leaderMobile(leaderName, fallback) {
  const employees = getLabourEmployees();
  const match = employees.find(
    (e) =>
      String(e.role || "").toLowerCase() === "team leader" &&
      String(e.name || "").trim().toLowerCase() === String(leaderName || "").trim().toLowerCase(),
  );
  return String(match?.mobile || fallback || "").replace(/\D/g, "");
}

export function getSaleTeamLeaderConfig(teamWork) {
  const fromStore = resolveSaleTeamConfig(teamWork);
  if (!fromStore) return null;
  const mapping = loadTeamMappings().find(
    (m) => m.leader.toLowerCase() === fromStore.leaderName.toLowerCase(),
  );
  return {
    teamLabel: fromStore.teamLabel,
    leaderName: fromStore.leaderName,
    mobile: leaderMobile(fromStore.leaderName, fromStore.mobile),
    defaultMembers: mapping?.members ?? fromStore.defaultMembers ?? [],
  };
}

/** Sabhi Sale Sheet teams ke leader mobile (duplicate hata kar). */
export function listAllTeamLeaderRecipientMobiles() {
  const seen = new Set();
  const list = [];
  const teams = loadSaleTeams();
  for (const row of teams) {
    const cfg = getSaleTeamLeaderConfig(row.teamLabel);
    const mobile = cfg?.mobile;
    if (!mobile || seen.has(mobile)) continue;
    seen.add(mobile);
    list.push({ team: row.teamLabel, mobile, leaderName: cfg.leaderName });
  }
  return list;
}
