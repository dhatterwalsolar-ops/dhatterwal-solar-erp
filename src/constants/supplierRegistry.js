export const DEFAULT_SUPPLIERS = [
  {
    id: "sup-waaree",
    name: "Waaree Energies Ltd",
    contactPerson: "Rajesh Vendor",
    mobile: "9812345678",
    gstin: "27AABCU9603R1Z5",
    address: "Plot 12, Industrial Area, Rohtak, Haryana",
  },
  {
    id: "sup-growatt",
    name: "Growatt India",
    contactPerson: "Amit Sharma",
    mobile: "9876501234",
    gstin: "06AABCG1234M1Z8",
    address: "Sector 18, Gurugram, Haryana",
  },
  {
    id: "sup-adani",
    name: "Adani Solar",
    contactPerson: "Vikram Singh",
    mobile: "9898989898",
    gstin: "24AAACA1234F1Z2",
    address: "Mundra, Gujarat",
  },
  {
    id: "sup-havells",
    name: "Havells India",
    contactPerson: "Neha Gupta",
    mobile: "9123456780",
    gstin: "06AAACH5678K1Z9",
    address: "Noida, Uttar Pradesh",
  },
  {
    id: "sup-polycab",
    name: "Polycab Wires",
    contactPerson: "Suresh Kumar",
    mobile: "9988776655",
    gstin: "27AAACP4321H1Z4",
    address: "Halol, Gujarat",
  },
];

export function supplierToPartyFields(supplier) {
  return {
    supplier: supplier.name,
    supplierId: supplier.id,
    contactPerson: supplier.contactPerson || "",
    mobile: supplier.mobile || "",
    gstin: supplier.gstin || "",
    address: supplier.address || "",
  };
}
