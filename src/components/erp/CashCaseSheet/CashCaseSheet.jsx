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
      description="Enter Consumer No. manually (same main ID as Loan Case). Upload customer documents for the Sale Sheet folder. Backup Entry sab sheets (Loan, Sale, Customer Detail) me sync rehti hai."
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
      ]}
      documentLabels={{
        vendor: "Vendor Agreement",
      }}
      rowEditLock
      deleteRequiresOtp
    />
  );
}

export default CashCaseSheet;
