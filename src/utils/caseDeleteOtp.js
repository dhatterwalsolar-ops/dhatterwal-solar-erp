import {
  SETTINGS_OTP_MOBILE,
  SETTINGS_OTP_MOBILE_DISPLAY,
} from "../constants/settingsDefaults";
import { apiSendOtp, apiVerifyOtp } from "./messagingApi";

const OTP_SENT_KEY = "dhatterwal_case_delete_otp_sent";
const OTP_DEMO_KEY = "dhatterwal_case_delete_otp_demo";

export function getCaseDeleteOtpMobileDisplay() {
  return SETTINGS_OTP_MOBILE_DISPLAY;
}

export function getCaseDeleteOtpMobile() {
  return SETTINGS_OTP_MOBILE;
}

export async function sendCaseDeleteOtp() {
  const data = await apiSendOtp({
    purpose: "case_delete",
    mobile: SETTINGS_OTP_MOBILE,
  });
  sessionStorage.setItem(OTP_SENT_KEY, String(Date.now()));
  if (data.demoOtp) sessionStorage.setItem(OTP_DEMO_KEY, String(data.demoOtp));
  else sessionStorage.removeItem(OTP_DEMO_KEY);
  return {
    mobileDisplay: data.mobileDisplay || SETTINGS_OTP_MOBILE_DISPLAY,
    mobile: SETTINGS_OTP_MOBILE,
    demoOtp: data.demoOtp || "",
    demo: Boolean(data.demo),
    message: data.message || "OTP bhej diya.",
  };
}

export function isCaseDeleteOtpSent() {
  return Boolean(sessionStorage.getItem(OTP_SENT_KEY));
}

export async function verifyCaseDeleteOtp(code) {
  if (!isCaseDeleteOtpSent()) return false;
  try {
    const data = await apiVerifyOtp({ purpose: "case_delete", code });
    if (data.ok) {
      sessionStorage.removeItem(OTP_SENT_KEY);
      sessionStorage.removeItem(OTP_DEMO_KEY);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function clearCaseDeleteOtpSession() {
  sessionStorage.removeItem(OTP_SENT_KEY);
  sessionStorage.removeItem(OTP_DEMO_KEY);
}
