// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG-mega38 BLOCK B — DER ZIEHWEG OHNE DataTransfer.
// ================================================================================================
//
// Bis mega37 stand am Ende von `handleAnswerDragStart`:
//
//     var daten = ev.dataTransfer || null;
//     if (!daten || typeof daten.setData !== "function") { return; }
//
// Ein blankes `return` — ohne `preventDefault`, ohne Hinweis. Der Host darf seinen eigenen
// Standard-Ziehvorgang danach fortsetzen, und der traegt fuer eine Textauswahl den ROHEN
// Antwortkoerper hinaus: ohne Einstufung, ohne Quellen-Zeile, ohne Kappungshinweis. Genau das,
// was der Kopier- und Ausschneideweg seit mega36 verhindert — dort wird abgebrochen und der
// abgeleitete Volltext im Rueckfallfeld angeboten.
//
// Der DOM-Typ ist nullable (`lib.dom.d.ts:10512-10518`); fuer synthetische Ereignisse ist der
// Zweig sicher erreichbar, fuer einen echten Word- oder WKWebView-Host ist er UNBELEGT — deshalb
// steht hier keine Behauptung ueber den Host, sondern ein Pin auf das Verhalten des Zweigs.
// Bis mega37 hat ihn KEIN Test beruehrt: alle Ziehtests haengen einen setData-faehigen Behaelter
// ans Ereignis und laufen deshalb immer an ihm vorbei.
//
// B3 (bens GELB): der Wartetext war nur im Schlusssatz ausgangsneutral. Sein FUEHRENDER Satz sagte
// „NOCH NICHT kopiert" / „NOT copied yet" / „NOG NIET gekopieerd" — auch beim blockierten Ziehen,
// wo nichts kopiert werden sollte. Der Test unten prueft den ganzen Text, in allen drei Sprachen.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const TASKPANE = "apps/web/public/word-addin/taskpane.html";

const ANTWORT = "Ventil V4 wird jaehrlich geprueft und vor der Wartung entlastet.";

interface Laufzeit {
  quellenAufloesen: () => void;
}

function taskpaneStarten(): Laufzeit {
  const html = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");
  const bodyStart = html.indexOf("<body>") + "<body>".length;
  const bodyEnd = html.indexOf("</body>");
  const body = html.slice(bodyStart, bodyEnd);
  const skriptStart = body.indexOf("<script>") + "<script>".length;
  const skriptEnd = body.lastIndexOf("</script>");
  const skript = body.slice(skriptStart, skriptEnd);
  document.body.innerHTML = body.slice(0, body.indexOf("<script>"));

  let quellenAufloesen: () => void = () => undefined;
  const quellenTor = new Promise<void>((res) => {
    quellenAufloesen = res;
  });

  const w = window as unknown as Record<string, unknown>;
  w.fetch = (url: string): Promise<unknown> => {
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
            trust: 90,
            sources: ["k1"],
            steps: [],
            demo: false,
            evidence: { grade: "unverified" },
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

  w.Office = {
    onReady: (cb: () => void) => cb(),
    CoercionType: { Text: "text" },
    AsyncResultStatus: { Succeeded: "succeeded" },
    context: {
      document: {
        getSelectedDataAsync: (_c: unknown, cb: (r: unknown) => void) =>
          cb({ status: "succeeded", value: "" }),
        setSelectedDataAsync: (_text: string, _o: unknown, cb: (r: unknown) => void) =>
          cb({ status: "succeeded" }),
      },
    },
  };

  Object.defineProperty(window.navigator, "clipboard", {
    configurable: true,
    value: { writeText: async () => undefined },
  });

  new Function(skript)();
  return { quellenAufloesen };
}

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

// Vollstaendiger Vorlauf: fragen, antworten lassen, Quellen aufloesen — das Quellen-Tor ist damit
// offen, der Ziehweg scheitert also NUR noch am fehlenden Behaelter.
async function bisZurAufgeloestenAntwort(): Promise<void> {
  const lauf = taskpaneStarten();
  await ruhe();
  el<HTMLTextAreaElement>("ask-input").value = "Wie oft wird Ventil V4 geprueft?";
  el("ask-btn").click();
  await ruhe();
  lauf.quellenAufloesen();
  await ruhe();
}

// Ein `dragstart` OHNE brauchbaren Datenbehaelter. `daten === undefined` bedeutet: das Ereignis
// traegt gar kein `dataTransfer` (jsdom-Standard, entspricht dem nullable DOM-Typ).
function ziehenFeuern(ziel: HTMLElement, daten?: unknown): Event {
  const ev = new Event("dragstart", { bubbles: true, cancelable: true });
  if (daten !== undefined) {
    Object.defineProperty(ev, "dataTransfer", { value: daten });
  }
  ziel.dispatchEvent(ev);
  return ev;
}

// Der Wartetext aus dem Quelltext — je Sprachblock genau einmal.
function wartetexte(): string[] {
  const html = readFileSync(resolve(process.cwd(), TASKPANE), "utf8");
  const treffer = html.match(/askCopyNativePending:\s*"((?:[^"\\]|\\.)*)"/g) ?? [];
  return treffer.map((t) => t.replace(/^askCopyNativePending:\s*"/, "").replace(/"$/, ""));
}

describe("mega38 B1/B2 · der Ziehweg ohne DataTransfer laesst nichts roh hinaus", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("B1 · `dataTransfer` fehlt ganz: der Ziehvorgang wird ABGEBROCHEN, statt dem Host ueberlassen", async () => {
    await bisZurAufgeloestenAntwort();
    const feld = el<HTMLTextAreaElement>("ask-answer-edit");
    feld.setSelectionRange(0, feld.value.length);

    const ev = ziehenFeuern(feld);

    // Das ist der Kern: ohne `preventDefault` traegt der Standard-Ziehvorgang des Hosts den
    // rohen Koerper hinaus — ohne Einstufung, ohne Quellen-Zeile.
    expect(ev.defaultPrevented).toBe(true);
    // Und die Oberflaeche schweigt nicht: derselbe Vertrag wie am Kopier-/Ausschneideweg.
    expect(el("ask-status").textContent || "").not.toBe("");
  });

  it("B1 · Behaelter OHNE setData: derselbe Abbruch — und der abgeleitete Volltext steht im Rueckfall", async () => {
    await bisZurAufgeloestenAntwort();
    const feld = el<HTMLTextAreaElement>("ask-answer-edit");
    feld.setSelectionRange(0, feld.value.length);

    // Ein Behaelter, der zwar da ist, aber nichts entgegennimmt (aeltere/eingeschraenkte Hosts).
    const ev = ziehenFeuern(feld, { getData: () => "" });

    expect(ev.defaultPrevented).toBe(true);
    // Genau der Vertrag des Kopierwegs: es geht nichts roh hinaus, aber der Mensch bekommt den
    // vollstaendigen ABGELEITETEN Text angeboten — mit Einstufung und echten Quellentiteln.
    const rueckfall = el<HTMLTextAreaElement>("ask-copy-fallback-text");
    expect(rueckfall.value).toContain("Einstufung: ungeprueft");
    expect(rueckfall.value).toContain("Wartungsplan Ventil V4");
    expect(el("ask-status").textContent || "").not.toBe("");
  });

  it("Gegenprobe · mit brauchbarem Behaelter zieht der Weg weiterhin den ABGELEITETEN Text", async () => {
    await bisZurAufgeloestenAntwort();
    const feld = el<HTMLTextAreaElement>("ask-answer-edit");
    feld.setSelectionRange(0, feld.value.length);

    const store: Record<string, string> = { "text/plain": feld.value };
    const ev = ziehenFeuern(feld, {
      setData: (typ: string, wert: string) => {
        store[typ] = wert;
      },
      getData: (typ: string) => store[typ] ?? "",
    });

    // Ohne diese Gegenprobe waeren die beiden Zusagen oben auch von einem Handler erfuellt, der
    // JEDEN Ziehvorgang abbricht — die Pruefung muss in beide Richtungen kalibriert sein.
    expect(ev.defaultPrevented).toBe(false);
    expect(store["text/plain"]).toContain("Einstufung: ungeprueft");
    expect(store["text/plain"]).toContain("Wartungsplan Ventil V4");
  });
});

describe("mega38 B3 · der Wartetext ist AUSGANGSNEUTRAL — auch in seinem fuehrenden Satz", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("keine der drei Sprachfassungen behauptet einen Kopiervorgang", () => {
    const texte = wartetexte();
    // Drei Sprachbloecke, drei Fassungen — faellt eine weg, ist der Nachweis unvollstaendig.
    expect(texte).toHaveLength(3);
    for (const text of texte) {
      // Der Text erscheint an ALLEN drei nativen Wegen, auch beim blockierten ZIEHEN. Ein
      // „kopiert" ist dort schlicht falsch: es wurde nichts kopiert und sollte auch nichts.
      expect(text.toLowerCase()).not.toContain("kopiert");
      expect(text.toLowerCase()).not.toContain("copied");
      expect(text.toLowerCase()).not.toContain("gekopieerd");
    }
  });

  it("live: das blockierte Ziehen waehrend der Aufloesung zeigt den neutralen Wortlaut", async () => {
    // Bewusst OHNE `quellenAufloesen` — das Quellen-Tor ist zu, genau bens Fall.
    taskpaneStarten();
    await ruhe();
    el<HTMLTextAreaElement>("ask-input").value = "Wie oft wird Ventil V4 geprueft?";
    el("ask-btn").click();
    await ruhe();

    const feld = el<HTMLTextAreaElement>("ask-answer-edit");
    feld.setSelectionRange(0, feld.value.length);
    const store: Record<string, string> = { "text/plain": feld.value };
    ziehenFeuern(feld, {
      setData: (typ: string, wert: string) => {
        store[typ] = wert;
      },
      getData: (typ: string) => store[typ] ?? "",
    });

    const status = el("ask-status").textContent || "";
    expect(status).not.toBe("");
    expect(status.toLowerCase()).not.toContain("kopiert");
    expect(status).toContain("ausgegeben");
  });
});
