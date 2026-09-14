// ================================================================================================
// JOB 3475 · UX-28 — DIE EINE VORRICHTUNG FÜR DIE DREI GEMOUNTETEN FÄLLE.
// ================================================================================================
//
// WARUM EINE gemeinsame Vorrichtung und nicht dreimal derselbe Aufbau: die drei gemounteten Fälle
// (Tastaturweg, fehlender Inhalt, Rückweg) brauchen denselben Abschnitt mit denselben Fassungen.
// Stünde der Aufbau dreimal als Literal da, wären es über kurz oder lang drei verschiedene Flächen
// — dieselbe Begründung, mit der `AbschnittNachladen` (JOB 3430) zu EINER Bauform wurde.
//
// BAUFORM ÜBERNOMMEN aus `tests/q1c-nachladen/mehr-abschnitte-holen-nach.test.tsx` (JOB 3430):
// echte `useQuery`-Abrufe gegen einen echten `QueryClient`, nur das „Netz" darunter
// (`api/endpoints`) ist ein Doppel (`./netz.ts`). Gemountet wird `MehrAbschnitte` mit den Anbietern,
// die die Lesefläche darum legt — der Abschnitt „Schnappschüsse" ist der Gegenstand.
//
// WAS DIESE VORRICHTUNG MESSEN KANN UND WAS NICHT (Lehre LEHREN.md:1980, Korrekturpflicht Codex an
// JOB 3420 R2): jsdom kennt KEINE Tabulator-Taste und setzt die Eingabetaste NICHT in ein
// Klick-Ereignis um. Gemessen wird deshalb, was in jsdom wirklich messbar ist: die
// Tabulator-Reihenfolge als Menge der fokussierbaren Elemente in DOM-Reihenfolge, der Fokus über
// `document.activeElement` und die AUSLÖSUNG über das Klick-Ereignis (das ein Browser an einem
// nativen `<button>` aus Eingabe- UND Leertaste erzeugt). Keine Behauptung über die Taste selbst.
//
// JOB 3865 · DER ABBAU FRAGT ZUERST, OB ES ETWAS ABZUBAUEN GIBT — und zwar am ZUSTAND, nicht am
// Fehler. Bis hierher räumte `abbauen()` bedingungslos (`act(() => root.unmount()); …`), obwohl
// `container`, `root` und `qc` ihren Wert ERST in `flaecheMitFassungen()` bekommen. Ein Fall, der
// vor dem Aufbau fiel, lief trotzdem in den gemeinsamen `afterEach` dieses Ordners — und der warf
// dort `TypeError: Cannot read properties of undefined (reading 'unmount')`. Die ECHTE Ursache
// stand damit nicht mehr in der Ausgabe, und eine Gegenprobe per `-t "<name>"` war an dieser Stelle
// nicht mehr belastbar. Gemessen an einem gestellten Fall vor dem Umbau: zwei Fehler statt einem,
// der zweite aus `flaeche.tsx:108`, nicht aus dem Fall.
//
// DIE DREI LAGEN, jede einzeln festgenagelt (`aenderungsangabe-an-der-karte.test.tsx`, Abschnitt U):
//   nie aufgebaut / schon abgebaut → folgenlos, der `body` bleibt unangetastet      (U1, U2)
//   aufgebaut                      → vollständig geräumt, samt `qc.clear()`         (jeder Fall)
//   Abbau scheitert wirklich       → Wurf mit Grund, nichts verschluckt — und zwar an
//                                    JEDEM der drei Handgriffe einzeln (JOB 3883)   (U3, U4, U5)
// Eine vierte Lage gibt es nicht. `try { … } catch {}` um den Rumpf ist ausdrücklich NICHT der Weg:
// es machte jeden künftigen Abbaufehler unsichtbar und diesen Ordner, der gegen Falschaussagen
// antritt, in seiner eigenen Vorrichtung unehrlich.
//
// WARUM DAS KENNZEICHEN VOR DEM RENDERN GESETZT WIRD: ab `document.body.appendChild(container)` und
// `root = createRoot(container)` hängt der Behälter wirklich im Dokument. Wirft das Rendern danach,
// ist der gemeinsame `afterEach` der Einzige, der ihn noch wegräumt — stünde das Kennzeichen erst
// hinter dem Rendern, bliebe genau dann ein Behälter im `body` liegen und der nächste Fall erbte ihn.
//
// SEINE EINE GRENZE: `montiert` ist Modulzustand und gilt deshalb je Testdatei — ein Fall, der die
// Fläche in einem `beforeAll` aufbaute, wäre davon nicht gedeckt. JOB 3883 hat diese Lage hergestellt
// und GEMESSEN, statt sie weiter zu behaupten (U6 in `aenderungsangabe-an-der-karte.test.tsx`): der
// gemeinsame `afterEach` eines solchen Ordners räumt die im `beforeAll` aufgebaute Fläche nach dem
// ERSTEN Fall ab und setzt `montiert` auf `false`; jeder weitere Fall läuft danach gegen einen leeren
// `body`, und sein `abbauen()` kehrt STILL zurück (`:156-158`) — die Vorrichtung sagt kein Wort dazu.
// Ein Ordner, der so aufbaut, misst ab dem zweiten Fall an einer Fläche, die nicht mehr da ist.
// Im Ordner baut heute kein Fall so auf (ausser U6 selbst, der genau das festnagelt); ob `abbauen()`
// diese Lage künftig selbst melden soll, ist gemeldet und nicht gebaut (JOB 3883 §10).
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { MehrAbschnitte } from "../../apps/web/src/components/bibliothek/MehrAbschnitte";
import i18n from "../../apps/web/src/i18n";
import { ko } from "./netz";

/** Der Abschnittsschlüssel — Sollwert als Literal, nicht aus dem Produkt geholt. */
export const FASSUNGEN = "schnappschuesse";
/** Die Marke der Fassungskarte, über die der Test sie findet — ebenfalls Sollwert. */
export const FASSUNG_MARKE = "data-bib-fassung";
/** Die Marke des geöffneten Inhalts einer Fassung. */
export const INHALT_MARKE = "data-bib-fassung-inhalt";
/** Die Marke des Rückwegs aus einer geöffneten Fassung. */
export const RUECKWEG_MARKE = "data-bib-fassung-zurueck";

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let qc: QueryClient;
/**
 * JOB 3865: STEHT GERADE EINE FLÄCHE DIESER VORRICHTUNG IM DOKUMENT? Der einzige Zustand, an dem
 * `abbauen()` unten entscheidet, ob es überhaupt etwas zu tun gibt (Begründung im Dateikopf).
 *
 * Er ist KEIN zweiter Abbauweg: er beantwortet eine Frage, er räumt nichts.
 */
let montiert = false;

export const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

/** Die Fläche aufbauen und den Abschnitt „Schnappschüsse" öffnen — der Ort, um den es geht. */
export async function flaecheMitFassungen(): Promise<void> {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Element.prototype.scrollIntoView = () => {};
  await i18n.changeLanguage("de");
  qc = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
        refetchOnWindowFocus: false,
      },
    },
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  // AB HIER gibt es etwas abzubauen — bewusst VOR dem Rendern (Dateikopf): der Behälter hängt schon
  // im `body`, und wirft das Rendern gleich, ist der gemeinsame `afterEach` der Einzige, der ihn
  // noch wegräumt. Ein zweites `flaecheMitFassungen()` im selben Fall setzt ihn hier neu.
  montiert = true;
  await act(async () => {
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
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/wissen/ko-1"] },
                  createElement(MehrAbschnitte, { ko: ko() }),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  await act(flush);
  await abschnittOeffnen();
}

/**
 * Die Fläche abbauen — gehört in jedes `afterEach` dieses Ordners und vor jeden zweiten Aufbau im
 * selben Fall. Die drei Lagen und ihre Fälle stehen im Dateikopf.
 */
export function abbauen(): void {
  if (!montiert) {
    return;
  }
  // Sagt der Zustand „montiert", muss der Behälter auch wirklich im Dokument hängen. Tut er das
  // nicht, LÜGT der Zustand — und das ist ein echter Befund, kein Grund zum Weitermachen: entweder
  // lief `abbauen()` zweimal auf dieselbe Fläche, ohne sich zurückzusetzen, oder der Behälter wurde
  // an dieser Vorrichtung vorbei entfernt. Die Meldung nennt, was GEMESSEN wurde, nicht den Sollwert.
  if (!container.isConnected) {
    throw new Error(
      `flaeche.tsx: abbauen() steht auf „montiert", aber der Behälter hängt nicht im Dokument (body-Kinder: ${document.body.childElementCount}, Behälter-Kinder: ${container.childElementCount}) — abbauen() lief zweimal auf dieselbe Fläche, oder der Behälter wurde an flaeche.tsx vorbei entfernt`,
    );
  }
  act(() => root.unmount());
  container.remove();
  // `qc.clear()` ist der DRITTE Handgriff dieser Vorrichtung (die Schwesterhülle
  // `tests/entwurf-verlassen/huelle.tsx` hat ihn nicht, sie legt ihren `QueryClient` im Baum an).
  // Er steht hinter dem Abbau des Baums: solange React noch abräumt, laufen die `useQuery`-Abrufe
  // dieses Clients — erst danach ist sein Zwischenspeicher folgenlos zu leeren.
  qc.clear();
  // Erst NACH dem gelungenen Abbau. Wirft eine der DREI Zeilen darüber, bleibt der Zustand auf
  // „montiert" stehen — und JOB 3883 hat für jede der drei einen Fall, der sie einzeln wirft und
  // MISST, was der `afterEach` danach wirklich vorfindet. Die Zusage trägt für zwei der drei Zeilen,
  // und für die dritte steht hier das Gemessene und nicht mehr die Zusage:
  //
  //   Zeile              wirft in       Behälter danach   zweiter Aufruf (`afterEach`)        Fall
  //   `root.unmount()`   der Baumphase  hängt im Dokument räumt wirklich ab                   U3
  //   `container.remove()` Behälterphase hängt im Dokument räumt wirklich ab                  U4
  //   `qc.clear()`       Speicherphase  ist schon FORT    WIRFT, mit falsch benannter Ursache U5
  //
  // Für `qc.clear()` gilt der zweite Halbsatz also NICHT: der Behälter ist hier bereits entfernt,
  // `container.isConnected` ist falsch, und der zweite Aufruf läuft in die Meldung `:163-167` — die
  // zwei Ursachen nennt, von denen KEINE zutrifft („zweimal auf dieselbe Fläche" / „an flaeche.tsx
  // vorbei entfernt"), obwohl in Wahrheit flaeche.tsx selbst entfernt und danach gestolpert ist.
  // U5 nagelt diesen Befund samt Meldungstext fest. Repariert wird er hier bewusst NICHT (JOB 3883
  // §10: eine Verhaltensänderung an `abbauen()` braucht ihre eigene Zeile) — er ist gemeldet.
  montiert = false;
}

export const abschnitt = (): HTMLDetailsElement | null =>
  container.querySelector<HTMLDetailsElement>(`[data-bib-abschnitt="${FASSUNGEN}"]`);

export const text = (e: Element | null): string =>
  (e?.textContent ?? "").replace(/\s+/g, " ").trim();

/** Den Abschnitt von Hand aufklappen — der Weg, den ein Mensch am `<summary>` geht. */
export async function abschnittOeffnen(): Promise<void> {
  const d = abschnitt();
  if (!d) {
    throw new Error(`Abschnitt „${FASSUNGEN}" fehlt auf der Fläche`);
  }
  await act(async () => {
    d.open = true;
    // jsdom stellt `toggle` in die Warteschlange, statt es sofort zu liefern; es steigt nicht auf.
    d.dispatchEvent(new Event("toggle"));
    await flush();
  });
  await act(flush);
}

/**
 * AUSLÖSEN — das Ereignis, das ein Browser an einem nativen `<button>` aus Maus, Eingabe- UND
 * Leertaste erzeugt. Was jsdom daran nicht leistet (die Umsetzung der Taste in dieses Ereignis),
 * behauptet kein Fall dieser Datei.
 */
export async function ausloesen(ziel: HTMLElement): Promise<void> {
  await act(async () => {
    ziel.click();
    await flush();
  });
  await act(flush);
}

/** Die Fassungskarten des Abschnitts, in der Reihenfolge der Fläche. */
export function fassungsKnoepfe(): HTMLButtonElement[] {
  return [...(abschnitt()?.querySelectorAll<HTMLElement>(`[${FASSUNG_MARKE}]`) ?? [])].filter(
    (e): e is HTMLButtonElement => e instanceof HTMLButtonElement,
  );
}

/** Der Knopf EINER Fassung. Fehlt er, sagt der Fehler, was fehlt. */
export function fassungsKnopf(version: number): HTMLButtonElement {
  const marke = `ko-1:${version}`;
  const treffer = fassungsKnoepfe().find((k) => k.getAttribute(FASSUNG_MARKE) === marke);
  if (!treffer) {
    const gefunden = [
      ...(abschnitt()?.querySelectorAll<HTMLElement>(`[${FASSUNG_MARKE}]`) ?? []),
    ].map((e) => `${e.tagName}:${e.getAttribute(FASSUNG_MARKE)}`);
    throw new Error(
      `Die Fassung v${version} ist nicht als fokussierbarer Knopf erreichbar (${FASSUNG_MARKE}="${marke}"). Gefunden: ${JSON.stringify(gefunden)}`,
    );
  }
  return treffer;
}

/** Der geöffnete Inhalt einer Fassung — `null`, solange sie zu ist. */
export function fassungsInhalt(version: number): HTMLElement | null {
  return abschnitt()?.querySelector<HTMLElement>(`[${INHALT_MARKE}="ko-1:${version}"]`) ?? null;
}

/** Der Rückweg aus der geöffneten Fassung — `null`, solange sie zu ist. */
export function rueckweg(version: number): HTMLButtonElement | null {
  const treffer =
    abschnitt()?.querySelector<HTMLElement>(`[${RUECKWEG_MARKE}="ko-1:${version}"]`) ?? null;
  return treffer instanceof HTMLButtonElement ? treffer : null;
}

/**
 * Die Elemente, die ein Tabulator innerhalb des Abschnitts erreicht: in DOM-Reihenfolge, ohne die
 * ausgenommenen (`tabIndex < 0`) und ohne die echt gesperrten (`disabled` fällt aus der Folge).
 * Das ist die messbare Form der Frage „überspringt der Tabulator die Karten?".
 */
export function tabFolge(): HTMLElement[] {
  const d = abschnitt();
  if (!d) {
    return [];
  }
  const kandidaten = [
    ...d.querySelectorAll<HTMLElement>(
      'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"]',
    ),
  ];
  return kandidaten.filter(
    (e) => e.tabIndex >= 0 && !(e instanceof HTMLButtonElement && e.disabled),
  );
}

export { i18n };
