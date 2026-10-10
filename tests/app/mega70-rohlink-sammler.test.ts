// ================================================================================================
// AUFTRAG-mega70 BLOCK D — KEIN BEWACHTES ZIEL WIRD ÜBER EINEN ROHEN LINK ZUM WEG.
// ================================================================================================
// bens Befund (sammel66-vortest, ROT): vier sichtbare Stellen boten der Testerin einen Weg an,
// den ihre Rolle nicht gehen darf — der Router warf sie kommentarlos auf /start zurück. Dieser
// Sammler hält die Bauform fest, damit die fünfte Stelle nicht morgen entsteht: ein Ziel aus der
// bewachten Menge (GUARDED_ITEMS) darf auf diesen Flächen nur über das EINE Tor (RoleLink)
// angeboten werden, das die Rollenfrage an derselben Registry stellt wie der Router.
//
// ER IST EIN SAMMLER, KEINE LISTE. Erhoben wird in vier Stufen, und keine zählt Fälle:
//  (0) DIE FLÄCHEN samt ihrer Rollenschwelle — aus routes.tsx (PAGES) + GUARDED_ITEMS, nicht
//      abgeschrieben: welche Nav-Ids eine Datei rendert und ab welcher Rolle die Fläche selbst
//      erreichbar ist.
//  (1) DIE VORKOMMEN — jedes `to=` im Quelltext (Kommentare entfernt, Zeilennummern erhalten)
//      samt dem Tag, das es trägt (<Link>/<GuardedLink>/<RoleLink>/…). Ein `to=` an einem
//      unbekannten Tag ist rot und wird wörtlich zitiert, statt still aus der Erhebung zu fallen.
//  (2) DIE ZIELE — Literale und Templates direkt; jeder andere Ausdruck braucht eine BENANNTE
//      Herkunft, deren Zielmenge aus den produktiven Tabellen/Funktionen GELESEN wird
//      (knowledgeGuidance, libraryUseCta, ownKnowledgeEmptyHint, captureNextSteps, askAnswerHref).
//      Ein unbekannter Ausdruck ist rot und wird wörtlich zitiert.
//  (3) DIE ZUSAGE — für jede Rolle, die die Fläche selbst sehen darf: jedes Ziel eines ROHEN
//      Links (alles außer RoleLink) muss `routePathAllows` bestehen — dieselbe Registry, aus der
//      der Router sein Gate zieht. RoleLink-Vorkommen sind der erlaubte Weg: das Tor rendert
//      Unerreichbares als Lage (bewiesen in components/RoleLink.tsx + mega51-mounted).
//
// GELTUNGSBEREICH: die beiden Flächen aus mega70 — pages/Library.tsx und pages/Capture.tsx —
// PLUS seit AUFTRAG-mega71 Block E pages/Ask.tsx: die Fläche war in mega70 nur durch die
// mega69-Dateisperre ausgenommen (eine Auftragsgrenze, keine fachliche), und ihre fünf Fund-
// stellen (reviewGuard→/validierung, kg("ask")→/validierung, /konflikte, /risiko,
// captureGapHref→/erfassen) liegen auf dem Weg der Vortest-Aufgabe 3. Bewusst weiterhin ENGER
// als „alle Seiten“, damit die Prüfung nicht falsch anschlägt und in zwei Wochen abgeschaltet
// wird. Benannte Blindheit (es gibt sie immer; verschwiegen wird sie zur Falle):
//  1. ANDERE SEITEN. /start hält mega51-startziele-erreichbar-sammler, die Shell
//     shell-links-guarded. Die 26 weiteren Kandidaten der app-weiten Erhebung (mega70-Bericht)
//     sind als Folgearbeit im Register vermerkt und werden NACH dem Vortest angefasst.
//  2. EINE EBENE. Bauteile, die die Seiten einbinden, sind nicht erfasst (Capture bindet ~30 ein;
//     deren Ausdrücke bräuchten je eine Herkunft — Rauschen). Ein Link in einem Bauteil wäre der
//     nächste Befund, nicht dieser.
//  3. `<a href>`-Anker sind nicht erfasst — sie tragen in beiden Dateien Download-/API-URLs,
//     keine Router-Ziele.
//  4. QUELLTEXT, KEIN VERHALTEN. Dass die gesperrte Fassung wirklich keine <a href> rendert,
//     beweisen RoleLink.tsx (ein <Link> nur im erlaubten Zweig, gepinnt in mega51 A3) und der
//     gemountete mega51-Fall.
//
// AUFTRAG-mega72 (OFFEN.md B41) — DER SAMMLER SAGT NICHT BREITER ZU, ALS ER ERHEBT:
//  A  Ein UNABHÄNGIGER Rohzähler zählt jedes `to`-Attribut im kommentarfreien Quelltext — in jeder
//     Schreibweise (`to=`, `to = `, Zeilenumbruch um das `=`) — und wird exakt gegen die
//     erfolgreich gelesenen Vorkommen kalibriert. Ein Attribut, das der Leser nicht fassen kann
//     (z. B. verschachtelte Klammern), fällt nicht still heraus, sondern steht rot mit Datei und
//     Zeile. Ein Ausdruck liefert nur dann Ziele, wenn er VOLLSTÄNDIG verstanden ist (`verstehe`):
//     ein Ternär mit zwei Template-Zweigen liefert beide Ziele; ein Ternär mit einem unbekannten
//     Zweig ist als GANZER Ausdruck unbekannt und rot. Die synthetischen Negativ-Kalibrierungen am
//     Ende beweisen das: verschachtelte Klammern, zwei unterschiedlich geschützte Template-Ziele,
//     Leerraum um das `=` und ein gemischter Template-/Unbekannt-Ternär.
//  B  Die Zielmenge der Erfolgskarte wird über die produktive Rollenliste `ROLES` gelesen, nicht
//     über einen hart codierten Zweier-Satz. `FLAECHEN` und `HERKUNFT` bleiben: sie sind oben
//     als Geltungsbereich benannt und für erfasste Ausdrücke fail-closed (unbekannt = rot).
// ================================================================================================
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import {
  GUARDED_ITEMS,
  ROLES,
  type Role,
  roleAllows,
  routePathAllows,
} from "../../apps/web/src/app/navigation";
import { fragenHref } from "../../apps/web/src/components/bibliothek/fragen";
import { askAnswerHref } from "../../apps/web/src/lib/askQuestion";
// AUFTRAG-mega71 Block E: die benannten Herkünfte der Ask-Fläche — die Zielmengen werden aus den
// PRODUKTIVEN Funktionen gelesen, nicht abgeschrieben (Stufe-2-Regel dieses Sammlers).
import { answerReviewGuard } from "../../apps/web/src/lib/askView";
import { captureGapHref } from "../../apps/web/src/lib/captureFromGap";
import { CAPTURE_FRONT_DOOR_ROUTE } from "../../apps/web/src/lib/captureFrontDoor";
import { captureNextSteps } from "../../apps/web/src/lib/captureSuccess";
import { OWN_KNOWLEDGE_FILTER, ownKnowledgeEmptyHint } from "../../apps/web/src/lib/demoKnowledge";
import { knowledgeGuidance } from "../../apps/web/src/lib/knowledgeGuidance";
import { koCta } from "../../apps/web/src/lib/koCta";
import { reworkValidationHref } from "../../apps/web/src/lib/reviewReworkContext";

const WEB_SRC = join(__dirname, "../../apps/web/src");
const lies = (p: string): string => readFileSync(p, "utf8");

// Kommentare raus, Zeilennummern ERHALTEN (Zeichen durch Leerzeichen ersetzen, Zeilen stehen lassen)
// — eine Erwähnung („hier stand ein rohes <Link>") zählt nicht als Treffer, aber Fundstellen bleiben
// zitierfähig.
function ohneKommentare(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|\s)\/\/.*$/gm, (m) => m.replace(/[^\n]/g, " "));
}

function zeileVon(src: string, index: number): number {
  return src.slice(0, index).split("\n").length;
}

// Das wörtliche Zitat einer Fundstelle: ab dem Treffer bis zum Zeilenende.
function restDerZeile(src: string, index: number): string {
  return (src.slice(index).split("\n")[0] ?? "").trim();
}

// ── Stufe 0: die Flächen samt Rollenschwelle — aus routes.tsx erhoben, nicht abgeschrieben ──────
const FLAECHEN = ["Library", "Capture", "Ask"] as const;

// JOB 3063 (H4) — DER SAMMLER FOLGT DER FLÄCHE, NICHT DEM DATEINAMEN.
//
// Bis hierher galt „eine Fläche = eine Datei unter `pages/`". Seit H4 ist die Bibliothek aus
// mehreren Bauteilen gebaut (Liste, Lesefläche, „Mehr", die Klammer darum), und `pages/Library.tsx`
// ist nur noch der Adress-Adapter. Läse der Sammler weiterhin allein die Seitendatei, liefe er für
// die Bibliothek STILL LEER — genau der Ausgang, gegen den die erste Zusicherung unten steht
// (`vorkommen.length > 3`). Die Rollenschwelle bleibt unverändert die der SEITE: die Bauteile
// werden nur von ihr gerendert.
const DATEIEN: Record<(typeof FLAECHEN)[number], readonly string[]> = {
  Library: [
    "pages/Library.tsx",
    "components/bibliothek/BibliothekFlaeche.tsx",
    "components/bibliothek/BibliothekListe.tsx",
    "components/bibliothek/BibliothekLesen.tsx",
    "components/bibliothek/MehrAbschnitte.tsx",
  ],
  Capture: ["pages/Capture.tsx"],
  Ask: ["pages/Ask.tsx"],
};

const routesQuelle = ohneKommentare(lies(join(WEB_SRC, "routes.tsx")));

// Welche Nav-Ids rendert eine Seiten-Datei? Komponente aus der Seitenbindung in routes.tsx +
// `id: Komponente` in PAGES.
//
// JOB 3030: Bis zur Umstellung stand die Bindung als statische Importzeile
// (`import { Library } from "./pages/Library"`); seit die Seiten nachgeladen werden, steht sie als
// `const Library = lazy(() => import("./pages/Library").then((m) => ({ default: m.Library })));`.
// Die ERHEBUNG bleibt dieselbe und bleibt an routes.tsx gebunden — nur die Form der Bindung ist eine
// andere. `[^;]*?` begrenzt den Treffer auf GENAU eine Deklaration: ohne diese Grenze könnte der
// Ausdruck über das nächste Semikolon hinauslaufen und einer Seite eine fremde Komponente zuordnen.
function navIdsVonSeite(datei: string): string[] {
  const komponenten = [
    ...routesQuelle.matchAll(
      new RegExp(
        `const\\s+([A-Za-z0-9]+)\\s*=\\s*lazy\\([^;]*?import\\("\\./pages/${datei}"\\)`,
        "g",
      ),
    ),
  ].map((m) => m[1] as string);
  if (komponenten.length === 0) {
    return [];
  }
  return [...routesQuelle.matchAll(/^\s*([A-Za-z0-9]+):\s*([A-Za-z0-9]+),\s*$/gm)]
    .filter((m) => komponenten.includes(m[2] as string))
    .map((m) => m[1] as string);
}

// Ab welcher Rolle ist die Fläche selbst erreichbar? (Die Registry des Routers, keine zweite Tabelle.)
function rollenDerFlaeche(datei: string): Role[] {
  const ids = navIdsVonSeite(datei);
  const items = GUARDED_ITEMS.filter((i) => ids.includes(i.id));
  if (items.length === 0) {
    throw new Error(`Fläche ${datei} hat kein Nav-Item — die Erhebung liefe still leer`);
  }
  return ROLES.filter((rolle) => items.some((item) => roleAllows(item, rolle as Role))) as Role[];
}

// ── Stufe 2 (Vorbereitung): benannte Herkunft je to=-Ausdruck, Ziele aus den Produkttabellen ────
// Minimal-KOs nur so weit, wie `fragenHref` sie wirklich liest (Kennung und Vertraulichkeit).
const OFFENES_KO = { id: "k-offen", status: "offen" } as unknown as KnowledgeObject;
const VALIDIERTES_KO = { id: "k-validiert", status: "validiert" } as unknown as KnowledgeObject;

interface Herkunft {
  muster: RegExp;
  herkunft: string;
  ziele: () => string[];
}

// A27 · JOB 3025: die zwei Wege, die `eigeneKollisionDetail` kennen kann. Sie werden aus der
// PRODUKTDATEI gelesen und nicht abgeschrieben — `KollisionsWeg` ist dort nicht exportiert, und
// eine hier gepflegte Zweitliste wäre genau die Drift, gegen die dieser Sammler steht.
const KOLLISIONS_WEGE: string[] = [
  ...lies(join(WEB_SRC, "lib/eigeneKollision.ts")).matchAll(
    /const WEG_[A-Z]+: KollisionsWeg = \{ to: "([^"]+)"/g,
  ),
].map((m) => m[1] as string);

const HERKUNFT: Record<(typeof FLAECHEN)[number], Herkunft[]> = {
  Library: [
    {
      muster: /^askAnswerHref\(trimmedQ\)$/,
      herkunft: "lib/askQuestion.ts · askAnswerHref",
      ziele: () => [askAnswerHref("frage")],
    },
    {
      muster: /^item\.to$/,
      herkunft: "lib/knowledgeGuidance.ts · knowledgeGuidance(library)",
      ziele: () => knowledgeGuidance("library").items.map((i) => i.to),
    },
    {
      // JOB 3063 (H4): der Leerzustand ist EIN Satz plus EIN Knopf. Unter der Linse „Eigenes
      // Wissen" führt der Knopf dorthin, wo eigenes Wissen entsteht — sonst nach /erfassen.
      muster: /^ownEmpty \? ownEmpty\.to : "\/erfassen"$/,
      herkunft: "lib/demoKnowledge.ts · ownKnowledgeEmptyHint (sonst /erfassen)",
      ziele: () => {
        const hint = ownKnowledgeEmptyHint({ filter: OWN_KNOWLEDGE_FILTER, count: 0 });
        return hint ? [hint.to, "/erfassen"] : ["/erfassen"];
      },
    },
    {
      // JOB 3063 (H4, Runde 5): der Knopf der Lesefläche heißt für JEDEN Eintrag „Fragen" und
      // führt nach `/fragen?…&ko=<id>`. Der frühere Weg über `libraryUseCta` verzweigte über die
      // Reife und schickte offene Einträge nach `/validierung` — das war die zweite Wahrheit, die
      // dieser Umbau abschafft (Codex an Runde 4). Beide Ausgänge der EINEN verbliebenen
      // Verzweigung (Vertraulichkeit) stehen hier, damit die Zieltabelle vollständig ist.
      muster: /^fragen$/,
      herkunft: "components/bibliothek/fragen.ts · fragenHref",
      ziele: () => [
        fragenHref(OFFENES_KO.id, "Was gilt?", OFFENES_KO.confidentiality),
        fragenHref(VALIDIERTES_KO.id, "Was gilt?", "vertraulich"),
      ],
    },
    {
      // JOB 3063 (H4): der Rückweg aus der Nacharbeit (SCRUM-331), jetzt auf der Lesefläche.
      muster: /^reworkValidationHref\(\)$/,
      herkunft: "lib/reviewReworkContext.ts · reworkValidationHref",
      ziele: () => [reworkValidationHref()],
    },
    {
      // WISSENSDETAIL (R-0998): die nächste sinnvolle Handlung der Lesefläche. Der Zweig `use`
      // läuft über `fragen` (oben), `addSource` ist ein Knopf (kein `to=`); über `cta.href`
      // laufen nur `review` und `validate` — beide hinter `RoleLink`.
      muster: /^cta\.href$/,
      herkunft: "lib/koCta.ts · koCta(review|validate).href",
      ziele: () => [koCta("review").href, koCta("validate").href],
    },
    {
      // A27 · JOB 3025: der Weg der Verfasserin zu ihrer Kollision, jetzt im Abschnitt „Konflikt".
      muster: /^kollisionsWeg\.to$/,
      herkunft: "lib/eigeneKollision.ts · eigeneKollisionDetail().weg",
      ziele: () => KOLLISIONS_WEGE,
    },
  ],
  Capture: [
    {
      muster: /^demoHref\(s\.to, params\)$/,
      herkunft: "lib/captureSuccess.ts · captureNextSteps",
      // AUFTRAG-mega72 B: jede produktive Rolle, nicht ein abgeschriebener Zweier-Satz.
      ziele: () => ROLES.flatMap((rolle) => captureNextSteps("ko-x", rolle).map((s) => s.to)),
    },
    {
      muster: /^CAPTURE_FRONT_DOOR_ROUTE$/,
      herkunft: "lib/captureFrontDoor.ts · CAPTURE_FRONT_DOOR_ROUTE",
      ziele: () => [CAPTURE_FRONT_DOOR_ROUTE],
    },
  ],
  // AUFTRAG-mega71 Block E: die Ask-Fläche. `/fragen` ist ab viewer sichtbar — jedes bewachte
  // Ziel (alle fünf Fundstellen, auch /erfassen mit minRole experte) braucht deshalb das Tor.
  Ask: [
    {
      muster: /^item\.to$/,
      herkunft: "lib/knowledgeGuidance.ts · knowledgeGuidance(ask)",
      ziele: () => knowledgeGuidance("ask").items.map((i) => i.to),
    },
    {
      muster: /^demoHref\(reviewGuard\.ctaTo, params\)$/,
      herkunft: "lib/askView.ts · answerReviewGuard (Prüfvorbehalt-CTA)",
      ziele: () => {
        const guard = answerReviewGuard("unverified", []);
        return guard ? [guard.ctaTo] : [];
      },
    },
    {
      muster: /^captureGapHref\(gapId\)$/,
      herkunft: "lib/captureFromGap.ts · captureGapHref",
      ziele: () => [captureGapHref("gap-x")],
    },
  ],
};

// Templates direkt auflösen: bekannte Konstante einsetzen, jeden anderen Platzhalter als ein
// Segment-/Query-Stück („x") lesen — genau wie der Router ein `:id` liest.
function loeseTemplate(roh: string): string {
  return roh
    .replace(/\$\{CAPTURE_FRONT_DOOR_ROUTE\}/g, CAPTURE_FRONT_DOOR_ROUTE)
    .replace(/\$\{[^}]*\}/g, "x");
}

interface Vorkommen {
  /** Die Bauteildatei — seit H4 kann eine Fläche aus mehreren bestehen. */
  quelle: string;
  zeile: number;
  tag: string;
  roh: string;
  ziele: string[];
  unbekannt: string | null;
}

interface Erhebung {
  vorkommen: Vorkommen[];
  /** AUFTRAG-mega72 A: so viele `to=` zählt der unabhängige Rohzähler. */
  roh: number;
  /** Jedes `to=`, das der Rohzähler sieht, der Leser aber nicht fassen kann — mit Datei:Zeile. */
  unlesbar: string[];
}

// ── Stufe 1: jedes to= samt tragendem Tag ───────────────────────────────────────────────────────
function erhebe(datei: (typeof FLAECHEN)[number]): Erhebung {
  const teile = DATEIEN[datei].map((pfad) => erhebeQuelle(datei, pfad, lies(join(WEB_SRC, pfad))));
  return {
    vorkommen: teile.flatMap((t) => t.vorkommen),
    roh: teile.reduce((summe, t) => summe + t.roh, 0),
    unlesbar: teile.flatMap((t) => t.unlesbar),
  };
}

// Die Stelle des ersten Ternär-`?` auf oberster Ebene und des zugehörigen `:` — außerhalb von
// Strings, Templates und Klammern. `?.` und `??` sind kein Ternär. Ohne Ternär: null.
function ternaerTeile(ausdruck: string): [string, string] | null {
  let tiefe = 0;
  let frage = -1;
  let offen = 0;
  for (let i = 0; i < ausdruck.length; i++) {
    const c = ausdruck[i];
    if (c === '"' || c === "'" || c === "`") {
      // String/Template überspringen (mit Escapes); der Inhalt ist kein Operator.
      let j = i + 1;
      while (j < ausdruck.length && ausdruck[j] !== c) {
        j += ausdruck[j] === "\\" ? 2 : 1;
      }
      i = j;
      continue;
    }
    if (c === "(" || c === "[" || c === "{") {
      tiefe++;
    } else if (c === ")" || c === "]" || c === "}") {
      tiefe--;
    } else if (tiefe === 0 && c === "?") {
      const naechstes = ausdruck[i + 1];
      if (naechstes === "." || naechstes === "?" || ausdruck[i - 1] === "?") {
        continue;
      }
      if (frage === -1) {
        frage = i;
      } else {
        offen++;
      }
    } else if (tiefe === 0 && c === ":" && frage !== -1) {
      if (offen === 0) {
        return [ausdruck.slice(frage + 1, i).trim(), ausdruck.slice(i + 1).trim()];
      }
      offen--;
    }
  }
  return null;
}

// AUFTRAG-mega72 A (Nacharbeit 1): die Ziele eines `to={…}`-Ausdrucks — oder null, wenn auch nur
// ein Teil nicht verstanden ist. Verstanden sind GENAU diese Formen:
//   · eine benannte Herkunft (HERKUNFT, ganzer Ausdruck),
//   · ein String-Literal,
//   · ein reines Template (Platzhalter liest loeseTemplate wie der Router ein `:id`),
//   · `demoHref(<verstandener Ausdruck>, params)` — demoHref hängt nur Demo-Query an,
//   · ein Ternär `c ? a : b`, dessen BEIDE Zweige verstanden sind (die Bedingung ist kein Ziel).
// Alles andere — auch `c ? \`/wissen/x\` : unbekanntesZiel` — ist als GANZER Ausdruck unbekannt.
function verstehe(datei: (typeof FLAECHEN)[number], ausdruck: string): string[] | null {
  const a = ausdruck.trim();
  const eintrag = HERKUNFT[datei].find((h) => h.muster.test(a));
  if (eintrag) {
    return eintrag.ziele();
  }
  const literal = a.match(/^"([^"]*)"$/) ?? a.match(/^'([^']*)'$/);
  if (literal) {
    return [literal[1] as string];
  }
  if (/^`[^`]*`$/.test(a)) {
    return [loeseTemplate(a.slice(1, -1))];
  }
  const demo = a.match(/^demoHref\(([\s\S]+),\s*params\)$/);
  if (demo) {
    return verstehe(datei, demo[1] as string);
  }
  const teile = ternaerTeile(a);
  if (teile) {
    const dann = verstehe(datei, teile[0]);
    const sonst = verstehe(datei, teile[1]);
    return dann && sonst ? [...dann, ...sonst] : null;
  }
  return null;
}

// Die Quelle wird hereingereicht (nicht hier gelesen), damit die Negativ-Kalibrierungen unten
// denselben Leser über synthetischen Quelltext laufen lassen können.
function erhebeQuelle(
  datei: (typeof FLAECHEN)[number],
  pfad: string,
  roheQuelle: string,
): Erhebung {
  const src = ohneKommentare(roheQuelle);
  const out: Vorkommen[] = [];
  const gelesen = new Set<number>();
  // JSX erlaubt Leerraum (auch Zeilenumbrüche) um das `=` und einfache wie doppelte Anführungszeichen
  // — der Leser nimmt jede dieser Schreibweisen (Nacharbeit 1, bens Befund zu `to = {ziel}`).
  const LESER = /(?<![.\w$])to\s*=\s*(?:"([^"]*)"|'([^']*)'|\{((?:[^{}]|\$\{[^{}]*\})*)\})/g;
  for (const m of src.matchAll(LESER)) {
    const index = m.index ?? 0;
    gelesen.add(index);
    // Das tragende Tag: die letzte öffnende spitze Klammer vor dem Attribut.
    const davor = src.slice(0, index);
    const tagStart = davor.lastIndexOf("<");
    const tag = davor.slice(tagStart).match(/^<([A-Za-z][A-Za-z0-9]*)\b/)?.[1] ?? "?";
    const literal = m[1] ?? m[2] ?? null;
    const ausdruck = m[3]?.trim() ?? null;
    let ziele: string[] = [];
    let unbekannt: string | null = null;
    if (literal !== null) {
      ziele = [literal];
    } else if (ausdruck !== null) {
      // AUFTRAG-mega72 A (Nacharbeit 1): nur ein VOLLSTÄNDIG verstandener Ausdruck liefert Ziele.
      // Ein Zweig, den `verstehe` nicht auflösen kann, macht den GANZEN Ausdruck unbekannt — kein
      // Template-Zweig darf einen unbekannten Nachbarzweig mit durchziehen.
      const verstanden = verstehe(datei, ausdruck);
      if (verstanden) {
        ziele = verstanden;
      } else {
        unbekannt = ausdruck;
      }
    }
    out.push({ quelle: pfad, zeile: zeileVon(src, index), tag, roh: m[0], ziele, unbekannt });
  }
  // AUFTRAG-mega72 A: der Rohzähler ist vom Leser UNABHÄNGIG — er kennt keine Klammer- und keine
  // Wertregel, nur den Attributnamen samt `=` (mit beliebigem Leerraum; `===` und `=>` sind keine
  // Zuweisung). Was er sieht und der Leser nicht, ist rot und wird mit Datei:Zeile zitiert.
  const rohIndizes = [...src.matchAll(/(?<![.\w$])to\s*=(?![=>])/g)].map((m) => m.index ?? 0);
  const unlesbar = rohIndizes
    .filter((index) => !gelesen.has(index))
    .map((index) => `${pfad}:${zeileVon(src, index)}  ${restDerZeile(src, index)}`);
  return { vorkommen: out, roh: rohIndizes.length, unlesbar };
}

// Stufe 3 als Funktion — die Fläche und die Negativ-Kalibrierung prüfen mit DERSELBEN Zusage.
function verstoesseVon(vorkommen: Vorkommen[], rollen: readonly Role[]): string[] {
  return vorkommen
    .filter((v) => v.tag !== "RoleLink")
    .flatMap((v) =>
      v.ziele.flatMap((ziel) =>
        rollen
          .filter((rolle) => !routePathAllows(ziel, rolle))
          .map((rolle) => `${v.quelle}:${v.zeile}  <${v.tag} to=…> → ${ziel} (${rolle})`),
      ),
    );
}

describe("mega70 D · kein bewachtes Ziel wird auf Library/Capture/Ask über einen rohen Link zum Weg", () => {
  for (const datei of FLAECHEN) {
    const erhebung = erhebe(datei);
    const { vorkommen } = erhebung;

    it(`${datei}: der Rohzähler kalibriert exakt gegen die gelesenen to= (mega72 A)`, () => {
      expect(erhebung.unlesbar).toEqual([]);
      expect(vorkommen.length).toBe(erhebung.roh);
    });

    it(`${datei}: die Erhebung läuft nicht leer und jedes to= sitzt an einem bekannten Tag`, () => {
      // Die Zusage ist „die Erhebung läuft nicht leer" — eine Untergrenze, damit ein kaputter
      // Sammler nicht stillschweigend nichts findet und dadurch grün wirkt.
      //
      // JOB 3062 · H3: Auf `Capture.tsx` sind die verlinkenden Flächen gelöscht (Standardweg-Kasten
      // mit „Dokument-Editor öffnen →", Kopf-Ausgang, „Weitere Wege"); die Wege liegen jetzt im
      // Menü „Datei ▾" des Blattes und sind Knöpfe, keine Links. Übrig sind dort GEMESSEN drei
      // rohe `to=`. Die Untergrenze wird deshalb je Fläche geführt statt global gesenkt — sonst
      // verlöre sie auch für Library und Ask ihre Schärfe.
      const MINDESTENS: Record<(typeof FLAECHEN)[number], number> = {
        Library: 4,
        Capture: 3,
        Ask: 4,
      };
      expect(vorkommen.length).toBeGreaterThanOrEqual(MINDESTENS[datei]);
      const fremd = vorkommen
        .filter(
          (v) => !["Link", "NavLink", "GuardedLink", "GuardedNavLink", "RoleLink"].includes(v.tag),
        )
        .map((v) => `${v.quelle}:${v.zeile}  <${v.tag} … ${v.roh}`);
      expect(fremd).toEqual([]);
    });

    it(`${datei}: kein to=-Ausdruck ohne benannte Herkunft`, () => {
      const offen = vorkommen
        .filter((v) => v.unbekannt !== null)
        .map((v) => `${v.quelle}:${v.zeile}  ${v.roh}`);
      expect(offen).toEqual([]);
    });

    it(`${datei}: die Zusage — rohe Links nur auf Ziele, die JEDE sehende Rolle begehen darf`, () => {
      expect(verstoesseVon(vorkommen, rollenDerFlaeche(datei))).toEqual([]);
    });
  }

  it("die Kalibrier-Zusicherung: die Erhebung kennt die Registry des Routers (nicht still leer)", () => {
    // Ohne bewachte Ziele in der Erhebung wäre Stufe 3 trivial grün.
    const alleZiele = FLAECHEN.flatMap((d) => erhebe(d).vorkommen.flatMap((v) => v.ziele));
    const bewacht = alleZiele.filter((z) =>
      GUARDED_ITEMS.some((i) => i.path === (z.split("?")[0] ?? "")),
    );
    expect(bewacht.length).toBeGreaterThan(3);
  });
});

// ── AUFTRAG-mega72 A: zwei synthetische Negativ-Kalibrierungen ──────────────────────────────────
// Derselbe Leser, derselbe Rohzähler, dieselbe Zusage — nur über Quelltext, der GENAU die beiden
// Lücken trägt, durch die der alte Sammler still grün blieb. Beide MÜSSEN rot sein; ein grüner
// Ausgang hier hieße, dass der Sammler wieder breiter zusagt, als er erhebt.
// Der Platzhalter wird zusammengesetzt, damit im Testquelltext keine `${…}`-Zeichenfolge in einem
// gewöhnlichen String steht.
const platzhalter = (name: string): string => `\${${name}}`;

describe("mega72 A · Negativ-Kalibrierung: was der Sammler nicht fassen kann, wird sichtbar rot", () => {
  it("verschachtelte Klammern: der Rohzähler sieht das Attribut, der Leser nicht → rot mit Datei:Zeile", () => {
    const quelle = [
      "export function Synthetisch() {",
      "  return (",
      '    <Link to={ziel({ rolle: "experte" })}>Weiter</Link>',
      "  );",
      "}",
    ].join("\n");
    const erhebung = erhebeQuelle("Library", "synthetisch/verschachtelt.tsx", quelle);
    expect(erhebung.roh).toBe(1);
    expect(erhebung.vorkommen).toHaveLength(0);
    expect(erhebung.unlesbar).toEqual([
      'synthetisch/verschachtelt.tsx:3  to={ziel({ rolle: "experte" })}>Weiter</Link>',
    ]);
  });

  it("zwei unterschiedlich geschützte Template-Ziele: das bewachte zweite fällt nicht hinter das erste", () => {
    const id = platzhalter("k.id");
    const quelle = [
      "export function Synthetisch() {",
      "  return (",
      `    <Link to={offen ? \`/wissen/${id}\` : \`/validierung?ko=${id}\`}>Öffnen</Link>`,
      "  );",
      "}",
    ].join("\n");
    const erhebung = erhebeQuelle("Library", "synthetisch/zwei-templates.tsx", quelle);
    expect(erhebung.unlesbar).toEqual([]);
    expect(erhebung.vorkommen).toHaveLength(1);
    expect(erhebung.vorkommen[0]?.ziele).toEqual(["/wissen/x", "/validierung?ko=x"]);
    // Die Zusage für die Rollen, die die Bibliothek sehen: /validierung ist erst ab controller.
    expect(verstoesseVon(erhebung.vorkommen, rollenDerFlaeche("Library"))).toEqual([
      "synthetisch/zwei-templates.tsx:3  <Link to=…> → /validierung?ko=x (viewer)",
      "synthetisch/zwei-templates.tsx:3  <Link to=…> → /validierung?ko=x (experte)",
    ]);
  });

  // Nacharbeit 1 (bens Befund, Zeile 351): `to = {ziel}` ist gültiges JSX. Der alte Leser UND der
  // alte Rohzähler verlangten unmittelbar `to=` — beide übersahen das Attribut, und die
  // Kalibrierung blieb grün. Jetzt: die lesbare Schreibweise wird gelesen und geprüft, die
  // unlesbare steht rot mit Datei:Zeile.
  it("Leerraum um das `=`: gelesen und geprüft — oder, wenn unlesbar, rot mit Datei:Zeile", () => {
    const quelle = [
      "export function Synthetisch() {",
      "  return (",
      "    <>",
      '      <Link to = "/validierung">Prüfen</Link>',
      "      <Link",
      "        to =",
      '          {ziel({ rolle: "experte" })}',
      "      >",
      "        Weiter",
      "      </Link>",
      "    </>",
      "  );",
      "}",
    ].join("\n");
    const erhebung = erhebeQuelle("Library", "synthetisch/leerraum.tsx", quelle);
    expect(erhebung.roh).toBe(2);
    expect(erhebung.vorkommen).toHaveLength(1);
    expect(erhebung.unlesbar).toEqual(["synthetisch/leerraum.tsx:6  to ="]);
    expect(verstoesseVon(erhebung.vorkommen, rollenDerFlaeche("Library"))).toEqual([
      "synthetisch/leerraum.tsx:4  <Link to=…> → /validierung (viewer)",
      "synthetisch/leerraum.tsx:4  <Link to=…> → /validierung (experte)",
    ]);
  });

  // Nacharbeit 1 (bens Befund, Zeile 335): ein Template-Zweig darf einen unbekannten Nachbarzweig
  // nicht mit durchziehen. Der GANZE Ausdruck ist unbekannt — mit Datei und Zeile.
  it("Ternär aus Template und unbekanntem Zweig: der ganze Ausdruck ist unbekannt", () => {
    const quelle = [
      "export function Synthetisch() {",
      `  return <Link to={offen ? \`/wissen/${platzhalter("k.id")}\` : unbekanntesZiel}>Öffnen</Link>;`,
      "}",
    ].join("\n");
    const erhebung = erhebeQuelle("Library", "synthetisch/gemischt.tsx", quelle);
    expect(erhebung.unlesbar).toEqual([]);
    expect(erhebung.vorkommen).toHaveLength(1);
    const v = erhebung.vorkommen[0];
    expect(v?.ziele).toEqual([]);
    expect(v?.unbekannt).toBe(`offen ? \`/wissen/${platzhalter("k.id")}\` : unbekanntesZiel`);
    expect(`${v?.quelle}:${v?.zeile}`).toBe("synthetisch/gemischt.tsx:2");
  });
});
