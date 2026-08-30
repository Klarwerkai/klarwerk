// ================================================================================================
// JOB 2671 · D2 — DIE VORPRUEFUNG STEHT AUF EINER ERPROBTEN BIBLIOTHEK, UND DIE GRENZE IST GEMESSEN.
// ================================================================================================
//
// D1 war ROT mit gruenem Code-Urteil: *„Die API-Faelle 413, 415, 503 und 201 sind plausibel belegt,
// aber der sicherheitskritische Kern ist nicht wie beauftragt mit JSZip gebaut und die
// 30-Sekunden-Grenze ist nicht funktional nachgewiesen."* Diese Datei schliesst genau diese beiden
// Luecken — den Rest hat BEN anerkannt, er wird hier nicht neu verhandelt.
//
// VIER BLOECKE, und jeder beantwortet eine andere Frage:
//
//   Z · Faellt die praeparierte Datei an der Vorpruefung — und geht die gueltige durch?
//   M · Sieht mammoth die abgelehnte Datei WIRKLICH nie? (Eine Vorpruefung, die erst nach der
//       Umwandlung greift, prueft nur noch den bereits entstandenen Schaden.)
//   T · Greift die 30-Sekunden-Grenze funktional — nicht bloss als Zahl im Quelltext?
//   R · Und antwortet die echte Route dem Panel weiterhin so, wie D1 es belegt hat?
//
// WARUM M UND T NICHT UEBER `buildApp` LAUFEN: Beide brauchen eine eingesetzte Umwandlung (Zaehler
// bzw. haengende Zusage). `buildApp` reicht sie nicht durch, und `services/app/src/build-app.ts`
// steht NICHT in der Lease dieses Auftrags — ein Eingriff dort waere ein Lease-Verstoss. Der
// Ausweg ist keine Notloesung, sondern der genauere Schnitt: `captureRoutes` ist der ECHTE
// Routen-Plugin, hier nur ohne die Anmeldung davor. Die Anmeldung ist in Block R echt, und sie ist
// dort auch die Frage. Beide Ebenen zusammen decken, was eine allein nicht kann.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { Guards, SessionUser } from "../../services/app/src/http";
import {
  DOCX_BUSY_MESSAGE,
  DOCX_ENTPACKT_MAX_BYTES,
  DOCX_MAX_ENTPACKVERHAELTNIS,
  DOCX_UMWANDLUNG_TIMEOUT_MS,
  DOCX_UNLESBAR_MESSAGE,
  captureRoutes,
  pruefeDocxZip,
} from "../../services/app/src/routes/capture-routes";

const MIB = 1024 * 1024;
const FIXTURE = join(__dirname, "..", "fixtures", "sample.docx");

// ------------------------------------------------------------------------------------------------
// Zip-Bauer. Die Bombe wird NICHT wirklich gebaut — 300 MiB zu erzeugen waere ein Test, der den
// Rechner belastet statt ihn zu befragen. Stattdessen tragen die Groessenangaben im
// Zentralverzeichnis die Luege, genau wie eine echte Bombe es tut: winzige Daten, riesige Angabe.
// Die Vorpruefung muss an der ANGABE fallen, denn genau die liest sie.
// ------------------------------------------------------------------------------------------------
const CRC_TABELLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = (CRC_TABELLE[(c ^ b) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEintrag {
  name: string;
  data: Buffer;
  /** Groessenangaben im Zentralverzeichnis ueberschreiben — das ist die Bombe. */
  angabe?: { comp: number; uncomp: number };
}

function zip(eintraege: ZipEintrag[]): Buffer {
  const teile: Buffer[] = [];
  const zentral: Buffer[] = [];
  let offset = 0;
  for (const e of eintraege) {
    const name = Buffer.from(e.name, "utf8");
    const crc = crc32(e.data);
    const lokal = Buffer.alloc(30);
    lokal.writeUInt32LE(0x04034b50, 0);
    lokal.writeUInt16LE(20, 4);
    lokal.writeUInt16LE(0, 6);
    lokal.writeUInt16LE(0, 8); // STORED
    lokal.writeUInt32LE(0, 10);
    lokal.writeUInt32LE(crc, 14);
    lokal.writeUInt32LE(e.data.length, 18);
    lokal.writeUInt32LE(e.data.length, 22);
    lokal.writeUInt16LE(name.length, 26);
    lokal.writeUInt16LE(0, 28);
    teile.push(lokal, name, e.data);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4);
    cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0, 8);
    cen.writeUInt16LE(0, 10);
    cen.writeUInt32LE(0, 12);
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(e.angabe?.comp ?? e.data.length, 20);
    cen.writeUInt32LE(e.angabe?.uncomp ?? e.data.length, 24);
    cen.writeUInt16LE(name.length, 28);
    cen.writeUInt16LE(0, 30);
    cen.writeUInt16LE(0, 32);
    cen.writeUInt16LE(0, 34);
    cen.writeUInt16LE(0, 36);
    cen.writeUInt32LE(0, 38);
    cen.writeUInt32LE(offset, 42);
    zentral.push(cen, name);
    offset += lokal.length + name.length + e.data.length;
  }
  const cd = Buffer.concat(zentral);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(eintraege.length, 8);
  eocd.writeUInt16LE(eintraege.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...teile, cd, eocd]);
}

/** Die Summenbombe: gut 1 KiB Daten, die sich als 300 MiB entpackt ausgeben. */
function bombeUeberSumme(): Buffer {
  return zip([
    { name: "[Content_Types].xml", data: Buffer.from("<Types/>") },
    {
      name: "word/document.xml",
      data: Buffer.alloc(1024, 0),
      angabe: { comp: 1024, uncomp: 300 * MIB },
    },
  ]);
}

/** Unter der Summengrenze, aber weit ueber dem Verhaeltnis — ohne die zweite Grenze ginge sie durch. */
function bombeUeberVerhaeltnis(): Buffer {
  return zip([
    { name: "[Content_Types].xml", data: Buffer.from("<Types/>") },
    {
      name: "word/document.xml",
      data: Buffer.alloc(1024, 0),
      angabe: { comp: 1024, uncomp: 150 * MIB },
    },
  ]);
}

function ohneDocumentXml(): Buffer {
  return zip([{ name: "irgendwas.txt", data: Buffer.from("kein Word-Dokument") }]);
}

/**
 * Eine GUELTIGE, kraeftig gepackte .docx-Huelle — der Fall, den eine zu scharfe Grenze
 * faelschlich abweisen wuerde. Der Text ist echter Fliesstext (nicht ein wiederholtes Zeichen):
 * so packt er sich wie ein wirkliches Dokument, nicht wie eine Bombe. Das erreichte Verhaeltnis
 * wird im Test GEMESSEN und nicht behauptet.
 */
async function grosseGueltigeDocx(): Promise<Buffer> {
  const satz =
    "Die Vorpruefung liest das Verzeichnis des Archivs und entscheidet, ohne zu entpacken. ";
  const absatz = Array.from(
    { length: 400 },
    (_, i) => `<w:p><w:r><w:t>${i} ${satz}</w:t></w:r></w:p>`,
  ).join("");
  const archiv = new JSZip();
  archiv.file("[Content_Types].xml", "<Types/>");
  archiv.file("word/document.xml", `<w:document><w:body>${absatz}</w:body></w:document>`);
  return archiv.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

// ------------------------------------------------------------------------------------------------
// JOB 2671 D3 — DER ANGRIFF, GEGEN DEN D2 NICHT SCHUETZTE.
// ------------------------------------------------------------------------------------------------
//
// Die Groessenangaben eines Zip stehen IM ZIP. Wer eine Bombe baut, schreibt dort hin, was er
// will. Diese Funktion tut genau das: Sie setzt die unkomprimierte Groesse in allen Eintraegen —
// im Zentralverzeichnis UND im lokalen Kopf — auf einen Wunschwert, ohne die Daten anzufassen.
//
// Das Archiv bleibt danach ein GUELTIGES Zip: `JSZip.loadAsync` nimmt es an. Nur seine Auskunft
// ueber sich selbst ist gelogen.
const CD_SIG = 0x02014b50; // Zentralverzeichnis-Eintrag
const LH_SIG = 0x04034b50; // lokaler Dateikopf

function faelscheGroessenangaben(quelle: Buffer, wert: number): Buffer {
  const b = Buffer.from(quelle);
  for (let i = 0; i + 4 <= b.length; i++) {
    const sig = b.readUInt32LE(i);
    if (sig === CD_SIG) {
      b.writeUInt32LE(wert, i + 24); // CEN: uncompressed size
    } else if (sig === LH_SIG) {
      b.writeUInt32LE(wert, i + 22); // LOC: uncompressed size
    }
  }
  return b;
}

/**
 * Ein GUELTIGES DOCX, das ueber seine eigene Groesse luegt: `nutzBytes` echter Inhalt, in den
 * Groessenfeldern als `luege` deklariert.
 */
async function luegendeDocx(nutzBytes: number, luege: number): Promise<Buffer> {
  const archiv = new JSZip();
  archiv.file("[Content_Types].xml", "<Types/>");
  archiv.file("word/document.xml", "A".repeat(nutzBytes));
  const echt = await archiv.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return faelscheGroessenangaben(echt, luege);
}

/** Eine niedrige Testgrenze — BEN erlaubt sie ausdruecklich. */
const TESTGRENZE = 256 * 1024;
const CHUNK = 16 * 1024; // gemessene Chunkgroesse von jszips Node-Strom
const TESTGRENZEN = { entpacktMax: TESTGRENZE, verhaeltnisMax: DOCX_MAX_ENTPACKVERHAELTNIS };

// ================================================================================================
// Z · DIE VORPRUEFUNG SELBST
// ================================================================================================
describe("JOB 2671 D2 · Z — die Vorpruefung entscheidet am Verzeichnis, ohne zu entpacken", () => {
  it("Z1 · Summengrenze: 1 KiB, das sich als 300 MiB ausgibt → 413, und die Meldung nennt die Zahl", async () => {
    const b = bombeUeberSumme();
    // Der Beweis, dass nichts entpackt wurde, liegt schon hier: die Datei IST winzig.
    expect(b.length).toBeLessThan(2048);
    const befund = await pruefeDocxZip(b);
    expect(befund.ok).toBe(false);
    if (!befund.ok) {
      expect(befund.status).toBe(413);
      expect(befund.error).toBe("PAYLOAD_TOO_LARGE");
      expect(befund.message).toContain("entpackt zu gross");
      expect(befund.message).toContain("300 MiB");
    }
  });

  it("Z2 · Verhaeltnisgrenze: unter 200 MiB und trotzdem eine Bombe → 413", async () => {
    const b = bombeUeberVerhaeltnis();
    // Die Voraussetzung des Falls wird GEPRUEFT, nicht angenommen: unter der Summe, ueber dem
    // Verhaeltnis. Ohne diese Zeilen koennte Z2 unbemerkt zu einer zweiten Fassung von Z1 werden.
    expect(150 * MIB).toBeLessThan(DOCX_ENTPACKT_MAX_BYTES);
    expect((150 * MIB) / b.length).toBeGreaterThan(DOCX_MAX_ENTPACKVERHAELTNIS);
    const befund = await pruefeDocxZip(b);
    expect(befund.ok).toBe(false);
    if (!befund.ok) {
      expect(befund.status).toBe(413);
      expect(befund.error).toBe("PAYLOAD_TOO_LARGE");
      // Der Verhaeltnisfall hat seinen EIGENEN Satz: die Summenmeldung („erlaubt sind 200 MiB")
      // waere hier falsch — 150 MiB reissen diese Grenze gerade nicht.
      expect(befund.message).not.toContain("erlaubt sind");
      expect(befund.message).toContain(String(DOCX_MAX_ENTPACKVERHAELTNIS));
    }
  });

  it("Z3 · ein Archiv ohne word/document.xml ist kein Word-Dokument → 415", async () => {
    const befund = await pruefeDocxZip(ohneDocumentXml());
    expect(befund.ok).toBe(false);
    if (!befund.ok) {
      expect(befund.status).toBe(415);
      expect(befund.error).toBe("UNSUPPORTED_MEDIA_TYPE");
      expect(befund.message).toBe(DOCX_UNLESBAR_MESSAGE);
    }
  });

  it("Z4 · was kein lesbares Zip ist → 415 mit dem Satz, den der Mensch lesen soll", async () => {
    for (const bytes of [
      Buffer.from("Das ist eine Textdatei, nur umbenannt."),
      Buffer.alloc(0),
      Buffer.from("%PDF-1.4 ..."),
      // Ein abgeschnittenes Archiv: die ersten Bytes stimmen, der Rest fehlt.
      bombeUeberSumme().subarray(0, 40),
    ]) {
      const befund = await pruefeDocxZip(bytes);
      expect(befund.ok, `bei ${bytes.length} Bytes`).toBe(false);
      if (!befund.ok) {
        expect(befund.status).toBe(415);
        expect(befund.message).toBe(DOCX_UNLESBAR_MESSAGE);
      }
    }
  });

  it("Z5 · GEGENPROBE: eine gueltige, kraeftig gepackte .docx geht durch — die Grenze ist keine Mauer", async () => {
    const b = await grosseGueltigeDocx();
    const befund = await pruefeDocxZip(b);
    expect(befund.ok, JSON.stringify(befund)).toBe(true);
    if (befund.ok) {
      // GEMESSEN statt behauptet: die Datei packt sich wirklich kraeftig (mehr als 5:1) und faellt
      // trotzdem nicht. Genau das ist der Unterschied zwischen einer Grenze und einer Mauer.
      const verhaeltnis = befund.entpackt / befund.gepackt;
      expect(verhaeltnis).toBeGreaterThan(5);
      expect(verhaeltnis).toBeLessThanOrEqual(DOCX_MAX_ENTPACKVERHAELTNIS);
      expect(befund.eintraege).toBe(2);
    }
  });

  it("Z6 · GEGENPROBE: das echte Muster-Dokument ist ok und nennt seine Groessen", async () => {
    const befund = await pruefeDocxZip(await readFile(FIXTURE));
    expect(befund.ok, JSON.stringify(befund)).toBe(true);
    if (befund.ok) {
      expect(befund.eintraege).toBeGreaterThan(0);
      expect(befund.entpackt).toBeGreaterThan(0);
      expect(befund.entpackt).toBeLessThanOrEqual(DOCX_ENTPACKT_MAX_BYTES);
    }
  });
});

// ================================================================================================
// Der Aufbau fuer M und T: der ECHTE Routen-Plugin mit eingesetzter Umwandlung.
// ================================================================================================
const NUTZER = { id: "pedi", role: "admin", name: "Pedi", email: "pedi@job2671.test" };

const OFFENE_TUER: Guards = {
  requireUser: async () => NUTZER as unknown as SessionUser,
  requirePermission: async () => NUTZER as unknown as SessionUser,
};

type Umwandlung = (
  puffer: ArrayBuffer,
  opts: { imageBudgetBytes: number },
) => Promise<{
  html: string;
  text: string;
  imageTransfer: { totalImages: number; droppedImageBudget: number };
}>;

interface Aufbau {
  app: FastifyInstance;
  /** Wie oft die Umwandlung gerufen wurde — die Zahl, an der Block M haengt. */
  rufe: number;
}

async function baueMitUmwandlung(
  umwandlung: Umwandlung,
  // JOB 2671 D3: die Grenzen mit eingesetzt, damit der adversariale Fall ohne 200-MiB-Archiv
  // auskommt. Ohne Angabe gilt die Betriebsvorgabe — die D2-Faelle laufen unveraendert.
  grenzen?: { entpacktMax: number; verhaeltnisMax: number },
): Promise<Aufbau> {
  const stand: Aufbau = { app: Fastify(), rufe: 0 };
  await stand.app.register(
    captureRoutes(
      {
        ...buildServices(),
        docxUmwandlung: ((puffer: ArrayBuffer, opts: { imageBudgetBytes: number }) => {
          stand.rufe += 1;
          return umwandlung(puffer, opts);
        }) as never,
        ...(grenzen ? { docxGrenzen: grenzen } : {}),
      },
      OFFENE_TUER,
    ),
  );
  await stand.app.ready();
  return stand;
}

function senden(app: FastifyInstance, bytes: Buffer, name = "test.docx") {
  return app.inject({
    method: "POST",
    url: "/api/drafts/from-docx",
    payload: { name, data: bytes.toString("base64") },
  });
}

/**
 * JOB 2671 D2 — DIE EVENT-LOOP EINEN SCHRITT WEITERDREHEN.
 *
 * GEMESSEN, nicht vermutet: Mit gefaelschter Uhr blieb der erste Anlauf dieses Tests bei
 * `rufe === 0` stehen — die Anfrage kam nie bis zur Umwandlung. Der Grund liegt nicht am Timeout,
 * sondern an `JSZip.loadAsync`: es arbeitet ueber `setImmediate`, und `advanceTimersByTimeAsync`
 * loest nur Mikrotasks und gefaelschte Zeitgeber aus, keine Immediates. Die Vorpruefung waere also
 * nie fertig geworden, und der Test haette seinen eigenen Aufbau geprueft statt der Frist.
 *
 * `setImmediate` wird deshalb ABSICHTLICH nicht gefaelscht (siehe `toFake` unten), und hier ist
 * die Stelle, die der Schleife die noetigen Umdrehungen gibt.
 */
async function atmen(runden = 5): Promise<void> {
  for (let i = 0; i < runden; i++) {
    await new Promise((r) => setImmediate(r));
  }
}

async function warteBis(bedingung: () => boolean, was: string): Promise<void> {
  for (let i = 0; i < 500; i++) {
    if (bedingung()) {
      return;
    }
    await new Promise((r) => setImmediate(r));
  }
  throw new Error(`nie eingetreten: ${was}`);
}

/** Eine Umwandlung, die nie von selbst fertig wird — der Test entscheidet, wann. */
function haengendeUmwandlung(): { umwandlung: Umwandlung; fertigmelden: () => void } {
  let loesen: (() => void) | undefined;
  const zusage = new Promise<void>((r) => {
    loesen = r;
  });
  return {
    umwandlung: async () => {
      await zusage;
      return {
        html: "<p>fertig</p>",
        text: "fertig",
        imageTransfer: { totalImages: 0, droppedImageBudget: 0 },
      };
    },
    fertigmelden: () => loesen?.(),
  };
}

// ================================================================================================
// M · DIE ABGELEHNTE DATEI ERREICHT mammoth NIE
// ================================================================================================
//
// DAS IST DER EIGENTLICHE ZWECK DER VORPRUEFUNG, und ohne diesen Block waere er unbelegt: Eine
// Pruefung, die die Bombe zwar mit 413 beantwortet, sie aber vorher hat entpacken lassen, hat den
// Schaden bereits zugelassen und meldet ihn nur hinterher. Der Statuscode allein — den D1 belegt
// hat — unterscheidet die beiden Faelle NICHT. Der Aufrufzaehler tut es.
describe("JOB 2671 D2 · M — jede Ablehnung geschieht VOR der Umwandlung, nicht danach", () => {
  const abgewiesen: Array<[string, () => Buffer | Promise<Buffer>, number]> = [
    ["die Summenbombe", bombeUeberSumme, 413],
    ["die Verhaeltnisbombe", bombeUeberVerhaeltnis, 413],
    ["das Archiv ohne word/document.xml", ohneDocumentXml, 415],
    ["die Datei, die kein Zip ist", () => Buffer.from("nur Text"), 415],
  ];

  for (const [was, bauen, erwartet] of abgewiesen) {
    it(`M · ${was} → ${erwartet}, und die Umwandlung wurde NULL mal gerufen`, async () => {
      const stand = await baueMitUmwandlung(async () => {
        throw new Error("Die Umwandlung haette hier nie laufen duerfen.");
      });
      try {
        const res = await senden(stand.app, await bauen());
        expect(res.statusCode, res.body).toBe(erwartet);
        expect(stand.rufe, "die Vorpruefung hat die Datei durchgelassen").toBe(0);
      } finally {
        await stand.app.close();
      }
    });
  }

  it("M5 · GEGENPROBE: die gueltige Datei wird durchgelassen — die Umwandlung laeuft genau einmal", async () => {
    const stand = await baueMitUmwandlung(async () => ({
      html: "<p>Text</p>",
      text: "Text",
      imageTransfer: { totalImages: 0, droppedImageBudget: 0 },
    }));
    try {
      const res = await senden(stand.app, await grosseGueltigeDocx(), "gross.docx");
      expect(res.statusCode, res.body).toBe(201);
      expect(stand.rufe).toBe(1);
    } finally {
      await stand.app.close();
    }
  });
});

// ================================================================================================
// A · DER DATEI NICHT GLAUBEN — DIE TATSAECHLICHE EXPANSION ENTSCHEIDET
// ================================================================================================
//
// D2 war ROT, weil die Vorpruefung die Groessenangaben AUS DER DATEI las, die sie pruefen soll.
// BEN: *„die zentrale Schutzbehauptung gegen ZIP-Bomben ruht nur auf von der Eingabedatei
// gelieferten Groessenmetadaten."*
//
// Dieser Block ist der Gegenbeweis. Er misst nicht, was die Datei behauptet, sondern was
// tatsaechlich aus ihr herauskommt — und dass abgebrochen wird, WAEHREND das geschieht.
describe("JOB 2671 D3 · A — die Groessenangabe der Datei entscheidet nichts mehr", () => {
  it("A1 · die luegende Datei faellt an der GEMESSENEN Expansion, nicht an ihrer Angabe", async () => {
    // 4 MiB echt, 1.000 Byte behauptet. Die Angabe liegt weit UNTER der Testgrenze, die Wahrheit
    // weit darueber. Gegen den D2-Stand ging genau diese Datei durch.
    const b = await luegendeDocx(4 * MIB, 1000);
    const befund = await pruefeDocxZip(b, TESTGRENZEN);

    expect(befund.ok, "die luegende Datei wurde durchgelassen").toBe(false);
    if (!befund.ok) {
      expect(befund.status).toBe(413);
      expect(befund.error).toBe("PAYLOAD_TOO_LARGE");
      // DIE ZWEITE HAELFTE DER AUFLAGE: nicht erst alles entpacken und dann messen. Der Abbruch
      // faellt spaetestens einen Chunk hinter der Grenze — nicht bei 4 MiB.
      expect(
        befund.gemessen,
        `es wurden ${befund.gemessen} Byte materialisiert statt hoechstens ${TESTGRENZE + CHUNK}`,
      ).toBeLessThanOrEqual(TESTGRENZE + CHUNK);
      // Und mehr als die Grenze MUSS es gewesen sein, sonst haette gar nichts gemessen.
      expect(befund.gemessen).toBeGreaterThan(TESTGRENZE);
    }
  });

  it("A2 · dieselbe Datei an der ROUTE: 413 vor mammoth, die Umwandlung wird NULL mal gerufen", async () => {
    const stand = await baueMitUmwandlung(async () => {
      throw new Error("Die Umwandlung haette hier nie laufen duerfen.");
    }, TESTGRENZEN);
    try {
      const res = await senden(stand.app, await luegendeDocx(4 * MIB, 1000), "luegner.docx");
      expect(res.statusCode, res.body).toBe(413);
      expect(res.json().error).toBe("PAYLOAD_TOO_LARGE");
      expect(stand.rufe, "die Datei erreichte mammoth").toBe(0);
    } finally {
      await stand.app.close();
    }
  });

  it("A3 · der Abbruch geschieht WAEHREND des Entpackens — nachweisbar an der Zeit", async () => {
    // 64 MiB echt. Wuerde erst vollstaendig entpackt und danach gemessen, waere die Antwort
    // messbar traeger; gemessen wurden fuer einen Volldurchlauf dieser Groesse rund 100 ms, und
    // der Aufwand waechst linear mit der Archivgroesse. Der Abbruch bei 256 KiB liegt weit
    // darunter. Die Schranke ist bewusst grosszuegig — sie soll eine Groessenordnung trennen,
    // nicht Millisekunden zaehlen.
    const b = await luegendeDocx(64 * MIB, 1000);
    const start = Date.now();
    const befund = await pruefeDocxZip(b, TESTGRENZEN);
    const dauerMs = Date.now() - start;

    expect(befund.ok).toBe(false);
    if (!befund.ok) {
      expect(befund.status).toBe(413);
      // Der eigentliche Beleg: Der Verbrauch haengt NICHT an der Archivgroesse. 64 MiB statt
      // 4 MiB — und materialisiert wird dieselbe knappe Menge.
      expect(befund.gemessen).toBeLessThanOrEqual(TESTGRENZE + CHUNK);
    }
    expect(dauerMs, `die Abweisung brauchte ${dauerMs} ms`).toBeLessThan(2000);
  });

  it("A4 · eine luegende Datei UNTER der Grenze ist eine kaputte Datei (415), keine Serverstoerung", async () => {
    // Hier reisst die Grenze nicht — der Strom laeuft durch, und jszip merkt am Ende selbst, dass
    // die Angabe nicht stimmt (`uncompressed data size mismatch`). Das ist kein 500.
    const stand = await baueMitUmwandlung(async () => {
      throw new Error("Die Umwandlung haette hier nie laufen duerfen.");
    }, TESTGRENZEN);
    try {
      const b = await luegendeDocx(32 * 1024, 1000); // 32 KiB echt, unter der Testgrenze
      const res = await senden(stand.app, b, "kleiner-luegner.docx");
      expect(res.statusCode, res.body).toBe(415);
      expect(res.json().error).toBe("UNSUPPORTED_MEDIA_TYPE");
      expect(res.json().message).toBe(DOCX_UNLESBAR_MESSAGE);
      expect(stand.rufe, "die Datei erreichte mammoth").toBe(0);
    } finally {
      await stand.app.close();
    }
  });

  it("A5 · GEGENPROBE: die EHRLICHE Datei unter der Grenze geht durch — die Messung ist keine Mauer", async () => {
    // Ohne diesen Fall waere auch eine Fassung gruen, die nach der Ergaenzung schlicht alles
    // ablehnt. Die Datei ist echt komprimiert und sagt die Wahrheit ueber sich.
    // FLIESSTEXT, nicht ein wiederholtes Zeichen: GEMESSEN im ersten Lauf dieses Durchgangs fiel
    // dieser Fall zunaechst an der VERHAELTNISgrenze — 100 KiB gleiche Buchstaben packen sich ueber
    // 100:1 und sind damit selbst bombenaehnlich. Der Fall soll aber ein gewoehnliches Dokument
    // darstellen, und ein solches packt sich wie Text.
    const satz = "Die Vorpruefung zaehlt, was wirklich herauskommt, und glaubt der Datei nicht. ";
    let text = "";
    let i = 0;
    while (text.length < 100 * 1024) {
      text += `${i++} ${satz}`;
    }
    const archiv = new JSZip();
    archiv.file("[Content_Types].xml", "<Types/>");
    archiv.file("word/document.xml", text);
    const b = await archiv.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

    const befund = await pruefeDocxZip(b, TESTGRENZEN);
    expect(befund.ok, JSON.stringify(befund)).toBe(true);
    if (befund.ok) {
      // GEMESSEN, nicht deklariert: die Summe stammt aus dem Strom.
      expect(befund.entpackt).toBeGreaterThan(100 * 1024);
      expect(befund.entpackt).toBeLessThanOrEqual(TESTGRENZE);
    }

    const stand = await baueMitUmwandlung(
      async () => ({
        html: "<p>Text</p>",
        text: "Text",
        imageTransfer: { totalImages: 0, droppedImageBudget: 0 },
      }),
      TESTGRENZEN,
    );
    try {
      const res = await senden(stand.app, b, "ehrlich.docx");
      expect(res.statusCode, res.body).toBe(201);
      expect(stand.rufe).toBe(1);
    } finally {
      await stand.app.close();
    }
  });

  it("A6 · der Abbruchweg steht im Quelltext fest: nodeStream und destroy, kein pause", async () => {
    // DIESER FALL IST KEIN FORMALISMUS, und die Begruendung ist gemessen: Mit
    // `internalStream(...).pause()` liefen nach dem Abbruch noch 507 Chunks durch — die vollen
    // 8 MiB. Die ZAEHLUNG stoppt dabei trotzdem, also waeren A1 bis A3 ebenfalls gruen gewesen,
    // waehrend der Schutz keiner ist. Dieser Unterschied ist an der Antwort nicht zu sehen; er
    // steht nur im Quelltext. Deshalb wird er hier gepinnt.
    const quelle = await readFile(
      join(__dirname, "..", "..", "services", "app", "src", "routes", "capture-routes.ts"),
      "utf8",
    );
    const abschnitt = quelle.slice(quelle.indexOf("async function zaehleEchteExpansion"));
    const rumpf = abschnitt.slice(0, abschnitt.indexOf("\nexport async function pruefeDocxZip"));

    expect(rumpf, "die Zaehlung nutzt nicht den abbrechbaren Node-Strom").toContain(
      'nodeStream("nodebuffer")',
    );
    expect(rumpf, "es gibt keinen Abbruch ueber destroy()").toContain("destroy");
    expect(rumpf, "internalStream ist als Abbruchweg gemessen untauglich").not.toContain(
      "internalStream",
    );
    expect(
      rumpf,
      "pause() haelt den Strom nicht an — als Abbruchmittel ausgeschlossen",
    ).not.toContain(".pause(");
  });
});

// ================================================================================================
// T · DIE 30-SEKUNDEN-GRENZE, FUNKTIONAL
// ================================================================================================
//
// D1 hat die Zahl in den Quelltext geschrieben; BEN wollte sie WIRKEN sehen. Der Unterschied ist
// nicht akademisch: eine Konstante, die an keinem Timer haengt, laesst den Nutzer unbegrenzt warten
// und niemand merkt es.
//
// WARUM NUR `setTimeout` GEFAELSCHT WIRD: `JSZip.loadAsync` und Fastifys Zustellung laufen ueber
// `setImmediate`. Wuerde vitest das mitfaelschen (seine Vorgabe), stuende die Vorpruefung still und
// der Test pruefte seinen eigenen Aufbau statt der Grenze. Gefaelscht wird deshalb genau die Uhr,
// an der die Route haengt — und keine andere.
describe("JOB 2671 D2 · T — die 30-Sekunden-Grenze greift wirklich", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("T1 · vor der Frist keine Antwort, AN der Frist 503 BUSY — und der Slot bleibt bis zum Ende belegt", async () => {
    const { umwandlung, fertigmelden } = haengendeUmwandlung();
    const stand = await baueMitUmwandlung(umwandlung);
    try {
      // Die gueltige Datei entsteht VOR der gefaelschten Uhr — sie zu bauen hat mit der Frist
      // nichts zu tun, und JSZip braucht dafuer eine echte Event-Loop.
      const gueltig = await grosseGueltigeDocx();
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      let fertig = false;
      const antwort = senden(stand.app, gueltig, "haengt.docx").then((r) => {
        fertig = true;
        return r;
      });

      // Erst wenn die Umwandlung ANGELAUFEN ist, steht der Zeitgeber, um den es geht. Bis dahin
      // laeuft die Vorpruefung, und die haengt an Immediates, nicht an der Uhr.
      await warteBis(() => stand.rufe === 1, "die Umwandlung laeuft an");
      await atmen();

      // (a) EINE MILLISEKUNDE VOR DER FRIST liegt noch keine Antwort vor. Ohne diese Haelfte
      // wuerde ein Timeout von 0 ms den Test genauso bestehen — er pruefte dann nur, DASS
      // abgebrochen wird, nicht WANN.
      await vi.advanceTimersByTimeAsync(DOCX_UMWANDLUNG_TIMEOUT_MS - 1);
      await atmen();
      expect(fertig, "die Route hat vor der Frist geantwortet").toBe(false);

      // (b) AN der Frist kommt 503 BUSY.
      await vi.advanceTimersByTimeAsync(1);
      await atmen();
      const res = await antwort;
      expect(res.statusCode, res.body).toBe(503);
      expect(res.json().error).toBe("BUSY");
      expect(res.json().message).toBe(DOCX_BUSY_MESSAGE);
      expect(res.headers["retry-after"]).toBe("30");

      // (c) SETTLE-PFLICHT: die Umwandlung laeuft noch, also bleibt der Slot belegt. Ein zweiter
      // Versuch wird abgewiesen — und zwar ohne dass die Umwandlung ein zweites Mal anlaeuft.
      // Genau das ist der Sinn: mammoth kennt kein Abbruchsignal, ein zweiter Lauf daneben waere
      // die Doppelbelastung, die der Slot verhindern soll.
      const waehrenddessen = await senden(stand.app, gueltig, "zweite.docx");
      expect(waehrenddessen.statusCode, waehrenddessen.body).toBe(503);
      expect(waehrenddessen.json().error).toBe("BUSY");
      expect(stand.rufe, "die Umwandlung lief ein zweites Mal an").toBe(1);

      // (d) NACH dem Settlement ist der Slot frei. Die haengende Umwandlung meldet sich fertig;
      // erst danach darf der naechste durch.
      fertigmelden();
      await atmen(20);
      const danach = await senden(stand.app, gueltig, "dritte.docx");
      expect(danach.statusCode, danach.body).toBe(201);
      expect(stand.rufe).toBe(2);
    } finally {
      fertigmelden();
      await stand.app.close();
    }
  });
});

// ================================================================================================
// R · DIE ECHTE ROUTE, MIT ECHTER ANMELDUNG
// ================================================================================================
//
// Die vier von BEN anerkannten Faelle werden hier NICHT neu verhandelt — sie stehen als Gegenprobe,
// damit der Umbau von D1s Parser auf JSZip belegt nichts an der Wire-Antwort verschoben hat. Das
// ist der eigentliche Zweck dieses Blocks: nachweisen, dass der Austausch des Kerns nach aussen
// unsichtbar blieb.
type App = ReturnType<typeof buildApp>;

async function angemeldet(): Promise<{ app: App; cookie: string }> {
  const app = buildApp(buildServices());
  await app.ready();
  const reg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@job2671d2.test", password: "geheim12345" },
  });
  expect(reg.statusCode, `Registrierung fehlgeschlagen: ${reg.body}`).toBeLessThan(300);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job2671d2.test", password: "geheim12345" },
  });
  expect(login.statusCode, `Login fehlgeschlagen: ${login.body}`).toBe(200);
  const cookie = String(login.headers["set-cookie"] ?? "").split(";")[0] ?? "";
  expect(cookie.length).toBeGreaterThan(0);
  return { app, cookie };
}

function sendenAngemeldet(app: App, cookie: string, bytes: Buffer, name = "test.docx") {
  return app.inject({
    method: "POST",
    url: "/api/drafts/from-docx",
    headers: { cookie },
    payload: { name, data: bytes.toString("base64") },
  });
}

describe("JOB 2671 D2 · R — die Wire-Antwort blieb dieselbe, obwohl der Kern getauscht wurde", () => {
  it("R1 · die Bombe → 413 in unter zwei Sekunden (die Abweisung kommt aus dem Verzeichnis, nicht aus mammoth)", async () => {
    const { app, cookie } = await angemeldet();
    try {
      const start = Date.now();
      const res = await sendenAngemeldet(app, cookie, bombeUeberSumme(), "bombe.docx");
      const dauerMs = Date.now() - start;
      expect(res.statusCode, res.body).toBe(413);
      expect(res.json().error).toBe("PAYLOAD_TOO_LARGE");
      expect(dauerMs, `413 kam erst nach ${dauerMs} ms`).toBeLessThan(2000);
    } finally {
      await app.close();
    }
  });

  it("R2 · kein Zip → 415 mit dem lesbaren Satz, kein 500", async () => {
    const { app, cookie } = await angemeldet();
    try {
      const res = await sendenAngemeldet(
        app,
        cookie,
        Buffer.from("Das ist eine Textdatei, umbenannt."),
        "notiz.docx",
      );
      expect(res.statusCode, res.body).toBe(415);
      expect(res.json().error).toBe("UNSUPPORTED_MEDIA_TYPE");
      expect(res.json().message).toBe(DOCX_UNLESBAR_MESSAGE);
    } finally {
      await app.close();
    }
  });

  it("R3 · zweite gleichzeitige Umwandlung → 503 BUSY; danach ist der Slot wieder frei", async () => {
    const { app, cookie } = await angemeldet();
    try {
      const echt = await readFile(FIXTURE);
      const [erste, zweite] = await Promise.all([
        sendenAngemeldet(app, cookie, echt, "erste.docx"),
        sendenAngemeldet(app, cookie, echt, "zweite.docx"),
      ]);
      const codes = [erste.statusCode, zweite.statusCode].sort();
      expect(codes, `${erste.body}\n${zweite.body}`).toEqual([201, 503]);
      const abgewiesen = erste.statusCode === 503 ? erste : zweite;
      expect(abgewiesen.json().error).toBe("BUSY");
      expect(abgewiesen.headers["retry-after"]).toBe("30");
      const dritte = await sendenAngemeldet(app, cookie, echt, "dritte.docx");
      expect(dritte.statusCode, dritte.body).toBe(201);
    } finally {
      await app.close();
    }
  });

  it("R4 · GEGENPROBE: ein echtes .docx wird unveraendert 201 mit Entwurf und Bildbilanz", async () => {
    const { app, cookie } = await angemeldet();
    try {
      const res = await sendenAngemeldet(app, cookie, await readFile(FIXTURE), "sample.docx");
      expect(res.statusCode, res.body).toBe(201);
      const body = res.json();
      expect(typeof body.id).toBe("string");
      expect(typeof body.imagesEmbedded).toBe("number");
      expect(typeof body.imagesTotal).toBe("number");
    } finally {
      await app.close();
    }
  });
});

// ================================================================================================
// W · JOB 2671 D7 — HOERT AUCH DER PRODUZENT AUF? DIE ARBEIT DES DEKOMPRESSIONSWORKERS, GEMESSEN.
// ================================================================================================
//
// BEN, PRODUKT ROT zu D3: „belegt aber nicht, dass `destroy()` auch die zugrunde liegende
// JSZip-Dekompression beendet statt nur deren weitere Ausgabe zu verwerfen." Und: „Ein blosses
// Ausbleiben weiterer `data`-Ereignisse und ein Quelltext-Pin auf `destroy` genuegen nicht."
//
// WAS HIER GEMESSEN WIRD — und wo: jszips Entpackkette fuer einen Eintrag ist
//   DataWorker (16-KiB-Bloecke des GEPACKTEN Inhalts, je Block ein setImmediate-Tick)
//   → FlateWorker/Inflate (pako; je Eingabeblock beliebig viele 16-KiB-Ausgabebloecke)
//   → DataLengthProbe → ConvertWorker → StreamHelper → NodejsStreamOutputAdapter (Readable).
// Der PRODUZENT ist der FlateWorker: was er per `push` weitergibt, hat pako wirklich entpackt —
// unabhaengig davon, ob am Ende der Kette noch jemand zuhoert. Genau dort setzt die Sonde an:
// `FlateWorker.prototype.push` (Ausgabebytes) und `FlateWorker.prototype.processChunk`
// (verarbeitete Eingabebloecke). Kein Pin auf Quelltext, kein Zaehlen beim Verbraucher.
//
// DIE NACHLAUFGRENZE, als Zahl und mit Begruendung — GEMESSEN im ersten Lauf dieses Durchgangs,
// nicht hergeleitet: pako entpackt einen Eingabeblock in EINEM synchronen Aufruf; der Abbruch im
// `data`-Ereignis des Verbrauchers kann diesen Aufruf nicht unterbrechen (bei Rueckkehr der
// Vorpruefung waren 16.908.003 Byte entpackt = ein 16-KiB-Block bei 1032:1). Danach folgte
// GENAU EIN weiterer Eingabeblock (+16.859.136 Byte), dann Stillstand. Hypothese zum zweiten
// Block (kein Fehlertrace, aus dem Quelltext von jszip 3.10.1 gelesen): `DataWorker._tickAndRepeat`
// plant den naechsten Tick per setImmediate, BEVOR die Pause ueber den Rueckstau des Readable
// (`push` liefert false → `helper.pause()`) beim DataWorker ankommt; dieser eine Tick laeuft
// noch. Grenze also ZWEI gepackte 16-KiB-Bloecke bei maximaler Deflate-Expansion 1032:1:
// 2 × 16 KiB × 1032 = 33.816.576 Byte ueber der injizierten Testgrenze, und hoechstens zwei
// Eingabebloecke insgesamt, wenn die Grenze im ersten reisst. Eine Fassung, die den Worker gar
// nicht anhaelt, entpackt die ganze 64-MiB-Datei (fuenf Bloecke) und reisst beide Schranken.
const NACHLAUF_BLOECKE = 2;
const NACHLAUF_MAX_BYTES = NACHLAUF_BLOECKE * 16 * 1024 * 1032;

interface WorkerSonde {
  ausgabeBytes: number;
  ausgabeBloecke: number;
  eingabeBloecke: number;
  loesen(): void;
}

/**
 * Setzt die Sonde auf den Prototyp des Inflate-Workers (jszip/lib/flate). Der Prototyp wird ueber
 * eine echte Instanz geholt (`uncompressWorker()`), nicht ueber einen Modulpfad geraten; die
 * Methoden werden als EIGENE Eigenschaften des FlateWorker-Prototyps gesetzt und in `loesen()`
 * wieder entfernt bzw. zurueckgestellt — GenericWorker bleibt unangetastet.
 */
function sondeSetzen(): WorkerSonde {
  const laden = createRequire(__filename);
  const flate = laden("jszip/lib/flate") as { uncompressWorker(): object };
  const proto = Object.getPrototypeOf(flate.uncompressWorker()) as {
    push?: (chunk: { data: Uint8Array }) => void;
    processChunk: (chunk: { data: Uint8Array }) => void;
  };
  const hatteEigenesPush = Object.prototype.hasOwnProperty.call(proto, "push");
  expect(hatteEigenesPush, "FlateWorker.prototype.push ist bereits belegt").toBe(false);
  const generisch = Object.getPrototypeOf(proto) as {
    push: (chunk: { data: Uint8Array }) => void;
  };
  const eigenesProcessChunk = proto.processChunk;
  const sonde: WorkerSonde = {
    ausgabeBytes: 0,
    ausgabeBloecke: 0,
    eingabeBloecke: 0,
    loesen() {
      Reflect.deleteProperty(proto, "push");
      proto.processChunk = eigenesProcessChunk;
    },
  };
  // NUR die Inflate-Richtung zaehlt: FlateWorker ist fuer Deflate UND Inflate derselbe Prototyp,
  // und die Testdateien entstehen per generateAsync (Deflate) — GEMESSEN im ersten Lauf: ohne
  // diesen Filter zaehlte die Sonde 4.096 Deflate-Eingabebloecke des Dateibaus mit.
  const istInflate = (w: object): boolean =>
    (w as { _pakoAction?: string })._pakoAction === "Inflate";
  proto.push = function (this: object, chunk: { data: Uint8Array }) {
    if (istInflate(this)) {
      sonde.ausgabeBytes += chunk.data.length;
      sonde.ausgabeBloecke += 1;
    }
    return generisch.push.call(this, chunk);
  };
  proto.processChunk = function (this: object, chunk: { data: Uint8Array }) {
    if (istInflate(this)) {
      sonde.eingabeBloecke += 1;
    }
    return eigenesProcessChunk.call(this, chunk);
  };
  return sonde;
}

/** Wartet, bis der Worker 150 ms lang nichts mehr erzeugt hat — oder gibt nach 5 s auf. */
async function stillstandAbwarten(sonde: WorkerSonde): Promise<number> {
  const start = Date.now();
  let letzterStand = sonde.ausgabeBytes;
  let ruhigSeit = Date.now();
  while (Date.now() - start < 5000) {
    await new Promise((r) => setImmediate(r));
    if (sonde.ausgabeBytes !== letzterStand) {
      letzterStand = sonde.ausgabeBytes;
      ruhigSeit = Date.now();
    } else if (Date.now() - ruhigSeit > 150) {
      return Date.now() - start;
    }
  }
  throw new Error(`der Worker kam in 5 s nicht zur Ruhe (${sonde.ausgabeBytes} Byte)`);
}

describe("JOB 2671 D7 · W — der Dekompressionsworker hoert auf, nicht nur die Zustellung", () => {
  let sonde: WorkerSonde | null = null;
  afterEach(() => {
    sonde?.loesen();
    sonde = null;
  });

  it("W0 · KALIBRIERUNG: die Sonde zaehlt, was pako wirklich entpackt — bei der ehrlichen Datei gleich der Summe", async () => {
    sonde = sondeSetzen();
    // Fliesstext wie in A5 — gleiche Buchstaben packen sich ueber 100:1 und fielen im ersten Lauf
    // an der Verhaeltnisgrenze (413), der Fall soll aber die EHRLICHE Datei sein.
    const satz =
      "Der Worker entpackt hier alles, denn niemand bricht ab, und die Sonde zaehlt mit. ";
    let text = "";
    let i = 0;
    while (text.length < 100 * 1024) {
      text += `${i++} ${satz}`;
    }
    const archiv = new JSZip();
    archiv.file("[Content_Types].xml", "<Types/>");
    archiv.file("word/document.xml", text);
    const b = await archiv.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const befund = await pruefeDocxZip(b, TESTGRENZEN);
    await stillstandAbwarten(sonde);
    expect(befund.ok, JSON.stringify(befund)).toBe(true);
    if (befund.ok) {
      // Ohne Abbruch entpackt der Worker genau die Summe, die die Vorpruefung zaehlt.
      expect(sonde.ausgabeBytes).toBe(befund.entpackt);
    }
    expect(sonde.eingabeBloecke).toBeGreaterThan(0);
  });

  it("W1 · 64 MiB, die als 1.000 Byte auftreten, an der ROUTE: 413 vor mammoth, stand.rufe === 0 — und der Worker entpackt hoechstens fest begrenzt weiter", async () => {
    sonde = sondeSetzen();
    const stand = await baueMitUmwandlung(async () => {
      throw new Error("Die Umwandlung haette hier nie laufen duerfen.");
    }, TESTGRENZEN);
    try {
      const b = await luegendeDocx(64 * MIB, 1000);
      const res = await senden(stand.app, b, "luegner-64.docx");
      const beiAntwort = sonde.ausgabeBytes;
      const ruheNachMs = await stillstandAbwarten(sonde);
      console.info(
        `JOB 2671 · W1 · gepackt ${b.length} Byte · Worker bei Antwort ${beiAntwort} Byte · Worker gesamt ${sonde.ausgabeBytes} Byte in ${sonde.ausgabeBloecke} Ausgabebloecken aus ${sonde.eingabeBloecke} Eingabebloecken · Ruhe nach ${ruheNachMs} ms`,
      );
      expect(res.statusCode, res.body).toBe(413);
      expect(res.json().error).toBe("PAYLOAD_TOO_LARGE");
      expect(stand.rufe, "die Datei erreichte mammoth").toBe(0);
      // DIE WORKER-ASSERTION — hier wird die Gegenmutation rot, nicht an 413 und nicht an rufe:
      expect(
        sonde.ausgabeBytes,
        `der Dekompressionsworker hat ${sonde.ausgabeBytes} Byte entpackt — erlaubt sind hoechstens Testgrenze ${TESTGRENZE} plus Nachlauf ${NACHLAUF_MAX_BYTES}`,
      ).toBeLessThanOrEqual(TESTGRENZE + NACHLAUF_MAX_BYTES);
      // Die zweite Schranke: der erste Eintrag `[Content_Types].xml` ist ein eigener Block (gemessen),
      // dann der Block, in dem die Grenze riss, dann hoechstens EIN weiterer — zusammen drei. Die
      // volle Datei haette fuenf Bloecke document.xml plus einen.
      expect(
        sonde.eingabeBloecke,
        "der Worker hat weitere Eingabebloecke geholt",
      ).toBeLessThanOrEqual(1 + NACHLAUF_BLOECKE);
      // Und der Rest blieb liegen: die volle Expansion waere 64 MiB in fuenf Bloecken.
      expect(sonde.ausgabeBytes).toBeLessThan(48 * MIB);
    } finally {
      await stand.app.close();
    }
  });

  it("W2 · dieselbe Messung an der Funktion: nach der Rueckkehr holt der Worker keinen weiteren Eingabeblock", async () => {
    sonde = sondeSetzen();
    const b = await luegendeDocx(64 * MIB, 1000);
    const befund = await pruefeDocxZip(b, TESTGRENZEN);
    const beiRueckkehr = sonde.ausgabeBytes;
    const bloeckeBeiRueckkehr = sonde.eingabeBloecke;
    await stillstandAbwarten(sonde);
    console.info(
      `JOB 2671 · W2 · bei Rueckkehr ${beiRueckkehr} Byte / ${bloeckeBeiRueckkehr} Eingabebloecke · danach ${sonde.ausgabeBytes - beiRueckkehr} Byte / ${sonde.eingabeBloecke - bloeckeBeiRueckkehr} Eingabebloecke`,
    );
    expect(befund.ok).toBe(false);
    if (!befund.ok) {
      expect(befund.status).toBe(413);
      expect(befund.gemessen).toBeLessThanOrEqual(TESTGRENZE + CHUNK);
    }
    expect(sonde.ausgabeBytes).toBeLessThanOrEqual(TESTGRENZE + NACHLAUF_MAX_BYTES);
    expect(sonde.eingabeBloecke - bloeckeBeiRueckkehr).toBeLessThanOrEqual(1);
  });
});
