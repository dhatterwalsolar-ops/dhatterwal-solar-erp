import { AUTH_STORAGE_KEY } from "../constants/auth";

export function setAuthSession(session) {
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function getAuthSession() {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearAuthSession() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}
