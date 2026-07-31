function env(key, fallback = "") {
  return String(process.env[key] ?? fallback).trim();
}

export function messagingConfig() {
  const smsProvider = (env("SMS_PROVIDER", "demo") || "demo").toLowerCase();
  const waProvider = (env("WHATSAPP_PROVIDER", "web") || "web").toLowerCase();

  return {
    smsProvider, // demo | msg91 | twilio
    waProvider, // web | meta | twilio
    otpTtlMs: Number(env("OTP_TTL_MS", "300000")) || 300000,
    otpMobile: env("OTP_MOBILE", "9467564675").replace(/\D/g, "").slice(-10),
    queryAlertMobile: env("QUERY_ALERT_MOBILE", "9467564675").replace(/\D/g, "").slice(-10),

    msg91AuthKey: env("MSG91_AUTH_KEY"),
    msg91SenderId: env("MSG91_SENDER_ID", "DHTSOL"),
    msg91OtpTemplateId: env("MSG91_OTP_TEMPLATE_ID"),

    twilioAccountSid: env("TWILIO_ACCOUNT_SID"),
    twilioAuthToken: env("TWILIO_AUTH_TOKEN"),
    twilioSmsFrom: env("TWILIO_SMS_FROM"),
    twilioWhatsAppFrom: env("TWILIO_WHATSAPP_FROM"), // e.g. whatsapp:+14155238886

    metaToken: env("WHATSAPP_META_TOKEN"),
    metaPhoneNumberId: env("WHATSAPP_META_PHONE_NUMBER_ID"),
    metaApiVersion: env("WHATSAPP_META_API_VERSION", "v21.0"),
  };
}

export function messagingStatus() {
  const c = messagingConfig();
  const smsReady =
    (c.smsProvider === "msg91" && Boolean(c.msg91AuthKey)) ||
    (c.smsProvider === "twilio" &&
      Boolean(c.twilioAccountSid && c.twilioAuthToken && c.twilioSmsFrom));
  const waReady =
    (c.waProvider === "meta" && Boolean(c.metaToken && c.metaPhoneNumberId)) ||
    (c.waProvider === "twilio" &&
      Boolean(c.twilioAccountSid && c.twilioAuthToken && c.twilioWhatsAppFrom));

  return {
    ok: true,
    smsProvider: c.smsProvider,
    smsConfigured: smsReady || c.smsProvider === "demo",
    smsLive: smsReady,
    whatsappProvider: c.waProvider,
    whatsappConfigured: waReady || c.waProvider === "web",
    whatsappLive: waReady,
    otpMobile: c.otpMobile ? `******${c.otpMobile.slice(-4)}` : "",
    queryAlertMobile: c.queryAlertMobile ? `******${c.queryAlertMobile.slice(-4)}` : "",
  };
}
