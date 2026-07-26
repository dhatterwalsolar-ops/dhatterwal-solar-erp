import Reveal from "../../common/Reveal/Reveal";
import styles from "./WhyChooseSection.module.css";

const STATS = [
  { value: "1000+", label: "Happy Customers", icon: "users" },
  { value: "2000+", label: "Solar Projects", icon: "project" },
  { value: "10+", label: "Years Experience", icon: "years" },
  { value: "100%", label: "Quality Assurance", icon: "quality" },
  { value: "24/7", label: "Customer Support", icon: "support" },
];

function WhyChooseSection() {
  return (
    <section className={styles.section} id="why-choose" aria-labelledby="why-heading">
      <div className="container">
        <Reveal className={styles.header}>
          <p className={styles.eyebrow}>WHY CHOOSE US</p>
          <h2 id="why-heading" className={styles.title}>
            We Bring Sunlight To Your Life
            <span className={styles.leaf} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 20c8-1 12-5 16-16-11 4-15 8-16 16z" />
              </svg>
            </span>
          </h2>
        </Reveal>

        <div className={styles.grid} id="projects">
          {STATS.map((stat, index) => (
            <Reveal key={stat.label} delay={index * 70}>
              <article className={styles.card}>
                <span className={styles.icon} aria-hidden="true">
                  <StatIcon type={stat.icon} />
                </span>
                <strong>{stat.value}</strong>
                <p>{stat.label}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatIcon({ type }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8 };
  return (
    <svg viewBox="0 0 24 24">
      {type === "users" && (
        <path {...common} d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zM8 13a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm8 8v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" />
      )}
      {type === "project" && (
        <path {...common} d="M3 21V8l9-4 9 4v13H3zm2-2h14V9.2L12 6.2 5 9.2V19z" />
      )}
      {type === "years" && (
        <path {...common} d="M12 8v5l3 2M12 22a10 10 0 1 1 10-10 10 10 0 0 1-10 10z" />
      )}
      {type === "quality" && (
        <path {...common} d="M12 2l2.5 5 5.5.8-4 3.9.9 5.5L12 15.8 6.1 17.2 7 11.7 3 7.8 8.5 7 12 2z" />
      )}
      {type === "support" && (
        <path {...common} d="M12 2a8 8 0 0 0-8 8v2h3v8h10v-8h3v-2a8 8 0 0 0-8-8z" />
      )}
    </svg>
  );
}

export default WhyChooseSection;
