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
      return (
        <div className={styles.wrap} role="alert">
          <h2>Sheet could not open</h2>
          <p className={styles.msg}>{this.state.error.message}</p>
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
