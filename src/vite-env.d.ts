/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_API_TOKEN?: string;
  /** Tauri 桌面版连接本机后端的端口，默认 3002 */
  readonly VITE_TAURI_API_PORT?: string;
}

declare const __TAURI_BUILD__: boolean;
