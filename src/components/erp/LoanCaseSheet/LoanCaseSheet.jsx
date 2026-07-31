import CaseSheetTable from "../CaseSheetTable/CaseSheetTable";
import {
  LOAN_CASE_COLUMNS,
  createEmptyLoanRow,
} from "../../../constants/loanCase";
import { loadLoanCaseRows, saveLoanCaseRows } from "../../../utils/loanCaseStorage";
import { syncLoanDisbursementFromLoanRow } from "../../../utils/loanDisbursementSync";

function LoanCaseSheet() {
  return (
    <CaseSheetTable
      title="Loan Case"
      description="Reference Loan/Cash dono me common hai — ek sheet me change karo to dusri me bhi sync. Bank IFSC ke baad Amount/Credit Date/Margin sync Customer All Detail me jata hai."
      documentUploadSource="loan"
      columns={LOAN_CASE_COLUMNS}
      initialRows={[]}
      loadRows={loadLoanCaseRows}
      onRowsPersist={saveLoanCaseRows}
      createEmptyRow={createEmptyLoanRow}
      enableBackupEntries
      backupSheetKind="loan"
      onRowPaymentSync={syncLoanDisbursementFromLoanRow}
      actions={[
        { key: "quotation", label: "Generate Quotation", tone: "green" },
        { key: "vendor", label: "Generate Vendor Agreement", tone: "green" },
        { key: "generateFiles", label: "Generate Files", tone: "gold" },
      ]}
      documentLabels={{
        quotation: "Loan Quotation",
        vendor: "Vendor Agreement",
        generateFiles: "Generate Files",
      }}
    />
  );
}

export default LoanCaseSheet;
