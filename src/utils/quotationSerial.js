import { buildSeriesPreview } from "../constants/settingsDefaults";
import { getSettingsState, saveQuotationSeries } from "./settingsStorage";

function incrementSeriesNumber(nextNumber) {
  const text = String(nextNumber ?? "1");
  const width = Math.max(text.length, 1);
  const num = (parseInt(text, 10) || 0) + 1;
  return String(num).padStart(width, "0");
}

export function peekNextQuotationSerial() {
  const state = getSettingsState();
  return buildSeriesPreview(state.quotationSeries);
}

export function allocateNextQuotationSerial() {
  const state = getSettingsState();
  const series = state.quotationSeries;
  const serialNo = buildSeriesPreview(series);
  saveQuotationSeries({
    ...series,
    nextNumber: incrementSeriesNumber(series.nextNumber),
  });
  return serialNo;
}
