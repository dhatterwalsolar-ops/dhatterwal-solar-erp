export const LABOUR_ROLES = ["Team Leader", "Helper", "Transporter"];

export const DEFAULT_LABOUR_EMPLOYEES = [
  {
    id: "emp-1",
    name: "Balinder Goswami",
    role: "Team Leader",
    dailyWage: 700,
    monthlySalary: 21000,
    advanceTaken: 5000,
    balance: 16000,
    mobile: "9876543210",
    status: "Active",
  },
  {
    id: "emp-2",
    name: "Rajesh Goswami",
    role: "Helper",
    dailyWage: 500,
    monthlySalary: 15000,
    advanceTaken: 2000,
    balance: 13000,
    mobile: "9876543211",
    status: "Active",
  },
  {
    id: "emp-3",
    name: "Aniket",
    role: "Helper",
    dailyWage: 500,
    monthlySalary: 15000,
    advanceTaken: 1500,
    balance: 13500,
    mobile: "9876543212",
    status: "Active",
  },
  {
    id: "emp-4",
    name: "Ravi Kumar",
    role: "Team Leader",
    dailyWage: 700,
    monthlySalary: 21000,
    advanceTaken: 3000,
    balance: 18000,
    mobile: "9992891023",
    status: "Active",
  },
  {
    id: "emp-5",
    name: "Sunil Kumar",
    role: "Helper",
    dailyWage: 500,
    monthlySalary: 15000,
    advanceTaken: 0,
    balance: 15000,
    mobile: "9467564675",
    status: "Active",
  },
  {
    id: "emp-6",
    name: "Vikash Transport",
    role: "Transporter",
    dailyWage: 800,
    monthlySalary: 24000,
    advanceTaken: 4000,
    balance: 20000,
    mobile: "9812345678",
    status: "Active",
  },
];

export const TEAM_MAPPING_DEFAULT = [
  { leader: "Balinder Goswami", members: ["Rajesh Goswami", "Aniket"] },
  { leader: "Ravi Kumar", members: ["Sunil Kumar", "Mohit", "Aman"] },
];

export const DAILY_TEAM_MEMBERS = [
  "Rajesh Goswami",
  "Aniket",
  "Sunil Kumar",
  "Mohit",
  "Aman",
  "Vikas",
  "Rohit",
  "Suresh",
  "Rajesh",
  "Deepak",
  "Sanjay",
  "Nitin",
];

export const TEAM_LEADER_OPTIONS = ["Balinder Goswami", "Ravi Kumar", "Sunil Kumar"];

export const INSTALLATION_STATUS_OPTIONS = ["In Progress", "Completed", "Pending Inspection"];
