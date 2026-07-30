import { erpGetItem, erpSetItem } from "./erpStorage";
import { ACCESS_PROFILES, getAccessProfile } from "./erpAccess";

export const LOGIN_USERS_KEY = "dhatterwal_erp_login_users";

const DEFAULT_LOGINS = [
  {
    userId: "admin",
    password: "admin123",
    role: "admin",
    accessProfile: "admin",
    displayName: "Sonu Ji",
  },
  {
    userId: "staff",
    password: "staff123",
    role: "staff",
    accessProfile: "staff",
    displayName: "Rohit Kumar",
  },
];

/** Teen naye users — Jagdeep/Randeep = 5 sheets Staff; Ajay Nain = limited */
const SEEDED_USERS = [
  {
    userId: "jagdeep",
    password: "jagdeep123",
    role: "staff",
    accessProfile: "ajay_dhatterwal",
    displayName: "Jagdeep",
  },
  {
    userId: "randeep",
    password: "randeep123",
    role: "staff",
    accessProfile: "ajay_dhatterwal",
    displayName: "Randeep",
  },
  {
    userId: "ajaynain",
    password: "ajaynain123",
    role: "staff",
    accessProfile: "ajay_nain",
    displayName: "Ajay Nain",
  },
];

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function mergeSeededUsers(list) {
  const next = [...list];
  for (const seed of SEEDED_USERS) {
    const idx = next.findIndex(
      (u) => u.userId.toLowerCase() === seed.userId.toLowerCase(),
    );
    if (idx < 0) {
      next.push(normalizeLoginUser(seed));
      continue;
    }
    // Seed users: role/profile/password always sync (login fail fix)
    next[idx] = normalizeLoginUser({
      ...next[idx],
      role: seed.role,
      accessProfile: seed.accessProfile,
      displayName: next[idx].displayName || seed.displayName,
      password: seed.password,
    });
  }
  return next;
}

export function loadLoginUsers() {
  const list = safeParse(erpGetItem(LOGIN_USERS_KEY), null);
  if (Array.isArray(list) && list.length > 0) {
    const normalized = mergeSeededUsers(list.map(normalizeLoginUser).filter(Boolean));
    saveLoginUsers(normalized);
    return normalized;
  }
  const seeded = mergeSeededUsers(DEFAULT_LOGINS.map((u) => ({ ...u })));
  saveLoginUsers(seeded);
  return seeded.map((u) => ({ ...u }));
}

export function saveLoginUsers(list) {
  const cleaned = (Array.isArray(list) ? list : [])
    .map(normalizeLoginUser)
    .filter(Boolean);
  erpSetItem(LOGIN_USERS_KEY, JSON.stringify(cleaned));
  return cleaned;
}

export function normalizeLoginUser(user) {
  const userId = String(user?.userId || "").trim();
  if (!userId) return null;
  let accessProfile = String(user?.accessProfile || "").trim();
  const profile = getAccessProfile(accessProfile);
  let role =
    String(user?.role || "staff").toLowerCase() === "admin" ? "admin" : "staff";

  if (profile) {
    role = profile.role;
    accessProfile = profile.id;
  } else if (role === "admin") {
    accessProfile = "admin";
  } else {
    accessProfile = "staff";
  }

  const profileLabel = ACCESS_PROFILES[accessProfile]?.label || "";
  return {
    userId,
    password: String(user?.password ?? ""),
    role,
    roleLabel: role === "admin" ? "Admin" : "Staff",
    accessProfile,
    accessProfileLabel: profileLabel,
    displayName: String(user?.displayName || userId).trim() || userId,
  };
}

/** Settings table rows ↔ login users merge */
export function settingsUsersFromLogins(logins) {
  const today = new Date().toLocaleDateString("en-GB");
  return (logins || []).map((u) => ({
    id: u.userId,
    loginId: u.userId,
    userType: u.roleLabel,
    accessProfile: u.accessProfile,
    accessProfileLabel: u.accessProfileLabel || u.accessProfile,
    userName: u.displayName,
    passwordMask: u.password ? "********" : "—",
    lastUpdated: today,
  }));
}

export function upsertLoginUser(patch) {
  const list = loadLoginUsers();
  const next = normalizeLoginUser(patch);
  if (!next) throw new Error("Login ID zaroori hai.");
  if (!next.password) throw new Error("Password zaroori hai.");
  const idx = list.findIndex((u) => u.userId.toLowerCase() === next.userId.toLowerCase());
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  return saveLoginUsers(list);
}

export function removeLoginUser(userId) {
  const id = String(userId || "").trim().toLowerCase();
  const list = loadLoginUsers();
  const target = list.find((u) => u.userId.toLowerCase() === id);
  if (!target) throw new Error("User nahi mila.");
  const admins = list.filter((u) => u.role === "admin");
  if (target.role === "admin" && admins.length <= 1) {
    throw new Error("Last Admin user delete nahi kar sakte.");
  }
  return saveLoginUsers(list.filter((u) => u.userId.toLowerCase() !== id));
}
