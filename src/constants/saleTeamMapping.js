import { TEAM_MAPPING_DEFAULT } from "./labourEmployees";
import { getLabourEmployees } from "../utils/labourEmployeeStorage";

function leaderMobile(leaderName, fallback) {
  const employees = getLabourEmployees();
  const match = employees.find(
    (e) =>
      String(e.role || "").toLowerCase() === "team leader" &&
      String(e.name || "").trim().toLowerCase() === String(leaderName || "").trim().toLowerCase(),
  );
  return String(match?.mobile || fallback || "").replace(/\D/g, "");
}

/** Sale Sheet Team Work dropdown → team leader (Labour Details se mobile match). */
export const SALE_TEAM_LEADER_MAP = {
  "AMAN TEAM": { leaderName: "Aman", mobile: "9992891001" },
  "BALINDER TEAM": { leaderName: "Balinder Goswami", mobile: "9876543210" },
  "SUKHWINDER TEAM": { leaderName: "Sukhwinder Singh", mobile: "9992891002" },
  "RAVINDER TEAM": { leaderName: "Ravi Kumar", mobile: "9992891023" },
};

export function getSaleTeamLeaderConfig(teamWork) {
  const key = String(teamWork || "").trim().toUpperCase();
  if (!key) return null;
  const entry = Object.entries(SALE_TEAM_LEADER_MAP).find(
    ([label]) => label.toUpperCase() === key,
  );
  if (!entry) return null;
  const [teamLabel, cfg] = entry;
  const mapping = TEAM_MAPPING_DEFAULT.find(
    (m) => m.leader.toLowerCase() === cfg.leaderName.toLowerCase(),
  );
  return {
    teamLabel,
    leaderName: cfg.leaderName,
    mobile: leaderMobile(cfg.leaderName, cfg.mobile),
    defaultMembers: mapping?.members ?? [],
  };
}

/** Sabhi Sale Sheet teams ke leader mobile (duplicate hata kar). */
export function listAllTeamLeaderRecipientMobiles() {
  const seen = new Set();
  const list = [];
  for (const label of Object.keys(SALE_TEAM_LEADER_MAP)) {
    const cfg = getSaleTeamLeaderConfig(label);
    const mobile = cfg?.mobile;
    if (!mobile || seen.has(mobile)) continue;
    seen.add(mobile);
    list.push({ team: label, mobile, leaderName: cfg.leaderName });
  }
  return list;
}
