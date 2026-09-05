import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import i18n from "./i18n";
import "./index.css";
import { initDesignTheme } from "./lib/designTheme";
import { bindHtmlLang } from "./lib/htmlLang";
import { bindSpracheSpeichern } from "./lib/sprachwahl";

// AUFTRAG-mega40 B: gespeicherte Design-Wahl VOR dem ersten Render anwenden (kein Aufblitzen des
// falschen Themes; gilt auch für Routen ohne Topbar wie /mobile). Standard bleibt Klassisch.
initDesignTheme();

// AUFTRAG-101: <html lang> an die aktive i18n-Sprache binden. GENAU HIER, an der Wurzel — nicht im
// Sprachumschalter (`pages/Profile.tsx`), sonst brächte der nächste Umschalter eine zweite Wahrheit
// mit. Der Startwert `lang="de"` in index.html bleibt korrekt; gebunden wird der Wechsel.
bindHtmlLang(i18n);

// JOB 3086: die gewählte Sprache in den Browser schreiben, damit sie das Neuladen überlebt (gelesen
// wird sie beim Auswerten von `i18n.ts` als `lng`). Das SCHREIBEN wohnt aus demselben Grund an der
// Wurzel wie die Zeile darüber: hinge es am Umschalter, merkte sich genau dieser eine die Wahl und
// jeder weitere nicht — die Web-App hatte schon einmal zwei davon.
// Und es wohnt bewusst NICHT in `i18n.ts`: dieses Modul importieren Tests, die die Sprache umstellen
// (z. B. tests/app/web-html-lang-bindung-101.test.ts). Ein Schreiber im Modul würde dort ungefragt
// in den Speicher greifen und Fälle über Dateigrenzen hinweg verkleben.
bindSpracheSpeichern(i18n);

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
