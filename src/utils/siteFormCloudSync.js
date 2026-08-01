import { getApiBase } from "./erpStorage";

const FALLBACK_API = "https://dhatterwal-solar-erp.onrender.com";

export function getPublicApiBase() {
  return getApiBase() || FALLBACK_API;
}

/**
 * Team Leader phone (no login) → server BOM / Sale / site order.
 * Local save ke baad ye sync zaroori hai warna office BOM empty rehti hai.
 */
export async function syncSiteFormToCloud(order, formPayload) {
  const base = getPublicApiBase();
  if (!base) {
    return { ok: false, message: "API URL missing — office BOM sync nahi hua." };
  }

  const orderBody = {
    id: order?.id || "",
    consumerNo: order?.consumerNo || "",
    customerName: order?.customerName || "",
    fatherName: order?.fatherName || "",
    address: order?.address || "",
    setupKw: order?.setupKw || "",
    teamWork: order?.teamWork || "",
    teamLeaderName: order?.teamLeaderName || "",
    siteDate: order?.siteDate || "",
    panelCount: order?.panelCount || "",
  };

  /* Photos / huge dataUrls mat bhejo */
  const form = { ...(formPayload || {}) };
  delete form.siteGpsPhoto;
  delete form.earthingPhoto;
  delete form.completeFile;

  try {
    const res = await fetch(`${base}/api/public/site-form-submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: orderBody, form }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        message: data.error || data.message || `Cloud sync fail (${res.status})`,
      };
    }
    return { ok: true, ...data };
  } catch (err) {
    return {
      ok: false,
      message: err?.message || "Cloud sync network fail — internet check karein.",
    };
  }
}
