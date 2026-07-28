import { formatSetupDetail } from "../constants/bomRegistry";
import { lookupCustomer } from "../constants/customerRegistry";
import { getSaleTeamLeaderConfig } from "../constants/saleTeamMapping";
import { getBomMaterialsForConsumer } from "./bomSheetStorage";
import { findSaleRowByConsumerNo } from "./saleCaseLookup";
import { getSiteOrderForConsumer } from "./siteOrderStorage";

/** Sale Sheet + Loan/Cash se daily labour form fields bharte hain. */
export function buildDailyLabourFieldsFromConsumer(consumerNo) {
  const trimmed = String(consumerNo || "").trim();
  if (!trimmed) {
    return {
      consumerNo: "",
      customerName: "",
      siteAddress: "",
      setupKw: "",
      setupDetail: "",
      teamWork: "",
      teamLeader: "",
      workDetails: "",
      materialDone: "",
    };
  }

  const customer = lookupCustomer(trimmed);
  const saleRow = findSaleRowByConsumerNo(trimmed);
  const bom = getBomMaterialsForConsumer(trimmed);
  const setupDetail = saleRow?.setupDetail?.trim() || formatSetupDetail(bom) || "";

  const teamWork = saleRow?.teamWork || "";
  const teamCfg = teamWork ? getSaleTeamLeaderConfig(teamWork) : null;

  const siteOrder = getSiteOrderForConsumer(trimmed);
  let materialDone = "";
  if (siteOrder?.formPayload?.teamMembers?.length) {
    materialDone = `Site form team: ${siteOrder.formPayload.teamMembers.join(", ")}`;
  }
  if (siteOrder?.formPayload?.panelSerials?.length) {
    materialDone += materialDone ? "\n" : "";
    materialDone += `Panels: ${siteOrder.formPayload.panelSerials.filter(Boolean).join(", ")}`;
  }

  return {
    consumerNo: customer?.consumerNo || saleRow?.consumerNo || trimmed,
    customerName: saleRow?.customerName || customer?.customerName || "",
    siteAddress: saleRow?.address || customer?.address || "",
    setupKw: saleRow?.setupKw || customer?.setupKw || "",
    setupDetail,
    teamWork,
    teamLeader: teamCfg?.leaderName || "",
    workDetails: saleRow?.teamWork ? `Team: ${saleRow.teamWork} — daily site work` : "",
    materialDone,
  };
}
