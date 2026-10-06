import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { startSync } from "@/lib/sync";

if (!window.location.hash) {
  window.location.hash = "#/";
}

startSync();

if ("serviceWorker" in navigator && window.self === window.top && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

createRoot(document.getElementById("root")!).render(<App />);
