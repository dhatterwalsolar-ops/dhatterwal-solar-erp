import { useEffect, useRef, useState } from "react";
import styles from "./StatisticsSection.module.css";

const STATS = [
  { value: "500+", label: "Projects completed" },
  { value: "5MW+", label: "Installed capacity" },
  { value: "1200+", label: "Happy customers" },
  { value: "15+", label: "Districts served" },
];

function parseStatValue(value) {
  const match = String(value).match(/^(\d+(?:\.\d+)?)(.*)$/);
  if (!match) return { number: 0, suffix: value };
  return { number: Number(match[1]), suffix: match[2] };
}

function useCountUp(value, active, duration = 1400) {
  const { number, suffix } = parseStatValue(value);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!active) return undefined;
    let frame = 0;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(number * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, duration, number]);

  return `${display}${suffix}`;
}

function StatItem({ stat, index }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const displayValue = useCountUp(stat.value, visible);

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <li
      ref={ref}
      className={`${styles.item} reveal ${visible ? "is-visible" : ""}`.trim()}
      style={{ "--reveal-delay": `${index * 90}ms` }}
    >
      <span className={styles.value}>{displayValue}</span>
      <span className={styles.label}>{stat.label}</span>
    </li>
  );
}

function StatisticsSection() {
  return (
    <section className={styles.section} id="statistics" aria-labelledby="statistics-heading">
      <div className="container">
        <h2 id="statistics-heading" className="sr-only">
          Company statistics
        </h2>
        <ul className={styles.grid}>
          {STATS.map((stat, index) => (
            <StatItem key={stat.label} stat={stat} index={index} />
          ))}
        </ul>
      </div>
    </section>
  );
}

export default StatisticsSection;
