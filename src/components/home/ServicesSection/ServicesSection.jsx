import styles from "./ServicesSection.module.css";

const SERVICES = [
  {
    title: "Rooftop Solar System",
    description: "Complete rooftop solar solutions for homes and businesses.",
  },
  {
    title: "Solar Inverter",
    description: "High-efficiency on-grid and hybrid inverters.",
  },
  {
    title: "Solar Battery",
    description: "Reliable lithium battery backup systems.",
  },
  {
    title: "Solar Structure",
    description: "RCC and tin roof mounting structures.",
  },
  {
    title: "Installation & AMC",
    description: "Professional installation and annual maintenance.",
  },
  {
    title: "Net Metering Support",
    description: "DISCOM documentation and net meter assistance.",
  },
  {
    title: "Consultation & Support",
    description: "Free site survey and expert guidance.",
  },
];

function ServicesSection({ variant = "default" }) {
  const isStrip = variant === "heroStrip";

  return (
    <section
      className={isStrip ? styles.stripSection : styles.section}
      id="services"
      aria-labelledby="services-heading"
    >
      <div className={isStrip ? styles.stripInner : "container"}>
        {!isStrip && (
          <header className={styles.header}>
            <h2 id="services-heading" className="section-title">
              Our Solar Services
            </h2>
          </header>
        )}
        <div className={isStrip ? styles.stripGrid : styles.grid}>
          {SERVICES.map((service) => (
            <article key={service.title} className={styles.card}>
              <span className={styles.cardIcon} aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M12 3l2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5L4.8 8.2l5-.7L12 3z" />
                </svg>
              </span>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
              <a href="#consultation" className={styles.link}>
                View Details →
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ServicesSection;
