// ================================================================================================
// OCR-E03 · BILDHAFTE TABELLE → BEARBEITBARE TABELLE → ZWISCHENABLAGE → EDITOR, IM ECHTEN BROWSER
// ================================================================================================
//
// Auftrag produkt:20261012:klara-ocr-tabellen. Gemessen gegen den Smoke-Server mit der ECHTEN
// Texterkennung (tesseract.js unter der eigenen CSP, W01) — kein Stellvertreter:
//   1. Eine kontrollierte Tabelle (Überschrift, bekannte Zahlen mit Dezimalkomma, Vorzeichen und
//      Einheiten, zwei leere Zellen, eine absichtlich schwer lesbare Zelle) wird als Bild über den
//      Dateiimport des Erfassens bereitgestellt. Ohne Klick erscheint die bearbeitbare Tabelle.
//   2. Struktur: 4 Spalten, 4 Zeilen, Kopfzeile. Leere Zellen sind leer und als leer benannt.
//      Bekannte Werte stehen wörtlich da ODER sind als unsicher gekennzeichnet — ein falscher Wert
//      ohne Marke ist ein Fehler (K2). Die schwer lesbare Zelle ist als unsicher/unleserlich
//      gekennzeichnet und trägt keinen ungekennzeichneten Wert; die echte Leerzelle ist leer (K3).
//   3. VOR jeder Korrektur kopiert: HTML-Tabelle und Tabulatortext tragen dieselbe Struktur, die
//      Marke der schweren Zelle und die leere Zelle (K3, K4).
//   4. Der unterstützte Zielweg: diese Kopie in den Fließtext eines Entwurfs eingefügt (Strg/Cmd+V,
//      der echte Einfügeweg des Editors) — Tabelle mit Kopf, Zeilen, Spalten und Marke (K4).
//   5. Der Korrekturweg: die schwere Zelle berichtigt und erneut kopiert (K1, K4).
//
// DIE VORLAGE IST FIKTIV, im Browser auf ein `<canvas>` gezeichnet. Der Entwurf für das Einfügen
// wird am Ende gelöscht. Kein Modell, kein Schlüssel. Das Protokoll hängt am Bericht, gleich wie
// der Lauf ausgeht.
//
// GRENZE: das ist der Datei-/Bildweg im Browser. Word-, PowerPoint- oder Collabora-Hosts sind hier
// NICHT geprüft — ihre Abnahme bleibt offen.
import { type Page, expect, test } from "@playwright/test";
import { ensureLoggedIn } from "./support/auth";

const BILDNAME = "fiktive-tabelle-ocr-e03.png";
/** Wird absichtlich unscharf und blass gezeichnet. */
const SCHWER = "9,1";
const TABELLE = [
  ["POSTEN", "MENGE", "PREIS", "DIFFERENZ"],
  ["Ventil", "4 kg", "12,50 €", "-3,5 %"],
  ["Dichtung", "", "0,80 €", "+1,2 %"],
  ["Filter", "12,5 kg", SCHWER, "-0,4 %"],
] as const;
const SCHWERE_ZELLE = { zeile: 3, spalte: 2 };
const LEERE_ZELLEN = [{ zeile: 2, spalte: 1 }];

const DATEI_BEFUND = "[data-testid=datei-bild-befunde] [data-testid=bild-befunde]";
const EDITOR_NAME = "Wissensseite — Fließtext";

async function fiktiveTabelle(page: Page): Promise<Buffer> {
  const b64 = await page.evaluate(
    ({ zeilen, schwer }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1560;
      canvas.height = 100 + zeilen.length * 110;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("kein Canvas");
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      zeilen.forEach((zeile, n) => {
        zeile.forEach((zelle, s) => {
          const x = 60 + s * 380;
          const y = 110 + n * 110;
          if (zelle === schwer.text && n === schwer.zeile && s === schwer.spalte) {
            // Schwer lesbar: blass, unscharf, kleiner.
            ctx.save();
            ctx.filter = "blur(5px)";
            ctx.fillStyle = "#c8c8c8";
            ctx.font = "bold 36px Arial, Helvetica, sans-serif";
            ctx.fillText(zelle, x, y);
            ctx.restore();
            return;
          }
          ctx.fillStyle = "#000000";
          ctx.font = `${n === 0 ? "bold " : ""}52px Arial, Helvetica, sans-serif`;
          ctx.fillText(zelle, x, y);
        });
      });
      return canvas.toDataURL("image/png").split(",")[1] ?? "";
    },
    { zeilen: TABELLE.map((z) => [...z]), schwer: { text: SCHWER, ...SCHWERE_ZELLE } },
  );
  return Buffer.from(b64, "base64");
}

interface Zelle {
  zeile: number;
  spalte: number;
  wert: string;
  zustand: string | null;
  bearbeitet: string | null;
  kopf: boolean;
}

async function rasterAblesen(page: Page): Promise<Zelle[]> {
  return page.locator(`${DATEI_BEFUND} [data-testid=bild-tabelle-zelle]`).evaluateAll((els) =>
    els.map((el) => ({
      zeile: Number(el.getAttribute("data-zeile")),
      spalte: Number(el.getAttribute("data-spalte")),
      wert: (el.querySelector("input") as HTMLInputElement | null)?.value ?? "",
      zustand: el.getAttribute("data-zustand"),
      bearbeitet: el.getAttribute("data-bearbeitet"),
      kopf: el.tagName === "TH",
    })),
  );
}

/** Ohne Marke heißt: kein `[?…]`, kein `[unleserlich]` im Wert. */
const MARKE = /\[\?[^\]]*\]|\[unleserlich\]/;

/**
 * Stimmt der Wert — oder ist er als unsicher gekennzeichnet? Ein falscher Wert ohne Marke nicht.
 *
 * Verglichen wird JEDES Zeichen (Ziffern, Dezimalkomma, Vorzeichen, Einheit), aber ohne Leerraum:
 * Ob die Engine „-3,5 %“ als ein Wort „-3,5%“ oder als zwei Wörter liest, entscheidet ihre
 * Wortgrenze, nicht der Wert (Nacharbeit 3, Lauf 420b383c: Rohtext der Engine „-3,5%“, wörtlich
 * übernommen). Das Produkt ergänzt keinen Abstand, den die Engine nicht geliefert hat.
 */
function stimmtOderMarkiert(ist: string, soll: string): boolean {
  const eng = (s: string) => s.replace(/\s+/g, "").toUpperCase();
  return eng(ist) === eng(soll) || MARKE.test(ist);
}

/** Die abgelesenen Zellen als Zeilen × Spalten der Werte. */
function gitter(zellen: readonly Zelle[]): string[][] {
  const aus: string[][] = [];
  for (const z of zellen) {
    const zeile = aus[z.zeile] ?? [];
    zeile[z.spalte] = z.wert;
    aus[z.zeile] = zeile;
  }
  return aus.map((zeile) => [...zeile]);
}

interface Ablage {
  roh: Record<string, string>;
  struktur: { zeilen: { tag: string; text: string }[][]; beschriftung: string } | null;
}

/**
 * Die echte Zwischenablage lesen. Chromium liefert das HTML beim Lesen bereinigt (u. a. mit
 * <meta>, ggf. mit Stilen) — die Struktur wird deshalb geparst, nicht als Zeichenfolge verglichen.
 */
async function ablageLesen(page: Page): Promise<Ablage> {
  return page.evaluate(async () => {
    const eintraege = await navigator.clipboard.read();
    const aus: Record<string, string> = {};
    for (const eintrag of eintraege) {
      for (const art of eintrag.types) {
        aus[art] = await (await eintrag.getType(art)).text();
      }
    }
    const t = new DOMParser()
      .parseFromString(aus["text/html"] ?? "", "text/html")
      .querySelector("table");
    const struktur = t
      ? {
          zeilen: [...t.rows].map((r) =>
            [...r.cells].map((c) => ({ tag: c.tagName, text: (c.textContent ?? "").trim() })),
          ),
          beschriftung: (t.caption?.textContent ?? "").trim(),
        }
      : null;
    return { roh: aus, struktur };
  });
}

function tsvGitter(ablage: Ablage): string[][] {
  return (ablage.roh["text/plain"] ?? "").split("\n").map((z) => z.split("\t"));
}

/** Text und HTML der Zwischenablage tragen genau die Tabelle `erwartet`, mit Kopf und Herkunft. */
function pruefeAblage(ablage: Ablage, erwartet: string[][]): void {
  expect(tsvGitter(ablage)).toEqual(erwartet);
  expect(ablage.struktur, "keine HTML-Tabelle in der Zwischenablage").not.toBeNull();
  expect(ablage.struktur?.zeilen.map((z) => z.map((c) => c.text))).toEqual(erwartet);
  expect(ablage.struktur?.zeilen[0]?.every((c) => c.tag === "TH")).toBe(true);
  expect(
    ablage.struktur?.zeilen
      .slice(1)
      .flat()
      .every((c) => c.tag === "TD"),
  ).toBe(true);
  expect(ablage.struktur?.beschriftung).toContain(BILDNAME);
}

test("OCR-E03 · bildhafte Tabelle wird bearbeitbare Tabelle und kommt mit Struktur im Editor an", async ({
  page,
  browserName,
  baseURL,
}) => {
  test.skip(
    browserName !== "chromium",
    "Zwischenablage-Rechte (clipboard-read/-write) vergibt Playwright nur in Chromium.",
  );
  test.setTimeout(600_000);
  await ensureLoggedIn(page);
  const herkunft = new URL(baseURL ?? page.url()).origin;
  await page
    .context()
    .grantPermissions(["clipboard-read", "clipboard-write"], { origin: herkunft });
  const cspMeldungen: string[] = [];
  page.on("console", (meldung) => {
    if (/Content Security Policy|Refused to/i.test(meldung.text())) {
      cspMeldungen.push(meldung.text());
    }
  });
  const protokoll: Record<string, unknown> = {
    art: "Technische Probe mit kontrollierter, fiktiver Tabelle — keine Host- oder Kundenabnahme",
    vorlage: { tabelle: TABELLE, schwereZelle: SCHWERE_ZELLE, leereZellen: LEERE_ZELLEN },
  };
  let entwurf = "";

  try {
    // ── 1 · Bild bereitstellen — kein Klick auf eine Erkennung ──────────────────────────────────
    await page.goto("/erfassen?weg=datei");
    const eingang = page.locator('input[type="file"][accept*=".pptx"][accept*="image/*"]').first();
    await expect(eingang, "Dateiimport des Erfassens ist nicht da").toBeAttached({
      timeout: 20_000,
    });
    const png = await fiktiveTabelle(page);
    await eingang.setInputFiles({ name: BILDNAME, mimeType: "image/png", buffer: png });
    await expect
      .poll(
        async () =>
          (await page
            .locator(DATEI_BEFUND)
            .first()
            .getAttribute("data-status", { timeout: 1_000 })
            .catch(() => null)) ?? "",
        { timeout: 240_000, intervals: [1_000] },
      )
      .not.toMatch(/^(laeuft|wartet)?$/);
    protokoll.befundText = await page
      .locator(`${DATEI_BEFUND} [data-testid=bild-befund-text]`)
      .first()
      .textContent();
    const tabelle = page.locator(`${DATEI_BEFUND} [data-testid=bild-tabelle]`).first();
    await expect(tabelle, "keine bearbeitbare Tabelle im Befund").toBeVisible({ timeout: 10_000 });
    const form = {
      zeilen: await tabelle.getAttribute("data-zeilen"),
      spalten: await tabelle.getAttribute("data-spalten"),
      kopfzeilen: await tabelle.getAttribute("data-kopfzeilen"),
    };
    const raster = await rasterAblesen(page);
    protokoll.erkannt = { form, raster };

    // ── 2 · Struktur, Werte, leere und schwer lesbare Zellen ────────────────────────────────────
    expect(form).toEqual({ zeilen: "4", spalten: "4", kopfzeilen: "1" });
    expect(raster).toHaveLength(16);
    const an = (zeile: number, spalte: number) =>
      raster.find((z) => z.zeile === zeile && z.spalte === spalte);
    expect(raster.filter((z) => z.kopf).map((z) => z.spalte)).toEqual([0, 1, 2, 3]);
    TABELLE.forEach((soll, n) => {
      soll.forEach((wert, s) => {
        const ist = an(n, s);
        if (n === SCHWERE_ZELLE.zeile && s === SCHWERE_ZELLE.spalte) {
          return;
        }
        if (wert === "") {
          expect(ist?.wert, `Zelle ${n + 1}/${s + 1} muss leer sein`).toBe("");
          expect(ist?.zustand, `Zelle ${n + 1}/${s + 1}`).toBe("leer");
          return;
        }
        expect(
          stimmtOderMarkiert(ist?.wert ?? "", wert),
          `Zelle ${n + 1}/${s + 1}: „${ist?.wert ?? ""}“ statt „${wert}“ ohne Unsicherheitsmarke`,
        ).toBe(true);
      });
    });
    const schwer = an(SCHWERE_ZELLE.zeile, SCHWERE_ZELLE.spalte);
    protokoll.schwereZelle = schwer;
    // Nacharbeit 4 (Bens Befund): die schwer lesbare Zelle ist AUSDRÜCKLICH als unsicher bzw.
    // unleserlich gekennzeichnet — leer ist hier kein zulässiges Ergebnis, denn im Bild steht etwas.
    // Und sie trägt keinen ungekennzeichneten Wert. Die echte Leerzelle ist oben getrennt als leer
    // geprüft (LEERE_ZELLEN).
    expect(
      ["unsicher", "unleserlich"],
      `Die schwer lesbare Zelle heißt „${schwer?.zustand ?? ""}“ statt unsicher/unleserlich`,
    ).toContain(schwer?.zustand ?? "");
    expect(schwer?.wert ?? "", "Die schwer lesbare Zelle trägt keine Unsicherheitsmarke").toMatch(
      MARKE,
    );
    expect(
      (schwer?.wert ?? "").replace(new RegExp(MARKE.source, "g"), "").trim(),
      `Die schwer lesbare Zelle trägt einen ungekennzeichneten Wert: „${schwer?.wert ?? ""}“`,
    ).toBe("");
    for (const leer of LEERE_ZELLEN) {
      expect(an(leer.zeile, leer.spalte)?.zustand, "echte Leerzelle").toBe("leer");
    }
    const vorKorrektur = gitter(raster);
    const anZelle = (g: string[][], z: { zeile: number; spalte: number }) => g[z.zeile]?.[z.spalte];

    // ── 3 · VOR jeder Korrektur kopieren: die Kennzeichnung reist in HTML und Text mit ──────────
    const kopieren = page.locator(`${DATEI_BEFUND} [data-testid=bild-tabelle-kopieren]`).first();
    const kopiert = page.locator(`${DATEI_BEFUND} [data-testid=bild-tabelle-kopiert]`).first();
    await kopieren.click();
    await expect(kopiert).toHaveAttribute("data-ergebnis", "tabelle", { timeout: 10_000 });
    const ablageVorher = await ablageLesen(page);
    protokoll.zwischenablageVorKorrektur = ablageVorher;
    pruefeAblage(ablageVorher, vorKorrektur);
    expect(anZelle(tsvGitter(ablageVorher), SCHWERE_ZELLE)).toMatch(MARKE);
    for (const leer of LEERE_ZELLEN) {
      expect(anZelle(tsvGitter(ablageVorher), leer), "echte Leerzelle in der Kopie").toBe("");
    }

    // ── 4 · der Zielweg: diese Kopie in den Fließtext eines Entwurfs einfügen ───────────────────
    const antwort = await page.request.post("/api/drafts", {
      data: {
        title: "OCR-E03 · Einfügeprobe (fiktiv)",
        statement: "Eine aus einem Bild übernommene Tabelle.",
        type: "best_practice",
        category: "Anlage 1",
        bodyHtml: "<p>Vorher</p>",
      },
    });
    expect(antwort.status(), "Der Entwurf konnte nicht angelegt werden").toBe(201);
    entwurf = ((await antwort.json()) as { id: string }).id;
    // Ein zweiter Tab: der Befund im ersten bleibt für die Korrektur stehen.
    const ziel = await page.context().newPage();
    await ziel.goto(`/capture/frontdoor?draft=${entwurf}`);
    const editor = ziel.getByRole("textbox", { name: EDITOR_NAME }).first();
    await expect(editor).toBeVisible({ timeout: 15_000 });
    await editor.click();
    await ziel.keyboard.press("End");
    await ziel.keyboard.press("ControlOrMeta+V");
    const eingefuegt = editor.locator("table").first();
    await expect(eingefuegt, "Die Tabelle kam nicht als Tabelle im Editor an").toBeVisible({
      timeout: 10_000,
    });
    const imEditor = await eingefuegt.evaluate((t) => {
      const tabelle = t as HTMLTableElement;
      return {
        zeilen: [...tabelle.rows].map((r) =>
          [...r.cells].map((c) => ({ tag: c.tagName, text: (c.textContent ?? "").trim() })),
        ),
        beschriftung: (tabelle.caption?.textContent ?? "").trim(),
        html: tabelle.outerHTML,
      };
    });
    protokoll.imEditor = imEditor;
    const editorGitter = imEditor.zeilen.map((z) => z.map((c) => c.text));
    expect(editorGitter).toEqual(vorKorrektur);
    expect(imEditor.zeilen[0]?.every((c) => c.tag === "TH")).toBe(true);
    expect(imEditor.beschriftung).toContain(BILDNAME);
    expect(anZelle(editorGitter, SCHWERE_ZELLE), "Marke im Editor").toMatch(MARKE);
    for (const leer of LEERE_ZELLEN) {
      expect(anZelle(editorGitter, leer), "echte Leerzelle im Editor").toBe("");
    }
    await ziel.close();

    // ── 5 · der Korrekturweg: Zelle berichtigen, erneut kopieren ────────────────────────────────
    await page.bringToFront();
    const korrektur = "9,10 €";
    const schwereEingabe = page.locator(
      `${DATEI_BEFUND} [data-testid=bild-tabelle-zelle][data-zeile="${SCHWERE_ZELLE.zeile}"][data-spalte="${SCHWERE_ZELLE.spalte}"] input`,
    );
    await schwereEingabe.fill(korrektur);
    await expect(schwereEingabe).toHaveValue(korrektur);
    const nachher = await rasterAblesen(page);
    expect(
      nachher.find((z) => z.zeile === SCHWERE_ZELLE.zeile && z.spalte === SCHWERE_ZELLE.spalte)
        ?.bearbeitet,
    ).toBe("ja");
    await kopieren.click();
    await expect(kopiert).toHaveAttribute("data-ergebnis", "tabelle", { timeout: 10_000 });
    const ablageNachher = await ablageLesen(page);
    protokoll.zwischenablageNachKorrektur = ablageNachher;
    const nachKorrektur = gitter(nachher);
    pruefeAblage(ablageNachher, nachKorrektur);
    expect(anZelle(tsvGitter(ablageNachher), SCHWERE_ZELLE)).toBe(korrektur);
  } finally {
    protokoll.cspMeldungen = cspMeldungen;
    await test.info().attach("ocr-e03-tabelle.json", {
      contentType: "application/json",
      body: JSON.stringify(protokoll, null, 2),
    });
    if (entwurf) {
      await page.request.delete(`/api/drafts/${entwurf}`);
    }
  }
  expect(cspMeldungen, "CSP-Meldungen während der Erkennung").toEqual([]);
});
