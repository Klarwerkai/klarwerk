// @vitest-environment jsdom
// ================================================================================================
// JOB 2923 · D1 — STATION 1: IST-STAND-BEWEISLAUF FÜR DIE VORFÜHRUNGSVORBEREITUNG.
// ================================================================================================
//
// WAS DIESE DATEI IST — und was sie ausdrücklich NICHT ist:
//
//   Sie ist ein BEWEIS DES HEUTIGEN IST-ZUSTANDS. Zwei echte `.docx`-Dateien werden durch den
//   echten Import geschoben, und protokolliert wird, was WIRKLICH im gespeicherten Entwurf
//   ankommt und was das Panel dem Menschen dazu meldet.
//
//   Sie ist KEIN Nachweis einer Reparatur. Station 1 ist heute NICHT behoben. Es existiert
//   KEIN Patch, der EMF/WMF-Bilder rettet — JOB 2912 D2 kam zu „kein Patch", D4 stufte das auf
//   „UNKLAR — kein Patch" zurück und änderte ausdrücklich keinen Code. Die offene Frage (gibt
//   `InlinePicture.getBase64ImageSrc()` bei einem Metafile ein Rasterbild heraus?) braucht einen
//   Menschen mit geladenem Word-Add-in und ist in dieser Werkstattklasse nicht messbar.
//
//   Der EINZIGE Code-Eingriff, auf dem dieser Lauf steht, ist der D1-Teil-Fix in
//   `services/app/src/routes/capture-routes.ts`: die Bildbilanz wird auf dem GESPEICHERTEN Stand
//   gezogen statt auf dem Stand vor dem Sanitizer. Er rettet kein einziges Bild — er macht den
//   Verlust aus einem STILLEN einen GEMELDETEN.
//
// WAS GEGENÜBER JOB 2912 D3 NEU IST, damit dieser Durchgang nicht bloss dessen Lauf wiederholt:
//   D3 hat die Panel-Meldung mit einer HANDGEBAUTEN Antwort gefahren (drei aus dem echten Lauf
//   abgeschriebene Zahlen). Hier bekommt das Panel die ANTWORT DER ECHTEN ROUTE IM WORTLAUT
//   (`B4`) — der ganze Antwortkörper, unverändert, so wie ihn der Server wirklich sendet. Damit
//   hängt zwischen Datei und gerenderter Meldung keine abgeschriebene Zahl mehr.
//   Dazu tritt `B5`: das Protokoll, das die Vorführung braucht, wird ausgedruckt.
//
// ================================================================================================
// JOB 4364 · WAS AM 21.09.2026 DAZUGEKOMMEN IST — AUS DEM IST-STAND WIRD EINE FESTSCHREIBUNG.
// ================================================================================================
//
//   Entscheidung 5 der Fachfragen vom 21.09.2026 (`ENTSCHEIDUNGEN-FACHFRAGEN-20260921.md:11`):
//   „Nur unterstützte Rasterbilder; EMF/WMF ausdrücklich außerhalb des Umfangs (eigene spätere
//   Zeile, wenn ein Kunde es braucht)." Damit ist der oben protokollierte Ist-Zustand keine
//   Momentaufnahme mehr, sondern eine ZUSAGE — und eine Zusage braucht einen Test, der bei JEDER
//   Abweichung rot wird, in beide Richtungen.
//
//   DREI LÜCKEN DES REINEN IST-STAND-LAUFS, die dafür geschlossen wurden — jede war grün zu
//   halten, ohne die Zusage zu halten:
//     1. `B1` prüfte am Bildschirm nur den MIME-TYP. Ein Import, der beide Bilder durch dasselbe
//        ersetzt, sie abschneidet oder neu kodiert, blieb grün. Jetzt werden die gespeicherten
//        Bildbytes gegen die Bildteile IM ZIP DER `.docx` gehalten — bytegleich oder rot.
//     2. `B3` fragte vier Formate ab, die durchkommen sollen, und vier, die es nicht sollen. Wer
//        ein FÜNFTES erlaubt (`image/bmp`, `image/svg+xml`, …), blieb grün. `Z1` erhebt die Menge
//        der durchgelassenen Formate erschöpfend und pinnt sie.
//     3. Der Betreibertext stand nirgends und konnte deshalb auch nicht von der Messung abweichen.
//        `Z3` hält `docs/klara/station1-bilder.md` gegen genau die Formatmengen, die `Z1` MISST.
//
//   WAS AUCH JETZT NICHT BEHAUPTET WIRD: nichts über den Word-Host. `InlinePicture
//   .getBase64ImageSrc()` bleibt unbeantwortet (braucht einen Menschen mit geladenem Add-in), und
//   „sichtbar" heisst hier DOM-Sichtbarkeit in jsdom (`domSichtbar`, kalibriert in `Z2`) — kein
//   Pixel, keine Browser-Abnahme. Produktcode wurde für JOB 4364 KEINER angefasst.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { SanitizedHtml } from "../../apps/web/src/components/SanitizedHtml";
import { MAX_INLINE_BODY_HTML_BYTES, extractDocxRich } from "../../apps/web/src/lib/docx";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { type KlaraPanel, createKlaraPanel } from "./klara-panel-fixture";

// DIE ZWEI ECHTEN WORD-DOKUMENTE. Beide lassen sich von Hand in Word öffnen — sie sind keine
// Testattrappen, sondern gültige OOXML-Pakete:
//   · job2912-zwei-bilder.docx     — zwei PNG-Bilder. DIE GEGENPROBE: der Grundweg funktioniert.
//   · job2912-echtes-metafile.docx — ein echtes EMF und ein echtes WMF (gültige Bildbytes, nicht
//     bloss umbenannte PNG). DER ERWARTETE VERLUSTFALL.
const fixture = (name: string) => readFileSync(join(process.cwd(), "tests", "fixtures", name));
const NUR_PNG = fixture("job2912-zwei-bilder.docx");
const METAFILE = fixture("job2912-echtes-metafile.docx");

function alsPuffer(b: Buffer): ArrayBuffer {
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

async function rendere(element: unknown): Promise<HTMLElement> {
  const wirt = document.createElement("div");
  document.body.appendChild(wirt);
  const wurzel = createRoot(wirt);
  await act(async () => {
    wurzel.render(element as never);
  });
  return wirt;
}

const ZUGANG = { name: "Admin", email: "beweislauf@x.de", password: "secret123" };

async function angemeldeteApp() {
  const app = buildApp(buildServices());
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ZUGANG });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ZUGANG.email, password: ZUGANG.password },
  });
  return { app, headers: { authorization: `Bearer ${login.json().token as string}` } };
}

interface Durchlauf {
  /** Der ANTWORTKÖRPER der echten Route, im Wortlaut — nicht abgeschrieben, nicht gekürzt. */
  antwort: Record<string, unknown>;
  /** Der Entwurf, wie er nach dem Speichern wieder aus dem Dienst gelesen wird. */
  gespeichert: Record<string, unknown>;
  /** Die MIME-Typen, die die Extraktion VOR dem Speichern aus der Datei geholt hat. */
  vorSpeichern: string[];
}

/**
 * Schiebt eine echte `.docx` durch den echten Import — Route, Speichern, Zurücklesen — und gibt
 * alles zurück, was der Beweislauf gegenüberstellt: was aus der Datei kam, was gespeichert wurde,
 * und was der Server dem Panel antwortet.
 */
async function durchDenImport(docx: Buffer, dateiname: string): Promise<Durchlauf> {
  const reich = await extractDocxRich(alsPuffer(docx), {
    imageBudgetBytes: MAX_INLINE_BODY_HTML_BYTES,
  });
  const vorSpeichern = [...reich.html.matchAll(/src="data:([^;]+);base64,/g)].map(
    (m) => m[1] ?? "",
  );

  const { app, headers } = await angemeldeteApp();
  const antwort = await app.inject({
    method: "POST",
    url: "/api/drafts/from-docx",
    headers,
    payload: { name: dateiname, data: docx.toString("base64") },
  });
  expect(antwort.statusCode, "Die Route hat keinen Entwurf angelegt").toBe(201);
  const koerper = antwort.json() as Record<string, unknown>;

  const geladen = await app.inject({
    method: "GET",
    url: `/api/drafts/${koerper.id as string}`,
    headers,
  });
  expect(geladen.statusCode, "Der Entwurf ist nicht abrufbar").toBe(200);
  return { antwort: koerper, gespeichert: geladen.json().payload, vorSpeichern };
}

/**
 * Jedes `<img>` eines gerenderten DOM-Baums mit TYP UND DEKODIERTEN BYTES, in Dokumentreihenfolge.
 *
 * JOB 4364 RUNDE 2 — WARUM DIESE HILFE ÜBERHAUPT EXISTIERT. Bis Runde 1 las dieser Lauf am
 * Bildschirm nur den MIME-Typ (`bildtypenAmBildschirm`), den Bildinhalt dagegen nur im
 * GESPEICHERTEN Entwurf. Zwischen beiden liegt aber noch eine ganze Verarbeitungsstufe:
 * `SanitizedHtml` sanitisiert ein ZWEITES Mal (`apps/web/src/lib/richText`) und fährt
 * `blankLegacyCaptionPlaceholders` darüber. BEN hat die Lücke gestellt und belegt: eine
 * Beschädigung der PNG-Nutzdaten AUSSCHLIESSLICH im Renderer liess alle zehn Fälle grün
 * (Cloud-Auftrag 1058dcc5c3314aa68db1ed91645b5903, Exit 0), während das Protokoll weiter
 * behauptete, die Rasterbilder kämen an. Gelesen wird `getAttribute("src")` — also das, was
 * wirklich im DOM steht, nicht die normalisierte `src`-Eigenschaft.
 */
function bilderAmBildschirm(behaelter: HTMLElement): { typ: string; bytes: Buffer }[] {
  return [...behaelter.querySelectorAll("img")].map((b) => {
    const treffer = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/s.exec(
      b.getAttribute("src") ?? "",
    );
    return { typ: treffer?.[1] ?? "", bytes: Buffer.from(treffer?.[2] ?? "", "base64") };
  });
}

/** Die MIME-Typen aller `<img>` eines gerenderten DOM-Baums, in Dokumentreihenfolge. */
function bildtypenAmBildschirm(behaelter: HTMLElement): string[] {
  return bilderAmBildschirm(behaelter).map((b) => b.typ);
}

/** Kurzkennung von Bildbytes fürs Protokoll — damit der Ausdruck nicht mehr behauptet als gemessen. */
function kennung(bytes: Buffer): string {
  return `${bytes.length} B/${createHash("sha256").update(bytes).digest("hex").slice(0, 8)}`;
}

// ── JOB 4364: die drei Messwerkzeuge der Festschreibung ─────────────────────────────────────────

/**
 * Der benannte Teil aus dem ZIP einer `.docx`. Bis JOB 4364 stand diese Hilfe innerhalb von `B0`;
 * `B1` braucht sie jetzt ebenfalls, um die gespeicherten Bildbytes gegen die QUELLE zu halten.
 */
async function zipEintrag(docx: Buffer, name: string) {
  const JSZip = (await import("jszip")).default;
  const eintrag = (await JSZip.loadAsync(docx)).file(name);
  if (!eintrag) {
    throw new Error(`Der Teil ${name} fehlt in der Datei`);
  }
  return eintrag;
}

async function bildteil(docx: Buffer, name: string): Promise<Buffer> {
  return (await zipEintrag(docx, name)).async("nodebuffer");
}

/**
 * Jede `data:`-Bildquelle eines HTML-Stands, in Dokumentreihenfolge, mit DEKODIERTEN Bytes.
 * Gegenstück zu `bildtypenAmBildschirm`: dort der Typ am Bildschirm, hier der INHALT im Entwurf.
 */
function bilderIm(html: string): { typ: string; bytes: Buffer }[] {
  return [...html.matchAll(/<img\b[^>]*\bsrc="data:([^;"]+);base64,([^"]*)"/gi)].map((m) => ({
    typ: m[1] ?? "",
    bytes: Buffer.from(m[2] ?? "", "base64"),
  }));
}

/**
 * Sichtbarkeit, soweit diese Werkstattklasse sie messen KANN — und keinen Deut weiter.
 *
 * jsdom rechnet KEIN Layout: es gibt hier keine Pixel, keine Überdeckung, keinen Viewport. Gemessen
 * wird die Kette vom Element bis zur Wurzel auf die drei Wege, auf denen ein vorhandenes `<img>`
 * unsichtbar wird, ohne aus dem DOM zu verschwinden: `display:none`, `visibility:hidden/collapse`,
 * `opacity:0` — dazu das `hidden`-Attribut. Das ist mehr als „Element vorhanden" und WENIGER als
 * eine Browser-Abnahme; `Z2` kalibriert es, damit der Unterschied nicht behauptet, sondern belegt
 * ist. Über den Word-Host sagt es nichts.
 */
function domSichtbar(element: Element): boolean {
  for (let knoten: Element | null = element; knoten; knoten = knoten.parentElement) {
    if (knoten instanceof HTMLElement && knoten.hidden) {
      return false;
    }
    const stil = getComputedStyle(knoten);
    if (stil.display === "none" || stil.visibility === "hidden" || stil.visibility === "collapse") {
      return false;
    }
    if (stil.opacity !== "" && Number.parseFloat(stil.opacity) === 0) {
      return false;
    }
  }
  return true;
}

// ── Panel-Vorrichtung für den Dokument-Weg ──────────────────────────────────────────────────────
// Die gemeinsame Fixture kennt `getSelectedDataAsync` (Auswahl-Weg), aber kein `getFileAsync` —
// den braucht der `.docx`-Weg (`taskpane.html:3605-3609`). Ergänzt statt die fremde Fixture
// umzubauen: sie trägt weitere Testdateien, ein Umbau dort wäre ein Eingriff in deren Vorrichtung.
function ruesteDokumentWegAus(bytes: Buffer): void {
  const g = globalThis as unknown as { Office: Record<string, unknown> };
  const office = g.Office as {
    FileType?: unknown;
    AsyncResultStatus: { Succeeded: string; Failed: string };
    context: { document: Record<string, unknown> };
  };
  office.FileType = { Compressed: "compressed" };
  office.context.document.getFileAsync = (
    _typ: string,
    _optionen: unknown,
    rueckruf: (r: { status: string; value: unknown }) => void,
  ): void => {
    rueckruf({
      status: office.AsyncResultStatus.Succeeded,
      value: {
        sliceCount: 1,
        getSliceAsync: (_i: number, cb: (r: { status: string; value: unknown }) => void): void => {
          cb({ status: office.AsyncResultStatus.Succeeded, value: { data: [...bytes] } });
        },
        closeAsync: (cb: () => void): void => {
          cb();
        },
      },
    });
  };
}

/**
 * Führt den ECHTEN Antwortkörper durch den ECHTEN Panel-Zweig und gibt zurück, was ein Mensch
 * liest. `routes` bekommt den Körper im Wortlaut — hier wird nichts gebaut.
 *
 * JOB 3057 K2: der Umfang „Ganzes Dokument" ist kein Radio mehr, sondern der Textlink
 * `#capture-dokument-link` (Fixture: `sendDocument`). Der Bilder-Satz steht nach dem Senden NICHT
 * mehr im Statusfeld, sondern als EINE Zeile in der Karte (`#capture-bilder-ergebnis` mit
 * `#capture-bilder-satz` und dem Link „In KLARWERK ergänzen"); ohne Verlust bleibt die Zeile
 * verborgen und leer.
 */
async function meldungImPanel(
  panel: KlaraPanel,
  bytes: Buffer,
): Promise<{ text: string; klasse: string }> {
  ruesteDokumentWegAus(bytes);
  panel.sendDocument();
  await panel.flush();
  return {
    text: panel.text("#capture-bilder-satz"),
    klasse: panel.q("#capture-bilder-ergebnis")?.className ?? "",
  };
}

let panel: KlaraPanel | null = null;
const protokoll: string[] = [];
afterEach(() => {
  panel?.restore();
  panel = null;
});

describe("JOB 2923 · D1 · Station 1: Ist-Stand-Beweislauf an zwei echten Word-Dokumenten", () => {
  // ── B0 — KALIBRIERUNG. Ohne sie misst der ganze Lauf nichts. ─────────────────────────────────
  // Ein Zähler, der bei kaputter Prüfdatei 0 findet, wäre blind grün; und ein „EMF", das in
  // Wahrheit ein umbenanntes PNG ist, belegt nur die MIME-Prüfung — daran ist JOB 2912 D1
  // gescheitert und BEN hat es zu Recht ROT gegeben.
  // GEMESSEN BEIM SCHREIBEN DIESES FALLS, und der Befund gehört in die Rückgabe: Eine Signatur im
  // ROHEN `.docx` zu suchen misst NICHT das Bild. Ein `.docx` ist ein ZIP; die PNG-Bytes der
  // Gegenprobe liegen dort DEFLATE-gepackt und die Signatur `89 50 4E 47` steht deshalb NICHT im
  // Container — die Rohsuche schlug prompt fehl. Umgekehrt heisst das: die Rohsuche „im Metafile
  // steckt kein PNG mehr" kann auch dann grün werden, wenn eines drinsteckt und nur gepackt ist.
  // Hier wird das ZIP daher AUSGEPACKT und der Bildteil selbst gelesen.
  it("B0 · beide Reprofall-Dateien tragen wirklich, was sie behaupten", async () => {
    // JOB 4364: `zipEintrag`/`bildteil` stehen jetzt auf Modulebene — `B1` braucht dieselbe Hilfe.
    const beginnt = (b: Buffer, muster: number[]) =>
      b.subarray(0, muster.length).equals(Buffer.from(muster));
    const PNG_SIGNATUR = [0x89, 0x50, 0x4e, 0x47];

    // Das Gegenprobe-Dokument trägt echte PNG-Bytes — BEIDE Teile, seit JOB 4364 auch der zweite:
    // `B1` hält die gespeicherten Bytes gegen genau diese zwei Teile, also müssen beide vorher als
    // echte PNG belegt sein.
    const png1 = await bildteil(NUR_PNG, "word/media/bild1.png");
    const png2 = await bildteil(NUR_PNG, "word/media/bild2.png");
    expect(beginnt(png1, PNG_SIGNATUR), "Bildteil 1 beginnt nicht mit 89 50 4E 47").toBe(true);
    expect(beginnt(png2, PNG_SIGNATUR), "Bildteil 2 beginnt nicht mit 89 50 4E 47").toBe(true);
    // UND SIE SIND VERSCHIEDEN. Ohne diese Zeile könnte die Reihenfolgeprüfung in `B1` auch von
    // einem Import grün werden, der dasselbe Bild zweimal einsetzt.
    expect(
      png1.equals(png2),
      "Die zwei Quellbilder sind bytegleich — dann kann B1 ein verdoppeltes Bild nicht erkennen",
    ).toBe(false);

    // Das Verlustfall-Dokument trägt echte Metafile-Bytes — und KEIN PNG.
    const emf = await bildteil(METAFILE, "word/media/bild1.emf");
    const wmf = await bildteil(METAFILE, "word/media/bild2.wmf");
    // EMF: `EMR_HEADER` (iType 1) in Byte 0-3, Kennung " EMF" in Byte 40-43.
    expect(beginnt(emf, [0x01, 0x00, 0x00, 0x00]), "EMF: kein EMR_HEADER in Byte 0-3").toBe(true);
    expect(emf.subarray(40, 44).toString("latin1"), "EMF: keine Kennung in Byte 40-43").toBe(
      " EMF",
    );
    // WMF: der placeable-Aldus-Schlüssel d7 cd c6 9a in Byte 0-3.
    expect(beginnt(wmf, [0xd7, 0xcd, 0xc6, 0x9a]), "WMF: kein Aldus-Schlüssel in Byte 0-3").toBe(
      true,
    );
    // Die Gegenprobe zur Umdeklarations-Panne aus JOB 2912 D1 — jetzt an den AUSGEPACKTEN Bytes,
    // wo sie wirklich trägt: in keinem der beiden Metafile-Teile steckt ein PNG.
    for (const [name, bytes] of [
      ["bild1.emf", emf],
      ["bild2.wmf", wmf],
    ] as const) {
      expect(
        bytes.includes(Buffer.from(PNG_SIGNATUR)),
        `In ${name} steckt doch ein PNG — dann ist das Format bloss umdeklariert`,
      ).toBe(false);
    }
    // Und die OOXML-Deklaration nennt dieselben Formate.
    const ct = await (await zipEintrag(METAFILE, "[Content_Types].xml")).async("string");
    expect(ct, "EMF-Content-Type fehlt").toContain("image/x-emf");
    expect(ct, "WMF-Content-Type fehlt").toContain("image/x-wmf");
  });

  // ── B1 — DIE GEGENPROBE: der Grundweg TRÄGT. ─────────────────────────────────────────────────
  // Sie steht zuerst, weil ohne sie B2 auch von einer generell kaputten Kette grün würde.
  it("B1 · PNG-Dokument: BEIDE Bilder kommen im Entwurf an, die Bilanz meldet 2 von 2", async () => {
    const { antwort, gespeichert, vorSpeichern } = await durchDenImport(
      NUR_PNG,
      "vorfuehrung-png.docx",
    );
    const container = await rendere(
      createElement(SanitizedHtml, { html: gespeichert.bodyHtml as string }),
    );
    const amBildschirm = bildtypenAmBildschirm(container);

    expect(vorSpeichern, "Die Extraktion holt nicht zwei PNG aus der Datei").toEqual([
      "image/png",
      "image/png",
    ]);
    expect(amBildschirm, "Der Grundweg ist kaputt — dann misst der ganze Lauf nichts").toEqual([
      "image/png",
      "image/png",
    ]);
    expect(antwort.imagesTotal).toBe(2);
    expect(antwort.imagesEmbedded, "Die Bilanz meldet einen Verlust, den es nicht gibt").toBe(2);

    // ── JOB 4364 · K1 — „VOLLSTÄNDIG ANGEKOMMEN" HEISST BYTEGLEICH, nicht „MIME-Typ stimmt". ────
    // Gegengehalten wird gegen die QUELLE selbst: die zwei Bildteile im ZIP der `.docx`. Ein
    // Import, der ein Bild abschneidet, neu kodiert oder zweimal dasselbe einsetzt, wird hier rot.
    const imQuelldokument = [
      await bildteil(NUR_PNG, "word/media/bild1.png"),
      await bildteil(NUR_PNG, "word/media/bild2.png"),
    ];
    const imEntwurf = bilderIm(gespeichert.bodyHtml as string);
    expect(
      imEntwurf.map((b) => b.typ),
      "Im GESPEICHERTEN Entwurf stehen nicht zwei PNG — der Bildschirm allein belegt nichts",
    ).toEqual(["image/png", "image/png"]);
    expect(
      imEntwurf.map((b) => b.bytes.toString("base64")),
      "Die gespeicherten Bildbytes sind nicht die des Word-Dokuments — es ging etwas verloren, kam doppelt oder wurde neu kodiert",
    ).toEqual(imQuelldokument.map((b) => b.toString("base64")));
    // WARUM Bytegleichheit hier überhaupt gelten DARF, und warum das hier steht statt im Kommentar:
    // die Bildableitung (JOB 3400) hat an diesem Dokument nichts verkleinert, sondern beide Quellen
    // behalten. Verkleinerte sie morgen, wäre Bytegleichheit die falsche Zusage — dann wird DIESE
    // Zeile rot und nennt den Grund, statt den Vergleich oben still zur Lüge werden zu lassen.
    expect(
      { verkleinert: antwort.imagesShrunk, quelle_behalten: antwort.imagesKeptOriginal },
      "Die Bildableitung greift jetzt ein — dann prüft der Bytevergleich oben etwas anderes als vorher",
    ).toEqual({ verkleinert: 0, quelle_behalten: 2 });
    // ── JOB 4364 RUNDE 2 · DIE ZWEITE HÄLFTE DERSELBEN ZUSAGE — BEN-KORREKTURPFLICHT 1. ─────────
    // Der Vergleich oben endet im gespeicherten Entwurf. Danach liegt noch eine Stufe: `SanitizedHtml`
    // sanitisiert ein zweites Mal (`apps/web/src/lib/richText`) und fährt
    // `blankLegacyCaptionPlaceholders` darüber. BEN hat genau dort beschädigt und alle zehn Fälle
    // blieben grün. Deshalb werden JETZT auch die gerenderten Bildquellen gegen DIESELBEN
    // Quellbilder gehalten — was der Mensch sieht, ist das, was in der Word-Datei stand.
    const amBildschirmInhalt = bilderAmBildschirm(container);
    expect(
      amBildschirmInhalt.map((b) => b.bytes.toString("base64")),
      "Die GERENDERTEN Bildbytes sind nicht die des Word-Dokuments — auf dem Weg zum Bildschirm wurde beschädigt, verdoppelt oder neu kodiert",
    ).toEqual(imQuelldokument.map((b) => b.toString("base64")));
    // Und die zwei Bilder stehen nicht bloss im DOM, sie sind dort auch nicht ausgeblendet.
    // `domSichtbar` misst display/visibility/opacity bis zur Wurzel — kalibriert in `Z2`.
    const bildknoten = [...container.querySelectorAll("img")];
    expect(bildknoten, "Es sind nicht zwei Bildknoten gerendert").toHaveLength(2);
    for (const [i, knoten] of bildknoten.entries()) {
      expect(
        domSichtbar(knoten),
        `Bild ${i + 1} steht im DOM, ist aber ausgeblendet — „kommt an" wäre dann unwahr`,
      ).toBe(true);
    }

    // Das Protokoll nennt seit Runde 2 die INHALTSKENNUNG, nicht nur den Typ. Ein Ausdruck, der
    // „image/png, image/png" meldet, während der Bildschirm zwei kaputte Bilder zeigt, hat genau
    // die Behauptung getragen, die BEN widerlegt hat.
    protokoll.push(
      `PNG-Dokument   · aus der Datei: [${vorSpeichern.join(", ")}]` +
        ` · am Bildschirm: [${amBildschirmInhalt.map((b) => `${b.typ} ${kennung(b.bytes)}`).join(", ")}]` +
        ` · Quelle im .docx: [${imQuelldokument.map((b) => kennung(b)).join(", ")}]` +
        ` · Bilanz: ${String(antwort.imagesEmbedded)}/${String(antwort.imagesTotal)}`,
    );
  });

  // ── B2 — DER ERWARTETE VERLUST. Er wird BENANNT, nicht schöngeredet. ─────────────────────────
  it("B2 · EMF/WMF-Dokument: KEINES der zwei Bilder kommt an — der Text reist mit", async () => {
    const { antwort, gespeichert, vorSpeichern } = await durchDenImport(
      METAFILE,
      "vorfuehrung-metafile.docx",
    );
    const container = await rendere(
      createElement(SanitizedHtml, { html: gespeichert.bodyHtml as string }),
    );
    const amBildschirm = bildtypenAmBildschirm(container);

    // Aus der DATEI kommen beide Bilder heraus — der Extraktor verliert nichts.
    expect(vorSpeichern).toEqual(["image/x-emf", "image/x-wmf"]);
    // GESPEICHERT wird keines. Das ist das Schadensbild, und es ist HEUTE noch da.
    expect(
      amBildschirm,
      "Der Bildverlust ist behoben — dann ist dieser Ist-Stand-Beweis überholt",
    ).toEqual([]);
    expect(antwort.imagesTotal).toBe(2);
    expect(
      antwort.imagesEmbedded,
      "Die Bilanz zählt VOR dem Sanitizer — der Verlust bliebe still",
    ).toBe(0);
    // Die gemeldete Zahl deckt sich mit dem, was WIRKLICH im gespeicherten Entwurf steht.
    expect(((gespeichert.bodyHtml as string).match(/<img\b/gi) ?? []).length).toBe(
      antwort.imagesEmbedded,
    );
    // Der Text geht nicht mit verloren — der Entwurf ist nicht leer, er ist bildlos.
    expect(container.textContent ?? "").toContain("BAADER Sonde Station 1");

    // ── JOB 4364 · K1 — „KEIN BILD ERFUNDEN". ───────────────────────────────────────────────────
    // Die Zählung oben schliesst einen Platzhalter nicht aus: ein Import, der den Verlust mit einem
    // Ersatzbild überdeckt, änderte `imagesEmbedded` zwar — ein Hinweisbild AUSSERHALB der Zählung
    // (anderer Knoten, CSS-Hintergrund, eingebettetes Vorschaubild) bliebe still. Geprüft wird
    // deshalb der gespeicherte Stand auf JEDE eingebettete Bildquelle, nicht nur auf `<img>`.
    expect(
      bilderIm(gespeichert.bodyHtml as string),
      "Im Entwurf steht doch eine Bildquelle — der Verlust wurde mit einem Ersatz überdeckt",
    ).toEqual([]);
    expect(
      gespeichert.bodyHtml as string,
      "Irgendwo im Entwurf steht `data:image` — es wurde ein Bild erfunden, statt den Verlust zu melden",
    ).not.toMatch(/data:image/i);
    expect(bildtypenAmBildschirm(container), "Am Bildschirm steht ein erfundenes Bild").toEqual([]);

    protokoll.push(
      `EMF/WMF-Dokument · aus der Datei: [${vorSpeichern.join(", ")}]` +
        ` · am Bildschirm: [${amBildschirm.join(", ")}]` +
        ` · Bilanz: ${String(antwort.imagesEmbedded)}/${String(antwort.imagesTotal)}`,
    );
  });

  // ── B3 — DIE URSACHE, isoliert. Warum die Fußnote ohne ihr Bild stehen bleibt. ───────────────
  it("B3 · der Sanitizer entscheidet am MIME-Typ und lässt die Bild-Fußnote zurück", async () => {
    const { sanitizeHtml } = await import("../../services/structure");
    const figur = (typ: string) =>
      `<figure><img src="data:${typ};base64,AAAA" alt="B"><figcaption>Abbildung 1</figcaption></figure>`;
    for (const typ of ["image/png", "image/jpeg", "image/gif", "image/webp"]) {
      expect(sanitizeHtml(figur(typ)), `${typ} müsste durchkommen`).toContain("<img");
    }
    for (const typ of ["image/x-emf", "image/emf", "image/x-wmf", "image/wmf"]) {
      const sauber = sanitizeHtml(figur(typ));
      expect(sauber, `${typ} kommt entgegen dem Befund durch`).not.toContain("<img");
      expect(sauber, `${typ}: auch die Fußnote fehlt — dann ist der Befund ein anderer`).toContain(
        "Abbildung 1",
      );
    }
  });

  // ── B4 — WAS DER MENSCH SIEHT, mit der ECHTEN Antwort im Wortlaut. ──────────────────────────
  //
  // Hier liegt der Unterschied zu JOB 2912 D3: dort wurde dem Panel eine handgebaute Antwort aus
  // drei abgeschriebenen Zahlen vorgesetzt. Hier reicht der ECHTE Antwortkörper der Route
  // unverändert weiter — zwischen der Word-Datei und dem gerenderten Satz steht keine von mir
  // gesetzte Zahl mehr.
  it("B4 · das Panel meldet den Verlust sichtbar — Antwortkörper der echten Route im Wortlaut", async () => {
    const { antwort } = await durchDenImport(METAFILE, "vorfuehrung-metafile.docx");
    const fehlend = (antwort.imagesTotal as number) - (antwort.imagesEmbedded as number);
    expect(fehlend, "Ohne Fehlbetrag prüft B4 die Meldung nicht").toBe(2);

    panel = createKlaraPanel({
      withOffice: true,
      // KEIN Nachbau: der Körper geht so hinein, wie der Server ihn gesendet hat.
      routes: { "/api/drafts/from-docx": { status: 201, body: antwort } },
    });
    const { text, klasse } = await meldungImPanel(panel, METAFILE);

    // JOB 3438 — NACHGEFUEHRT, WEIL DIE ZEILE JETZT MEHR SAGT, NICHT WENIGER.
    //
    // Bis hierher stand hier `toBe(sendImagesMissing)`: der Verlustsatz war der GANZE Inhalt der
    // Zeile. Seit JOB 3438 liest `sendeDocxDatei` auch die Bildbilanz derselben Antwort
    // (`imagesShrunk`/`imagesKeptOriginal`/`imageSkipReasons`, seit JOB 3400 in der Route). An
    // DIESEM echten Metafile-Dokument gemessen (kein Nachbau, der Körper kommt aus der Route):
    //     „Word hat 2 Bilder nicht herausgegeben — der Text ist vollständig.
    //      2 Bilder blieben in Originalgröße. Nicht verkleinert: nicht lesbar."
    // Der Verlustsatz ist WORTGLEICH geblieben und steht ZUERST — das prüfen die zwei Zeilen unten
    // getrennt. Der Rest ist die neue, ebenfalls wahre Auskunft; sie zu verbieten hiesse, dem
    // Menschen die Antwort auf „warum?" wieder wegzunehmen.
    const verlustsatz = panel.t("sendImagesMissing", { n: String(fehlend) });
    expect(
      text,
      `In #capture-bilder-satz steht nichts von fehlenden Bildern. Gesehen: ${JSON.stringify(text)}`,
    ).toContain(verlustsatz);
    expect(
      text.indexOf(verlustsatz),
      "der Verlusthinweis steht nicht an erster Stelle — er ist der schwerere Befund",
    ).toBe(0);
    // JOB 3057 K2: die Zeile ist SICHTBAR (nicht `hidden`) und steht neben der Ergebniszeile —
    // der Verlust verschwindet nicht im Erfolg.
    expect(klasse, "Der Bilder-Satz ist verborgen — der Verlust verschwindet im Erfolg").toBe("");
    expect(panel.q("#capture-ergebnis")?.className).toBe("");
    // Der Panel-Weg ist wirklich über die docx-Route gegangen, nicht über den Auswahl-Weg.
    expect(panel.calls.some((c) => c.url.includes("/api/drafts/from-docx"))).toBe(true);

    protokoll.push(`Panel-Meldung (EMF/WMF) · #capture-bilder-satz: ${JSON.stringify(text)}`);
  });

  // ── B5 — DIE GEGENMUTATION zu B4. ────────────────────────────────────────────────────────────
  // Ohne sie wäre B4 auch dann grün, wenn das Panel die Meldung IMMER zeigte.
  it("B5 · beim PNG-Dokument zeigt dasselbe Panel KEINE Fehlmeldung", async () => {
    const { antwort } = await durchDenImport(NUR_PNG, "vorfuehrung-png.docx");
    panel = createKlaraPanel({
      withOffice: true,
      routes: { "/api/drafts/from-docx": { status: 201, body: antwort } },
    });
    const { text, klasse } = await meldungImPanel(panel, NUR_PNG);

    // JOB 3057 K2: ohne Verlust gibt es KEINE VERLUSTMELDUNG. Das ist und bleibt die Aussage
    // dieses Falls — er ist die Gegenmutation zu B4.
    //
    // JOB 3438 — NACHGEFUEHRT: die Zeile ist nicht mehr leer, weil sie jetzt die Bildbilanz trägt
    // („2 Bilder blieben in Originalgröße." an DIESEM echten PNG-Dokument). Geprüft wird deshalb
    // die Abwesenheit der Verlustaussage, nicht die Abwesenheit jedes Satzes — sonst hielte dieser
    // Fall fest, dass das Panel über Bilder schweigt, und genau das war der behobene Mangel.
    expect(text, "Die Fehlmeldung erscheint auch ohne Verlust").not.toContain(
      "nicht herausgegeben",
    );
    expect(text, "Die Fehlmeldung erscheint auch ohne Verlust").not.toContain("fehlen im Entwurf");
    // Was hier steht, ist die Bilanz — und die nennt kein Problem.
    expect(text, "Ohne Ausfall darf kein Grund dastehen").not.toContain("Nicht verkleinert:");
    expect(klasse, "Die Bilder-Zeile trägt die Bilanz und ist deshalb sichtbar").toBe("");
    expect(panel.q("#capture-ergebnis")?.className).toBe("");

    protokoll.push(`Panel-Meldung (PNG) · #capture-bilder-satz: ${JSON.stringify(text)}`);
  });

  // ══ JOB 4364 · DIE FESTSCHREIBUNG ═══════════════════════════════════════════════════════════
  // B0–B5 belegen einen ZUSTAND. Z1–Z3 machen daraus eine ZUSAGE, die nicht unbemerkt wandern kann.

  // ── Z1 — DIE FORMATMENGE, ERSCHÖPFEND ERHOBEN statt abgefragt. ───────────────────────────────
  // Der Unterschied zu B3 ist der ganze Zweck dieses Falls: B3 fragt acht Formate ab und sagt über
  // ein neuntes nichts. Wer `image/bmp` oder `image/svg+xml` erlaubt, hält B3 grün und bricht
  // trotzdem Entscheidung 5. Hier wird die Menge der durchgelassenen Formate ERHOBEN und gepinnt:
  // jede Erweiterung und jede Streichung wird rot, mit der Differenz im Klartext.
  it("Z1 · die Zusage gepinnt: GENAU diese Rasterformate kommen durch, Metafile nicht", async () => {
    const { sanitizeHtml } = await import("../../services/structure");
    // Bewusst breiter als die Zusage — eine Kandidatenliste, die nur die erwarteten vier enthält,
    // könnte die Erweiterung gar nicht entdecken, die sie verhindern soll.
    const KANDIDATEN = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
      "image/apng",
      "image/avif",
      "image/bmp",
      "image/heic",
      "image/heif",
      "image/jp2",
      "image/svg+xml",
      "image/tiff",
      "image/vnd.microsoft.icon",
      "image/x-icon",
      "image/emf",
      "image/x-emf",
      "image/wmf",
      "image/x-wmf",
    ];
    const durch = KANDIDATEN.filter((typ) =>
      sanitizeHtml(`<img src="data:${typ};base64,AAAA" alt="B">`).includes("<img"),
    );
    const verworfen = KANDIDATEN.filter((typ) => !durch.includes(typ));
    // Die Kandidatenliste selbst ist kalibriert: fiele der Sanitizer ganz aus (liesse er alles
    // durch) oder verwürfe er alles, stünde eine der beiden Mengen leer und die Zeilen darunter
    // prüften nichts mehr.
    expect(durch.length, "KEIN Format kommt durch — der Sanitizer verwirft alles").toBeGreaterThan(
      0,
    );
    expect(
      verworfen.length,
      "JEDES Format kommt durch — der Sanitizer greift nicht",
    ).toBeGreaterThan(0);

    expect(
      durch,
      "Die Menge der durchgelassenen Bildformate hat sich geändert. Das ist die Zusage aus Entscheidung 5 (nur unterstützte Rasterbilder) — wer sie ändert, führt docs/klara/station1-bilder.md mit nach",
    ).toEqual(["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"]);
    for (const metafile of ["image/emf", "image/x-emf", "image/wmf", "image/x-wmf"]) {
      expect(
        durch,
        `${metafile} kommt jetzt durch — Entscheidung 5 stellt Metafile ausdrücklich AUSSERHALB des Umfangs; eine Rettung ist eine eigene Zeile, kein stiller Durchlass`,
      ).not.toContain(metafile);
    }

    protokoll.push(
      `Zusage (Entscheidung 5) · kommt an: [${durch.join(", ")}]` +
        ` · verworfen: [${verworfen.join(", ")}]`,
    );
  });

  // ── Z2 — DER SICHTBARKEITSMESSER WIRD KALIBRIERT. ───────────────────────────────────────────
  // B1 behauptet seit JOB 4364 nicht nur „im DOM", sondern „nicht ausgeblendet". Ohne diesen Fall
  // wäre das eine Behauptung über ein Werkzeug, das auch dann grün gäbe, wenn es immer `true`
  // lieferte. Jeder der vier Wege wird gesetzt, gemessen und zurückgenommen.
  it("Z2 · ausgeblendet heisst rot — der Sichtbarkeitsmesser fällt auf jedem der vier Wege um", async () => {
    const container = await rendere(
      createElement(SanitizedHtml, {
        html: `<p><img src="data:image/png;base64,${(await bildteil(NUR_PNG, "word/media/bild1.png")).toString("base64")}" alt="Kalibrierbild"></p>`,
      }),
    );
    const bild = container.querySelector("img");
    expect(bild, "Kein Bild gerendert — dann misst Z2 nichts").not.toBeNull();
    const knoten = bild as HTMLImageElement;
    const absatz = knoten.parentElement as HTMLElement;
    expect(domSichtbar(knoten), "Das unverstellte Bild gilt schon als unsichtbar").toBe(true);

    const wege: { name: string; verstellen: () => void; zuruecknehmen: () => void }[] = [
      {
        name: "display:none am Bild selbst",
        verstellen: () => {
          knoten.style.display = "none";
        },
        zuruecknehmen: () => {
          knoten.style.display = "";
        },
      },
      {
        name: "visibility:hidden am Elternabsatz",
        verstellen: () => {
          absatz.style.visibility = "hidden";
        },
        zuruecknehmen: () => {
          absatz.style.visibility = "";
        },
      },
      {
        name: "opacity:0 am Elternabsatz",
        verstellen: () => {
          absatz.style.opacity = "0";
        },
        zuruecknehmen: () => {
          absatz.style.opacity = "";
        },
      },
      {
        name: "hidden-Attribut am Bild",
        verstellen: () => {
          knoten.hidden = true;
        },
        zuruecknehmen: () => {
          knoten.hidden = false;
        },
      },
    ];
    for (const weg of wege) {
      weg.verstellen();
      expect(
        domSichtbar(knoten),
        `${weg.name}: der Messer meldet das Bild trotzdem als sichtbar — dann belegt B1 nichts`,
      ).toBe(false);
      weg.zuruecknehmen();
      expect(domSichtbar(knoten), `${weg.name}: nach der Rücknahme bleibt es unsichtbar`).toBe(
        true,
      );
    }
  });

  // ── Z3 — DER BETREIBERTEXT HÄNGT AN DER MESSUNG, nicht an einer Erinnerung. ──────────────────
  // `docs/klara/station1-bilder.md` sagt einem Menschen, was mit Bildern geschieht. Ein Dokument,
  // das niemand nachrechnet, wird unweigerlich falsch. Hier werden die Formatlisten des Dokuments
  // gegen die ERHOBENE Menge gehalten — dasselbe Verfahren wie in Z1, nicht dessen abgeschriebenes
  // Ergebnis. Wer den Sanitizer ändert und das Dokument vergisst, wird rot; und umgekehrt.
  it("Z3 · der Betreibertext deckt sich mit dem gemessenen Verhalten", async () => {
    const pfad = join(process.cwd(), "docs", "klara", "station1-bilder.md");
    const text = readFileSync(pfad, "utf8");

    // Die zwei Listen des Dokuments, an seinen Überschriften aufgeteilt. Gelesen werden nur die
    // `image/…`-Angaben in Rückstrichen — Fliesstext darum herum darf sich frei ändern.
    const abschnitt = (ueberschrift: string): string[] => {
      const start = text.indexOf(`## ${ueberschrift}`);
      expect(start, `Im Dokument fehlt der Abschnitt „${ueberschrift}"`).toBeGreaterThanOrEqual(0);
      const rest = text.slice(start + ueberschrift.length + 3);
      const ende = rest.indexOf("\n## ");
      const block = ende >= 0 ? rest.slice(0, ende) : rest;
      return [...block.matchAll(/`(image\/[a-z0-9.+-]+)`/gi)].map((m) => m[1] ?? "");
    };

    const { sanitizeHtml } = await import("../../services/structure");
    const kommtDurch = (typ: string) =>
      sanitizeHtml(`<img src="data:${typ};base64,AAAA" alt="B">`).includes("<img");

    const angekuendigtAn = abschnitt("Was ankommt");
    const angekuendigtWeg = abschnitt("Was verloren geht");
    expect(angekuendigtAn.length, "Der Abschnitt „Was ankommt“ nennt kein Format").toBeGreaterThan(
      0,
    );
    expect(
      angekuendigtWeg.length,
      "Der Abschnitt „Was verloren geht“ nennt kein Format",
    ).toBeGreaterThan(0);

    // Jede Zusage des Dokuments wird EINZELN nachgemessen — beide Richtungen.
    for (const typ of angekuendigtAn) {
      expect(
        kommtDurch(typ),
        `Das Dokument sagt „${typ} kommt an", der Sanitizer verwirft es — der Betreibertext ist falsch`,
      ).toBe(true);
    }
    for (const typ of angekuendigtWeg) {
      expect(
        kommtDurch(typ),
        `Das Dokument sagt „${typ} geht verloren", der Sanitizer lässt es durch — der Betreibertext ist falsch`,
      ).toBe(false);
    }
    // Und die Liste ist VOLLSTÄNDIG: kein durchgelassenes Format fehlt im Dokument. Ohne diese
    // Zeile bliebe ein Dokument grün, das nur `image/png` nennt und den Rest verschweigt.
    const durchgelassen = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
      "image/bmp",
      "image/svg+xml",
      "image/tiff",
      "image/avif",
    ].filter(kommtDurch);
    expect(
      durchgelassen.filter((t) => !angekuendigtAn.includes(t)),
      "Der Sanitizer lässt ein Format durch, das der Betreibertext nicht nennt",
    ).toEqual([]);

    // K2/K3: Herkunft und Grenze stehen im Dokument, nicht nur im Auftrag.
    expect(text, "Der Verweis auf Entscheidung 5 fehlt").toContain("Entscheidung 5");
    expect(text, "Die Entscheidungsquelle wird nicht genannt").toContain(
      "ENTSCHEIDUNGEN-FACHFRAGEN-20260921.md",
    );
    expect(text, "Das Dokument nennt den Test nicht, der es hält").toContain(
      "tests/app/job2923-station1-beweislauf.test.tsx",
    );
    expect(text, "Die offene Word-Host-Frage wird nicht als offen ausgewiesen").toContain(
      "InlinePicture.getBase64ImageSrc()",
    );

    protokoll.push(
      `Betreibertext · docs/klara/station1-bilder.md · kommt an: [${angekuendigtAn.join(", ")}]` +
        ` · geht verloren: [${angekuendigtWeg.join(", ")}]`,
    );
  });

  // ── B6 — DAS PROTOKOLL, das die Vorführung braucht. ──────────────────────────────────────────
  // Es druckt nur aus, was B1–B5 und Z1/Z3 GEMESSEN haben; es misst selbst nichts nach. Steht eine
  // Zeile nicht da, ist der zugehörige Fall nicht gelaufen — auch das ist eine Aussage.
  it("B6 · Protokoll des Ist-Zustands und der Festschreibung", () => {
    // 4 -> 6 am 21.09.2026 (JOB 4364): Z1 und Z3 tragen je eine Zeile bei.
    expect(
      protokoll.length,
      "Ein Beweisfall ist nicht gelaufen — das Protokoll wäre lückenhaft",
    ).toBe(6);
    console.log(
      [
        "",
        "=== JOB 2923 D1 / JOB 4364 · STATION 1 (Word-Import mit Bildern) ===",
        ...protokoll.map((z) => `  ${z}`),
        "  BEFUND: Rasterbilder kommen bytegleich an. EMF/WMF gehen verloren und werden gemeldet.",
        "  Das ist seit Entscheidung 5 (21.09.2026) die ZUSAGE, nicht nur der Ist-Zustand.",
        "  Kein Bild wird gerettet und keines erfunden; der Word-Host bleibt ungeprüft.",
        "",
      ].join("\n"),
    );
  });
});
