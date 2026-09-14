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
// EINGELOEST AM 13.09.2026 (JOB 3890): der Halbsatz „ob beide bleiben und VERKNUEPFT WERDEN" ist
// weg. Das Kapitel nennt die dritte Wahl jetzt so, wie ihr Knopf sie beschriftet (`dup.side.both`),
// verneint die Verknuepfung in den Objekten mit DENSELBEN Worten wie der Zahnradtext und sagt,
// wohin ein entschiedener Fund geht.
//
// DU5c, DU5d und DU5e messen darum nicht mehr den Widerspruch, sondern
// die UEBEREINSTIMMUNG zweier Quellen — je Schluessel ein Fall, je Sprache eine eigene Meldung
// (die Tabelle `UEBEREINSTIMMUNG` unten). Die `NACHFUEHR-PIN`-Form dieser drei Faelle ist abgeloest,
// nicht verdoppelt: es gibt keinen zweiten Ort, der dieselbe Uebereinstimmung noch einmal misst.
//
// RUNDE 3 (13.09.2026) — WAS ZURUECKGEBAUT WURDE UND WARUM, jeweils GEMESSEN. Runde 2 hatte den
// Ortsnamen („Bibliothek"/„Library"/„Bibliotheek", `nav.library`) zusaetzlich ins KAPITEL gesetzt;
// im Tor wurden davon ZWEI fremde Waechter rot, beide ausserhalb der Zielpfade:
//   (1) `tests/review26-hilfe-import/hilfe-findet-dateiimport.test.ts:311` (V2) — die Hilfe-Suche
//       ist eine Teilstring-Suche ueber Titel + Text + Merkmale (`lib/helpTopics.ts:318-330`), also
//       fand „bibliothek" plotzlich auch dieses Kapitel: „expected [ 'library', 'duplikate' ] to
//       deeply equal [ 'library' ]".
//   (2) `tests/app/f0304-klara-assistenzflaeche.test.tsx` (A3) — „topic:duplikate: Text beschnitten
//       (700/714)": Klara reicht Hilfetexte bei 700 Zeichen beschnitten an die Modellkante
//       (`KlaraAssistant.tsx:310`), der deutsche Wert war 714, der niederlaendische 706 Zeichen lang.
// Der Ortsname steht deshalb wieder NUR im Zahnradtext (`dup.seitenhilfe.entscheidung.text`), und
// DU5c misst ihn dort weiter — als die jetzt EINZIGE Stelle, die ihn traegt. Auf `/hilfe` steht das
// Kapitel ohne diesen Nachbarn (`Help.tsx:163`); dass der Leser den Ort dort nicht erfaehrt, ist
// offen gemeldet und NICHT hier weggeredet. Neu ist DU5g: er haelt die Laenge je Sprache am
// GELESENEN Schnitt der Anwendung fest, damit ein wachsender Kapiteltext nicht wieder erst im Tor
// auffaellt.
//
// NICHT eingeloest, und darum unveraendert gepinnt:
//   DU4b        der geschlossene Fund faellt aus dem Abruf (`unresolved()`,
//               `services/conflicts/src/overlap-service.ts:933`) — „geloescht wird nichts" sieht
//               fuer einen Neuling genau so aus wie geloescht (Fehlertyp wie JOB 3795, REST
//               Punkt 2). JOB 3890 hat die ANZEIGE ausdruecklich nicht geaendert (das waere eine
//               Produktentscheidung); geaendert ist nur, dass das Kapitel diesen Weg jetzt SAGT.
//               DU4b bleibt und bestellt seine Loeschung erst, wenn sich die Anzeige aendert.
//
// RUNDE 2 (bens Korrekturpflichten zu Runde 1): jeder der FUENF Hilfeschluessel dieser Flaeche hat
// jetzt seinen EIGENEN Fall (DU5a–DU5e, s. dort), und die Nachher-Ablesung in DU3b haengt an einem
// nachweislich ERFOLGREICH ABGESCHLOSSENEN Abruf nach der Entscheidung — kalibriert von DU3d
// (verzoegerte Antwort) und DU3e (ausbleibende Antwort).
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
  /**
   * JOB 3949 — DIE ANFRAGEKOERPER, DIE KLARA WIRKLICH AN `POST /api/help/explain` SCHICKT.
   *
   * DU5g liest die Schnittgrenze aus dem QUELLTEXT und vergleicht sie mit der LAENGE der Ressource.
   * DU5i unten liest stattdessen, was tatsaechlich hinausgeht. Dafuer braucht die Endpunktattrappe
   * an zwei Stellen eine echte Antwort statt der leeren Liste:
   *   `help.explain`     — sonst gibt es keinen Koerper zu lesen,
   *   `reasoner.status`  — sonst ist der KI-Knopf hart ausgegraut (`useAiAvailable("answer")`,
   *                        `lib/aiAvailability.ts:35-55`) und die Handlung laeuft gar nicht erst.
   */
  const erklaerAnfragen: Array<{
    question: string;
    snippets: { id: string; title: string; body: string }[];
    locale?: string;
  }> = [];
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
      erklaerAnfragen.splice(0);
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
    /** Die bisher abgeschickten Anfragekoerper von `POST /api/help/explain`, in Reihenfolge. */
    erklaerAnfragen: (): typeof erklaerAnfragen => [...erklaerAnfragen],
    /**
     * `POST /api/help/explain`. Die Antwort ist bewusst die EHRLICHE LUECKE (`answered: false`):
     * dieser Prueffall misst, was HINAUSGEHT, nicht was zurueckkommt — eine erfundene Antwort waere
     * eine Behauptung ueber ein Modell, das hier gar nicht laeuft.
     */
    helpExplain: vi.fn(async (koerper: (typeof erklaerAnfragen)[number]) => {
      erklaerAnfragen.push(koerper);
      return {
        answered: false,
        answer: null,
        knowledgeClass: "unbekannt",
        trust: 0,
        sources: [],
        citedSources: [],
        steps: [],
        demo: true,
      };
    }),
    /** `GET /api/reasoner/status` — ein nutzbares Modell, sonst ist der KI-Knopf ausgegraut. */
    reasonerStatus: vi.fn(async () => ({
      active: true,
      mode: "cloud",
      reachable: "reachable",
      tasks: { answer: true },
    })),
    /**
     * `GET /api/reasoner/config` — die Blase neben dem KI-Knopf (`AiModelInfo`) liest sie. Der
     * leere Rueckfall der Attrappe (`[]`) ist hier NICHT gleichgueltig: `aiTaskInfo`
     * (`lib/reasonerTaskInfo.ts:54`) greift dann auf `config.effectiveProvider[task]` einer Liste
     * zu und die Montage stuerzt ab, bevor eine Frage hinausgeht.
     */
    reasonerConfig: vi.fn(async () => ({
      effectiveProvider: { answer: "cloud" },
      model: "Pruefstand-Modell",
    })),
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
      // JOB 3949 (DU5i): Klaras Weg zur Modellkante — beide Enden echt, s. `erklaerAnfragen` oben.
      help: mit({ explain: d.helpExplain }),
      reasoner: mit({ status: d.reasonerStatus, config: d.reasonerConfig }),
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

/**
 * WAS DAS KAPITEL MIT DEN ANDEREN TEXTEN DERSELBEN FLAECHE TEILT (JOB 3890) — je Sprache woertlich.
 *
 * Bis 3890 versprach das Kapitel eine Verknuepfung, die der Dienst nicht anlegt; die drei anderen
 * Hilfetexte verneinten sie. Jetzt tragen beide Seiten DIESELBEN Worte, und genau das messen DU3a,
 * DU5c, DU5d und DU5e: links die Stelle im KAPITEL, rechts die im Geschwistertext. Woertlich und
 * je Sprache, weil der Mensch die Sprache liest, die er eingestellt hat, und nicht den deutschen
 * Rueckfall — laeuft eine Sprache davon, nennt die Meldung sie.
 */
const UEBEREINSTIMMUNG = {
  /** DU3a (`dup.side.both`) und DU5e (`dup.intro`): wie die dritte Wahl heisst. */
  verwandt: {
    de: "als verwandt vermerken",
    en: "note as related",
    nl: "als verwant noteren",
  },
  /**
   * DU3a: die dritte Wahl, wie das Kapitel sie in seiner AUFZAEHLUNG nennt — je Sprache.
   *
   * Warum das neben `verwandt` noch einmal steht (Gegenprobe G2/G3 dieser Runde, gemessen): das
   * Kapitel nennt den Knopf ZWEIMAL — in der Aufzaehlung der vier Wahlen und noch einmal im Zitat
   * der Verneinung („und auch ‚als verwandt vermerken‘ legt keine Verknuepfung … an"). Ein Test,
   * der nur `verwandt` sucht, bleibt darum GRUEN, wenn allein die AUFZAEHLUNG auf „verknuepft
   * werden" zurueckfaellt — genau das ist in G2 passiert. Fuer Deutsch fing das die Anmeldung
   * `behauptung()` ab; EN und NL hatten keinen solchen Waechter. Jetzt haben sie einen.
   */
  dritteWahl: {
    de: "beide bleiben und als verwandt vermerkt werden",
    en: "both stay and are recorded as related",
    nl: "ze allebei blijven en als verwant genoteerd worden",
  },
  /** DU5c, Kapitel UND `dup.seitenhilfe.entscheidung.text`: keine Verknuepfung in den Objekten. */
  keineVerknuepfung: {
    de: "legt keine Verknüpfung in den Objekten an",
    en: "creates no link inside the objects",
    nl: "legt geen koppeling in de objecten aan",
  },
  /** DU5c, beide Texte: wohin der entschiedene Fund geht (gemessen in DU4b). */
  ausDerListe: {
    de: "aus der Liste und aus der Zahl am Reiter",
    en: "leaves the list and the number on the tab",
    nl: "uit de lijst en uit het getal op het tabblad",
  },
  /**
   * DU5c, NUR der Zahnradtext: WO die beiden Objekte nach der Entscheidung stehen.
   *
   * RUNDE 2 HATTE DIESE AUSKUNFT AUCH IM KAPITEL (bens Korrekturpflicht 1), RUNDE 3 HAT SIE DORT
   * WIEDER HERAUSGENOMMEN — gemessen, nicht aus Bequemlichkeit: die Hilfe-Suche ist eine
   * Teilstring-Suche ueber Titel + Text + Merkmale (`lib/helpTopics.ts:318-330`), und
   * `tests/review26-hilfe-import/hilfe-findet-dateiimport.test.ts:311` haelt fest, dass eine Suche
   * nach „bibliothek" GENAU `["library"]` liefert. Mit dem Ortsnamen im Kapitel lieferte sie
   * `["library", "duplikate"]` — Tor rot, und diese Datei darf den fremden Pin nicht anfassen.
   * Dazu kam der Schnitt bei 700 Zeichen (s. DU5g).
   *
   * Was bleibt, steht hier: der Zahnradtext ist damit die EINZIGE Stelle, die den Ort nennt. Faellt
   * er dort weg, nennt ihn keiner mehr — genau das macht dieser Eintrag rot. Auf `/hilfe` steht das
   * Kapitel ohne ihn (`apps/web/src/pages/Help.tsx:163`); dort erfaehrt der Leser den Ort heute
   * nicht (offener Punkt der Rueckgabe, keine Behauptung dieses Falls).
   *
   * `{{bibliothek}}` ist der Platzhalter fuer den Namen, den die Navigation traegt (`nav.library`):
   * der Zahnradtext setzt ihn zur LAUFZEIT ein (`Duplicates.tsx:254`). Er wird vor dem Vergleich
   * ersetzt — benennt die Navigation die Bibliothek um, wird dieser Fall rot, statt den Menschen
   * auf einen Punkt zu schicken, den es nicht mehr gibt.
   */
  bibliothekNachbar: {
    de: "unverändert in „{{bibliothek}}“",
    en: "unchanged in “{{bibliothek}}”",
    nl: "onveranderd in „{{bibliothek}}“",
  },
  /** DU5d, Kapitelseite: beide Objekte bleiben unveraendert (gemessen in DU3b/DU4a). */
  beideBleiben: {
    de: "beide Wissensobjekte bleiben unverändert bestehen",
    en: "both knowledge objects stay unchanged",
    nl: "beide kennisobjecten blijven ongewijzigd bestaan",
  },
  /** DU5d, Geschwisterseite `dup.help.detection.body`: dieselbe Zusage. */
  nichtsAnObjekten: {
    de: "an den beiden Objekten ändert sie nichts",
    en: "it changes neither of the two objects",
    nl: "aan de twee objecten verandert ze niets",
  },
  /** DU5e, Geschwisterseite `dup.intro`: dieselbe Zusage, dort „Beitraege" genannt. */
  nichtsAnBeitraegen: {
    de: "an den beiden Beiträgen ändert sie nichts",
    en: "it changes nothing in the two contributions",
    nl: "aan de twee bijdragen verandert ze niets",
  },
} as const;

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
// DU3 · B3 — „Du entscheidest, welche Seite maßgeblich ist, ob beide bleiben und als verwandt
//             vermerkt werden oder ob es gar kein Duplikat ist."
// ================================================================================================
describe("JOB 3804 DU3 · die vier Wahlen und eine wirklich ausgefuehrte", () => {
  it("DU3a: das Aktionsband bietet GENAU die vier Knoepfe an, an den echten Beschriftungen", async () => {
    behauptung("Du entscheidest");
    behauptung("welche Seite maßgeblich ist");
    behauptung("ob beide bleiben und als verwandt vermerkt werden");
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

    // ============================================================================================
    // UND DAS KAPITEL SAGT, WAS DER KNOPF SAGT (JOB 3890) — in jeder Sprache mit dessen Worten.
    // ============================================================================================
    //
    // Das ist der Pruefstein des Kapitels: es darf nicht mehr versprechen als die Beschriftung, auf
    // die der Mensch gleich danach klickt. Der Knopf `dup.side.both` heisst selbst schon ehrlich
    // „als verwandt vermerken"; laeuft er dem Kapitel wieder davon — etwa zurueck auf
    // „verknuepfen" —, wird GENAU dieser Fall rot und nennt die Sprache.
    for (const lng of SPRACHEN) {
      const kern = UEBEREINSTIMMUNG.verwandt[lng];
      const wahl = UEBEREINSTIMMUNG.dritteWahl[lng];
      expect(
        wert("dup.side.both", lng),
        `/duplikate (${lng}): die Beschriftung von \`dup.side.both\` nennt die dritte Wahl nicht mehr „${kern}“ — dann sagt der Knopf etwas anderes als das Kapitel darueber`,
      ).toContain(kern);
      expect(
        kapitel(lng),
        `/duplikate (${lng}): das Kapitel nennt die dritte Wahl nicht „${kern}“, also nicht mit den Worten ihres eigenen Knopfes`,
      ).toContain(kern);
      // Und zwar DORT, wo es die vier Wahlen aufzaehlt — nicht bloss im Zitat der Verneinung
      // weiter hinten im selben Satz (s. `dritteWahl` oben: ohne diese Zeile blieb der Fall in
      // G2/G3 gruen, obwohl EN bzw. NL in der Aufzaehlung wieder „verknuepft werden" versprach).
      expect(
        kapitel(lng),
        `/duplikate (${lng}): die Aufzaehlung des Kapitels sagt nicht „${wahl}“ — dort verspricht es dann wieder etwas anderes als sein eigener Knopf`,
      ).toContain(wahl);
    }
  });

  it("DU3b: eine WIRKLICH ausgefuehrte Wahl — und an beiden Wissensobjekten aendert sich nichts", async () => {
    behauptung("ob beide bleiben und als verwandt vermerkt werden");
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
      "/duplikate: die Wahl hat die gezeichneten Wissensobjekte veraendert — eine Verknüpfung in den Objekten oder ein Zusammenführen waere genau das",
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
// DU5 · VIER TEXTE FUER DIESELBE FLAECHE — und seit JOB 3890 sagen sie alle dasselbe.
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
// etwas."). Das KAPITEL hat es nicht angefasst — es lag ausserhalb seiner Zielpfade; JOB 3890 hat
// es nachgezogen. DU5c/DU5d/DU5e messen seither je Schluessel, dass Kapitel und Geschwistertext
// DIESELBE Aussage tragen: ein Fall je Schluessel, eine Meldung je Sprache, und die Verstellung des
// GEGENSTUECKS macht den Fall genauso rot wie die des Kapitels (das ist der Unterschied zu einem
// Text, der nur gegen sich selbst geprueft wird).
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
  /**
   * Die geoeffnete Seitenhilfe der gemounteten Seite, als EIN gelesener Fliesstext.
   *
   * JOB 3949: der EINE vorhandene Oeffnungsweg, jetzt in JEDER Sprache begehbar — kein zweiter
   * entsteht. Ohne Angabe bleibt es bei Deutsch, also bei dem, was `beforeEach` (`:607-608`)
   * ohnehin gesetzt hat: jeder Bestandsfall laeuft unveraendert weiter.
   */
  async function seitenhilfe(lng: (typeof SPRACHEN)[number] = "de"): Promise<string> {
    await i18n.changeLanguage(lng);
    await montiereMitHuelle();
    await klicke(marke("kopfband-zahnrad"));
    await klicke(marke("zahnrad-seitenhilfe"));
    const liste = marke("seitenhilfe-liste");
    expect(liste, "/duplikate: die Seitenhilfe zeigt keine Liste").not.toBeNull();
    return (liste?.textContent ?? "").replace(/\s+/g, " ");
  }

  /**
   * Klaras Weg zur Modellkante, EINMAL begangen: Panel oeffnen, Frage tippen, „Mit
   * KI-Unterstuetzung suchen" druecken.
   *
   * Montiert wird ueber `montiereMitHuelle()` — dieselbe eine Huelle wie bei `seitenhilfe()`
   * (`AppShell` traegt `KlaraAssistant`, `AppShell.tsx:113,154`). Es entsteht kein zweiter
   * Oeffnungsweg und keine zweite Klara-Strecke: gelesen wird allein der Anfragekoerper, den die
   * Endpunktattrappe ohnehin entgegennimmt.
   *
   * Der Wert des Suchfeldes wird ueber den PROTOTYP-Setter gesetzt und mit einem `input`-Ereignis
   * gemeldet: React haengt seinen eigenen Setter an das Element, ein blosses `feld.value = …` liefe
   * an seinem Zustand vorbei und die Frage bliebe leer.
   */
  async function klaraFragt(lng: (typeof SPRACHEN)[number], frage: string): Promise<void> {
    await i18n.changeLanguage(lng);
    await montiereMitHuelle();
    const oeffner = container.querySelector<HTMLButtonElement>("button[data-klara='1']");
    expect(oeffner, "/duplikate: die Huelle traegt gar keinen Klara-Knopf").not.toBeNull();
    await klicke(oeffner);
    const feld = container.querySelector<HTMLInputElement>("section[data-klara='1'] input");
    expect(feld, "/duplikate: Klaras Panel ist nicht offen — es gibt kein Suchfeld").not.toBeNull();
    await act(async () => {
      const setzer = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      setzer?.call(feld, frage);
      feld?.dispatchEvent(new Event("input", { bubbles: true }));
      await flush();
    });
    const kiKnopf = [
      ...container.querySelectorAll<HTMLButtonElement>("section[data-klara='1'] button"),
    ].find((b) => (b.textContent ?? "").includes(i18n.t("klara.aiSearch")));
    expect(
      kiKnopf,
      "/duplikate: Klaras Panel hat keinen Knopf „Mit KI-Unterstützung suchen“",
    ).toBeDefined();
    expect(
      kiKnopf?.disabled,
      "/duplikate: der KI-Knopf ist ausgegraut — die Frage geht gar nicht hinaus, und der Fall misst nichts",
    ).toBe(false);
    await klicke(kiKnopf);
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

  it("DU5c: `dup.seitenhilfe.entscheidung.text` steht UNTER dem Kapitel — und sagt dasselbe", async () => {
    behauptung("ob beide bleiben und als verwandt vermerkt werden");
    const gelesen = await seitenhilfe();
    const entscheidung = wert("dup.seitenhilfe.entscheidung.text").replace(
      "{{bibliothek}}",
      wert("nav.library"),
    );
    expect(
      gelesen,
      "/duplikate: `dup.seitenhilfe.entscheidung.text` steht nicht in der Seitenhilfe — seine HelpTip-Anmeldung (`Duplicates.tsx:252-255`) fehlt",
    ).toContain(entscheidung);
    // BEIDE stehen dem Menschen in EINER Liste vor Augen — darum muessen sie dasselbe sagen.
    expect(
      gelesen,
      "/duplikate: Kapitel und Zahnradtext stehen nicht in derselben Liste — dann liest der Mensch sie nicht untereinander",
    ).toContain(kapitel());
    expect(
      gelesen.indexOf(entscheidung),
      "/duplikate: der Zahnradtext steht VOR dem Kapitel — die Reihenfolge der Seitenhilfe ist eine andere geworden",
    ).toBeGreaterThan(gelesen.indexOf(kapitel()));

    // ============================================================================================
    // DIE UEBEREINSTIMMUNG (JOB 3890, vorher NACHFUEHR-PIN) — gemessen an ZWEI Schluesseln:
    //   `help.duplikate.body`                 (apps/web/src/i18n.ts, DE/EN/NL)
    //   `dup.seitenhilfe.entscheidung.text`   (apps/web/src/i18n.ts, DE/EN/NL)
    // ============================================================================================
    //
    // ZWEI Aussagen teilen sie sich: dass „als verwandt vermerken" KEINE Verknuepfung in den
    // Objekten anlegt (`overlap-service.ts:673-675` → `close`, `:732-749`) und wohin der
    // entschiedene Fund geht (`unresolved()`, `:933`; auf der Flaeche gemessen in DU4b). Die dritte
    // Auskunft — WO die beiden Objekte danach stehen — traegt seit Runde 3 allein der Zahnradtext
    // (`bibliothekNachbar`, s. dort, mit der gemessenen Begruendung). Weil hier BEIDE Texte gelesen
    // werden, wird dieser Fall auch dann rot, wenn nicht das Kapitel, sondern sein Gegenstueck
    // ausschert.
    for (const lng of SPRACHEN) {
      const benennung = (muster: string): string =>
        muster.replace("{{bibliothek}}", wert("nav.library", lng));
      const nachbar = benennung(wert("dup.seitenhilfe.entscheidung.text", lng));
      const keine = UEBEREINSTIMMUNG.keineVerknuepfung[lng];
      const liste = UEBEREINSTIMMUNG.ausDerListe[lng];
      const woNachbar = benennung(UEBEREINSTIMMUNG.bibliothekNachbar[lng]);
      expect(
        nachbar,
        `/duplikate (${lng}): der Zahnradtext verneint die Verknuepfung nicht mehr mit „${keine}“ — dann sagen die zwei Texte im Zahnrad wieder Verschiedenes`,
      ).toContain(keine);
      expect(
        kapitel(lng),
        `/duplikate (${lng}): das Kapitel verneint die Verknuepfung nicht mit „${keine}“ — es verspricht dann mehr als der Dienst tut`,
      ).toContain(keine);
      expect(
        nachbar,
        `/duplikate (${lng}): der Zahnradtext sagt nicht mehr „${liste}“ — dann steht das Kapitel mit dieser Auskunft allein`,
      ).toContain(liste);
      expect(
        kapitel(lng),
        `/duplikate (${lng}): das Kapitel sagt nicht „${liste}“ — dann bleibt offen, wohin der entschiedene Fund geht (DU4b)`,
      ).toContain(liste);
      expect(
        nachbar,
        `/duplikate (${lng}): der Zahnradtext sagt nicht mehr „${woNachbar}“ — dann nennt auf dieser Flaeche NIEMAND mehr den Ort, an dem die zwei Objekte weiter stehen; das Kapitel darf ihn nicht nennen (Hilfe-Suche, s. \`bibliothekNachbar\`)`,
      ).toContain(woNachbar);
    }
  });

  it("DU5d: `dup.help.detection.body` steht im „?“ — und das Kapitel sagt dieselbe Wirkung zu", async () => {
    const gelesen = await fragezeichen();
    expect(
      gelesen,
      "/duplikate: `dup.help.detection.body` steht nicht im „?“ — der Erkennungsblock (`Duplicates.tsx:218-220`) fehlt",
    ).toContain(wert("dup.help.detection.body"));
    // Der „?"-Text verneint jede Wirkung an den beiden Objekten; das Kapitel sagt seit JOB 3890
    // dasselbe von der positiven Seite („beide bleiben unveraendert bestehen"). Gemessen ist das in
    // DU3b (die gezeichneten Objekte sind vorher und nachher gleich) und DU4a (keines verschwindet).
    for (const lng of SPRACHEN) {
      const verneinung = UEBEREINSTIMMUNG.nichtsAnObjekten[lng];
      const bleiben = UEBEREINSTIMMUNG.beideBleiben[lng];
      expect(
        wert("dup.help.detection.body", lng),
        `/duplikate (${lng}): \`dup.help.detection.body\` verneint die Wirkung an den Objekten nicht mehr mit „${verneinung}“`,
      ).toContain(verneinung);
      expect(
        kapitel(lng),
        `/duplikate (${lng}): das Kapitel sagt nicht „${bleiben}“ — dann sagt das „?“ etwas anderes als die Seitenhilfe`,
      ).toContain(bleiben);
    }
  });

  it("DU5e: `dup.intro` steht im „?“ — und nennt die dritte Wahl wie das Kapitel", async () => {
    const gelesen = await fragezeichen();
    expect(
      gelesen,
      "/duplikate: `dup.intro` steht nicht im „?“ — der Einleitungsblock (`Duplicates.tsx:221-226`) fehlt",
    ).toContain(wert("dup.intro"));
    // `dup.intro` zaehlt die drei Entscheidungen bei ihrem Namen auf und verneint jede Wirkung an
    // den beiden Beitraegen. Seit JOB 3890 nennt das Kapitel die dritte Wahl mit genau diesem Namen.
    for (const lng of SPRACHEN) {
      const verneinung = UEBEREINSTIMMUNG.nichtsAnBeitraegen[lng];
      const kern = UEBEREINSTIMMUNG.verwandt[lng];
      expect(
        wert("dup.intro", lng),
        `/duplikate (${lng}): \`dup.intro\` verneint die Wirkung an den Beitraegen nicht mehr mit „${verneinung}“`,
      ).toContain(verneinung);
      expect(
        wert("dup.intro", lng),
        `/duplikate (${lng}): \`dup.intro\` nennt die dritte Wahl nicht mehr „${kern}“`,
      ).toContain(kern);
      expect(
        kapitel(lng),
        `/duplikate (${lng}): das Kapitel nennt die dritte Wahl nicht „${kern}“ wie das „?“ darueber`,
      ).toContain(kern);
    }
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

  // ----------------------------------------------------------------------------------------------
  // DU5g (JOB 3890 RUNDE 3) — DER SATZ, DEN KLARA WEITERREICHT, IST DERSELBE SATZ.
  // ----------------------------------------------------------------------------------------------
  //
  // WAS IN RUNDE 2 PASSIERT IST, gemessen im Tor: das gewachsene Kapitel war in DE 714 und in NL 706
  // Zeichen lang. Klara schneidet jeden Schnipsel, den sie an die Modellkante reicht, bei 700
  // (`apps/web/src/components/KlaraAssistant.tsx:310`) — der deutsche Text ging also GEKUERZT
  // hinaus, und weggefallen war ausgerechnet sein ehrlicher Schluss. Gemeldet hat es
  // `tests/app/f0304-klara-assistenzflaeche.test.tsx` („topic:duplikate: Text beschnitten
  // (700/714)"), und zwar ERST im Tor.
  //
  // WARUM DIESER FALL TROTZ A3 STEHT und ihn nicht verdoppelt: A3 misst den WIRKLICH uebertragenen
  // Anfragekoerper — das ist mehr, aber es ist nur DEUTSCH (`locale: "de"`) und nur, solange das
  // Kapitel unter den zwoelf bestplatzierten Schnipseln bleibt. Die niederlaendische Fassung lag mit
  // 706 Zeichen genauso ueber dem Schnitt und wurde von NICHTS bemerkt. Hier steht darum die
  // sprachweise Grenze, und zwar am GELESENEN Schnitt der Anwendung, nicht an einer im Test
  // wiederholten 700 (das war der Fehler, den JOB 3830 an `faq-sagt-kein-verschmelzen.test.ts:199`
  // geruegt hat: ein Waechter, der seine eigene Konstante misst, bleibt gruen, wenn die Anwendung
  // sich aendert).
  it("DU5g: das Kapitel passt in JEDER Sprache in den Schnitt, mit dem Klara es weiterreicht", () => {
    const quelle = readFileSync(
      join(__dirname, "..", "..", "apps", "web", "src", "components", "KlaraAssistant.tsx"),
      "utf8",
    );
    const roh = /body:\s*e\.body\.slice\(0,\s*(\d+)\)/.exec(quelle)?.[1];
    expect(
      roh,
      "KlaraAssistant.tsx schneidet den Schnipseltext nicht mehr mit `e.body.slice(0, …)` — dieser Fall liest die Grenze dort und misst ohne sie nichts",
    ).toBeDefined();
    const schnitt = Number(roh);
    for (const lng of SPRACHEN) {
      const text = kapitel(lng);
      expect(
        text.length,
        `/duplikate (${lng}): das Kapitel ist ${text.length} Zeichen lang und wird auf dem Weg zur KI bei ${schnitt} abgeschnitten (KlaraAssistant.tsx) — der Schluss des Satzes geht dabei still verloren`,
      ).toBeLessThanOrEqual(schnitt);
    }
  });

  // ----------------------------------------------------------------------------------------------
  // DU5i (JOB 3949) — WAS WIRKLICH HINAUSGEHT, WENN EIN NIEDERLAENDER KLARA FRAGT.
  // ----------------------------------------------------------------------------------------------
  //
  // DIE BESTELLUNG (Pruefer BEN, `archiv/3890/runde-3/ben.md:30`, Pruefpunkt 6, woertlich): „DU5g
  // prueft eine Quelltextgrenze; ergaenzend sollte die tatsaechliche NL-Uebertragung geprueft
  // werden."
  //
  // DER UNTERSCHIED ZU DU5g DARUEBER: DU5g liest die Grenze aus dem Quelltext und haelt die LAENGE
  // DER RESSOURCE dagegen — er schliesst also, dass der Text ungekuerzt ankommt. Hier wird er
  // GELESEN: der Anfragekoerper, den `endpoints.help.explain` wirklich bekommt. Und er wird nicht
  // gegen eine im Test wiederholte Zahl gehalten (das war JOB 3830s Ruege, s. DU5g), sondern gegen
  // die Ressource selbst: zeichengleich heisst ungekuerzt, ganz ohne Konstante.
  //
  // REPARIERT AM 14.09.2026 IN JOB 3980, an beiden Stellen: `KlaraAssistant.tsx` benutzt jetzt den
  // Helfer `toReasonerLocale` statt einer eigenen Zuordnung, und `normalizeLocale` in
  // `services/app/src/routes/help-routes.ts` nimmt `"nl"` an — die Abbildung von UI-Sprache auf
  // Reasoner-Sprache lebt im Web damit an GENAU EINER Stelle, `apps/web/src/lib/reasonerLocale.ts`.
  // Die Zeile unten ist deshalb kein Nachfuehr-Pin mehr, sondern die Zusicherung des reparierten
  // Zustands; dass die Sprache bis ans Argument von `reasoner.helpAnswer` durchreist — also hinter
  // BEIDE Stellen —, misst `tests/klara-hilfe-niederlaendisch/nl-erreicht-die-hilfe-ki.test.tsx`
  // (NL1), denn dieser Fall hier liest die Endpunktattrappe und sieht den Server gar nicht.
  //
  // Nicht behauptet wird hier: dass die Modellkante mit `"nl"` etwas Besseres antwortete. Gemessen
  // ist allein das Etikett und der Text, der es traegt.
  it("DU5i: die Frage eines Niederlaenders geht mit niederlaendischem Text UND niederlaendischem Etikett hinaus", async () => {
    // Die Frage traegt vier Woerter aus dem niederlaendischen Kapitel, damit `rankKlara`
    // (`klaraRegistry.ts:289-311`, Wortdeckung ueber Titel + Text) es unter die zwoelf Schnipsel
    // hebt. Bleibt es aus, misst der Fall nichts — und sagt das unten, statt still gruen zu sein.
    await klaraFragt("nl", "duplicaat verwant genoteerd tabblad");

    const anfragen = d.erklaerAnfragen();
    expect(
      anfragen.length,
      "/duplikate (nl): es ist gar keine Anfrage an `POST /api/help/explain` hinausgegangen — die Handlung lief nicht, und der Fall misst nichts",
    ).toBe(1);
    const koerper = anfragen[0];
    if (koerper === undefined) {
      throw new Error(
        "/duplikate (nl): der gezaehlte Anfragekoerper laesst sich nicht lesen — die Vorrichtung ist kaputt",
      );
    }

    const kapitelId = `topic:${kapitelSchluessel().bodyKey.split(".")[1]}`;
    const uebertragen = koerper.snippets.find((s) => s.id === kapitelId);
    expect(
      uebertragen,
      `/duplikate (nl): das Kapitel (\`${kapitelId}\`) ist unter den ${koerper.snippets.length} mitgereichten Schnipseln gar nicht dabei — dann sagt dieser Fall nichts ueber seine Uebertragung. Mitgereicht wurden: ${koerper.snippets.map((s) => s.id).join(", ")}`,
    ).toBeDefined();

    // 1. UNGEKUERZT — zeichengleich mit der Ressource DIESER Sprache, ohne wiederholte Konstante.
    const quelle = kapitel("nl");
    expect(
      quelle.length,
      "/duplikate (nl): das Kapitel ist in der niederlaendischen Ressource leer — dann waere jeder Vergleich darunter wertlos",
    ).toBeGreaterThan(40);
    expect(
      uebertragen?.body,
      `/duplikate (nl): der uebertragene Text ist ${uebertragen?.body.length} Zeichen lang, das Kapitel ${quelle.length} — auf dem Weg zur Modellkante geht sein Schluss still verloren (Schnitt in KlaraAssistant.tsx, s. DU5g)`,
    ).toBe(quelle);
    // 2. UND ES IST WIRKLICH DER NIEDERLAENDISCHE Text, nicht der deutsche Rueckfall.
    expect(
      uebertragen?.body,
      "/duplikate (nl): es geht der DEUTSCHE Kapiteltext hinaus — der Mensch hat Niederlaendisch eingestellt",
    ).not.toBe(kapitel("de"));

    // 3. DAS ETIKETT der Anfrage. Begruendung im Block darueber (JOB 3980).
    expect(
      koerper.locale,
      "/duplikate (nl): der Mensch hat Niederlaendisch eingestellt, die Anfrage traegt aber ein anderes Sprachetikett — die Abbildung in `apps/web/src/lib/reasonerLocale.ts` wird von `KlaraAssistant.tsx` nicht mehr benutzt oder ist selbst verstellt",
    ).toBe("nl");
  });

  // ----------------------------------------------------------------------------------------------
  // DU5h (JOB 3949) — DIE GEOEFFNETE SEITENHILFE IN SEINER SPRACHE, NICHT NUR IN DER RESSOURCE.
  // ----------------------------------------------------------------------------------------------
  //
  // DIE BESTELLUNG (Pruefer BEN, `archiv/3890/runde-3/ben.md:30`, Pruefpunkt 6, woertlich — und
  // unerledigt schon seit Runde 1, `archiv/3890/runde-1/ben.md:29`): „EN/NL werden ueberwiegend als
  // Ressourcen geprueft; die Zieltests montieren Deutsch (`Testdatei:616`). Ergaenzender
  // Testvorschlag: geoeffnete Duplikate-Seitenhilfe nach Sprachwechsel lesen."
  //
  // WAS HIER NEU IST UND WAS NICHT — das ist die ganze Luecke in einem Satz. Die Tabelle
  // `UEBEREINSTIMMUNG` (`:351-429`) misst EN und NL seit JOB 3890, aber gegen die RESSOURCE
  // (`wert(key, lng)`); ihr eigener Kopfkommentar (`:348-349`) sagt den Grund, „weil der Mensch die
  // Sprache liest, die er eingestellt hat, und nicht den deutschen Rueckfall". Auf den BILDSCHIRM
  // schaut sie in zwei von drei Sprachen nie. DU5a/DU5b/DU5c schauen auf den Bildschirm — aber nur
  // auf Deutsch (`beforeEach`, `:607-608`). Die sechs Faelle hier schliessen genau dieses Kreuz.
  //
  // ERGAENZT, NICHT VERDOPPELT: der Ressourcenvergleich bleibt, wo er ist. Die Ressource belegt
  // weiter die QUELLE, neu ist die ANZEIGE — dieselbe Aufteilung, die
  // `tests/seitenhilfe-admin/protokollhilfe-geladene-zustaende.test.tsx` schon fuehrt. Benutzt wird
  // der EINE vorhandene Oeffnungsweg `seitenhilfe()` (`:1139-1147`), jetzt mit Sprachangabe; ein
  // zweiter entsteht nirgends, und Deutsch bleibt bei DU5a/DU5b/DU5c.
  //
  // EINZELN BEISSEND, JE SPRACHE (Lehre JOB 3587 R4 und der Dateikopf `:1127-1131`): je Schluessel
  // UND Sprache ein eigener Fall. Faellt der Text EINER Sprache aus, wird GENAU ihr Fall rot und die
  // Meldung nennt Route, Schluessel und Sprache. Kein Mengenwaechter, und kein `toContain("")`: was
  // erwartet wird, muss vorher nachweislich nicht leer sein (Lehre JOB 3891 R1).
  const ANGEZEIGT = [
    {
      schluessel: "help.duplikate.body",
      /** Das Kapitel der Route, wie DU5a es auf Deutsch liest. */
      text: (lng: (typeof SPRACHEN)[number]): string => kapitel(lng),
      fehlt: "das Kapitel erreicht den Menschen auf dieser Flaeche gar nicht",
    },
    {
      schluessel: "dup.seitenhilfe.flaeche.text",
      /** Der Zahnradtext zur Flaeche — mit dem Aufklapper-Namen DIESER Sprache eingesetzt. */
      text: (lng: (typeof SPRACHEN)[number]): string =>
        wert("dup.seitenhilfe.flaeche.text", lng).replace("{{mehr}}", wert("pruefen.more", lng)),
      fehlt: "seine HelpTip-Anmeldung (`Duplicates.tsx:248-251`) fehlt",
    },
    {
      schluessel: "dup.seitenhilfe.entscheidung.text",
      /** Der Zahnradtext zur Entscheidung — mit dem Ortsnamen DIESER Sprache eingesetzt. */
      text: (lng: (typeof SPRACHEN)[number]): string =>
        wert("dup.seitenhilfe.entscheidung.text", lng).replace(
          "{{bibliothek}}",
          wert("nav.library", lng),
        ),
      fehlt: "seine HelpTip-Anmeldung (`Duplicates.tsx:252-255`) fehlt",
    },
  ] as const;

  for (const eintrag of ANGEZEIGT) {
    // Deutsch steht bei DU5a/DU5b/DU5c und wird hier nicht wiederholt.
    for (const lng of ["en", "nl"] as const) {
      it(`DU5h: \`${eintrag.schluessel}\` steht in der geoeffneten Seitenhilfe — ${lng}, nicht der deutsche Rueckfall`, async () => {
        const erwartet = eintrag.text(lng);
        const deutsch = eintrag.text("de");
        // 1. Ohne Sollwert misst der Fall nichts: `toContain("")` waere immer erfuellt. Genau so
        //    faellt dieser Fall aus, wenn der Schluessel in DIESER Sprache fehlt — `wert()` liest
        //    die Ressource ohne Rueckfall auf Deutsch (`:311-314`).
        expect(
          erwartet.length,
          `/duplikate (${lng}): \`${eintrag.schluessel}\` fehlt in der Ressource dieser Sprache — der Mensch bekaeme hier den deutschen Rueckfall, und jede Suche nach dem Sollwert waere leer`,
        ).toBeGreaterThan(0);
        // 2. Und er muss sich von Deutsch unterscheiden, sonst kann kein DOM-Nachweis der Welt den
        //    Rueckfall von der Uebersetzung trennen.
        expect(
          erwartet,
          `/duplikate (${lng}): \`${eintrag.schluessel}\` traegt woertlich den deutschen Text — dann ist an der Anzeige nicht zu erkennen, ob die Uebersetzung oder der Rueckfall dasteht`,
        ).not.toBe(deutsch);

        const gelesen = await seitenhilfe(lng);

        // 3. Die Liste muss ueberhaupt Text tragen — sonst ist jede Suche darin wertlos.
        expect(
          gelesen.length,
          `/duplikate (${lng}): die Seitenhilfe-Liste ist leer — sie wurde gar nicht geoeffnet`,
        ).toBeGreaterThan(0);
        // 4. DER NACHWEIS: der Satz SEINER Sprache steht auf dem Bildschirm.
        expect(
          gelesen,
          `/duplikate (${lng}): \`${eintrag.schluessel}\` steht nicht in der geoeffneten Seitenhilfe — ${eintrag.fehlt}`,
        ).toContain(erwartet);
        // 5. Und der deutsche Satz steht dort NICHT daneben: waere er es, laege der Rueckfall vor
        //    und nicht die eingestellte Sprache.
        expect(
          gelesen,
          `/duplikate (${lng}): die geoeffnete Seitenhilfe zeigt den DEUTSCHEN Text von \`${eintrag.schluessel}\` — der Mensch liest den Rueckfall statt seiner Sprache`,
        ).not.toContain(deutsch);
      });
    }
  }
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
