import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";
import { queryClient } from "./queryClient";

const rootEl = document.getElementById("root")!;

/**
 * デモモードのとき MSW を起動する。
 *
 * デモは MSW が可用性の境界なので、SW 登録に失敗した場合は
 * 実 API にフォールバックせず明示的に失敗させる。
 * （worker.start() の reject を catch せず伝播させる）
 */
async function enableMocking(): Promise<void> {
  if (import.meta.env.VITE_DEMO_MODE !== "true") return;
  const { worker } = await import("./mocks/browser");
  // onUnhandledRequest: "bypass" で Open-Meteo など未定義ハンドラは実 API へ素通し。
  // serviceWorker.url に BASE_URL を付けることで Pages のサブパス配信でも SW を見つけられる。
  await worker.start({
    onUnhandledRequest: "bypass",
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
  });
}

enableMocking()
  .then(() => {
    // worker.start() が完了してから render するので、
    // React Query が最初の fetch を走らせる前に必ず SW が有効化されている。
    ReactDOM.createRoot(rootEl).render(
      <React.StrictMode>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </React.StrictMode>,
    );
  })
  .catch((err) => {
    // デモで SW が起動できなければデータが無くカードが全滅するため、
    // 原因が見える最小限のエラー画面を出す（実 API へは落とさない）。
    rootEl.textContent = "デモの初期化に失敗しました（Service Worker を起動できません）";
    throw err;
  });
