// @vitest-environment jsdom
// ================================================================================================
// JOB 2469 · D1 — TV1: DAS STUDIO HAT KEIN EIGENES TITELFELD. GEMESSEN, UND AB JETZT BEWACHT.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. Der Auftrag zu diesem Durchgang ging von einem Satz aus:
// „`KnowledgeInputStudio.tsx` — eigenes Titelfeld". Gemessen an `51dbc9a` trifft er NICHT zu; das
// Studio fuehrt genau ein `<input>`, und das ist der Anhang-Waehler (`type="file"`, :295). Der
// Befund selbst ist damit erledigt — aber er hat eine Luecke sichtbar gemacht, die aelter ist:
//
// ZU DEN FEHLENDEN PFADANGABEN, gleich vorweg: Die TV1-Dateien, auf die sich dieser Waechter
// bezieht, liegen in diesem Basisklon NICHT — sie existieren bisher nur in den Rueckgaben zu
// JOB 2395/2402/2412/2419/2426/2440. Ein ausgeschriebener Testpfad waere hier deshalb die
// Behauptung einer Pruefabdeckung, die es in diesem Baum nicht gibt; `tests/structure/
// testverweise-aufloesbar.test.ts` schlaegt darauf an, und zu Recht. Ich nenne die Zusicherungen
// deshalb bei ihrem NAMEN, nicht bei ihrem Pfad. Kommt TV1 in die Hauptlinie, gehoeren die Pfade
// hier nachgetragen.
//
// In JOB 2426 habe ich `KnowledgeInputStudio` als BEGRUENDETE AUSNAHME vom TV1-Uebernahme-Weg
// bilanziert. Die Begruendung steht im Wortlaut in der Liste `OHNE_UEBERNAHME` (Reichweitentest
// aus JOB 2412) und ruht auf DREI gemessenen Tatsachen:
//
//   1. Das Studio hat kein eigenes Titelfeld — es bearbeitet ausschliesslich `bodyHtml`.
//   2. Es ist eine ueberdeckende Flaeche (`fixed inset-0 z-50`) — das Titelfeld der Elternflaeche
//      ist unsichtbar, solange es offen steht. Ein Uebernehmen-Knopf schriebe also in ein Feld,
//      das der Nutzer im Moment des Klicks nicht sieht.
//   3. Sein einziger Rueckkanal ist `onApply(next: string)` und traegt NUR den Rumpf. Fuer einen
//      Titel gibt es keinen Weg hinaus.
//
// JOB 2440 hat die eine Haelfte der Ausnahme als Verhalten belegt — der Vorschlag bleibt im Studio
// LESBAR, gesichert vom Fall „die Flaeche ohne Uebernahme-Weg". DIESE DREI TATSACHEN WAREN
// WEITERHIN NUR PROSA. Faellt eine von ihnen — und ein Titelfeld einzubauen ist eine naheliegende,
// gutgemeinte Verbesserung —, ist die Ausnahme still nicht mehr gedeckt: TV1 waere wieder offen,
// und nichts im Baum wuerde rot. Genau das soll hier nicht mehr passieren.
//
// DIESE DATEI VERBIETET NICHTS. Sie erzwingt nur, dass die Entscheidung noch einmal getroffen
// wird: Wer dem Studio ein Titelfeld gibt, macht sie rot und muss `OHNE_UEBERNAHME` nachziehen.
// Ein Waechter ueber eine ENTSCHEIDUNG, nicht ueber einen Namen.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { KnowledgeInputStudio } from "../../apps/web/src/components/KnowledgeInputStudio";
// Nur importiert, nicht veraendert — ohne initialisiertes i18n scheitert `useTranslation`.
import "../../apps/web/src/i18n";
import { mitBildbeschreibung } from "../capture/bildbeschreibung-naht";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom kennt `scrollIntoView` nicht; das Studio zieht Bauteile, die es rufen.
Element.prototype.scrollIntoView = function scrollIntoViewStub(): void {
  /* absichtlich leer — hier wird nicht gesprungen, nur gerendert. */
};

type StudioProps = Parameters<typeof KnowledgeInputStudio>[0];

// ── TATSACHE 3, ZUR ÜBERSETZUNGSZEIT ────────────────────────────────────────────────────────────
//
// Dieselbe Bauart wie `tests/capture/mega85-titelvertrag-mounted.test.tsx:37-46`: `@ts-expect-error`
// VERLANGT einen Typfehler. Bekaeme das Studio einen Rueckkanal fuer den Titel, verschwaende der
// Fehler — und dann wird `@ts-expect-error` selbst zum Fehler und das Tor rot.

// Das Studio hat KEINEN Rueckkanal fuer einen Titel. Wer einen einbaut, macht die Anweisung unten
// ueberfluessig — und dann wird SIE zum Fehler und das Tor rot. Dann gehoert die begruendete
// Ausnahme fuer KnowledgeInputStudio in der Liste `OHNE_UEBERNAHME` neu entschieden, statt sie
// stillschweigend falsch werden zu lassen.
//
// ZUR STELLE DER ANWEISUNG, gemessen statt geraten: `@ts-expect-error` deckt GENAU DIE FOLGEZEILE.
// Ueber die Deklaration gesetzt blieb sie ungenutzt (`TS2578`), weil der Fehler erst an der
// unerlaubten Eigenschaft entsteht (`TS2353`). Sie steht deshalb direkt davor.
const studioMitTitelrueckgabe: StudioProps = {
  open: false,
  onClose: () => undefined,
  bodyHtml: "",
  onApply: () => undefined,
  runAssist: async () => "",
  documentTitle: "",
  // @ts-expect-error JOB 2469: ein Titel-Rueckkanal am Studio darf nicht compilieren.
  onTitelVorschlag: () => undefined,
};

/**
 * Und der Rueckkanal selbst: `onApply` traegt GENAU EIN Argument, den Rumpf. Kaeme ein zweites
 * hinzu (etwa ein Titel), traefe der Typ nicht mehr zu und diese Zuweisung faellt.
 */
type ApplyArgumente = Parameters<StudioProps["onApply"]>;
const rueckkanalTraegtNurDenRumpf: ApplyArgumente extends [string] ? true : false = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

/** Wortgleich zur Vorrichtung in `tests/web/d44-knowledge-input-studio-mounted.test.tsx`. */
function studioMounten(): void {
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
                  bodyHtml: "<p>Ein Absatz.</p>",
                  onApply: () => undefined,
                  runAssist: async () => "",
                  documentTitle: "Kegelradgetriebe der Pumpe P-12",
                }),
              ),
            ),
          ),
        ),
      ),
    );
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("JOB 2469 · TV1 — die drei Tatsachen, auf denen die Studio-Ausnahme ruht", () => {
  it("TATSACHE 1: im Studio gibt es kein Feld, in das ein Titel geschrieben werden koennte", () => {
    studioMounten();

    // Nicht „es gibt keinen Prop mit dem Namen Titel" — sondern: die gerenderte Flaeche bietet
    // keine Texteingabe an. Das ist die Aussage, die die Ausnahme traegt.
    const eingaben = Array.from(container.querySelectorAll("input"));
    const texteingaben = eingaben.filter((e) => {
      const art = (e.getAttribute("type") ?? "text").toLowerCase();
      return art !== "file" && art !== "checkbox" && art !== "radio" && art !== "hidden";
    });
    expect(
      texteingaben.map(
        (e) => e.getAttribute("aria-label") ?? e.getAttribute("name") ?? "(ohne Kennzeichnung)",
      ),
      "Das Studio zeigt eine Texteingabe. Fuehrt es jetzt einen Titel, ist die begruendete Ausnahme " +
        "in OHNE_UEBERNAHME (tv1-reichweite-einbindungen.test.tsx) nicht mehr gedeckt — dann muss " +
        "dort neu entschieden werden, ob der Titelvorschlag hier hingehoert.",
    ).toEqual([]);
    expect(container.querySelectorAll("textarea").length, "auch kein Textfeld").toBe(0);

    // Gegenprobe zur Aussagekraft: der Anhang-Waehler IST da. Faende der Test gar keine Eingabe,
    // haette er womoeglich ein leeres Studio gemessen und waere aus dem falschen Grund gruen.
    expect(
      eingaben.filter((e) => e.getAttribute("type") === "file").length,
      "der Anhang-Waehler muss da sein, sonst misst dieser Fall ein leeres Studio",
    ).toBeGreaterThan(0);
  });

  it("TATSACHE 2: das Studio ueberdeckt die Seite — ein Titelfeld der Elternflaeche waere unsichtbar", () => {
    studioMounten();

    // Der Grund, warum ein Uebernehmen-Knopf hier eine Scheinwahl waere: der Nutzer saehe die
    // Wirkung im Moment des Klicks nicht.
    const ueberdeckend = Array.from(container.querySelectorAll("div")).filter((d) => {
      const k = d.className;
      return typeof k === "string" && k.includes("fixed") && k.includes("inset-0");
    });
    expect(
      ueberdeckend.length,
      "Das Studio ist keine ueberdeckende Flaeche mehr. Dann faellt das zweite Argument der " +
        "begruendeten Ausnahme weg und sie gehoert neu entschieden.",
    ).toBeGreaterThan(0);
  });

  it("TATSACHE 3: der Rueckkanal traegt nur den Rumpf (belegt durch @ts-expect-error oben)", () => {
    // Zur Laufzeit sind die beiden Zeugen nur der Beleg, dass die Zeilen oben wirklich uebersetzt
    // und nicht wegoptimiert werden. Die Aussage selbst trifft der Compiler im Tor
    // (`tools/build` -> `tsc -p tsconfig.tests-tsx.json`).
    //
    // ACHTUNG, hier lag mein erster Fehlgriff: Ich hatte `.not.toHaveProperty` geschrieben, wie es
    // `mega85-titelvertrag-mounted.test.tsx:60` tut. Dort ist es richtig, weil jenes Literal den
    // Pflichtprop WEGLAESST. Meines fuegt einen unerlaubten Prop HINZU — zur Laufzeit ist er also
    // da, und nur der Compiler weist ihn zurueck. Der Zeuge muss deshalb das Gegenteil behaupten.
    expect(studioMitTitelrueckgabe).toHaveProperty("onTitelVorschlag");
    expect(rueckkanalTraegtNurDenRumpf).toBe(true);
  });
});
