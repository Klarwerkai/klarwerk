// ================================================================================================
// JOB 4228 — DIE PPTX-IMPORTQUITTUNG SAGT DIE WAHRHEIT.
// ================================================================================================
//
// AUSGANGSLAGE, AM BASISSTAND SELBST GELESEN: `SOURCE_LABELS.notePptx` behauptete in DE, EN und NL,
// Bilder gingen beim PowerPoint-Import verloren. Seit WP-D9 werden Folienbilder übernommen. Der
// Prüfer hat den Widerspruch fünf Runden in Folge gemeldet (`archiv/4203/runde-5/RUECKGABE.md:33`).
//
// RUNDE 2 — WAS BEN AN RUNDE 1 GEMESSEN HAT, UND WARUM ES DEN AUFBAU HIER ÄNDERT.
// Runde 1 hat die Verlustbehauptung durch eine Zusage unter Vorbehalt ersetzt: „Bilder je Folie
// übernommen, soweit vorhanden". BEN hat ein Deck mit einem BMP importiert — `imageCount=1`,
// `embeddedImages=0`, `droppedImageFormat=1` — und die Quittung versprach in allen drei Sprachen
// die Übernahme. Der Vorbehalt trennt „Datei ohne Bilder" von „Datei mit Bildern"; er trennt NICHT
// „Bild da und übernommen" von „Bild da und verworfen". Genau das ist der Fall, den der Import
// wirklich kennt (Format, Budget, defekter Verweis).
//
// DIE QUITTUNG SPRICHT DESHALB ÜBER BILDER NUR NOCH IN ZAHLEN, und diese Fälle rechnen die Zahlen
// gegen `embeddedImages`/`imageCount` des echten Imports. Ein Wort kann man hinbiegen, eine Zahl
// gegen eine Messung nicht.
//
// GEPRÜFT WIRD DER PERSISTIERTE BELEG, nicht das Label: der Satz wird aus dem `bodyHtml` gelesen,
// das `wholeDocumentDraftPayload` wirklich in den Entwurf schreibt — mit denselben Werten, die
// `Capture.tsx:1132` und `:1470` durchreichen (`html` = `fileRich.html`, `sourceImageCount` =
// `pptx.imageCount`). Ein Fall am Label vorbei wäre auch dann grün, wenn der Weg dorthin abrisse.
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { DraftPayload } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import {
  CAPTURE_FILE_TEXT,
  draftPayloadByteLength,
  draftPayloadWithinLimit,
  wholeDocumentDraftPayload,
  wholeDraftFitsWithObjectLink,
} from "../../apps/web/src/lib/captureFromFile";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  BILD_BASE64,
  BILD_BYTES,
  MARKE,
  type Messbefund,
  REFERENZ_PPTX,
  deckEintraege,
  messeDeckMitInhalt,
  messeReferenzdeck,
} from "./messung";
import {
  BILANZ_PRAEFIX,
  SPRACHEN,
  type Sprache,
  VORBEHALT,
  alsText,
  anspruch,
  bilanzAussage,
  grundsatz,
  widersprueche,
} from "./quittungspruefer";

/**
 * Die Quittung, wie sie WIRKLICH im gespeicherten Entwurf landet — aus dem `bodyHtml` des
 * Payloads gelesen, den `wholeDocumentDraftPayload` erzeugt, und zwar mit genau den Werten, die
 * die Oberfläche durchreicht. Abgeleitet, nicht abgeschrieben.
 */
function quittungAus(befund: Messbefund | null, sprache: Sprache): string {
  const payload = wholeDocumentDraftPayload({
    fileName: "beispiel.pptx",
    text: befund?.ergebnis.text || "Inhalt",
    ...(befund ? { html: befund.ergebnis.html } : {}),
    sourceKind: "pptx",
    locale: sprache,
    ...(befund ? { sourceImageCount: befund.ergebnis.imageCount } : {}),
  });
  const block = /<blockquote>([\s\S]*?)<\/blockquote>/.exec(payload.bodyHtml ?? "")?.[1] ?? "";
  const absaetze = [...block.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1] ?? "");
  return (absaetze[1] ?? "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

/** Der abgenommene Oberflächensatz — der Maßstab, an den der Grundsatz angeglichen ist. */
function oberflaechensatz(sprache: Sprache): string {
  return String(i18n.getResource(sprache, "translation", CAPTURE_FILE_TEXT.importNotePptx));
}

/**
 * JOB 4269 · DER ECHTE SPEICHERWEG — ein Entwurf hin und zurück über die Routen, die die
 * Oberfläche benutzt (`endpoints.ts:669` / `:660`), mit dem echten Server und seinem Sanitizer.
 *
 * Kein Ersatzspeicher, keine Attrappe: `buildApp(buildServices())` ist derselbe Zusammenbau, den
 * `tests/m5-docx-bildunterschriften/route.test.ts` für den Befund von JOB 3210 gefahren hat. Eine
 * Datenbank braucht er nicht — der Entwurfsspeicher ist in dieser Prüfumgebung im Arbeitsspeicher;
 * PostgreSQL wird hier also weder gebraucht noch behauptet.
 */
async function entwurfRundlauf(entwurf: DraftPayload): Promise<{ bodyHtml: string }> {
  const app = buildApp(buildServices());
  const zugang = {
    name: "Altbeleg",
    email: `job4269-${Math.random().toString(36).slice(2)}@klarwerk.test`,
    password: "secret123",
  };
  await app.inject({ method: "POST", url: "/api/auth/register", payload: zugang });
  const anmeldung = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: zugang.email, password: zugang.password },
  });
  const headers = { authorization: `Bearer ${(anmeldung.json() as { token: string }).token}` };

  const angelegt = await app.inject({
    method: "POST",
    url: "/api/drafts",
    headers,
    payload: entwurf,
  });
  expect(angelegt.statusCode, `POST /api/drafts: ${angelegt.body}`).toBeLessThan(300);

  const geladen = await app.inject({
    method: "GET",
    url: `/api/drafts/${(angelegt.json() as { id: string }).id}`,
    headers,
  });
  expect(geladen.statusCode, `GET /api/drafts/:id: ${geladen.body}`).toBe(200);
  const nutzlast = (geladen.json() as { payload: Record<string, unknown> }).payload;
  return { bodyHtml: (nutzlast.bodyHtml as string | undefined) ?? "" };
}

/** Der Wortlaut, mit dem die Quittung bis zum 16.09.2026 einen Bilderverlust behauptete. */
const ALTER_WORTLAUT: Readonly<Record<Sprache, string>> = {
  de: "Best-Effort-Import aus PowerPoint — Text und Struktur je Folie übernommen; Layout, Animationen, Übergänge, Bilder und Sprechernotizen gehen verloren.",
  en: "Best-effort import from PowerPoint — text and structure per slide carried over; layout, animations, transitions, images and speaker notes are lost.",
  nl: "Best-effort import uit PowerPoint — tekst en structuur per dia overgenomen; layout, animaties, overgangen, afbeeldingen en notities gaan verloren.",
};

/** Der Wortlaut aus RUNDE 1 — die pauschale Zusage, an der BEN den Verlustfall gemessen hat. */
const WORTLAUT_RUNDE1: Readonly<Record<Sprache, string>> = {
  de: "Best-Effort-Import aus PowerPoint — Text, Listen, Tabellen und Bilder je Folie übernommen, soweit vorhanden; Layout, Animationen, Übergänge und Sprechernotizen gehen verloren.",
  en: "Best-effort import from PowerPoint — text, lists, tables and images per slide carried over, where present; layout, animations, transitions and speaker notes are lost.",
  nl: "Best-effort import uit PowerPoint — tekst, lijsten, tabellen en afbeeldingen per dia overgenomen, voor zover aanwezig; layout, animaties, overgangen en notities gaan verloren.",
};

/**
 * JOB 4269 · Die pauschale Bildzusage, die der BEDIENHINWEIS auf der Oberfläche bis zum 17.09.2026
 * trug — je Sprache wörtlich, so wie sie in `i18n.ts` stand.
 *
 * Sie ist der Rest, den JOB 4228 offen gemeldet hat (`archiv/4228/runde-2/ben.md:22`): der Beleg am
 * Entwurf hatte die Bildzusage schon gestrichen, der Satz VOR dem Import versprach sie weiter. Ein
 * Mensch las damit vor dem Import eine Zusage, die derselbe Import danach zurücknahm.
 */
const PAUSCHALE_BILDZUSAGE: Readonly<Record<Sprache, string>> = {
  de: "und Bilder je Folie übernommen",
  en: "and images per slide carried over",
  nl: "en afbeeldingen per dia overgenomen",
};

let mitBild: Messbefund;
let mitBmp: Messbefund;
let mitBudgetverlust: Messbefund;
/** JOB 4269 · der Mischfall: ein Bild kommt an, eines geht verloren — beide Zahlen ungleich null. */
let mitMischverlust: Messbefund;
let referenz: Messbefund;

/** Eine Grenze, die das 4×4-PNG sicher überschreitet — derselbe Zweig, nur eine kleinere Zahl. */
const WINZIGES_BILDBUDGET = 16;

beforeAll(async () => {
  mitBild = await messeDeckMitInhalt("png");
  mitBmp = await messeDeckMitInhalt("bmp");
  mitBudgetverlust = await messeDeckMitInhalt("png", WINZIGES_BILDBUDGET);
  mitMischverlust = await messeDeckMitInhalt("misch");
  referenz = await messeReferenzdeck();
});

// ================================================================================================
// 1 · DIE MESSUNG — OHNE SIE KEIN TEXTVORSCHLAG (Lieferung 1)
// ================================================================================================
describe("JOB 4228 · 1 — was der PPTX-Import wirklich übernimmt", () => {
  it("das gebaute Deck ENTHÄLT alles, worüber die Quittung redet — sonst misst nichts etwas", () => {
    const eintraege = deckEintraege();
    const inhalt = (pfad: string) => new TextDecoder().decode(eintraege[pfad] ?? new Uint8Array());
    expect(Object.keys(eintraege)).toContain("ppt/media/bild4228.png");
    expect(inhalt("ppt/slides/_rels/slide1.xml.rels")).toContain("../media/bild4228.png");
    const folie1 = inhalt("ppt/slides/slide1.xml");
    expect(folie1).toContain(MARKE.folientitel);
    expect(folie1).toContain(MARKE.listenpunkt);
    expect(folie1).toContain(MARKE.uebergang);
    expect(folie1).toContain(MARKE.animation);
    expect(folie1).toContain(MARKE.layout);
    expect(inhalt("ppt/slides/slide2.xml")).toContain(MARKE.tabellenzelle);
    expect(inhalt("ppt/notesSlides/notesSlide1.xml")).toContain(MARKE.notiz);
    // RUNDE 2: dasselbe Deck mit BMP verweist auf DIESELBE eine Bildstelle — die Quelle hat in
    // beiden Fällen genau ein Bild. Der Unterschied liegt allein im Format.
    const bmp = deckEintraege("bmp");
    expect(Object.keys(bmp)).toContain("ppt/media/bild4228.bmp");
    expect(Object.keys(bmp)).not.toContain("ppt/media/bild4228.png");
  });

  it("FALL A — erfolgreicher Import: Text, Aufzählung, Tabelle, und das Bild mit seinen Bytes", () => {
    const { ergebnis, messung, bilanz } = mitBild;
    expect(ergebnis.slideCount).toBe(2);
    expect(ergebnis.html).toContain(`<h2>${MARKE.folientitel}</h2>`);
    expect(ergebnis.html).toContain(`<li>${MARKE.listenpunkt}</li>`);
    expect(ergebnis.tableCount).toBe(1);
    expect(ergebnis.html).toContain(MARKE.tabellenzelle);
    expect(ergebnis.html).toContain(`src="data:image/png;base64,${BILD_BASE64}"`);
    expect(bilanz).toEqual({ quelle: 1, imEntwurf: 1, fehlend: 0 });
    expect(messung.bilder).toBe("uebernommen");
  });

  it("FALL B — Formatverlust (BMP): das Bild IST da und kommt trotzdem nicht an", () => {
    const { ergebnis, bilanz } = mitBmp;
    // Genau BENs Messung — hier als eigener, dauerhafter Fall.
    expect(ergebnis.imageCount).toBe(1);
    expect(ergebnis.embeddedImages).toBe(0);
    expect(ergebnis.droppedImageFormat).toBe(1);
    expect(ergebnis.html).not.toContain("<figure>");
    expect(bilanz).toEqual({ quelle: 1, imEntwurf: 0, fehlend: 1 });
    // Der Text der Folien bleibt vollständig — es ist ein BILD-Verlust, kein Importfehler.
    expect(ergebnis.html).toContain(`<h2>${MARKE.folientitel}</h2>`);
  });

  it("FALL C — Budgetverlust: erlaubtes Format, aber zu groß für die Grenze", () => {
    const { ergebnis, bilanz } = mitBudgetverlust;
    expect(ergebnis.imageCount).toBe(1);
    expect(ergebnis.embeddedImages).toBe(0);
    expect(ergebnis.droppedImageBudget).toBe(1);
    expect(bilanz).toEqual({ quelle: 1, imEntwurf: 0, fehlend: 1 });
  });

  it("FALL E (JOB 4269) — Mischfall: ein Bild kommt an, eines geht verloren", () => {
    const { ergebnis, messung, bilanz } = mitMischverlust;
    // Zwei Bildverweise auf derselben Folie, zwei verschiedene Dateien in der Quelle.
    expect(Object.keys(deckEintraege("misch"))).toContain("ppt/media/bild4228.png");
    expect(Object.keys(deckEintraege("misch"))).toContain("ppt/media/bild4269-verworfen.bmp");
    expect(ergebnis.imageCount).toBe(2);
    expect(ergebnis.embeddedImages).toBe(1);
    expect(ergebnis.droppedImageFormat).toBe(1);
    expect(bilanz).toEqual({ quelle: 2, imEntwurf: 1, fehlend: 1 });
    // Das ANGEKOMMENE Bild ist wirklich da, mit seinen Bytes — sonst prüfte die Zahl „1
    // übernommen" gegen nichts.
    expect(ergebnis.html).toContain(`src="data:image/png;base64,${BILD_BASE64}"`);
    // … und über die Datei als Ganzes wird deshalb NICHT „übernommen" gesagt.
    expect(messung.bilder).toBe("verloren");
  });

  it("FALL D — die vorhandene Referenzdatei aus JOB 4203 trägt KEIN Bild", () => {
    const { ergebnis, messung, bilanz } = referenz;
    expect(ergebnis.slideCount).toBe(3);
    expect(bilanz).toEqual({ quelle: 0, imEntwurf: 0, fehlend: 0 });
    expect(ergebnis.tableCount).toBe(0);
    // KEIN BILD IN DER QUELLE HEISST NICHT „BILDERVERLUST".
    expect(messung.bilder).toBe("nichtInQuelle");
    expect(messung.tabellen).toBe("nichtInQuelle");
    expect(messung.text).toBe("uebernommen");
    expect(messung.listen).toBe("uebernommen");
    expect(messung.notizen).toBe("verloren");
  });

  it("VERLOREN in jedem Fall: Sprechernotiz, Übergang, Animation, Layoutangaben", () => {
    const { ergebnis, messung } = mitBild;
    for (const marke of [MARKE.notiz, MARKE.uebergang, MARKE.animation, MARKE.layout]) {
      expect(ergebnis.html, `Marke im HTML gelandet: ${marke}`).not.toContain(marke);
      expect(ergebnis.text, `Marke im Klartext gelandet: ${marke}`).not.toContain(marke);
    }
    expect(messung.notizen).toBe("verloren");
    expect(messung.uebergaenge).toBe("verloren");
    expect(messung.animationen).toBe("verloren");
    expect(messung.layout).toBe("verloren");
  });
});

// ================================================================================================
// 2 · DIE QUITTUNG GEGEN DIE MESSUNG — ALLE VIER FÄLLE, ALLE DREI SPRACHEN
// ================================================================================================
describe("JOB 4228 · 2 — keine Aussage der Quittung widerspricht dem gemessenen Import", () => {
  const faelle = () =>
    [
      ["A erfolgreicher Import", () => mitBild],
      ["B Formatverlust (BMP)", () => mitBmp],
      ["C Budgetverlust", () => mitBudgetverlust],
      ["D bildlose Referenzdatei", () => referenz],
      ["E Mischverlust (PNG an, BMP verworfen)", () => mitMischverlust],
    ] as const;

  for (const sprache of SPRACHEN) {
    for (const [name, hole] of faelle()) {
      it(`${sprache} · ${name}: kein Widerspruch`, () => {
        const befund = hole();
        const satz = quittungAus(befund, sprache);
        const gefunden = widersprueche(satz, sprache, befund.messung, befund.bilanz);
        expect(alsText(gefunden), `Quittung «${satz}»`).toBe("");
      });
    }

    it(`${sprache}: die ECHTEN Verluste bleiben benannt (Layout, Animationen, Übergänge, Notizen)`, () => {
      const satz = quittungAus(mitBild, sprache);
      for (const merkmal of ["layout", "animationen", "uebergaenge", "notizen"] as const) {
        expect(anspruch(satz, sprache, merkmal), `${sprache}/${merkmal}`).toBe("verloren");
      }
    });

    it(`${sprache}: über Formen wird NICHTS gesagt — weder Übernahme noch Verlust (Lieferung 4)`, () => {
      expect(anspruch(quittungAus(mitBild, sprache), sprache, "formen")).toBe("keine");
    });

    it(`${sprache}: der Grundsatz selbst verspricht Bilder NICHT MEHR pauschal`, () => {
      // Die Bildaussage darf nur noch aus dem Bilanzsatz kommen. Stünde „Bilder" wieder im
      // Grundsatz, wäre der Fall „vorhanden, aber verworfen" wieder falsch bequittiert.
      const grund = grundsatz(quittungAus(mitBild, sprache), sprache);
      expect(anspruch(grund, sprache, "bilder"), `Grundsatz «${grund}»`).toBe("keine");
    });
  }

  it("A: die Quittung nennt das eine übernommene Bild, und nennt nichts Fehlendes", () => {
    for (const sprache of SPRACHEN) {
      const aussage = bilanzAussage(quittungAus(mitBild, sprache), sprache);
      expect(aussage, sprache).toEqual({ imEntwurf: 1, fehlend: null });
    }
  });

  it("B und C: die Quittung sagt ausdrücklich, dass ein Bild NICHT übernommen wurde", () => {
    for (const befund of [mitBmp, mitBudgetverlust]) {
      for (const sprache of SPRACHEN) {
        const satz = quittungAus(befund, sprache);
        expect(bilanzAussage(satz, sprache), `${befund.datei}/${sprache}`).toEqual({
          imEntwurf: 0,
          fehlend: 1,
        });
      }
    }
  });

  it("E (JOB 4269): der Mischfall nennt BEIDE Zahlen — 1 angekommen, 1 nicht", () => {
    for (const sprache of SPRACHEN) {
      const satz = quittungAus(mitMischverlust, sprache);
      expect(bilanzAussage(satz, sprache), sprache).toEqual({ imEntwurf: 1, fehlend: 1 });
    }
  });

  it("D: über eine Datei ohne Bilder sagt die Quittung zu Bildern GAR NICHTS", () => {
    for (const sprache of SPRACHEN) {
      const satz = quittungAus(referenz, sprache);
      expect(satz, sprache).not.toContain(BILANZ_PRAEFIX[sprache]);
      expect(bilanzAussage(satz, sprache), sprache).toBeNull();
    }
  });

  it("ohne jede Bildangabe (Aufrufer ohne HTML) bleibt der Satz derselbe wie bei 0 Bildern", () => {
    // WICHTIG für die abgenommenen Wege: `persistierterFormathinweis` (d3-Bühne) leitet den Satz
    // OHNE Bildangaben ab und vergleicht ihn mit dem, was im Entwurf steht. Beide Wege müssen
    // deshalb bei einer bildlosen Datei zeichengleich sein.
    for (const sprache of SPRACHEN) {
      expect(quittungAus(null, sprache), sprache).toBe(quittungAus(referenz, sprache));
    }
  });
});

// ================================================================================================
// 3 · KALIBRIERUNG — EIN PRÜFER, DER NICHT ZUBEISST, PRÜFT NUR ZEICHENKETTEN (Auftrag §7)
// ================================================================================================
describe("JOB 4228 · 3 — Kalibrierung: falsche Quittungen MÜSSEN auffallen", () => {
  for (const sprache of SPRACHEN) {
    it(`${sprache}: der ALTE Wortlaut („Bilder … gehen verloren") wird erkannt`, () => {
      // Der alte Satz hat keinen Bilanzsatz; gemessen ist ein übernommenes Bild.
      const gefunden = widersprueche(
        ALTER_WORTLAUT[sprache],
        sprache,
        mitBild.messung,
        mitBild.bilanz,
      );
      expect(
        gefunden.map((w) => w.merkmal),
        `Satz «${ALTER_WORTLAUT[sprache]}»`,
      ).toContain("bilder");
    });

    it(`${sprache}: der Wortlaut aus RUNDE 1 fällt am BMP-Fall auf — BENs Befund, dauerhaft`, () => {
      // Das ist der Kern dieser Runde: „Bilder … übernommen, soweit vorhanden" an einer Datei,
      // deren einziges Bild verworfen wurde. Runde 1 war hier grün. Jetzt nicht mehr.
      const gefunden = widersprueche(
        WORTLAUT_RUNDE1[sprache],
        sprache,
        mitBmp.messung,
        mitBmp.bilanz,
      );
      const bilder = gefunden.find((w) => w.merkmal === "bilder");
      expect(bilder, `Satz «${WORTLAUT_RUNDE1[sprache]}»`).toBeDefined();
      expect(bilder?.grund).toContain("verschweigt");
    });

    it(`${sprache}: eine zu hohe Bildzahl in der Quittung fällt auf`, () => {
      const satz = quittungAus(mitBild, sprache).replace(
        `${BILANZ_PRAEFIX[sprache]} 1`,
        `${BILANZ_PRAEFIX[sprache]} 7`,
      );
      const gefunden = widersprueche(satz, sprache, mitBild.messung, mitBild.bilanz);
      expect(gefunden.map((w) => w.grund).join(" "), `Satz «${satz}»`).toContain(
        "der Import hat 1 eingebettet",
      );
    });

    it(`${sprache}: ein verschwiegener Bildverlust fällt auf — Bilanzsatz gestrichen`, () => {
      const voll = quittungAus(mitBmp, sprache);
      const satz = grundsatz(voll, sprache);
      const gefunden = widersprueche(satz, sprache, mitBmp.messung, mitBmp.bilanz);
      expect(gefunden.map((w) => w.grund).join(" "), `Satz «${satz}»`).toContain("verschweigt");
    });

    it(`${sprache}: eine Übernahmezusage für Animationen wird als Widerspruch erkannt`, () => {
      const wortlaut = { de: "Animationen", en: "animations", nl: "animaties" }[sprache];
      const satz = verschiebeInUebernahme(quittungAus(mitBild, sprache), wortlaut);
      expect(anspruch(satz, sprache, "animationen"), `Satz «${satz}»`).toBe("uebernommen");
      const gefunden = widersprueche(satz, sprache, mitBild.messung, mitBild.bilanz);
      expect(
        gefunden.map((w) => w.merkmal),
        `Satz «${satz}»`,
      ).toContain("animationen");
    });

    it(`${sprache}: eine Zusage über FORMEN fällt auf — sie wurde nie gemessen`, () => {
      const satz = quittungAus(mitBild, sprache).replace(
        VORBEHALT[sprache],
        `${VORBEHALT[sprache]}, ${{ de: "Formen", en: "shapes", nl: "vormen" }[sprache]}`,
      );
      const gefunden = widersprueche(satz, sprache, mitBild.messung, mitBild.bilanz);
      expect(gefunden.find((w) => w.merkmal === "formen")?.gemessen, `Satz «${satz}»`).toBe(
        "ungemessen",
      );
    });

    it(`${sprache}: ein gestrichener Sprechernotizen-Verlust fällt auf`, () => {
      const wortlaut = { de: "Sprechernotizen", en: "speaker notes", nl: "notities" }[sprache];
      const satz = quittungAus(mitBild, sprache).replace(
        new RegExp(`(,| und| and| en)?\\s*${wortlaut}`, "u"),
        "",
      );
      const gefunden = widersprueche(satz, sprache, mitBild.messung, mitBild.bilanz);
      const notizen = gefunden.find((w) => w.merkmal === "notizen");
      expect(notizen?.behauptet, `Satz «${satz}»`).toBe("keine");
      expect(notizen?.gemessen).toBe("verloren");
    });
  }

  it("ein Satz ohne die erwartete Form geht NICHT still durch — der Prüfer wirft", () => {
    expect(() => widersprueche("Alles wurde übernommen.", "de", mitBild.messung)).toThrow(
      /Strichpunkt/u,
    );
    expect(() =>
      widersprueche("Text übernommen; Layout bleibt erhalten.", "de", mitBild.messung),
    ).toThrow(/Verlust-Verb/u);
    // Und ein Bilanzsatz ohne Zahl ebenfalls nicht.
    expect(() => bilanzAussage("Folienbilder: viele übernommen.", "de")).toThrow(/keine Zahl/u);
  });

  it("ohne Bilanz urteilt der Prüfer über Bilder GAR NICHT — statt zu raten", () => {
    // Ein Urteil ohne Grundlage wäre derselbe Fehler, den dieser Prüfer finden soll.
    const satz = quittungAus(mitBild, "de");
    expect(widersprueche(satz, "de", mitBild.messung).map((w) => w.merkmal)).not.toContain(
      "bilder",
    );
  });
});

/**
 * Ein Wort aus der Verlusthälfte in die Übernahmehälfte VERSCHIEBEN — der Handgriff der
 * Kalibrierung. Eine Zusage, die daneben weiter als Verlust steht, wäre keine falsche Quittung,
 * sondern eine widersprüchliche; geprüft werden soll aber die falsche.
 */
function verschiebeInUebernahme(satz: string, wortlaut: string): string {
  const [vorne, hinten] = satz.split(";");
  const ohne = (hinten ?? "").replace(new RegExp(`\\s*,?\\s*(und |and |en )?${wortlaut}`, "u"), "");
  return `${vorne}, ${wortlaut}; ${ohne.trim()}`;
}

// ================================================================================================
// 4 · JOB 4269 · DER BEDIENHINWEIS SAGT DASSELBE WIE DER BELEG — IN DREI SPRACHEN, IN EINEM FALL
// ================================================================================================
//
// RED-FIRST (Auftrag JOB 4269 §6): Am unveränderten `main` (e475b31) ist der erste Fall unten ROT,
// und zwar mit ALLEN DREI Sprachnamen in der Fehlermeldung — `capture.file.importNote.pptx` trug
// in de, en und nl noch die pauschale Bildzusage. Genau EIN Fall prüft alle drei; eine berichtigte
// und zwei stehengebliebene Fassungen fallen damit auf, statt sich hinter zwei grünen Fällen zu
// verstecken (Lehre aus 4228 R2: „in allen drei Sprachen ersetzt").
describe("JOB 4269 · 4 — Bedienhinweis und Beleg sagen über Bilder dasselbe: nichts", () => {
  it("de, en UND nl in EINEM Fall: keine pauschale Bildzusage, derselbe Vorbehalt, keine Zahlen", () => {
    const befunde: string[] = [];
    for (const sprache of SPRACHEN) {
      const flaeche = oberflaechensatz(sprache);
      if (flaeche.includes(PAUSCHALE_BILDZUSAGE[sprache])) {
        befunde.push(
          `${sprache}: der Bedienhinweis verspricht weiterhin pauschal «${PAUSCHALE_BILDZUSAGE[sprache]}»`,
        );
      }
      // Nicht nur die Zeichenkette, sondern die AUSSAGE: der Satz darf über Bilder weder eine
      // Übernahme zusagen noch einen Verlust behaupten. Beides wäre eine Aussage ohne Datei.
      const ueberBilder = anspruch(flaeche, sprache, "bilder");
      if (ueberBilder !== "keine") {
        befunde.push(
          `${sprache}: der Bedienhinweis sagt über Bilder «${ueberBilder}» statt nichts`,
        );
      }
      if (!flaeche.includes(VORBEHALT[sprache])) {
        befunde.push(`${sprache}: der Vorbehalt «${VORBEHALT[sprache]}» fehlt im Bedienhinweis`);
      }
      // Die ZAHLEN bleiben allein beim Beleg: ein Bedienhinweis steht vor dem Import und kennt
      // keine bestimmte Datei — er kann über deren Bilder gar nichts wissen.
      if (flaeche.includes(BILANZ_PRAEFIX[sprache])) {
        befunde.push(`${sprache}: der Bedienhinweis nennt Bildzahlen, die ihm nicht zustehen`);
      }
    }
    expect(befunde.join(" · ")).toBe("");
  });

  for (const sprache of SPRACHEN) {
    it(`${sprache}: Bedienhinweis und Grundsatz des Belegs sind zeichengleich`, () => {
      // Seit JOB 4269 gibt es keinen benannten Unterschied mehr: was vor dem Import zugesagt wird,
      // steht danach wortgleich im Beleg. Die Bildbilanz kommt als EIGENER Satz dahinter und ist
      // deshalb nicht Teil des Grundsatzes.
      expect(oberflaechensatz(sprache), `Oberflächensatz ${sprache}`).toBe(
        grundsatz(quittungAus(mitBild, sprache), sprache),
      );
    });
  }

  it("der Unterschied ist im Quelltext begründet, in allen drei Sprachen", () => {
    const lib = readFileSync(resolve(process.cwd(), "apps/web/src/lib/captureFromFile.ts"), "utf8");
    expect(lib).toContain("JOB 4228");
    for (const sprache of SPRACHEN) {
      expect(lib, `Vorbehalt fehlt in ${sprache}`).toContain(VORBEHALT[sprache]);
      expect(lib, `Bilanzsatz fehlt in ${sprache}`).toContain(BILANZ_PRAEFIX[sprache]);
    }
  });

  it("nirgends im Produktcode steht noch eine PPTX-Bilderverlust-Behauptung (Ablösung, §8.7)", () => {
    const lib = readFileSync(resolve(process.cwd(), "apps/web/src/lib/captureFromFile.ts"), "utf8");
    const i18nQuelle = readFileSync(resolve(process.cwd(), "apps/web/src/i18n.ts"), "utf8");
    for (const quelle of [lib, i18nQuelle]) {
      expect(quelle).not.toContain("Bilder und Sprechernotizen gehen verloren");
      expect(quelle).not.toContain("images and speaker notes are lost");
      expect(quelle).not.toContain("afbeeldingen en notities gaan verloren");
    }
  });

  // JOB 4269 · Lieferung 5, erste Hälfte: der pauschale Oberflächensatz wird ERSETZT, nicht
  // ergänzt. Der Katalog darf die Bildzusage danach nirgends mehr tragen — auch nicht in einem
  // zweiten, vergessenen Schlüssel. Deshalb wird die GANZE Datei gelesen, nicht nur der eine Wert.
  it("JOB 4269 · der pauschale Oberflächensatz kommt in i18n.ts nicht mehr vor, in keiner Sprache", () => {
    const i18nQuelle = readFileSync(resolve(process.cwd(), "apps/web/src/i18n.ts"), "utf8");
    for (const sprache of SPRACHEN) {
      expect(i18nQuelle, `pauschale Bildzusage steht noch in ${sprache}`).not.toContain(
        PAUSCHALE_BILDZUSAGE[sprache],
      );
    }
  });
});

// ================================================================================================
// 5 · NUR NEUE QUITTUNGEN — ALTE BELEGE BLEIBEN ALTE BELEGE (Lieferung 5)
// ================================================================================================
describe("JOB 4228 · 5 — ein gespeicherter Beleg wird nicht umgeschrieben", () => {
  /** Ein Entwurf, wie er vor dem 16.09.2026 gespeichert wurde — mit dem alten Wortlaut im Rumpf. */
  function historischerEntwurf(): DraftPayload {
    return {
      ...wholeDocumentDraftPayload({
        fileName: "altes-deck.pptx",
        text: "Inhalt von damals",
        sourceKind: "pptx",
        locale: "de",
      }),
      bodyHtml: [
        "<blockquote><p>Quelle: altes-deck.pptx, gesamtes Dokument</p>",
        `<p>${ALTER_WORTLAUT.de}</p></blockquote><p>Inhalt von damals</p>`,
      ].join(""),
    };
  }

  it("die Funktionen, die einen fertigen Entwurf anfassen, lassen seinen Rumpf unberührt", () => {
    const entwurf = historischerEntwurf();
    const vorher = entwurf.bodyHtml ?? "";
    draftPayloadByteLength(entwurf);
    draftPayloadWithinLimit(entwurf);
    wholeDraftFitsWithObjectLink(entwurf, "altes-deck.pptx");
    expect(entwurf.bodyHtml).toBe(vorher);
    expect(entwurf.bodyHtml).toContain(ALTER_WORTLAUT.de);
  });

  it("es gibt keine Migration: der alte Wortlaut kommt im Produktcode nicht mehr vor", () => {
    const lib = readFileSync(resolve(process.cwd(), "apps/web/src/lib/captureFromFile.ts"), "utf8");
    const i18nQuelle = readFileSync(resolve(process.cwd(), "apps/web/src/i18n.ts"), "utf8");
    for (const quelle of [lib, i18nQuelle]) {
      expect(quelle).not.toContain(ALTER_WORTLAUT.de);
      expect(quelle).not.toContain("Text und Struktur je Folie übernommen");
    }
  });

  // ==============================================================================================
  // JOB 4269 · LIEFERUNG 2 — DER HISTORISCHE BELEG ÜBERSTEHT DEN ECHTEN SPEICHER-RUNDLAUF.
  // ==============================================================================================
  //
  // BENs Prüflücke, wörtlich (`archiv/4228/runde-2/ben.md:24`): „Der Altbelegtest prüft weiterhin
  // Größenhelfer statt Persistenz." Der Fall oben ruft `draftPayloadByteLength` &c. auf einem
  // Objekt im ARBEITSSPEICHER auf — der Entwurf wird nie gespeichert und nie zurückgelesen. Eine
  // Migration, die beim SPEICHERN oder beim ZURÜCKLESEN zuschlüge, hätte er nie bemerkt.
  //
  // Hier läuft deshalb der Weg, den die Oberfläche wirklich benutzt, mit dem echten Server:
  //
  //     POST /api/drafts  (endpoints.ts:669, capture-routes.ts)
  //         → Server-Sanitizer → Ablage
  //         → GET /api/drafts/:id  (endpoints.ts:660)  → `payload.bodyHtml`
  //
  // Verglichen wird ZEICHENGLEICH, nicht „enthält": eine Migration, die nur ein Wort austauschte,
  // bliebe einem `toContain` verborgen.
  it("JOB 4269 · gespeichert und zurückgelesen: derselbe Rumpf, Zeichen für Zeichen", async () => {
    const entwurf = historischerEntwurf();
    const hingeschickt = entwurf.bodyHtml ?? "";
    const zurueck = await entwurfRundlauf(entwurf);

    expect(
      zurueck.bodyHtml,
      "der Rumpf hat den Speicher-Rundlauf nicht unverändert überstanden",
    ).toBe(hingeschickt);
    // … und er trägt noch immer den Wortlaut von damals, nicht den von heute.
    expect(zurueck.bodyHtml).toContain(ALTER_WORTLAUT.de);
    expect(zurueck.bodyHtml).not.toContain(VORBEHALT.de);
    expect(zurueck.bodyHtml).not.toContain(BILANZ_PRAEFIX.de);
  });

  // Die Kalibrierung zum Fall darüber: WÜRDE der Rundlauf den Rumpf umschreiben, fiele es auf.
  // Ohne sie wäre der Vergleich auch dann grün, wenn Hin- und Rückweg bloss dieselbe Zeichenkette
  // durchreichten, ohne sie je zu speichern.
  it("JOB 4269 · Kalibrierung: ein GEÄNDERTER Rumpf kommt auch geändert zurück", async () => {
    const entwurf = historischerEntwurf();
    const verstellt: DraftPayload = {
      ...entwurf,
      // Der HEUTIGE Grundsatz, aus dem Produkt abgeleitet statt abgeschrieben.
      bodyHtml: (entwurf.bodyHtml ?? "").replace(
        ALTER_WORTLAUT.de,
        grundsatz(quittungAus(null, "de"), "de"),
      ),
    };
    const zurueck = await entwurfRundlauf(verstellt);
    expect(zurueck.bodyHtml).not.toBe(entwurf.bodyHtml);
    expect(zurueck.bodyHtml).toContain(VORBEHALT.de);
    expect(zurueck.bodyHtml).not.toContain(ALTER_WORTLAUT.de);
  });

  it("neue Entwürfe tragen den neuen Satz — der Wechsel wirkt ab jetzt, nicht rückwirkend", () => {
    const neu = wholeDocumentDraftPayload({
      fileName: "neues-deck.pptx",
      text: "Inhalt von heute",
      html: mitBild.ergebnis.html,
      sourceKind: "pptx",
      locale: "de",
      sourceImageCount: mitBild.ergebnis.imageCount,
    });
    expect(neu.bodyHtml).toContain(VORBEHALT.de);
    expect(neu.bodyHtml).toContain(BILANZ_PRAEFIX.de);
    expect(neu.bodyHtml).not.toContain("Bilder und Sprechernotizen gehen verloren");
    expect(historischerEntwurf().bodyHtml).toContain(ALTER_WORTLAUT.de);
  });
});

// ================================================================================================
// 6 · DIE ANDEREN IMPORTARTEN BLEIBEN UNBERÜHRT (Auftrag §8.6, Prüflücke c)
// ================================================================================================
describe("JOB 4228 · 6 — docx, pdf und text sagen weiter, was sie sagten", () => {
  const ERWARTET: Readonly<Record<"docx" | "pdf" | "text", string>> = {
    docx: "capture.file.importNote.docx",
    pdf: "capture.file.importNote.pdf",
    text: "capture.file.importNote.text",
  };

  for (const sprache of SPRACHEN) {
    for (const art of ["docx", "pdf", "text"] as const) {
      it(`${sprache}/${art}: die Quittung ist unverändert der Oberflächensatz`, () => {
        const payload = wholeDocumentDraftPayload({
          fileName: `beispiel.${art}`,
          text: "Inhalt",
          sourceKind: art,
          locale: sprache,
        });
        const erwartet = String(i18n.getResource(sprache, "translation", ERWARTET[art]));
        expect(payload.bodyHtml).toContain(
          erwartet
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;"),
        );
      });
    }
  }

  it("auch mit Bildern im HTML bekommt DOCX KEINEN Bilanzsatz — die Bilanz gilt dem PPTX-Beleg", () => {
    const payload = wholeDocumentDraftPayload({
      fileName: "beispiel.docx",
      text: "Inhalt",
      html: mitBild.ergebnis.html,
      sourceKind: "docx",
      locale: "de",
      sourceImageCount: 1,
    });
    expect(payload.bodyHtml).not.toContain(BILANZ_PRAEFIX.de);
  });

  it("ohne angegebene Dateiart steht weiterhin GAR KEIN Formathinweis da", () => {
    const payload = wholeDocumentDraftPayload({ fileName: "x", text: "y", locale: "de" });
    const block = /<blockquote>([\s\S]*?)<\/blockquote>/.exec(payload.bodyHtml ?? "")?.[1] ?? "";
    expect([...block.matchAll(/<p>/g)]).toHaveLength(1);
  });
});

// ================================================================================================
// 7 · DIE MESSTABELLE — DIE ZAHLEN, DIE IN DER RÜCKGABE ZITIERT WERDEN
// ================================================================================================
describe("JOB 4228 · 7 — die Messtabelle, an einem Stück", () => {
  it("jede Zeile der Rückgabe hat hier ihren Beleg", () => {
    const zeile = (name: string, b: Messbefund) =>
      [
        `${name}: Folien=${b.ergebnis.slideCount} Tabellen=${b.ergebnis.tableCount} | `,
        `Bilder Quelle=${b.bilanz.quelle} im Entwurf=${b.bilanz.imEntwurf} fehlend=${b.bilanz.fehlend} `,
        `(Format=${b.ergebnis.droppedImageFormat} Budget=${b.ergebnis.droppedImageBudget}) | `,
        `text=${b.messung.text} listen=${b.messung.listen} tabellen=${b.messung.tabellen} `,
        `layout=${b.messung.layout} animationen=${b.messung.animationen} `,
        `uebergaenge=${b.messung.uebergaenge} notizen=${b.messung.notizen} formen=${b.messung.formen}`,
      ].join("");
    expect([
      zeile("A png", mitBild),
      zeile("B bmp", mitBmp),
      zeile("C budget", mitBudgetverlust),
      zeile(`D ${REFERENZ_PPTX}`, referenz),
      zeile("E misch", mitMischverlust),
    ]).toEqual([
      "A png: Folien=2 Tabellen=1 | Bilder Quelle=1 im Entwurf=1 fehlend=0 (Format=0 Budget=0) | " +
        "text=uebernommen listen=uebernommen tabellen=uebernommen layout=verloren " +
        "animationen=verloren uebergaenge=verloren notizen=verloren formen=ungemessen",
      "B bmp: Folien=2 Tabellen=1 | Bilder Quelle=1 im Entwurf=0 fehlend=1 (Format=1 Budget=0) | " +
        "text=uebernommen listen=uebernommen tabellen=uebernommen layout=verloren " +
        "animationen=verloren uebergaenge=verloren notizen=verloren formen=ungemessen",
      "C budget: Folien=2 Tabellen=1 | Bilder Quelle=1 im Entwurf=0 fehlend=1 (Format=0 Budget=1) | " +
        "text=uebernommen listen=uebernommen tabellen=uebernommen layout=verloren " +
        "animationen=verloren uebergaenge=verloren notizen=verloren formen=ungemessen",
      [
        `D ${REFERENZ_PPTX}: Folien=3 Tabellen=0 | `,
        "Bilder Quelle=0 im Entwurf=0 fehlend=0 (Format=0 Budget=0) | ",
        "text=uebernommen listen=uebernommen tabellen=nichtInQuelle layout=nichtInQuelle ",
        "animationen=nichtInQuelle uebergaenge=nichtInQuelle notizen=verloren formen=ungemessen",
      ].join(""),
      // JOB 4269 · der Mischfall: zwei Bilder in der Quelle, eines angekommen, eines verworfen.
      "E misch: Folien=2 Tabellen=1 | Bilder Quelle=2 im Entwurf=1 fehlend=1 (Format=1 Budget=0) | " +
        "text=uebernommen listen=uebernommen tabellen=uebernommen layout=verloren " +
        "animationen=verloren uebergaenge=verloren notizen=verloren formen=ungemessen",
    ]);
  });

  it("die Quittungssätze, wie sie im Entwurf stehen — wörtlich", () => {
    expect([
      quittungAus(mitBild, "de"),
      quittungAus(mitBmp, "de"),
      quittungAus(referenz, "de"),
      quittungAus(mitMischverlust, "de"),
    ]).toEqual([
      "Best-Effort-Import aus PowerPoint — Text, Listen und Tabellen je Folie übernommen, soweit vorhanden; Layout, Animationen, Übergänge und Sprechernotizen gehen verloren. Folienbilder: 1 übernommen.",
      "Best-Effort-Import aus PowerPoint — Text, Listen und Tabellen je Folie übernommen, soweit vorhanden; Layout, Animationen, Übergänge und Sprechernotizen gehen verloren. Folienbilder: 0 übernommen, 1 nicht übernommen.",
      "Best-Effort-Import aus PowerPoint — Text, Listen und Tabellen je Folie übernommen, soweit vorhanden; Layout, Animationen, Übergänge und Sprechernotizen gehen verloren.",
      "Best-Effort-Import aus PowerPoint — Text, Listen und Tabellen je Folie übernommen, soweit vorhanden; Layout, Animationen, Übergänge und Sprechernotizen gehen verloren. Folienbilder: 1 übernommen, 1 nicht übernommen.",
    ]);
  });

  it("das Testbild ist ein echtes PNG — die Bytes im Entwurf sind die Bytes der Datei", () => {
    expect([...BILD_BYTES.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(Buffer.from(BILD_BASE64, "base64").equals(Buffer.from(BILD_BYTES))).toBe(true);
  });
});
