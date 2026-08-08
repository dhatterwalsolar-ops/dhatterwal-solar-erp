import { Component } from "react";
import styles from "./ErpSheetErrorBoundary.module.css";

export class ErpSheetErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("ERP sheet render error:", error, info);
  }

  render() {
    if (this.state.error) {
      const raw = String(this.state.error?.message || this.state.error || "");
      const isLoop =
        /#301\b/i.test(raw) || /too many re-renders/i.test(raw);
      const msg = isLoop
        ? "Page reload loop detect hua (React #301). Try again dabayein. Agar Generate Files pe aaye to Subdivision bhar ke dubara try karein — phir bhi aaye to hard refresh (Ctrl+F5)."
        : raw;
      return (
        <div className={styles.wrap} role="alert">
          <h2>Sheet could not open</h2>
          <p className={styles.msg}>{msg}</p>
          <button
            type="button"
            className={styles.btn}
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
