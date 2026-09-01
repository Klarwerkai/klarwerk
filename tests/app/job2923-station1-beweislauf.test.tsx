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

/** Die MIME-Typen aller `<img>` eines gerenderten DOM-Baums, in Dokumentreihenfolge. */
function bildtypenAmBildschirm(behaelter: HTMLElement): string[] {
  return [...behaelter.querySelectorAll("img")].map(
    (b) => /^data:(image\/[a-zA-Z0-9.+-]+);base64,/.exec(b.getAttribute("src") ?? "")?.[1] ?? "",
  );
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

/** Setzt den Umfang auf „Ganzes Dokument" — sonst liefe der Auswahl-Weg. */
function waehleGanzesDokument(panel: KlaraPanel): void {
  const radio = panel.q("#scope-document") as unknown as { checked: boolean } | null;
  if (!radio) {
    throw new Error("#scope-document fehlt im ausgelieferten Panel");
  }
  radio.checked = true;
}

/**
 * Führt den ECHTEN Antwortkörper durch den ECHTEN Panel-Zweig und gibt zurück, was ein Mensch
 * in `#send-status` liest. `routes` bekommt den Körper im Wortlaut — hier wird nichts gebaut.
 */
async function meldungImPanel(
  panel: KlaraPanel,
  bytes: Buffer,
): Promise<{ text: string; klasse: string }> {
  ruesteDokumentWegAus(bytes);
  waehleGanzesDokument(panel);
  panel.sendSelection();
  await panel.flush();
  return { text: panel.text("#send-status"), klasse: panel.q("#send-status")?.className ?? "" };
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
    const JSZip = (await import("jszip")).default;
    const zipEintrag = async (docx: Buffer, name: string) => {
      const eintrag = (await JSZip.loadAsync(docx)).file(name);
      if (!eintrag) {
        throw new Error(`Der Teil ${name} fehlt in der Datei`);
      }
      return eintrag;
    };
    const bildteil = async (docx: Buffer, name: string): Promise<Buffer> =>
      (await zipEintrag(docx, name)).async("nodebuffer");
    const beginnt = (b: Buffer, muster: number[]) =>
      b.subarray(0, muster.length).equals(Buffer.from(muster));
    const PNG_SIGNATUR = [0x89, 0x50, 0x4e, 0x47];

    // Das Gegenprobe-Dokument trägt echte PNG-Bytes.
    const png = await bildteil(NUR_PNG, "word/media/bild1.png");
    expect(beginnt(png, PNG_SIGNATUR), "Der PNG-Bildteil beginnt nicht mit 89 50 4E 47").toBe(true);

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

    protokoll.push(
      `PNG-Dokument   · aus der Datei: [${vorSpeichern.join(", ")}]` +
        ` · am Bildschirm: [${amBildschirm.join(", ")}]` +
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

    expect(
      text,
      `In #send-status steht nichts von fehlenden Bildern. Gesehen: ${JSON.stringify(text)}`,
    ).toContain(panel.t("sendImagesMissing", { n: String(fehlend) }));
    expect(klasse, "Die Meldung ist kein Hinweis, sondern verschwindet im Erfolg").toContain(
      "warn",
    );
    // Der Panel-Weg ist wirklich über die docx-Route gegangen, nicht über den Auswahl-Weg.
    expect(panel.calls.some((c) => c.url.includes("/api/drafts/from-docx"))).toBe(true);

    protokoll.push(`Panel-Meldung (EMF/WMF) · #send-status: ${JSON.stringify(text)}`);
  });

  // ── B5 — DIE GEGENMUTATION zu B4. ────────────────────────────────────────────────────────────
  // Ohne sie wäre B4 auch dann grün, wenn das Panel die Meldung IMMER zeigte.
  it("B5 · beim PNG-Dokument zeigt dasselbe Panel KEINE Fehlmeldung", async () => {
    const { antwort } = await durchDenImport(NUR_PNG, "vorfuehrung-png.docx");
    panel = createKlaraPanel({
      withOffice: true,
      routes: { "/api/drafts/from-docx": { status: 201, body: antwort } },
    });
    const { text } = await meldungImPanel(panel, NUR_PNG);

    expect(text, "Die Fehlmeldung erscheint auch ohne Verlust").not.toContain(
      panel.t("sendImagesMissing", { n: "1" }),
    );
    expect(text, "Die Fehlmeldung erscheint auch ohne Verlust").not.toContain(
      panel.t("sendImagesMissing", { n: "2" }),
    );

    protokoll.push(`Panel-Meldung (PNG) · #send-status: ${JSON.stringify(text)}`);
  });

  // ── B6 — DAS PROTOKOLL, das die Vorführung braucht. ──────────────────────────────────────────
  // Es druckt nur aus, was B1–B5 GEMESSEN haben; es misst selbst nichts nach. Steht eine Zeile
  // nicht da, ist der zugehörige Fall nicht gelaufen — auch das ist eine Aussage.
  it("B6 · Protokoll des Ist-Zustands", () => {
    expect(
      protokoll.length,
      "Ein Beweisfall ist nicht gelaufen — das Protokoll wäre lückenhaft",
    ).toBe(4);
    console.log(
      [
        "",
        "=== JOB 2923 D1 · IST-STAND STATION 1 (Word-Import mit Bildern) ===",
        ...protokoll.map((z) => `  ${z}`),
        "  BEFUND: Station 1 ist HEUTE NICHT behoben. EMF/WMF-Bilder gehen verloren.",
        "  Der D1-Teil-Fix macht den Verlust sichtbar — er rettet kein Bild.",
        "",
      ].join("\n"),
    );
  });
});
