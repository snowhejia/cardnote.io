import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppDataModeProvider } from "./appDataMode";
import { AuthProvider } from "./auth/AuthContext";
import "./index.css";

/** iOS WKWebView：拦截双指捏合缩放（viewport 在部分场景仍可能漏网） */
function disableIosPinchZoom() {
  if (typeof document === "undefined") return;
  const ua = navigator.userAgent || "";
  const isIos =
    /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIos) return;
  const opts: AddEventListenerOptions = { passive: false };
  const block = (e: Event) => e.preventDefault();
  document.addEventListener("gesturestart", block, opts);
  document.addEventListener("gesturechange", block, opts);
  document.addEventListener("gestureend", block, opts);
}
disableIosPinchZoom();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppDataModeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </AppDataModeProvider>
  </StrictMode>
);
