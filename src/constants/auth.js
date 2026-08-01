export const AUTH_STORAGE_KEY = "dhatterwal_erp_auth";

/** Idle kitni der (ms) — uske baad auto logout. */
export const IDLE_LOGOUT_MS = 10 * 60 * 1000;

/** Login page pe message dikhane ke liye (sessionStorage). */
export const IDLE_LOGOUT_FLAG_KEY = "dhatterwal_erp_idle_logout";

export const AUTH_ROLES = {
  ADMIN: "admin",
  STAFF: "staff",
};

/** Demo logins until backend is connected */
export const DEMO_ACCOUNTS = {
  [AUTH_ROLES.ADMIN]: {
    userId: "admin",
    password: "admin123",
    displayName: "Sonu Ji",
    roleLabel: "Admin",
  },
  [AUTH_ROLES.STAFF]: {
    userId: "staff",
    password: "staff123",
    displayName: "Rohit Kumar",
    roleLabel: "Staff",
  },
};
