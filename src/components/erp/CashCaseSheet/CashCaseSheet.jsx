import CaseSheetTable from "../CaseSheetTable/CaseSheetTable";
import {
  CASH_CASE_COLUMNS,
  createEmptyCashRow,
} from "../../../constants/cashCase";
import { loadCashCaseRows, saveCashCaseRows } from "../../../utils/cashCaseStorage";

function CashCaseSheet() {
  return (
    <CaseSheetTable
      title="Cash Case"
      description="Reference Loan/Cash me common hai. Consumer No. Loan jaisa manual. Backup Entry Loan/Sale/Customer Detail me sync rehti hai."
      documentUploadSource="cash"
      columns={CASH_CASE_COLUMNS}
      initialRows={[]}
      loadRows={loadCashCaseRows}
      onRowsPersist={saveCashCaseRows}
      createEmptyRow={createEmptyCashRow}
      enableBackupEntries
      backupSheetKind="cash"
      actions={[
        { key: "vendor", label: "Generate Vendor Agreement", tone: "green" },
        { key: "generateFiles", label: "Generate Files", tone: "gold" },
      ]}
      documentLabels={{
        vendor: "Vendor Agreement",
        generateFiles: "Generate Files",
      }}
    />
  );
}

export default CashCaseSheet;
