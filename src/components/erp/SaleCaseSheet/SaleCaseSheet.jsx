import { useMemo, useRef, useState } from "react";
import { formatSetupDetail, lookupBom } from "../../../constants/bomRegistry";
import { lookupCustomer } from "../../../constants/customerRegistry";
import {
  SALE_CASE_SAMPLE_ROWS,
  createEmptySaleRow,
} from "../../../constants/saleCase";
import { generateCompleteFilePackage } from "../../../utils/completeFileGenerator";
import {
  customerFolderPath,
  listCustomerDocuments,
  readFileAsDataUrl,
} from "../../../utils/customerDocuments";
import CustomerFolderModal from "./CustomerFolderModal";
import {
  createSaleInvoice,
  saveGstInvoice,
} from "../../../utils/invoiceStorage";
import styles from "./SaleCaseSheet.module.css";

function SaleCaseSheet() {
  const [rows, setRows] = useState(() =>
    SALE_CASE_SAMPLE_ROWS.map((row) => ({
      ...row,
      setupDetail: row.setupDetail || formatSetupDetail(lookupBom(row.consumerNo)),
    })),
  );
  const [query, setQuery] = useState("");
  const [invoiceRow, setInvoiceRow] = useState(null);
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [completeRow, setCompleteRow] = useState(null);
  const [jointReport, setJointReport] = useState(null);
  const [folderRow, setFolderRow] = useState(null);
  const [docRefresh, setDocRefresh] = useState(0);
  const jointInputRef = useRef(null);

  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((row) =>
      Object.values(row).some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [query, rows]);

  const updateCell = (rowRef, key, value) => {
    setRows((prev) =>
      prev.map((row) => (row === rowRef ? { ...row, [key]: value } : row)),
    );
  };

  const syncConsumerData = (rowRef, consumerNo) => {
    const customer = lookupCustomer(consumerNo);
    const bom = lookupBom(consumerNo);

    setRows((prev) =>
      prev.map((row) => {
        if (row !== rowRef) return row;
        if (!customer) {
          return {
            ...row,
            consumerNo,
            customerName: "",
            fatherName: "",
            address: "",
            setupKw: "",
            setupDetail: "Consumer No. not found in Loan/Cash records.",
          };
        }
        return {
          ...row,
          consumerNo: customer.consumerNo,
          customerName: customer.customerName,
          fatherName: customer.fatherName,
          address: customer.address,
          setupKw: customer.setupKw,
          setupDetail: formatSetupDetail(bom),
        };
      }),
    );
  };

  const requireConsumerRow = (row) => {
    if (!row.consumerNo?.trim()) {
      window.alert("Enter Consumer No. first.");
      return false;
    }
    if (!row.customerName) {
      window.alert("Consumer details not loaded. Re-enter Consumer No.");
      return false;
    }
    return true;
  };

  const openInvoiceModal = (row) => {
    if (!requireConsumerRow(row)) return;
    setInvoiceRow(row);
    setInvoiceAmount(row.amount || "");
  };

  const openCompleteModal = (row) => {
    if (!requireConsumerRow(row)) return;
    setCompleteRow(row);
    setJointReport(null);
  };

  const openFolderModal = (row) => {
    if (!row.consumerNo?.trim()) {
      window.alert("Enter Consumer No. to open customer document folder.");
      return;
    }
    setFolderRow(row);
    setDocRefresh((n) => n + 1);
  };

  const generateInvoice = (withGst) => {
    if (!invoiceRow) return;
    const invoice = createSaleInvoice({
      consumerNo: invoiceRow.consumerNo,
      customerName: invoiceRow.customerName,
      setupKw: invoiceRow.setupKw,
      date: invoiceRow.date || new Date().toLocaleDateString("en-GB"),
      amount: invoiceAmount,
      withGst,
    });

    if (withGst) {
      saveGstInvoice(invoice);
    }

    setRows((prev) =>
      prev.map((row) =>
        row === invoiceRow ? { ...row, amount: invoiceAmount } : row,
      ),
    );

    window.alert(
      `Invoice ${invoice.id} generated (${invoice.gstType}). Total: ₹${invoice.totalAmount.toLocaleString("en-IN")}${
        withGst ? " — added to GST Report for this month." : "."
      }`,
    );
    setInvoiceRow(null);
    setInvoiceAmount("");
  };

  const onJointReportPick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setJointReport({ fileName: file.name, dataUrl });
  };

  const runCompleteFile = async () => {
    if (!completeRow) return;
    const bom = lookupBom(completeRow.consumerNo);
    try {
      const { packageFolder, included } = await generateCompleteFilePackage({
        customer: {
          consumerNo: completeRow.consumerNo,
          customerName: completeRow.customerName,
          fatherName: completeRow.fatherName,
          address: completeRow.address,
        },
        bom,
        setupKw: completeRow.setupKw,
        date: completeRow.date || new Date().toLocaleDateString("en-GB"),
        jointReportDataUrl: jointReport?.dataUrl,
        jointReportFileName: jointReport?.fileName,
      });
      setDocRefresh((n) => n + 1);
      window.alert(
        `Complete file package created (${included.length} items).\nSaved under:\n${packageFolder}\n\nManifest downloaded to your PC.`,
      );
      setCompleteRow(null);
      setJointReport(null);
    } catch (err) {
      window.alert(err.message || "Could not generate complete file.");
    }
  };

  const folderDocs = useMemo(() => {
    void docRefresh;
    if (!folderRow?.consumerNo) return [];
    return listCustomerDocuments(folderRow.consumerNo);
  }, [folderRow, docRefresh]);

  const docCountForRow = (row) => {
    void docRefresh;
    if (!row.consumerNo?.trim()) return 0;
    return listCustomerDocuments(row.consumerNo).length;
  };

  return (
    <section className={styles.sheet}>
      <header className={styles.toolbar}>
        <div>
          <h1>Sale Sheet</h1>
          <p>
            Consumer No. auto-fills from Loan/Cash. Setup Detail from BOM. Column 8:
            Generate Invoice. Column 9: Generate Complete File (safety certificate,
            BOM annexure, Loan/Cash uploads, optional joint report) — all saved in
            the customer document folder.
          </p>
        </div>
        <div className={styles.toolbarActions}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sale rows..."
            className={styles.search}
          />
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setRows((prev) => [...prev, createEmptySaleRow()])}
          >
            + Add Row
          </button>
        </div>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Sr. No.</th>
              <th>Date</th>
              <th>Consumer No.</th>
              <th>Consumer Name</th>
              <th>Consumer Father Name</th>
              <th>Address</th>
              <th>Setup</th>
              <th>Setup Detail (from BOM)</th>
              <th>8. Generate Invoice</th>
              <th>9. Generate Complete File</th>
              <th>Customer Folder</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr key={`${row.consumerNo || "sale"}-${rows.indexOf(row)}`}>
                <td>{rows.indexOf(row) + 1}</td>
                <td>
                  <input
                    className={styles.cellInput}
                    value={row.date}
                    onChange={(e) => updateCell(row, "date", e.target.value)}
                    placeholder="DD/MM/YYYY"
                  />
                </td>
                <td>
                  <input
                    className={`${styles.cellInput} ${styles.manualIdInput}`}
                    value={row.consumerNo}
                    onChange={(e) => updateCell(row, "consumerNo", e.target.value)}
                    onBlur={(e) => syncConsumerData(row, e.target.value)}
                    placeholder="Enter Consumer No."
                  />
                </td>
                <td>
                  <input className={styles.readOnly} value={row.customerName} readOnly />
                </td>
                <td>
                  <input className={styles.readOnly} value={row.fatherName} readOnly />
                </td>
                <td>
                  <input className={styles.readOnly} value={row.address} readOnly />
                </td>
                <td>
                  <input className={styles.readOnly} value={row.setupKw} readOnly />
                </td>
                <td>
                  <textarea
                    className={styles.setupDetail}
                    value={row.setupDetail}
                    readOnly
                    rows={4}
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => openInvoiceModal(row)}
                  >
                    Generate Invoice
                  </button>
                </td>
                <td>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.actionBtnGold}`}
                    onClick={() => openCompleteModal(row)}
                  >
                    Generate Complete File
                  </button>
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.folderBtn}
                    onClick={() => openFolderModal(row)}
                  >
                    Open ({docCountForRow(row)})
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invoiceRow && (
        <div className={styles.modalBackdrop} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true">
            <h2>Generate Invoice</h2>
            <p>
              Consumer: <strong>{invoiceRow.consumerNo}</strong> —{" "}
              {invoiceRow.customerName}
            </p>
            <label className={styles.modalLabel}>
              Taxable Amount (₹)
              <input
                type="number"
                value={invoiceAmount}
                onChange={(e) => setInvoiceAmount(e.target.value)}
                min="0"
              />
            </label>
            <p className={styles.modalHint}>Choose invoice type:</p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnGold} onClick={() => generateInvoice(true)}>
                With GST (18%)
              </button>
              <button type="button" className={styles.btnOutline} onClick={() => generateInvoice(false)}>
                Without GST
              </button>
              <button type="button" className={styles.btnCancel} onClick={() => setInvoiceRow(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {completeRow && (
        <div className={styles.modalBackdrop} role="presentation">
          <div className={`${styles.modal} ${styles.modalWide}`} role="dialog" aria-modal="true">
            <h2>Generate Complete File</h2>
            <p>
              <strong>{completeRow.consumerNo}</strong> — {completeRow.customerName} (
              {completeRow.setupKw})
            </p>
            <ul className={styles.checklist}>
              <li>Work OS Safety Certificate (proforma — auto by setup + BOM)</li>
              <li>Annexure: panel, inverter, wire, stand (from BOM / labour form)</li>
              <li>All documents uploaded in Loan Case &amp; Cash Case for this consumer</li>
              <li>Joint Report (optional — upload below)</li>
            </ul>
            <input
              ref={jointInputRef}
              type="file"
              className={styles.hiddenFile}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={onJointReportPick}
            />
            <div className={styles.jointRow}>
              <button
                type="button"
                className={styles.btnOutline}
                onClick={() => jointInputRef.current?.click()}
              >
                Upload Joint Report
              </button>
              <span className={styles.jointName}>
                {jointReport ? jointReport.fileName : "No joint report selected"}
              </span>
            </div>
            <p className={styles.modalHintSmall}>
              Files save under: {customerFolderPath(completeRow.consumerNo)}/CompleteFile-…
            </p>
            <div className={styles.modalActions}>
              <button type="button" className={styles.btnGold} onClick={runCompleteFile}>
                Generate &amp; Save to Folder
              </button>
              <button
                type="button"
                className={styles.btnCancel}
                onClick={() => {
                  setCompleteRow(null);
                  setJointReport(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {folderRow && (
        <CustomerFolderModal
          consumerNo={folderRow.consumerNo}
          customerName={folderRow.customerName}
          documents={folderDocs}
          onClose={() => setFolderRow(null)}
        />
      )}
    </section>
  );
}

export default SaleCaseSheet;
