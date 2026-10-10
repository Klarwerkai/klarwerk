// ================================================================================================
// OFFICE IM ARTIKEL · WERKZEUG DER HOSTWEG-PROBEN (Auftrag produkt:20261007:office-machbarkeit).
// ================================================================================================
//
// Drei Dinge, die die Unit-Gegenprobe (`hostweg.test.ts`) und die CODE-Integrationsprobe
// (`code-probe.integration.test.ts`) gemeinsam brauchen:
//
//   · `ArtikelAttrappe` — der Vertrag `WopiArtikelZugriff` mit bedingtem Schritt (KO_STALE). Er
//     steht für die noch fehlende Dienstmethode „Office-Fassung übernehmen" (Plan U3); er ist
//     KEIN Wissensobjektdienst und belegt dessen Verhalten nicht.
//   · `fiktivesDocx` / `docxText` — eine kleine, gültige Word-Datei mit fiktivem Inhalt und ihr
//     Text zum Nachprüfen.
//   · `starteHostServer` — `node:http` vor `erstelleWopiHost`, ohne eigene Logik: Pfad, Abfrage,
//     Kopfzeilen und Körper hinein, Status, Kopfzeilen und Körper hinaus. Die Probe trifft damit
//     genau die Hostfunktion, die U2 in Fastify verdrahtet.
//
// Hier wird KEIN Browser gestartet (kein Playwright-Import) — die Datei bleibt außerhalb der
// Browser-Gruppe aus `tests/tor-inventar/browser-gruppe.ts`.

import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import JSZip from "jszip";
import { OFFICE_FORMATE } from "../../services/app/src/office-wopi";
import type {
  WopiAntwort,
  WopiArtikel,
  WopiArtikelZugriff,
} from "../../services/app/src/office-wopi-host";

/** Der Medientyp aus derselben Tabelle, die der Host befragt — nicht abgeschrieben. */
export const DOCX_MIME = ((): string => {
  const docx = OFFICE_FORMATE.find((f) => f.endung === "docx");
  if (!docx) {
    throw new Error("OFFICE_FORMATE führt kein .docx");
  }
  return docx.mime;
})();

export class ArtikelAttrappe implements WopiArtikelZugriff {
  stand: WopiArtikel;
  /** Jede Fassung mit dem Objekt, das ihr Anhang trug — der Versionsrückweg der Probe. */
  readonly fassungen: { version: number; objectId: string }[] = [];

  constructor(start: WopiArtikel) {
    this.stand = start;
    const objekt = start.attachments[0]?.objectId;
    if (objekt) {
      this.fassungen.push({ version: start.version, objectId: objekt });
    }
  }

  async lies(koId: string): Promise<WopiArtikel | undefined> {
    return koId === this.stand.koId ? this.stand : undefined;
  }

  async uebernimm(args: {
    koId: string;
    anhangId: string;
    objectId: string;
    size: number;
    expectedVersion: number;
  }): Promise<{ version: number }> {
    if (args.koId !== this.stand.koId) {
      throw Object.assign(new Error("Wissensobjekt nicht gefunden."), { code: "NOT_FOUND" });
    }
    if (this.stand.version !== args.expectedVersion) {
      throw Object.assign(new Error("Der Eintrag steht inzwischen auf einer anderen Version."), {
        code: "KO_STALE",
      });
    }
    const version = this.stand.version + 1;
    this.stand = {
      ...this.stand,
      version,
      // Dieselbe Bedeutung wie `revise`: neue Fassung, muss neu geprüft werden.
      status: "offen",
      attachments: this.stand.attachments.map((a) =>
        a.id === args.anhangId ? { ...a, objectId: args.objectId, size: args.size } : a,
      ),
    };
    this.fassungen.push({ version, objectId: args.objectId });
    return { version };
  }

  /** Jemand schreibt AUSSERHALB der Editor-Sitzung am Artikel (z. B. im Klarwerk-Texteditor). */
  fremdeAenderung(): void {
    this.stand = { ...this.stand, version: this.stand.version + 1, status: "offen" };
  }
}

/** Eine minimale, gültige DOCX-Datei mit einem Absatz fiktiven Texts. */
export async function fiktivesDocx(absatz: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      "</Types>",
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      "</Relationships>",
  );
  const w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${w}"><w:body><w:p><w:r><w:t>${absatz}</w:t></w:r></w:p></w:body></w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

/** Der reine Text von `word/document.xml` (alle `w:t` aneinander). */
export async function docxText(bytes: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
  return [...xml.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((t) => t[1]).join("");
}

export interface HostServer {
  readonly server: Server;
  readonly port: number;
  /** Eine zusätzliche Seite, die der Server unter `/probe` ausliefert (die einbettende Seite). */
  setzeSeite(html: string): void;
  schliesse(): Promise<void>;
}

/** `node:http` vor dem Hostweg. Lauscht auf allen Schnittstellen, damit ein Container ihn erreicht. */
export async function starteHostServer(
  bearbeite: (anfrage: {
    methode: string;
    pfad: string;
    accessToken: string | undefined;
    kopf: (name: string) => string | undefined;
    koerper: Buffer;
  }) => Promise<WopiAntwort>,
): Promise<HostServer> {
  let seite = "<!doctype html><title>leer</title>";
  const server = createServer((req, res) => {
    const teile: Buffer[] = [];
    req.on("data", (teil: Buffer) => teile.push(teil));
    req.on("end", () => {
      const url = new URL(req.url ?? "/", "http://probe.invalid");
      if (url.pathname === "/probe") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(seite);
        return;
      }
      bearbeite({
        methode: req.method ?? "GET",
        pfad: url.pathname,
        accessToken: url.searchParams.get("access_token") ?? undefined,
        kopf: (name) => {
          const wert = req.headers[name.toLowerCase()];
          return Array.isArray(wert) ? wert[0] : wert;
        },
        koerper: Buffer.concat(teile),
      }).then(
        (antwort) => {
          const kopf: Record<string, string> = { ...antwort.kopf };
          if (antwort.json !== undefined) {
            kopf["Content-Type"] = "application/json";
            res.writeHead(antwort.status, kopf);
            res.end(JSON.stringify(antwort.json));
          } else if (antwort.bytes !== undefined) {
            kopf["Content-Type"] = "application/octet-stream";
            res.writeHead(antwort.status, kopf);
            res.end(antwort.bytes);
          } else {
            res.writeHead(antwort.status, kopf);
            res.end();
          }
        },
        () => {
          res.writeHead(500);
          res.end();
        },
      );
    });
  });
  await new Promise<void>((fertig) => server.listen(0, "0.0.0.0", fertig));
  const port = (server.address() as AddressInfo).port;
  return {
    server,
    port,
    setzeSeite(html) {
      seite = html;
    },
    schliesse: () => new Promise<void>((fertig) => server.close(() => fertig())),
  };
}
