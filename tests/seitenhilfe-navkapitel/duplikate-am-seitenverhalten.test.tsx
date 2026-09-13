// @vitest-environment jsdom
// ================================================================================================
// JOB 3804 — DAS SIEBTE UND LETZTE KAPITEL WIRD AM VERHALTEN SEINER SEITE BELEGT: `/duplikate`.
// ================================================================================================
//
// DIE BESTELLUNG (`archiv/3741/runde-4/RUECKGABE.md:94`, woertlich): die sieben Kapitel `/extern`,
// `/konflikte`, `/duplikate`, `/analytics`, `/output`, `/graph`, `/hilfe` tragen „Zuordnungs-,
// Uebersetzungs-, DOM- und Suchbeleg, aber KEINEN gemounteten Verhaltensbeleg ihrer jeweiligen
// Seite — ein eigener Schnitt je Seite". Sechs sind vergeben (JOB 3795, JOB 3796); `/duplikate` ist
// das siebte und letzte.
//
// DIE BAUFORM ist die der beiden Geschwister und ihres Vorbilds
// `die-texte-stimmen-mit-der-seite.test.tsx`: je Behauptung stehen ZWEI Dinge nebeneinander — das
// gemessene Verhalten der GEMOUNTETEN Seite UND der Satz, der es beschreibt. Der Satz wird aus dem
// heutigen Bestand GELESEN (`behauptung()` unten), nicht abgeschrieben; faellt eine Behauptung aus
// dem Kapitel, wird GENAU ihr Fall rot und nennt Route und Behauptung (Lehre JOB 3587 R4: ein
// Mengenwaechter, der Einzelentfernungen nicht bemerkt, ist kein Waechter).
//
// WAS DIESE DATEI NICHT WIEDERHOLT:
//   · `zahnrad-zeigt-den-erklaersatz.test.tsx` belegt, dass Titel und Text der Route im Zahnrad
//     STEHEN. Hier wird die SEITE montiert und gemessen, ob der Text STIMMT.
//   · `tests/seitenhilfe-dubletten/seitenhilfe-dubletten.test.tsx` (JOB 3671/3771) haelt den
//     WORTLAUT der vier Dubletten-Texte gegen Verbotslisten. Neu ist hier allein die Bindung des
//     KAPITELS `help.duplikate.body` an das gemessene Verhalten — dieses Kapitel hat 3771
//     ausdruecklich NICHT angefasst, es lag ausserhalb seiner Zielpfade.
//   · Die Routen- und Kapitelrechnung (`app/navigation.ts` × `HELP_TOPICS`) steht nebenan und wird
//     hier nicht ein zweites Mal erhoben; die Zuordnung kommt aus `navHilfeFor` (der EINEN Stelle).
//
// ZWEI SAETZE STIMMEN NICHT — sie werden gemessen und als NACHFUEHR-PIN festgehalten, NICHT
// repariert (`i18n.ts` ist in diesem Takt von JOB 3761/3762/3786 gehalten):
//   DU4b        der geschlossene Fund faellt aus dem Abruf — „geloescht wird nichts" sieht fuer
//               einen Neuling genau so aus wie geloescht (Fehlertyp wie JOB 3795, REST Punkt 2).
//   DU5c/d/e    „ob beide bleiben und VERKNUEPFT WERDEN" — die drei ANDEREN Hilfetexte derselben
//               Flaeche verneinen genau das, und zwei davon stehen im Zahnrad untereinander.
// Sie sind HEUTE GRUEN (sie pinnen das gemessene Verhalten) und werden rot, sobald der Text
// nachgefuehrt ist; ihre Fehlermeldung nennt die Nachfuehrung woertlich.
//
// RUNDE 2 (bens Korrekturpflichten zu Runde 1): jeder der FUENF Hilfeschluessel dieser Flaeche hat
// jetzt seinen EIGENEN Fall (DU5a–DU5e, s. dort), und die Nachher-Ablesung in DU3b haengt an einem
// nachweislich ERFOLGREICH ABGESCHLOSSENEN Abruf nach der Entscheidung — kalibriert von DU3d
// (verzoegerte Antwort) und DU3e (ausbleibende Antwort).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ------------------------------------------------------------------------------------------------
// Der Stand „auf der Serverseite" — EINE Ablage, in die die Entscheidung wirklich schreibt und aus
// der derselbe Abruf danach neu ausliest. Nur so ist „vorher"/„nachher" das Ergebnis einer
// AUSGEFUEHRTEN Operation und nicht zweier im Test ausgeschriebener Listen (Lehre 3741 R3).
// ------------------------------------------------------------------------------------------------
const d = vi.hoisted(() => {
  type Satz = Record<string, unknown>;
  const s: {
    kos: Satz[];
    duplikate: Satz[];
    /** Der Listenabruf scheitert (fuer den Erstfehler-Fall DU6b). */
    fehler: boolean;
    /**
     * Liefert der Listenabruf AUCH geschlossene Eintraege aus?
     *
     * Der echte Weg tut das NICHT: `GET /api/duplicates` gibt `overlaps.unresolved()` aus
     * (`services/app/src/routes/overlap-routes.ts:54`), und `unresolved()` filtert hart auf
     * `status !== "geschlossen"` (`services/conflicts/src/overlap-service.ts:933`). Der Schalter
     * steht deshalb standardmaessig auf `false` und wird NUR von DU3c gesetzt — dort ausdruecklich
     * benannt als ein Abruf, den der echte Weg nicht liefert.
     */
    liefereGeschlossene: boolean;
    /** Der OBJEKTabruf scheitert — die AUSBLEIBENDE Antwort der Kalibrierung DU3e. */
    koFehler: boolean;
    /** Der OBJEKTabruf haengt, bis `loeseKoBremse()` ihn freigibt — die VERZOEGERTE Antwort DU3d. */
    koBremse: boolean;
  } = {
    kos: [],
    duplikate: [],
    fehler: false,
    liefereGeschlossene: false,
    koFehler: false,
    koBremse: false,
  };
  /**
   * BEGONNENE und ERFOLGREICH ABGESCHLOSSENE Abrufe, getrennt gezaehlt (bens Korrekturpflicht 2,
   * Runde 1).
   *
   * WARUM ZWEI ZAHLEN UND NICHT `mock.calls.length`: react-query behaelt bei einer gescheiterten
   * oder noch laufenden AUFFRISCHUNG die zuletzt erfolgreich geholten Daten (Regelwerk §7, und so
   * baut es `flaechenZustand` in `components/pruefen/zaehler.ts:143-146` auch ausdruecklich). Eine
   * „nachher"-Ablesung des DOM kann darum der ALTE Zwischenspeicher sein. Dass ein Abruf BEGONNEN
   * hat, sagt darueber nichts; nur `koFertig` sagt „es liegt eine frische, erfolgreiche Antwort
   * vor". DU3b haengt seinen Vergleich an DIESE Zahl, DU3d/DU3e kalibrieren, dass sie wirklich
   * stehen bleiben kann.
   */
  const z = { koStart: 0, koFertig: 0, dupStart: 0, dupFertig: 0 };
  /** Die angehaltenen Objektabrufe der Bremse — `loeseKoBremse()` gibt sie frei. */
  const wartende: Array<() => void> = [];
  const kopie = (l: readonly Satz[]): Satz[] => l.map((x) => ({ ...x }));

  /**
   * `close()` des Dienstes (`overlap-service.ts:732-749`): Status, Abschlussgrund mit Vermerk und
   * Abschlusszeit — und NICHTS sonst. Kein Wissensobjekt wird angefasst, keines geloescht, keine
   * Verknuepfung angelegt.
   */
  const schliesse = (id: string, reason: string, note: string | null): Satz => {
    const treffer = s.duplikate.find((e) => e.id === id);
    if (!treffer) {
      throw new Error(`Pruefstand: kein Ueberschneidungsbefund ${id}`);
    }
    treffer.status = "geschlossen";
    treffer.resolution = { reason, by: "u1", note, at: "2026-09-12T10:00:00.000Z" };
    treffer.closedAt = "2026-09-12T10:00:00.000Z";
    return { ...treffer };
  };

  return {
    /**
     * Den Stand setzen — die Saetze werden dabei KOPIERT. Ohne diese Kopie hielte die Ablage
     * dieselben Objekte, die oben als Vorlagen stehen, und die ausgefuehrte Entscheidung eines
     * Falles (`schliesse`) veraenderte die Vorlage des naechsten: eine Reihenfolgen-Abhaengigkeit,
     * die je nach Lauf einen anderen Fall rot macht. Gemessen, nicht vermutet — genau das ist beim
     * ersten Lauf dieser Datei passiert (DU4a/DU4b/DU5c standen vor einem schon geschlossenen Fund).
     */
    setze: (teil: Partial<typeof s>): void => {
      for (const frei of wartende.splice(0)) {
        frei();
      }
      Object.assign(
        s,
        {
          kos: [],
          duplikate: [],
          fehler: false,
          liefereGeschlossene: false,
          koFehler: false,
          koBremse: false,
        },
        teil,
        {
          ...(teil.kos ? { kos: kopie(teil.kos) } : {}),
          ...(teil.duplikate ? { duplikate: kopie(teil.duplikate) } : {}),
        },
      );
      Object.assign(z, { koStart: 0, koFertig: 0, dupStart: 0, dupFertig: 0 });
    },
    lies: (): { kos: Satz[]; duplikate: Satz[] } => ({
      kos: kopie(s.kos),
      duplikate: kopie(s.duplikate),
    }),
    /** Der Zaehlerstand der Abrufe — begonnen und erfolgreich abgeschlossen (s. `z` oben). */
    abrufe: (): typeof z => ({ ...z }),
    /** Ab jetzt haengt jeder Objektabruf, bis `loeseKoBremse()` ihn freigibt. */
    bremseKo: (): void => {
      s.koBremse = true;
    },
    /** Gibt die angehaltenen Objektabrufe frei und nimmt die Bremse heraus. */
    loeseKoBremse: (): number => {
      s.koBremse = false;
      const frei = wartende.splice(0);
      for (const f of frei) {
        f();
      }
      return frei.length;
    },
    /** Ab jetzt scheitert jeder Objektabruf. */
    lasseKoScheitern: (): void => {
      s.koFehler = true;
    },
    /** `GET /api/kos` — der Bestand, ungefiltert. */
    koListe: vi.fn(async (): Promise<Satz[]> => {
      z.koStart += 1;
      if (s.koBremse) {
        await new Promise<void>((frei) => {
          wartende.push(frei);
        });
      }
      if (s.koFehler) {
        throw new Error("Pruefstand: der Abruf der Wissensobjekte ist gescheitert");
      }
      const ausgabe = kopie(s.kos);
      z.koFertig += 1;
      return ausgabe;
    }),
    /** `GET /api/duplicates` — `unresolved()`, also ohne die geschlossenen (s. oben). */
    dupListe: vi.fn(async () => {
      z.dupStart += 1;
      if (s.fehler) {
        throw new Error("Pruefstand: der Abruf der Ueberschneidungen ist gescheitert");
      }
      const ausgabe = kopie(s.duplikate).filter(
        (e) => s.liefereGeschlossene || e.status !== "geschlossen",
      );
      z.dupFertig += 1;
      return ausgabe;
    }),
    /** `POST /api/duplicates/:id/link-related`. */
    linkRelated: vi.fn(async (id: string, note?: string) =>
      schliesse(id, "linked_related", note ?? null),
    ),
    /** `POST /api/duplicates/:id/keep-separate`. */
    keepSeparate: vi.fn(async (id: string, note?: string) =>
      schliesse(id, "kept_separate", note ?? null),
    ),
    /** `POST /api/duplicates/:id/dismiss`. */
    dismiss: vi.fn(async (id: string, note?: string) => schliesse(id, "dismissed", note ?? null)),
  };
});

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  // Alles, was diese Faelle NICHT messen, antwortet leer — aber es antwortet. Ohne den Rueckfall
  // stuerzte der Reiterkopf an der ersten unbekannten Ecke ab, und der Fall maesse nichts.
  const leer = (): unknown =>
    new Proxy(
      vi.fn(async () => []),
      {
        get(ziel, name, empfaenger) {
          if (name in ziel || typeof name === "symbol") {
            return Reflect.get(ziel, name, empfaenger);
          }
          return leer();
        },
      },
    );
  const mit = (echt: Record<string, unknown>): unknown =>
    new Proxy(echt, {
      get(ziel, name, empfaenger) {
        if (name in ziel || typeof name === "symbol") {
          return Reflect.get(ziel, name, empfaenger);
        }
        return leer();
      },
    });
  return {
    endpoints: mit({
      ko: mit({ list: d.koListe }),
      duplicates: mit({
        list: d.dupListe,
        linkRelated: d.linkRelated,
        keepSeparate: d.keepSeparate,
        dismiss: d.dismiss,
      }),
      // Der KI-Deckel-Vorbehalt im „?"-Menue liest ein OBJEKT, keine Liste.
      aiCheck: mit({
        coverageSummary: vi.fn(async () => ({
          total: 2,
          incomplete: 0,
          unchecked: 0,
          noCoverage: 0,
        })),
      }),
    }),
  };
});

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import type { OverlapEntry } from "../../apps/web/src/api/types";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { canClose } from "../../apps/web/src/lib/duplicateBoard";
import { navHilfeFor } from "../../apps/web/src/lib/navHilfe";
import { Duplicates } from "../../apps/web/src/pages/Duplicates";
import { AppShell } from "../../apps/web/src/shell/AppShell";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const ROUTE = "/duplikate";
const SPRACHEN = ["de", "en", "nl"] as const;

/** Der hinterlegte Wert EINER Sprache, ohne Rueckfall auf Deutsch. */
function wert(key: string, lng: (typeof SPRACHEN)[number] = "de"): string {
  return String(i18n.getResource(lng, "translation", key) ?? "");
}

/** Das Kapitel dieser Route — aus `navHilfeFor`, der EINEN Zuordnungsstelle (`lib/navHilfe.ts:54`). */
function kapitelSchluessel(): { titleKey: string; bodyKey: string } {
  const hilfe = navHilfeFor(ROUTE);
  if (!hilfe) {
    throw new Error(`${ROUTE} hat kein Hilfekapitel mehr — diese Datei misst dann nichts`);
  }
  return hilfe;
}

/** Der Kapiteltext, wie er HEUTE hinterlegt ist. */
function kapitel(lng: (typeof SPRACHEN)[number] = "de"): string {
  return wert(kapitelSchluessel().bodyKey, lng);
}

/**
 * Die Behauptung, die dieser Fall am Seitenverhalten misst — sie muss woertlich im heutigen
 * Kapiteltext stehen. Faellt sie dort weg, wird GENAU dieser Fall rot und nennt Route und
 * Behauptung; ein Fall, dessen Satz gar nicht mehr da ist, misst nichts mehr.
 */
function behauptung(satzteil: string): void {
  expect(
    kapitel(),
    `${ROUTE}: die Behauptung „${satzteil}“ steht nicht mehr in ${kapitelSchluessel().bodyKey} — dieser Fall misst sie am Seitenverhalten und misst ohne sie nichts`,
  ).toContain(satzteil);
}

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
let steht = false;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

function abbauen(): void {
  if (!steht) {
    return;
  }
  act(() => root.unmount());
  container.remove();
  steht = false;
}

async function rendere(inhalt: unknown): Promise<void> {
  abbauen();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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
                createElement(MemoryRouter, { initialEntries: [ROUTE] }, inhalt as never),
              ),
            ),
          ),
        ),
      ),
    );
    await flush();
  });
  // Zwei Durchlaeufe: `/auth/me` wird erst nach erfolgreichem `/auth/status` freigegeben.
  await act(flush);
  await act(flush);
  steht = true;
}

/** Die ECHTE Seite — Attrappe ist allein die Endpunktgrenze. */
const montiere = (): Promise<void> => rendere(createElement(Duplicates));

/** Dieselbe Seite IN der Huelle — nur so gibt es das Zahnrad und seine Seitenhilfe (DU5a). */
const montiereMitHuelle = (): Promise<void> =>
  rendere(createElement(AppShell, null, createElement(Duplicates)));

async function klicke(el: Element | null | undefined): Promise<void> {
  if (!(el instanceof HTMLElement)) {
    throw new Error("Element zum Klicken fehlt");
  }
  await act(async () => {
    el.click();
    await flush();
  });
  await act(flush);
}

const marke = (id: string): Element | null => container.querySelector(`[data-testid="${id}"]`);
const alle = (id: string): Element[] => [...container.querySelectorAll(`[data-testid="${id}"]`)];
const seitentext = (): string => (container.textContent ?? "").replace(/\s+/g, " ");
const knopf = (kennung: string): Element | null => marke(`pruefen-knopf-${kennung}`);

/**
 * Was von EINER Karte gelesen wird: ihr Titel (das Wissensobjekt) und ihr Text (die Aussage).
 * Bewusst diese zwei Felder und nicht `textContent` der ganzen Karte — das „Mehr" traegt die
 * Kennwerte des jeweiligen Befundes und wechselt mit ihm, ohne dass sich an den Objekten etwas
 * aendert. Gemessen wird, was das Kapitel behauptet: die beiden Objekte.
 */
function karte(seite: "a" | "b"): { titel: string; text: string } {
  const k = marke(`pruefen-paar-karte-${seite}`);
  return {
    titel: (k?.querySelector('[data-text="titel"]')?.textContent ?? "").trim(),
    text: (marke(`pruefen-paar-text-${seite}`)?.textContent ?? "").trim(),
  };
}

// ------------------------------------------------------------------------------------------------
// Der Bestand: zwei Wissensobjekte, die weitgehend dasselbe sagen, und ein drittes daneben.
// ------------------------------------------------------------------------------------------------
const TITEL_A = "Wartungsplan Nord";
const TITEL_B = "Wartungsplan Sued";
const TITEL_C = "Filterwechsel Werk 3";
const AUSSAGE_A = "Der Filter wird alle 14 Tage gewechselt, zusaetzlich nach jedem Stoerfall.";
const AUSSAGE_B = "Der Filter wird alle 14 Tage gewechselt, dokumentiert im Wartungsbuch.";
const AUSSAGE_C = "Der Filter wird nach Betriebsstunden gewechselt.";
/** Woertlich in AUSSAGE_A bzw. AUSSAGE_B enthalten — die Markierung raet nie (`markierung.ts`). */
const EIGEN_A = "zusaetzlich nach jedem Stoerfall";
const EIGEN_B = "dokumentiert im Wartungsbuch";
const GEMEINSAM = "Der Filter wird alle 14 Tage gewechselt";

const ko = (id: string, titel: string, aussage: string): Record<string, unknown> => ({
  id,
  title: titel,
  statement: aussage,
  status: "validiert",
  category: "Technik",
  type: "regel",
  trust: 80,
  confidence: 70,
  version: 2,
  conditions: [],
  measures: [],
  sources: [],
  tags: [],
  createdAt: "2026-08-01T06:00:00.000Z",
  updatedAt: "2026-08-01T06:00:00.000Z",
});

const KOS = [
  ko("ko-a", TITEL_A, AUSSAGE_A),
  ko("ko-b", TITEL_B, AUSSAGE_B),
  ko("ko-c", TITEL_C, AUSSAGE_C),
];

/**
 * Ein automatisch erkannter Ueberschneidungsbefund, so wie der Dienst ihn schreibt
 * (`OverlapService.buildFromVerdict`): `koA` ist der geprueffte Beitrag, `detector` traegt die
 * deterministische Textdeckung und — beim Modellfund — die Sicherheit.
 */
const befund = (
  id: string,
  koB: string,
  eigenB: string,
  zeit: string,
  relation = "teilweise",
): Record<string, unknown> => ({
  id,
  koA: "ko-a",
  koB,
  relation,
  aspects: [{ beschreibung: "Wechselintervall", zitatA: GEMEINSAM, zitatB: GEMEINSAM }],
  eigenanteilA: EIGEN_A,
  eigenanteilB: eigenB,
  recommendation: "verwandt_verlinken",
  status: "offen",
  pairKey: `ko-a|${koB}`,
  origin: "auto",
  detector: {
    trigger: "background",
    method: "model",
    lexicalScore: 0.82,
    confidence: 0.91,
    rationale: "Beide Aussagen nennen dasselbe Wechselintervall.",
  },
  createdAt: zeit,
});

/** DER Befund ueber dem Paar ko-a/ko-b — der, den die Faelle unten vor sich haben. */
const EINS = befund("u-eins", "ko-b", EIGEN_B, "2026-09-12T08:02:00.000Z", "identisch");
/**
 * EIN ZWEITER Befund ueber DEMSELBEN Paar. Das ist kein Kunstgriff: der Dienst entduplizert nicht,
 * und zwei Objekte koennen sich in mehr als einem Punkt ueberschneiden. Er ist es, der nach der
 * ausgefuehrten Wahl in DU3b beweist, dass BEIDE Wissensobjekte weiter gezeichnet werden.
 */
const ZWEI = befund("u-zwei", "ko-b", EIGEN_B, "2026-09-12T08:01:00.000Z");
/** Ein dritter Befund ueber einem ANDEREN Paar — fuer „genau ein Paar zugleich" (DU2a). */
const DREI = befund("u-drei", "ko-c", "nach Betriebsstunden", "2026-09-12T08:00:00.000Z");

beforeEach(async () => {
  await i18n.changeLanguage("de");
  // jsdom bringt kein `matchMedia` mit; die Huelle fragt danach.
  (globalThis as unknown as { matchMedia: (q: string) => unknown }).matchMedia = (q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
  d.setze({ kos: KOS, duplikate: [EINS] });
});

afterEach(() => {
  // Erst die Bremse loesen, dann abbauen: ein angehaltener Abruf, der die Sitzung ueberlebt, haenge
  // sonst am naechsten Fall und machte ihn nach Reihenfolge rot statt nach Sache.
  d.loeseKoBremse();
  abbauen();
  vi.clearAllMocks();
});

// ================================================================================================
// DU0 · DIE AUSGANGSLAGE — welches Kapitel hier ueberhaupt gemessen wird.
// ================================================================================================
describe("JOB 3804 DU0 · das Kapitel von /duplikate", () => {
  it("DU0a: `/duplikate` traegt genau EIN Kapitel, und jede Sprache traegt einen eigenen Text", () => {
    const { titleKey, bodyKey } = kapitelSchluessel();
    expect(titleKey, "/duplikate haengt an einem anderen Kapitel als `duplikate`").toBe(
      "help.duplikate.title",
    );
    expect(bodyKey).toBe("help.duplikate.body");
    // Ohne eigene Werte je Sprache maesse alles unten nur den deutschen Rueckfall.
    for (const lng of SPRACHEN) {
      expect(wert(titleKey, lng).length, `${lng}: der Kapiteltitel ist leer`).toBeGreaterThan(0);
      expect(kapitel(lng).length, `${lng}: der Kapiteltext ist leer`).toBeGreaterThan(40);
    }
    expect(
      kapitel("en"),
      "en traegt denselben Text wie de — die Sprachen sind nicht getrennt",
    ).not.toBe(kapitel("de"));
    expect(
      kapitel("nl"),
      "nl traegt denselben Text wie de — die Sprachen sind nicht getrennt",
    ).not.toBe(kapitel("de"));
  });
});

// ================================================================================================
// DU1 · B1 — „Zwei Wissensobjekte … landen hier als Paar."
// ================================================================================================
describe("JOB 3804 DU1 · die zwei Objekte stehen wirklich als Paar da", () => {
  it("DU1a: BEIDE Seiten werden gezeichnet — zwei Karten, je mit dem echten Titel ihres Wissensobjekts", async () => {
    behauptung("landen hier als Paar");
    await montiere();

    const paar = marke("pruefen-paar");
    expect(paar, "/duplikate: die Seite zeichnet gar kein Kartenpaar").not.toBeNull();
    const links = marke("pruefen-paar-karte-a");
    const rechts = marke("pruefen-paar-karte-b");
    expect(links, "/duplikate: die linke Karte ist gar nicht gezeichnet").not.toBeNull();
    expect(rechts, "/duplikate: die rechte Karte ist gar nicht gezeichnet").not.toBeNull();
    // „als Paar" heisst: BEIDE in DEMSELBEN gezeichneten Paar, nicht nacheinander.
    expect(paar?.contains(links as Node), "/duplikate: die linke Karte steht nicht im Paar").toBe(
      true,
    );
    expect(paar?.contains(rechts as Node), "/duplikate: die rechte Karte steht nicht im Paar").toBe(
      true,
    );
    // Und jede Karte nennt IHR Wissensobjekt beim echten Titel — nicht die Roh-Kennung und nicht
    // den neutralen „entfernt"-Hinweis.
    expect(karte("a").titel, "/duplikate: die linke Karte nennt ihr Wissensobjekt nicht").toBe(
      TITEL_A,
    );
    expect(karte("b").titel, "/duplikate: die rechte Karte nennt ihr Wissensobjekt nicht").toBe(
      TITEL_B,
    );
    expect(karte("a").titel, "/duplikate: beide Karten zeigen dasselbe Objekt").not.toBe(
      karte("b").titel,
    );
    expect(
      seitentext(),
      "/duplikate: eine Karte steht auf dem neutralen „entfernt“-Hinweis statt auf ihrem Objekt",
    ).not.toContain(wert("board.koRemoved"));
    // EINE Karte mit zwei Absaetzen waere kein Paar: es sind zwei getrennte Kartenflaechen.
    expect(alle("pruefen-paar-karte-a").length, "/duplikate: mehr als eine linke Karte").toBe(1);
    expect(alle("pruefen-paar-karte-b").length, "/duplikate: mehr als eine rechte Karte").toBe(1);
    expect(links?.contains(rechts as Node), "/duplikate: die zwei Karten sind ineinander").toBe(
      false,
    );
  });
});

// ================================================================================================
// DU2 · B5 — „Nimm dir ein Paar vor und vergleiche die beiden Texte."
// ================================================================================================
describe("JOB 3804 DU2 · ein Paar zugleich, und seine zwei Texte nebeneinander", () => {
  it("DU2a: bei DREI Befunden steht GENAU EIN Paar da — die Seite legt sie nicht untereinander", async () => {
    behauptung("Nimm dir ein Paar vor");
    d.setze({ kos: KOS, duplikate: [EINS, ZWEI, DREI] });
    await montiere();

    expect(
      alle("pruefen-paar").length,
      "/duplikate: die Seite zeichnet nicht genau EIN Paar — „nimm dir ein Paar vor“ trifft dann nicht zu",
    ).toBe(1);
    expect(alle("pruefen-paar-karte-a").length, "/duplikate: mehr als eine linke Karte").toBe(1);
    // Die Seite sagt selbst, das wievielte von wie vielen sie zeigt.
    expect(
      marke("pruefen-pille-lauf")?.textContent,
      "/duplikate: die Seite sagt nicht, das wievielte Paar von wie vielen dasteht",
    ).toBe(i18n.t("pruefen.kVonN", { k: 1, n: 3 }));
    // Und das Objekt des DRITTEN Befundes ist nirgends gezeichnet — sonst staenden sie doch alle da.
    expect(
      seitentext(),
      `/duplikate: „${TITEL_C}“ aus einem anderen Paar steht gleichzeitig da`,
    ).not.toContain(TITEL_C);
    // Geblaettert wird von Hand: die zwei Pfeile der Kopfzeile sind da.
    expect(
      marke("pruefen-vor"),
      "/duplikate: es gibt keinen Weg zum naechsten Paar",
    ).not.toBeNull();
  });

  it("DU2b: die beiden Texte sind NEBENEINANDER lesbar — beide Aussagen gleichzeitig gezeichnet", async () => {
    behauptung("vergleiche die beiden Texte");
    await montiere();

    const a = marke("pruefen-paar-text-a");
    const b = marke("pruefen-paar-text-b");
    expect(a, "/duplikate: der linke Text ist gar nicht gezeichnet").not.toBeNull();
    expect(b, "/duplikate: der rechte Text ist gar nicht gezeichnet").not.toBeNull();
    // Beide tragen die ECHTE Aussage ihres Wissensobjekts, nicht eine Zusammenfassung.
    expect(karte("a").text, "/duplikate: der linke Text ist nicht die Aussage des Objekts").toBe(
      AUSSAGE_A,
    );
    expect(karte("b").text, "/duplikate: der rechte Text ist nicht die Aussage des Objekts").toBe(
      AUSSAGE_B,
    );
    // „vergleiche" heisst: gleichzeitig da, in demselben Paar — nicht eines nach dem anderen.
    const paar = marke("pruefen-paar");
    expect(paar?.contains(a as Node) && paar?.contains(b as Node)).toBe(true);
    // Was die Texte unterscheidet, ist im Text selbst markiert — und zwar woertlich, nie geraten
    // (`components/pruefen/markierung.ts`). Ohne diese Marke waere „vergleiche" nur ein Wunsch.
    expect(
      a?.querySelector('[data-markiert="1"]')?.textContent,
      "/duplikate: der Eigenanteil der linken Seite ist nicht markiert",
    ).toBe(EIGEN_A);
    expect(
      b?.querySelector('[data-markiert="1"]')?.textContent,
      "/duplikate: der Eigenanteil der rechten Seite ist nicht markiert",
    ).toBe(EIGEN_B);
  });
});

// ================================================================================================
// DU3 · B3 — „Du entscheidest, welche Seite maßgeblich ist, ob beide bleiben und verknüpft werden
//             oder ob es gar kein Duplikat ist."
// ================================================================================================
describe("JOB 3804 DU3 · die vier Wahlen und eine wirklich ausgefuehrte", () => {
  it("DU3a: das Aktionsband bietet GENAU die vier Knoepfe an, an den echten Beschriftungen", async () => {
    behauptung("Du entscheidest");
    behauptung("welche Seite maßgeblich ist");
    behauptung("ob beide bleiben und verknüpft werden");
    behauptung("ob es gar kein Duplikat ist");
    await montiere();

    const band = marke("pruefen-aktionsband");
    expect(band, "/duplikate: es gibt gar kein Aktionsband").not.toBeNull();
    // Je Wahl EIN eigener Fall-Anteil mit seiner Kennung: faellt ein einzelner Knopf weg, nennt die
    // Meldung GENAU ihn (Lehre JOB 3587 R4).
    expect(knopf("links-behalten")?.textContent, "/duplikate: „links maßgeblich“ fehlt").toBe(
      wert("dup.side.left"),
    );
    expect(knopf("rechts-behalten")?.textContent, "/duplikate: „rechts maßgeblich“ fehlt").toBe(
      wert("dup.side.right"),
    );
    expect(knopf("beide-verknuepfen")?.textContent, "/duplikate: „beide bleiben“ fehlt").toBe(
      wert("dup.side.both"),
    );
    expect(knopf("kein-duplikat")?.textContent, "/duplikate: „kein Duplikat“ fehlt").toBe(
      wert("dup.side.none"),
    );
    // Und es sind GENAU diese vier — kein fuenfter Weg, der im Kapitel nicht vorkaeme.
    expect(
      [...(band?.querySelectorAll("button") ?? [])].map((b) => (b.textContent ?? "").trim()),
      "/duplikate: das Aktionsband bietet etwas anderes an",
    ).toEqual([
      wert("dup.side.left"),
      wert("dup.side.right"),
      wert("dup.side.both"),
      wert("dup.side.none"),
    ]);
  });

  it("DU3b: eine WIRKLICH ausgefuehrte Wahl — und an beiden Wissensobjekten aendert sich nichts", async () => {
    behauptung("ob beide bleiben und verknüpft werden");
    behauptung("zusammengeführt und gelöscht wird dabei nichts");
    // ZWEI Befunde ueber demselben Paar: nach der Wahl am ersten steht das Paar am zweiten weiter
    // da — nur so sind „vorher" und „nachher" zwei Ablesungen DESSELBEN gezeichneten DOM.
    d.setze({ kos: KOS, duplikate: [EINS, ZWEI] });
    await montiere();

    // VORHER — aus dem Abruf der Seite, nicht aus dieser Datei.
    const vorher = { a: karte("a"), b: karte("b") };
    expect(vorher.a, "/duplikate: das linke Objekt ist vorher nicht gezeichnet").toEqual({
      titel: TITEL_A,
      text: AUSSAGE_A,
    });
    expect(vorher.b, "/duplikate: das rechte Objekt ist vorher nicht gezeichnet").toEqual({
      titel: TITEL_B,
      text: AUSSAGE_B,
    });
    const kosVorher = d.lies().kos;
    const abrufeVorher = d.abrufe();

    // DIE WAHL — ein echter Klick auf der Seite.
    await klicke(knopf("beide-verknuepfen"));
    expect(
      d.linkRelated,
      "/duplikate: die Wahl hat den Server gar nicht erreicht",
    ).toHaveBeenCalledWith("u-eins");
    const entschieden = d.lies().duplikate.find((e) => e.id === "u-eins");
    expect(entschieden?.status, "/duplikate: der Fund ist nach der Wahl nicht geschlossen").toBe(
      "geschlossen",
    );
    expect(
      (entschieden?.resolution as { reason?: string } | undefined)?.reason,
      "/duplikate: der Abschluss traegt nicht den gewaehlten Grund",
    ).toBe("linked_related");

    // ============================================================================================
    // DIE VORAUSSETZUNG DER NACHHER-ABLESUNG (bens Korrekturpflicht 2, Runde 1).
    // ============================================================================================
    //
    // Was die Karten JETZT zeigen, ist erst dann eine Aussage ueber den Stand NACH der Entscheidung,
    // wenn nach der Entscheidung wirklich ein frischer Abruf ERFOLGREICH ABGESCHLOSSEN ist. Bleibt
    // er aus oder scheitert er, stehen dort weiter die zuletzt erfolgreich geholten Werte (so baut
    // es die Flaeche ausdruecklich, `zaehler.ts:143-146`) — „vorher gleich nachher" waere dann eine
    // Ablesung des ALTEN Zwischenspeichers und belegte gar nichts. Genau das kalibrieren DU3d
    // (verzoegerte Antwort) und DU3e (ausbleibende Antwort): dort bleibt `koFertig` stehen.
    const abrufeNachher = d.abrufe();
    expect(
      abrufeNachher.koStart,
      "/duplikate: die Entscheidung hat gar keinen neuen Abruf der Wissensobjekte ausgeloest — die Karten koennen den Stand VOR der Entscheidung zeigen",
    ).toBeGreaterThan(abrufeVorher.koStart);
    expect(
      abrufeNachher.koFertig,
      "/duplikate: nach der Entscheidung ist KEIN Abruf der Wissensobjekte erfolgreich abgeschlossen — was die Karten zeigen, ist der alte Zwischenspeicher, und der Vergleich vorher/nachher belegt nichts",
    ).toBeGreaterThan(abrufeVorher.koFertig);
    expect(
      abrufeNachher.dupFertig,
      "/duplikate: nach der Entscheidung ist KEIN Abruf der Ueberschneidungen erfolgreich abgeschlossen — das gezeichnete Paar ist dann der alte Zwischenspeicher",
    ).toBeGreaterThan(abrufeVorher.dupFertig);
    // Und die Flaeche selbst meldet keine gescheiterte Auffrischung: sie steht auf frischen Daten.
    expect(
      marke("pruefen-nicht-frisch"),
      "/duplikate: die Flaeche meldet eine gescheiterte Auffrischung — dann ist die Nachher-Ablesung kein frischer Stand",
    ).toBeNull();

    // NACHHER — wieder aus dem Abruf der Seite. An den ZWEI OBJEKTEN hat sich nichts geaendert.
    expect(
      { a: karte("a"), b: karte("b") },
      "/duplikate: die Wahl hat die gezeichneten Wissensobjekte veraendert — „verknüpft“ oder „zusammengeführt“ waere genau das",
    ).toEqual(vorher);
    expect(
      d.lies().kos,
      "/duplikate: die Wahl hat am Bestand der Wissensobjekte etwas geaendert",
    ).toEqual(kosVorher);
    expect(d.lies().kos.length, "/duplikate: die Wahl hat ein Wissensobjekt geloescht").toBe(
      KOS.length,
    );
    // Und es ist weiter entscheidbar: der zweite Fund desselben Paares traegt sein Band.
    expect(
      marke("pruefen-aktionsband"),
      "/duplikate: nach der Wahl steht der zweite Fund ohne Aktionsband da",
    ).not.toBeNull();
  });

  it("DU3c: der Abschlusssatz ist an `canClose` gebunden — liefert der Abruf einen geschlossenen Fund, steht er da und das Band ist fort", async () => {
    // DIESER FALL MISST DIE ANZEIGE, NICHT DEN WEG: er setzt einen Abruf voraus, den der echte
    // Server NICHT liefert (DU4b misst genau das). Ohne ihn bliebe offen, ob der Abschlusssatz
    // ueberhaupt existiert und woran er haengt — das macht er hier an der EINEN Stelle fest,
    // `canClose` in `lib/duplicateBoard.ts:127-129`.
    const geschlossen = {
      ...EINS,
      status: "geschlossen",
      resolution: {
        reason: "linked_related",
        by: "u1",
        note: null,
        at: "2026-09-12T10:00:00.000Z",
      },
      closedAt: "2026-09-12T10:00:00.000Z",
    };
    expect(
      canClose(geschlossen as unknown as OverlapEntry),
      "/duplikate: `canClose` haelt einen geschlossenen Fund fuer entscheidbar — der Fall misst nichts",
    ).toBe(false);
    d.setze({ kos: KOS, duplikate: [geschlossen], liefereGeschlossene: true });
    await montiere();

    const satz = marke("pruefen-satz-geschlossen");
    expect(satz, "/duplikate: der geschlossene Fund zeigt keinen Abschlusssatz").not.toBeNull();
    expect(satz?.textContent, "/duplikate: der Abschlusssatz nennt den Abschluss nicht").toContain(
      wert("dup.closed"),
    );
    expect(satz?.textContent, "/duplikate: der Abschlusssatz nennt den Grund nicht").toContain(
      wert("dup.reason.linked_related"),
    );
    expect(
      marke("pruefen-aktionsband"),
      "/duplikate: der geschlossene Fund bietet weiter die vier Knoepfe an",
    ).toBeNull();
    // Und die zwei Wissensobjekte stehen unveraendert daneben — der Abschluss hat sie nicht angefasst.
    expect(karte("a").titel).toBe(TITEL_A);
    expect(karte("b").titel).toBe(TITEL_B);
  });

  // ==============================================================================================
  // DU3d/DU3e · DIE KALIBRIERUNG DER NACHHER-ABLESUNG (bens Korrekturpflicht 2, Runde 1).
  // ==============================================================================================
  //
  // DU3b behauptet „an beiden Wissensobjekten hat sich nichts geaendert" aus der GLEICHHEIT zweier
  // DOM-Ablesungen. Diese Gleichheit ist nur dann eine Aussage, wenn zwischen den beiden Ablesungen
  // wirklich ein frischer Abruf ERFOLGREICH ABGESCHLOSSEN ist. Die zwei Faelle hier zeigen, dass
  // genau das schiefgehen KANN — und dass die Flaeche dabei weiter die alten Werte zeichnet. Ohne
  // sie waere die Wache in DU3b eine Zeile, von der niemand weiss, ob sie je falsch werden kann.
  it("DU3d · KALIBRIERUNG: bleibt die frische Antwort AUS (verzoegert), zeigen die Karten weiter den alten Zwischenspeicher", async () => {
    d.setze({ kos: KOS, duplikate: [EINS, ZWEI] });
    await montiere();
    const vorher = { a: karte("a"), b: karte("b") };
    const abrufeVorher = d.abrufe();
    expect(abrufeVorher.koFertig, "/duplikate: der erste Objektabruf ist nicht fertig").toBe(1);

    // Ab jetzt haengt jeder Objektabruf.
    d.bremseKo();
    await klicke(knopf("beide-verknuepfen"));

    const gebremst = d.abrufe();
    expect(
      gebremst.koStart,
      "/duplikate: die Entscheidung loest keinen neuen Objektabruf aus — dann kalibriert dieser Fall nichts",
    ).toBeGreaterThan(abrufeVorher.koStart);
    expect(
      gebremst.koFertig,
      "/duplikate: der angehaltene Objektabruf ist trotzdem fertig geworden — die Bremse greift nicht, der Fall misst nichts",
    ).toBe(abrufeVorher.koFertig);
    // UND GENAU DAS IST DER PUNKT: die Karten stehen unveraendert da, obwohl NICHTS Frisches
    // vorliegt. Eine Nachher-Ablesung an dieser Stelle waere der alte Zwischenspeicher — sie waere
    // gleich, und sie belegte nichts.
    expect(
      { a: karte("a"), b: karte("b") },
      "/duplikate: waehrend der angehaltenen Auffrischung hat die Flaeche die Karten geleert — das verletzt Regelwerk §7",
    ).toEqual(vorher);

    // Freigeben — jetzt, und erst jetzt, ruht die Ablesung auf einer frischen, erfolgreichen Antwort.
    const freigegeben = d.loeseKoBremse();
    expect(freigegeben, "/duplikate: es hing gar kein Objektabruf an der Bremse").toBeGreaterThan(
      0,
    );
    await act(flush);
    await act(flush);
    const danach = d.abrufe();
    expect(
      danach.koFertig,
      "/duplikate: auch nach dem Freigeben ist kein Objektabruf erfolgreich abgeschlossen",
    ).toBeGreaterThan(abrufeVorher.koFertig);
    expect(
      { a: karte("a"), b: karte("b") },
      "/duplikate: erst auf der frischen Antwort haben sich die Karten veraendert",
    ).toEqual(vorher);
  });

  it("DU3e · KALIBRIERUNG: SCHEITERT die frische Antwort, bleiben die alten Werte stehen — und die Flaeche sagt es", async () => {
    d.setze({ kos: KOS, duplikate: [EINS, ZWEI] });
    await montiere();
    const vorher = { a: karte("a"), b: karte("b") };
    const abrufeVorher = d.abrufe();
    expect(
      marke("pruefen-nicht-frisch"),
      "/duplikate: die Flaeche meldet schon vor dem Fehler eine gescheiterte Auffrischung",
    ).toBeNull();

    d.lasseKoScheitern();
    await klicke(knopf("beide-verknuepfen"));

    const danach = d.abrufe();
    expect(
      danach.koStart,
      "/duplikate: die Entscheidung loest keinen neuen Objektabruf aus — dann kalibriert dieser Fall nichts",
    ).toBeGreaterThan(abrufeVorher.koStart);
    expect(
      danach.koFertig,
      "/duplikate: der gescheiterte Objektabruf wird als erfolgreich gezaehlt — die Wache in DU3b waere wertlos",
    ).toBe(abrufeVorher.koFertig);
    // Regelwerk §7: die zuletzt erfolgreich geholten Werte bleiben SICHTBAR …
    expect(
      { a: karte("a"), b: karte("b") },
      "/duplikate: die gescheiterte Auffrischung hat die Karten geleert — das verletzt Regelwerk §7",
    ).toEqual(vorher);
    // … und die Flaeche sagt, dass sie nicht mehr frisch sind, statt den alten Stand als aktuell
    // auszugeben. Das ist zugleich die zweite Wache aus DU3b, hier von der anderen Seite gemessen.
    expect(
      marke("pruefen-nicht-frisch"),
      "/duplikate: nach einer gescheiterten Auffrischung gibt die Flaeche den alten Stand als aktuell aus",
    ).not.toBeNull();
  });
});

// ================================================================================================
// DU4 · B4 — „zusammengeführt und gelöscht wird dabei nichts, es entsteht ein Vermerk."
// ================================================================================================
describe("JOB 3804 DU4 · was nach der Entscheidung wirklich dasteht", () => {
  it("DU4a: der Fund existiert weiter und traegt seinen Grund; kein Wissensobjekt verschwindet", async () => {
    behauptung("zusammengeführt und gelöscht wird dabei nichts, es entsteht ein Vermerk");
    await montiere();
    const kennungenVorher = d.lies().duplikate.map((e) => e.id);

    await klicke(knopf("kein-duplikat"));
    expect(
      d.dismiss,
      "/duplikate: die Wahl hat den Server gar nicht erreicht",
    ).toHaveBeenCalledWith("u-eins");

    const nachher = d.lies();
    expect(
      nachher.duplikate.map((e) => e.id),
      "/duplikate: die Entscheidung hat den Fund geloescht, statt ihn zu vermerken",
    ).toEqual(kennungenVorher);
    const vermerk = nachher.duplikate.find((e) => e.id === "u-eins")?.resolution as
      | { reason?: string; by?: string; at?: string }
      | undefined;
    expect(vermerk, "/duplikate: es ist gar kein Vermerk entstanden").toBeDefined();
    expect(vermerk?.reason, "/duplikate: der Vermerk nennt keinen Grund").toBe("dismissed");
    expect(vermerk?.by, "/duplikate: der Vermerk nennt niemanden").toBe("u1");
    expect(
      nachher.kos.map((k) => k.id),
      "/duplikate: die Entscheidung hat ein Wissensobjekt geloescht",
    ).toEqual(["ko-a", "ko-b", "ko-c"]);
  });

  it("DU4b · NACHFUEHR-PIN: der geschlossene Fund faellt aus dem Abruf — fuer einen Neuling sieht „gelöscht wird nichts“ aus wie geloescht", async () => {
    // GEMESSEN, nicht vermutet: `GET /api/duplicates` gibt `overlaps.unresolved()` aus
    // (`services/app/src/routes/overlap-routes.ts:54`), und `unresolved()` filtert auf
    // `status !== "geschlossen"` (`services/conflicts/src/overlap-service.ts:933`). Der Datensatz
    // bleibt (DU4a) — die FLAECHE zeigt ihn nicht mehr, und bei einem einzigen Befund steht dort
    // der Leersatz. Dasselbe hat JOB 3795 fuer `/konflikte` gemeldet (REST Punkt 2).
    await montiere();
    expect(marke("pruefen-paar"), "/duplikate: vorher steht gar kein Paar da").not.toBeNull();

    await klicke(knopf("beide-verknuepfen"));
    expect(
      d.lies().duplikate.find((e) => e.id === "u-eins")?.status,
      "/duplikate: der Fund ist nicht geschlossen — der Fall misst nichts",
    ).toBe("geschlossen");

    expect(
      marke("pruefen-paar"),
      "/duplikate: der geschlossene Fund steht jetzt weiter auf dem Brett. Jetzt DU4b loeschen und die neue Anzeige des geschlossenen Fundes am echten Abruf belegen.",
    ).toBeNull();
    expect(
      marke("pruefen-satz-geschlossen"),
      "/duplikate: der Abschlusssatz erscheint jetzt auf dem echten Weg. Jetzt DU4b loeschen und DU3c von der Ersatzlage `liefereGeschlossene` auf den echten Abruf umstellen.",
    ).toBeNull();
    expect(
      marke("pruefen-satz-leer")?.textContent,
      "/duplikate: nach der letzten Entscheidung fehlt der ehrliche Leersatz",
    ).toBe(wert("dup.empty"));
  });
});

// ================================================================================================
// DU5 · VIER TEXTE FUER DIESELBE FLAECHE — und einer sagt etwas anderes als die drei anderen.
// ================================================================================================
//
// `/duplikate` traegt VIER Hilfequellen: das Kapitel `help.duplikate.body` (Zahnrad → Seitenhilfe,
// ueber `navHilfeFor`), die zwei „?"-Texte `dup.help.detection.body` und `dup.intro`
// (`Duplicates.tsx:218-222`) und die zwei Zahnradtexte `dup.seitenhilfe.flaeche.text` und
// `dup.seitenhilfe.entscheidung.text` (`Duplicates.tsx:248-255`).
//
// JOB 3771 hat am Dienst gemessen und die drei letzten auf die Wahrheit gebracht
// (`archiv/3771/runde-1/RUECKGABE.md:47`: „Alle vier Knoepfe tun dasselbe eine: sie schliessen
// diesen Fund mit dem gewaehlten Grund … An den beiden Wissensobjekten aendert keiner von ihnen
// etwas."). Das KAPITEL hat es nicht angefasst — es lag ausserhalb seiner Zielpfade.
//
// EINZELN BEISSEND, NICHT ALS MENGE (bens Korrekturpflicht 1 und seine Promptverbesserung,
// Runde 1): jeder der FUENF Textschluessel hat hier seinen EIGENEN Fall an der Flaeche, an der er
// erscheint. Faellt eine einzelne Anmeldung weg, wird GENAU ihr Fall rot und nennt Route UND
// Schluessel. In Runde 1 trug `dup.seitenhilfe.flaeche.text` nur einen Kommentar und keine
// Behauptung — seine HelpTip-Anmeldung liess sich entfernen, ohne dass ein Fall es bemerkte.
//
//   DU5a  `help.duplikate.body`               Zahnrad → Seitenhilfe (ueber `navHilfeFor`)
//   DU5b  `dup.seitenhilfe.flaeche.text`      Zahnrad → Seitenhilfe (`Duplicates.tsx:248-251`)
//   DU5c  `dup.seitenhilfe.entscheidung.text` Zahnrad → Seitenhilfe (`Duplicates.tsx:252-255`)
//   DU5d  `dup.help.detection.body`           „?" neben der Ueberschrift (`:218-220`)
//   DU5e  `dup.intro`                         „?" neben der Ueberschrift (`:221-226`)
describe("JOB 3804 DU5 · der Vierfachtext derselben Flaeche", () => {
  /** Die geoeffnete Seitenhilfe der gemounteten Seite, als EIN gelesener Fliesstext. */
  async function seitenhilfe(): Promise<string> {
    await montiereMitHuelle();
    await klicke(marke("kopfband-zahnrad"));
    await klicke(marke("zahnrad-seitenhilfe"));
    const liste = marke("seitenhilfe-liste");
    expect(liste, "/duplikate: die Seitenhilfe zeigt keine Liste").not.toBeNull();
    return (liste?.textContent ?? "").replace(/\s+/g, " ");
  }

  /** Das geoeffnete „?"-Menue der gemounteten Seite, als EIN gelesener Fliesstext. */
  async function fragezeichen(): Promise<string> {
    await montiere();
    await klicke(marke("pruefen-menue-hilfe"));
    const panel = marke("pruefen-menue-panel-hilfe");
    expect(panel, "/duplikate: das „?“-Menue oeffnet nicht").not.toBeNull();
    return (panel?.textContent ?? "").replace(/\s+/g, " ");
  }

  it("DU5a: `help.duplikate.body` — das Kapitel steht in der Seitenhilfe DIESER Flaeche", async () => {
    const gelesen = await seitenhilfe();
    expect(
      gelesen,
      "/duplikate: `help.duplikate.body` steht nicht in der Seitenhilfe — das Kapitel erreicht den Menschen auf dieser Flaeche gar nicht",
    ).toContain(kapitel());
  });

  it("DU5b: `dup.seitenhilfe.flaeche.text` — der Zahnradtext zur Flaeche steht in derselben Liste", async () => {
    const gelesen = await seitenhilfe();
    expect(
      gelesen,
      "/duplikate: `dup.seitenhilfe.flaeche.text` steht nicht in der Seitenhilfe — seine HelpTip-Anmeldung (`Duplicates.tsx:248-251`) fehlt",
    ).toContain(wert("dup.seitenhilfe.flaeche.text").replace("{{mehr}}", wert("pruefen.more")));
    // Er ist der Text, der die Flaeche BESCHREIBT — und er sagt, wo die Zahlen liegen. Was er
    // verspricht, steht gemessen in DU1a/DU2a/DU2b; hier haengt er an seiner Anmeldung.
    expect(
      wert("dup.seitenhilfe.flaeche.text"),
      "/duplikate: `dup.seitenhilfe.flaeche.text` nennt den Aufklapper nicht mehr — dann zeigt er nicht mehr auf die Stelle, an der die Zahlen wirklich liegen",
    ).toContain("{{mehr}}");
  });

  it("DU5c · NACHFUEHR-PIN: `dup.seitenhilfe.entscheidung.text` steht UNTER dem Kapitel und sagt das Gegenteil", async () => {
    behauptung("ob beide bleiben und verknüpft werden");
    const gelesen = await seitenhilfe();
    const entscheidung = wert("dup.seitenhilfe.entscheidung.text").replace(
      "{{bibliothek}}",
      wert("nav.library"),
    );
    expect(
      gelesen,
      "/duplikate: `dup.seitenhilfe.entscheidung.text` steht nicht in der Seitenhilfe — seine HelpTip-Anmeldung (`Duplicates.tsx:252-255`) fehlt",
    ).toContain(entscheidung);
    // BEIDE stehen dem Menschen in EINER Liste vor Augen — das ist der Kern des Befundes.
    expect(
      gelesen,
      "/duplikate: Kapitel und Zahnradtext stehen nicht in derselben Liste — dann sieht der Mensch den Widerspruch nicht untereinander",
    ).toContain(kapitel());
    expect(
      gelesen.indexOf(entscheidung),
      "/duplikate: der Zahnradtext steht VOR dem Kapitel — die Reihenfolge der Seitenhilfe ist eine andere geworden",
    ).toBeGreaterThan(gelesen.indexOf(kapitel()));

    // DER WIDERSPRUCH, gemessen an den zwei Schluesseln:
    //   `help.duplikate.body`                 (apps/web/src/i18n.ts, DE heute :5046-5047)
    //   `dup.seitenhilfe.entscheidung.text`   (apps/web/src/i18n.ts, DE heute :3690-3691)
    expect(
      kapitel(),
      "/duplikate: das Kapitel verspricht keine Verknuepfung mehr. Jetzt DU5c auf die Anmeldung zurueckbauen und die Zusage des Kapitels am Verhalten neu belegen.",
    ).toContain("verknüpft werden");
    expect(
      wert("dup.seitenhilfe.entscheidung.text"),
      "/duplikate: der Zahnradtext verneint die Verknuepfung nicht mehr — dann ist nicht mehr der eine, sondern der andere Text nachzufuehren. Jetzt DU5c neu ausrichten.",
    ).toContain("legt keine Verknüpfung in den Objekten an");
  });

  it("DU5d · NACHFUEHR-PIN: `dup.help.detection.body` steht im „?“ und verneint, was das Kapitel zusagt", async () => {
    const gelesen = await fragezeichen();
    expect(
      gelesen,
      "/duplikate: `dup.help.detection.body` steht nicht im „?“ — der Erkennungsblock (`Duplicates.tsx:218-220`) fehlt",
    ).toContain(wert("dup.help.detection.body"));
    expect(
      wert("dup.help.detection.body"),
      "/duplikate: `dup.help.detection.body` verneint die Wirkung an den Objekten nicht mehr. Jetzt DU5d neu ausrichten.",
    ).toContain("an den beiden Objekten ändert sie nichts");
    expect(
      kapitel(),
      "/duplikate: das Kapitel sagt keine Wirkung an den Objekten mehr zu — die vier Quellen sagen jetzt dasselbe. Jetzt DU5d auf die Anmeldung zurueckbauen.",
    ).toContain("beide bleiben und verknüpft werden");
  });

  it("DU5e · NACHFUEHR-PIN: `dup.intro` steht im „?“ und verneint es ebenso", async () => {
    const gelesen = await fragezeichen();
    expect(
      gelesen,
      "/duplikate: `dup.intro` steht nicht im „?“ — der Einleitungsblock (`Duplicates.tsx:221-226`) fehlt",
    ).toContain(wert("dup.intro"));
    expect(
      wert("dup.intro"),
      "/duplikate: `dup.intro` verneint die Wirkung an den Beitraegen nicht mehr. Jetzt DU5e neu ausrichten.",
    ).toContain("an den beiden Beiträgen ändert sie nichts");
    expect(
      kapitel(),
      "/duplikate: das Kapitel sagt keine Wirkung an den Objekten mehr zu — die vier Quellen sagen jetzt dasselbe. Jetzt DU5e auf die Anmeldung zurueckbauen.",
    ).toContain("beide bleiben und verknüpft werden");
  });

  it("DU5f: „welche Seite maßgeblich ist“ reicht genau bis zum Vermerk — und keinen Schritt weiter", async () => {
    behauptung("welche Seite maßgeblich ist");
    // Der Vermerk ist der EINE Ort, an dem die maßgebliche Seite ueberhaupt vorkommt: die Seite
    // schickt ihn als `note` mit (`Duplicates.tsx:549-553`), der Dienst legt ihn in
    // `resolution.note` ab. An den Objekten aendert er nichts — das misst der Rest des Falls.
    const erwarteterVermerk = i18n.t("dup.keepNote", { title: TITEL_A });
    expect(
      wert("dup.keepNote"),
      "/duplikate: der Vermerk nennt die maßgebliche Seite nicht mehr — dann traegt das Kapitel („welche Seite maßgeblich ist“) gar nichts mehr. Jetzt den Kapitelsatz nachfuehren und diesen Fall neu ausrichten.",
    ).toContain("maßgeblich");
    await montiere();
    const kosVorher = d.lies().kos;

    await klicke(knopf("links-behalten"));
    expect(
      d.keepSeparate,
      "/duplikate: „Links behalten“ schickt die maßgebliche Seite nicht mit",
    ).toHaveBeenCalledWith("u-eins", erwarteterVermerk);
    expect(erwarteterVermerk, "/duplikate: der Vermerk nennt die gewaehlte Seite nicht").toContain(
      TITEL_A,
    );
    const vermerk = d.lies().duplikate.find((e) => e.id === "u-eins")?.resolution as
      | { reason?: string; note?: string | null }
      | undefined;
    expect(vermerk?.reason, "/duplikate: der Abschluss traegt nicht den gewaehlten Grund").toBe(
      "kept_separate",
    );
    expect(vermerk?.note, "/duplikate: die maßgebliche Seite steht nicht im Vermerk").toBe(
      erwarteterVermerk,
    );
    // UND SONST NIRGENDS: an den zwei Wissensobjekten steht danach kein Wort davon.
    expect(d.lies().kos, "/duplikate: „maßgeblich“ hat die Wissensobjekte veraendert").toEqual(
      kosVorher,
    );
  });
});

// ================================================================================================
// DU6 · §9 ZUSTANDSMODELL — gemessen wird nur nach erfolgreicher, frischer Datengrundlage.
// ================================================================================================
describe("JOB 3804 DU6 · die Lagen der Flaeche", () => {
  it("DU6a · KALIBRIERUNG: liefert der Abruf nichts, zeichnet dieselbe Seite KEINE Karte", async () => {
    // Ohne diesen Fall bliebe offen, ob `karte()` und `marke("pruefen-paar")` ueberhaupt am
    // Listenabruf haengen. Liefert er nichts, steht dort nichts — und kein Fall oben kann
    // zufaellig gruen sein.
    d.setze({ kos: KOS, duplikate: [] });
    await montiere();
    expect(
      marke("pruefen-paar"),
      "/duplikate: ohne Bestand zeichnet die Seite ein Paar",
    ).toBeNull();
    expect(alle("pruefen-paar-karte-a"), "/duplikate: ohne Bestand steht eine Karte da").toEqual(
      [],
    );
    expect(marke("pruefen-aktionsband"), "/duplikate: ohne Bestand steht ein Band da").toBeNull();
    expect(
      marke("pruefen-satz-leer")?.textContent,
      "/duplikate: der leere, ERFOLGREICHE Abruf sagt es nicht",
    ).toBe(wert("dup.empty"));
  });

  it("DU6b · §9: ein GESCHEITERTER Abruf ist kein Leersatz — „keine offenen Überschneidungen“ waere dann eine Behauptung ohne Grundlage", async () => {
    d.setze({ kos: KOS, duplikate: [EINS], fehler: true });
    await montiere();
    expect(
      marke("pruefen-erstfehler"),
      "/duplikate: der gescheiterte Abruf meldet sich nicht",
    ).not.toBeNull();
    expect(
      marke("pruefen-satz-leer"),
      "/duplikate: nach einem gescheiterten Abruf steht der Leersatz da — er liest sich wie „erledigt“",
    ).toBeNull();
    expect(
      seitentext(),
      "/duplikate: nach einem gescheiterten Abruf steht „keine offenen Überschneidungen“ da",
    ).not.toContain(wert("dup.empty"));
    expect(marke("pruefen-paar"), "/duplikate: ohne Antwort steht trotzdem ein Paar da").toBeNull();
  });
});
