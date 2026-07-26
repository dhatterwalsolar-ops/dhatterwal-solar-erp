import { BRANCH_MD, CONTACT } from "../../../constants/contact";
import styles from "./TopBar.module.css";

const SOCIAL = [
  { label: "Facebook", href: "#", abbr: "f" },
  { label: "Instagram", href: "#", abbr: "ig" },
  { label: "WhatsApp", href: `https://wa.me/${CONTACT.whatsappTel}`, abbr: "wa" },
  { label: "YouTube", href: "#", abbr: "yt" },
];

function TopBar() {
  return (
    <div className={styles.topBar}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.left}>
          <p className={styles.branchMd}>
            Branch MD: <strong>{BRANCH_MD}</strong>
          </p>
          <div className={styles.contact}>
            {CONTACT.phones.map((phone) => (
              <a key={phone.tel} href={`tel:${phone.tel}`} className={styles.contactItem}>
                <PhoneIcon />
                {phone.display}
              </a>
            ))}
            <a href={`mailto:${CONTACT.email}`} className={styles.contactItem}>
              <MailIcon />
              {CONTACT.email}
            </a>
          </div>
        </div>
        <div className={styles.socialWrap}>
          <span className={styles.follow}>Follow Us :</span>
          <div className={styles.social}>
            {SOCIAL.map((item) => (
              <a
                key={item.label}
                href={item.href}
                aria-label={item.label}
                {...(item.href.startsWith("http")
                  ? { target: "_blank", rel: "noreferrer" }
                  : {})}
              >
                {item.abbr}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24 11.4 11.4 0 0 0 3.6.58 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A16 16 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .58 3.6 1 1 0 0 1-.24 1L6.6 10.8z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm0 2 8 5 8-5" />
    </svg>
  );
}

export default TopBar;
