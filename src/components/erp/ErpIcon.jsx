export function ErpIcon({ name }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  switch (name) {
    case "loan":
      return (
        <svg {...common}>
          <path d="M4 20V8l8-4 8 4v12H4z" />
          <path d="M9 20v-6h6v6" />
          <path d="M9 10h6" />
        </svg>
      );
    case "cash":
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      );
    case "updateNameLoad":
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
          <path d="M9 11l2 2" />
        </svg>
      );
    case "sale":
      return (
        <svg {...common}>
          <path d="M7 4h10v16H7z" />
          <path d="M9 8h6M9 12h6M9 16h4" />
        </svg>
      );
    case "invoiceFile":
      return (
        <svg {...common}>
          <path d="M6 4h12v16H6z" />
          <path d="M9 9h6M9 13h4" />
          <path d="M14 17l2 2 4-4" />
        </svg>
      );
    case "purchase":
      return (
        <svg {...common}>
          <circle cx="9" cy="20" r="1.5" />
          <circle cx="17" cy="20" r="1.5" />
          <path d="M3 4h2l2.5 10h11l2-7H7" />
        </svg>
      );
    case "product":
      return (
        <svg {...common}>
          <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
          <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
        </svg>
      );
    case "payment":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 10h18" />
        </svg>
      );
    case "stock":
      return (
        <svg {...common}>
          <path d="M4 19V5M4 19h16M8 15v-4M12 15V9M16 15v-6" />
        </svg>
      );
    case "bom":
      return (
        <svg {...common}>
          <path d="M6 20V8l6-3 6 3v12" />
          <path d="M9 14h6M9 11h6" />
        </svg>
      );
    case "labour":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3" />
          <path d="M5 20v-1a5 5 0 0 1 10 0v1" />
          <path d="M12 11v3" />
        </svg>
      );
    case "customer":
      return (
        <svg {...common}>
          <circle cx="9" cy="9" r="2.5" />
          <circle cx="16" cy="10" r="2" />
          <path d="M4 19v-1a4 4 0 0 1 4-4h0" />
          <path d="M14 19v-1a3 3 0 0 1 3-3h0" />
        </svg>
      );
    case "query":
      return (
        <svg {...common}>
          <path d="M12 22a10 10 0 1 0-10-10" />
          <path d="M12 6v6l3 2" />
        </svg>
      );
    case "report":
      return (
        <svg {...common}>
          <path d="M4 19V5M4 19h16" />
          <path d="M8 15l3-3 3 2 4-5" />
        </svg>
      );
    case "gst":
      return (
        <svg {...common}>
          <path d="M7 4h10v16H7z" />
          <path d="M9 9h6M9 13h6M9 17h4" />
          <path d="M11 4v16" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
        </svg>
      );
    case "support":
      return (
        <svg {...common}>
          <path d="M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.24 11.4 11.4 0 0 0 3.6.58 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A16 16 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11.4 11.4 0 0 0 .58 3.6 1 1 0 0 1-.24 1L6.6 10.8z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M4 6h16v12H4z" />
        </svg>
      );
  }
}
