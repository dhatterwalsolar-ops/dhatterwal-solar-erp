/** Company Managing Director label for website / login branding */
export const COMPANY_MD_LABEL = "Company Managing Director";
export const COMPANY_MD_NAME = "Azad Dhakal";
/** @deprecated use COMPANY_MD_NAME — kept for older imports */
export const BRANCH_MD = COMPANY_MD_NAME;

function phoneEntry(displayDigits, note = "") {
  const digits = String(displayDigits).replace(/\D/g, "");
  const local = digits.startsWith("91") && digits.length > 10 ? digits.slice(-10) : digits;
  const pretty = local.replace(/(\d{5})(\d{5})/, "$1 $2");
  return {
    display: `+91 ${pretty}`,
    tel: `+91${local}`,
    note,
  };
}

export const OFFICE_CONTACTS = [
  {
    label: "Office Contact",
    name: "Ajay Dhatterwal",
    ...phoneEntry("7206571028"),
  },
  {
    label: "Kaithal Branch Contact",
    name: "Jagdeep Bidhan Balu",
    ...phoneEntry("9467564675"),
  },
];

export const SERVICE_CONTACTS = [
  {
    label: "Big Project Contact",
    name: "Mr. Azad Dhakal",
    ...phoneEntry("9992891723"),
  },
  {
    label: "On grid Project (02kW, 03kW or 05kW)",
    name: "Jagdeep Bidhan Balu",
    ...phoneEntry("9467564675"),
  },
  {
    label: "Technical Knowledge",
    name: "Sonu Dhatterwal",
    ...phoneEntry("7876686572"),
    whatsappOnly: true,
    note: "Only WhatsApp",
  },
  {
    label: "Subsidy or File Information",
    name: "Amit Panchal",
    ...phoneEntry("9050435049"),
  },
  {
    label: "Extra Knowledge",
    name: "Mr. Randeep Singh Bidhan",
    ...phoneEntry("8426000643"),
  },
];

const officePrimary = OFFICE_CONTACTS[0];

/** Website service-query submit → instant WhatsApp alert (Jagdeep). */
export const QUERY_ALERT_STAFF = {
  name: "Jagdeep Bidhan Balu",
  mobile: "9467564675",
};

export function buildPublicQueryAlertWhatsAppUrl(query) {
  const phone = String(QUERY_ALERT_STAFF.mobile || "").replace(/\D/g, "").slice(-10);
  if (phone.length !== 10) return null;
  const lines = [
    "*Dhatterwal Solar — New Website Query*",
    "",
    `*Action needed:* ${QUERY_ALERT_STAFF.name}`,
    "",
    `*Customer:* ${query.customerName || "—"}`,
    `*Mobile:* ${query.mobile || "—"}`,
    `*Address:* ${query.address || "—"}`,
    query.consumerNo ? `*Consumer No.:* ${query.consumerNo}` : null,
    "",
    `*Query about:* ${query.queryAbout || "—"}`,
    `*Detail:*`,
    query.detail || "—",
    query.hasCustomerPhoto
      ? "📷 Customer ne inverter/site photo bhi upload ki — ERP Query Sheet me dekhein."
      : null,
    "",
    "ERP → Query Sheet me open karke Team Leader transfer karein.",
  ].filter((x) => x !== null);
  return `https://wa.me/91${phone}?text=${encodeURIComponent(lines.join("\n"))}`;
}

export const CONTACT = {
  email: "info@dhatterwalsolar.com",
  phones: OFFICE_CONTACTS.map((c) => ({
    display: c.display,
    tel: c.tel,
    label: c.label,
  })),
  primaryTel: officePrimary.tel,
  primaryDisplay: officePrimary.display,
  /** Floating WhatsApp — Technical (Sonu) WhatsApp-only line */
  whatsappTel: "917876686572",
};
