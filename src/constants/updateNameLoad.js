export const UPDATE_NAME_LOAD_SUBJECTS = ["Name Change", "Load Update"];

export function calcTotalFees(fees, affidavitFee) {
  const a = Number(fees) || 0;
  const b = Number(affidavitFee) || 0;
  return Math.round((a + b) * 100) / 100;
}

export function createEmptyUpdateNameLoadRow() {
  return {
    id: `unl-${Date.now()}`,
    date: new Date().toLocaleDateString("en-GB"),
    consumerNo: "",
    customerName: "",
    fatherName: "",
    address: "",
    mobile: "",
    subject: "",
    applicationNo: "",
    fees: "",
    affidavitFee: "",
    /** Payment Sheet account — fees/affidavit yahan se debit */
    paymentAccount: "",
    reference: "",
    newLoadKw: "",
  };
}
