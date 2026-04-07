import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.mikujar.notes",
  appName: "未来罐",
  webDir: "dist",
  /** WKWebView / 滚动层底色：与速记白底、浅色键盘接缝一致，避免露灰或黑边 */
  backgroundColor: "#ffffff",
  ios: {
    backgroundColor: "#ffffff",
  },
  android: {
    backgroundColor: "#ffffff",
  },
  /**
   * 真机/模拟器热重载：本机 `npm run dev` 后取消注释，把地址换成电脑的局域网 IP。
   * Android 若 API 为 http 还需在 `android/app/src/main/AndroidManifest.xml` 开 cleartext。
   */
  // server: { url: "http://192.168.1.2:5173", cleartext: true },
  plugins: {
    Keyboard: {
      /**
       * 须用 native：整页 WebView 随键盘缩小，fixed 底栏（速记层）才会留在键盘上方。
       * 用 body 时 fixed 仍相对大视口贴底，整片会沉到键盘下 → 输入框「消失」。
       */
      resize: "native",
      style: "LIGHT",
    },
  },
};

export default config;
