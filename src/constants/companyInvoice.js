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
  signatoryFor: "for Dhatterwal Solar Energy System",
  authorisedLabel: "Authorised Signatory",
  receiverLabel: "Receiver's Signature :",
  paymentHeading: "Payment Instructions : Our Bank Details",
  termsHeading: "Terms & Conditions",
  logoDataUrl: "",
  solarItemTitle: "SOLAR POWER GENERATING SYSTEM",
  installItemTitle: "SOLAR INSTALATION ({setupKw} SETUP)",
  solarHsn: "85414011",
  installHsn: "7308",
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
