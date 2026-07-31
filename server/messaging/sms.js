import { messagingConfig } from "./config.js";

function to91(mobile) {
  const d = String(mobile || "").replace(/\D/g, "");
  const local = d.length >= 10 ? d.slice(-10) : d;
  return local.length === 10 ? `91${local}` : d;
}

async function sendMsg91Sms(mobile, message) {
  const c = messagingConfig();
  if (!c.msg91AuthKey) throw new Error("MSG91_AUTH_KEY missing");

  const url = new URL("https://control.msg91.com/api/v5/flow/");
  // Generic SMS via SendSMS API when no flow template:
  const sendUrl = "https://api.msg91.com/api/sendhttp.php";
  const params = new URLSearchParams({
    authkey: c.msg91AuthKey,
    mobiles: to91(mobile),
    message,
    sender: c.msg91SenderId || "DHTSOL",
    route: "4",
    country: "91",
  });
  const res = await fetch(`${sendUrl}?${params.toString()}`, { method: "GET" });
  const text = await res.text();
  if (!res.ok) throw new Error(`MSG91 SMS fail: ${text.slice(0, 200)}`);
  return { provider: "msg91", raw: text };
}

async function sendMsg91OtpTemplate(mobile, otp) {
  const c = messagingConfig();
  if (!c.msg91AuthKey) throw new Error("MSG91_AUTH_KEY missing — MSG91 dashboard se Authkey paste karein.");

  // Preferred: MSG91 OTP API + DLT template (##OTP## variable)
  if (c.msg91OtpTemplateId) {
    const res = await fetch("https://control.msg91.com/api/v5/otp", {
      method: "POST",
      headers: {
        authkey: c.msg91AuthKey,
        accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        template_id: c.msg91OtpTemplateId,
        short_url: "0",
        recipients: [
          {
            mobiles: to91(mobile),
            otp: String(otp),
            OTP: String(otp),
          },
        ],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.type === "error") {
      throw new Error(
        data.message || data.error || data.msg || `MSG91 OTP HTTP ${res.status}`,
      );
    }
    return { provider: "msg91", raw: data, live: true };
  }

  // Fallback: plain SendHTTP (DLT sender/template approved hona chahiye)
  return sendMsg91Sms(
    mobile,
    `Dhatterwal Solar OTP is ${otp}. Valid for 5 minutes. Do not share with anyone.`,
  );
}

async function sendTwilioSms(mobile, message) {
  const c = messagingConfig();
  if (!c.twilioAccountSid || !c.twilioAuthToken || !c.twilioSmsFrom) {
    throw new Error("Twilio SMS env incomplete");
  }
  const to = `+${to91(mobile)}`;
  const auth = Buffer.from(`${c.twilioAccountSid}:${c.twilioAuthToken}`).toString("base64");
  const body = new URLSearchParams({
    To: to,
    From: c.twilioSmsFrom,
    Body: message,
  });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${c.twilioAccountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Twilio SMS HTTP ${res.status}`);
  return { provider: "twilio", sid: data.sid };
}

export async function sendSmsMessage(mobile, message) {
  const c = messagingConfig();
  const local = String(mobile || "").replace(/\D/g, "").slice(-10);
  if (local.length !== 10) throw new Error("Invalid mobile for SMS");

  if (c.smsProvider === "msg91") return sendMsg91Sms(local, message);
  if (c.smsProvider === "twilio") return sendTwilioSms(local, message);

  return {
    provider: "demo",
    demo: true,
    message: "SMS_PROVIDER=demo — real SMS nahi gaya. OTP response me dikhega (dev).",
  };
}

export async function sendOtpSms(mobile, otp) {
  const c = messagingConfig();
  const local = String(mobile || "").replace(/\D/g, "").slice(-10);
  if (local.length !== 10) throw new Error("Invalid mobile for OTP");

  if (c.smsProvider === "msg91") return sendMsg91OtpTemplate(local, otp);
  if (c.smsProvider === "twilio") {
    return sendTwilioSms(
      local,
      `Dhatterwal Solar OTP: ${otp}. Valid 5 minutes. Do not share with anyone.`,
    );
  }

  return {
    provider: "demo",
    demo: true,
    otp, // only in demo mode for local testing
    message: "Demo OTP — SMS_PROVIDER live set karein for real SMS.",
  };
}
