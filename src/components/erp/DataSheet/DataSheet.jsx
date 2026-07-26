import { useMemo, useState } from "react";
import styles from "./DataSheet.module.css";

function DataSheet({ title, columns, rows: initialRows }) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");

  const filteredRows = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((row) => row.some((cell) => String(cell).toLowerCase().includes(q)));
  }, [query, rows]);

  const addRow = () => {
    const blank = columns.map((_, index) => (index === 0 ? `NEW-${rows.length + 1}` : ""));
    setRows((prev) => [...prev, blank]);
  };

  return (
    <section className={styles.sheet}>
      <header className={styles.toolbar}>
        <div>
          <h1>{title}</h1>
          <p>Excel-style sheet — add, search and manage records (ERP ready)</p>
        </div>
        <div className={styles.toolbarActions}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rows..."
            className={styles.search}
          />
          <button type="button" className={styles.btnPrimary} onClick={addRow}>
            + Add Row
          </button>
          <button type="button" className={styles.btnOutline}>
            Export
          </button>
        </div>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              {columns.map((col) => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, rowIndex) => (
              <tr key={`${row[0]}-${rowIndex}`}>
                <td>{rowIndex + 1}</td>
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default DataSheet;
