import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { LABOUR_SALARY_TYPE_LABELS } from "../../../constants/labourEmployeeForm";
import { ROUTES } from "../../../constants/routes";
import {
  addLabourEmployeePayment,
  deletePaymentsForEmployee,
} from "../../../utils/labourPaymentStorage";
import { getLabourEmployees, saveLabourEmployees } from "../../../utils/labourEmployeeStorage";
import AddEmployeeSheet from "./AddEmployeeSheet";
import AdvancePaymentSheet from "./AdvancePaymentSheet";
import TeamMappingSheet from "./TeamMappingSheet";
import styles from "./LabourDetailsPage.module.css";

const FILTERS = ["All Employees", "Team Leaders", "Helpers", "Transporters"];

function filterEmployees(list, filter) {
  if (filter === "All Employees") return list;
  if (filter === "Team Leaders") return list.filter((e) => e.role === "Team Leader");
  if (filter === "Helpers") return list.filter((e) => e.role === "Helper");
  return list.filter((e) => e.role === "Transporter");
}

function LabourDetailsPage() {
  const [employees, setEmployees] = useState(() => getLabourEmployees());
  const [filter, setFilter] = useState("All Employees");
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceEmployeeId, setAdvanceEmployeeId] = useState("");
  const [teamOpen, setTeamOpen] = useState(false);

  const rows = useMemo(() => {
    let list = filterEmployees(employees, filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (e) => e.name.toLowerCase().includes(q) || String(e.mobile).includes(q),
      );
    }
    return list;
  }, [employees, filter, query]);

  const persist = (next) => {
    setEmployees(next);
    saveLabourEmployees(next);
  };

  const openAdd = () => {
    setEditTarget(null);
    setSheetOpen(true);
  };

  const openEdit = (emp) => {
    setEditTarget(emp);
    setSheetOpen(true);
  };

  const openAdvance = (employeeId = "") => {
    setAdvanceEmployeeId(employeeId || "");
    setAdvanceOpen(true);
  };

  const handleSaveEmployee = (employee, pendingPayments) => {
    pendingPayments.forEach((p) => {
      addLabourEmployeePayment({ ...p, employeeId: employee.id });
    });

    const exists = employees.some((e) => e.id === employee.id);
    if (exists) {
      persist(employees.map((e) => (e.id === employee.id ? employee : e)));
    } else {
      persist([...employees, employee]);
    }
    setSheetOpen(false);
    setEditTarget(null);
  };

  const handleSaveAdvance = (employee, payment) => {
    addLabourEmployeePayment({ ...payment, employeeId: employee.id });
    persist(employees.map((e) => (e.id === employee.id ? employee : e)));
    setAdvanceOpen(false);
    setAdvanceEmployeeId("");
  };

  const deleteEmployee = (id) => {
    if (!window.confirm("Delete this employee?")) return;
    deletePaymentsForEmployee(id);
    persist(employees.filter((e) => e.id !== id));
  };

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <Link to={ROUTES.LABOUR_SHEET} className={styles.back}>
            ← Main Menu
          </Link>
          <h1>1. LABOUR DETAILS</h1>
        </div>
        <div className={styles.headActions}>
          <button type="button" className={styles.btnAdd} onClick={openAdd}>
            + Add Employee
          </button>
          <button type="button" className={styles.btnAdvance} onClick={() => openAdvance()}>
            Advance Payment
          </button>
          <button type="button" className={styles.btnTeam} onClick={() => setTeamOpen(true)}>
            Update Team Detail
          </button>
        </div>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.tabs}>
          {FILTERS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={filter === tab ? `${styles.tab} ${styles.tabActive}` : styles.tab}
              onClick={() => setFilter(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
        <input
          type="search"
          className={styles.search}
          placeholder="Search by name or mobile..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Sr. No.</th>
              <th>Employee Name</th>
              <th>Father Name</th>
              <th>Mobile</th>
              <th>Team Type</th>
              <th>Salary Type</th>
              <th>Daily Wage (₹)</th>
              <th>Monthly Salary (₹)</th>
              <th>Advance (₹)</th>
              <th>Balance (₹)</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}</td>
                <td>{row.name}</td>
                <td>{row.fatherName || "—"}</td>
                <td>{row.mobile}</td>
                <td>{row.role || "—"}</td>
                <td>{LABOUR_SALARY_TYPE_LABELS[row.salaryType] || "—"}</td>
                <td>{Number(row.dailyWage || 0).toLocaleString("en-IN")}</td>
                <td>{Number(row.monthlySalary || 0).toLocaleString("en-IN")}</td>
                <td>{Number(row.advanceTaken || 0).toLocaleString("en-IN")}</td>
                <td>{Number(row.balance || 0).toLocaleString("en-IN")}</td>
                <td>
                  <span className={styles.statusActive}>{row.status}</span>
                </td>
                <td className={styles.actions}>
                  <button type="button" onClick={() => openEdit(row)} aria-label="Edit" title="Edit">
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={() => openAdvance(row.id)}
                    aria-label="Advance"
                    title="Advance payment"
                  >
                    ₹
                  </button>
                  <button type="button" onClick={() => deleteEmployee(row.id)} aria-label="Delete">
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AddEmployeeSheet
        open={sheetOpen}
        initial={editTarget}
        onClose={() => {
          setSheetOpen(false);
          setEditTarget(null);
        }}
        onSave={handleSaveEmployee}
      />

      <AdvancePaymentSheet
        open={advanceOpen}
        employees={employees}
        initialEmployeeId={advanceEmployeeId}
        onClose={() => {
          setAdvanceOpen(false);
          setAdvanceEmployeeId("");
        }}
        onSave={handleSaveAdvance}
      />

      <TeamMappingSheet open={teamOpen} onClose={() => setTeamOpen(false)} />
    </div>
  );
}

export default LabourDetailsPage;
