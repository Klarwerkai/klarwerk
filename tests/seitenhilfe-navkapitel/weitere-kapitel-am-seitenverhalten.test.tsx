// @vitest-environment jsdom
// ================================================================================================
// JOB 3795 — DREI WEITERE KAPITEL WERDEN AM VERHALTEN IHRER EIGENEN SEITE BELEGT.
// ================================================================================================
//
// DIE BESTELLUNG (`archiv/3741/runde-4/RUECKGABE.md:94`, woertlich): die Kapitel `/konflikte`,
// `/output` und `/graph` tragen „Zuordnungs-, Uebersetzungs-, DOM- und Suchbeleg, aber KEINEN
// gemounteten Verhaltensbeleg ihrer jeweiligen Seite".
//
// WARUM DAS KEIN FORMALISMUS IST: dieselbe Pruefung hat in JOB 3741 Runde 1 DREI von drei
// untersuchten Texten als falsch entlarvt (Themenkarte unter 900 px gar nicht vorhanden; „liegt das
// an deiner Rolle" falsch; „danach rueckt der naechste nach" frei erfunden). Ein Erklaersatz, der
// etwas verspricht, was die Seite nicht tut, ist fuer einen Neuling schlimmer als gar keiner — er
// sucht dann einen Knopf, den es nicht gibt.
//
// DIE BAUFORM IST DIE DES NACHBARN `die-texte-stimmen-mit-der-seite.test.tsx`: je Behauptung stehen
// ZWEI Dinge nebeneinander — das gemessene Verhalten der GEMOUNTETEN Seite UND der Satz, der es
// beschreibt. Der Satz wird dabei aus dem heutigen Bestand GELESEN (`behauptung()` unten), nicht
// abgeschrieben; verschwindet eine Behauptung aus dem Kapitel, faellt GENAU ihr Fall rot auf und
// nennt Route und Behauptung (Lehre JOB 3587 R4: ein Zaehlwaechter, der Einzelentfernungen nicht
// bemerkt, ist kein Waechter).
//
// WAS DIESE DATEI AUSDRUECKLICH NICHT WIEDERHOLT:
//   · `zahnrad-zeigt-den-erklaersatz.test.tsx` montiert das KOPFBAND und liest, dass Titel und Text
//     der Route dort STEHEN. Hier wird die SEITE montiert und gemessen, ob der Text STIMMT.
//   · `tests/wissensgraph-lesbarkeit/graph-lesbarkeit.test.tsx` belegt das Verhalten des Graphen
//     fuer sich (eindeutige Beschriftungen, Trefferflaechen, Ladezustaende). Neu ist hier allein die
//     BINDUNG dieses Verhaltens an `help.graph.body`.
//
// ZWEI SAETZE STIMMEN NICHT OHNE BEDINGUNG — sie werden hier gemessen und als Nachfuehr-Pin
// festgehalten, NICHT repariert (sie brauchen eine Entscheidung ueber das PRODUKT, nicht ueber den
// Text allein): KF1d (die dritte Wahl gibt es nur am automatisch erkannten Konflikt) und KF1e (das
// entschiedene Paar verschwindet vom Brett).
//
// ================================================================================================
// JOB 3889 — DER DRITTE PIN IST EINGELOEST: GF3d MISST DIE BEDINGUNG, STATT SIE ZU VERMISSEN.
// ================================================================================================
// DIE BESTELLUNG steht woertlich in `archiv/3795/runde-5/RUECKGABE.md:67`: „`help.graph.body`
// (`apps/web/src/i18n.ts:5063-5064`): ‚Ein Klick auf einen Knoten fuehrt zu dem Wissensobjekt
// dahinter, und mit der Tastatur springst du von Knoten zu Knoten.' Beides gilt NUR fuer Knoten,
// deren Objekt im aktuellen Bestand liegt (`isNavigableNode`, `apps/web/src/lib/graphNav.ts:12`) …
// Bemerkenswert: die zweite Seitenhilfe DERSELBEN Seite nennt die Bedingung bereits
// (`seitenhilfe.graph.text`) — im Zahnrad stehen beide Saetze untereinander, der eine mit Bedingung,
// der andere ohne. Gemessen in GF3d."
//
// SEIT JOB 3889 nennt `help.graph.body` die Bedingung, in DE, EN und NL. Der alte GF3d war ein
// NACHFUEHR-PIN: er hielt mit einer Schleife `.not.toContain(["bestand", "bekannt"])` fest, dass der
// Satz sie NICHT nennt, und bestellte in seiner eigenen Fehlermeldung seine Ablesung. Diese Schleife
// ist WEG — ERSETZT, nicht ergaenzt. An ihrer Stelle stehen GF3d und GF3g-DE/EN/NL (siehe unten).
//
// ================================================================================================
// JOB 3889 · RUNDE 2 — DIE BEIDEN KORREKTURPFLICHTEN VON BEN, UND WAS SIE AN DER BAUFORM AENDERN.
// ================================================================================================
//
// (1) GELESEN WIRD, WAS DASTEHT — NICHT, WAS HINTERLEGT IST. Der GF3d der Runde 1 las den Satz ueber
//     `wert()`/`i18n.getResource`, also neben der Oberflaeche vorbei. BEN hat das gemessen: friert
//     man DEN Testhelfer auf den heutigen deutschen Satz ein und setzt zugleich den ECHTEN deutschen
//     Produkttext auf seine alte, bedingungslose Fassung zurueck, bleibt die ganze Datei gruen
//     (`Tests 20 passed`) — ein Rueckfall genau des Satzes, um den es geht, faellt nicht auf.
//     Seit dieser Runde montieren GF3d und GF3g das ECHTE Zahnrad-Menue neben die Seite, oeffnen
//     „Seitenhilfe" und lesen `[data-testid="seitenhilfe-liste"]`. In dieser Liste stehen BEIDE
//     Saetze untereinander — der Nav-Erklaersatz `help.graph.body` und der `HelpTip` der Seite,
//     `seitenhilfe.graph.text` (`pages/Stufe2.tsx:2061`). Das ist der Ort, an dem Pedi den
//     Widerspruch gesehen hat, und jetzt der Ort, an dem er gemessen wird.
//
//     NACHGEFUEHRT IN RUNDE 3: „aus der Liste lesen" reichte noch nicht — siehe (4).
//
// (2) DIE FEINEN KANTEN GEHOEREN DEM NACHBARN, NICHT DIESER DATEI. Der GF3d der Runde 1 baute
//     Tabstopp-, Enter- und Klickmessungen des unbekannten Knotens erneut auf, die U1–U3 in
//     `tests/wissensgraph-lesbarkeit/unbekannter-knoten-ist-kein-link.test.tsx` bereits enthalten
//     (dazu U4 Fokusring und U5 Zeigerkreuz). Sie sind hier ENTFERNT. GF3d liest von der Flaeche nur
//     noch den Unterschied, den der Satz behauptet — welche Knoten ein Link sind und welche nicht —
//     und sieht seinem Eigentuemer nach, dass es ihn noch gibt; der Sprung des BEKANNTEN Knotens an
//     sein Objekt steht unveraendert in GF3b und GF3c.
//
// (4) RUNDE 3 · EIN LISTENTEXT IST KEIN SATZ. Die Runde 2 las die geoeffnete Liste als EINEN Text
//     (`textContent` des `<ul>`) und suchte darin die Wendung „aus dem Bestand". Diese Wendung steht
//     aber in BEIDEN Eintraegen — der Erklaersatz konnte seine Bedingung verlieren, ohne dass etwas
//     rot wurde, weil die Schwesterhilfe sie weiter trug. BEN hat genau das gemessen: „Gehoert ein
//     Knoten zu einem Objekt aus dem Bestand, fuehrt ein Klick …" durch „Bei jedem Knoten fuehrt ein
//     Klick …" ersetzt, Negativsatz und Schwesterhilfe unveraendert, keine Teste geaendert —
//     `Tests 20 passed (20)`. Der Satz versprach dem Leser wieder mehr, als die Seite haelt, und der
//     Waechter schwieg. Seit dieser Runde liest `seitenhilfeEintraege()` je `<li>` Titel und Text
//     getrennt, und `beideEintraegeTragenDieBedingung()` prueft JEDEN Eintrag fuer sich — auch die
//     Schwesterhilfe, damit auch SIE ihre Bedingung nicht unbemerkt verlieren kann.
//
// (5) RUNDE 4 · EINE VORHANDENE BEDINGUNG IST KEINE FEHLENDE ZUSAGE. Die Runde 3 prueft je Eintrag,
//     ob die Bedingung DA IST (`.toContain`). Damit faellt auf, wenn ein Satz sie VERLIERT — aber
//     nicht, wenn er sie behaelt und daneben eine zweite, unbedingte Zusage DAZUSAGT. Gemessen in
//     dieser Runde, bevor etwas gebaut wurde: in den deutschen Erklaersatz wurde vor dem
//     Negativsatz „; ein Klick auf jeden Knoten oeffnet sein Wissensobjekt" EINGEFUEGT — Bedingung,
//     Negativsatz und Schwesterhilfe unveraendert, kein Test angefasst. Ergebnis
//     `Tests 20 passed (20)` (Arbeitspruefung b1bdaef5…, Exit 0). Der Leser bekam damit wieder eine
//     Zusage, die die Flaeche nicht haelt — „Filterwechsel Werk 3" ist im selben DOM KEIN Link —,
//     und der Waechter schwieg.
//
//     SEIT DIESER RUNDE prueft `keineUnbedingteZusage()` die Saetze nicht mehr nur auf Anwesenheit
//     einer Wendung, sondern GLIEDWEISE: der gezeichnete Satz wird an `.` und `;` zerlegt, und JEDES
//     Glied, das von Klick oder Tastatur spricht, muss entweder die Bedingung tragen oder eine
//     Verneinung sein. Ein Glied, das die Zusage ueber „jeden Knoten" ausspricht, ist immer rot.
//     Das beisst in BEIDE Richtungen, und es beisst auch am ALTEN Mangel dieses Auftrags: der
//     bedingungslose Satz von vor JOB 3889 endete auf „mit der Tastatur springst du von Knoten zu
//     Knoten" — ein Glied mit Tastatur-Wort, ohne Bedingung, mit Allaussage.
//
//     GEBUNDEN AN DIE FLAECHE, NICHT AN DEN GESCHMACK: die Pruefung laeuft nur, weil DIESELBE
//     gemountete Seite ein Gegenbeispiel zeichnet (`gegenbeispielAufDerFlaeche()` liest die Knoten
//     ohne `role="link"` aus DEM DOM und wird rot, wenn es keines gibt). Die Fehlermeldung nennt das
//     Gegenbeispiel beim Namen: die Zusage ist nicht „zu forsch formuliert", sie ist an diesem
//     Knoten nachweislich falsch.
//
// (6) RUNDE 5 · EINE VORHANDENE BEDINGUNG IST NOCH KEINE RICHTIGE BEDINGUNG. Die Runde 4 prueft je
//     Eintrag, ob die Wendung DA IST, und gliedweise, ob eine Zusage OHNE sie dasteht. Beides sagt
//     nichts darueber, in WELCHE RICHTUNG die Voraussetzung zeigt. BEN hat genau dort gemessen: in
//     `apps/web/src/i18n.ts:5069` wurde EIN Wort eingesetzt — „Gehoert ein Knoten NICHT zu einem
//     Objekt aus dem Bestand, fuehrt ein Klick auf ihn zu diesem Wissensobjekt …" —, Zusage,
//     Negativsatz und Schwesterhilfe unveraendert, kein Test angefasst. Ergebnis
//     `Tests 20 passed (20)`, Exit 0 (BENs Cloud-Auftrag `bbb2555af4584bc2b7b9afbdbab68333`,
//     ben-antwort.md der Runde 4). Der Satz versprach den Sprung damit GERADE fuer den Knoten OHNE
//     Objekt im Bestand — das genaue Gegenteil von `lib/graphNav.ts:12` — und blieb gruen: „aus dem
//     Bestand" stand ja noch da, und das Glied trug die Wendung, also fiel es der Gliedpruefung
//     nicht auf.
//
//     SEIT DIESER RUNDE liest `bedingungStehtUnverneint()` den TEILSATZ, in dem die Wendung steht,
//     und verlangt, dass er unverneint ist. Zerlegt wird dafuer feiner als bei der Gliedpruefung —
//     an `.` `;` `:` `,` und am Gedankenstrich —, weil die Voraussetzung in allen drei Sprachen ein
//     eigener Teilsatz ist („Gehoert ein Knoten zu einem Objekt aus dem Bestand" · „If a node
//     belongs to an object in the holdings" · „Hoort een knooppunt bij een object uit het bestand",
//     und ebenso in der Schwesterhilfe hinter ihrem Gedankenstrich). Geprueft werden BEIDE
//     Eintraege in allen drei Sprachen, also GF3d und GF3g-DE/EN/NL.
//
//     WAS DAS NICHT MISST, ehrlich benannt: eine Verneinung in der ZUSAGE statt in der
//     Voraussetzung („… fuehrt ein Klick NICHT zu diesem Wissensobjekt"). Dieser Halbsatz hat in den
//     drei Sprachen keine gemeinsame Bauform, an der er sicher von der Voraussetzung zu trennen
//     waere; die Umkehr der Voraussetzung ist die, die BEN gemessen hat und die hier beisst.
//
// (3) Aeltere Korrekturpflicht, unveraendert gueltig (BEN 3795 R1): GF3b und GF3c verglichen die
//     angekommene Adresse gegen `koDetailPath(<id>)` — gegen dieselbe Produktfunktion also, aus der
//     die Seite ihr Ziel baut. Der Sollwert kommt deshalb allein aus dem Pruefstand
//     (`kennungImBestand`), das Produkt wird dafuer nicht importiert.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ------------------------------------------------------------------------------------------------
// Der Stand „auf der Serverseite" — EINE Ablage, die alle drei Seiten teilen. Die Entscheidung auf
// `/konflikte` SCHREIBT hier hinein, und derselbe Abruf liest danach neu aus: nur so ist „vorher"
// und „nachher" das Ergebnis einer AUSGEFUEHRTEN Operation und nicht zweier im Test
// ausgeschriebener Listen (Lehre 3741 R3, Korrekturpflicht 1).
// ------------------------------------------------------------------------------------------------
const d = vi.hoisted(() => {
  type Satz = Record<string, unknown>;
  const s: {
    kos: Satz[];
    konflikte: Satz[];
    quellen: Satz[];
    knoten: { id: string; title: string }[];
    kanten: { a: string; b: string; via: string }[];
  } = { kos: [], konflikte: [], quellen: [], knoten: [], kanten: [] };
  const kopie = (l: readonly Satz[]): Satz[] => l.map((x) => ({ ...x }));

  return {
    setze: (teil: Partial<typeof s>): void => {
      Object.assign(s, { kos: [], konflikte: [], quellen: [], knoten: [], kanten: [] }, teil);
    },
    lies: (): typeof s => ({
      kos: kopie(s.kos),
      konflikte: kopie(s.konflikte),
      quellen: kopie(s.quellen),
      knoten: [...s.knoten],
      kanten: [...s.kanten],
    }),
    /** `GET /api/kos` — der Bestand, ungefiltert. */
    koListe: vi.fn(async () => kopie(s.kos)),
    /**
     * `GET /api/conflicts` — der Server gibt `unresolved()` aus, also NUR die offenen
     * (`services/app/src/routes/conflicts-routes.ts:222-227`, `services/conflicts/src/service.ts:549`).
     * Genau diese Filterung ist der Grund, aus dem KF1e ueberhaupt etwas zu messen hat.
     */
    konfliktListe: vi.fn(async () => kopie(s.konflikte).filter((c) => c.status !== "geloest")),
    /**
     * `PUT /api/kos/:id` mit `{action:"resolve-conflict"}` — die Entscheidung. Sie schreibt
     * Status, Entscheidung und Entscheider an den Konflikt und entfernt NICHTS
     * (`services/conflicts/src/service.ts:189-199`).
     */
    koAkt: vi.fn(
      async (id: string, body: { action?: string; conflictId?: string; decision?: string }) => {
        if (body.action !== "resolve-conflict") {
          throw new Error(`Pruefstand: unerwartete Aktion ${String(body.action)}`);
        }
        const k = s.konflikte.find((c) => c.id === body.conflictId);
        if (!k) {
          throw new Error(`Pruefstand: kein Konflikt ${String(body.conflictId)}`);
        }
        k.status = "geloest";
        k.decision = body.decision;
        k.decidedBy = "u1";
        k.resolutionReason = "decided";
        return { ...(s.kos.find((x) => x.id === id) ?? {}) };
      },
    ),
    /** `GET /api/output/sources`. */
    quellenListe: vi.fn(async () => kopie(s.quellen)),
    /** `POST /api/output/generate` — erzeugt das Dokument (und erst dieser Schritt tut es). */
    erzeuge: vi.fn(async (body: { kind: string; koIds: string[] }) => ({
      kind: body.kind,
      title: `Dokument ${body.kind}`,
      audienceRole: "admin",
      generatedAt: "2026-09-12T09:00:00.000Z",
      markdown: `# Dokument\n${body.koIds.join("\n")}`,
      provenance: body.koIds.map((koId) => {
        const q = s.quellen.find((x) => x.id === koId);
        return {
          koId,
          title: String(q?.title ?? koId),
          status: "validiert",
          trust: Number(q?.trust ?? 0),
          version: Number(q?.version ?? 1),
          validity: "gueltig",
          uncertain: false,
        };
      }),
    })),
    /** `GET /api/graph`. */
    graphAbruf: vi.fn(async () => ({ nodes: [...s.knoten], edges: [...s.kanten] })),
  };
});

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    // `admin`: `/output` und `/graph` sind `minRole: "admin"` UND `stufe2: true`
    // (`app/navigation.ts:299-306`, `:324-332`) — jede andere Rolle saehe die Seiten gar nicht.
    me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  // Alles, was diese Faelle NICHT messen, antwortet leer — aber es antwortet. Ohne den Rueckfall
  // stuerzten die Reiterkoepfe an der ersten unbekannten Ecke ab, und der Fall maesse nichts.
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
      conflicts: mit({ list: d.konfliktListe }),
      ko: mit({ list: d.koListe, act: d.koAkt }),
      library: mit({ graph: d.graphAbruf }),
      output: mit({ sources: d.quellenListe, generate: d.erzeuge }),
      // Der KI-Deckel-Vorbehalt im „?"-Menue der Pruefseite liest ein OBJEKT, keine Liste.
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
import {
  MemoryRouter,
  Route,
  Routes,
  useParams,
} from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import { ALL_ITEMS, type NavItem, canSee, roleAllows } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
// KEIN Import von `koDetailPath`: die produktive Pfadfunktion darf hier nicht zugleich den Weg und
// den Erwartungswert liefern (BEN 3795 R1, Korrekturpflicht 1 — siehe `kennungImBestand` unten).
import { OUTPUT_KIND_OPTIONS } from "../../apps/web/src/lib/outputDoc";
import { Conflicts } from "../../apps/web/src/pages/Conflicts";
import { GraphView, Output } from "../../apps/web/src/pages/Stufe2";
import { SeitenhilfeProvider } from "../../apps/web/src/shell/SeitenhilfeContext";
import { ZahnradMenue } from "../../apps/web/src/shell/ZahnradMenue";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

/** Der persistierte Stufe-2-Umschalter (`lib/stufe2Storage.ts:7`). Admin + an ⇒ beide Seiten da. */
const STUFE2_KEY = "kw.stufe2.v1";

type KapitelId = "konflikte" | "output" | "graph";

/**
 * Der hinterlegte Wert EINER Zeichenkette in EINER Sprache — gelesen, nicht abgeschrieben.
 * Vorgabe ist Deutsch; GF3g liest damit auch die englische und die niederlaendische Fassung aus
 * DEMSELBEN Bestand (`i18n.ts`), aus dem die Oberflaeche sie nimmt.
 */
function wert(key: string, sprache = "de"): string {
  return String(i18n.getResource(sprache, "translation", key) ?? "");
}

/** Der Kapiteltext, wie er HEUTE hinterlegt ist. */
function kapitel(id: KapitelId): string {
  return wert(`help.${id}.body`);
}

/**
 * Die Behauptung, die dieser Fall am Seitenverhalten misst — sie muss woertlich im heutigen
 * Kapiteltext stehen. Faellt sie dort weg, wird GENAU dieser Fall rot und nennt Route und
 * Behauptung; ein Fall, dessen Satz gar nicht mehr da ist, misst nichts mehr (Lieferung 5).
 */
function behauptung(route: string, id: KapitelId, satzteil: string): void {
  expect(
    kapitel(id),
    `${route}: die Behauptung „${satzteil}“ steht nicht mehr in help.${id}.body — dieser Fall misst sie am Seitenverhalten und misst ohne sie nichts`,
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

/** Die Sonde auf der Detailroute: sie zeigt, WOHIN navigiert wurde (Bauform aus der Graph-Suite). */
function Sonde(): JSX.Element {
  const { id } = useParams();
  return createElement("div", { "data-testid": "sonde" }, id ?? "");
}

/**
 * Die ECHTE Seite mit den Anbietern, die sie braucht — Attrappe ist allein die Endpunktgrenze.
 * `mitZiel` haengt die Detailroute daneben, damit ein Klick ein MESSBARES Ziel hat.
 *
 * `mitZahnrad` (JOB 3889 Runde 2, Korrekturpflicht 1 von BEN) stellt das ECHTE Zahnrad-Menue
 * (`shell/ZahnradMenue.tsx`) neben die Seite und den ECHTEN Sammler (`SeitenhilfeProvider`)
 * darueber. Erst damit steht das, was der Mensch wirklich vor sich hat, im SELBEN DOM wie das
 * Verhalten: die Seitenhilfe-Liste zeigt dann den Nav-Erklaersatz `help.graph.body`
 * (`ZahnradMenue.tsx:38-47`) UND darunter den `HelpTip` der Seite, `seitenhilfe.graph.text`
 * (`pages/Stufe2.tsx:2061`) — genau die zwei Saetze untereinander, um die es in diesem Auftrag geht.
 */
async function montiere(
  seite: () => JSX.Element,
  pfad: string,
  mitZiel = false,
  mitZahnrad = false,
): Promise<void> {
  abbauen();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const seiteOderRouten = mitZiel
    ? createElement(
        Routes,
        null,
        createElement(Route, { path: pfad, element: createElement(seite) }),
        createElement(Route, { path: "/wissen/:id", element: createElement(Sonde) }),
      )
    : createElement(seite);
  const inhalt = mitZahnrad
    ? createElement(
        NavGuardProvider,
        null,
        createElement(
          SeitenhilfeProvider,
          null,
          createElement(ZahnradMenue, null),
          seiteOderRouten,
        ),
      )
    : seiteOderRouten;
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
              createElement(MemoryRouter, { initialEntries: [pfad] }, inhalt),
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
const text = (): string => (container.textContent ?? "").replace(/\s+/g, " ");

// ------------------------------------------------------------------------------------------------
// Der Bestand: zwei Wissensobjekte, die sich widersprechen, und ein drittes daneben.
// ------------------------------------------------------------------------------------------------
const AUSSAGE_A = "Der Filter wird alle 14 Tage gewechselt.";
const AUSSAGE_B = "Der Filter wird alle 30 Tage gewechselt.";
const TITEL_A = "Wartungsplan Nord";
const TITEL_B = "Wartungsplan Sued";
const TITEL_C = "Filterwechsel Werk 3";

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
  ko("ko-c", TITEL_C, "Der Filter wird nach Betriebsstunden gewechselt."),
];

/**
 * Ein automatisch erkannter Konflikt, so wie `services/conflicts/src/service.ts:115-133` ihn
 * schreibt. NUR dieser Zweig bekommt auf der Flaeche die vierte Schaltflaeche „Kein Widerspruch"
 * (`canDismiss`, `lib/conflictBoard.ts:43-45`) — daran haengt KF1d.
 */
const konfliktAuto = (id: string, typ: string): Record<string, unknown> => ({
  id,
  koA: "ko-a",
  koB: "ko-b",
  type: typ,
  description: "Automatisch erkannt: unterschiedliche Fristen fuer denselben Vorgang.",
  status: "offen",
  secondOpinion: null,
  decidedBy: null,
  decision: null,
  origin: "auto",
  detector: {
    trigger: "background",
    method: "model",
    confidence: 0.9,
    rationale: "Beide Aussagen nennen unterschiedliche Fristen fuer denselben Vorgang.",
  },
  createdAt: "2026-08-01T06:00:00.000Z",
});

/**
 * Der von Hand angelegte Konflikt: `origin: "manual"`, kein `detector`
 * (`services/conflicts/src/service.ts:79-96`).
 */
const KONFLIKT_MANUELL: Record<string, unknown> = {
  ...konfliktAuto("c-manuell", "truth"),
  description: "Die eine Angabe nennt 14 Tage, die andere 30 — beide berufen sich auf den Plan.",
  origin: "manual",
  detector: undefined,
  createdBy: "u1",
};

/**
 * ZWEI Konflikte ueber DEMSELBEN Paar, mit verschiedener Art. Das ist kein Kunstgriff: der Dienst
 * kennt keine Entduplizierung (`service.ts:79-98` fuegt jeden Eingang ein), und zwei Objekte
 * koennen sich in mehr als einem Punkt widersprechen. Der zweite Konflikt ist es, der nach der
 * ausgefuehrten Entscheidung in KF1c beweist, dass BEIDE Wissensobjekte noch gezeichnet werden.
 */
const ZWEI_KONFLIKTE = [konfliktAuto("c-wahrheit", "truth"), konfliktAuto("c-kontext", "context")];

const QUELLEN = [
  {
    id: "q1",
    title: TITEL_A,
    status: "validiert",
    trust: 80,
    version: 3,
    category: "Technik",
    type: "regel",
  },
  {
    id: "q2",
    title: TITEL_C,
    status: "validiert",
    trust: 75,
    version: 1,
    category: "Technik",
    type: "regel",
  },
];

const KNOTEN = [
  { id: "ko-a", title: TITEL_A },
  { id: "ko-b", title: TITEL_B },
  { id: "ko-c", title: TITEL_C },
];
const KANTEN = [
  { a: "ko-a", b: "ko-b", via: "wartung" },
  { a: "ko-b", b: "ko-c", via: "filter" },
];

beforeEach(async () => {
  await i18n.changeLanguage("de");
  window.localStorage.setItem(STUFE2_KEY, "1");
  // jsdom bringt kein `matchMedia` mit. Der Wert ist fuer GF3e beweglich (schmal/breit).
  setzeBreite(false);
});

afterEach(() => {
  abbauen();
  window.localStorage.removeItem(STUFE2_KEY);
  vi.clearAllMocks();
});

let istSchmal = false;
function setzeBreite(schmal: boolean): void {
  istSchmal = schmal;
  (globalThis as unknown as { matchMedia?: unknown }).matchMedia = (abfrage: string) => ({
    matches: istSchmal,
    media: abfrage,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  (globalThis as unknown as { innerWidth: number }).innerWidth = schmal ? 360 : 1280;
}

// ================================================================================================
// L4 · DIE SICHTBARKEITSSCHALTER — unter welcher Bedingung die drei Seiten ueberhaupt erscheinen.
// ================================================================================================
describe("JOB 3795 L4 · die Bedingungen, unter denen gemessen wird", () => {
  function punkt(pfad: string): NavItem {
    const i = ALL_ITEMS.find((x) => x.path === pfad);
    if (!i) {
      throw new Error(`kein Menuepunkt ${pfad} — der Fall misst nichts`);
    }
    return i;
  }

  it("L4a: /output und /graph liegen hinter dem Stufe-2-Schalter; /konflikte nicht", () => {
    // Der Schalter entscheidet nicht nur ueber den Menuepunkt: `routes.tsx:187-190` ersetzt die
    // Seite bei ausgeschalteten Modulen durch `Stage2Notice` — ohne ihn gibt es die gemessene
    // Flaeche gar nicht. Alle Faelle unten laufen deshalb mit gesetztem `kw.stufe2.v1`.
    for (const pfad of ["/output", "/graph"]) {
      const i = punkt(pfad);
      expect(i.stufe2, `${pfad}: nicht mehr hinter dem Stufe-2-Schalter`).toBe(true);
      expect(roleAllows(i, "admin"), `${pfad}: die Rolle admin reicht nicht`).toBe(true);
      expect(canSee(i, "admin", false), `${pfad}: mit Schalter AUS sichtbar`).toBe(false);
      expect(canSee(i, "admin", true), `${pfad}: mit Schalter AN unsichtbar`).toBe(true);
    }
    const k = punkt("/konflikte");
    expect(k.stufe2 ?? false, "/konflikte haengt jetzt am Stufe-2-Schalter").toBe(false);
  });
});

// ================================================================================================
// KF1 · /konflikte — „Die Seite stellt die zwei Aussagen nebeneinander …"
// ================================================================================================
describe("JOB 3795 KF1 · /konflikte — was das Kapitel verspricht, tut die Seite", () => {
  it("KF1a: die zwei Aussagen stehen NEBENEINANDER — beide gleichzeitig im gezeichneten Paar", async () => {
    behauptung("/konflikte", "konflikte", "die zwei Aussagen nebeneinander");
    d.setze({ kos: KOS, konflikte: [konfliktAuto("c-wahrheit", "truth")] });
    await montiere(Conflicts, "/konflikte");

    const paar = marke("pruefen-paar");
    expect(paar, "/konflikte: die Seite zeichnet gar kein Kartenpaar").not.toBeNull();
    const links = marke("pruefen-paar-text-a");
    const rechts = marke("pruefen-paar-text-b");
    expect(links, "/konflikte: die linke Aussage ist gar nicht gezeichnet").not.toBeNull();
    expect(rechts, "/konflikte: die rechte Aussage ist gar nicht gezeichnet").not.toBeNull();
    expect(links?.textContent ?? "", "/konflikte: die linke Aussage fehlt").toContain(AUSSAGE_A);
    expect(rechts?.textContent ?? "", "/konflikte: die rechte Aussage fehlt").toContain(AUSSAGE_B);
    // „nebeneinander" heisst: BEIDE in DEMSELBEN gezeichneten Paar, nicht nacheinander.
    expect(paar?.contains(links as Node), "/konflikte: die linke Karte steht nicht im Paar").toBe(
      true,
    );
    expect(paar?.contains(rechts as Node), "/konflikte: die rechte Karte steht nicht im Paar").toBe(
      true,
    );
    expect(
      marke("pruefen-paar-karte-a")?.textContent,
      "/konflikte: die linke Karte nennt ihr Wissensobjekt nicht",
    ).toContain(TITEL_A);
    expect(
      marke("pruefen-paar-karte-b")?.textContent,
      "/konflikte: die rechte Karte nennt ihr Wissensobjekt nicht",
    ).toContain(TITEL_B);
  });

  it("KF1b: die angebotenen Wahlmoeglichkeiten sind genau die drei genannten — an den echten Beschriftungen", async () => {
    behauptung("/konflikte", "konflikte", "welche gilt");
    behauptung("/konflikte", "konflikte", "je nach Zusammenhang gelten");
    // Diese eine Wahl steht WOERTLICH als Beschriftung auf der Flaeche — sie wird deshalb gegen den
    // Bestand gebunden und nicht abgetippt.
    expect(
      kapitel("konflikte").toLowerCase(),
      `/konflikte: der Kapiteltext nennt die Beschriftung „${wert("con.side.none")}“ nicht`,
    ).toContain(wert("con.side.none").toLowerCase());

    d.setze({ kos: KOS, konflikte: [konfliktAuto("c-wahrheit", "truth")] });
    await montiere(Conflicts, "/konflikte");

    const band = marke("pruefen-aktionsband");
    expect(band, "/konflikte: es gibt gar kein Aktionsband").not.toBeNull();
    const knopf = (kennung: string): Element | null => marke(`pruefen-knopf-${kennung}`);
    expect(knopf("links-gilt")?.textContent, "/konflikte: „welche gilt“ (links) fehlt").toBe(
      wert("con.side.left"),
    );
    expect(knopf("rechts-gilt")?.textContent, "/konflikte: „welche gilt“ (rechts) fehlt").toBe(
      wert("con.side.right"),
    );
    expect(knopf("beide-gelten")?.textContent, "/konflikte: „beide gelten“ fehlt").toBe(
      wert("con.side.both"),
    );
    expect(knopf("kein-widerspruch")?.textContent, "/konflikte: „kein Widerspruch“ fehlt").toBe(
      wert("con.side.none"),
    );
    // Und es sind GENAU diese vier Schaltflaechen fuer die drei Wahlmoeglichkeiten — daneben steht
    // allein der Textlink „Zweitmeinung anfragen", der nichts entscheidet.
    const beschriftungen = [...(band?.querySelectorAll("button") ?? [])].map((b) =>
      (b.textContent ?? "").trim(),
    );
    expect(beschriftungen, "/konflikte: das Aktionsband bietet etwas anderes an").toEqual([
      wert("con.side.left"),
      wert("con.side.right"),
      wert("con.side.both"),
      wert("con.side.none"),
      wert("con.secondOpinionAdd"),
    ]);
  });

  it("KF1c: nach einer AUSGEFUEHRTEN Entscheidung sind beide Wissensobjekte noch da, und ein Vermerk ist entstanden", async () => {
    behauptung("/konflikte", "konflikte", "als Vermerk festgehalten");
    behauptung("/konflikte", "konflikte", "gelöscht wird nichts");
    d.setze({ kos: KOS, konflikte: ZWEI_KONFLIKTE });
    await montiere(Conflicts, "/konflikte");

    // VORHER — aus dem Abruf der Seite, nicht aus dieser Datei.
    const vorher = [
      marke("pruefen-paar-karte-a")?.textContent ?? "",
      marke("pruefen-paar-karte-b")?.textContent ?? "",
    ];
    expect(vorher[0], "/konflikte: das linke Objekt ist vorher nicht gezeichnet").toContain(
      AUSSAGE_A,
    );
    expect(vorher[1], "/konflikte: das rechte Objekt ist vorher nicht gezeichnet").toContain(
      AUSSAGE_B,
    );
    expect(text(), "/konflikte: es liegen nicht zwei Befunde vor").toContain(
      i18n.t("pruefen.kVonN", { k: 1, n: 2 }),
    );

    // DIE ENTSCHEIDUNG — zwei echte Klicks auf der Seite: waehlen, dann speichern.
    await klicke(marke("pruefen-knopf-links-gilt"));
    const feld = container.querySelector("textarea");
    expect(feld, "/konflikte: die Entscheidung bietet kein Begruendungsfeld").not.toBeNull();
    expect(
      (feld as HTMLTextAreaElement).value,
      "/konflikte: die Begruendung ist nicht vorbelegt",
    ).toBe(i18n.t("con.prefill.side", { title: TITEL_A }));
    const speichern = [...container.querySelectorAll("button")].find(
      (b) => (b.textContent ?? "").trim() === wert("con.resolveConfirm"),
    );
    await klicke(speichern);

    // DER VERMERK — die Entscheidung hat den Server WIRKLICH erreicht und liegt am Konflikt.
    expect(
      d.koAkt,
      "/konflikte: die Entscheidung hat den Server gar nicht erreicht",
    ).toHaveBeenCalledWith("ko-a", {
      action: "resolve-conflict",
      conflictId: "c-wahrheit",
      decision: i18n.t("con.prefill.side", { title: TITEL_A }),
    });
    const entschieden = d.lies().konflikte.find((c) => c.id === "c-wahrheit");
    expect(entschieden?.decision, "/konflikte: kein Vermerk am Konflikt").toBe(
      i18n.t("con.prefill.side", { title: TITEL_A }),
    );
    expect(entschieden?.decidedBy, "/konflikte: der Vermerk nennt niemanden").toBe("u1");

    // NACHHER — wieder aus dem Abruf der Seite. GELOESCHT IST NICHTS: beide Wissensobjekte werden
    // weiter gezeichnet (jetzt am zweiten Befund desselben Paares), und beide Konflikte liegen noch
    // in der Ablage — der entschiedene mit seinem neuen Stand.
    const nachher = [
      marke("pruefen-paar-karte-a")?.textContent ?? "",
      marke("pruefen-paar-karte-b")?.textContent ?? "",
    ];
    expect(
      nachher[0],
      "/konflikte: das linke Wissensobjekt ist nach der Entscheidung weg",
    ).toContain(AUSSAGE_A);
    expect(
      nachher[1],
      "/konflikte: das rechte Wissensobjekt ist nach der Entscheidung weg",
    ).toContain(AUSSAGE_B);
    expect(
      d.lies().kos.map((k) => k.id),
      "/konflikte: die Entscheidung hat ein Wissensobjekt geloescht",
    ).toEqual(["ko-a", "ko-b", "ko-c"]);
    expect(
      d.lies().konflikte.map((c) => c.id),
      "/konflikte: die Entscheidung hat den Konflikt geloescht statt ihn zu vermerken",
    ).toEqual(["c-wahrheit", "c-kontext"]);
  });

  it("KF1d · NACHFUEHR-PIN: die dritte Wahl gibt es NUR am automatisch erkannten Konflikt", async () => {
    // GEMESSEN, nicht vermutet: `canDismiss` (`lib/conflictBoard.ts:43-45`) gibt nur fuer
    // `origin === "auto"` wahr. Am VON HAND angelegten Konflikt fehlt „Kein Widerspruch" also —
    // waehrend `help.konflikte.body` die Wahl ohne jede Bedingung verspricht.
    d.setze({ kos: KOS, konflikte: [KONFLIKT_MANUELL] });
    await montiere(Conflicts, "/konflikte");
    expect(
      marke("pruefen-knopf-links-gilt"),
      "/konflikte: der manuelle Fall zeichnet kein Band",
    ).not.toBeNull();
    expect(
      marke("pruefen-knopf-kein-widerspruch"),
      "/konflikte: „Kein Widerspruch“ steht jetzt AUCH am manuellen Konflikt — dann ist der Kapitelsatz endlich unbedingt wahr. Jetzt KF1b auf beide Herkuenfte ausweiten und diesen Pin KF1d loeschen.",
    ).toBeNull();
    // Und der Satz nennt die Bedingung bis heute nicht. Steht sie eines Tages da, wird dieser Pin
    // rot — genau das ist seine Aufgabe.
    const t = kapitel("konflikte").toLowerCase();
    for (const wort of ["automatisch", "erkannt"]) {
      expect(
        t,
        `/konflikte: der Kapitelsatz nennt jetzt die Bedingung („${wort}“). Jetzt KF1d durch einen Fall ersetzen, der die Bedingung am Verhalten belegt, und diesen Pin loeschen.`,
      ).not.toContain(wort);
    }
  });

  it("KF1e · NACHFUEHR-PIN: das entschiedene Paar verschwindet vom Brett — „gelöscht wird nichts“ sieht ein Mensch anders", async () => {
    // `GET /api/conflicts` liefert `unresolved()` (`conflicts-routes.ts:227`), der entschiedene
    // Befund faellt also aus der Liste. Der Datensatz bleibt; die Flaeche zeigt ihn nicht mehr.
    d.setze({ kos: KOS, konflikte: [konfliktAuto("c-wahrheit", "truth")] });
    await montiere(Conflicts, "/konflikte");
    expect(marke("pruefen-paar"), "/konflikte: vorher steht kein Paar da").not.toBeNull();

    await klicke(marke("pruefen-knopf-beide-gelten"));
    const speichern = [...container.querySelectorAll("button")].find(
      (b) => (b.textContent ?? "").trim() === wert("con.resolveConfirm"),
    );
    await klicke(speichern);

    expect(
      d.lies().konflikte.find((c) => c.id === "c-wahrheit")?.status,
      "/konflikte: der Befund ist nicht entschieden — der Fall misst nichts",
    ).toBe("geloest");
    expect(
      marke("pruefen-paar"),
      "/konflikte: das entschiedene Paar steht jetzt weiter auf dem Brett. Jetzt KF1e loeschen und die neue Anzeige des entschiedenen Befundes belegen.",
    ).toBeNull();
    expect(
      text(),
      "/konflikte: nach der letzten Entscheidung fehlt der ehrliche Leersatz",
    ).toContain(wert("con.empty"));
  });

  it("KF1f · §9: im erfolgreich LEEREN Bestand gibt es kein Paar — „nimm dir ein Paar vor“ trifft dann nicht zu", async () => {
    behauptung("/konflikte", "konflikte", "nimm dir ein Paar vor");
    // Ein Leerzustand ist ein Zustand, kein Nichts (Lehre JOB 3762 R1). Beide Abrufe sind
    // ERFOLGREICH zurueck — nur der Bestand ist leer.
    d.setze({ kos: KOS, konflikte: [] });
    await montiere(Conflicts, "/konflikte");
    expect(text(), "/konflikte: der Leerzustand sagt nichts").toContain(wert("con.empty"));
    expect(marke("pruefen-paar"), "/konflikte: im Leerzustand steht ein Paar da").toBeNull();
    expect(
      marke("pruefen-aktionsband"),
      "/konflikte: im Leerzustand gibt es etwas zu waehlen",
    ).toBeNull();
  });
});

// ================================================================================================
// AF2 · /output — „Du waehlst die Art des Dokuments, stellst die Wissensobjekte zusammen …"
// ================================================================================================
describe("JOB 3795 AF2 · /output — was das Kapitel verspricht, tut die Seite", () => {
  /** Die Titel in der gezeichneten Reihenfolge der Zusammenstellung (`<ol>` der Vorschau-Karte). */
  function reihenfolge(): string[] {
    const liste = container.querySelector("ol");
    return [...(liste?.querySelectorAll("li") ?? [])].map((li) => {
      const treffer = QUELLEN.find((q) => (li.textContent ?? "").includes(q.title));
      return treffer?.title ?? (li.textContent ?? "").trim();
    });
  }

  /** Die Kaestchen der Quellenliste, in gezeichneter Reihenfolge. */
  function kaestchen(): HTMLInputElement[] {
    return [...container.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
  }

  async function mitZweiQuellen(): Promise<void> {
    d.setze({ quellen: QUELLEN });
    await montiere(Output, "/output");
    const boxen = kaestchen();
    expect(boxen.length, "/output: die Seite zeichnet die Quellen nicht").toBe(QUELLEN.length);
    await klicke(boxen[0]);
    await klicke(boxen[1]);
  }

  it("AF2a: die Art des Dokuments ist waehlbar — die Wahl schlaegt auf die Zusammenstellung durch", async () => {
    behauptung("/output", "output", "Du wählst die Art des Dokuments");
    await mitZweiQuellen();

    // Alle angebotenen Arten stehen als Schaltflaeche da — erhoben aus `OUTPUT_KIND_OPTIONS`,
    // nicht abgetippt.
    const knoepfe = [...container.querySelectorAll("button")].map((b) =>
      (b.textContent ?? "").trim(),
    );
    for (const o of OUTPUT_KIND_OPTIONS) {
      expect(
        knoepfe.some((k) => k.startsWith(wert(o.labelKey))),
        `/output: die Art „${wert(o.labelKey)}“ ist nicht waehlbar`,
      ).toBe(true);
    }
    // Vorbelegt ist die erste Art; die Vorschau nennt sie.
    expect(text(), "/output: die Vorschau nennt die vorbelegte Art nicht").toContain(
      i18n.t("out.previewSummary", { kind: wert("out.kind.instruction"), n: 2 }),
    );
    // EINE AUSGEFUEHRTE WAHL: eine andere Art anklicken — die Zusammenstellung nennt danach sie.
    const andere = [...container.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").startsWith(wert("out.kind.checklist")),
    );
    await klicke(andere);
    expect(
      text(),
      "/output: die gewaehlte Art schlaegt nicht auf die Zusammenstellung durch",
    ).toContain(i18n.t("out.previewSummary", { kind: wert("out.kind.checklist"), n: 2 }));
  });

  it("AF2b: die Wissensobjekte lassen sich zusammenstellen UND in eine andere Reihenfolge bringen", async () => {
    behauptung("/output", "output", "stellst die Wissensobjekte zusammen");
    behauptung("/output", "output", "bringst sie in die Reihenfolge");
    await mitZweiQuellen();

    const vorher = reihenfolge();
    expect(vorher, "/output: die Zusammenstellung nimmt die Auswahl nicht auf").toEqual([
      QUELLEN[0]?.title,
      QUELLEN[1]?.title,
    ]);
    // EINE AUSGEFUEHRTE BEDIENHANDLUNG, kein vorhandener Knopf: den ersten Eintrag nach unten.
    const runter = container.querySelector(`ol li button[aria-label="${wert("out.moveDown")}"]`);
    await klicke(runter);
    const nachher = reihenfolge();
    expect(
      nachher,
      "/output: die Reihenfolge hat sich durch die Bedienhandlung NICHT geaendert",
    ).toEqual([QUELLEN[1]?.title, QUELLEN[0]?.title]);
    expect(
      nachher,
      "/output: die Bedienhandlung hat etwas anderes getan als umzuordnen",
    ).not.toEqual(vorher);
  });

  it("AF2c: die Vorschau zeigt die Zusammenstellung VOR dem Erzeugen — und das Dokument entsteht erst danach", async () => {
    behauptung(
      "/output",
      "output",
      "eine Vorschau zeigt die Zusammenstellung, bevor das Dokument erzeugt wird",
    );
    await mitZweiQuellen();

    // GEMESSEN VOR dem Erzeugen-Schritt: die Vorschau steht da, MIT dem Inhalt der
    // Zusammenstellung — und erzeugt wurde noch nichts.
    expect(text(), "/output: es gibt keine Kompositionsvorschau").toContain(
      wert("out.previewCompositionTitle"),
    );
    expect(reihenfolge(), "/output: die Vorschau zeigt die Zusammenstellung nicht").toEqual([
      QUELLEN[0]?.title,
      QUELLEN[1]?.title,
    ]);
    expect(text(), "/output: die Vorschau nennt die Zahl der Bausteine nicht").toContain(
      i18n.t("out.previewSummary", { kind: wert("out.kind.instruction"), n: 2 }),
    );
    expect(
      d.erzeuge,
      "/output: das Dokument wurde VOR dem Erzeugen-Knopf erzeugt",
    ).not.toHaveBeenCalled();
    expect(text(), "/output: das erzeugte Dokument steht vor dem Erzeugen da").not.toContain(
      wert("out.previewTitle"),
    );

    // DER ERZEUGEN-SCHRITT.
    const erzeugen = [...container.querySelectorAll("button")].find(
      (b) => (b.textContent ?? "").trim() === wert("out.generate"),
    );
    await klicke(erzeugen);
    expect(d.erzeuge, "/output: der Erzeugen-Knopf erzeugt nichts").toHaveBeenCalledWith({
      kind: "instruction",
      koIds: ["q1", "q2"],
      audienceRole: "admin",
    });
    expect(text(), "/output: nach dem Erzeugen fehlt das Dokument").toContain(
      wert("out.previewTitle"),
    );
  });

  it("AF2d · §9: im erfolgreich LEEREN Quellenbestand gibt es weder Zusammenstellung noch Vorschau", async () => {
    d.setze({ quellen: [] });
    await montiere(Output, "/output");
    expect(text(), "/output: der leere Quellenbestand sagt nichts").toContain(
      wert("out.noValidated"),
    );
    expect(
      container.querySelector("ol"),
      "/output: leerer Bestand, trotzdem Zusammenstellung",
    ).toBeNull();
    expect(text(), "/output: leerer Bestand, trotzdem Kompositionsvorschau").not.toContain(
      wert("out.previewCompositionTitle"),
    );
    // Die Art des Dokuments bleibt waehlbar — der Kapitelsatz „Beginne mit der Art des Dokuments"
    // stimmt also auch hier; nur weiter kommt man ohne validiertes Wissen nicht.
    expect(text(), "/output: die Art des Dokuments ist im Leerzustand verschwunden").toContain(
      wert("out.kindTitle"),
    );
  });
});

// ================================================================================================
// GF3 · /graph — „zeichnet die einzelnen Wissensobjekte und ihre Verbindungen als Netz …"
// ================================================================================================
describe("JOB 3795 GF3 · /graph — was das Kapitel verspricht, tut die Seite", () => {
  /** Die Knotengruppen: jedes `<g>` im SVG, das einen Kreis traegt. */
  function knotenGruppen(): SVGGElement[] {
    return [...container.querySelectorAll("svg g")].filter((g) =>
      g.querySelector(":scope > circle"),
    ) as SVGGElement[];
  }

  function gruppeVon(titel: string): SVGGElement {
    const g = knotenGruppen().find((k) => k.querySelector(":scope > title")?.textContent === titel);
    if (!g) {
      throw new Error(`/graph: kein Knoten „${titel}“ gezeichnet`);
    }
    return g;
  }

  async function mitBestand(kos = KOS, knoten = KNOTEN): Promise<void> {
    d.setze({ kos, knoten, kanten: KANTEN });
    await montiere(GraphView, "/graph", true);
  }

  /**
   * DER UNABHAENGIGE SOLLWERT — Korrekturpflicht 1 aus BEN 3795 R1, woertlich: „GF3b/GF3c vom
   * produktiven `koDetailPath` als Sollwertgeber entkoppeln. Die gemessene Ziel-ID muss der
   * angeklickten beziehungsweise per Enter aktivierten Knoten-ID entsprechen."
   *
   * WARUM DER ALTE VERGLEICH NICHTS BEWIES: er stellte die angekommene Adresse gegen
   * `koDetailPath(<id>)` — also gegen DIESELBE Produktfunktion, aus der die Seite ihr Ziel baut.
   * BEN hat das gemessen: leitet `lib/graphNav.ts:8` JEDEN Knoten auf `/wissen/falsches-objekt`
   * um, bewegen sich beide Seiten des Vergleichs gemeinsam und die Faelle bleiben gruen — jeder
   * Graphknoten fuehrte dann zum falschen Wissensobjekt, ohne dass etwas rot wird.
   *
   * DER SOLLWERT KOMMT DESHALB AUS DEM PRUEFSTAND, nicht aus dem Produkt: `KNOTEN` ist die Liste,
   * die `d.graphAbruf` als `GET /api/graph` ausgibt; die Kennung dort ist die Identitaet, die der
   * Knoten TRAEGT. Kein Produktcode ist an dieser Zeile beteiligt.
   */
  function kennungImBestand(titel: string): string {
    const k = KNOTEN.find((x) => x.title === titel);
    if (!k) {
      throw new Error(`/graph: „${titel}“ liegt gar nicht im Bestand dieses Laufs`);
    }
    return k.id;
  }

  /**
   * Die Kennung, bei der die Seite WIRKLICH gelandet ist: der `:id` der Detailroute `/wissen/:id`,
   * abgelesen an der Sonde. `null` heisst: die Detailroute wurde nicht erreicht.
   */
  function angekommen(): string | null {
    const s = marke("sonde");
    return s === null ? null : (s.textContent ?? "");
  }

  it("GF3a: gezeichnet werden die einzelnen Wissensobjekte UND ihre Verbindungen", async () => {
    behauptung("/graph", "graph", "die einzelnen Wissensobjekte und ihre Verbindungen");
    await mitBestand();

    const gruppen = knotenGruppen();
    expect(gruppen.length, "/graph: die Zahl der gezeichneten Knoten passt nicht zum Bestand").toBe(
      KNOTEN.length,
    );
    expect(
      gruppen.map((g) => g.querySelector(":scope > title")?.textContent).sort(),
      "/graph: gezeichnet sind nicht die einzelnen Wissensobjekte",
    ).toEqual([...KNOTEN.map((k) => k.title)].sort());
    // Die Verbindungen: je Kante eine Linie, die ihr Schlagwort traegt.
    const kantenLinien = [...container.querySelectorAll("svg line")].filter((l) =>
      l.querySelector("title"),
    );
    expect(kantenLinien.length, "/graph: die Verbindungen sind nicht gezeichnet").toBe(
      KANTEN.length,
    );
    expect(
      kantenLinien.map((l) => l.querySelector("title")?.textContent).sort(),
      "/graph: die gezeichneten Verbindungen sind andere als die des Bestands",
    ).toEqual([...KANTEN.map((k) => k.via)].sort());
    expect(text(), "/graph: die Seite nennt Knoten und Kanten nicht").toContain(
      i18n.t("s2.graphCount", { nodes: KNOTEN.length, edges: KANTEN.length }),
    );
  });

  it("GF3b: ein Klick auf einen Knoten mit Objekt im Bestand fuehrt zu diesem Wissensobjekt — die Ziel-Adresse gemessen", async () => {
    // JOB 3889: der Satz nennt seit heute die Bedingung, unter der das gilt. Dieser Fall misst den
    // Zweig, in dem sie erfuellt ist (alle drei Knoten haben ihr Objekt im Bestand); der andere
    // Zweig und die Bedingung selbst stehen in GF3d.
    behauptung("/graph", "graph", "führt ein Klick auf ihn zu diesem Wissensobjekt");
    await mitBestand();
    // Der Sollwert steht VOR der Bedienhandlung fest und stammt aus dem Pruefstand, nicht aus dem
    // Produkt (siehe `kennungImBestand`) — sonst prueft der Fall das Produkt gegen sich selbst.
    const soll = kennungImBestand(TITEL_B);
    const fremde = KNOTEN.filter((k) => k.id !== soll).map((k) => k.id);
    const g = gruppeVon(TITEL_B);
    await act(async () => {
      g.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flush();
    });
    const ziel = angekommen();
    expect(
      ziel,
      `/graph: der Klick auf den Knoten „${TITEL_B}“ hat die Detailroute /wissen/:id ueberhaupt nicht erreicht`,
    ).not.toBeNull();
    expect(
      ziel,
      `/graph: der Klick auf den Knoten „${TITEL_B}“ fuehrt NICHT zu dem Wissensobjekt dahinter — im Bestand dieses Laufs traegt „${TITEL_B}“ die Kennung „${soll}“, angekommen ist „${ziel}“`,
    ).toBe(soll);
    expect(
      fremde,
      `/graph: der Klick auf „${TITEL_B}“ ist bei einem FREMDEN Wissensobjekt gelandet („${ziel}“ gehoert einem anderen Knoten)`,
    ).not.toContain(ziel);
  });

  it("GF3c: mit der Tastatur ist JEDER Knoten einzeln erreichbar — mit echten Tastenereignissen", async () => {
    behauptung("/graph", "graph", "mit der Tastatur erreichst du ihn ebenso");
    // WAS HIER GEMESSEN WIRD und was nicht: die Wanderung von Knoten zu Knoten selbst ist die
    // Tabulator-Reihenfolge des BROWSERS; jsdom fuehrt sie nicht aus (ein echtes `keydown` mit
    // „Tab" bewegt dort nichts). Das Produkt steuert dazu zwei Dinge bei, und nur die sind hier
    // messbar: es stellt jeden Knoten in die Reihenfolge (`tabIndex`), und es beantwortet auf
    // JEDEM Knoten ein echtes Tastenereignis mit dem Sprung zu SEINEM Objekt.
    await mitBestand();
    for (const g of knotenGruppen()) {
      expect(
        g.getAttribute("tabindex"),
        `/graph: der Knoten „${g.querySelector(":scope > title")?.textContent}“ liegt nicht in der Tastatur-Reihenfolge`,
      ).toBe("0");
    }
    // Auch hier ist der Sollwert die Kennung AUS DEM PRUEFSTAND (`k.id` aus `KNOTEN`, dem Stand,
    // den `GET /api/graph` in diesem Lauf ausgibt) — nicht der Pfad, den das Produkt selbst baut.
    const erreicht: (string | null)[] = [];
    for (const k of KNOTEN) {
      await mitBestand();
      const g = gruppeVon(k.title);
      await act(async () => {
        g.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
        await flush();
      });
      const ziel = angekommen();
      erreicht.push(ziel);
      expect(
        ziel,
        `/graph: die Tastatur auf dem Knoten „${k.title}“ hat die Detailroute /wissen/:id ueberhaupt nicht erreicht`,
      ).not.toBeNull();
      expect(
        ziel,
        `/graph: die Tastatur fuehrt vom Knoten „${k.title}“ NICHT zu seinem Objekt — im Bestand dieses Laufs traegt „${k.title}“ die Kennung „${k.id}“, angekommen ist „${ziel}“`,
      ).toBe(k.id);
    }
    // Und keine zwei Knoten enden beim selben Objekt: eine Fehlleitung, die ALLE Knoten auf
    // dasselbe Ziel umbiegt, faellt hier zusaetzlich als Ganzes auf.
    expect(
      new Set(erreicht).size,
      `/graph: verschiedene Knoten fuehren zum SELBEN Wissensobjekt — erreicht wurde ${JSON.stringify(erreicht)}`,
    ).toBe(KNOTEN.length);
  });

  // ----------------------------------------------------------------------------------------------
  // DIE SEITENHILFE, WIE SIE DER MENSCH OEFFNET — Korrekturpflicht 1 von BEN (Runde 1)
  // ----------------------------------------------------------------------------------------------
  // Zahnrad anklicken, „Seitenhilfe" anklicken, lesen. Genau der Handgriff aus dem Auftrag §1, und
  // genau der Weg, den `zahnrad-zeigt-den-erklaersatz.test.tsx:174-176` schon geht.
  async function seitenhilfeOeffnen(): Promise<void> {
    await klicke(marke("kopfband-zahnrad"));
    await klicke(marke("zahnrad-seitenhilfe"));
  }

  /**
   * DIE EINTRAEGE der geoeffneten Seitenhilfe, EINZELN — je Eintrag Titel und Text getrennt.
   *
   * ZWEI GRUENDE FUER DIESE BAUFORM, BEIDE VON BEN GEMESSEN:
   *
   * (a) Gelesen wird der GEZEICHNETE Text, nicht `wert()`/`i18n.getResource` (Runde 1). Friert
   *     jemand den Testhelfer auf den heutigen deutschen Satz ein und faellt zugleich der ECHTE
   *     deutsche Produkttext auf seine alte, bedingungslose Fassung zurueck, blieb der alte Fall
   *     gruen. Aus dem DOM gelesen kann das nicht passieren.
   *
   * (b) Gelesen wird JEDER EINTRAG FUER SICH, nicht der zusammengelaufene Text der ganzen Liste
   *     (Runde 2). Der Fall der Runde 2 suchte „aus dem Bestand" im `textContent` des `<ul>` — und
   *     diese Wendung steht auch in der SCHWESTERHILFE. BEN hat im Erklaersatz „Gehoert ein Knoten
   *     zu einem Objekt aus dem Bestand, fuehrt ein Klick …" durch „Bei jedem Knoten fuehrt ein
   *     Klick …" ersetzt, Negativsatz und Schwesterhilfe unveraendert gelassen, nichts am Test
   *     geaendert — `Tests 20 passed (20)`. Die Schwesterhilfe deckte den Verlust des anderen
   *     Satzes zu. Seit dieser Runde traegt jeder Eintrag seine Bedingung selbst.
   *
   * Bauform der Liste: `ZahnradMenue.tsx:64-68` — ein `<li>` je Eintrag, darin ein `<div>` mit dem
   * Titel und ein `<p>` mit dem Text.
   */
  function seitenhilfeEintraege(): { titel: string; text: string }[] {
    const liste = container.querySelector('[data-testid="seitenhilfe-liste"]');
    if (liste === null) {
      throw new Error(
        "/graph: die geoeffnete Seitenhilfe zeigt gar keine Liste — der Fall liest nichts und misst nichts",
      );
    }
    const glatt = (s: string | null | undefined): string => (s ?? "").replace(/\s+/g, " ").trim();
    return [...liste.querySelectorAll(":scope > li")].map((li) => ({
      titel: glatt(li.querySelector(":scope > div")?.textContent),
      text: glatt(li.querySelector(":scope > p")?.textContent),
    }));
  }

  /**
   * Der Text GENAU DES Eintrags mit diesem Titel — der Titel ist die Kennung, an der die beiden
   * Saetze auseinandergehalten werden. Fehlt der Eintrag, sagt die Meldung das mit allen Titeln,
   * die statt seiner dastehen; ein Fall, der den falschen Eintrag liest, misst nichts.
   */
  function eintragsText(titel: string, sprache: string): string {
    const alle = seitenhilfeEintraege();
    const treffer = alle.filter((e) => e.titel === titel);
    expect(
      treffer.length,
      `/graph (${sprache}): in der geoeffneten Seitenhilfe steht nicht genau EIN Eintrag „${titel}“ — gefunden: ${JSON.stringify(alle.map((e) => e.titel))}`,
    ).toBe(1);
    return treffer[0]?.text ?? "";
  }

  // Die drei Fassungen, je Sprache mit den Wendungen, an denen sie haengen.
  //   `erklaerTitel`/`schwesterTitel` — die Ueberschriften, an denen die beiden Eintraege in der
  //     geoeffneten Liste auseinandergehalten werden (`help.graph.title`, `seitenhilfe.graph.titel`).
  //   `bedingung` — die Wendung, mit der die SCHWESTERHILFE die Bedingung in DIESER Sprache schon
  //     vor JOB 3889 nannte. Sie ist nicht frei gewaehlt: dass BEIDE Saetze sie tragen, ist der
  //     Gegenstand des Auftrags. Geprueft wird sie im Erklaersatz-Eintrag FUER SICH.
  //   `ohne` — die zweite Haelfte, die der Erklaersatz seit JOB 3889 dazusagt.
  //   `schwester` — die Bedingung im Wortlaut der Schwesterhilfe, in IHREM Eintrag geprueft. Ohne
  //     sie gaebe es keinen Vergleichspunkt, und ihr Verlust bliebe unbemerkt (BEN, Runde 2).
  //
  // DIE VIER WORTLISTEN DER RUNDE 4 (fuer `keineUnbedingteZusage`, siehe Dateikopf (5)). Sie sind
  // nicht der Wortlaut der Saetze, sondern ihre GRAMMATIK — deshalb ueberlebt die Pruefung eine
  // Umformulierung, und deshalb faellt eine hinzugefuegte Allaussage auf:
  //   `bedien` — woran ein Satzglied erkennbar von Klick oder Tastatur spricht. Nur solche Glieder
  //     werden geprueft; „zeichnet … als Netz" und „folge seinen Linien" sagen nichts zu.
  //   `negation` — woran ein Glied als VERNEINUNG erkennbar ist (der Negativsatz darf und soll von
  //     der Tastatur sprechen, ohne die Bedingung zu wiederholen). DIESELBE Liste traegt seit
  //     Runde 5 die Richtungspruefung `bedingungStehtUnverneint()`, dort mit umgekehrtem Vorzeichen:
  //     im Teilsatz der Voraussetzung darf keines dieser Woerter stehen (Dateikopf (6)).
  //   `alleKnoten` — die Allaussagen. Ein Bedien-Glied, das eine davon traegt, ist IMMER rot: die
  //     Flaeche hat einen Knoten, fuer den es nicht gilt. Hier haengt der alte Mangel dieses
  //     Auftrags („von Knoten zu Knoten", „from node to node", „van knooppunt naar knooppunt").
  const FASSUNGEN = [
    {
      sprache: "de",
      name: "deutsche",
      erklaerTitel: "Wissensgraph",
      schwesterTitel: "Vom Punkt zum Wissensobjekt springen",
      bedingung: "aus dem Bestand",
      ohne: "ein Knoten ohne solches Objekt ist kein Link und liegt nicht in der Tastatur-Reihenfolge",
      schwester: "gehört er zu einem Objekt aus dem Bestand",
      bedien: ["klick", "tastatur"],
      negation: ["kein", "nicht", "ohne"],
      alleKnoten: [
        "jeder knoten",
        "jeden knoten",
        "jedem knoten",
        "alle knoten",
        "allen knoten",
        "von knoten zu knoten",
      ],
    },
    {
      sprache: "en",
      name: "englische",
      erklaerTitel: "Knowledge Graph",
      schwesterTitel: "Jump from a dot to the knowledge object",
      bedingung: "in the holdings",
      ohne: "a node without such an object is not a link and is not in the keyboard order",
      schwester: "if it belongs to an object in the holdings",
      bedien: ["click", "keyboard"],
      negation: ["not", "without"],
      alleKnoten: ["every node", "each node", "any node", "all nodes", "from node to node"],
    },
    {
      sprache: "nl",
      name: "niederlaendische",
      erklaerTitel: "Kennisgraaf",
      schwesterTitel: "Van een punt naar het kennisobject springen",
      bedingung: "uit het bestand",
      ohne: "een knooppunt zonder zo’n object is geen link en ligt niet in de toetsenbordvolgorde",
      schwester: "hoort het bij een object uit het bestand",
      bedien: ["klik", "toetsenbord"],
      negation: ["geen", "niet", "zonder"],
      alleKnoten: [
        "elk knooppunt",
        "ieder knooppunt",
        "elke knoop",
        "alle knooppunten",
        "van knooppunt naar knooppunt",
      ],
    },
  ] as const;

  /**
   * DIE SATZGLIEDER, DIE ETWAS ZUSAGEN, WAS DIE FLAECHE NICHT FUER JEDEN KNOTEN HAELT.
   *
   * Zerlegt wird an `.` und `;` — NICHT am Gedankenstrich: die Schwesterhilfe traegt ihre Bedingung
   * hinter einem Gedankenstrich („einen Punkt anklicken — gehoert er zu einem Objekt aus dem
   * Bestand, fuehrt er dich dorthin"), und ein Schnitt dort wuerde sie von ihrer Zusage trennen.
   *
   * Geprueft wird nur, was von Klick oder Tastatur spricht (`bedien`). So ein Glied ist in Ordnung,
   * wenn es die Bedingung nennt ODER eine Verneinung ist — und NIE, wenn es eine Allaussage traegt
   * (`alleKnoten`). Zurueck kommen die beanstandeten Glieder im Wortlaut, damit die Meldung zeigt,
   * welcher Halbsatz zu viel verspricht, statt nur „der Satz ist falsch" zu sagen.
   */
  function unbedingteZusagen(satz: string, f: (typeof FASSUNGEN)[number]): string[] {
    // Die drei Listen werden auf `readonly string[]` verbreitert: `FASSUNGEN` ist `as const`, und
    // ein Aufruf von `.some` auf der Vereinigung dreier Literal-Tupel ist unnoetig heikel.
    const bedien: readonly string[] = f.bedien;
    const negation: readonly string[] = f.negation;
    const alleKnoten: readonly string[] = f.alleKnoten;
    const bedingung = f.bedingung.toLowerCase();
    return satz
      .split(/[.;]+/)
      .map((glied) => glied.trim())
      .filter((glied) => glied.length > 0)
      .filter((glied) => {
        const g = glied.toLowerCase();
        if (!bedien.some((w) => g.includes(w))) {
          return false;
        }
        if (alleKnoten.some((w) => g.includes(w))) {
          return true;
        }
        return !g.includes(bedingung) && !negation.some((w) => g.includes(w));
      });
  }

  /**
   * DIE BINDUNG, DIE RUNDE 4 NACHTRAEGT (Dateikopf (5)): kein Glied des GEZEICHNETEN Satzes sagt
   * Klick oder Tastatur ohne Bedingung zu — und die Meldung nennt den Knoten, an dem die Zusage auf
   * DIESER Flaeche nachweislich nicht stimmt. `ohneObjekt` kommt aus dem DOM desselben Mounts.
   */
  function keineUnbedingteZusage(
    f: (typeof FASSUNGEN)[number],
    titel: string,
    satz: string,
    ohneObjekt: readonly string[],
  ): void {
    const offen = unbedingteZusagen(satz, f);
    expect(
      offen,
      `/graph (${f.sprache}): der Eintrag „${titel}“ sagt Klick oder Tastatur OHNE Bedingung zu — beanstandet ist ${offen.map((s) => `„${s}“`).join(" · ")}. Auf DERSELBEN gezeichneten Flaeche ist ${ohneObjekt.map((t) => `„${t}“`).join(", ")} kein Link: dort trifft diese Zusage nicht zu. Entweder traegt das Satzglied die Bedingung „${f.bedingung}“, oder es ist eine Verneinung — eine Allaussage ueber alle Knoten ist sie nie.`,
    ).toEqual([]);
  }

  /**
   * DIE RICHTUNG DER VORAUSSETZUNG — Korrekturpflicht 1 von BEN (Runde 4), siehe Dateikopf (6).
   *
   * Gelesen wird der TEILSATZ, in dem die Bedingungswendung steht: er ist die Voraussetzung, unter
   * der die Zusage daneben gilt. Traegt er eine Verneinung, ist die Voraussetzung umgedreht, und der
   * Satz verspricht Klick und Tastatur gerade fuer den Knoten OHNE Objekt im Bestand — das Gegenteil
   * von `lib/graphNav.ts:12` und das Gegenteil dessen, was dieselbe Flaeche darunter zeichnet.
   *
   * Zerlegt wird an `.` `;` `:` `,` und am Gedanken-/Halbgeviertstrich. Der Gedankenstrich gehoert
   * hier — anders als bei `unbedingteZusagen()` — ausdruecklich dazu: die Schwesterhilfe fuehrt ihre
   * Voraussetzung hinter ihm ein („einen Punkt anklicken — gehoert er zu einem Objekt aus dem
   * Bestand, fuehrt er dich dorthin"), und ohne den Schnitt stuende das Klick-Wort im selben Stueck
   * wie die Voraussetzung.
   *
   * Erkannt wird eine Verneinung am WORTANFANG (`\bkein` trifft „kein", „keine", „keinen"): die
   * Verneinungswoerter der drei Sprachen werden gebeugt, ein Wortende-Anker wuerde sie verfehlen.
   */
  function bedingungStehtUnverneint(
    f: (typeof FASSUNGEN)[number],
    titel: string,
    satz: string,
  ): void {
    const negation: readonly string[] = f.negation;
    const bedingung = f.bedingung.toLowerCase();
    const voraussetzungen = satz
      .split(/[.;:,—–]+/)
      .map((teil) => teil.trim())
      .filter((teil) => teil.length > 0 && teil.toLowerCase().includes(bedingung));
    expect(
      voraussetzungen,
      `/graph (${f.sprache}): im Eintrag „${titel}“ steht die Wendung „${f.bedingung}“ in keinem eigenen Teilsatz — dann kann dieser Fall ihre RICHTUNG nicht lesen und misst nichts. Gelesen: „${satz}“`,
    ).not.toEqual([]);
    for (const voraussetzung of voraussetzungen) {
      const verneint = negation.filter((wort) =>
        new RegExp(`\\b${wort}`, "u").test(voraussetzung.toLowerCase()),
      );
      expect(
        verneint,
        `/graph (${f.sprache}): im Eintrag „${titel}“ ist die Voraussetzung UMGEDREHT — der Teilsatz „${voraussetzung}“ traegt ${verneint.map((w) => `„${w}…“`).join(", ")}. So gelesen gilt die Zusage gerade fuer den Knoten OHNE Objekt im Bestand; die Flaeche darunter haelt das Gegenteil (lib/graphNav.ts:12, und „${f.ohne}“ steht zwei Halbsaetze weiter). Die Wendung „${f.bedingung}“ allein genuegt nicht — sie muss in einer BEJAHTEN Voraussetzung stehen.`,
      ).toEqual([]);
    }
  }

  /**
   * BEIDE SAETZE DIESER SPRACHE, JEDER IN SEINEM EIGENEN EINTRAG — das ist die Korrekturpflicht aus
   * Runde 2. Die Zusicherungen beissen einzeln und nennen je den Eintrag, um den es geht:
   * fehlt die Bedingung im Erklaersatz, faellt der Erklaersatz auf; verliert die Schwesterhilfe die
   * ihre, faellt die Schwesterhilfe auf. Keiner der beiden kann den anderen mehr zudecken.
   *
   * Runde 4: dazu tritt fuer BEIDE Eintraege die Gliedpruefung. Die Anwesenheit der Bedingung allein
   * genuegte nicht — ein Satz konnte sie behalten und daneben eine unbedingte Zusage dazusagen.
   *
   * Runde 5: und davor die Richtungspruefung. Auch die Gliedpruefung genuegte nicht — ein Satz
   * konnte die Wendung behalten und ihre Voraussetzung ins Gegenteil drehen (Dateikopf (6)).
   */
  function beideEintraegeTragenDieBedingung(
    f: (typeof FASSUNGEN)[number],
    ohneObjekt: readonly string[],
  ): void {
    const erklaer = eintragsText(f.erklaerTitel, f.sprache);
    const schwester = eintragsText(f.schwesterTitel, f.sprache);
    expect(
      erklaer,
      `/graph (${f.sprache}): der Erklaersatz „${f.erklaerTitel}“ nennt in seinem EIGENEN Eintrag die Bedingung „${f.bedingung}“ nicht — dass sie in der Schwesterhilfe darunter steht, hilft dem Leser dieses Satzes nicht. Gelesen: „${erklaer}“`,
    ).toContain(f.bedingung);
    expect(
      erklaer,
      `/graph (${f.sprache}): der Erklaersatz „${f.erklaerTitel}“ sagt nicht, was am Knoten OHNE Objekt gilt („${f.ohne}“) — dann verspricht er dem Leser DIESER Sprache mehr, als die Flaeche haelt`,
    ).toContain(f.ohne);
    expect(
      schwester,
      `/graph (${f.sprache}): die Schwesterhilfe „${f.schwesterTitel}“ nennt ihre Bedingung „${f.schwester}“ nicht mehr — dann sagen die beiden Saetze im Zahnrad wieder Verschiedenes, nur andersherum als vor JOB 3889. Gelesen: „${schwester}“`,
    ).toContain(f.schwester);
    bedingungStehtUnverneint(f, f.erklaerTitel, erklaer);
    bedingungStehtUnverneint(f, f.schwesterTitel, schwester);
    keineUnbedingteZusage(f, f.erklaerTitel, erklaer, ohneObjekt);
    keineUnbedingteZusage(f, f.schwesterTitel, schwester, ohneObjekt);
  }

  /** Der Bestand, in dem GENAU ein gezeichneter Knoten kein Wissensobjekt hat: `ko-c` fehlt. */
  const BESTAND_OHNE_KO_C = KOS.filter((k) => k.id !== "ko-c");

  /** Die Titel der Knoten, deren Objekt in DIESEM Bestand liegt — aus dem Pruefstand, nicht aus dem Produkt. */
  const NAVIGIERBAR_LAUT_PRUEFSTAND = KNOTEN.filter((k) =>
    BESTAND_OHNE_KO_C.some((x) => x.id === k.id),
  ).map((k) => k.title);

  /** Die Titel der Knoten, die auf der gezeichneten Flaeche wirklich ein Link sind. */
  function alsLinkGezeichnet(): string[] {
    return knotenGruppen()
      .filter((g) => g.getAttribute("role") === "link")
      .map((g) => g.querySelector(":scope > title")?.textContent ?? "?")
      .sort();
  }

  /**
   * DAS GEGENBEISPIEL AUS DEM DOM — die gezeichneten Knoten, die KEIN Link sind. Sie sind der Grund,
   * aus dem eine unbedingte Zusage im Satz darueber falsch ist; ohne sie waere die Gliedpruefung
   * eine Geschmacksfrage. Gibt die Flaeche kein Gegenbeispiel her, ist der Fall rot statt still
   * gruen: dann trifft der Negativsatz der Seitenhilfe („… ist kein Link") auf keinen Knoten zu.
   * Das ist die Richtung, in der die Verstellung von `lib/graphNav.ts:13` auf `return true` beisst.
   */
  function gegenbeispielAufDerFlaeche(sprache: string): string[] {
    const ohneObjekt = knotenGruppen()
      .filter((g) => g.getAttribute("role") !== "link")
      .map((g) => g.querySelector(":scope > title")?.textContent ?? "?")
      .sort();
    expect(
      ohneObjekt,
      `/graph (${sprache}): auf dieser Flaeche ist JEDER gezeichnete Knoten ein Link — dann ist der Negativsatz der Seitenhilfe („ein Knoten ohne solches Objekt ist kein Link“) an keinem Knoten mehr wahr, und die Gliedpruefung der Zusage haette kein Gegenbeispiel`,
    ).not.toEqual([]);
    return ohneObjekt;
  }

  it("GF3d: der Satz, den die geoeffnete Seitenhilfe zeigt, ist die Bedingung, nach der DIESELBE Flaeche ihre Knoten zeichnet", async () => {
    // JOB 3889, Ablesung des alten Nachfuehr-Pins (siehe Dateikopf). Runde 2, Korrekturpflicht 1
    // von BEN: gebunden wird an die WIRKLICH GEOEFFNETE Seitenhilfe, nicht an `i18n.getResource`.
    //
    // EIN Mount, EIN DOM, zwei Ablesungen: oben der Text, den der Mensch im Zahnrad liest, unten
    // die Knoten, die dieselbe Seite gerade zeichnet. `ko-c` faellt aus dem Bestand, gezeichnet
    // wird er trotzdem (der Graph kommt aus der Analytik, nicht aus dem Bestand) — so stehen beide
    // Seiten der Bedingung nebeneinander, statt in zwei Listen dieses Tests.
    d.setze({ kos: BESTAND_OHNE_KO_C, knoten: KNOTEN, kanten: KANTEN });
    await montiere(GraphView, "/graph", true, true);

    // (0) Kalibrierung: die Buehne traegt beide Seiten der Bedingung. Ohne sie waere alles Weitere
    // auch auf einer toten Buehne still gruen.
    expect(
      knotenGruppen()
        .map((g) => g.querySelector(":scope > title")?.textContent)
        .sort(),
      "/graph: es sind nicht alle Knoten gezeichnet — der Fall misst nichts",
    ).toEqual([...KNOTEN.map((k) => k.title)].sort());
    expect(
      NAVIGIERBAR_LAUT_PRUEFSTAND,
      "/graph: im Bestand dieses Laufs hat KEIN gezeichneter Knoten ein Objekt — dann hat die Bedingung keine zwei Seiten",
    ).toEqual([TITEL_A, TITEL_B]);

    await seitenhilfeOeffnen();

    // (1) Was DASTEHT. In der geoeffneten Liste stehen GENAU zwei Eintraege untereinander — der
    // Erklaersatz und die Schwesterhilfe —, und JEDER wird fuer sich gelesen. Genau daran ist die
    // Runde 2 gescheitert: im zusammengelaufenen Text der Liste deckte die Schwesterhilfe den
    // Verlust der Bedingung im Erklaersatz zu (BEN: 20 von 20 gruen trotz „Bei jedem Knoten fuehrt
    // ein Klick …").
    const deutsch = FASSUNGEN[0];
    expect(
      seitenhilfeEintraege().map((e) => e.titel),
      "/graph: im Zahnrad stehen nicht die zwei Saetze dieser Seite untereinander — dann misst der Fall nicht mehr das, worum es geht",
    ).toEqual([deutsch.erklaerTitel, deutsch.schwesterTitel]);
    // Das Gegenbeispiel wird VOR den Saetzen aus dem DOM gelesen: erst damit ist die Gliedpruefung
    // in `beideEintraegeTragenDieBedingung` eine Aussage ueber DIESE Flaeche (Dateikopf (5)).
    beideEintraegeTragenDieBedingung(deutsch, gegenbeispielAufDerFlaeche(deutsch.sprache));

    // (2) Was die Flaeche darunter TUT. Die Menge der Knoten, die wirklich ein Link sind, ist genau
    // die Menge derer, deren Objekt im Bestand liegt — abgelesen an DIESEM DOM. Beide Richtungen
    // beissen einzeln und nennen den Knoten beim Namen (Lehre JOB 3587 R4).
    const sindLink = alsLinkGezeichnet();
    const sollten = [...NAVIGIERBAR_LAUT_PRUEFSTAND].sort();
    const zuviel = sindLink.filter((t) => !sollten.includes(t));
    const zuwenig = sollten.filter((t) => !sindLink.includes(t));
    expect(
      zuviel,
      `/graph: der Knoten ${zuviel.map((t) => `„${t}“`).join(", ")} hat KEIN Objekt im Bestand und ist trotzdem ein Link — die Seitenhilfe darueber sagt „${deutsch.ohne}“`,
    ).toEqual([]);
    expect(
      zuwenig,
      `/graph: der Knoten ${zuwenig.map((t) => `„${t}“`).join(", ")} hat sein Objekt im Bestand und ist trotzdem kein Link — die Seitenhilfe darueber verspricht ihm den Sprung zum Wissensobjekt`,
    ).toEqual([]);

    // (3) WAS DIESER FALL NICHT NOCH EINMAL BAUT (BEN, Runde 1, Korrekturpflicht 2): die feinen
    // Kanten des unbekannten Knotens — kein Tabstopp, keine angenommene Taste, kein wirkender
    // Klick, kein Fokusring, kein Zeigerkreuz — gehoeren U1–U5 in
    // `tests/wissensgraph-lesbarkeit/unbekannter-knoten-ist-kein-link.test.tsx`, und der Sprung des
    // BEKANNTEN Knotens an sein Objekt steht in GF3b und GF3c oben. Hier steht allein die Bindung.
    // Damit diese Zuordnung kein blosser Kommentar bleibt, wird ihr Eigentuemer nachgesehen: faellt
    // er weg, ist die zweite Haelfte des Satzes unbelegt und muss hier wieder aufgebaut werden.
    // Das belegt NICHT, dass jene Faelle gruen sind — nur, dass es sie noch gibt.
    const nachbar = readFileSync(
      join(__dirname, "..", "wissensgraph-lesbarkeit", "unbekannter-knoten-ist-kein-link.test.tsx"),
      "utf8",
    );
    for (const fall of ["U1 · kein Tabstopp", "U2 · keine Taste", "U3 · kein Klickziel"]) {
      expect(
        nachbar,
        `/graph: „${fall}“ steht nicht mehr in tests/wissensgraph-lesbarkeit/unbekannter-knoten-ist-kein-link.test.tsx — dieser Fall hat die Kante an ihn abgegeben und muesste sie jetzt selbst wieder messen`,
      ).toContain(fall);
    }
  });

  // ----------------------------------------------------------------------------------------------
  // GF3g · DIE DREI FASSUNGEN SAGEN DASSELBE (JOB 3889)
  // ----------------------------------------------------------------------------------------------
  // Der Demo-Zugang wird dreisprachig ausgehaendigt: eine Bedingung, die nur im Deutschen steht,
  // waere fuer den englischen und den niederlaendischen Leser genau der alte Mangel. Je Sprache
  // ein eigener Fall mit eigener Meldung — eine Mengenpruefung ueber alle drei wuerde den Rueckfall
  // EINER Fassung verschlucken (Lehre JOB 3587 R4: einzeln beissend, nicht als Menge).
  //
  // AUCH HIER WIRD GEOEFFNET UND GELESEN, nicht nachgeschlagen (Korrekturpflicht 1 von BEN gilt
  // fuer alle drei Sprachen): die Seite wird in der jeweiligen Sprache montiert, das Zahnrad
  // geoeffnet, und geprueft wird der Text, der DORT steht — je Eintrag einzeln
  // (Korrekturpflicht aus Runde 2, siehe `seitenhilfeEintraege`).
  for (const f of FASSUNGEN) {
    it(`GF3g-${f.sprache.toUpperCase()}: in der geoeffneten Seitenhilfe (${f.sprache}) traegt JEDER der beiden Saetze die Bedingung selbst`, async () => {
      await i18n.changeLanguage(f.sprache);
      d.setze({ kos: BESTAND_OHNE_KO_C, knoten: KNOTEN, kanten: KANTEN });
      await montiere(GraphView, "/graph", true, true);
      await seitenhilfeOeffnen();
      expect(
        seitenhilfeEintraege().map((e) => e.titel),
        `/graph (${f.sprache}): im Zahnrad stehen nicht die zwei Saetze dieser Seite untereinander — dann misst der Fall in dieser Sprache nichts`,
      ).toEqual([f.erklaerTitel, f.schwesterTitel]);
      beideEintraegeTragenDieBedingung(f, gegenbeispielAufDerFlaeche(f.sprache));
      // Und dass die Flaeche darunter sich in dieser Sprache genauso verhaelt: derselbe Bestand,
      // dieselben zwei Links. Ein Satz, der nur in einer Sprache zur Flaeche passt, waere keiner.
      expect(
        alsLinkGezeichnet(),
        `/graph (${f.sprache}): in dieser Sprache sind andere Knoten ein Link als in den uebrigen — die Bedingung des Satzes gilt dort nicht`,
      ).toEqual([...NAVIGIERBAR_LAUT_PRUEFSTAND].sort());
    });
  }

  it("GF3e · L4: der Graph hat nur EINE Darstellung — auf schmalem Fenster dieselbe wie auf breitem", async () => {
    // Genau daran ist die Themenkarte in JOB 3741 R1 gescheitert: sie gibt es unter 900 px gar
    // nicht (`pages/Wissensnetz.tsx`, `LESEN_UNTER`). Der Graph fragt die Fensterbreite NICHT ab;
    // gemessen wird das an der gezeichneten Flaeche und nicht am Quelltext.
    setzeBreite(false);
    await mitBestand();
    const breit = knotenGruppen().map((g) => g.querySelector(":scope > title")?.textContent);
    const breitLinien = container.querySelectorAll("svg line").length;
    setzeBreite(true);
    await mitBestand();
    const schmal = knotenGruppen().map((g) => g.querySelector(":scope > title")?.textContent);
    expect(container.querySelector("svg"), "/graph: auf schmal fehlt die Zeichnung").not.toBeNull();
    expect(schmal, "/graph: auf schmal werden andere Knoten gezeichnet").toEqual(breit);
    expect(
      container.querySelectorAll("svg line").length,
      "/graph: auf schmal werden andere Verbindungen gezeichnet",
    ).toBe(breitLinien);
    expect(
      knotenGruppen().filter((g) => g.getAttribute("role") === "link").length,
      "/graph: auf schmal fuehrt der Klick nicht mehr zum Objekt",
    ).toBe(KNOTEN.length);
  });

  it("GF3f · §9: im erfolgreich LEEREN Bestand gibt es kein Netz — „fang bei einem Objekt an“ trifft dann nicht zu", async () => {
    behauptung("/graph", "graph", "folge seinen Linien");
    d.setze({ kos: KOS, knoten: [], kanten: [] });
    await montiere(GraphView, "/graph", true);
    expect(text(), "/graph: der Leerzustand sagt nichts").toContain(wert("s2.graphEmpty"));
    expect(container.querySelector("svg"), "/graph: im Leerzustand wird gezeichnet").toBeNull();
  });
});
