import DataSheet from "../../components/erp/DataSheet/DataSheet";

const SETTINGS_ROWS = [
  ["Company Name", "Dhatterwal Solar Energy System", "General"],
  ["Branch MD", "Azad Dhakal", "General"],
  ["Primary Phone", "+91 99928 91023", "Contact"],
  ["Backup Phone", "+91 99928 91723", "Contact"],
  ["Additional Phone", "+91 94675 64675", "Contact"],
  ["GST Number", "06XXXXX1234X1Z5", "Tax"],
  ["Financial Year Start", "01 April", "Accounts"],
];

function SettingsPage() {
  return (
    <DataSheet
      title="Settings"
      columns={["Setting", "Value", "Group"]}
      rows={SETTINGS_ROWS}
    />
  );
}

export default SettingsPage;
