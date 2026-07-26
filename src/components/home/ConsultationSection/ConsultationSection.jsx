import { useState } from "react";
import { CONTACT } from "../../../constants/contact";
import styles from "./ConsultationSection.module.css";

const INITIAL_FORM = {
  name: "",
  mobile: "",
  email: "",
  requirement: "",
};

function ConsultationSection() {
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setSubmitted(true);
  };

  return (
    <section className={styles.section} id="consultation" aria-labelledby="consultation-heading">
      <div className="container">
        <div className={styles.panel}>
          <div className={styles.formSide}>
            <h2 id="consultation-heading">Get Free Consultation</h2>
            <form className={styles.form} onSubmit={handleSubmit}>
              {submitted ? (
                <p className={styles.success} role="status">
                  Thank you! We will call you on {form.mobile || "your number"} soon.
                </p>
              ) : (
                <>
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Your Name"
                    required
                  />
                  <input
                    type="tel"
                    name="mobile"
                    value={form.mobile}
                    onChange={handleChange}
                    placeholder="Mobile Number"
                    required
                  />
                  <input
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Email Address"
                  />
                  <select
                    name="requirement"
                    value={form.requirement}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select Requirement</option>
                    <option>Residential Solar</option>
                    <option>Commercial Solar</option>
                    <option>Hybrid System</option>
                    <option>Net Metering</option>
                    <option>AMC / Service</option>
                  </select>
                  <button type="submit" className={styles.submitBtn}>
                    SUBMIT NOW →
                  </button>
                </>
              )}
            </form>
          </div>

          <div className={styles.callSide}>
            <span className={styles.phoneIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24 11.4 11.4 0 0 0 3.6.58 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A16 16 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .58 3.6 1 1 0 0 1-.24 1L6.6 10.8z" />
              </svg>
            </span>
            <p className={styles.callTitle}>Need Help? Call Us Now!</p>
            <a href={`tel:${CONTACT.primaryTel}`} className={styles.phoneNumber}>
              {CONTACT.primaryDisplay}
            </a>
            <ul className={styles.altPhones}>
              {CONTACT.phones.slice(1).map((phone) => (
                <li key={phone.tel}>
                  <a href={`tel:${phone.tel}`}>{phone.display}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ConsultationSection;
