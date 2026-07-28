/** 02 kW → 4 panels (≈2 panels per kW @ ~550W class). */
export function panelCountFromSetupKw(setupKw) {
  const text = String(setupKw || "");
  const match = text.match(/(\d+(?:\.\d+)?)/);
  const kw = match ? parseFloat(match[1]) : 0;
  if (kw <= 0) return 4;
  return Math.max(1, Math.round(kw * 2));
}
