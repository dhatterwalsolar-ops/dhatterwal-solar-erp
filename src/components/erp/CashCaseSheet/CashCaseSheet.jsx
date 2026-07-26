import CaseSheetTable from "../CaseSheetTable/CaseSheetTable";
import {
  CASH_CASE_COLUMNS,
  CASH_CASE_SAMPLE_ROWS,
  createEmptyCashRow,
} from "../../../constants/cashCase";

function CashCaseSheet() {
  return (
    <CaseSheetTable
      title="Cash Case"
      description="Enter Consumer No. manually (same main ID as Loan Case). Upload customer documents for the Sale Sheet folder. Select setup kW and generate vendor agreement or quotation."
      documentUploadSource="cash"
      columns={CASH_CASE_COLUMNS}
      initialRows={CASH_CASE_SAMPLE_ROWS}
      createEmptyRow={createEmptyCashRow}
      actions={[
        { key: "vendor", label: "Generate Vendor Agreement", tone: "green" },
        { key: "quotation", label: "Generate Quotation", tone: "gold" },
      ]}
      documentLabels={{
        vendor: "Vendor Agreement",
        quotation: "Quotation",
      }}
    />
  );
}

export default CashCaseSheet;
