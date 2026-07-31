/**
 * Dhatterwal Solar ERP — Google Form → BOM / Setup Detail
 *
 * SETUP
 * 1) Google Form banao (fields neeche). Responses → Spreadsheet link karo.
 * 2) Spreadsheet → Extensions → Apps Script → ye poori file paste karo.
 * 3) CONFIG me API_URL + WEBHOOK_SECRET set karo (Render API + server/.env secret).
 * 4) Triggers → Add Trigger:
 *      Function: onFormSubmit
 *      Event source: From spreadsheet
 *      Event type: On form submit
 * 5) Authorize Google account.
 * 6) ERP Settings → Google Form me form URL save karo (WhatsApp link ke liye).
 *
 * FORM QUESTIONS (title exact / similar — script flexible hai):
 * - Consumer No.
 * - Customer Name
 * - Address
 * - Setup kW
 * - Team Work
 * - Panel Product
 * - Panel Qty
 * - Panel Serials
 * - Inverter Name
 * - Inverter Serial
 * - Copper Wire
 * - Main Wire
 * - Stand
 * - Site Date  (optional)
 */

var CONFIG = {
  // Example: https://dhatterwal-solar-erp.onrender.com/api/public/google-form-bom
  API_URL: "https://dhatterwal-solar-erp.onrender.com/api/public/google-form-bom",
  // Same as Render / server/.env → GOOGLE_FORM_WEBHOOK_SECRET
  WEBHOOK_SECRET: "CHANGE_ME_SAME_AS_SERVER_ENV",
};

function onFormSubmit(e) {
  try {
    var named = (e && e.namedValues) || {};
    var payload = mapNamedValues_(named);
    payload.secret = CONFIG.WEBHOOK_SECRET;

    var res = UrlFetchApp.fetch(CONFIG.API_URL, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      headers: {
        "X-Webhook-Secret": CONFIG.WEBHOOK_SECRET,
      },
      muteHttpExceptions: true,
    });

    var code = res.getResponseCode();
    var body = res.getContentText();
    Logger.log("ERP BOM sync HTTP " + code + ": " + body);

    if (code < 200 || code >= 300) {
      // Optional: email admin on failure
      // MailApp.sendEmail("you@company.com", "ERP BOM sync fail", body);
    }
  } catch (err) {
    Logger.log("onFormSubmit error: " + err);
  }
}

/** Manual test from Apps Script editor — Run → testPingErp */
function testPingErp() {
  var payload = {
    secret: CONFIG.WEBHOOK_SECRET,
    consumerNo: "TEST-CN-001",
    customerName: "Test Customer",
    panelProductName: "Mono 540W",
    panelQty: "4",
    panelSerials: "P1,P2,P3,P4",
    inverterName: "5kW On-Grid",
    inverterSerial: "INV-TEST-001",
    copperWire: "Copper 4 sq mm — 15 m",
    mainWire: "Main 6 sq mm — 20 m",
    stand: "05 kW Structure Stand × 1 Set",
    setupKw: "05 kW",
    teamWork: "BALINDER TEAM",
  };
  var res = UrlFetchApp.fetch(CONFIG.API_URL, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    headers: { "X-Webhook-Secret": CONFIG.WEBHOOK_SECRET },
    muteHttpExceptions: true,
  });
  Logger.log(res.getResponseCode() + " " + res.getContentText());
}

function mapNamedValues_(named) {
  var get = function (titles) {
    for (var i = 0; i < titles.length; i++) {
      var t = titles[i];
      if (named[t] && named[t][0] != null && String(named[t][0]).trim() !== "") {
        return String(named[t][0]).trim();
      }
    }
    // fuzzy: case-insensitive includes
    var keys = Object.keys(named || {});
    for (var j = 0; j < titles.length; j++) {
      var want = String(titles[j]).toLowerCase();
      for (var k = 0; k < keys.length; k++) {
        if (String(keys[k]).toLowerCase().indexOf(want) >= 0) {
          var val = named[keys[k]] && named[keys[k]][0];
          if (val != null && String(val).trim() !== "") return String(val).trim();
        }
      }
    }
    return "";
  };

  return {
    consumerNo: get(["Consumer No.", "Consumer No", "Consumer Number", "consumerNo"]),
    customerName: get(["Customer Name", "Name", "customerName"]),
    address: get(["Address", "address"]),
    setupKw: get(["Setup kW", "Setup", "setupKw"]),
    teamWork: get(["Team Work", "Team", "teamWork"]),
    panelProductName: get(["Panel Product", "Panel Name", "panelProductName"]),
    panelQty: get(["Panel Qty", "Panel Count", "panelQty"]),
    panelSerials: get(["Panel Serials", "Panel Serial", "panelSerials"]),
    panelDetail: get(["Panel Detail", "panelDetail"]),
    inverterName: get(["Inverter Name", "Inverter Detail", "inverterName"]),
    inverterSerial: get(["Inverter Serial", "Inverter Serial No.", "inverterSerial"]),
    copperWire: get(["Copper Wire", "DC Wire", "copperWire"]),
    mainWire: get(["Main Wire", "AC Wire", "mainWire"]),
    stand: get(["Stand", "Structure Stand", "stand"]),
    siteDate: get(["Site Date", "Labour Date", "siteDate"]),
    labourDate: get(["Labour Date", "Site Date", "labourDate"]),
  };
}
