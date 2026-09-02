// ================================================================================================
// F-0121 · JOB 2955 · D1/D2 — AUDIO- UND VIDEO-AUFNAHMEN VERSCHRIFTLICHEN
// ================================================================================================
//
// D1 hat gemessen: `whisperClient.transcribe` hängt die Aufnahme unter dem festen, extensionslosen
// Namen "media" an, obwohl der MIME-Typ vorliegt (`transcriber.ts`, Ausgangsstand Zeile 50). Der
// Fix leitet den Dateinamen aus dem MIME-Typ ab.
//
// ------------------------------------------------------------------------------------------------
// D2 · WAS DIESE DATEI BELEGT — UND WAS SIE AUSDRÜCKLICH NICHT BELEGT
// ------------------------------------------------------------------------------------------------
//
// BEN hat an D1 zu Recht gerügt: dass der ANBIETER das Format anhand der Dateiendung bestimmt (und
// nicht anhand des ohnehin gesetzten Blob-MIME-Typs), war eine unbelegte Annahme. Die Suche nach
// einer versionierten Primärquelle im Repository (D2) blieb ergebnislos: kein Anbieter-SDK, keine
// mitgelieferte Anbieterdokumentation, keine OpenAPI-Datei; `/v1/audio/transcriptions` steht im
// ganzen Clone nur im eigenen Code und in dessen Tests. Ein echter Providerlauf ist nicht
// freigegeben.
//
// DESHALB GILT FÜR JEDE ZUSICHERUNG HIER: gemessen wird ausschliesslich das INTERNE Verhalten des
// Clients — welchen Dateinamen er sendet. KEINE Zusicherung dieser Datei belegt, dass der Anbieter
// extensionslose Uploads ablehnt oder die hier abgebildeten Endungen akzeptiert. Die Abbildung
// selbst (welche Endung zu welchem MIME-Typ gehört) ist damit weiterhin unbelegt; sie steht als
// Ownerfrage in der D2-Rückgabe.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { whisperClient } from "../../services/media/src/transcriber";

/** Fängt den Multipart-Upload ab und gibt den Dateinamen zurück, den der Client wirklich sendet. */
async function gesendeterDateiname(mime: string): Promise<string> {
  let gesehen = "";
  const client = whisperClient({
    apiKey: "test-key",
    fetchFn: async (_url, init) => {
      const body = init?.body as FormData | undefined;
      const datei = body?.get("file") as { name?: string } | null;
      gesehen = datei?.name ?? `KEINE DATEI (${String(datei)})`;
      return new Response(JSON.stringify({ text: "Hallo" }), { status: 200 });
    },
  });
  await client.transcribe(Buffer.from("x"), mime, "de", false);
  return gesehen;
}

// ------------------------------------------------------------------------------------------------
// DIE TABELLE — jede Zeile der Abbildung im Produktcode, einzeln benannt (BEN, Prüflücke 2).
// ------------------------------------------------------------------------------------------------
const TABELLE: ReadonlyArray<readonly [string, string]> = [
  ["audio/flac", "flac"],
  ["audio/mp3", "mp3"],
  ["audio/mpeg", "mp3"],
  ["audio/mpga", "mpga"],
  ["audio/m4a", "m4a"],
  ["audio/x-m4a", "m4a"],
  ["audio/mp4", "m4a"],
  ["audio/ogg", "ogg"],
  ["audio/oga", "oga"],
  ["audio/wav", "wav"],
  ["audio/x-wav", "wav"],
  ["audio/wave", "wav"],
  ["audio/webm", "webm"],
  ["video/mp4", "mp4"],
  ["video/mpeg", "mpeg"],
  ["video/webm", "webm"],
];

/**
 * Liest die Abbildung AUS DEM QUELLTEXT statt aus einem Export.
 *
 * Warum so und nicht über einen zusätzlichen `export`: Die Vollständigkeitszusage soll nichts an der
 * Modulfläche ändern (`services/media/index.ts` reicht bewusst nur den gecappten Transkriber nach
 * aussen). Der Quelltext ist hier die ehrlichere Quelle — er zeigt, was WIRKLICH im Produkt steht,
 * und nicht, was ein für den Test geöffneter Export behauptet.
 */
function abbildungAusQuelltext(): Array<[string, string]> {
  const quelle = new URL("../../services/media/src/transcriber.ts", import.meta.url);
  const text = readFileSync(quelle, "utf8");
  const block = /MEDIA_DATEIENDUNGEN[^{]*\{([\s\S]*?)\n\};/.exec(text);
  if (!block?.[1]) {
    return [];
  }
  return [...block[1].matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)].map((m) => [
    m[1] as string,
    m[2] as string,
  ]);
}

describe("F-0121 · die Aufnahme wird mit ihrem Format hochgeladen", () => {
  // ---- Vollständigkeit: die Tabelle deckt die Abbildung im Produktcode restlos ab.
  it("VOLLSTÄNDIGKEIT: die Tabelle deckt jeden Eintrag der Abbildung im Produktcode ab", () => {
    const imCode = abbildungAusQuelltext();
    expect(imCode.length, "keine Abbildung im Produktcode gefunden").toBeGreaterThan(0);
    expect(
      [...imCode].sort(),
      "Tabelle und Produktcode weichen voneinander ab — ein Eintrag ist ungetestet oder überzählig",
    ).toEqual([...TABELLE].map(([m, e]) => [m, e]).sort());
  });

  // ---- Fallscharf: jede abgebildete MIME-Variante einzeln.
  it.each(TABELLE)("MIME %s → Upload trägt die Endung .%s", async (mime, endung) => {
    expect(await gesendeterDateiname(mime)).toBe(`media.${endung}`);
  });

  // ---- MIME-Parameter: genau die Form, die der Browser-Rekorder liefert.
  it.each([
    ["audio/webm;codecs=opus", "webm"],
    ["audio/ogg; codecs=vorbis", "ogg"],
    ["video/mp4;codecs=avc1.42E01E", "mp4"],
  ])("MIME mit Parameter %s → Endung .%s", async (mime, endung) => {
    expect(await gesendeterDateiname(mime)).toBe(`media.${endung}`);
  });

  // ---- Schreibweise und Rand: der Code normalisiert (trim + toLowerCase); das wird hier gemessen.
  it.each([
    ["AUDIO/MPEG", "mp3"],
    ["Video/MP4", "mp4"],
    ["  audio/wav  ", "wav"],
  ])("Schreibweise/Rand %s → Endung .%s", async (mime, endung) => {
    expect(await gesendeterDateiname(mime)).toBe(`media.${endung}`);
  });

  // ---- GRENZE, BEWUSST: für einen unbekannten Typ wird KEINE Endung erfunden.
  it.each(["application/octet-stream", "audio/aiff", "text/plain", ""])(
    "unbekannter MIME-Typ %s: keine erfundene Endung",
    async (mime) => {
      expect(await gesendeterDateiname(mime)).toBe("media");
    },
  );

  // ---- Die Zusagen des bestehenden Falls bleiben unberührt (kein Umbau am Aufrufweg).
  it("unverändert: Ziel-URL, Authorization und zurückgegebener Text", async () => {
    let url = "";
    let auth = "";
    const client = whisperClient({
      apiKey: "test-key",
      fetchFn: async (u, init) => {
        url = String(u);
        auth = String((init?.headers as Record<string, string> | undefined)?.authorization ?? "");
        return new Response(JSON.stringify({ text: "Hallo" }), { status: 200 });
      },
    });
    expect(await client.transcribe(Buffer.from("x"), "video/mp4", "de", false)).toBe("Hallo");
    expect(url).toContain("/v1/audio/transcriptions");
    expect(auth).toBe("Bearer test-key");
  });
});
