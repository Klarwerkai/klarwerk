// ================================================================================================
// ZWILLINGE, AUSGEBLENDETE BILDER, GESPEICHERTER RUMPF — UND DIE GEGENPROBE GEGEN EINGEFRORENE WERTE
// ================================================================================================
//
// Restprüfungen aus 4228/4269, gebündelt (Auftrag aufnahme:20260922:import-bilder-persistenz):
//
//   A · Zwei identische Folienbilder und ausgeblendete Bilder zählen nach ihrer Bedeutung; eine
//       globale Quellen-Deduplizierung darf keinen Verlust verdecken.
//   B · Nach Speichern, Annahme und erneutem Laden über die echten Routen stimmen Bilanz und
//       Bildbytes mit den UNABHÄNGIGEN Originaldaten überein (nicht mit dem Import, der geprüft wird).
//   C · Die DOM-Gegenprobe macht einen eingefrorenen Ableser rot — hier ohne Browser am Messmittel
//       selbst belegt; am echten DOM in `bildnachweis-gespeichert-chromium.test.ts`.
//   D · Die ausdrücklich erwartete Prüflücke aus 4269 §8.6(a) bleibt gesondert gekennzeichnet.
//
// Der Speicherweg läuft hier über `buildApp(buildServices())` (Arbeitsspeicher). Die Persistenz in
// PostgreSQL über zwei App-Instanzen steht in `altbeleg-und-bildbilanz-pg.integration.test.ts`.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { DraftPayload } from "../../apps/web/src/api/types";
import { wholeDocumentDraftPayload } from "../../apps/web/src/lib/captureFromFile";
import type { PptxRichResult } from "../../apps/web/src/lib/pptx";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  type Bildablesung,
  VERSTELLARTEN,
  type Verstellart,
  ZWILLINGSDECK,
  ZWILLING_DATEINAME,
  bilderImRumpf,
  domBefunde,
  domGegenprobe,
  quellanalyse,
  rumpfBefunde,
  sollbilanz,
  sollpixel,
  verschiedeneQuellen,
  zwillingsdeck,
} from "./bildnachweis";
import { importieren } from "./messung";
import { SPRACHEN, type Sprache } from "./quittungspruefer";

let ergebnis: PptxRichResult;

beforeAll(async () => {
  ergebnis = await importieren(zwillingsdeck());
});

/** Der Entwurf, den die Oberfläche aus diesem Import speichert — mit den Werten von `Capture.tsx`. */
function entwurfAusImport(sprache: Sprache): DraftPayload {
  return {
    ...wholeDocumentDraftPayload({
      fileName: ZWILLING_DATEINAME,
      text: ergebnis.text,
      html: ergebnis.html,
      sourceKind: "pptx",
      locale: sprache,
      sourceImageCount: ergebnis.imageCount,
    }),
    // Pflichtfeld des Einreichens seit JOB 3082 — ohne Stufe verweigert `promote` die Annahme.
    confidentiality: "intern",
  } as DraftPayload;
}

// ================================================================================================
// A · WAS DIE QUELLE ENTHÄLT, UND WIE ES GEZÄHLT WIRD
// ================================================================================================
describe("A · Zwillinge und ausgeblendete Bilder — gezählt nach ihrer Bedeutung", () => {
  it("die unabhängige Quellanalyse findet genau die sechs beschriebenen Bilder", () => {
    // Die Deckbeschreibung ist die Sollwahrheit — aber nur, wenn das ZIP sie auch enthält.
    const quelle = quellanalyse(zwillingsdeck());
    expect(quelle.map((b) => `${b.folie}:${b.datei}:${b.ausgeblendet}`)).toEqual(
      ZWILLINGSDECK.map((b) => `${b.folie}:${b.datei}:${b.ausgeblendet}`),
    );
    quelle.forEach((b, i) => {
      expect(Buffer.from(b.bytes).equals(Buffer.from(ZWILLINGSDECK[i]?.bytes ?? [])), b.datei).toBe(
        true,
      );
    });
    // Drei Zwillinge mit denselben Bytes — zwei davon aus derselben Mediendatei.
    const rot = quelle.filter((b) => b.datei.startsWith("zwilling-"));
    expect(rot).toHaveLength(3);
    expect(new Set(rot.map((b) => b.datei)).size).toBe(2);
  });

  it("der Import zählt jeden Verweis — Zwillinge doppelt, Ausgeblendetes mit, das BMP als Verlust", () => {
    const soll = sollbilanz(ZWILLINGSDECK);
    expect({
      quelle: ergebnis.imageCount,
      imEntwurf: ergebnis.embeddedImages,
      format: ergebnis.droppedImageFormat,
      doppelteVerweise: ergebnis.duplicateImageRefs,
    }).toEqual({
      quelle: ZWILLINGSDECK.length,
      imEntwurf: soll.imEntwurf,
      format: soll.fehlend,
      // Nur der Verweis auf DIESELBE Mediendatei ist ein doppelter Verweis; die zweite Datei mit
      // identischen Bytes ist für das Archiv ein eigenes Bild.
      doppelteVerweise: 1,
    });
  });

  it("jedes übernommene Bild steht in Reihenfolge mit den Bytes seiner Originaldatei im Rumpf", () => {
    const da = bilderImRumpf(ergebnis.html);
    const erwartet = ZWILLINGSDECK.filter((b) => b.erwartet === "uebernommen");
    expect(da.map((b) => b.mime)).toEqual(erwartet.map(() => "image/png"));
    da.forEach((b, i) => {
      expect(
        Buffer.from(b.bytes).equals(Buffer.from(erwartet[i]?.bytes ?? [])),
        `Bild ${i + 1}`,
      ).toBe(true);
    });
  });

  it("ausgeblendete Form und ausgeblendete Folie: in der Quelle gezählt UND im Entwurf vorhanden", () => {
    // Der Import kennt kein „ausgeblendet"; er übernimmt beide. Die Quittung darf sie deshalb als
    // übernommen zählen — der Browserfall prüft, dass sie dann auch SICHTBAR dastehen.
    const da = bilderImRumpf(ergebnis.html);
    for (const datei of ["versteckt-form.png", "versteckt-folie.png"]) {
      const bild = ZWILLINGSDECK.find((b) => b.datei === datei);
      expect(
        da.some((d) => Buffer.from(d.bytes).equals(Buffer.from(bild?.bytes ?? []))),
        datei,
      ).toBe(true);
    }
  });

  for (const sprache of SPRACHEN) {
    it(`${sprache}: die Quittung am Entwurf nennt 5 übernommen, 1 nicht übernommen`, () => {
      expect(
        rumpfBefunde(entwurfAusImport(sprache).bodyHtml ?? "", sprache, ZWILLINGSDECK),
      ).toEqual([]);
    });
  }

  it("eine Zählung über VERSCHIEDENE Quellen verdeckt einen verlorenen Zwilling — diese hier nicht", () => {
    const html = entwurfAusImport("de").bodyHtml ?? "";
    // Die Zählweise aus JOB 4269 (`BILDER_AM_EINTRAG`): drei verschiedene Quellen bei fünf Bildern.
    expect(verschiedeneQuellen(html)).toBe(3);
    expect(bilderImRumpf(html)).toHaveLength(5);

    // Ein Zwilling geht verloren — die Quittung sagt weiter 5.
    const ohneZwilling = html.replace(/<figure\b[\s\S]*?<\/figure>/u, "");
    expect(bilderImRumpf(ohneZwilling), "die Verstellung hat kein Bild entfernt").toHaveLength(4);
    // Die deduplizierte Zählung merkt davon NICHTS …
    expect(verschiedeneQuellen(ohneZwilling)).toBe(verschiedeneQuellen(html));
    // … der Nachweis Bild für Bild schon (dazu die verschobene Reihenfolge der übrigen Bilder).
    expect(rumpfBefunde(ohneZwilling, "de", ZWILLINGSDECK)).toContain("4 Bilder im Rumpf statt 5");
  });
});

// ================================================================================================
// B · SPEICHERN, ANNEHMEN, NEU LADEN — ÜBER DIE ECHTEN ROUTEN
// ================================================================================================
describe("B · der gespeicherte und angenommene Bildnachweis über die echten Routen", () => {
  it("POST /api/drafts → GET → promote → GET /api/kos/:id: Bilanz und Bildbytes wie im Original", async () => {
    const app = buildApp(buildServices());
    const zugang = {
      name: "Bildnachweis",
      email: `bildnachweis-${Math.random().toString(36).slice(2)}@klarwerk.test`,
      password: "secret123",
    };
    await app.inject({ method: "POST", url: "/api/auth/register", payload: zugang });
    const anmeldung = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: zugang.email, password: zugang.password },
    });
    const headers = { authorization: `Bearer ${(anmeldung.json() as { token: string }).token}` };

    const entwurf = entwurfAusImport("de");
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: entwurf,
    });
    expect(angelegt.statusCode, angelegt.body).toBeLessThan(300);
    const id = (angelegt.json() as { id: string }).id;

    const geladen = await app.inject({ method: "GET", url: `/api/drafts/${id}`, headers });
    const imEntwurf =
      ((geladen.json() as { payload: { bodyHtml?: string } }).payload.bodyHtml as string) ?? "";
    expect(rumpfBefunde(imEntwurf, "de", ZWILLINGSDECK), "am gespeicherten Entwurf").toEqual([]);

    const angenommen = await app.inject({
      method: "POST",
      url: `/api/drafts/${id}/promote`,
      headers,
    });
    expect(angenommen.statusCode, angenommen.body).toBe(201);
    const koId = (angenommen.json() as { id: string }).id;
    const eintrag = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers });
    expect(eintrag.statusCode, eintrag.body).toBe(200);
    const amEintrag = (eintrag.json() as { bodyHtml?: string }).bodyHtml ?? "";
    expect(rumpfBefunde(amEintrag, "de", ZWILLINGSDECK), "am angenommenen Eintrag").toEqual([]);
    await app.close();
  });
});

// ================================================================================================
// C · DIE GEGENPROBE — EIN EINGEFRORENER ABLESER MACHT DEN FALL ROT
// ================================================================================================
//
// Ein nachgestelltes DOM: eine Liste von Bildern, die die Verstellungen wirklich verändern. Der
// EHRLICHE Ableser liest sie jedes Mal neu; der EINGEFRORENE gibt die Ablesung vom Anfang zurück —
// genau der Fehler „alter Wert nach Seitenwechsel", den der Prüfer in der D3-Kette gefunden hatte.
function nachgestelltesDom() {
  const sichtbar = (pixel: Uint8Array): Bildablesung => ({
    quelle: "data:image/png;base64,…",
    sichtbar: true,
    fertig: true,
    breite: 4,
    hoehe: 4,
    pixel: [...pixel],
  });
  const ausgang = sollpixel(ZWILLINGSDECK).map(sichtbar);
  let bilder: Bildablesung[] = [...ausgang];
  const letzter = ausgang.length - 1;
  return {
    ehrlich: async () => [...bilder],
    eingefroren: async () => [...ausgang],
    werfend: async (): Promise<Bildablesung[]> => {
      throw new Error("Kontext zerstört");
    },
    verstellen: async (art: Verstellart) => {
      const b = bilder[letzter] as Bildablesung;
      bilder =
        art === "entfernen"
          ? bilder.slice(0, letzter)
          : bilder.map((x, i) =>
              i !== letzter
                ? x
                : art === "ausblenden"
                  ? { ...b, sichtbar: false }
                  : art === "zerstoeren"
                    ? { ...b, breite: 0, hoehe: 0, pixel: [] }
                    : { ...b, pixel: [...(bilder[0]?.pixel ?? [])] },
            );
      return true;
    },
    zurueck: async () => {
      bilder = [...ausgang];
      return true;
    },
    istZurueck: () => bilder.length === ausgang.length && bilder.every((b, i) => b === ausgang[i]),
  };
}

const pruefen = (a: readonly Bildablesung[] | null) =>
  domBefunde(a, sollpixel(ZWILLINGSDECK), { imEntwurf: 5, fehlend: 1 }, 1);

describe("C · die DOM-Gegenprobe gegen eingefrorene Werte", () => {
  it("ehrlicher Ableser: jede der vier Verstellungen macht den Nachweis rot, danach wieder grün", async () => {
    const dom = nachgestelltesDom();
    const protokoll = await domGegenprobe({ lesen: dom.ehrlich, pruefen, ...dom });
    expect(Object.keys(protokoll)).toEqual([...VERSTELLARTEN]);
    expect(protokoll.entfernen).toContain("4 sichtbare, dekodierte Bilder statt 5");
    expect(protokoll.ausblenden).toContain("1 Bild(er) im Inhalt sind nicht sichtbar");
    expect(protokoll.zerstoeren).toContain("4 sichtbare, dekodierte Bilder statt 5");
    expect(protokoll.vertauschen.join(" ")).toMatch(/Bild 5 zeigt nicht die Pixel/u);
    expect(dom.istZurueck()).toBe(true);
  });

  it("EINGEFRORENER Ableser: die Gegenprobe wirft — und die Lage ist trotzdem wiederhergestellt", async () => {
    const dom = nachgestelltesDom();
    await expect(domGegenprobe({ lesen: dom.eingefroren, pruefen, ...dom })).rejects.toThrow(
      /eingefroren/u,
    );
    expect(dom.istZurueck()).toBe(true);
  });

  it("werfender Ableser: der Fehler kommt unverfälscht heraus, die Lage ist wiederhergestellt", async () => {
    const dom = nachgestelltesDom();
    let aufrufe = 0;
    const lesen = async () => {
      aufrufe += 1;
      return aufrufe === 1 ? dom.ehrlich() : dom.werfend();
    };
    await expect(domGegenprobe({ lesen, pruefen, ...dom })).rejects.toThrow("Kontext zerstört");
    expect(dom.istZurueck()).toBe(true);
  });

  it("eine eingefrorene ZAHL in der Quittung wird rot, sobald sie nicht zum sichtbaren Inhalt passt", () => {
    const bilder = sollpixel(ZWILLINGSDECK).map((p) => ({
      quelle: "",
      sichtbar: true,
      fertig: true,
      breite: 4,
      hoehe: 4,
      pixel: [...p],
    }));
    // Vier Bilder stehen da, die Quittung sagt eingefroren weiter 5.
    expect(
      domBefunde(
        bilder.slice(0, 4),
        sollpixel(ZWILLINGSDECK).slice(0, 4),
        { imEntwurf: 5, fehlend: 1 },
        1,
      ),
    ).toEqual(["Quittung nennt 5 übernommen, sichtbar dekodiert sind 4"]);
    // Und ein fehlender Container ist kein „keine Bilder".
    expect(pruefen(null)).toEqual(["der Inhaltscontainer steht nicht auf der Seite"]);
  });
});

// ================================================================================================
// D · DIE ERWARTETE PRÜFLÜCKE AUS 4269 §8.6(a) — GESONDERT GEKENNZEICHNET, NICHT MITGEZÄHLT
// ================================================================================================
//
// `archiv/4269/AUFTRAG.md` §8.6(a): „Kaputtgehen kann (a) ein anderer Test, der den alten
// Oberflächensatz wörtlich erwartet". Eingetreten ist genau das: `tests/app/pptx-notes-honesty.
// test.ts` pinnte „Bilder je Folie übernommen" und wurde in 4269 AUSSERHALB der Zielpfade umgedreht
// (`archiv/4269/runde-1/RUECKGABE.md`, ABWEICHUNGEN). Diese Lücke ist KEIN Bildzählfall und wird
// hier weder als bestanden noch als geprüft verbucht; festgehalten wird nur, dass ihre Kennzeichnung
// und der umgedrehte Pin stehen bleiben — wer sie entfernt, macht diesen Fall rot.
describe("D · 4269 §8.6(a) — erwartete Prüflücke, gesondert gekennzeichnet", () => {
  it("der umgedrehte Pin und seine Begründung stehen weiter in pptx-notes-honesty.test.ts", () => {
    const quelle = readFileSync(
      resolve(process.cwd(), "tests/app/pptx-notes-honesty.test.ts"),
      "utf8",
    );
    expect(quelle).toContain("JOB 4269 (17.09.2026) — HIER STAND");
    // Der alte Pin steht nur noch im Begründungskommentar, nicht mehr als Zusicherung.
    const code = quelle
      .split("\n")
      .filter((zeile) => !zeile.trim().startsWith("//"))
      .join("\n");
    expect(code).toContain("expect(de).not.toMatch(/Bilder je Folie übernommen/)");
    expect(code).not.toContain("expect(de).toMatch(/Bilder je Folie übernommen/)");
  });
});
