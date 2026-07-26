import styles from "./ModuleScaffold.module.css";

function ModuleScaffold({ title, description, children }) {
  return (
    <section className={styles.scaffold}>
      <header className={styles.header}>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  );
}

export default ModuleScaffold;
