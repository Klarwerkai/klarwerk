import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { endpoints } from "./api/endpoints";
import { SplashFlaeche } from "./components/Splash";
import i18n, { sprachBereit } from "./i18n";
import "./index.css";
import { initBrandTheme } from "./lib/brandTheme";
import { initDesignTheme } from "./lib/designTheme";
import { einblendungsMutationCache } from "./lib/einblendungen";
import { bindHtmlLang } from "./lib/htmlLang";
import { gleicheAngelegteSprachenAb } from "./lib/instanzSprachen";
import { ZAEHLER_FRISCHE_MS } from "./lib/loadingState";
import { bindeSchmuckSymbole } from "./lib/schmuckSymbole";
import { STANDARD_SPRACHE, bindSpracheSpeichern } from "./lib/sprachwahl";
import { bindTextpflege } from "./lib/textpflege";

// AUFTRAG-mega40 B: gespeicherte Design-Wahl VOR dem ersten Render anwenden (kein Aufblitzen des
// falschen Themes; gilt auch für Routen ohne Topbar wie /mobile). Standard bleibt Klassisch.
initDesignTheme();

// JOB 3511: die Firmen-CI (Demo-Erscheinungsbild) DANEBEN, nicht darin. `initDesignTheme` setzt
// `data-theme` aus der Wahl DIESES Browsers; `initBrandTheme` holt `data-brand` vom Server — die
// Wahl der INSTALLATION, für alle gleich. Zwei Attribute, zwei Eigentümer, zwei Lebensdauern.
// Der Aufruf blockiert den Start bewusst nicht: fällt `/api/branding` aus, startet die Anwendung
// unverändert und ohne Fehlerbanner (lib/brandTheme.ts).
initBrandTheme();

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
// R-0801: gebunden wird erst NACH `sprachBereit` (unten). Seit en und nl nachgeladen werden, kommt
// das `languageChanged` des Starts bei gespeicherter Wahl en/nl oder `?lang=en` erst nach dem
// Nachladen — hörte der Schreiber schon zu, schriebe er die Sprache eines Word-Links als Wahl
// dieses Browsers fest (JOB 3323 verbietet genau das).

// JOB 3113 H1b: die Frischefrist steht nur noch an EINER Stelle (`lib/loadingState.ts`). Sie ist
// hier der `staleTime` — der Zeitpunkt, ab dem react-query die Antwort nicht mehr für frisch hält —
// und dort die Frist, nach der die Navigation eine ungedeckte Zahl nicht mehr zeigt. Zwei Ausdrücke
// derselben Zahl wären ein zweites Gehirn; der WERT bleibt unverändert 30 000 ms.
// R-0953 / R-1015 (Nacharbeit 7): der EINE Ort, an dem jede Speicheraktion ihren Erfolg und ihren
// Fehler als Einblendung meldet (`lib/einblendungen.ts`).
const queryClient = new QueryClient({
  mutationCache: einblendungsMutationCache(),
  defaultOptions: { queries: { staleTime: ZAEHLER_FRISCHE_MS, retry: 1 } },
});

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root-Element fehlt.");
}

// WCAG 1.1.1 / 4.1.2 (Audit nacharbeit-8): namenlose Lucide-Symbole sind Schmuck und werden für
// Hilfstechnik verborgen — an der Wurzel, damit keine Verwendungsstelle es vergessen kann. Am
// `body`, nicht an `#root`: Menüs und Dialoge hängen sich teils als Portal daneben.
bindeSchmuckSymbole(document.body);

// R-0801: die ANWENDUNG wartet, bis die Startsprache vollständig vorliegt. Für Deutsch ist das
// sofort der Fall (das Wörterbuch liegt im Eintritt). Für eine gespeicherte Wahl en/nl oder einen
// Eintritt mit `?lang=en` wird das Sprachpaket erst nachgeladen — ohne dieses Warten erschiene die
// Oberfläche kurz deutsch und spränge dann um (`lib/htmlLang.ts`: „SOFORT, nicht nach einem
// sichtbaren Umschlag"). Scheitert das Nachladen, erfüllt sich `sprachBereit` trotzdem, und die
// Oberfläche erscheint über `fallbackLng` auf Deutsch, statt gar nicht.
//
// DIE WURZEL WARTET NICHT (ben, Nacharbeit 3, F1): bis hierher lief `createRoot` erst nach
// `sprachBereit`, und `#root` (index.html) blieb so lange LEER — ohne Ladefläche, ohne
// Fehlergrenze. Jetzt steht SOFORT die Ladefläche da. Sie braucht kein Sprachpaket: `i18n.t` fällt
// bei fehlendem Paket über `fallbackLng` auf das deutsche Wörterbuch im Eintritt zurück, und
// `SplashFlaeche` wartet auf keinen Übersetzungshaken. Danach ersetzt dieselbe Wurzel sie durch die
// Anwendung. Gegenprobe: `tests/erstladezeit/startsprache-ladeflaeche.test.tsx`.
const wurzel = createRoot(root);
wurzel.render(<SplashFlaeche text={i18n.t("state.loading")} />);

void sprachBereit.finally(() => {
  bindSpracheSpeichern(i18n);
  // R-1034: die im Betrieb gepflegten Texte über die aktive Sprache legen — erst JETZT, wenn ihr
  // Paket da ist (Begründung im Kopf von `lib/textpflege.ts`). Ein Ausfall lässt die mitgelieferten
  // Texte stehen und hält den Start nicht auf.
  bindTextpflege(i18n, (sprache) => endpoints.i18n.texte(sprache).then((a) => a.texte));
  // FR-I18N-02: die im Betrieb angelegten Sprachen in Kontomenü und Profil wählbar machen und für
  // den nächsten Start merken (`lib/instanzSprachen.ts`). Hält den Start nicht auf.
  void gleicheAngelegteSprachenAb(i18n, endpoints.i18n.sprachen, STANDARD_SPRACHE);
  wurzel.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
});

// PWA (FE-MOB-01): Service Worker nur in Produktion registrieren (im Dev stört er HMR).
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registrierung fehlgeschlagen → App läuft normal online weiter.
    });
  });
}
