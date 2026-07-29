const CATEGORY_LABELS = {
  "customer-document": "Customer document (KYC / ID / agreement)",
  "safety-certificate": "Work OS Safety Certificate",
  annexure: "Annexure — Panel & Inverter details",
  "joint-report": "Joint Report",
  "complete-package": "Complete file manifest (index)",
  "sale-invoice": "Sale Invoice",
  "eway-bill": "E-Way Bill",
};

const SOURCE_LABELS = {
  loan: "Loan Case",
  cash: "Cash Case",
  sale: "Sale Sheet",
};

const CATEGORY_ORDER = [
  "sale-invoice",
  "eway-bill",
  "complete-package",
  "safety-certificate",
  "annexure",
  "joint-report",
  "customer-document",
];

function subfolderFromFolder(folder) {
  const parts = String(folder || "").split("/");
  return parts[parts.length - 1] || "uploads";
}

function formatUploadedAt(iso) {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatPackageTitle(subfolder) {
  const match = subfolder.match(/^CompleteFile-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})$/);
  if (!match) return subfolder;
  const [, y, mo, d, h, mi] = match;
  return `${d}/${mo}/${y} at ${h}:${mi}`;
}

export function getDocumentTypeLabel(doc) {
  if (doc?.category && CATEGORY_LABELS[doc.category]) {
    return CATEGORY_LABELS[doc.category];
  }
  const source = SOURCE_LABELS[doc?.source] || doc?.source || "Document";
  return `${source} file`;
}

export function getDocumentPreviewKind(doc) {
  const mime = String(doc?.mimeType || "").toLowerCase();
  const name = String(doc?.fileName || "").toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() : "";

  if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
    return "image";
  }
  if (mime.includes("html") || ext === "html" || ext === "htm") {
    return "html";
  }
  if (mime.includes("pdf") || ext === "pdf") {
    return "pdf";
  }
  return "file";
}

export function formatDocumentMeta(doc) {
  const kind = getDocumentPreviewKind(doc);
  const kindLabel =
    kind === "image"
      ? "Image"
      : kind === "pdf"
        ? "PDF"
        : kind === "html"
          ? "HTML report"
          : "File";
  return {
    typeLabel: getDocumentTypeLabel(doc),
    sourceLabel: SOURCE_LABELS[doc.source] || doc.source,
    uploadedLabel: formatUploadedAt(doc.uploadedAt),
    fileName: doc.fileName || "Unnamed file",
    folderLabel: doc.folder?.replace(/^CustomerDocuments\//, "") || "—",
    kindLabel,
    previewKind: kind,
  };
}

export function groupCustomerFolderDocuments(documents) {
  const docs = [...documents];
  const loanUploads = docs.filter(
    (d) => d.source === "loan" && subfolderFromFolder(d.folder) === "uploads",
  );
  const cashUploads = docs.filter(
    (d) => d.source === "cash" && subfolderFromFolder(d.folder) === "uploads",
  );

  const packageIds = [
    ...new Set(
      docs
        .filter((d) => subfolderFromFolder(d.folder).startsWith("CompleteFile-"))
        .map((d) => subfolderFromFolder(d.folder)),
    ),
  ].sort((a, b) => b.localeCompare(a));

  const sections = [];

  if (loanUploads.length) {
    sections.push({
      id: "loan-uploads",
      title: "Loan Case — uploaded documents",
      hint: "Documents uploaded from Loan Case sheet",
      items: sortDocs(loanUploads),
    });
  }

  if (cashUploads.length) {
    sections.push({
      id: "cash-uploads",
      title: "Cash Case — uploaded documents",
      hint: "Documents uploaded from Cash Case sheet",
      items: sortDocs(cashUploads),
    });
  }

  for (const pkg of packageIds) {
    const items = docs.filter((d) => subfolderFromFolder(d.folder) === pkg);
    sections.push({
      id: pkg,
      title: `Complete file package — ${formatPackageTitle(pkg)}`,
      hint: "Generated from Sale Sheet (safety certificate, annexure, joint report, manifest)",
      items: sortDocs(items),
    });
  }

  const invoiceDocs = docs.filter(
    (d) =>
      d.category === "sale-invoice" ||
      d.category === "eway-bill" ||
      String(d.folder || "").includes("/Invoices/"),
  );
  if (invoiceDocs.length) {
    sections.push({
      id: "sale-invoices",
      title: "Sale invoices & E-Way bills",
      hint: "Generated from Sale Sheet — invoice + e-way bill saved under Invoices folder",
      items: sortDocs(invoiceDocs),
    });
  }

  const usedIds = new Set(sections.flatMap((s) => s.items.map((d) => d.id)));
  const other = docs.filter((d) => !usedIds.has(d.id));
  if (other.length) {
    sections.push({
      id: "other",
      title: "Other documents",
      hint: "Additional files in customer folder",
      items: sortDocs(other),
    });
  }

  return sections;
}

function sortDocs(items) {
  return [...items].sort((a, b) => {
    const orderA = CATEGORY_ORDER.indexOf(a.category);
    const orderB = CATEGORY_ORDER.indexOf(b.category);
    const rankA = orderA === -1 ? 99 : orderA;
    const rankB = orderB === -1 ? 99 : orderB;
    if (rankA !== rankB) return rankA - rankB;
    return new Date(b.uploadedAt) - new Date(a.uploadedAt);
  });
}

export function openDocumentPreview(doc) {
  if (!doc?.dataUrl) return;
  const kind = getDocumentPreviewKind(doc);
  if (kind === "html" || kind === "pdf" || kind === "image") {
    window.open(doc.dataUrl, "_blank", "noopener,noreferrer");
    return;
  }
  downloadStoredDocumentFallback(doc);
}

function downloadStoredDocumentFallback(doc) {
  const link = document.createElement("a");
  link.href = doc.dataUrl;
  link.download = doc.fileName || "document";
  link.click();
}
