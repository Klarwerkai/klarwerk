// @vitest-environment jsdom
// ================================================================================================
// JOB 3056 NACHZUG-RUNDE 1 (05.09.2026) — DER ABGESENDETE ASK-KOERPER: DIE MARKIERUNG REIST ALS
// EIGENES FELD, DIE GETIPPTE FRAGE BLEIBT DIE FRAGE (KA5, JOB 3019).
// ================================================================================================
//
// WARUM DIESE DATEI EXISTIERT. Die Konfliktrunde von JOB 3056 (Rebase auf die gelandete KA5-Kette)
// hat `ka5-markierung-reist-mit.test.tsx` (unter tests/klara-panel) GELOESCHT, weil die Datei fast
// ausschliesslich die Vier-Lagen-Herkunftszeile mass, die mit dem Ruhe-Umbau entfallen ist. Ihre
// Faelle A, C und D massen aber etwas anderes, das NICHT entfallen ist: den KOERPER von
// `POST /api/ask`, wie ihn das AUSGELIEFERTE Fenster (apps/web/public/word-addin/taskpane.html)
// wirklich absetzt — `question` ist die getippte Frage, `selection` die Markierung aus Word; ohne
// Eingabe ist die Markierung die Frage und `selection` FEHLT; ohne Markierung fehlt es ebenfalls.
// `tests/app/word-addin-ask.test.ts` Teil 3 pinnt dafuer nur `prepareAskQuestion` des Spiegels,
// nicht das, was `askKlara` → `performAsk` → `fetch` daraus macht. Der Testverweis-Waechter
// (`tests/structure/testverweise-aufloesbar.test.ts`) hat den toten Verweis auf die geloeschte
// Datei gemeldet; die Antwort ist nicht ein umgebogener Kommentar, sondern die Deckung selbst.
//
// GEMESSEN WIRD DER KOERPER, nicht der Quelltext (dieselbe Begruendung wie in der alten Datei):
// das vollstaendige Aufgabenfenster laeuft ueber die Vorrichtung `k1-panel-lauf` in jsdom, die
// Office-Attrappe liefert eine STELLBARE Textmarkierung, der Router schreibt jeden Koerper mit.
// Die Sitzung ist gueltig und die Aufloesung frisch — der Ask darf also abgehen; was er traegt,
// ist die Messgroesse.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  type Antwort,
  type Lauf,
  aufloesung,
  el,
  panelAbraeumen,
  panelStarten,
  ruhe,
  sicht,
} from "./k1-panel-lauf";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";
const HTML = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");

/** Die Fixtures der alten Datei — woertlich, damit rot/gruen an denselben Worten haengt. */
const MARKIERUNG = "Rückstellung Gewährleistung";
const FRAGE = "Wie lange läuft die Frist?";

/** Der Deckel — GELESEN aus dem Aufgabenfenster, nicht hier abgeschrieben. */
const ASK_MAX = (() => {
  const treffer = /var WORD_ADDIN_ASK_MAX_CHARS = (\d+);/.exec(HTML);
  if (treffer === null) {
    throw new Error(`${TASKPANE}: WORD_ADDIN_ASK_MAX_CHARS ist nicht auffindbar`);
  }
  return Number(treffer[1]);
})();

function bedienen(url: string, methode: string): Antwort {
  if (url === "/api/auth/me") return { status: 200, body: { name: "Pedi" } };
  if (url === "/api/reasoner/status") {
    return { status: 200, body: { enabled: false, reachable: "none" } };
  }
  if (methode === "HEAD") return { status: 200 };
  if (url === "/api/klara/sessions" && methode === "POST") return { status: 200, body: sicht() };
  if (url === "/api/klara/ai-status") return { status: 200, body: aufloesung() };
  if (url === "/api/ask") {
    return {
      status: 200,
      body: { result: { answered: false, answer: null, sources: [], trust: 0 } },
    };
  }
  if (url.endsWith("/close")) return { status: 200, body: {} };
  return { status: 404 };
}

interface OfficeAttrappe {
  CoercionType: { Text: string; Html: string };
  AsyncResultStatus: { Succeeded: string };
  context: {
    document: {
      getSelectedDataAsync: (
        typ: string,
        cb: (r: { status: string; value: string }) => void,
      ) => void;
    };
  };
}

/** Fenster laden, Markierung in Word und Eingabe stellen, senden, alles abwarten. */
async function fragen(lage: { markierung: string; eingabe: string }): Promise<Lauf> {
  const lauf = panelStarten(bedienen);
  await ruhe();
  // Die Attrappe der Vorrichtung antwortet immer mit "" — genau die Groesse, die hier variiert.
  const office = (window as unknown as { Office: OfficeAttrappe }).Office;
  office.context.document.getSelectedDataAsync = (typ, cb) => {
    cb({
      status: office.AsyncResultStatus.Succeeded,
      value: typ === office.CoercionType.Text ? lage.markierung : "",
    });
  };
  const feld = el<HTMLTextAreaElement>("ask-input");
  feld.value = lage.eingabe;
  feld.dispatchEvent(new Event("input", { bubbles: true }));
  await ruhe();
  el<HTMLButtonElement>("ask-btn").click();
  await ruhe();
  return lauf;
}

/** Der Koerper des EINEN `POST /api/ask` — oder ein Testfehler, wenn keiner oder mehrere abgingen. */
function askKoerper(lauf: Lauf): Record<string, unknown> {
  const asks = lauf.aufrufe.filter((a) => a.url === "/api/ask" && a.methode === "POST");
  expect(asks.length, "genau ein POST /api/ask erwartet").toBe(1);
  return asks[0]?.body as Record<string, unknown>;
}

describe("JOB 3056 Nachzug · KA5 am Koerper — Fall A: die getippte Frage gewinnt, die Markierung schaerft die Suche", () => {
  afterEach(() => {
    panelAbraeumen();
  });

  it("`body.question` ist die getippte Frage, `body.selection` die Markierung", async () => {
    const lauf = await fragen({ markierung: MARKIERUNG, eingabe: FRAGE });
    expect(askKoerper(lauf)).toEqual({
      question: FRAGE,
      locale: "de",
      mode: "retrieval-only",
      selection: MARKIERUNG,
    });
  });

  it("die Markierung wird GETRIMMT und auf den Deckel gekappt — die Frage bleibt die Frage", async () => {
    const lang = `${"A".repeat(ASK_MAX + 500)} `;
    const lauf = await fragen({ markierung: `   ${lang}`, eingabe: FRAGE });
    const koerper = askKoerper(lauf);
    expect(koerper.question).toBe(FRAGE);
    expect(String(koerper.selection)).toBe("A".repeat(ASK_MAX));
  });
});

describe("JOB 3056 Nachzug · KA5 am Koerper — Fall C: ohne getippten Text ist die Markierung die Frage", () => {
  afterEach(() => {
    panelAbraeumen();
  });

  it("`question` ist die Markierung, und ein `selection`-Feld gibt es NICHT", async () => {
    // Die Markierung IST hier schon die Frage. Sie ein zweites Mal als `selection` zu senden
    // verdoppelte dieselben Terme in der serverseitigen Suchschaerfung.
    const lauf = await fragen({ markierung: MARKIERUNG, eingabe: "" });
    const koerper = askKoerper(lauf);
    expect(koerper).toEqual({ question: MARKIERUNG, locale: "de", mode: "retrieval-only" });
    expect(Object.keys(koerper)).not.toContain("selection");
  });
});

describe("JOB 3056 Nachzug · KA5 am Koerper — Fall D: ohne Markierung bleibt der Koerper der heutige", () => {
  afterEach(() => {
    panelAbraeumen();
  });

  it("`question` ist die Eingabe, und ein `selection`-Feld gibt es NICHT", async () => {
    const lauf = await fragen({ markierung: "", eingabe: FRAGE });
    const koerper = askKoerper(lauf);
    expect(koerper).toEqual({ question: FRAGE, locale: "de", mode: "retrieval-only" });
    expect(Object.keys(koerper)).not.toContain("selection");
  });

  it("eine rein weisse Markierung ist keine Markierung", async () => {
    const lauf = await fragen({ markierung: "   \n\t ", eingabe: FRAGE });
    expect(askKoerper(lauf)).toEqual({ question: FRAGE, locale: "de", mode: "retrieval-only" });
  });

  it("ohne Markierung UND ohne Eingabe geht gar keine Frage hinaus", async () => {
    const lauf = await fragen({ markierung: "", eingabe: "" });
    expect(lauf.aufrufe.filter((a) => a.url === "/api/ask")).toEqual([]);
  });
});
