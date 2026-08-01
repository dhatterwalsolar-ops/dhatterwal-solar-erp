import { useEffect, useRef } from "react";
import { IDLE_LOGOUT_MS } from "../constants/auth";

const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
  "wheel",
];

/**
 * Agar user `timeoutMs` tak koi activity na kare to `onIdle` call.
 * ERP Dashboard / protected shell me use karein.
 */
export function useIdleLogout({
  enabled = true,
  timeoutMs = IDLE_LOGOUT_MS,
  onIdle,
} = {}) {
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;

    let timerId = null;
    let lastResetAt = 0;

    const clearTimer = () => {
      if (timerId != null) {
        window.clearTimeout(timerId);
        timerId = null;
      }
    };

    const fireIdle = () => {
      clearTimer();
      onIdleRef.current?.();
    };

    const resetTimer = () => {
      const now = Date.now();
      /* mousemove spam se load kam — max 1 reset / sec */
      if (now - lastResetAt < 1000 && timerId != null) return;
      lastResetAt = now;
      clearTimer();
      timerId = window.setTimeout(fireIdle, timeoutMs);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") resetTimer();
    };

    ACTIVITY_EVENTS.forEach((name) => {
      window.addEventListener(name, resetTimer, { passive: true, capture: true });
    });
    document.addEventListener("visibilitychange", onVisibility);

    resetTimer();

    return () => {
      clearTimer();
      ACTIVITY_EVENTS.forEach((name) => {
        window.removeEventListener(name, resetTimer, { capture: true });
      });
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, timeoutMs]);
}
