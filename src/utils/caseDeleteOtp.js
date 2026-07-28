import {
  SETTINGS_OTP_MOBILE,
  SETTINGS_OTP_MOBILE_DISPLAY,
} from "../constants/settingsDefaults";

/** Demo OTP — backend/SMS connect hone par replace hoga. */
export const CASE_DELETE_DEMO_OTP = "482916";

const OTP_SENT_KEY = "dhatterwal_case_delete_otp_sent";

export function getCaseDeleteOtpMobileDisplay() {
  return SETTINGS_OTP_MOBILE_DISPLAY;
}

export function getCaseDeleteOtpMobile() {
  return SETTINGS_OTP_MOBILE;
}

export function sendCaseDeleteOtp() {
  sessionStorage.setItem(OTP_SENT_KEY, String(Date.now()));
  return {
    mobileDisplay: SETTINGS_OTP_MOBILE_DISPLAY,
    mobile: SETTINGS_OTP_MOBILE,
    demoOtp: CASE_DELETE_DEMO_OTP,
  };
}

export function isCaseDeleteOtpSent() {
  return Boolean(sessionStorage.getItem(OTP_SENT_KEY));
}

export function verifyCaseDeleteOtp(code) {
  if (!isCaseDeleteOtpSent()) return false;
  const ok = String(code || "").trim() === CASE_DELETE_DEMO_OTP;
  if (ok) sessionStorage.removeItem(OTP_SENT_KEY);
  return ok;
}

export function clearCaseDeleteOtpSession() {
  sessionStorage.removeItem(OTP_SENT_KEY);
}
