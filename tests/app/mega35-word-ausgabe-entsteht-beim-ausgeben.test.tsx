// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega35 BLOCK A — DER AUSGEGEBENE TEXT ENTSTEHT IM MOMENT DER AUSGABE.
// ================================================================================================
//
// bens ROT-Befund: Das Panel befuellte das editierbare Feld zuerst nur mit der Antwort und trug
// Quellen-Zeile und Einstufung erst NACH der asynchronen Quellenaufloesung nach — aber nur, solange
// der Feldinhalt noch exakt der Vorbefuellung entsprach. Wer kuerzte, waehrend die Quellen luden,
// bekam nichts nachgetragen; derselbe Rueckruf schaltete die Ausgabewege trotzdem frei, und das
// Gating prueft nur „Antwort belegt + Quellen aufgeloest", nicht „der Text traegt die Einstufung".
// Der von der Oberflaeche selbst angebotene Weg — kuerzen, dann einfuegen — konnte damit eine
// Antwort OHNE Einstufung und OHNE Quelle in ein echtes Word-Dokument schreiben.
//
// Dieser Test stellt GENAU diesen Ablauf nach, an der echten Taskpane-Laufzeit (das vollstaendige
// Inline-Skript wird geladen und ueber echte Klicks getrieben, nicht nachgebaut):
//   1. Frage stellen  →  2. /api/ask antwortet (Einstufung „ungeprueft")
//   3. Nutzerin KUERZT den Feldtext, WAEHREND /api/kos/... noch laeuft
//   4. Quellenaufloesung endet  →  5. Kopieren und Einfuegen
// Geprueft wird der TATSAECHLICH AUSGEGEBENE TEXT (Argument an clipboard.writeText bzw. an
// Office.context.document.setSelectedDataAsync), nicht der Zustand einer Variablen.
//
// WAS HIER NICHT GEPRUEFT WIRD (und warum):
//   - Der Systemzwischenablage-Puffer selbst. jsdom hat keine echte Zwischenablage; injiziert ist
//     `navigator.clipboard` mit echtem `writeText`-Vertrag. Der Weg des Panels bis zur Browser-API
//     ist damit vollstaendig geprueft, die Uebergabe der Browser-API an das Betriebssystem nicht.
//   - Der echte Word-Host. Geprueft ist der Weg bis in `setSelectedDataAsync` mit dem echten
//     Office-Aufrufvertrag (coercionType, Callback mit AsyncResultStatus); dass Word den Text dann
//     unveraendert in das Dokument schreibt, kann nur ein Lauf in Word selbst zeigen.
//   - Der `Word.run`-Zweig. Er wird hier bewusst nicht angeboten (`window.Word` fehlt), damit der
//     Fallback-Zweig laeuft; beide Zweige bekommen von `performInsert` denselben Text-Parameter,
//     und die Textbildung liegt VOR der Zweigwahl (composeOutputText).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";

const ANTWORT = "Ventil V4 wird jaehrlich geprueft und vor der Wartung entlastet.";
const GEKUERZT = "Ventil V4 wird jaehrlich geprueft.";

interface Laufzeit {
  eingefuegt: string[];
  kopiert: string[];
  quellenAufloesen: () => void;
}

// Laedt das ECHTE Taskpane: Markup in das jsdom-Dokument, danach das vollstaendige Inline-Skript
// ausfuehren. Ab hier laeuft die Seite so, wie sie in Word laeuft — getrieben wird ueber Klicks.
function taskpaneStarten(evidence: unknown): Laufzeit {
  const html = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");
  const bodyStart = html.indexOf("<body>") + "<body>".length;
  const bodyEnd = html.indexOf("</body>");
  const body = html.slice(bodyStart, bodyEnd);
  const skriptStart = body.indexOf("<script>") + "<script>".length;
  const skriptEnd = body.lastIndexOf("</script>");
  const skript = body.slice(skriptStart, skriptEnd);
  document.body.innerHTML = body.slice(0, body.indexOf("<script>"));

  const eingefuegt: string[] = [];
  const kopiert: string[] = [];
  let quellenAufloesen: () => void = () => undefined;

  // Die Quellenaufloesung haengt, bis der Test sie freigibt — genau das Zeitfenster, in dem die
  // Nutzerin kuerzt.
  const quellenTor = new Promise<void>((res) => {
    quellenAufloesen = res;
  });

  const w = window as unknown as Record<string, unknown>;
  w.fetch = (url: string, _init?: unknown): Promise<unknown> => {
    const ok = (payload: unknown): unknown => ({
      ok: true,
      status: 200,
      json: async () => payload,
    });
    if (url === "/api/auth/me") {
      return Promise.resolve(ok({ name: "Testerin" }));
    }
    if (url === "/api/ask") {
      return Promise.resolve(
        ok({
          result: {
            answered: true,
            answer: ANTWORT,
            knowledgeClass: "gesichert",
            trust: 90,
            sources: ["k1"],
            steps: [],
            demo: false,
            evidence,
          },
          gap: null,
          receipt: "r",
        }),
      );
    }
    if (url.startsWith("/api/kos/")) {
      return quellenTor.then(() =>
        ok({
          id: "k1",
          title: "Wartungsplan Ventil V4",
          status: "validiert",
          trust: 90,
          createdAt: "2026-07-01T00:00:00.000Z",
        }),
      );
    }
    return Promise.reject(new Error(`unerwartete URL ${url}`));
  };

  // Office ohne `Word.run` → der setSelectedDataAsync-Zweig laeuft; der eingefuegte Text wird
  // genau so mitgeschrieben, wie ihn der Host bekaeme.
  w.Office = {
    onReady: (cb: () => void) => cb(),
    CoercionType: { Text: "text" },
    AsyncResultStatus: { Succeeded: "succeeded" },
    context: {
      document: {
        getSelectedDataAsync: (_c: unknown, cb: (r: unknown) => void) =>
          cb({ status: "succeeded", value: "" }),
        setSelectedDataAsync: (text: string, _o: unknown, cb: (r: unknown) => void) => {
          eingefuegt.push(text);
          cb({ status: "succeeded" });
        },
      },
    },
  };

  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: async (text: string) => {
        kopiert.push(text);
      },
    },
  });

  new Function(skript)();
  return { eingefuegt, kopiert, quellenAufloesen };
}

// Auf die Zusage-Ketten der Laufzeit warten (mehrere Microtask-Runden: fetch → json → then).
async function ruhe(runden = 12): Promise<void> {
  for (let i = 0; i < runden; i++) {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  }
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) {
    throw new Error(`Element ${id} fehlt`);
  }
  return node as T;
}

describe("mega35 A · Kuerzen waehrend der Quellenaufloesung", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("der ECHTE Ablauf: kuerzen vor Abschluss der Aufloesung — Kopieren und Einfuegen tragen trotzdem Einstufung und Quelle", async () => {
    const lauf = taskpaneStarten({ grade: "unverified" });
    await ruhe();

    // 1. Frage stellen (ohne Word-Markierung → freie Frage aus dem Eingabefeld).
    el<HTMLTextAreaElement>("ask-input").value = "Wie oft wird Ventil V4 geprueft?";
    el("ask-btn").click();
    await ruhe();

    // 2. Die Antwort steht im Feld — und zwar NUR der Antwortkoerper.
    const feld = el<HTMLTextAreaElement>("ask-answer-edit");
    expect(feld.value).toBe(ANTWORT);

    // 3. Die Nutzerin kuerzt — WAEHREND die Quellenaufloesung noch laeuft. Das ist der Zustand, in
    //    dem die alte Fassung den Nachtrag verwarf und die Ausgabewege trotzdem oeffnete.
    feld.value = GEKUERZT;

    // 4. Erst JETZT endet die Quellenaufloesung.
    lauf.quellenAufloesen();
    await ruhe();

    // 5. Kopieren und Einfuegen — geprueft wird, was wirklich hinausgeht.
    el("ask-copy-btn").click();
    el("ask-insert-btn").click();
    await ruhe();

    expect(lauf.kopiert).toHaveLength(1);
    expect(lauf.eingefuegt).toHaveLength(1);
    for (const ausgabe of [lauf.kopiert[0] as string, lauf.eingefuegt[0] as string]) {
      // Der gekuerzte Koerper der Nutzerin bleibt ihrer.
      expect(ausgabe).toContain(GEKUERZT);
      expect(ausgabe).not.toContain("vor der Wartung entlastet");
      // Und die beiden Dinge, die ihr NIE gehoert haben, sind da.
      expect(ausgabe).toContain("Einstufung: ungeprueft");
      expect(ausgabe).toContain("Wartungsplan Ventil V4");
      expect(ausgabe).toContain("KLARWERK-Wissen");
    }
    // Kopieren und Einfuegen geben denselben Text aus — ein Bauer, zwei Wege.
    expect(lauf.kopiert[0]).toBe(lauf.eingefuegt[0]);
  });

  it("belegte Einstufung: dieselbe Bauweise traegt die belegte Fassung — nicht gar keine", async () => {
    const lauf = taskpaneStarten({ grade: "verified" });
    await ruhe();
    el<HTMLTextAreaElement>("ask-input").value = "Wie oft wird Ventil V4 geprueft?";
    el("ask-btn").click();
    await ruhe();
    el<HTMLTextAreaElement>("ask-answer-edit").value = GEKUERZT;
    lauf.quellenAufloesen();
    await ruhe();
    el("ask-copy-btn").click();
    await ruhe();

    expect(lauf.kopiert[0]).toContain("Einstufung: gesichert");
    expect(lauf.kopiert[0]).not.toContain("ungeprueft");
  });

  it("Kalibrierung: ohne die Kuerzung sieht die Ausgabe genauso aus — der Test misst nicht bloss den Normalfall", async () => {
    const lauf = taskpaneStarten({ grade: "unverified" });
    await ruhe();
    el<HTMLTextAreaElement>("ask-input").value = "Wie oft wird Ventil V4 geprueft?";
    el("ask-btn").click();
    await ruhe();
    lauf.quellenAufloesen(); // KEINE Bearbeitung dazwischen
    await ruhe();
    el("ask-copy-btn").click();
    await ruhe();

    expect(lauf.kopiert[0]).toContain(ANTWORT);
    expect(lauf.kopiert[0]).toContain("Einstufung: ungeprueft");
    expect(lauf.kopiert[0]).toContain("Wartungsplan Ventil V4");
  });

  it("auch eine Bearbeitung NACH der Aufloesung verliert nichts — der Text entsteht erst beim Klick", async () => {
    const lauf = taskpaneStarten({ grade: "unverified" });
    await ruhe();
    el<HTMLTextAreaElement>("ask-input").value = "Wie oft wird Ventil V4 geprueft?";
    el("ask-btn").click();
    await ruhe();
    lauf.quellenAufloesen();
    await ruhe();
    // Erst jetzt kuerzen — in der alten Fassung haette das die bereits nachgetragene Quellen-Zeile
    // und die Einstufung mit weggeloescht, ohne dass ein Ausgabeweg das bemerkt haette.
    el<HTMLTextAreaElement>("ask-answer-edit").value = GEKUERZT;
    el("ask-copy-btn").click();
    await ruhe();

    expect(lauf.kopiert[0]).toContain(GEKUERZT);
    expect(lauf.kopiert[0]).toContain("Einstufung: ungeprueft");
    expect(lauf.kopiert[0]).toContain("Wartungsplan Ventil V4");
    // Genau EINE Einstufungszeile — nichts doppelt sich durch die Bildung beim Ausgeben.
    expect(lauf.kopiert[0]?.split("Einstufung:").length).toBe(2);
  });

  it("leerer Koerper bleibt gesperrt: es geht NICHTS hinaus, auch keine blosse Quellen-Zeile", async () => {
    const lauf = taskpaneStarten({ grade: "unverified" });
    await ruhe();
    el<HTMLTextAreaElement>("ask-input").value = "Wie oft wird Ventil V4 geprueft?";
    el("ask-btn").click();
    await ruhe();
    lauf.quellenAufloesen();
    await ruhe();
    el<HTMLTextAreaElement>("ask-answer-edit").value = "   ";
    el("ask-copy-btn").click();
    el("ask-insert-btn").click();
    await ruhe();

    expect(lauf.kopiert).toHaveLength(0);
    expect(lauf.eingefuegt).toHaveLength(0);
  });
});
