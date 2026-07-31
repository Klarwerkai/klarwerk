import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// ================================================================================================
// AUFTRAG-mega81 BLOCK A + B — DIE KENNZEICHNUNG HAENGT AM VERHALTEN, NICHT AN IHRER ANWESENHEIT.
// ================================================================================================
//
// WAS HIER SCHIEFGING (bens ROT zu mega79): im Fragen-Bereich des Aufgabenfensters stand
// „Von kuenstlicher Intelligenz erzeugt" DAUERHAFT und ZUSTANDSUNABHAENGIG — unmittelbar UEBER der
// Zeile, die (seit mega79 richtig) sagt, Klaras Antwort entstehe IMMER ohne KI-Modell. Zwei
// unvereinbare Saetze uebereinander, fuer denselben sichtbaren Antwortweg.
//
// Beide bisherigen Waechter hielten das gruen, weil beide nur ANWESENHEIT bewiesen:
//   · tests/legal/mega61-ki-satz.test.ts — „der Schluessel steht dreimal im Woerterbuch"
//   · tests/app/mega69-klara-waechter.test.ts — „der Schluessel ist unter den Oberflaechentexten"
// Dasselbe Muster wie der Namenswaechter aus mega77, eine Ebene weiter.
//
// DIE UMSTELLUNG: die Regel lautet nicht mehr „die Kennzeichnung ist da", sondern
//
//     Die KI-Erzeugungsbehauptung steht GENAU DORT, wo der Server `aiGenerated` mitliefert.
//
// Sie wird nicht abgeschaltet — sie wird gebunden. Erhoben wird das durch AUSFUEHRUNG, mit zwei
// Zellen, deren Antwortkoerper BEIDE aus der echten Route POST /api/ask stammen (nicht hier
// erfunden):
//
//   Zelle 1 — der retrieval-only-Weg, den das Aufgabenfenster wirklich absetzt (der `mode` wird
//             aus dem ausgefuehrten Client GELESEN, wie in mega79): der Koerper traegt kein
//             `aiGenerated` → die Behauptung wird NICHT gezeigt.
//   Zelle 2 — derselbe Frageweg OHNE `mode` (der allgemeine Modellweg): der Koerper TRAEGT
//             `aiGenerated` → die Behauptung wird WEITERHIN gezeigt.
//
// Zelle 2 ist zugleich die Kalibrierung: ohne sie waere „zeigt nichts" nicht von „zeigt nie etwas"
// zu unterscheiden — genau die Blindheit, gegen die mega79 den Gegenlauf eingezogen hat.
//
// BENANNTE GRENZE: dieser Test bindet die Behauptung an das SERVERSEITIGE Signal. Ob dieses Signal
// selbst richtig gesetzt ist (`aiGeneratedMark` markiert auch den deterministischen Rueckfall des
// `answer`-Wegs als KI-erzeugt), ist eine Frage an services/reasoner und NICHT Gegenstand dieser
// Scheibe — sie ist im Bericht benannt.
import { describe, expect, it } from "vitest";
import {
  type AskFetchFn,
  type AskFetchInit,
  type AskOutcome,
  askAiNoticeVisible,
  performAsk,
} from "../../apps/web/src/lib/wordAddin";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
const HTML = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");

const SPRACHEN = ["de", "en", "nl"] as const;
type Sprache = (typeof SPRACHEN)[number];

// ================================================================================================
// DER SAMMLER — welche Woerterbuch-Texte behaupten eine KI-ERZEUGUNG?
// ================================================================================================
//
// Erhoben statt aufgezaehlt: ein Satz behauptet eine KI-Erzeugung, wenn er von einem Modell spricht
// UND ein Erzeugen aussagt UND es nicht im selben Satz verneint. Damit faellt `aiLage*` bewusst
// NICHT darunter (dort steht der Hausstand von KLARWERK und der Ausschluss fuer Klaras Antwort) —
// und `aiGeneratedNotice` faellt darunter, in allen drei Sprachen.
const MODELL_BEZUG =
  /\b(KI|AI)\b|künstliche[rn]?\s+Intelligenz|artificial\s+intelligence|kunstmatige\s+intelligentie/i;
const ERZEUGT_BEZUG = /\b(erzeugt|erstellt|generiert|generated|gegenereerd|geproduceerd)\b/i;
const VERNEINUNG =
  /\b(ohne|kein|keine|keinen|nicht|nie|niemals|without|no|not|never|zonder|geen|niet|nooit)\b/i;

function behauptetKiErzeugung(satz: string): boolean {
  return MODELL_BEZUG.test(satz) && ERZEUGT_BEZUG.test(satz) && !VERNEINUNG.test(satz);
}

function woerterbuch(sprache: Sprache): string {
  const start = HTML.indexOf(`      ${sprache}: {`);
  expect(start, `${TASKPANE}: Woerterbuch ${sprache} nicht gefunden`).toBeGreaterThan(0);
  const ende = HTML.indexOf("\n      },", start);
  expect(ende, `${TASKPANE}: Ende des Woerterbuchs ${sprache} nicht gefunden`).toBeGreaterThan(
    start,
  );
  return HTML.slice(start, ende);
}

function texte(sprache: Sprache): Array<{ key: string; text: string }> {
  const out: Array<{ key: string; text: string }> = [];
  const zeilen = /^\s*([A-Za-z0-9_]+):\s*"([^"]*)"/gm;
  let treffer = zeilen.exec(woerterbuch(sprache));
  while (treffer) {
    out.push({ key: treffer[1] ?? "", text: treffer[2] ?? "" });
    treffer = zeilen.exec(woerterbuch(sprache));
  }
  return out;
}

function text(sprache: Sprache, key: string): string {
  const wert = texte(sprache).find((e) => e.key === key)?.text;
  expect(wert, `${sprache}.${key} fehlt`).toBeTypeOf("string");
  expect((wert ?? "").trim().length, `${sprache}.${key} ist leer`).toBeGreaterThan(0);
  return wert ?? "";
}

/** Die Schluessel, deren Text eine KI-Erzeugung behauptet — BERECHNET, nicht aufgezaehlt. */
function behauptendeSchluessel(): Set<string> {
  const gefunden = new Set<string>();
  for (const sprache of SPRACHEN) {
    for (const { key, text: wert } of texte(sprache)) {
      if (behauptetKiErzeugung(wert)) {
        gefunden.add(key);
      }
    }
  }
  return gefunden;
}

/** Alle Elemente des Aufgabenfensters mit `data-t` — samt ihrer Klassenliste. */
function elemente(): Array<{ key: string; tag: string; klassen: string }> {
  const out: Array<{ key: string; tag: string; klassen: string }> = [];
  const muster = /<([a-z][a-z0-9]*)\b([^>]*\bdata-t="([A-Za-z0-9_]+)"[^>]*)>/g;
  let treffer = muster.exec(HTML);
  while (treffer) {
    const attribute = treffer[2] ?? "";
    out.push({
      key: treffer[3] ?? "",
      tag: treffer[1] ?? "",
      klassen: /\bclass="([^"]*)"/.exec(attribute)?.[1] ?? "",
    });
    treffer = muster.exec(HTML);
  }
  return out;
}

// ================================================================================================
// DIE ZWEI ZELLEN — die Antwortkoerper kommen aus der ECHTEN Route, nicht aus diesem Test.
// ================================================================================================

/** Der `mode`, den der WIRKLICH ausgelieferte Client absetzt — gelesen, nicht hingeschrieben. */
async function modusAusModul(): Promise<unknown> {
  let roh: string | undefined;
  const fetchFn: AskFetchFn = (_url, init: AskFetchInit) => {
    roh = init.body;
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ result: null }),
    });
  };
  await performAsk("Ventil Wartung Druck entlasten", "de", fetchFn, 1000);
  expect(roh, "Der Client hat gar keinen Rumpf abgesetzt").toBeTypeOf("string");
  return (JSON.parse(roh ?? "null") as { mode?: unknown }).mode;
}

const VALIDIERTE_AUSSAGE = "Ventil vor der Wartung entlasten und den Druck pruefen.";

/** Ein Werk mit genau einem validierten Objekt — Grundlage beider Zellen. */
async function ketteApp() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "p@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "p@x.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: "Ventil entlasten vor Wartung",
      statement: VALIDIERTE_AUSSAGE,
      type: "best_practice",
      category: "Wartung",
    },
  });
  const koId = (angelegt.json() as { id: string }).id;
  await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers,
    payload: { action: "admin-validate" },
  });
  await services.aiCheckWorker?.idle();
  return { app, headers, koId };
}

interface Zelle {
  /** Traegt der Antwortkoerper des Servers die Kennzeichnung? */
  serverKennzeichnet: boolean;
  /** Was der ausgefuehrte Client daraus macht. */
  outcome: AskOutcome;
  /** Was das Aufgabenfenster daraufhin zeigt. */
  zeigtBehauptung: boolean;
}

/** Einen echten Antwortkoerper durch den AUSGEFUEHRTEN Client schicken und die Anzeige ableiten. */
async function durchDenClient(koerper: unknown): Promise<Zelle> {
  const fetchFn: AskFetchFn = () =>
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(koerper) });
  const outcome = await performAsk("Ventil Wartung Druck entlasten", "de", fetchFn, 1000);
  const ausFenster = await anzeigeAusAufgabenfenster(outcome);
  const ausModul = askAiNoticeVisible(outcome);
  expect(
    ausFenster,
    "Aufgabenfenster und Modul entscheiden verschieden — dann ist unklar, was ausgeliefert wird",
  ).toBe(ausModul);
  const ergebnis = (koerper as { result?: { aiGenerated?: unknown } } | null)?.result;
  return {
    serverKennzeichnet: Boolean(ergebnis?.aiGenerated),
    outcome,
    zeigtBehauptung: ausModul,
  };
}

// Das WIRKLICH ausgelieferte Aufgabenfenster: kein Quelltext-Pin, sondern Schnitt + Ausfuehrung
// (dieselbe Bauform wie KW-KLARA-ASK-FETCH-* aus mega79).
const N_START = "// KW-KLARA-AI-NOTICE-START";
const N_END = "// KW-KLARA-AI-NOTICE-END";

async function anzeigeAusAufgabenfenster(outcome: AskOutcome): Promise<boolean> {
  const start = HTML.indexOf(N_START);
  const end = HTML.indexOf(N_END);
  expect(
    start,
    `${TASKPANE}: ${N_START} fehlt — die Anzeige-Entscheidung ist nicht auffindbar`,
  ).toBeGreaterThan(0);
  expect(end, `${TASKPANE}: ${N_END} fehlt`).toBeGreaterThan(start);
  const block = HTML.slice(start, end);
  const factory = new Function(`${block} return askAiNoticeVisible;`);
  return (factory() as (o: AskOutcome) => boolean)(outcome);
}

let gemerkt: { retrievalOnly: Zelle; modellweg: Zelle } | undefined;

async function beideZellen(): Promise<{ retrievalOnly: Zelle; modellweg: Zelle }> {
  if (gemerkt) {
    return gemerkt;
  }
  const modus = await modusAusModul();
  const { app, headers, koId } = await ketteApp();

  // ZELLE 1 — der Weg, den das Aufgabenfenster wirklich geht.
  const eins = await app.inject({
    method: "POST",
    url: "/api/ask",
    headers,
    payload: { question: "Ventil Wartung Druck entlasten", mode: modus },
  });
  expect(eins.statusCode, "Der vom Client abgesetzte Modus wird nicht angenommen").toBe(200);
  const koerperEins = eins.json() as { result: { sources?: string[] } };
  expect(
    koerperEins.result.sources ?? [],
    "Ohne beantwortete Frage waere die Messung wertlos",
  ).toContain(koId);

  // ZELLE 2 — derselbe Frageweg OHNE `mode`: der allgemeine Modellweg.
  const zwei = await app.inject({
    method: "POST",
    url: "/api/ask",
    headers,
    payload: { question: "Ventil Wartung Druck entlasten" },
  });
  expect(zwei.statusCode).toBe(200);

  gemerkt = {
    retrievalOnly: await durchDenClient(koerperEins),
    modellweg: await durchDenClient(zwei.json()),
  };
  return gemerkt;
}

// ================================================================================================
describe("AUFTRAG-mega81: die KI-Kennzeichnung haengt am serverseitigen Signal", () => {
  it("KALIBRIERUNG: der Sammler erkennt eine Erzeugungsbehauptung und schweigt beim Ausschluss", () => {
    expect(
      behauptetKiErzeugung("Von künstlicher Intelligenz erzeugt — bitte fachlich prüfen."),
    ).toBe(true);
    expect(behauptetKiErzeugung("Generated by artificial intelligence — please review.")).toBe(
      true,
    );
    expect(
      behauptetKiErzeugung("Door kunstmatige intelligentie gegenereerd — controleer dit."),
    ).toBe(true);
    // Der Ausschlusssatz aus mega79 ist KEINE Behauptung — sonst waere die Regel unten hohl.
    expect(
      behauptetKiErzeugung(
        "Klaras Antwort in diesem Fenster entsteht immer ohne KI-Modell — regelbasiert.",
      ),
    ).toBe(false);
    expect(behauptetKiErzeugung("Bitte vor Verwendung fachlich prüfen.")).toBe(false);
  });

  it("die Erhebung greift ueberhaupt: Woerterbuecher und Elemente sind gelesen", () => {
    for (const sprache of SPRACHEN) {
      expect(texte(sprache).length, `${sprache}: kein einziger Text gelesen`).toBeGreaterThan(50);
    }
    expect(elemente().length, "kein einziges data-t-Element gelesen").toBeGreaterThan(30);
    expect(
      behauptendeSchluessel().size,
      "kein Schluessel behauptet eine KI-Erzeugung — dann waere die Regel unten blind",
    ).toBeGreaterThan(0);
  });

  it("ZELLE 1: der retrieval-only-Bereich zeigt KEINE KI-Erzeugungsbehauptung", async () => {
    const { retrievalOnly } = await beideZellen();
    expect(
      retrievalOnly.serverKennzeichnet,
      "Der retrieval-only-Weg traegt serverseitig doch eine Kennzeichnung — dann ist nicht die " +
        "Anzeige falsch, sondern die Zusage, dass dieser Weg ohne Modell entsteht.",
    ).toBe(false);
    expect(retrievalOnly.outcome.kind, "Ohne belegte Antwort waere die Messung wertlos").toBe(
      "answered",
    );
    expect(
      retrievalOnly.zeigtBehauptung,
      "Das Aufgabenfenster behauptet eine KI-Erzeugung auf einem Weg, den der Server NICHT kennzeichnet",
    ).toBe(false);
  }, 30000);

  it("ZELLE 2: ein Weg mit serverseitigem `aiGenerated` zeigt sie WEITERHIN", async () => {
    const { modellweg } = await beideZellen();
    expect(
      modellweg.serverKennzeichnet,
      "Der allgemeine Antwortweg traegt keine Kennzeichnung — dann ist die Null in Zelle 1 blind",
    ).toBe(true);
    expect(modellweg.outcome.kind, "Ohne belegte Antwort waere die Messung wertlos").toBe(
      "answered",
    );
    expect(
      modellweg.zeigtBehauptung,
      "Die Kennzeichnung wurde nicht gebunden, sondern abgeschaltet — das ist NICHT der Auftrag",
    ).toBe(true);
  }, 30000);

  it("SAMMLER: jedes Element mit Erzeugungsbehauptung ist zustandsgebunden (nie dauerhaft sichtbar)", () => {
    const behauptend = behauptendeSchluessel();
    const verstoesse: string[] = [];
    for (const el of elemente()) {
      if (!behauptend.has(el.key)) {
        continue;
      }
      if (!/\bhidden\b/.test(el.klassen)) {
        verstoesse.push(
          `<${el.tag} data-t="${el.key}" class="${el.klassen}"> steht dauerhaft sichtbar, obwohl der Text eine KI-Erzeugung behauptet`,
        );
      }
    }
    expect(verstoesse.join("\n")).toBe("");
  });

  it("der fachliche Pruefhinweis BLEIBT — dauerhaft sichtbar, in allen drei Sprachen", () => {
    // Block A: die Kennzeichnung wird richtiggestellt, nicht ersatzlos abgeschaltet. Der Hinweis,
    // dass eine Antwort vor Verwendung fachlich zu pruefen ist, gilt auf diesem Weg unveraendert.
    const traeger = elemente().filter((el) => el.key === "askReviewNotice");
    expect(traeger.length, "der fachliche Pruefhinweis fehlt im Fragen-Bereich").toBe(1);
    expect(
      /\bhidden\b/.test(traeger[0]?.klassen ?? ""),
      "der fachliche Pruefhinweis ist nicht dauerhaft sichtbar",
    ).toBe(false);
    for (const sprache of SPRACHEN) {
      const wert = text(sprache, "askReviewNotice");
      expect(
        behauptetKiErzeugung(wert),
        `${sprache}: der Pruefhinweis behauptet eine KI-Erzeugung`,
      ).toBe(false);
      expect(/prüf|review|controleer/i.test(wert), `${sprache}: kein Pruefauftrag im Satz`).toBe(
        true,
      );
    }
  });
});
