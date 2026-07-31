import {
  getOfficeWhatsAppDisplay,
  normalizeIndianWhatsAppMobile,
} from "../constants/erpWhatsApp";
import { getSaleTeamLeaderConfig } from "../constants/saleTeamMapping";
import { officeWhatsAppFooterLine, sendOfficeWhatsApp } from "./officeWhatsAppSend";
import { getPublicAppBaseUrl, isLocalhostBaseUrl } from "./siteOrderUrl";
import { getLabourEmployees } from "./labourEmployeeStorage";
import { erpGetItem, erpSetItem } from "./erpStorage";

const LABOUR_GOOGLE_FORM_KEY = "dhatterwal_labour_daily_google_form_url";
const LABOUR_FORM_PREFILL_KEY = "dhatterwal_labour_google_form_entry_ids";

function safeParseJson(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function getLabourDailyGoogleFormUrl() {
  try {
    return erpGetItem(LABOUR_GOOGLE_FORM_KEY) || "";
  } catch {
    return "";
  }
}

export function setLabourDailyGoogleFormUrl(url) {
  try {
    erpSetItem(LABOUR_GOOGLE_FORM_KEY, String(url || "").trim());
  } catch {
    /* ignore */
  }
}

function leaderMobileByName(leaderName) {
  const employees = getLabourEmployees();
  const match = employees.find(
    (e) =>
      String(e.role || "").toLowerCase() === "team leader" &&
      String(e.name || "").trim().toLowerCase() === String(leaderName || "").trim().toLowerCase(),
  );
  return normalizeIndianWhatsAppMobile(match?.mobile || "");
}

export function buildLabourDailyGoogleFormUrl(form) {
  const base = getLabourDailyGoogleFormUrl();
  if (!base) return "";
  const ids = safeParseJson(erpGetItem(LABOUR_FORM_PREFILL_KEY), {});
  const pairs = [];
  const add = (key, value) => {
    const entry = ids[key];
    const text = String(value ?? "").trim();
    if (!entry || !text) return;
    pairs.push(`${encodeURIComponent(entry)}=${encodeURIComponent(text)}`);
  };
  add("consumerNo", form.consumerNo);
  add("customerName", form.customerName);
  add("siteAddress", form.siteAddress);
  add("setupKw", form.setupKw);
  add("setupDetail", form.setupDetail);
  add("teamLeader", form.teamLeader);
  add("date", form.date);
  add("workDetails", form.workDetails);
  add("materialDone", form.materialDone);
  if (!pairs.length) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}${pairs.join("&")}`;
}

export function buildLabourDailyWhatsAppMessage(form) {
  const googleUrl = buildLabourDailyGoogleFormUrl(form);
  const lines = [
    "*Dhatterwal Solar — Daily Labour / Site Work*",
    `Date: ${form.date || "Aaj"}`,
    `Team Leader: ${form.teamLeader || "—"}`,
    "",
    "*Consumer detail (Sale Sheet)*",
    `Consumer No.: ${form.consumerNo || "—"}`,
    `Customer: ${form.customerName || "—"}`,
    `Setup: ${form.setupKw || "—"}`,
    `Site: ${form.siteAddress || "—"}`,
    "",
    "*Setup detail*",
    form.setupDetail || "—",
    "",
    "*Labour / work (Google Form me update)*",
    form.workDetails?.trim() || "(Form me aaj ka kaam likhein)",
    form.materialDone?.trim() ? `Material: ${form.materialDone}` : "",
    "",
  ].filter(Boolean);

  if (googleUrl) {
    lines.push("*Google Form link:*", googleUrl, "");
  } else {
    lines.push("(Labour Google Form URL office me save karein.)", "");
  }

  if (isLocalhostBaseUrl(getPublicAppBaseUrl())) {
    lines.push("⚠️ ERP localhost — Sale Sheet me WiFi IP link save karein.", "");
  }

  lines.push(
    "Google Form se labour/work update karein taaki record sahi rahe.",
    officeWhatsAppFooterLine(),
  );

  return lines.join("\n");
}

export async function openLabourDailyWhatsAppToLeader(form) {
  const teamCfg = form.teamWork ? getSaleTeamLeaderConfig(form.teamWork) : null;
  let mobile = teamCfg?.mobile || leaderMobileByName(form.teamLeader);
  if (!mobile && form.teamLeader) {
    mobile = leaderMobileByName(form.teamLeader);
  }
  mobile = normalizeIndianWhatsAppMobile(mobile);
  if (!mobile || mobile.length !== 10) {
    window.alert("Team leader ka mobile Labour Details me set karein.");
    return false;
  }

  return sendOfficeWhatsApp(mobile, buildLabourDailyWhatsAppMessage(form), {
    confirmText:
      `Office WhatsApp (${getOfficeWhatsAppDisplay()}) se *${form.teamLeader || "Team leader"}* ko labour form bhejein?\n\n` +
      `Consumer: ${form.consumerNo}`,
  });
}
