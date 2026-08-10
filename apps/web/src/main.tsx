import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import i18n from "./i18n";
import "./index.css";
import { initDesignTheme } from "./lib/designTheme";
import { bindHtmlLang } from "./lib/htmlLang";

// AUFTRAG-mega40 B: gespeicherte Design-Wahl VOR dem ersten Render anwenden (kein Aufblitzen des
// falschen Themes; gilt auch für Routen ohne Topbar wie /mobile). Standard bleibt Klassisch.
initDesignTheme();

// AUFTRAG-101: <html lang> an die aktive i18n-Sprache binden. GENAU HIER, an der Wurzel — nicht in
// den zwei Sprachumschaltern (Topbar, Profile), sonst entsteht mit dem dritten eine dritte Wahrheit.
// Der Startwert `lang="de"` in index.html bleibt korrekt (Preflight 98); gebunden wird der Wechsel.
bindHtmlLang(i18n);

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root-Element fehlt.");
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

// PWA (FE-MOB-01): Service Worker nur in Produktion registrieren (im Dev stört er HMR).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registrierung fehlgeschlagen → App läuft normal online weiter.
    });
  });
}
