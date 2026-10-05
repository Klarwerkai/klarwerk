// @vitest-environment jsdom
// ================================================================================================
// AUFTRAG import-meldungen · K1, K4, K5 — DIE ACHT FESTGESCHRIEBENEN SPRACHMELDUNGEN, GEMOUNTET.
// ================================================================================================
//
// `tests/import-anleitung-modus/sprachwechsel-import-meldungen.test.tsx` (JOB 3379) führt acht
// Meldungen als EINGEFROREN: nach DE→EN bleibt der deutsche Satz stehen. Gepinnt war dort nur
// Englisch, und nur der Wortlaut. Diese Datei ordnet jede der acht ihrem AUSLÖSENDEN ZUSTAND und
// ihrem TRÄGER auf der Fläche zu und misst die Wirkung in DE, EN UND NL am gemounteten
// Arbeitsraum (dieselbe Bühne, `datei-buehne.tsx`) — ausgelöst über die echten Ereigniswege.
//
// BEFUND (reproduzierbar, als `it.fails` gepinnt): der Satz wird beim Auslösen als fertiger Text
// in den Zustand gelegt (`setNotice(t(…))`, `setErr(t(…))`, `setFileImportMeldung(t(…))`,
// `CaptureFileImport.setMeldung(t(…))`) und folgt deshalb keinem späteren Sprachwechsel. Das
// begründet einen eigenen Reparaturschnitt; diese Datei repariert nichts. Wird er behoben, werden
// die `it.fails`-Fälle rot und sind auf `it` umzustellen.
//
// Dazu R-0120 (die Ablehnung ist hörbar und erscheint einmal) am ganzen Arbeitsraum statt nur an
// der Einzelkomponente, und R-0152 (die Grenze steht vor der Auswahl) samt Sprachwechsel.
import { describe, expect, it } from "vitest";
import { act } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FILE_TEXT as T } from "../../apps/web/src/lib/captureFromFile";
import { maxRawAttachmentMb, transferLimitMb } from "../../apps/web/src/lib/uploadLimits";
import {
  bremse,
  buttonByText,
  click,
  container,
  dateiEinlesen,
  dateiEinlesenBeenden,
  dateiEinlesenStarten,
  draftId,
  endpoints,
  fehlerpin,
  flush,
  modusKarte,
  mount,
  pageText,
  sichtbar,
  txt,
} from "../import-anleitung-modus/datei-buehne";

type Sprache = "de" | "en" | "nl";
type Achter =
  | "dropReject"
  | "unsupported"
  | "empty"
  | "parseError"
  | "extracting"
  | "wholeSaved"
  | "tooLargeForImport"
  | "wholeOpenMissing";
/** Wo der Satz auf der Fläche steht: die eine Live-Region der Dateiauswahl, `notice` oder `err`. */
type Traeger = "live-region" | "hinweisfeld" | "fehlerfeld";

interface Zeile {
  readonly key: Achter;
  readonly zustand: string;
  readonly traeger: Traeger;
  /** Zeigt eine zweite, beim Rendern übersetzte Stelle denselben Satz in der Zielsprache? */
  readonly zielspracheZusaetzlich: boolean;
}

const TXT = "MELDUNG.txt";
const BIN = "MELDUNG.bin";
const MELDUNGSFELD = '[data-testid="capture-datei-meldung"]';
const LIVE = 'output, [role="status"], [role="alert"], [role="log"], [aria-live]';

const ACHT: readonly Zeile[] = [
  {
    key: "dropReject",
    zustand: "Nicht unterstützte Datei (.bin) auf die Ablagefläche gezogen.",
    traeger: "live-region",
    zielspracheZusaetzlich: false,
  },
  {
    key: "unsupported",
    zustand: "Nicht unterstützte Datei (.bin) über den Dateieingang gewählt.",
    traeger: "live-region",
    zielspracheZusaetzlich: false,
  },
  {
    key: "empty",
    zustand: "Leere TXT eingelesen — weder Text noch Bilder.",
    traeger: "live-region",
    zielspracheZusaetzlich: false,
  },
  {
    key: "parseError",
    zustand: "Das Lesen der Datei wirft (readTextFile scheitert).",
    traeger: "live-region",
    zielspracheZusaetzlich: false,
  },
  {
    key: "extracting",
    zustand: "Einlesen läuft (Lesevorgang angehalten).",
    traeger: "hinweisfeld",
    zielspracheZusaetzlich: false,
  },
  {
    key: "wholeSaved",
    zustand: "Ganzdokument bewusst gespeichert, Antwort mit Entwurfskennung.",
    traeger: "hinweisfeld",
    zielspracheZusaetzlich: false,
  },
  {
    key: "tooLargeForImport",
    zustand: "Ganzdokument über der Client-Grenze (4,5 Mio. Zeichen) — Abbruch vor dem Upload.",
    // Nacharbeit 1 (R-0120): eine Ablehnung des Import-Wegs, also in die gemeinsame Region.
    traeger: "live-region",
    zielspracheZusaetzlich: false,
  },
  {
    key: "wholeOpenMissing",
    zustand: "Ganzdokument gespeichert, Antwort ohne Entwurfskennung (Karte übersetzt mit).",
    traeger: "fehlerfeld",
    zielspracheZusaetzlich: true,
  },
];

function parameter(key: Achter): Record<string, unknown> {
  if (key === "dropReject" || key === "unsupported") {
    return { name: BIN };
  }
  if (key === "tooLargeForImport" || key === "wholeOpenMissing") {
    return {};
  }
  return { name: TXT };
}

function falten(text: string | null): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

/** Der Satz in einer festen Sprache, Leerraum gefaltet wie bei `txt`. */
function satzIn(sprache: Sprache, key: Achter): string {
  return String(i18n.getFixedT(sprache)(T[key], parameter(key))).replace(/\s+/g, " ");
}

/** Alle Live-Regionen des Arbeitsraums, deren Text den Satz enthält. */
function liveTraeger(satz: string): Element[] {
  const alle = [...container.querySelectorAll(LIVE)];
  return alle.filter((el) => falten(el.textContent).includes(satz));
}

/** Der Text der EINEN Live-Region der Dateiauswahl (`CaptureFileImport.tsx`). */
function meldungsfeld(): string {
  const feld = container.querySelector(MELDUNGSFELD);
  return falten(feld ? feld.textContent : null);
}

async function spracheWechseln(sprache: Sprache): Promise<void> {
  await act(async () => {
    await i18n.changeLanguage(sprache);
    await flush();
  });
}

async function ganzes(): Promise<void> {
  await click(modusKarte(T.importModeWhole));
  await dateiEinlesen(TXT);
}

/** Führt genau den auslösenden Zustand herbei — über die echten Ereigniswege der Fläche. */
async function ausloesen(key: Achter): Promise<void> {
  await mount();
  switch (key) {
    case "dropReject":
      await dateiEinlesen(BIN);
      return;
    case "unsupported":
      // Der Drop lehnt vorher ab; der Dateieingang liefert die nicht unterstützte Systemauswahl.
      await act(async () => {
        const eingang = container.querySelector<HTMLInputElement>('input[type="file"]');
        expect(eingang).not.toBeNull();
        Object.defineProperty(eingang, "files", {
          configurable: true,
          value: [new File(["bin"], BIN, { type: "application/octet-stream" })],
        });
        eingang?.dispatchEvent(new Event("change", { bubbles: true }));
        await flush();
      });
      return;
    case "empty":
      await dateiEinlesen(TXT, "");
      return;
    case "parseError":
      bremse.fehler = true;
      await dateiEinlesen(TXT);
      return;
    case "extracting":
      await dateiEinlesenStarten(TXT);
      return;
    case "tooLargeForImport":
      await click(modusKarte(T.importModeWhole));
      await dateiEinlesen(TXT, "A".repeat(4_500_000));
      await click(buttonByText(txt(T.wholeCta)));
      expect(endpoints.objects.upload).not.toHaveBeenCalled();
      expect(endpoints.drafts.create).not.toHaveBeenCalled();
      // Die Ablehnung räumt nichts: die eingelesene Datei steht weiter zum Speichern bereit.
      expect(sichtbar()).toContain(txt(T.wholeSourceNote, { name: TXT }));
      return;
    case "wholeSaved":
    case "wholeOpenMissing":
      if (key === "wholeOpenMissing") {
        draftId.wert = null;
      }
      await ganzes();
      await click(buttonByText(txt(T.wholeCta)));
      expect(endpoints.drafts.create).toHaveBeenCalledTimes(1);
      return;
  }
}

async function aufloesen(): Promise<void> {
  if (bremse.loesen) {
    await dateiEinlesenBeenden();
  }
}

describe("K1 · die acht Meldungen: auslösender Zustand, Träger und DE/EN/NL", () => {
  for (const zeile of ACHT) {
    it(`Zuordnung · ${zeile.key} · ${zeile.zustand}`, async () => {
      const de = satzIn("de", zeile.key);
      // Drei eigene Sätze und kein Schlüssel-Rückfall — sonst prüfte der Sprachwechsel nichts.
      const saetze = [de, satzIn("en", zeile.key), satzIn("nl", zeile.key), T[zeile.key]];
      expect(new Set(saetze).size, `${zeile.key}: Übersetzung fehlt`).toBe(4);

      await ausloesen(zeile.key);
      expect(sichtbar(), `${zeile.key}: Satz nach dem Auslösen nicht sichtbar`).toContain(de);
      const imMeldungsfeld = meldungsfeld().includes(de);
      expect(imMeldungsfeld, `${zeile.key}: Träger`).toBe(zeile.traeger === "live-region");
      if (zeile.traeger === "live-region") {
        // R-0120: genau EINE Ansage — und derselbe Satz steht nicht ein zweites Mal sichtbar da.
        expect(liveTraeger(de), `${zeile.key}: Zahl der Ansagen`).toHaveLength(1);
        expect(pageText().split(de).length - 1, `${zeile.key}: doppelt auf der Fläche`).toBe(1);
      } else {
        // Gemessen, nicht gewertet: `notice` und `err` sind gewöhnliche Flächen ohne Ansage.
        expect(liveTraeger(de), `${zeile.key}: unerwartet angesagt`).toEqual([]);
      }
      await aufloesen();
    });
  }

  for (const zeile of ACHT) {
    it.fails(`BEFUND · ${zeile.key} · DE→EN→NL: der deutsche Satz bleibt`, async () => {
      const de = satzIn("de", zeile.key);
      const befund = `BEFUND ${zeile.key}: „${de}“ folgt weder EN noch NL`;
      await fehlerpin(befund, async () => {
        await ausloesen(zeile.key);
        expect(sichtbar()).toContain(de);
        let eingefroren = true;
        for (const sprache of ["en", "nl"] as const) {
          await spracheWechseln(sprache);
          const ziel = satzIn(sprache, zeile.key);
          const bleibt = sichtbar().includes(de);
          if (bleibt) {
            const zusaetzlich = sichtbar().includes(ziel);
            expect(zusaetzlich, `${zeile.key}/${sprache}`).toBe(zeile.zielspracheZusaetzlich);
          } else {
            expect(sichtbar()).toContain(ziel);
            expect(pageText()).not.toContain(de);
          }
          eingefroren = eingefroren && bleibt;
        }
        await aufloesen();
        return eingefroren;
      });
    });
  }
});

/** Eine Kachel, die keinen Import startet — sie meldet ihren ehrlichen Hinweis nach oben. */
function nichtImportierendeKachel(): HTMLElement {
  const kacheln = [...container.querySelectorAll<HTMLElement>("button[data-id][data-state]")];
  const kachel = kacheln.find((k) => k.getAttribute("data-state") !== "active");
  if (!kachel) {
    throw new Error("keine nicht-importierende Kachel im Arbeitsraum");
  }
  return kachel;
}

describe("K4 · R-0120 am ganzen Arbeitsraum: hörbar, einmal, die jüngste Ursache", () => {
  it("Ablehnung → Kachel → Ablehnung: genau EINE Ansage, die jüngste", async () => {
    await mount();
    const ablehnung = satzIn("de", "dropReject");
    await dateiEinlesen(BIN);
    expect(meldungsfeld()).toBe(ablehnung);
    expect(liveTraeger(ablehnung)).toHaveLength(1);

    await click(nichtImportierendeKachel());
    const hinweis = meldungsfeld();
    expect(hinweis.length, "der Kachelhinweis steht in keiner Ansage").toBeGreaterThan(0);
    expect(hinweis).not.toBe(ablehnung);
    expect(pageText(), "die ältere Ablehnung steht noch da").not.toContain(ablehnung);
    expect(liveTraeger(hinweis)).toHaveLength(1);

    await dateiEinlesen(BIN);
    expect(meldungsfeld()).toBe(ablehnung);
    expect(liveTraeger(hinweis), "der ältere Kachelhinweis wird weiter angesagt").toEqual([]);
  });

  // Nacharbeit 2 (Befund Ben): die Größenablehnung kommt NACH einem Kachelhinweis und muss ihn
  // ablösen — auch ein zweites Mal mit wortgleichem Satz.
  it("Kachelhinweis, dann Größenablehnung (zweimal): die jüngste Ursache gewinnt", async () => {
    await mount();
    await click(modusKarte(T.importModeWhole));
    await dateiEinlesen(TXT, "A".repeat(4_500_000));
    const zuGross = satzIn("de", "tooLargeForImport");
    const kachel = nichtImportierendeKachel();
    await click(kachel);
    const hinweis = meldungsfeld();
    expect(hinweis.length, "kein Kachelhinweis in der Region").toBeGreaterThan(0);
    expect(hinweis).not.toBe(zuGross);
    for (const runde of [1, 2]) {
      if (runde === 2) {
        // Dieselbe Kachel schliesst ihren Hinweis beim ersten Tippen und öffnet ihn beim zweiten.
        await click(kachel);
        await click(kachel);
        expect(meldungsfeld(), "Runde 2: Hinweis vor dem Speichern").toBe(hinweis);
      }
      await click(buttonByText(txt(T.wholeCta)));
      expect(meldungsfeld(), `Runde ${runde}: Region nach dem Speichern`).toBe(zuGross);
      expect(liveTraeger(hinweis), `Runde ${runde}: alter Hinweis angesagt`).toEqual([]);
      expect(liveTraeger(zuGross), `Runde ${runde}: Zahl der Ansagen`).toHaveLength(1);
      expect(pageText().split(zuGross).length - 1, `Runde ${runde}: doppelt`).toBe(1);
      expect(sichtbar()).toContain(txt(T.wholeSourceNote, { name: TXT }));
    }
    expect(endpoints.objects.upload).not.toHaveBeenCalled();
    expect(endpoints.drafts.create).not.toHaveBeenCalled();
  });

  it("eine danach unterstützte Datei räumt die Ansage", async () => {
    await mount();
    await dateiEinlesen(BIN);
    expect(meldungsfeld()).toBe(satzIn("de", "dropReject"));
    await dateiEinlesen(TXT);
    expect(meldungsfeld()).toBe("");
    expect(sichtbar()).toContain(txt(T.loadedStats, { name: TXT, chars: 240 }));
  });

  for (const sprache of ["en", "nl"] as const) {
    it(`${sprache} von Anfang an: die Ablehnung wird in ${sprache} angesagt`, async () => {
      await i18n.changeLanguage(sprache);
      await mount();
      await dateiEinlesen(BIN);
      expect(meldungsfeld()).toBe(satzIn(sprache, "dropReject"));
      expect(pageText()).not.toContain(satzIn("de", "dropReject"));
    });
  }
});

function folgtAuf(vorne: Node, hinten: Node): boolean {
  return (vorne.compareDocumentPosition(hinten) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

describe("K5 · R-0152: die Grenze steht vor der Auswahl — und folgt der Sprache", () => {
  it("vor Ablagefläche und Auswahlknopf, Werte der Serverquelle, DE/EN/NL", async () => {
    await mount();
    const zone = container.querySelector('[data-testid="capture-dropzone"]');
    const knopf = container.querySelector('[data-testid="capture-file-pick"]');
    const hinweis = zone ? zone.previousElementSibling : null;
    if (!zone || !knopf || !hinweis) {
      throw new Error("Ablagefläche, Auswahlknopf oder ihr Vorgänger fehlen im Arbeitsraum");
    }
    expect(hinweis.getAttribute("data-testid")).toBe("upload-limits-hint");
    expect(folgtAuf(hinweis, zone), "der Hinweis steht nicht vor der Ablagefläche").toBe(true);
    expect(folgtAuf(hinweis, knopf), "der Hinweis steht nicht vor dem Auswahlknopf").toBe(true);
    expect(hinweis.closest('[aria-hidden="true"], [hidden]')).toBeNull();

    const grenzen = await endpoints.uploadLimits.get();
    for (const sprache of ["de", "en", "nl"] as const) {
      await spracheWechseln(sprache);
      const erwartet = i18n.getFixedT(sprache)("capture.uploadLimits", {
        count: grenzen.maxAttachments,
        mb: transferLimitMb(grenzen.maxAttachmentBytes),
        raw: maxRawAttachmentMb(grenzen.maxAttachmentBytes),
      });
      expect(falten(hinweis.textContent), sprache).toBe(falten(String(erwartet)));
    }
  });
});
