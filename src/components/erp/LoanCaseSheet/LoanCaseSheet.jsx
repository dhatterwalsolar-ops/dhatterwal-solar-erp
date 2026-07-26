import CaseSheetTable from "../CaseSheetTable/CaseSheetTable";
import {
  LOAN_CASE_COLUMNS,
  LOAN_CASE_SAMPLE_ROWS,
  createEmptyLoanRow,
} from "../../../constants/loanCase";

function LoanCaseSheet() {
  return (
    <CaseSheetTable
      title="Loan Case"
      description="Enter Consumer No. manually (main ID). Upload customer KYC/documents here — they appear in the Sale Sheet customer folder. Select setup kW and generate loan documents."
      documentUploadSource="loan"
      columns={LOAN_CASE_COLUMNS}
      initialRows={LOAN_CASE_SAMPLE_ROWS}
      createEmptyRow={createEmptyLoanRow}
      actions={[
        { key: "vendor", label: "Generate Vendor Agreement", tone: "green" },
        { key: "quotation", label: "Generate Loan Quotation", tone: "gold" },
      ]}
      documentLabels={{
        vendor: "Vendor Agreement",
        quotation: "Loan Quotation",
      }}
    />
  );
}

export default LoanCaseSheet;
