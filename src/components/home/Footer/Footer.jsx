import { Link } from "react-router-dom";
import { BRANCH_MD, CONTACT } from "../../../constants/contact";
import { ROUTES } from "../../../constants/routes";
import styles from "./Footer.module.css";

const QUICK_LINKS = [
  { label: "Home", to: ROUTES.HOME },
  { label: "About Us", to: "/#why-choose" },
  { label: "Services", to: "/#services" },
  { label: "Products", to: "/#products" },
  { label: "Contact", to: "/#consultation" },
];

const SERVICES = [
  "Rooftop Solar",
  "Solar Inverter",
  "Solar Battery",
  "Net Metering",
  "Installation & AMC",
];

const PRODUCTS = ["2kW System", "3kW System", "5kW System", "10kW System", "Commercial"];

function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer} id="products">
      <div className={`container ${styles.grid}`}>
        <div className={styles.brandCol}>
          <p className={styles.logoTitle}>DHATTERWAL SOLAR</p>
          <p className={styles.logoSub}>POWERING YOUR FUTURE WITH CLEAN ENERGY</p>
          <p className={styles.branchMd}>
            Branch MD: <strong>{BRANCH_MD}</strong>
          </p>
          <p className={styles.desc}>
            Trusted solar partner for residential, commercial and industrial projects
            with MNRE-approved products and expert installation.
          </p>
          <div className={styles.social}>
            {["Fb", "Ig", "Wa", "Yt"].map((item) => (
              <a key={item} href="#" aria-label={item}>
                {item}
              </a>
            ))}
          </div>
        </div>

        <div>
          <p className={styles.heading}>Quick Links</p>
          <ul className={styles.list}>
            {QUICK_LINKS.map((link) => (
              <li key={link.label}>
                <Link to={link.to}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className={styles.heading}>Our Services</p>
          <ul className={styles.list}>
            {SERVICES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className={styles.heading}>Popular Products</p>
          <ul className={styles.list}>
            {PRODUCTS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className={styles.heading}>Contact Us</p>
          <ul className={styles.contactList}>
            {CONTACT.phones.map((phone) => (
              <li key={phone.tel}>
                <a href={`tel:${phone.tel}`}>{phone.display}</a>
              </li>
            ))}
            <li>
              <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            </li>
            <li>Dhatterwal Solar Energy System, Haryana, India</li>
          </ul>
        </div>

        <div>
          <p className={styles.heading}>Certifications</p>
          <div className={styles.badges}>
            <div className={styles.badge}>ISO 9001:2015 CERTIFIED</div>
            <div className={styles.badge}>MNRE APPROVED VENDOR</div>
          </div>
        </div>
      </div>

      <div className={styles.bar}>
        <div className={`container ${styles.barInner}`}>
          <p>© {year} Dhatterwal Solar Energy System. All Rights Reserved.</p>
          <div className={styles.legal}>
            <a href="#">Privacy Policy</a>
            <span>|</span>
            <a href="#">Terms &amp; Conditions</a>
          </div>
        </div>
      </div>

      <a
        href={`https://wa.me/${CONTACT.whatsappTel}`}
        className={styles.whatsapp}
        aria-label="Chat on WhatsApp"
        target="_blank"
        rel="noreferrer"
      >
        WA
      </a>
    </footer>
  );
}

export default Footer;
