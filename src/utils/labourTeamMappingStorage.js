import { TEAM_MAPPING_DEFAULT } from "../constants/labourEmployees";
import { SALE_TEAM_WORK_OPTIONS } from "../constants/saleCase";
import { SALE_TEAM_LEADER_MAP } from "../constants/saleTeamMappingDefaults";
import { erpGetItem, erpSetItem } from "./erpStorage";

const MAPPING_KEY = "dhatterwal_labour_team_mapping";
const SALE_TEAMS_KEY = "dhatterwal_sale_team_leader_map";
export const LABOUR_TEAM_MAPPING_SYNC_EVENT = "dhatterwal-labour-team-mapping-sync";

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeMappingRow(row) {
  const leader = String(row?.leader || "").trim();
  if (!leader) return null;
  const members = Array.isArray(row?.members)
    ? row.members.map((m) => String(m || "").trim()).filter(Boolean)
    : String(row?.membersText || "")
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean);
  return { leader, members };
}

function normalizeSaleTeamRow(row) {
  const teamLabel = String(row?.teamLabel || row?.label || "").trim();
  const leaderName = String(row?.leaderName || "").trim();
  if (!teamLabel || !leaderName) return null;
  return {
    teamLabel,
    leaderName,
    mobile: String(row?.mobile || "").replace(/\D/g, ""),
  };
}

export function getDefaultTeamMappings() {
  return TEAM_MAPPING_DEFAULT.map((r) => ({
    leader: r.leader,
    members: [...(r.members || [])],
  }));
}

export function getDefaultSaleTeams() {
  return Object.entries(SALE_TEAM_LEADER_MAP).map(([teamLabel, cfg]) => ({
    teamLabel,
    leaderName: cfg.leaderName,
    mobile: String(cfg.mobile || "").replace(/\D/g, ""),
  }));
}

export function loadTeamMappings() {
  const parsed = safeParse(erpGetItem(MAPPING_KEY), null);
  if (Array.isArray(parsed) && parsed.length) {
    return parsed.map(normalizeMappingRow).filter(Boolean);
  }
  return getDefaultTeamMappings();
}

export function saveTeamMappings(rows) {
  const cleaned = (rows || []).map(normalizeMappingRow).filter(Boolean);
  erpSetItem(MAPPING_KEY, JSON.stringify(cleaned));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(LABOUR_TEAM_MAPPING_SYNC_EVENT));
  }
  return cleaned;
}

export function loadSaleTeams() {
  const parsed = safeParse(erpGetItem(SALE_TEAMS_KEY), null);
  if (Array.isArray(parsed) && parsed.length) {
    return parsed.map(normalizeSaleTeamRow).filter(Boolean);
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const fromObj = Object.entries(parsed).map(([teamLabel, cfg]) =>
      normalizeSaleTeamRow({ teamLabel, ...cfg }),
    );
    if (fromObj.filter(Boolean).length) return fromObj.filter(Boolean);
  }
  return getDefaultSaleTeams();
}

export function saveSaleTeams(rows) {
  const cleaned = (rows || []).map(normalizeSaleTeamRow).filter(Boolean);
  erpSetItem(SALE_TEAMS_KEY, JSON.stringify(cleaned));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(LABOUR_TEAM_MAPPING_SYNC_EVENT));
  }
  return cleaned;
}

/** Sale Sheet Team Work dropdown options (defaults + saved teams). */
export function getSaleTeamWorkOptions() {
  const fromStore = loadSaleTeams()
    .map((t) => t.teamLabel)
    .filter(Boolean);
  return [...new Set([...SALE_TEAM_WORK_OPTIONS, ...fromStore])];
}

/** Sale Team Work label → config (storage pehle, phir default). */
export function resolveSaleTeamConfig(teamWork) {
  const key = String(teamWork || "").trim().toUpperCase();
  if (!key) return null;
  const teams = loadSaleTeams();
  const row = teams.find((t) => t.teamLabel.toUpperCase() === key);
  if (!row) return null;
  const mapping = loadTeamMappings().find(
    (m) => m.leader.toLowerCase() === row.leaderName.toLowerCase(),
  );
  return {
    teamLabel: row.teamLabel,
    leaderName: row.leaderName,
    mobile: row.mobile,
    defaultMembers: mapping?.members ?? [],
  };
}
