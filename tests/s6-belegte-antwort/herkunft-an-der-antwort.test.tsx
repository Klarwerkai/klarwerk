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
        statement: "Offene Profile sind zu bevorzugen.",
        // Ein loser Anhang und das Original, auf das die Quelle zeigt — der Einschub waehlt dieses.
        attachments: [
          { objectId: "obj-lose", name: "Notiz.txt" },
          { objectId: "obj-original", name: "Design-Guide.docx" },
        ],
        sources: [{ kind: "file", objectId: "obj-original" }],
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

  /** Die Quellen-Zeile des eingefuegten Texts — „abgerufen am" ist das Datum des Laufs. */
  const QUELLENZEILE = /^Quelle: (.*) \(KLARWERK-Wissen, abgerufen am \d\d\.\d\d\.\d{4}\)$/m;

  async function einfuegen(): Promise<string> {
    const eingefuegt = einfuegenMitschreiben();
    expect(el<HTMLButtonElement>("ask-insert-btn").disabled).toBe(false);
    el("ask-insert-btn").click();
    await ruhe();
    expect(eingefuegt).toHaveLength(1);
    return eingefuegt[0] ?? "";
  }

  function chipQuellen(): Array<string | null> {
    return [...document.querySelectorAll("#ask-sources li.quelle-chip")].map((c) =>
      c.getAttribute("data-quelle"),
    );
  }

  it("Q2 · R-0309/R-0325: der in Word eingefuegte Text nennt NUR die tragenden Quellen — je mit Pruefstand, Version und IHREM Stand", async () => {
    starten({ ask: { result: antwort(), gap: null, receipt: "r" }, kos: MIT_STAND });
    await ruhe();
    await fragen();
    const text = await einfuegen();
    expect(text.startsWith("Offene Profile sind zu bevorzugen.\n\n")).toBe(true);
    // Jede Quelle traegt ihr eigenes Datum; keines wird durch das einer anderen ersetzt.
    expect(QUELLENZEILE.exec(text)?.[1]).toBe(
      "Design Guide (Validiert, Version 3, Stand 02.03.2026), HD Handbook (Offen, Version 1, Stand 05.01.2026)",
    );
    // Die nur herangezogene dritte Quelle reist nicht mit — weder ihr Titel noch ihr juengeres Datum.
    expect(text).not.toContain("Randnotiz");
    expect(text).not.toContain("20.04.2026");
  });

  it("Q3 · ohne `citedSources` (alter Server): KEINE Quelle wird als tragend ausgegeben — Panel und Dokument benennen die fehlende Zuordnung", async () => {
    starten({
      ask: { result: antwort({ citedSources: undefined }), gap: null, receipt: "r" },
      kos: MIT_STAND,
    });
    await ruhe();
    await fragen();
    expect(sichtbarerText(el("ask-herkunft"))).toBe("Dafür habe ich keinen Beleg.");
    expect(chipQuellen()).toEqual([]);
    const text = await einfuegen();
    expect(QUELLENZEILE.exec(text)?.[1]).toBe("keine tragende Quelle belegt");
    for (const titel of ["Design Guide", "HD Handbook", "Randnotiz"]) {
      expect(text).not.toContain(titel);
    }
  });

  it("Q3b · leere und widerspruechliche Zuordnung (`citedSources` nennt nur Fremdes) werden genauso behandelt — nie „alle Suchtreffer“", async () => {
    for (const citedSources of [[], ["ko-gibt-es-nicht"]]) {
      starten({
        ask: { result: antwort({ citedSources }), gap: null, receipt: "r" },
        kos: MIT_STAND,
      });
      await ruhe();
      await fragen();
      expect(sichtbarerText(el("ask-herkunft"))).toBe("Dafür habe ich keinen Beleg.");
      expect(herkunftZeilen()).toEqual([]);
      expect(chipQuellen()).toEqual([]);
      expect(document.querySelectorAll("#ask-fussnoten sup.fussnote")).toHaveLength(0);
      expect(QUELLENZEILE.exec(await einfuegen())?.[1]).toBe("keine tragende Quelle belegt");
      panelAbraeumen();
    }
  });

  it("Q3c · teilweise widerspruechlich: nur die Kennung, die unter `sources` steht, traegt — Chips, Ziffern und Dokument sind sich einig", async () => {
    starten({
      ask: {
        result: antwort({ citedSources: ["kb", "ko-gibt-es-nicht"] }),
        gap: null,
        receipt: "r",
      },
      kos: MIT_STAND,
    });
    await ruhe();
    await fragen();
    expect(chipQuellen()).toEqual(["kb"]);
    expect(
      [...document.querySelectorAll("#ask-fussnoten sup.fussnote")].map((s) => [
        s.textContent,
        s.getAttribute("data-quelle"),
      ]),
    ).toEqual([["1", "kb"]]);
    expect(herkunftZeilen().map((z) => z.quelle)).toEqual(["kb"]);
    expect(QUELLENZEILE.exec(await einfuegen())?.[1]).toBe(
      "HD Handbook (Offen, Version 1, Stand 05.01.2026)",
    );
  });

  it("Q4 · eine nicht ladbare tragende Quelle behauptet im Dokument weder Pruefstand noch Version", async () => {
    starten({
      ask: { result: antwort({ citedSources: ["ka"], sources: ["ka"] }), gap: null, receipt: "r" },
      kos: { ka: { status: 503 } },
    });
    await ruhe();
    await fragen();
    const text = await einfuegen();
    expect(QUELLENZEILE.exec(text)?.[1]).toBe("ka");
    expect(text).not.toMatch(/Validiert|Version/);
  });

  // ----------------------------------------------------------------------------------------------
  // R-0329 — DER EINSCHUB: Titel, Version/Stand, belegende Passage, GENAU zwei Aktionen.
  // ----------------------------------------------------------------------------------------------
  function einschub(): HTMLElement | null {
    return document.getElementById("ask-einschub");
  }

  function aktionen(): Array<{ tag: string; text: string; href: string | null; aus: boolean }> {
    return [...(einschub()?.querySelectorAll(".einschub-aktionen > *") ?? [])].map((a) => ({
      tag: a.tagName.toLowerCase(),
      text: (a.textContent ?? "").trim(),
      href: a.getAttribute("href"),
      aus: (a as HTMLButtonElement).disabled === true,
    }));
  }

  it("E1 · Klick auf den Quellenchip oeffnet den Einschub: Titel, Pruefstand · Version · Stand, hervorgehobene Passage, Original und Wissensnetz", async () => {
    starten({ ask: { result: antwort(), gap: null, receipt: "r" }, kos: MIT_STAND });
    await ruhe();
    await fragen();
    expect(einschub()).toBeNull();
    const link = document.querySelector<HTMLAnchorElement>(
      '#ask-sources li.quelle-chip[data-quelle="ka"] a',
    );
    expect(link).not.toBeNull();
    // Der Link bleibt ein Link (Mittelklick/neuer Tab); der einfache Klick oeffnet den Einschub.
    const klick = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    link?.dispatchEvent(klick);
    await ruhe();
    expect(klick.defaultPrevented).toBe(true);
    const box = einschub();
    expect(box).not.toBeNull();
    expect(box?.getAttribute("data-quelle")).toBe("ka");
    expect(box?.querySelector("h3")?.textContent).toBe("Design Guide");
    expect(box?.querySelector(".einschub-stand")?.textContent).toBe(
      "Validiert · Version 3 · Stand 02.03.2026",
    );
    expect(box?.querySelector(".einschub-passage mark")?.textContent).toBe(
      "Offene Profile sind zu bevorzugen.",
    );
    // GENAU zwei Aktionen; das Original ist die Datei, auf die die Quelle zeigt (nicht der lose Anhang).
    expect(aktionen()).toEqual([
      {
        tag: "a",
        text: "Im Original öffnen",
        href: `${window.location.origin}/api/objects/obj-original/raw`,
        aus: false,
      },
      {
        tag: "a",
        text: "Im Wissensnetz anzeigen",
        // R-0329 (Nacharbeit 5): direkt in die geöffnete Nachbarschaft — das Wissensnetz des
        // Eintrags —, nicht nur auf seine Lesefläche (`BibliothekLesen`, `?abschnitt=`).
        href: `${window.location.origin}/wissen/ka?abschnitt=nachbarschaft`,
        aus: false,
      },
    ]);
    // GENAU zwei Aktionen; dazu ist die Passage selbst das Zitat (R-0326, Nacharbeit 11): ein Klick
    // führt an ihre Stelle im Quelldokument — Textanker mit Passage und Fassung.
    const aktionsElemente = box?.querySelectorAll(
      ".einschub-aktionen a, .einschub-aktionen button",
    );
    expect(aktionsElemente).toHaveLength(2);
    const zitat = box?.querySelector<HTMLAnchorElement>(".einschub-passage a.einschub-zitat");
    expect(zitat?.querySelector("mark")?.textContent).toBe("Offene Profile sind zu bevorzugen.");
    const ziel = new URL(zitat?.getAttribute("href") ?? "", window.location.origin);
    expect(ziel.pathname).toBe("/wissen/ka");
    expect(ziel.searchParams.get("stelle")).toBe("Offene Profile sind zu bevorzugen.");
    expect(ziel.searchParams.get("fassung")).toBe("3");
    expect(zitat?.getAttribute("target")).toBe("_blank");
  });

  it("E4 · R-0326: der Quellenlink trägt die Belegstelle — Passage und Fassung als Textanker für die Web-Ansicht", async () => {
    starten({ ask: { result: antwort(), gap: null, receipt: "r" }, kos: MIT_STAND });
    await ruhe();
    await fragen();
    const href = (quelle: string): string | null => {
      const a = document.querySelector(`#ask-sources li.quelle-chip[data-quelle="${quelle}"] a`);
      return a ? a.getAttribute("href") : null;
    };
    const mitStelle = new URL(href("ka") ?? "", window.location.origin);
    expect(mitStelle.pathname).toBe("/wissen/ka");
    expect(mitStelle.searchParams.get("stelle")).toBe("Offene Profile sind zu bevorzugen.");
    expect(mitStelle.searchParams.get("fassung")).toBe("3");
    // Ohne Aussage am Objekt gibt es keinen Anker — die blosse Objektadresse, nichts Erfundenes.
    expect(href("kb")).toBe(`${window.location.origin}/wissen/kb`);
  });

  it("E2 · Klick auf die Quellenziffer oeffnet den Einschub derselben Quelle; ohne Original ist die Aktion gesperrt und benannt", async () => {
    starten({ ask: { result: antwort(), gap: null, receipt: "r" }, kos: MIT_STAND });
    await ruhe();
    await fragen();
    const ziffer = document.querySelector<HTMLElement>('#ask-fussnoten sup[data-quelle="kb"]');
    expect(ziffer?.textContent).toBe("2");
    ziffer?.click();
    await ruhe();
    expect(einschub()?.getAttribute("data-quelle")).toBe("kb");
    expect(einschub()?.querySelector(".einschub-stand")?.textContent).toBe(
      "Offen · Version 1 · Stand 05.01.2026",
    );
    // Ohne Aussage am Objekt: keine erfundene Passage.
    expect(einschub()?.querySelector(".einschub-passage")?.textContent).toBe(
      "Keine Belegstelle übermittelt.",
    );
    expect(einschub()?.querySelector("mark")).toBeNull();
    expect(aktionen().map((a) => [a.tag, a.text, a.aus])).toEqual([
      ["button", "Im Original öffnen", true],
      ["a", "Im Wissensnetz anzeigen", false],
    ]);
    expect(document.getElementById("ask-einschub-kein-original")?.textContent).toBe(
      "Kein Original hinterlegt.",
    );
  });

  it("E3 · zweiter Klick und Escape schliessen den Einschub; die naechste Frage raeumt ihn ab; EN zieht nach", async () => {
    starten({ ask: { result: antwort(), gap: null, receipt: "r" }, kos: MIT_STAND });
    await ruhe();
    await fragen();
    const ziffer = (): HTMLElement | null =>
      document.querySelector<HTMLElement>('#ask-fussnoten sup[data-quelle="ka"]');
    ziffer()?.click();
    await ruhe();
    expect(einschub()).not.toBeNull();
    ziffer()?.click();
    await ruhe();
    expect(einschub()).toBeNull();
    ziffer()?.click();
    await ruhe();
    einschub()?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(einschub()).toBeNull();
    ziffer()?.click();
    await ruhe();
    el("lang-en").click();
    await ruhe();
    expect(aktionen().map((a) => a.text)).toEqual(["Open original", "Show in knowledge network"]);
    el("lang-de").click();
    await ruhe();
    el("kw-zurueck").click();
    await ruhe();
    expect(einschub()).toBeNull();
  });
});

// ================================================================================================
// AUFNAHME 20260922 · ANTWORT-QUELLENANZEIGE (R-0310) — QUELLENMARKE JE ABSATZ, UNBELEGTES BLEIBT DRAUSSEN.
// ================================================================================================
//
// Der Server liefert neben `result` die ausdrückliche Zuordnung `absaetze` (services/app/src/
// absatz-belege.ts). Gemessen wird, was das Panel daraus macht: nur belegte Absätze stehen im Feld
// (und gehen damit auch nur so nach Word), jeder trägt am Ende die Ziffer seiner Quelle(n) —
// dieselbe Nummer wie ihr Chip —, und ohne belegten Absatz gibt es keine Antwort.
describe("Aufnahme 20260922 · R-0310 — Absatz-Beleg-Zuordnung im Panel (gemountet)", () => {
  afterEach(() => {
    panelAbraeumen();
  });

  const DREI_ABSAETZE =
    "Offene Profile sind zu bevorzugen. [1]\n\nDas Wetter in Spritzzonen ist meist feucht.\n\nGeschlossene Profile sind zu begruenden. [2]";

  function ziffern(): Array<{ text: string; quelle: string | null; absatz: string | null }> {
    return [...document.querySelectorAll("#ask-fussnoten sup.fussnote")].map((s) => ({
      text: (s.textContent ?? "").trim(),
      quelle: s.getAttribute("data-quelle"),
      absatz: s.getAttribute("data-absatz"),
    }));
  }

  it("P1 · der unbelegte Absatz wird NICHT ausgegeben; jeder belegte Absatz endet mit der Ziffer SEINER Quelle", async () => {
    starten({
      ask: {
        result: antwort({ answer: DREI_ABSAETZE }),
        gap: null,
        receipt: "r",
        absaetze: [
          { text: "Offene Profile sind zu bevorzugen. [1]", quellen: ["ka"] },
          { text: "Das Wetter in Spritzzonen ist meist feucht.", quellen: [] },
          { text: "Geschlossene Profile sind zu begruenden. [2]", quellen: ["kb"] },
        ],
      },
    });
    await ruhe();
    await fragen();
    expect(el<HTMLTextAreaElement>("ask-answer-edit").value).toBe(
      "Offene Profile sind zu bevorzugen.\n\nGeschlossene Profile sind zu begruenden.",
    );
    // Absatz 0 → Ziffer 1 (Design Guide, Chip 1) als Absatzmarke; Absatz 1 → Ziffer 2 am Textende.
    expect(ziffern()).toEqual([
      { text: "1", quelle: "ka", absatz: "0" },
      { text: "2", quelle: "kb", absatz: "1" },
    ]);
    expect(document.querySelectorAll("#ask-fussnoten .absatzmarke sup")).toHaveLength(1);
    // Dieselbe Nummer wie der Chip derselben Quelle.
    const chip = document.querySelector('#ask-sources li.quelle-chip[data-quelle="kb"]');
    expect((chip?.textContent ?? "").trim().startsWith("2 ·")).toBe(true);
    // Der unbelegte Satz steht nirgends in der Antwortkarte.
    expect(el("antwortkarte").textContent ?? "").not.toContain("Wetter");
  });

  it("P2 · kein Absatz belegt (oder nur fremde Quellen): KEINE Antwort — die ehrliche Lücke", async () => {
    starten({
      ask: {
        result: antwort({ answer: "Ein Satz ohne Beleg." }),
        gap: null,
        receipt: "r",
        absaetze: [
          { text: "Ein Satz ohne Beleg.", quellen: [] },
          { text: "Noch einer.", quellen: ["ko-gibt-es-nicht"] },
        ],
      },
    });
    await ruhe();
    await fragen();
    expect(sichtbar(el("ask-gap-block"))).toBe(true);
    expect(el<HTMLTextAreaElement>("ask-answer-edit").value).toBe("");
    expect(ziffern()).toEqual([]);
  });

  it("P3 · ein belegter Absatz: die eine Ziffer steht am Textende wie bisher; ohne Feld bleibt alles beim Alten", async () => {
    starten({
      ask: {
        result: antwort({ citedSources: ["ka"], sources: ["ka"] }),
        gap: null,
        receipt: "r",
        absaetze: [{ text: "Offene Profile sind zu bevorzugen.", quellen: ["ka"] }],
      },
    });
    await ruhe();
    await fragen();
    expect(el<HTMLTextAreaElement>("ask-answer-edit").value).toBe(
      "Offene Profile sind zu bevorzugen.",
    );
    expect(ziffern()).toEqual([{ text: "1", quelle: "ka", absatz: "0" }]);
    expect(document.querySelectorAll("#ask-fussnoten .absatzmarke")).toHaveLength(0);
    panelAbraeumen();
    // Gegenprobe: ein Server ohne `absaetze` — die Ziffern aller tragenden Quellen am Textende.
    starten({ ask: { result: antwort(), gap: null, receipt: "r" } });
    await ruhe();
    await fragen();
    expect(ziffern().map((z) => [z.text, z.absatz])).toEqual([
      ["1", null],
      ["2", null],
    ]);
  });
});
