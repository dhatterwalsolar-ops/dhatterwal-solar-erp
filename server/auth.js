import jwt from "jsonwebtoken";
import { getKey, setKey } from "./store.js";

/** Fallback when shared store me abhi users nahi (pehli baar). */
export const SERVER_USERS = [
  {
    userId: "admin",
    password: "admin123",
    role: "admin",
    roleLabel: "Admin",
    accessProfile: "admin",
    displayName: "Sonu Ji",
  },
  {
    userId: "staff",
    password: "staff123",
    role: "staff",
    roleLabel: "Staff",
    accessProfile: "staff",
    displayName: "Rohit Kumar",
  },
  {
    userId: "jagdeep",
    password: "jagdeep123",
    role: "staff",
    roleLabel: "Staff",
    accessProfile: "ajay_dhatterwal",
    displayName: "Jagdeep",
  },
  {
    userId: "randeep",
    password: "randeep123",
    role: "staff",
    roleLabel: "Staff",
    accessProfile: "ajay_dhatterwal",
    displayName: "Randeep",
  },
  {
    userId: "ajaynain",
    password: "ajaynain123",
    role: "staff",
    roleLabel: "Staff",
    accessProfile: "ajay_nain",
    displayName: "Ajay Nain",
  },
];

const LOGIN_USERS_KEY = "dhatterwal_erp_login_users";
const FORCE_SEED_IDS = new Set(["jagdeep", "randeep", "ajaynain"]);

function normalizeUser(u) {
  const userId = String(u?.userId || "").trim();
  if (!userId) return null;
  let accessProfile = String(u?.accessProfile || "").trim();
  if (!accessProfile) {
    accessProfile =
      String(u?.role || "staff").toLowerCase() === "admin" ? "admin" : "staff";
  }
  if (accessProfile === "ajay_dhatterwal" || accessProfile === "ajay_nain") {
    return {
      userId,
      password: String(u?.password ?? ""),
      role: "staff",
      roleLabel: "Staff",
      accessProfile,
      displayName: String(u?.displayName || userId).trim() || userId,
    };
  }
  const role = String(u?.role || "staff").toLowerCase() === "admin" ? "admin" : "staff";
  if (accessProfile === "admin") {
    return {
      userId,
      password: String(u?.password ?? ""),
      role: "admin",
      roleLabel: "Admin",
      accessProfile: "admin",
      displayName: String(u?.displayName || userId).trim() || userId,
    };
  }
  return {
    userId,
    password: String(u?.password ?? ""),
    role,
    roleLabel: role === "admin" ? "Admin" : "Staff",
    accessProfile: accessProfile || (role === "admin" ? "admin" : "staff"),
    displayName: String(u?.displayName || userId).trim() || userId,
  };
}

async function loadUsersFromStore() {
  try {
    const raw = await getKey(LOGIN_USERS_KEY);
    if (!raw) return null;
    const list = JSON.parse(raw);
    if (!Array.isArray(list) || !list.length) return null;
    return list.map(normalizeUser).filter(Boolean);
  } catch {
    return null;
  }
}

/** Jagdeep / Randeep / Ajay Nain ko store me sahi password + Staff role se sync. */
export async function ensureSeededLoginUsers() {
  const fromStore = await loadUsersFromStore();
  const list = fromStore?.length
    ? [...fromStore]
    : SERVER_USERS.map((u) => normalizeUser(u)).filter(Boolean);
  let changed = false;

  for (const seed of SERVER_USERS) {
    if (!FORCE_SEED_IDS.has(seed.userId)) continue;
    const idx = list.findIndex(
      (u) => u.userId.toLowerCase() === seed.userId.toLowerCase(),
    );
    if (idx < 0) {
      list.push(normalizeUser(seed));
      changed = true;
      continue;
    }
    const cur = list[idx];
    const next = normalizeUser({
      ...cur,
      password: seed.password,
      role: seed.role,
      accessProfile: seed.accessProfile,
      displayName: cur.displayName || seed.displayName,
    });
    if (
      cur.password !== next.password ||
      cur.role !== next.role ||
      cur.accessProfile !== next.accessProfile
    ) {
      list[idx] = next;
      changed = true;
    }
  }

  if (changed || !fromStore?.length) {
    await setKey(
      LOGIN_USERS_KEY,
      JSON.stringify(list.map(normalizeUser).filter(Boolean)),
    );
  }
  return list.map(normalizeUser).filter(Boolean);
}

export async function findUser(userId, password) {
  const id = String(userId || "").trim().toLowerCase();
  const pass = String(password || "");
  const list = await ensureSeededLoginUsers();
  return (
    list.find(
      (u) => u.userId.toLowerCase() === id && String(u.password ?? "") === pass,
    ) || null
  );
}

export function getJwtSecret() {
  return process.env.ERP_JWT_SECRET || "dhatterwal-erp-dev-secret-change-me";
}

export function signToken(user) {
  return jwt.sign(
    {
      userId: user.userId,
      role: user.role,
      roleLabel: user.roleLabel,
      displayName: user.displayName,
      accessProfile: user.accessProfile || "",
    },
    getJwtSecret(),
    { expiresIn: "30d" },
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    return null;
  }
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ ok: false, error: "Unauthorized — login again." });
    return;
  }
  req.user = payload;
  next();
}
