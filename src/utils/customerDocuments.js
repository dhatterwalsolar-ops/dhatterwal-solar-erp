const STORAGE_KEY = "dhatterwal_customer_documents";
const MAX_FILE_BYTES = 4 * 1024 * 1024;

function normalizeConsumerNo(consumerNo) {
  return String(consumerNo || "").trim().toUpperCase();
}

function readAll() {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry === "object");
  } catch {
    return [];
  }
}

function writeAll(items) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* quota or private mode — ignore */
  }
}

export function customerFolderPath(consumerNo) {
  return `CustomerDocuments/${normalizeConsumerNo(consumerNo)}`;
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function addCustomerDocument({
  consumerNo,
  source,
  category,
  fileName,
  mimeType,
  dataUrl,
  subfolder = "uploads",
}) {
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `doc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const cn = normalizeConsumerNo(consumerNo);
  const basePath = customerFolderPath(cn);
  const folder = `${basePath}/${subfolder}`;

  const approxBytes = Math.ceil((String(dataUrl).length * 3) / 4);
  if (approxBytes > MAX_FILE_BYTES) {
    throw new Error(
      `File too large (max ${MAX_FILE_BYTES / (1024 * 1024)} MB per file in browser storage).`,
    );
  }

  const entry = {
    id,
    consumerNo: cn,
    folder,
    source,
    category,
    fileName,
    mimeType,
    dataUrl,
    uploadedAt: new Date().toISOString(),
  };

  const items = readAll();
  items.push(entry);
  writeAll(items);
  return entry;
}

export function listDocumentsBySource(source) {
  if (!source) return [];
  return readAll().filter((d) => d.source === source);
}

export function listCustomerDocuments(consumerNo, { source, subfolder } = {}) {
  const cn = normalizeConsumerNo(consumerNo);
  if (!cn) return [];
  let items = readAll().filter((d) => d.consumerNo === cn);
  if (source) {
    items = items.filter((d) => d.source === source);
  }
  if (subfolder) {
    const suffix = `/${subfolder}`;
    items = items.filter((d) => d.folder.endsWith(suffix) || d.folder.includes(`${suffix}/`));
  }
  return items.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
}

export function countCustomerDocuments(consumerNo, source) {
  return listCustomerDocuments(consumerNo, source ? { source } : {}).length;
}

export function downloadStoredDocument(doc) {
  const link = document.createElement("a");
  link.href = doc.dataUrl;
  link.download = doc.fileName;
  link.click();
}

export function removeCustomerDocument(id) {
  writeAll(readAll().filter((d) => d.id !== id));
}

export { normalizeConsumerNo };
