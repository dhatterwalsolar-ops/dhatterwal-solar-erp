/** Default Tax Invoice stationery — editable from Settings → Invoice Format. */

export const DEFAULT_INVOICE_FORMAT = {
  title: "TAX INVOICE",
  copyLabel: "Original Copy",
  legalName: "DHATTERWAL SOLAR ENERGY SYSTEM",
  address: "WARD NO 13, DHATTERWAL BHAWAN, KALAYAT",
  phones: "9992891023, 9992891723",
  gstin: "06JKPPK6453K1ZE",
  telEmailLine: "Tel.:9992891723-email:dhatterwalsolar@gmail.com",
  email: "dhatterwalsolar@gmail.com",
  placeOfSupply: "Haryana(06)",
  reverseCharge: "N",
  transportDefault: "SELF",
  signatoryFor: "For DHATTERWAL SOLAR ENERGY SYSTEM",
  authorisedLabel: "Authorised Signatory",
  receiverLabel: "Receiver's Signature :",
  paymentHeading: "Payment Instructions : Our Bank Details",
  termsHeading: "Terms & Conditions",
  logoDataUrl: "",
  /** Digital signature image under Authorised Signatory */
  signDataUrl: "",
  solarItemTitle: "SOLAR POWER GENERATING SYSTEM",
  installItemTitle: "SOLAR INSTALATION",
  solarHsn: "85414011",
  installHsn: "7308",
  /** Solar system share of taxable (rest = installation) */
  solarSharePercent: 70,
  solarGstPercent: 5,
  installGstPercent: 18,
  unitLabel: "SETUP",
  banks: [
    {
      name: "CANARA BANK",
      accountNo: "120036074931",
      ifsc: "CNRB0016680",
      branch: "KAITHAL",
    },
    {
      name: "HDFC BANK",
      accountNo: "50200098234561",
      ifsc: "HDFC0001234",
      branch: "KAITHAL",
    },
  ],
  terms: [
    "E. & O.E.",
    "1. Goods once sold will not be taken back.",
    "2. Interest @ 18% p.a. will be charged if the payment is not made within the stipulated time.",
    "3. Subject to 'Kaithal' Jurisdiction only.",
  ],
};

/** @deprecated use DEFAULT_INVOICE_FORMAT / getInvoiceFormat() */
export const INVOICE_COMPANY = {
  title: DEFAULT_INVOICE_FORMAT.title,
  legalName: DEFAULT_INVOICE_FORMAT.legalName,
  address: DEFAULT_INVOICE_FORMAT.address,
  phones: DEFAULT_INVOICE_FORMAT.phones,
  gstin: DEFAULT_INVOICE_FORMAT.gstin,
  email: DEFAULT_INVOICE_FORMAT.email,
  placeOfSupply: DEFAULT_INVOICE_FORMAT.placeOfSupply,
  reverseCharge: DEFAULT_INVOICE_FORMAT.reverseCharge,
  transportDefault: DEFAULT_INVOICE_FORMAT.transportDefault,
  signatoryFor: DEFAULT_INVOICE_FORMAT.signatoryFor,
  jurisdiction: "Kaithal",
};

export const INVOICE_BANKS = DEFAULT_INVOICE_FORMAT.banks;
export const INVOICE_TERMS = DEFAULT_INVOICE_FORMAT.terms;
export const INVOICE_HSN = {
  solarSystem: DEFAULT_INVOICE_FORMAT.solarHsn,
  installation: DEFAULT_INVOICE_FORMAT.installHsn,
};
export const INVOICE_TAX_SPLIT = {
  solarShare: DEFAULT_INVOICE_FORMAT.solarSharePercent / 100,
  installShare: 1 - DEFAULT_INVOICE_FORMAT.solarSharePercent / 100,
  solarRate: DEFAULT_INVOICE_FORMAT.solarGstPercent / 100,
  installRate: DEFAULT_INVOICE_FORMAT.installGstPercent / 100,
};

/** Default Loan Quotation stationery — Settings → Loan Quotation Format. */
export const DEFAULT_LOAN_QUOTATION_FORMAT = {
  ...DEFAULT_INVOICE_FORMAT,
  title: "Sales Quotation",
  copyLabel: "Original Copy",
  billedToLabel: "Party Details:",
  solarItemTitle: "SOLAR POWER GENERATING SYSTEM",
  installItemTitle: "SOLAR INSTALATION",
  /** Quotation item-1 sub lines: "{setupKw} DCR PANNEL" / "{setupKw} ONGRID INVERTER" */
  panelDetailLabel: "DCR PANNEL",
  inverterDetailLabel: "ONGRID INVERTER",
  /** Quotation item-2 fixed detail rows (same as stationery sample) */
  installDetailLines: [
    "AC-DB AND DC-DB BOX",
    "EARTHING AND LA, STRUTURE, WIRING, ETC COMPLETE SETUP",
  ],
  paymentHeading: "Payment Instructions : Our Bank Details",
  termsHeading: "Terms & Conditions",
  address:
    "Dhatterwal Bhawan, Ward No 13, KALAYAT, BEHIND MAIDA MILL, RAILWAY ROAD, Surja Nagar, Kalayat, Kaithal, Haryana, 136117",
  telEmailLine: "Tel:- 9992891723 email: dhatterwalsolar@gmail.com",
  banks: [
    {
      name: "CANARA BANK",
      accountNo: "120033553157",
      ifsc: "CNRB0007411",
      branch: "RAILWAY ROAD, KALAYAT, DISTT KAITHAL",
    },
    {
      name: "HDFC BANK",
      accountNo: "50200104863419",
      ifsc: "HDFC0001723",
      branch: "ANAJ MANDI, KALAYAT, DISTT KAITHAL",
    },
  ],
  terms: [
    "E. & O.E.",
    "1. Goods once sold will not be taken back.",
    "2. Interest @ 18% p.a. will be charged if the payment is not made within the stipulated time.",
    "3. Subject to 'Kaithal' Jurisdiction only.",
  ],
};
