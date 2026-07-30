import fs from "node:fs";
import path from "node:path";

const root = path.resolve("src/utils");
const files = [
  "loanQuotationFormatStorage.js",
  "invoiceStorage.js",
  "invoiceFormatStorage.js",
  "productStorage.js",
  "customerDetailStorage.js",
  "saleCaseStorage.js",
  "labourDailyWhatsApp.js",
  "siteOrderUrl.js",
  "siteOrderWhatsApp.js",
  "siteOrderStorage.js",
  "labourEmployeeStorage.js",
  "stockStorage.js",
  "updateNameLoadStorage.js",
  "cashCaseStorage.js",
  "loanCaseStorage.js",
  "purchaseHistoryStorage.js",
  "purchaseStorage.js",
  "backupEntryStorage.js",
  "labourPaymentStorage.js",
  "paymentManagementStorage.js",
  "creditFacilityStorage.js",
  "paymentAccountStorage.js",
  "customerPaymentLedger.js",
  "settingsStorage.js",
  "supplierStorage.js",
  "bomSheetStorage.js",
  "labourEntryStorage.js",
  "customerDocuments.js",
];

const importLine = 'import { erpGetItem, erpRemoveItem, erpSetItem } from "./erpStorage";';

for (const name of files) {
  const file = path.join(root, name);
  let text = fs.readFileSync(file, "utf8");
  if (!text.includes("./erpStorage")) {
    const lines = text.split(/\r?\n/);
    let lastImport = -1;
    for (let i = 0; i < lines.length; i += 1) {
      if (/^import\s/.test(lines[i])) lastImport = i;
    }
    if (lastImport >= 0) {
      lines.splice(lastImport + 1, 0, importLine);
    } else {
      lines.unshift(importLine);
    }
    text = lines.join("\n");
  }
  text = text
    .replaceAll("localStorage.getItem", "erpGetItem")
    .replaceAll("localStorage.setItem", "erpSetItem")
    .replaceAll("localStorage.removeItem", "erpRemoveItem");
  fs.writeFileSync(file, text);
  console.log("ok", name);
}
