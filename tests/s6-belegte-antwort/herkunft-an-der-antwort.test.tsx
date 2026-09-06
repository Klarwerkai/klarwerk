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
