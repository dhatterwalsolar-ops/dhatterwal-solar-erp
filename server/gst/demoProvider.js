function pad(n, w = 2) {
  return String(n).padStart(w, "0");
}

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function rnd(n = 3) {
  const min = 10 ** (n - 1);
  const max = 10 ** n - 1;
  return String(Math.floor(min + Math.random() * (max - min)));
}

export async function demoGenerateEway(payload) {
  const ewayBillNo = `EWB${stamp()}${rnd(3)}`;
  return {
    ok: true,
    provider: "demo",
    ewayBillNo,
    validUpto: new Date(Date.now() + 24 * 60 * 60 * 1000).toLocaleString("en-IN"),
    message: "Demo E-Way Bill generated (GSP live nahi — credentials set karein).",
    matched: {
      invoiceNo: payload.invoiceNo,
      vehicleNo: String(payload.vehicleNo || "").trim().toUpperCase(),
      pinCode: String(payload.pinCode || "").trim(),
      station: String(payload.station || "").trim(),
      distanceKm: Number(payload.distanceKm) || 0,
    },
    raw: null,
  };
}

export async function demoGenerateEinvoice(payload) {
  const irn = `${stamp()}${rnd(4)}${rnd(4)}${rnd(4)}`.slice(0, 64);
  const ackNo = `ACK${stamp()}${rnd(4)}`;
  return {
    ok: true,
    provider: "demo",
    irn,
    ackNo,
    ackDate: new Date().toLocaleString("en-IN"),
    invoiceNo: payload.invoiceNo,
    message: "Demo GST E-Invoice IRN generated (GSP live nahi — credentials set karein).",
    raw: null,
  };
}
