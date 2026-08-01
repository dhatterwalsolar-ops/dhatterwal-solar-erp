import { TEAM_MAPPING_DEFAULT } from "../constants/labourEmployees";
import { SALE_TEAM_WORK_OPTIONS } from "../constants/saleCase";
import { SALE_TEAM_LEADER_MAP } from "../constants/saleTeamMappingDefaults";
import { erpGetItem, erpSetItem } from "./erpStorage";
import { getLabourEmployees } from "./labourEmployeeStorage";

const MAPPING_KEY = "dhatterwal_labour_team_mapping";
const SALE_TEAMS_KEY = "dhatterwal_sale_team_leader_map";
export const LABOUR_TEAM_MAPPING_SYNC_EVENT = "dhatterwal-labour-team-mapping-sync";
export const LABOUR_EMPLOYEES_SYNC_EVENT = "dhatterwal-labour-employees-sync";

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function isActiveEmployee(e) {
  return String(e?.status || "Active").toLowerCase() !== "inactive";
}

function isTeamLeader(e) {
  return String(e?.role || "").toLowerCase() === "team leader";
}

function isHelper(e) {
  return String(e?.role || "").toLowerCase() === "helper";
}

/** "Balinder Goswami" → "BALINDER TEAM" */
export function teamLabelFromLeaderName(name) {
  const n = String(name || "").trim();
  if (!n) return "";
  if (/\bTEAM\b/i.test(n)) return n.toUpperCase().replace(/\s+/g, " ");
  const first = n.split(/\s+/)[0];
  return `${first.toUpperCase()} TEAM`;
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

export function saveTeamMappings(rows, { silent = false } = {}) {
  const cleaned = (rows || []).map(normalizeMappingRow).filter(Boolean);
  erpSetItem(MAPPING_KEY, JSON.stringify(cleaned));
  if (!silent && typeof window !== "undefined") {
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

export function saveSaleTeams(rows, { silent = false } = {}) {
  const cleaned = (rows || []).map(normalizeSaleTeamRow).filter(Boolean);
  erpSetItem(SALE_TEAMS_KEY, JSON.stringify(cleaned));
  if (!silent && typeof window !== "undefined") {
    window.dispatchEvent(new Event(LABOUR_TEAM_MAPPING_SYNC_EVENT));
  }
  return cleaned;
}

function findSaleTeamForLeader(saleTeams, leaderName) {
  const key = String(leaderName || "")
    .trim()
    .toLowerCase();
  if (!key) return null;
  const exact = saleTeams.find((t) => t.leaderName.toLowerCase() === key);
  if (exact) return exact;
  const first = key.split(/\s+/)[0];
  return (
    saleTeams.find((t) => t.teamLabel.toUpperCase().startsWith(first.toUpperCase())) || null
  );
}

/**
 * Labour Details me Team Leader / Helper save hone par
 * Sale Sheet teams + Leader→Helpers mapping auto update.
 */
export function syncTeamsFromLabourEmployees() {
  const employees = getLabourEmployees().filter(isActiveEmployee);
  const leaders = employees.filter(isTeamLeader);
  const helpers = employees.filter(isHelper);

  if (!leaders.length && !helpers.length) return { saleTeams: loadSaleTeams(), mappings: loadTeamMappings() };

  let saleTeams = loadSaleTeams().map((t) => ({ ...t }));
  let mappings = loadTeamMappings().map((m) => ({
    leader: m.leader,
    members: [...(m.members || [])],
  }));
  let saleChanged = false;
  let mapChanged = false;

  leaders.forEach((leader) => {
    const name = String(leader.name || "").trim();
    if (!name) return;
    const mobile = String(leader.mobile || "").replace(/\D/g, "");
    let row = findSaleTeamForLeader(saleTeams, name);
    if (row) {
      if (row.leaderName !== name) {
        row.leaderName = name;
        saleChanged = true;
      }
      if (mobile && row.mobile !== mobile) {
        row.mobile = mobile;
        saleChanged = true;
      }
    } else {
      saleTeams.push({
        teamLabel: teamLabelFromLeaderName(name),
        leaderName: name,
        mobile,
      });
      saleChanged = true;
    }

    const linked = helpers
      .filter(
        (h) =>
          String(h.teamLeaderName || "")
            .trim()
            .toLowerCase() === name.toLowerCase(),
      )
      .map((h) => String(h.name || "").trim())
      .filter(Boolean);

    let map = mappings.find((m) => m.leader.toLowerCase() === name.toLowerCase());
    if (!map) {
      mappings.push({ leader: name, members: linked });
      mapChanged = true;
    } else {
      const merged = [...new Set([...(map.members || []), ...linked])];
      if (
        merged.length !== (map.members || []).length ||
        merged.some((m, i) => m !== map.members[i])
      ) {
        map.members = merged;
        mapChanged = true;
      }
    }
  });

  /* Helpers jinke leader pehle se mapping me hain — naam merge */
  helpers.forEach((h) => {
    const leaderName = String(h.teamLeaderName || "").trim();
    const helperName = String(h.name || "").trim();
    if (!leaderName || !helperName) return;
    let map = mappings.find((m) => m.leader.toLowerCase() === leaderName.toLowerCase());
    if (!map) {
      mappings.push({ leader: leaderName, members: [helperName] });
      mapChanged = true;
      return;
    }
    if (!map.members.some((m) => m.toLowerCase() === helperName.toLowerCase())) {
      map.members = [...map.members, helperName];
      mapChanged = true;
    }
  });

  if (saleChanged) saleTeams = saveSaleTeams(saleTeams, { silent: true });
  if (mapChanged) mappings = saveTeamMappings(mappings, { silent: true });

  if ((saleChanged || mapChanged) && typeof window !== "undefined") {
    window.dispatchEvent(new Event(LABOUR_TEAM_MAPPING_SYNC_EVENT));
  }

  return { saleTeams, mappings };
}

/** Leader ke under saare labour names (leader + helpers). */
export function getLabourNamesForLeader(leaderName) {
  const key = String(leaderName || "")
    .trim()
    .toLowerCase();
  if (!key) return [];
  const employees = getLabourEmployees().filter(isActiveEmployee);
  const leaderEmp = employees.find(
    (e) => isTeamLeader(e) && String(e.name || "").trim().toLowerCase() === key,
  );
  const mapping = loadTeamMappings().find((m) => m.leader.toLowerCase() === key);
  const fromMap = mapping?.members || [];
  const fromHelpers = employees
    .filter(
      (e) =>
        isHelper(e) &&
        String(e.teamLeaderName || "")
          .trim()
          .toLowerCase() === key,
    )
    .map((e) => String(e.name || "").trim())
    .filter(Boolean);

  const names = [];
  const seen = new Set();
  const push = (n) => {
    const label = String(n || "").trim();
    if (!label) return;
    const k = label.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    names.push(label);
  };

  push(leaderEmp?.name || leaderName);
  [...fromMap, ...fromHelpers].forEach(push);
  return names;
}

/** Sale Sheet Team Work dropdown — defaults + saved + Labour Team Leaders. */
export function getSaleTeamWorkOptions() {
  const saleTeams = loadSaleTeams();
  const fromStore = saleTeams.map((t) => t.teamLabel).filter(Boolean);
  const fromLeaders = getLabourEmployees()
    .filter((e) => isActiveEmployee(e) && isTeamLeader(e))
    .map((e) => {
      const match = findSaleTeamForLeader(saleTeams, e.name);
      return match?.teamLabel || teamLabelFromLeaderName(e.name);
    })
    .filter(Boolean);
  return [...new Set([...SALE_TEAM_WORK_OPTIONS, ...fromStore, ...fromLeaders])];
}

/** Sale Team Work label → config (storage pehle, phir Labour employee). */
export function resolveSaleTeamConfig(teamWork) {
  const key = String(teamWork || "").trim().toUpperCase();
  if (!key) return null;
  const teams = loadSaleTeams();
  let row = teams.find((t) => t.teamLabel.toUpperCase() === key);

  if (!row) {
    const leaders = getLabourEmployees().filter((e) => isActiveEmployee(e) && isTeamLeader(e));
    const leader =
      leaders.find((e) => teamLabelFromLeaderName(e.name).toUpperCase() === key) ||
      leaders.find((e) => {
        const first = String(e.name || "")
          .trim()
          .split(/\s+/)[0]
          .toUpperCase();
        return first && key.startsWith(`${first} `);
      });
    if (leader) {
      row = {
        teamLabel: String(teamWork).trim(),
        leaderName: String(leader.name || "").trim(),
        mobile: String(leader.mobile || "").replace(/\D/g, ""),
      };
    }
  }

  if (!row) return null;
  const members = getLabourNamesForLeader(row.leaderName);
  return {
    teamLabel: row.teamLabel,
    leaderName: row.leaderName,
    mobile: row.mobile,
    defaultMembers: members.filter(
      (n) => n.toLowerCase() !== String(row.leaderName || "").toLowerCase(),
    ),
    allNames: members,
  };
}

/** Sale Sheet UI — team ke under dikhane ke liye. */
export function getSaleTeamMembersDisplay(teamWork) {
  const cfg = resolveSaleTeamConfig(teamWork);
  if (!cfg) return "";
  const helpers = (cfg.allNames || []).filter(
    (n) => n.toLowerCase() !== String(cfg.leaderName || "").toLowerCase(),
  );
  if (!helpers.length) {
    return `Leader: ${cfg.leaderName}`;
  }
  return `Leader: ${cfg.leaderName}\nLabour: ${helpers.join(", ")}`;
}
