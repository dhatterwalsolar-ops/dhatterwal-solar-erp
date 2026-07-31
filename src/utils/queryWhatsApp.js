import { QUERY_ALERT_STAFF } from "../constants/contact";
import {
  buildWhatsAppWebSendUrl,
  ERP_WHATSAPP_SENDER_DISPLAY,
  normalizeIndianWhatsAppMobile,
  remindWhatsAppWebSenderLogin,
} from "../constants/erpWhatsApp";
import { apiSendWhatsApp } from "./messagingApi";
import { listQueriesNeedingStaffAlert, updateQuery } from "./querySheetStorage";

async function sendWhatsAppPreferApi(mobile, text, options = {}) {
  const digits = normalizeIndianWhatsAppMobile(mobile);
  if (!digits || digits.length !== 10) {
    window.alert("Mobile 10 digit nahi hai — WhatsApp nahi bhej sakte.");
    return false;
  }
  try {
    const data = await apiSendWhatsApp({ to: digits, text });
    if (data.live) return true;
    if (data.useWebFallback || data.provider === "web") {
      if (!options.skipConfirm && options.confirmText && !window.confirm(options.confirmText)) {
        return false;
      }
      remindWhatsAppWebSenderLogin();
      const url = buildWhatsAppWebSendUrl(digits, text);
      if (!url) return false;
      window.open(url, "_blank", "noopener,noreferrer");
      return true;
    }
    window.alert(data.error || "WhatsApp API send fail.");
    return false;
  } catch (err) {
    if (!options.skipWebFallbackOnError) {
      if (!options.skipConfirm && options.confirmText && !window.confirm(options.confirmText)) {
        return false;
      }
      remindWhatsAppWebSenderLogin();
      const url = buildWhatsAppWebSendUrl(digits, text);
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        return true;
      }
    }
    window.alert(err?.message || "WhatsApp send fail.");
    return false;
  }
}

export function buildQueryWhatsAppToLeader(query) {
  const lines = [
    `*Dhatterwal Solar — Service Query*`,
    ``,
    `*Customer detail (call karein):*`,
    `Name: ${query.customerName || "—"}`,
    `Mobile: ${query.mobile || "—"}`,
    `Address: ${query.address || "—"}`,
    query.consumerNo ? `Consumer No.: ${query.consumerNo}` : null,
    ``,
    `*Query about:* ${query.queryAbout || "—"}`,
    `*Detail:*`,
    query.detail || "—",
    query.customerPhotoData ? `Customer ne site/inverter photo bhi upload ki hai — ERP Query Sheet me dekhein.` : null,
    ``,
    `Team: ${query.assignedTeamWork || "—"}`,
    `Aap (Team Leader): ${query.assignedLeaderName || "—"}`,
    ``,
    `Site thik karke ERP Query Sheet me *fix photo upload / Submit* karein — tab customer ko "Query Solved" WhatsApp jayega.`,
    ``,
    `— Office: ${ERP_WHATSAPP_SENDER_DISPLAY}`,
  ];
  return lines.filter((x) => x !== null).join("\n");
}

export function buildQueryWhatsAppToCustomer(query) {
  const lines = [
    `*Dhatterwal Solar Energy System*`,
    ``,
    `Namaste ${query.customerName || "Ji"},`,
    ``,
    `Aapki service query humein mil gayi hai.`,
    `*Query:* ${query.queryAbout || "—"}`,
    ``,
    `*Aapki site par aane wale Team Leader:*`,
    `Name: ${query.assignedLeaderName || "—"}`,
    `Mobile: ${query.assignedLeaderMobile || "—"}`,
    query.assignedTeamWork ? `Team: ${query.assignedTeamWork}` : null,
    ``,
    `Kripya inse contact kar sakte hain. Jaldi problem resolve karwayenge.`,
    ``,
    `Dhanyavaad,`,
    `Dhatterwal Solar`,
  ];
  return lines.filter((x) => x !== null).join("\n");
}

export function buildQuerySolvedWhatsAppToCustomer(query) {
  const lines = [
    `*Dhatterwal Solar Energy System*`,
    ``,
    `Namaste ${query.customerName || "Ji"},`,
    ``,
    `✅ *Your query solved*`,
    `Aapki service query resolve ho chuki hai.`,
    `*Query:* ${query.queryAbout || "—"}`,
    query.assignedLeaderName
      ? `Team Leader: ${query.assignedLeaderName}${query.assignedLeaderMobile ? ` (${query.assignedLeaderMobile})` : ""}`
      : null,
    ``,
    `Koi aur samasya ho to website Service Query se dubara likhein ya office call karein.`,
    ``,
    `Dhanyavaad,`,
    `Dhatterwal Solar`,
  ];
  return lines.filter((x) => x !== null).join("\n");
}

export function buildQueryAdminCloseWhatsAppToCustomer(query) {
  const lines = [
    `*Dhatterwal Solar Energy System*`,
    ``,
    `Namaste ${query.customerName || "Ji"},`,
    ``,
    `Aapki service query office se *close* kar di gayi hai.`,
    `*Query:* ${query.queryAbout || "—"}`,
    ``,
    `*Office remark:*`,
    query.closeRemark || "—",
    ``,
    `Dhanyavaad,`,
    `Dhatterwal Solar`,
  ];
  return lines.filter((x) => x !== null).join("\n");
}

export async function openWhatsAppQueryToLeader(query, options = {}) {
  return sendWhatsAppPreferApi(
    query.assignedLeaderMobile,
    buildQueryWhatsAppToLeader(query),
    {
      skipConfirm: options.skipConfirm,
      confirmText: `WhatsApp se *${query.assignedLeaderName}* (${query.assignedTeamWork || "Team"}) ko customer detail bhejein?`,
    },
  );
}

export async function openWhatsAppQueryToCustomer(query, options = {}) {
  return sendWhatsAppPreferApi(query.mobile, buildQueryWhatsAppToCustomer(query), {
    skipConfirm: options.skipConfirm,
    confirmText: `Customer *${query.customerName || ""}* ko Team Leader detail WhatsApp karein?`,
  });
}

export async function openWhatsAppQuerySolvedToCustomer(query, options = {}) {
  return sendWhatsAppPreferApi(query.mobile, buildQuerySolvedWhatsAppToCustomer(query), {
    skipConfirm: options.skipConfirm,
    confirmText: `Customer ko "Your query solved" WhatsApp bhejein?`,
  });
}

export async function openWhatsAppQueryAdminCloseToCustomer(query, options = {}) {
  return sendWhatsAppPreferApi(query.mobile, buildQueryAdminCloseWhatsAppToCustomer(query), {
    skipConfirm: options.skipConfirm,
    confirmText: `Customer ko office close remark WhatsApp karein?`,
  });
}

/** Assign ke baad: pehle TL, thodi der baad customer. */
export async function openWhatsAppQueryAssignFlow(query) {
  const okTl = await openWhatsAppQueryToLeader(query, { skipConfirm: true });
  window.setTimeout(() => {
    openWhatsAppQueryToCustomer(query, { skipConfirm: true });
  }, 700);
  return okTl;
}

export function buildStaffQueryAlertMessage(query) {
  const lines = [
    `*Dhatterwal Solar — New Website Query*`,
    ``,
    `*Action:* ${QUERY_ALERT_STAFF.name}`,
    ``,
    `*Customer:* ${query.customerName || "—"}`,
    `*Mobile:* ${query.mobile || "—"}`,
    `*Address:* ${query.address || "—"}`,
    query.consumerNo ? `*Consumer No.:* ${query.consumerNo}` : null,
    ``,
    `*Query about:* ${query.queryAbout || "—"}`,
    `*Detail:*`,
    query.detail || "—",
    query.customerPhotoData
      ? `📷 Customer ne inverter/site photo upload ki — ERP Query Sheet me dekhein.`
      : null,
    ``,
    `ERP → Query Sheet → Team Leader transfer karein.`,
    ``,
    `— ERP alert (${ERP_WHATSAPP_SENDER_DISPLAY})`,
  ];
  return lines.filter((x) => x !== null).join("\n");
}

/** API (Meta/Twilio) pehle; warna office WhatsApp Web → Jagdeep. */
export async function openWhatsAppStaffQueryAlert(query, options = {}) {
  return sendWhatsAppPreferApi(
    QUERY_ALERT_STAFF.mobile,
    buildStaffQueryAlertMessage(query),
    {
      skipConfirm: options.skipConfirm,
      confirmText: `ERP se *${QUERY_ALERT_STAFF.name}* (${QUERY_ALERT_STAFF.mobile}) ko website query alert bhejein?`,
    },
  );
}

const alertedInSession = new Set();

/**
 * Website pending alerts — live WA API ya ERP WhatsApp Web se Jagdeep.
 */
export function processPendingQueryStaffAlerts() {
  if (typeof window === "undefined") return 0;
  const pending = listQueriesNeedingStaffAlert().filter((q) => !alertedInSession.has(q.id));
  if (!pending.length) return 0;

  const query = pending[0];
  alertedInSession.add(query.id);
  updateQuery(query.id, {
    staffAlertSent: true,
    staffAlertSentAt: new Date().toISOString(),
  });
  openWhatsAppStaffQueryAlert(query, { skipConfirm: true });
  return pending.length;
}
