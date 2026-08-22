// @vitest-environment jsdom
// ================================================================================================
// JOB 1860 · D1 (M-4, Anker D44-GLIEDERUNG) — DER EINBAU IM STUDIO, GEMOUNTET.
// ================================================================================================
//
// BENs Prueflueke 1 zu `1612 D1`, woertlich:
//
//   „`tests/web/d44-knowledge-input-studio-mounted.test.tsx`: Studio mit einem ueber mehrere
//    Viewport-Hoehen langen `bodyHtml` und genau zwei H2 mounten; Leiste muss sichtbar sein,
//    Klick auf Eintrag 2 muss `scrollIntoView` exakt am zweiten H2 ausloesen."
//
// WARUM ES DIESE DATEI BRAUCHT, OBWOHL `d44-sprung-mounted.test.tsx` GRUEN IST: Jener Test
// mountet die Leiste ALLEIN und stellt sich die Editorflaeche selbst hin — ein `<div>` mit der
// Marke und handgesetztem `innerHTML` (`d44-sprung-mounted.test.tsx:61-64`). Damit prueft er die
// Leiste, aber NICHT den Einbau. BEN hat genau das benannt:
//
//   „zudem ist kein Integrationstest des Einbaus im `KnowledgeInputStudio` vorgelegt."
//
// Hier kommt die Editorflaeche deshalb aus dem ECHTEN Studio: `KnowledgeInputStudio` rendert die
// Leiste und den `RichTextEditor` im selben Baum, und der Sprung muss die Ueberschrift treffen,
// die der Editor wirklich gerendert hat. Bricht die Marke, der Ort der Leiste oder die Reihenfolge
// der Ueberschriften, faellt dieser Test — der andere nicht.
//
// ZUR DATEIENDUNG: `.test.tsx`, weil eine `.test.ts` kein JSX uebersetzt (`error TS6142`). Pfad und
// Name sind exakt die von BEN verlangten.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
// AUFTRAG-mega70 BLOCK B (JOB 1973 D2): siehe Begruendung an `studioMounten`.
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { D44_EDITOR_MARKE } from "../../apps/web/src/components/D44Gliederung";
import { KnowledgeInputStudio } from "../../apps/web/src/components/KnowledgeInputStudio";
// Nur importiert, nicht veraendert — ohne initialisiertes i18n scheitert `useTranslation`.
// JOB 1860 D2: jetzt als Wert, damit S3 den erwarteten Text AUS DEM KATALOG holt statt ihn
// abzuschreiben. Ein abgeschriebener Text bestuende auch bei einem falschen Schluessel.
import i18n from "../../apps/web/src/i18n";
import { mitBildbeschreibung } from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom kennt `scrollIntoView` nicht. Das Haus stubbt es; hier wird ein SPY daraus, denn die Frage
// ist nicht „wurde gesprungen", sondern WOHIN — auf welches Element.
const gesprungen: HTMLElement[] = [];
Element.prototype.scrollIntoView = function scrollIntoViewStub(this: HTMLElement): void {
  gesprungen.push(this);
};

/**
 * Ein Dokument ueber mehrere Bildschirmhoehen mit GENAU ZWEI Ueberschriften.
 *
 * 200 Absaetze je Abschnitt: Das ist die „mehrere Viewport-Hoehen" aus BENs Satz. jsdom misst
 * keine Hoehen — die Laenge steht hier, damit der Fall denselben Gegenstand beschreibt wie die
 * Zusage, nicht weil eine Zusicherung sie messen koennte. Gemessen wird der Sprung.
 */
const LANG_MIT_ZWEI = [
  "<h2>Konstruktion</h2>",
  "<p>Absatz</p>".repeat(200),
  "<h2>Pruefung</h2>",
  "<p>Absatz</p>".repeat(200),
].join("");

/**
 * JOB 1860 D2: Dasselbe lange Dokument, nur OHNE jede Ueberschrift.
 *
 * Gleiche Laenge wie `LANG_MIT_ZWEI`, damit sich die zwei Faelle in genau EINEM Merkmal
 * unterscheiden — der Ueberschrift. Ein kurzer Text daneben haette zwei Unterschiede und liesse
 * offen, welcher den Zweig ausloest.
 */
const LANG_OHNE_UEBERSCHRIFT = "<p>Absatz</p>".repeat(400);

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  gesprungen.length = 0;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** Das ECHTE Studio, offen und im Bearbeiten-View (`view` startet auf `"edit"`). */
function studioMounten(bodyHtml: string): void {
  // Die Kontexte, die das Studio ueber seine Unterbauteile zieht — jeder gemessen, alle aus dem
  // Hausmuster (`tests/capture/mega17-quellen-hinweis-mounted.test.tsx:100-113`):
  //   ohne QueryClient  -> „No QueryClient set, use QueryClientProvider to set one"
  //   ohne Router       -> „Cannot destructure property 'basename' … as it is null"
  //   ohne RoleProvider -> „useRole muss innerhalb von <RoleProvider> verwendet werden."
  //   ohne AuthProvider -> „useSession muss innerhalb von <AuthProvider> verwendet werden."
  // AUFTRAG-mega70 BLOCK B (JOB 1973 D2): die letzten beiden sind NEU und der Preis einer
  // Produktverbesserung — `PublicAiEnrichPanel` zeigt seinen Regler-Hinweis auf `/admin` jetzt
  // ueber `RoleLink`. In der Anwendung liegen beide Provider ohnehin ueber allem (`App.tsx`);
  // dieser Pruefstand montiert das Bauteil einzeln und muss sie deshalb selbst stellen.
  // KEINE Zusicherung wird dadurch weicher: die drei Faelle pruefen dieselben Aussagen.
  // `retry: false`, damit kein Fall auf einen Wiederholungslauf wartet.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  act(() => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              MemoryRouter,
              { initialEntries: ["/erfassen"] },
              mitBildbeschreibung(
                createElement(KnowledgeInputStudio, {
                  open: true,
                  onClose: () => undefined,
                  bodyHtml,
                  onApply: () => undefined,
                  runAssist: async () => "",
                  documentTitle: "Wartungsnotiz",
                }),
              ),
            ),
          ),
        ),
      ),
    );
  });
}

describe("D44 · der Einbau im KnowledgeInputStudio, gemountet", () => {
  it("S1 · ein langes bodyHtml mit genau zwei H2 zeigt die Leiste IM STUDIO", () => {
    studioMounten(LANG_MIT_ZWEI);

    // Die Editorflaeche kommt aus dem Studio, nicht aus diesem Test — das ist der Unterschied.
    const flaeche = container.querySelector(`[${D44_EDITOR_MARKE}]`);
    expect(flaeche, "das Studio traegt die Editormarke nicht — der Einbau fehlt").not.toBeNull();

    const leiste = container.querySelector('[data-testid="d44-gliederung"]');
    expect(leiste, "die Leiste erscheint im Studio nicht").not.toBeNull();

    // Genau zwei Eintraege — einer je H2, keine erfundenen.
    expect(container.querySelectorAll('[data-testid^="d44-sprung-"]')).toHaveLength(2);

    // Und die Leiste steht VOR der Editorflaeche im Baum, nicht darin. Die beiden Werte werden
    // vorher aus dem Optionaltyp geholt, sonst scheitert der Typecheck an `&` (TS2532, gemessen).
    if (leiste === null || flaeche === null) throw new Error("unerreichbar: oben schon geprueft");
    expect(
      leiste.compareDocumentPosition(flaeche) & Node.DOCUMENT_POSITION_FOLLOWING,
      "die Leiste steht nicht vor der Editorflaeche",
    ).toBeTruthy();
  });

  it("S2 · Klick auf Eintrag 2 loest scrollIntoView am ZWEITEN H2 des Studios aus", () => {
    studioMounten(LANG_MIT_ZWEI);

    const knopf = container.querySelector<HTMLButtonElement>('[data-testid="d44-sprung-1"]');
    expect(knopf, "kein Knopf fuer den zweiten Eintrag").not.toBeNull();

    act(() => knopf?.click());

    // Die Ueberschriften, die der ECHTE Editor gerendert hat — nicht die aus einer Testvorlage.
    const flaeche = container.querySelector<HTMLElement>(`[${D44_EDITOR_MARKE}]`);
    const ueberschriften = flaeche?.querySelectorAll<HTMLElement>("h2, h3");
    expect(ueberschriften, "der Editor hat keine Ueberschriften gerendert").toBeDefined();
    expect(ueberschriften).toHaveLength(2);

    // `toBe` und nicht `toEqual`: es geht um Elementidentitaet, nicht um gleichen Text.
    expect(gesprungen, "es wurde nicht genau einmal gesprungen").toHaveLength(1);
    expect(gesprungen[0]).toBe(ueberschriften?.[1]);
    expect(gesprungen[0]?.textContent).toBe("Pruefung");
  });

  // ==============================================================================================
  // JOB 1860 · D2 — DER NULL-H2-ZWEIG. BENs Auflage, woertlich:
  //
  //   „`studio.d44.keineUeberschriften` im Null-H2-Zweig von `D44Gliederung.tsx` SICHTBAR
  //    verwenden und den konkreten Mounted-Test samt fallender Gegenmutation vorlegen."
  //
  // Gemessen wird am ECHTEN Studio, nicht an der Leiste allein: dasselbe lange bodyHtml wie oben,
  // nur OHNE Ueberschrift. Was der Zweig zeigt, muss der Text aus dem Katalog sein — deshalb wird
  // er hier aus `i18n` geholt und nicht abgeschrieben. Ein abgeschriebener Text bestuende auch
  // dann, wenn das Bauteil einen ganz anderen Schluessel raushaengte.
  // ==============================================================================================
  it("S3 · ohne Ueberschrift zeigt das Studio den Schluessel keineUeberschriften", () => {
    studioMounten(LANG_OHNE_UEBERSCHRIFT);

    // Der Einbau steht — sonst misst dieser Fall das Fehlen des Studios statt des Zweigs.
    expect(
      container.querySelector(`[${D44_EDITOR_MARKE}]`),
      "das Studio traegt die Editormarke nicht — der Einbau fehlt",
    ).not.toBeNull();

    const hinweis = container.querySelector('[data-testid="d44-keine-ueberschriften"]');
    expect(hinweis, "der Null-H2-Zweig zeigt nichts an").not.toBeNull();
    expect(hinweis?.textContent, "der Hinweis traegt nicht den Text des Schluessels").toBe(
      i18n.t("studio.d44.keineUeberschriften"),
    );
    expect(hinweis?.textContent?.trim().length, "der Hinweis ist leer").toBeGreaterThan(0);

    // Und die Gliederungsleiste bleibt weg: es gibt nichts anzuspringen. Diese Zusage stammt aus
    // `d44-sprung-mounted.test.tsx` M5 und wird hier am Studio mitgehalten, nicht ersetzt.
    expect(
      container.querySelector('[data-testid="d44-gliederung"]'),
      "ohne Ueberschrift darf keine Sprungleiste stehen",
    ).toBeNull();
    expect(container.querySelectorAll('[data-testid^="d44-sprung-"]')).toHaveLength(0);
  });
});
