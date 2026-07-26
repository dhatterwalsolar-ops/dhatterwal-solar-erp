import { useMemo, useState } from "react";
import { customerFolderPath, downloadStoredDocument } from "../../../utils/customerDocuments";
import {
  formatDocumentMeta,
  getDocumentPreviewKind,
  groupCustomerFolderDocuments,
  openDocumentPreview,
} from "../../../utils/customerFolderView";
import styles from "./CustomerFolderModal.module.css";

function DocumentPreviewPane({ doc }) {
  if (!doc) {
    return (
      <div className={styles.previewEmpty}>
        <p>Select a document to see preview and details before download.</p>
      </div>
    );
  }

  const meta = formatDocumentMeta(doc);
  const kind = getDocumentPreviewKind(doc);

  return (
    <div className={styles.previewPane}>
      <div className={styles.previewMeta}>
        <span className={styles.typeBadge}>{meta.typeLabel}</span>
        <span className={styles.kindBadge}>{meta.kindLabel}</span>
      </div>
      <h3 className={styles.previewTitle}>{meta.fileName}</h3>
      <dl className={styles.metaList}>
        <div>
          <dt>Source</dt>
          <dd>{meta.sourceLabel}</dd>
        </div>
        <div>
          <dt>Uploaded</dt>
          <dd>{meta.uploadedLabel}</dd>
        </div>
        <div>
          <dt>Folder path</dt>
          <dd>{meta.folderLabel}</dd>
        </div>
      </dl>
      <div className={styles.previewFrame}>
        {kind === "image" && (
          <img src={doc.dataUrl} alt={meta.fileName} className={styles.previewImage} />
        )}
        {kind === "html" && (
          <iframe
            title={meta.fileName}
            src={doc.dataUrl}
            className={styles.previewIframe}
            sandbox="allow-same-origin"
          />
        )}
        {kind === "pdf" && (
          <iframe title={meta.fileName} src={doc.dataUrl} className={styles.previewIframe} />
        )}
        {kind === "file" && (
          <div className={styles.previewFilePlaceholder}>
            <p>Preview not available for this file type.</p>
            <p className={styles.previewFileHint}>Use View or Download to open the file.</p>
          </div>
        )}
      </div>
      <div className={styles.previewActions}>
        <button type="button" className={styles.btnOutline} onClick={() => openDocumentPreview(doc)}>
          View full
        </button>
        <button type="button" className={styles.btnPrimary} onClick={() => downloadStoredDocument(doc)}>
          Download
        </button>
      </div>
    </div>
  );
}

function CustomerFolderModal({ consumerNo, customerName, documents, onClose }) {
  const sections = useMemo(() => groupCustomerFolderDocuments(documents), [documents]);
  const [selectedId, setSelectedId] = useState(null);

  const selectedDoc = useMemo(() => {
    if (!selectedId) return null;
    return documents.find((d) => d.id === selectedId) ?? null;
  }, [documents, selectedId]);

  return (
    <div className={styles.modalBackdrop} role="presentation" onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-folder-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <h2 id="customer-folder-title">Customer document folder</h2>
            <p className={styles.subtitle}>
              <strong>{consumerNo}</strong>
              {customerName ? ` — ${customerName}` : ""}
            </p>
            <p className={styles.path}>{customerFolderPath(consumerNo)}</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        {documents.length === 0 ? (
          <p className={styles.empty}>No documents yet. Upload from Loan Case or Cash Case.</p>
        ) : (
          <div className={styles.layout}>
            <div className={styles.sections}>
              {sections.map((section) => (
                <section key={section.id} className={styles.section}>
                  <h3 className={styles.sectionTitle}>{section.title}</h3>
                  <p className={styles.sectionHint}>{section.hint}</p>
                  <ul className={styles.docList}>
                    {section.items.map((doc) => {
                      const meta = formatDocumentMeta(doc);
                      const isActive = doc.id === selectedId;
                      return (
                        <li key={doc.id}>
                          <button
                            type="button"
                            className={isActive ? `${styles.docRow} ${styles.docRowActive}` : styles.docRow}
                            onClick={() => setSelectedId(doc.id)}
                          >
                            <span className={styles.docRowTitle}>{meta.typeLabel}</span>
                            <span className={styles.docRowFile}>{meta.fileName}</span>
                            <span className={styles.docRowMeta}>
                              {meta.kindLabel} · {meta.uploadedLabel}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
            <DocumentPreviewPane doc={selectedDoc} />
          </div>
        )}

        <footer className={styles.footer}>
          <button type="button" className={styles.btnCancel} onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}

export default CustomerFolderModal;
