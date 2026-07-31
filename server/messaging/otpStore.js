import crypto from "node:crypto";
import { messagingConfig } from "./config.js";
import { sendOtpSms } from "./sms.js";

/** purpose -> { hash, expiresAt, mobile, attempts } */
const store = new Map();

function hashOtp(purpose, mobile, code) {
  return crypto
    .createHash("sha256")
    .update(`${purpose}:${mobile}:${code}:${process.env.ERP_JWT_SECRET || "dev"}`)
    .digest("hex");
}

function genOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function issueOtp({ purpose, mobile } = {}) {
  const c = messagingConfig();
  const p = String(purpose || "generic").trim() || "generic";
  const m = String(mobile || c.otpMobile || "")
    .replace(/\D/g, "")
    .slice(-10);
  if (m.length !== 10) throw new Error("OTP mobile invalid");

  const code = genOtp();
  const expiresAt = Date.now() + c.otpTtlMs;
  store.set(p, {
    hash: hashOtp(p, m, code),
    expiresAt,
    mobile: m,
    attempts: 0,
  });

  const sms = await sendOtpSms(m, code);
  return {
    ok: true,
    purpose: p,
    mobileDisplay: `******${m.slice(-4)}`,
    expiresInSec: Math.round(c.otpTtlMs / 1000),
    smsProvider: sms.provider,
    demo: Boolean(sms.demo),
    /** Only returned when SMS_PROVIDER=demo */
    demoOtp: sms.demo ? code : undefined,
    message: sms.demo
      ? "Demo OTP (SMS live nahi). Neeche demoOtp use karein."
      : "OTP SMS bhej diya gaya.",
  };
}

export function verifyOtp({ purpose, code } = {}) {
  const p = String(purpose || "generic").trim() || "generic";
  const entry = store.get(p);
  if (!entry) return { ok: false, error: "Pehle Send OTP karein." };
  if (Date.now() > entry.expiresAt) {
    store.delete(p);
    return { ok: false, error: "OTP expire ho gaya. Dubara Send OTP." };
  }
  entry.attempts += 1;
  if (entry.attempts > 8) {
    store.delete(p);
    return { ok: false, error: "Bahut attempts. Dubara Send OTP." };
  }
  const expected = hashOtp(p, entry.mobile, String(code || "").trim());
  if (expected !== entry.hash) return { ok: false, error: "Galat OTP." };
  store.delete(p);
  return { ok: true, mobile: entry.mobile };
}
