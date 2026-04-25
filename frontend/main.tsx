import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import App from "./App";
import { AppDataModeProvider } from "./appDataMode";
import { AppUiLangProvider } from "./appUiLang";
import { AuthProvider } from "./auth/AuthContext";
import { LegalPagesProvider } from "./legalPages";
import { installBootDiagnostics } from "./bootDiagnostics";
import { RootErrorBoundary } from "./RootErrorBoundary";
import { runBrandStorageMigration } from "./brandMigration";
import "./index.css";

runBrandStorageMigration();
installBootDiagnostics();

/**
 * Vercel Analytics / Speed Insights 只应在「部署在 Vercel 上的网页」里加载。
 * localhost、vite preview 没有 /_vercel/... 脚本,控制台会报 script.js 失败。
 */
function shouldMountVercelWebInsights(): boolean {
  if (import.meta.env.DEV) return false;
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) {
    return false;
  }
  return true;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <AppDataModeProvider>
        <AppUiLangProvider>
          <LegalPagesProvider>
            <AuthProvider>
              <App />
              {shouldMountVercelWebInsights() ? (
                <>
                  <Analytics />
                  <SpeedInsights />
                </>
              ) : null}
            </AuthProvider>
          </LegalPagesProvider>
        </AppUiLangProvider>
      </AppDataModeProvider>
    </RootErrorBoundary>
  </StrictMode>
);
