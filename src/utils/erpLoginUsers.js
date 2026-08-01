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
  let changed = false;
  for (const seed of SEEDED_USERS) {
    const idx = next.findIndex(
      (u) => u.userId.toLowerCase() === seed.userId.toLowerCase(),
    );
    if (idx < 0) {
      next.push(normalizeLoginUser(seed));
      changed = true;
      continue;
    }
    /* Password Settings se change ho — seed se overwrite mat karo */
    const cur = next[idx];
    const lockedProfile =
      seed.userId.toLowerCase() === "ajaynain" ? "ajay_nain" : "";
    const patched = normalizeLoginUser({
      ...cur,
      password: cur.password || seed.password,
      accessProfile: lockedProfile || cur.accessProfile || seed.accessProfile,
      role: cur.role || seed.role,
      displayName: cur.displayName || seed.displayName,
    });
    if (
      patched.password !== cur.password ||
      patched.accessProfile !== cur.accessProfile ||
      patched.role !== cur.role
    ) {
      next[idx] = patched;
      changed = true;
    }
  }
  return { list: next, changed };
}

export function loadLoginUsers() {
  const list = safeParse(erpGetItem(LOGIN_USERS_KEY), null);
  if (Array.isArray(list) && list.length > 0) {
    const { list: normalized, changed } = mergeSeededUsers(
      list.map(normalizeLoginUser).filter(Boolean),
    );
    if (changed) saveLoginUsers(normalized);
    return normalized;
  }
  const { list: seeded } = mergeSeededUsers(DEFAULT_LOGINS.map((u) => ({ ...u })));
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

export function upsertLoginUser(patch, options = {}) {
  const list = loadLoginUsers();
  const next = normalizeLoginUser(patch);
  if (!next) throw new Error("Login ID zaroori hai.");
  if (!next.password) throw new Error("Password zaroori hai.");
  const previousId = String(options.previousUserId || "").trim().toLowerCase();
  if (previousId && previousId !== next.userId.toLowerCase()) {
    const clash = list.some(
      (u) =>
        u.userId.toLowerCase() === next.userId.toLowerCase() &&
        u.userId.toLowerCase() !== previousId,
    );
    if (clash) throw new Error("Ye Login ID pehle se hai — dusra choose karein.");
    const idxOld = list.findIndex((u) => u.userId.toLowerCase() === previousId);
    if (idxOld < 0) throw new Error("User nahi mila.");
    list[idxOld] = next;
    return saveLoginUsers(list);
  }
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
