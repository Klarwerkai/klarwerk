// ================================================================================================
// JOB 2703 · D2 — EINE KUERZUNGSREGEL FUER BEIDE WEGE: der Paritaetstest.
// ================================================================================================
//
// PEDIS FRAGE: „Zeigt Klara denselben Text ueberall gleich gekuerzt — oder je nach Weg anders?"
//
// BEN an D1: „Confluence-Mapper und Word-Serverroute `capture-routes.ts` muessen dieselbe kanonische
// Kuerzungsfunktion aufrufen … Beleg: gemeinsamer Paritaetstest mit identischem Ergebnis beider
// Wege." — „Zeichengenau ist Absicht."
//
// DIE WEGE, gemessen an den ECHTEN Produktionsstellen:
//   · CONFLUENCE  `mapConfluencePageToImportItem` (services/confluence/src/mapper.ts) → `statement`
//   · WORD/DOCX   `POST /api/drafts/from-docx` (services/app/src/routes/capture-routes.ts) mit einer
//                 echten .docx; der Ausgangstext ist der, den `extractDocxRich` aus ihr liest —
//                 derselbe Text geht als Absatz durch den Mapper
//   · WORD/ADD-IN `POST /api/drafts` mit der Rohaussage, wie das Aufgabenfenster und die Vordertuer
//                 sie seit 2703 senden (Client kuerzt nicht mehr)
//   · SPEICHERN   `PUT /api/drafts/:id` mit der Rohaussage — der Speicherweg darf die Kuerzung nicht
//                 unterlaufen
// Alle vier liefern fuer denselben Ausgangstext ZEICHENGENAU dieselbe Kernaussage; der Volltext
// bleibt im Body erhalten. Die GEGENPROBE (Auftrag §3) faehrt der Durchgang aeusserlich: eine
// Aufrufstelle auf die alte Regel zurueckgedreht macht genau den benannten Fall rot.
import { describe, expect, it } from "vitest";
import { extractDocxRich } from "../../apps/web/src/lib/docx";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { mapConfluencePageToImportItem } from "../../services/confluence/src/mapper";
import type { ConfluencePage } from "../../services/confluence/src/rest-client";
import { KERNAUSSAGE_MAX, kernaussageAusKlartext } from "../../services/structure";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

const OPTS = { baseUrl: "https://acme.atlassian.net/wiki", spaceKey: "K" };

/** Ein Ausgangstext mit Satzgrenzen, laenger als KERNAUSSAGE_MAX — im Fenster liegt eine Satzgrenze. */
const SATZ_1 =
  "Bei Ueberdruck ueber 6 bar ist Ventil X sofort zu schliessen und der Vorgang zu melden.";
const SATZ_2 =
  "Danach wird der Druck am Manometer M4 abgelesen, im Schichtbuch vermerkt und die Ursache gesucht.";
const SATZ_3 =
  "Erst nach Freigabe durch den Schichtleiter darf die Anlage wieder anfahren; vorher bleibt sie stehen.";
const SATZ_4 =
  "Die Freigabe wird mit Datum und Handzeichen im Anlagenbuch eingetragen und dem Meister gemeldet.";
const SATZ_5 =
  "Bei wiederholtem Ueberdruck innerhalb einer Woche ist die Instandhaltung einzuschalten und die Anlage zu pruefen.";
const SATZ_6 =
  "Diese Regel gilt fuer alle Schichten und alle Anlagen des Werks ohne Ausnahme und wird jaehrlich unterwiesen.";
const TEXT = [SATZ_1, SATZ_2, SATZ_3, SATZ_4, SATZ_5, SATZ_6].join(" ");

function seite(bodyHtml: string): ConfluencePage {
  return {
    id: "2703",
    title: "Ueberdruck an Ventil X",
    body: { storage: { value: bodyHtml } },
    version: { number: 1 },
    _links: { webui: "/spaces/K/pages/2703/x" },
    metadata: { labels: { results: [] } },
    restrictions: { read: { restrictions: { user: { results: [] }, group: { results: [] } } } },
  };
}

async function app() {
  const services = buildServices();
  const a = buildApp(services);
  await a.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@job2703.test", password: "geheim12345" },
  });
  const login = await a.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@job2703.test", password: "geheim12345" },
  });
  return { a, services, admin: { authorization: `Bearer ${login.json().token as string}` } };
}

// Die echte .docx aus JOB 2613 (ein Textabsatz, ohne Bilder) — ihr Text ist der Ausgangstext des
// Docx-Wegs; derselbe Text geht als Absatz durch den Mapper.
const DOCX_OHNE_BILDER =
  "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";

describe("JOB 2703 · D2 · Paritaet: dieselbe Kuerzung auf jedem Weg, zeichengenau", () => {
  it("P0 · Kalibrierung: der Ausgangstext ist laenger als KERNAUSSAGE_MAX und traegt eine Satzgrenze im Fenster", () => {
    expect(TEXT.length).toBeGreaterThan(KERNAUSSAGE_MAX);
    const kanon = kernaussageAusKlartext(TEXT);
    expect(kanon.length).toBeLessThanOrEqual(KERNAUSSAGE_MAX);
    expect(kanon.endsWith(".")).toBe(true); // an einer Satzgrenze, nicht im Wort
    expect(TEXT.startsWith(kanon)).toBe(true);
  });

  it("P1 · CONFLUENCE-MAPPER und WORD/ADD-IN (POST /api/drafts, Rohaussage): zeichengenau dieselbe Kernaussage, Volltext erhalten", async () => {
    const { a, admin } = await app();
    const item = mapConfluencePageToImportItem(seite(`<p>${TEXT}</p>`), OPTS);
    const draft = await a.inject({
      method: "POST",
      url: "/api/drafts",
      headers: admin,
      payload: {
        title: "Ueberdruck an Ventil X",
        statement: TEXT, // die Rohaussage — so sendet der Client seit 2703 (keine Client-Kuerzung)
        bodyHtml: `<p>${TEXT}</p>`,
        origin: "word_addin",
      },
    });
    expect(draft.statusCode, draft.body).toBe(201);
    const word = draft.json().payload as { statement: string; bodyHtml?: string };
    console.info(
      `JOB 2703 · P1 · Mapper ${item.statement.length} Zeichen · Add-in ${word.statement.length} Zeichen · gleich=${item.statement === word.statement}`,
    );
    expect(word.statement, "Word/Add-in-Weg und Confluence-Mapper kuerzen verschieden").toBe(
      item.statement,
    );
    expect(item.statement.length).toBeLessThanOrEqual(KERNAUSSAGE_MAX);
    expect(item.bodyHtml ?? "").toContain(SATZ_6); // Volltext bleibt
    expect(word.bodyHtml ?? "").toContain(SATZ_6);
  });

  it("P2 · WORD/DOCX (POST /api/drafts/from-docx, echte .docx) und CONFLUENCE-MAPPER mit demselben Text: zeichengenau gleich", async () => {
    const { a, admin } = await app();
    const bytes = Buffer.from(DOCX_OHNE_BILDER, "base64");
    const reich = await extractDocxRich(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      {},
    );
    expect(reich.text.trim().length).toBeGreaterThan(0);
    const docx = await a.inject({
      method: "POST",
      url: "/api/drafts/from-docx",
      headers: admin,
      payload: { name: "Ventil.docx", data: DOCX_OHNE_BILDER },
    });
    expect(docx.statusCode, docx.body).toBe(201);
    const wordStatement = (docx.json().payload as { statement: string }).statement;
    const item = mapConfluencePageToImportItem(seite(`<p>${reich.text}</p>`), OPTS);
    console.info(
      `JOB 2703 · P2 · Docx-Text ${reich.text.length} Zeichen · Docx-Weg "${wordStatement.slice(0, 60)}" · Mapper "${item.statement.slice(0, 60)}" · gleich=${wordStatement === item.statement}`,
    );
    expect(wordStatement, "Word/Docx-Weg und Confluence-Mapper kuerzen verschieden").toBe(
      item.statement,
    );
    expect(wordStatement).toBe(kernaussageAusKlartext(reich.text));
  });

  it("P3 · SPEICHERN (PUT /api/drafts/:id) mit der Rohaussage: der Speicherweg unterlaeuft die Regel nicht", async () => {
    const { a, admin } = await app();
    const item = mapConfluencePageToImportItem(seite(`<p>${TEXT}</p>`), OPTS);
    const angelegt = await a.inject({
      method: "POST",
      url: "/api/drafts",
      headers: admin,
      payload: { title: "Ueberdruck an Ventil X", statement: "Kurz.", bodyHtml: "<p>Kurz.</p>" },
    });
    const id = angelegt.json().id as string;
    const gespeichert = await a.inject({
      method: "PUT",
      url: `/api/drafts/${id}`,
      headers: admin,
      payload: { statement: TEXT, bodyHtml: `<p>${TEXT}</p>` },
    });
    expect(gespeichert.statusCode, gespeichert.body).toBe(200);
    const nachher = gespeichert.json().payload as { statement: string };
    expect(nachher.statement).toBe(item.statement);
  });

  it("P4 · kein konkurrierender Kuerzungsweg: der Client liefert die Rohaussage ungekuerzt", async () => {
    const { frontDoorStatement } = await import("../../apps/web/src/lib/captureFrontDoor");
    const { wholeDocumentDraftPayload } = await import("../../apps/web/src/lib/captureFromFile");
    // Vordertuer: keine 500-Zeichen-Kante mehr im Client — der ganze Klartext geht zum Server.
    expect(frontDoorStatement(`<p>${TEXT}</p>`, "Titel")).toBe(TEXT);
    // Ganzdokument-Import: dito.
    const payload = wholeDocumentDraftPayload({ fileName: "ventil.txt", text: TEXT });
    expect(payload.statement).toBe(TEXT);
  });
});
