// @vitest-environment jsdom
// ================================================================================================
// JOB 3092 · S6 (W5) — DIE BELEGTE ANTWORT: KLARA ZEIGT, WORAUF SIE STEHT, UND SAGT, WAS UNGEPRUEFT IST.
// ================================================================================================
//
// Das VOLLSTAENDIGE Aufgabenfenster (apps/web/public/word-addin/taskpane.html, ueber k1-panel-lauf)
// laeuft in jsdom; gemessen wird nur, was im DOM steht. Vier Zusagen des Auftrags (§5/§6):
//   1. HERKUNFT AN DER ANTWORT: je tragender Quelle (`citedSources`, nicht `sources`) EINE Zeile
//      „Quelle: <Titel> · <Pruefstand> · <Version>" in der Antwortkarte, der Titel ein Link auf
//      den Volltext (/wissen/:id, derselbe Weg wie die Chips).
//   2. UNGEPRUEFT-SATZ: liefert der Server `ungeprueft` nicht leer, steht der Satz mit Titel(n)
//      da — in der Antwort UND in der Luecke. Leer oder abwesend → kein Satz, und NIE ein
//      „alles geprueft".
//   3. LUECKE EHRLICH: eine Antwort ohne `citedSources` traegt „Dafuer habe ich keinen Beleg."
//   4. LEHRE JOB 3091 R3: ein GESCHEITERTER Quellenabruf ist keine festgestellte Quellenlosigkeit —
//      die Zeile sagt dann „konnte nicht geladen werden" und behauptet weder Pruefstand noch Version.
// RED-FIRST: vor dem Umbau existiert weder `#ask-herkunft` noch `#ask-ungeprueft`.
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
  sichtbar,
  sichtbarerText,
} from "../app/k1-panel-lauf";

const QUELLEN: Record<string, { title: string; status: string; version: number }> = {
  ka: { title: "Design Guide", status: "validiert", version: 3 },
  kb: { title: "HD Handbook", status: "offen", version: 1 },
  kc: { title: "Randnotiz", status: "validiert", version: 7 },
};

interface Stand {
  /** Der Antwortkoerper von POST /api/ask (result + optional ungeprueft). */
  ask: Record<string, unknown>;
  /** Je Quelle die Antwort von GET /api/kos/:id; fehlt sie, wird das Objekt regulaer geliefert. */
  kos?: Record<string, Antwort>;
}

function starten(stand: Stand): Lauf {
  return panelStarten((url, methode): Antwort => {
    if (url === "/api/auth/me") return { status: 200, body: { name: "Pedi" } };
    if (url === "/api/reasoner/status") {
      return { status: 200, body: { enabled: false, reachable: "none" } };
    }
    if (url === "/api/klara/sessions" && methode === "POST") return { status: 200, body: sicht() };
    if (url === "/api/klara/ai-status") return { status: 200, body: aufloesung() };
    if (url.endsWith("/close")) return { status: 200, body: {} };
    if (url === "/api/ask") return { status: 200, body: stand.ask };
    if (url.startsWith("/api/kos/")) {
      const id = decodeURIComponent(url.slice("/api/kos/".length));
      const eigen = stand.kos?.[id];
      if (eigen !== undefined) return eigen;
      const q = QUELLEN[id];
      return q
        ? {
            status: 200,
            body: { id, title: q.title, status: q.status, version: q.version, trust: 80 },
          }
        : { status: 404 };
    }
    if (methode === "HEAD") return { status: 200 };
    return { status: 404 };
  });
}

async function fragen(): Promise<void> {
  el<HTMLTextAreaElement>("ask-input").value = "Welche Profile sind in Spritzzonen erlaubt?";
  el("ask-btn").click();
  await ruhe();
}

function antwort(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    answered: true,
    answer: "Offene Profile sind zu bevorzugen.",
    sources: ["ka", "kb", "kc"],
    citedSources: ["ka", "kb"],
    trust: 80,
    steps: [],
    evidence: { grade: "verified" },
    ...over,
  };
}

function herkunftZeilen(): Array<{ text: string; quelle: string | null; href: string | null }> {
  return [...document.querySelectorAll("#ask-herkunft .herkunft-zeile")].map((z) => ({
    text: (z.textContent ?? "").replace(/\s+/g, " ").trim(),
    quelle: z.getAttribute("data-quelle"),
    href: z.querySelector("a")?.getAttribute("href") ?? null,
  }));
}

describe("JOB 3092 · S6 — Herkunft und Ungeprueft-Satz an der Antwort (gemountet)", () => {
  afterEach(() => {
    panelAbraeumen();
  });

  it("H1 · zwei tragende Quellen von drei: GENAU zwei Herkunftszeilen mit Titel, Pruefstand und Version — in der Karte, unter dem Antworttext", async () => {
    starten({ ask: { result: antwort(), gap: null, receipt: "r" } });
    await ruhe();
    await fragen();
    const block = el("ask-herkunft");
    expect(sichtbar(block)).toBe(true);
    // In der Antwortkarte (Gesamtkomposition W2 der Chromium-Messung: Karte → Aktionen bleibt).
    expect(block.closest("#antwortkarte")).not.toBeNull();
    // Unter dem Antworttext: das Textfeld steht vor dem Block.
    const feld = el("ask-answer-text");
    expect(feld.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(herkunftZeilen()).toEqual([
      {
        text: "Quelle: Design Guide · Validiert · Version 3",
        quelle: "ka",
        href: `${window.location.origin}/wissen/ka`,
      },
      {
        text: "Quelle: HD Handbook · Offen · Version 1",
        quelle: "kb",
        href: `${window.location.origin}/wissen/kb`,
      },
    ]);
    // Die nur herangezogene dritte Quelle bekommt KEINE Herkunftszeile (citedSources, nicht sources).
    expect(sichtbarerText(block)).not.toContain("Randnotiz");
    // Der Ungeprueft-Satz steht NICHT da, wenn der Server nichts meldet — und es gibt kein
    // „alles geprueft".
    expect(sichtbar(el("ask-ungeprueft"))).toBe(false);
    expect(sichtbarerText(el("antwortkarte"))).not.toMatch(/alles gepr/i);
  });

  it("H2 · Antwort OHNE citedSources: statt der Herkunft steht „Dafuer habe ich keinen Beleg.“ — nie eine Antwort ohne diese Zeile", async () => {
    starten({ ask: { result: antwort({ citedSources: undefined }), gap: null, receipt: "r" } });
    await ruhe();
    await fragen();
    const block = el("ask-herkunft");
    expect(sichtbar(block)).toBe(true);
    expect(herkunftZeilen()).toEqual([]);
    expect(sichtbarerText(block)).toBe("Dafür habe ich keinen Beleg.");
  });

  it("H3 · ungeprueft = [1 Eintrag]: der Satz mit dem Titel steht unter der Herkunft", async () => {
    starten({
      ask: {
        result: antwort(),
        gap: null,
        receipt: "r",
        ungeprueft: [{ id: "u1", title: "Spritzzonen Sonderfall", status: "offen" }],
      },
    });
    await ruhe();
    await fragen();
    const satz = el("ask-ungeprueft");
    expect(sichtbar(satz)).toBe(true);
    expect(satz.closest("#antwortkarte")).not.toBeNull();
    expect(satz.textContent).toBe(
      "Dazu gibt es einen Eintrag, der noch nicht geprüft ist: Spritzzonen Sonderfall",
    );
    // Reihenfolge: Herkunft VOR dem Ungeprueft-Satz.
    expect(
      el("ask-herkunft").compareDocumentPosition(satz) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("H4 · ungeprueft = [] und ungeprueft abwesend: KEIN Satz, kein „alles geprueft“", async () => {
    starten({ ask: { result: antwort(), gap: null, receipt: "r", ungeprueft: [] } });
    await ruhe();
    await fragen();
    expect(sichtbar(el("ask-ungeprueft"))).toBe(false);
    expect(el("ask-ungeprueft").textContent).toBe("");
    expect(sichtbar(el("ask-gap-ungeprueft"))).toBe(false);
    // Die Herkunft selbst sagt nichts ueber „geprueft" — kein Versprechen ueber den Bestand.
    expect(sichtbarerText(el("ask-herkunft"))).not.toMatch(/gepr/i);
    panelAbraeumen();
    starten({ ask: { result: antwort(), gap: null, receipt: "r" } });
    await ruhe();
    await fragen();
    expect(sichtbar(el("ask-ungeprueft"))).toBe(false);
    expect(el("ask-ungeprueft").textContent).toBe("");
  });

  it("H5 · LUECKE mit zwei ungeprueften Eintraegen: Klara sagt es statt zu schweigen — als Satz im Lueckenblock", async () => {
    starten({
      ask: {
        result: { answered: false, answer: null, sources: [] },
        gap: { id: "g1" },
        receipt: "r",
        ungeprueft: [
          { id: "u1", title: "Spritzzonen Sonderfall", status: "offen" },
          { id: "u2", title: "Profilwahl Entwurf", status: "offen" },
        ],
      },
    });
    await ruhe();
    await fragen();
    expect(sichtbar(el("ask-gap-block"))).toBe(true);
    const satz = el("ask-gap-ungeprueft");
    expect(sichtbar(satz)).toBe(true);
    expect(satz.closest("#ask-gap-block")).not.toBeNull();
    // NICHT in #ask-luecke: dessen Kinder sind in Chromium exakt gepinnt (zielbild-keinwissen).
    expect(satz.closest("#ask-luecke")).toBeNull();
    expect(satz.textContent).toBe(
      "Dazu gibt es 2 Einträge, die noch nicht geprüft sind: Spritzzonen Sonderfall, Profilwahl Entwurf",
    );
    // Die Luecke ohne Meldung bleibt still.
    panelAbraeumen();
    starten({
      ask: {
        result: { answered: false, answer: null, sources: [] },
        gap: { id: "g1" },
        receipt: "r",
      },
    });
    await ruhe();
    await fragen();
    expect(sichtbar(el("ask-gap-ungeprueft"))).toBe(false);
  });

  it("H6 · LEHRE 3091: ein Quellenabruf mit 503 bzw. Netzfehler ergibt „konnte nicht geladen werden“ — kein Pruefstand, keine Version, kein „keinen Beleg“", async () => {
    starten({
      ask: { result: antwort(), gap: null, receipt: "r" },
      kos: { ka: { status: 503 }, kb: "netz" },
    });
    await ruhe();
    await fragen();
    const zeilen = herkunftZeilen();
    expect(zeilen.map((z) => z.text)).toEqual([
      "Quelle: ka · konnte nicht geladen werden",
      "Quelle: kb · konnte nicht geladen werden",
    ]);
    expect(sichtbarerText(el("ask-herkunft"))).not.toMatch(/Version|Validiert|Offen|keinen Beleg/);
  });

  it("H7 · waehrend die Quellen laden, steht „Quellen werden geladen …“ — danach die Zeilen; die Ladezeile bleibt nie stehen", async () => {
    const lauf = starten({
      ask: { result: antwort({ citedSources: ["ka"], sources: ["ka"] }), gap: null, receipt: "r" },
      kos: { ka: "haengt" },
    });
    await ruhe();
    await fragen();
    expect(sichtbar(el("ask-herkunft"))).toBe(true);
    expect(sichtbarerText(el("ask-herkunft"))).toBe("Quellen werden geladen …");
    expect(herkunftZeilen()).toEqual([]);
    lauf.freigeben(0, {
      status: 200,
      body: { id: "ka", title: "Design Guide", status: "validiert", version: 3 },
    });
    await ruhe();
    expect(herkunftZeilen().map((z) => z.text)).toEqual([
      "Quelle: Design Guide · Validiert · Version 3",
    ]);
    expect(sichtbarerText(el("ask-herkunft"))).not.toContain("geladen …");
  });

  it("H8 · DE/EN gleichwertig: der Sprachwechsel zieht Herkunft und Ungeprueft-Satz nach", async () => {
    starten({
      ask: {
        result: antwort({ citedSources: ["kb"], sources: ["kb"] }),
        gap: null,
        receipt: "r",
        ungeprueft: [{ id: "u1", title: "Spritzzonen Sonderfall", status: "offen" }],
      },
    });
    await ruhe();
    await fragen();
    el("lang-en").click();
    await ruhe();
    expect(herkunftZeilen().map((z) => z.text)).toEqual(["Source: HD Handbook · Open · Version 1"]);
    expect(el("ask-ungeprueft").textContent).toBe(
      "There is one entry on this that has not been reviewed yet: Spritzzonen Sonderfall",
    );
    el("lang-de").click();
    await ruhe();
    expect(herkunftZeilen().map((z) => z.text)).toEqual([
      "Quelle: HD Handbook · Offen · Version 1",
    ]);
  });

  it("H9 · die naechste Frage raeumt Herkunft und Ungeprueft-Satz der vorigen ab — nichts bleibt stehen", async () => {
    const stand: Stand = {
      ask: {
        result: antwort(),
        gap: null,
        receipt: "r",
        ungeprueft: [{ id: "u1", title: "Spritzzonen Sonderfall", status: "offen" }],
      },
    };
    starten(stand);
    await ruhe();
    await fragen();
    expect(herkunftZeilen()).toHaveLength(2);
    expect(sichtbar(el("ask-ungeprueft"))).toBe(true);
    // Zweite Frage: Luecke ohne Meldung.
    stand.ask = {
      result: { answered: false, answer: null, sources: [] },
      gap: { id: "g2" },
      receipt: "r",
    };
    el("kw-zurueck").click();
    await ruhe();
    await fragen();
    expect(sichtbar(el("ask-herkunft"))).toBe(false);
    expect(herkunftZeilen()).toEqual([]);
    expect(el("ask-ungeprueft").textContent).toBe("");
    expect(sichtbar(el("ask-gap-ungeprueft"))).toBe(false);
  });
});

// ================================================================================================
// AUFNAHME 20260922 · ANTWORT-QUELLENANZEIGE (R-0309, R-0325) — STAND AN DER ZEILE, TRAGENDE QUELLEN
// IM DOKUMENT.
// ================================================================================================
//
// R-0309: die Quellenzeile nennt Titel, Pruefstand und das DATUM DES LETZTEN STANDES, und diese
// Zeile wandert mit in das Word-Dokument. R-0325: unter der Antwort stehen nur die Quellen, die
// wirklich beigetragen haben. Gemessen wird die Herkunftszeile im DOM und der Text, der beim Klick
// auf „In Word einfuegen" tatsaechlich an `setSelectedDataAsync` geht.
describe("Aufnahme 20260922 · R-0309/R-0325 — Stand an der Herkunftszeile, tragende Quellen im Dokument (gemountet)", () => {
  afterEach(() => {
    panelAbraeumen();
  });

  /** Die Objekte mit belegtem Stand (letzte history-Zeile), Zeit mittags UTC gegen Zonenversatz. */
  const MIT_STAND: Record<string, Antwort> = {
    ka: {
      status: 200,
      body: {
        id: "ka",
        title: "Design Guide",
        status: "validiert",
        version: 3,
        trust: 80,
        createdAt: "2026-01-10T12:00:00Z",
        history: [{ at: "2026-02-01T12:00:00Z" }, { at: "2026-03-02T12:00:00Z" }],
      },
    },
    kb: {
      status: 200,
      body: {
        id: "kb",
        title: "HD Handbook",
        status: "offen",
        version: 1,
        createdAt: "2026-01-05T12:00:00Z",
      },
    },
    kc: {
      status: 200,
      body: {
        id: "kc",
        title: "Randnotiz",
        status: "validiert",
        version: 7,
        createdAt: "2026-04-20T12:00:00Z",
      },
    },
  };

  /** Faengt den Text ab, den „In Word einfuegen" an Office uebergibt (kein Word.run in jsdom). */
  function einfuegenMitschreiben(): string[] {
    const eingefuegt: string[] = [];
    const w = window as unknown as { Office: { context: { document: Record<string, unknown> } } };
    w.Office.context.document.setSelectedDataAsync = (
      text: string,
      _o: unknown,
      cb: (r: unknown) => void,
    ) => {
      eingefuegt.push(text);
      cb({ status: "succeeded" });
    };
    return eingefuegt;
  }

  it("Q1 · R-0309: mit belegtem Datum traegt jede Herkunftszeile „Stand <Datum>“ — das neueste der history, sonst createdAt", async () => {
    starten({ ask: { result: antwort(), gap: null, receipt: "r" }, kos: MIT_STAND });
    await ruhe();
    await fragen();
    expect(herkunftZeilen().map((z) => z.text)).toEqual([
      "Quelle: Design Guide · Validiert · Version 3 · Stand 02.03.2026",
      "Quelle: HD Handbook · Offen · Version 1 · Stand 05.01.2026",
    ]);
  });

  it("Q2 · R-0309/R-0325: der in Word eingefuegte Text nennt NUR die tragenden Quellen, je mit Pruefstand und Version, und deren neuesten Stand", async () => {
    starten({ ask: { result: antwort(), gap: null, receipt: "r" }, kos: MIT_STAND });
    await ruhe();
    await fragen();
    const eingefuegt = einfuegenMitschreiben();
    expect(el<HTMLButtonElement>("ask-insert-btn").disabled).toBe(false);
    el("ask-insert-btn").click();
    await ruhe();
    expect(eingefuegt).toHaveLength(1);
    const text = eingefuegt[0] ?? "";
    expect(text.startsWith("Offene Profile sind zu bevorzugen.\n\n")).toBe(true);
    expect(text).toContain(
      "Quelle: Design Guide (Validiert, Version 3), HD Handbook (Offen, Version 1) (KLARWERK-Wissen, Stand 02.03.2026)",
    );
    // Die nur herangezogene dritte Quelle reist nicht mit — weder ihr Titel noch ihr juengeres Datum.
    expect(text).not.toContain("Randnotiz");
    expect(text).not.toContain("20.04.2026");
  });

  it("Q3 · ohne `citedSources` (alter Server) nennt die Dokumentzeile wie bisher ALLE Quellen — nichts wird als tragend behauptet oder weggelassen", async () => {
    starten({
      ask: { result: antwort({ citedSources: undefined }), gap: null, receipt: "r" },
      kos: MIT_STAND,
    });
    await ruhe();
    await fragen();
    const eingefuegt = einfuegenMitschreiben();
    el("ask-insert-btn").click();
    await ruhe();
    expect(eingefuegt[0] ?? "").toContain(
      "Quelle: Design Guide (Validiert, Version 3), HD Handbook (Offen, Version 1), Randnotiz (Validiert, Version 7) (KLARWERK-Wissen, Stand 20.04.2026)",
    );
  });

  it("Q4 · eine nicht ladbare tragende Quelle behauptet im Dokument weder Pruefstand noch Version", async () => {
    starten({
      ask: { result: antwort({ citedSources: ["ka"], sources: ["ka"] }), gap: null, receipt: "r" },
      kos: { ka: { status: 503 } },
    });
    await ruhe();
    await fragen();
    const eingefuegt = einfuegenMitschreiben();
    el("ask-insert-btn").click();
    await ruhe();
    const text = eingefuegt[0] ?? "";
    expect(text).toContain("Quelle: ka (KLARWERK-Wissen, abgerufen am ");
    expect(text).not.toMatch(/Validiert|Version/);
  });
});
