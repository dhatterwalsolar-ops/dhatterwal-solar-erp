import heroImage from "../../../assets/hero-house.jpg";
import ServicesSection from "../ServicesSection/ServicesSection";
import styles from "./HeroSection.module.css";

const FEATURES = [
  { label: "High Quality Products", icon: "quality" },
  { label: "Save Money Every Month", icon: "money" },
  { label: "Clean & Green Environment", icon: "leaf" },
  { label: "Expert Support 24/7", icon: "support" },
];

function HeroSection() {
  return (
    <section className={styles.heroWrap} id="home" aria-labelledby="hero-heading">
      <img src={heroImage} alt="" className={styles.heroBg} />
      <div className={styles.heroOverlay} aria-hidden="true" />

      <div className={`container ${styles.heroContent}`}>
        <p className={styles.tagline}>
          <span className={styles.taglineLine} aria-hidden="true" />
          POWERING YOUR FUTURE WITH CLEAN ENERGY
          <span className={styles.taglineLine} aria-hidden="true" />
        </p>
        <h1 id="hero-heading" className={styles.title}>
          Best Solar Energy Solutions For Your Home & Business
        </h1>
        <p className={styles.lead}>
          On-grid, off-grid and hybrid solar systems with premium products, expert
          installation and complete net metering support across Haryana.
        </p>

        <ul className={styles.features}>
          {FEATURES.map((item) => (
            <li key={item.label}>
              <span className={styles.featureIcon} aria-hidden="true">
                <FeatureGlyph type={item.icon} />
              </span>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>

        <div className={styles.actions}>
          <a href="#consultation" className={styles.btnPrimary}>
            GET A FREE QUOTE →
          </a>
          <a href="#services" className={styles.btnOutline}>
            OUR SERVICES →
          </a>
        </div>
      </div>

      <ServicesSection variant="heroStrip" />
    </section>
  );
}

function FeatureGlyph({ type }) {
  if (type === "quality") {
    return (
      <svg viewBox="0 0 24 24">
        <path d="M12 2l2.5 5 5.5.8-4 3.9.9 5.5L12 15.8 6.1 17.2 7 11.7 3 7.8 8.5 7 12 2z" />
      </svg>
    );
  }
  if (type === "money") {
    return (
      <svg viewBox="0 0 24 24">
        <path d="M12 3v18M7 7h8a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h10" />
      </svg>
    );
  }
  if (type === "leaf") {
    return (
      <svg viewBox="0 0 24 24">
        <path d="M4 20c8-1 12-5 16-16-11 4-15 8-16 16z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24">
      <path d="M12 2a8 8 0 0 0-8 8v2h3v8h10v-8h3v-2a8 8 0 0 0-8-8zm0 2a6 6 0 0 1 6 6v1H6v-1a6 6 0 0 1 6-6z" />
    </svg>
  );
}

export default HeroSection;
