// ================================================================================================
// OFFICE IM ARTIKEL · DER INTEGRIERTE ARTIKELWEG MIT ECHTEM COLLABORA (CODE) — Nacharbeit 2.
// ================================================================================================
//
// Auftrag `produkt:20261007:office-artikel-editor`, bens Befund 3: der vollständige Weg mit echtem
// eingebettetem Editor war nicht nachgewiesen. Diese Probe fährt ihn technisch:
//
//   · Server: die ECHTEN Routen `officeRoutes` (Sitzung, WOPI, Übernahme, Lage, gesicherte Stände)
//     über dem ECHTEN Wissensobjektdienst (`KoService.uebernimmOfficeFassung`) und Objektspeicher,
//     an einem echten Port — kein Hostweg-Nachbau, keine Artikel-Attrappe.
//   · Editor: ein Container `collabora/code`; die Editor-Adresse kommt aus seiner echten Discovery
//     über die Sitzungsroute.
//   · Browser: echtes Chromium; eine schlichte Host-Seite bettet den Editor nach dem WOPI-Muster ein
//     (Formular-POST mit der Marke der Sitzungsroute in ein iframe) — dieselbe Bauform wie
//     `OfficeImArtikel.tsx`. Die React-Fläche selbst prüft `tests-smoke/office-artikel-browser.spec.ts`.
//
//   W1/E1/P1  Word, Excel, PowerPoint mit GÜLTIGEN fiktiven Dateien: öffnen → im Editor ändern →
//             speichern → als Fassung übernehmen → schließen → Artikel trägt die Änderung → neu
//             öffnen; der Editor lädt genau das Objekt der übernommenen Fassung, und dessen Inhalt
//             enthält die Änderung. Die Ausgangsfassung liegt unverändert im Speicher.     (K1, K2, K3)
//   Z1        Zwei Konten in EINER Editor-Sitzung: beide ändern, Übernahme Fassung 2; danach eine
//             fremde Artikeländerung → Übernahme 409 ohne Überschreiben; Schließen sichert den Stand;
//             die bewusste Übernahme des gesicherten Stands trägt BEIDE Änderungen.          (K4)
//
// GRENZEN, ausdrücklich: geändert wird über die Nachrichtenschnittstelle des Editors (Word:
// `.uno:InsertText`, Excel: `.uno:GoToCell` + `.uno:EnterString`) bzw. für PowerPoint über Maus
// und Tastatur im iframe. Die Darstellungstreue wird nicht beurteilt. Ohne Docker, ohne Zugriff auf
// das Abbild oder ohne Chromium scheitert die Datei am Start — dann fehlt ein Prüfmittel, das ist
// kein Befund am Produkt.

import { mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { type Browser, type Page, chromium } from "playwright";
import { GenericContainer, type StartedTestContainer, TestContainers, Wait } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Guards, SessionUser } from "../../services/app/src/http";
import { SpeicherOfficeAblage } from "../../services/app/src/office-ablage";
import { leseOfficeEditorUmgebung } from "../../services/app/src/office-artikel";
import { OFFICE_FORMATE } from "../../services/app/src/office-wopi";
import { type OfficeKonto, officeRoutes } from "../../services/app/src/routes/office-routes";
import {
  InMemoryEvidenceRepo,
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
} from "../../services/knowledge-object/src/repo";
import { KoService } from "../../services/knowledge-object/src/service";
import { InMemoryObjectRepo, ObjectStore, decodeDataUrl } from "../../services/object-store";
import { can } from "../../services/rbac";
import { docxText, fiktivesDocx } from "../office-wopi-code/werkzeug";
import { fiktivesPptx, fiktivesXlsx, ooxmlText } from "./ooxml";

const ABBILD = process.env.KLARWERK_CODE_ABBILD ?? "collabora/code:latest";
const CODE_PORT = 9980;
const BILDER = join(process.cwd(), "test-results", "office-artikel-editor");
// Fiktiver Testschlüssel, nur für diese Probe.
const SCHLUESSEL_HEX = "1e".repeat(32);

const DOKUMENT_GELADEN =
  "window.meldungen.some((m) => m && m.MessageId === 'App_LoadingStatus' && " +
  "m.Values && m.Values.Status === 'Document_Loaded')";
const GESPEICHERT_SEIT = (ab: number) =>
  `window.meldungen.some((m) => m && m.MessageId === 'Action_Save_Resp' && m.empfangen >= ${ab})`;

/** Liest mit, welche Objekte gelesen werden — GetFile liest genau das Objekt, das der Editor zeigt. */
class BeobachteterSpeicher extends ObjectStore {
  readonly gelesen: string[] = [];
  override read(id: string): ReturnType<ObjectStore["read"]> {
    this.gelesen.push(id);
    return super.read(id);
  }
}

function html(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Die einbettende Seite nach dem WOPI-Muster (wie `OfficeImArtikel.tsx`). */
function hostSeite(s: {
  editorUrl: string;
  editorHerkunft: string;
  accessToken: string;
  accessTokenTtl: number;
}): string {
  return `<!doctype html><meta charset="utf-8"><title>Klarwerk Artikelweg-Probe</title>
<form id="f" method="post" target="editor" action="${html(s.editorUrl)}">
<input type="hidden" name="access_token" value="${html(s.accessToken)}">
<input type="hidden" name="access_token_ttl" value="${s.accessTokenTtl}">
</form>
<iframe name="editor" id="editor" style="width:1200px;height:800px;border:0"></iframe>
<script>
window.meldungen = [];
const ursprung = ${JSON.stringify(s.editorHerkunft)};
window.sende = (m) => document.getElementById("editor").contentWindow.postMessage(
  JSON.stringify(Object.assign({ SendTime: Date.now() }, m)), ursprung);
window.addEventListener("message", (e) => {
  if (e.origin !== ursprung) return;
  let m;
  try { m = typeof e.data === "string" ? JSON.parse(e.data) : e.data; } catch { return; }
  if (m && typeof m === "object") { m.empfangen = Date.now(); }
  window.meldungen.push(m);
  if (m && m.MessageId === "App_LoadingStatus" && m.Values && m.Values.Status === "Frame_Ready") {
    window.sende({ MessageId: "Host_PostmessageReady" });
  }
});
document.getElementById("f").submit();
</script>`;
}

async function freierPort(): Promise<number> {
  return new Promise((fertig, fehler) => {
    const s = createServer();
    s.once("error", fehler);
    s.listen(0, "0.0.0.0", () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => fertig(port));
    });
  });
}

async function warteAuf(bedingung: () => Promise<boolean>, ms: number, was: string): Promise<void> {
  const ende = Date.now() + ms;
  while (!(await bedingung())) {
    if (Date.now() > ende) {
      throw new Error(`Zeitüberschreitung (${ms} ms): ${was}`);
    }
    await new Promise((weiter) => setTimeout(weiter, 500));
  }
}

const KONTEN: OfficeKonto[] = [
  { id: "anna", name: "Anna Beispiel", role: "experte", approved: true },
  { id: "bert", name: "Bert Beispiel", role: "experte", approved: true },
  { id: "chef", name: "Chefin Beispiel", role: "admin", approved: true },
];

describe(
  "Office im Artikel · integrierter Artikelweg mit echtem CODE",
  { timeout: 900_000 },
  () => {
    const objekte = new BeobachteterSpeicher({ repo: new InMemoryObjectRepo() });
    const ko = new KoService({
      repo: new InMemoryKoRepo(),
      versions: new InMemoryKoVersionRepo(),
      evidence: new InMemoryEvidenceRepo(),
    });
    const seiten = new Map<string, string>();
    let port = 0;
    let app: FastifyInstance;
    let code: StartedTestContainer | undefined;
    let browser: Browser | undefined;

    const als = (nutzer: string) => ({ "x-test-nutzer": nutzer });

    async function api(
      methode: "GET" | "POST",
      nutzer: string,
      pfad: string,
      payload?: Record<string, unknown>,
    ) {
      const antwort = await app.inject({
        method: methode,
        url: pfad,
        headers: als(nutzer),
        ...(payload === undefined ? {} : { payload }),
      });
      return { status: antwort.statusCode, body: antwort.json() };
    }
    const lage = (nutzer: string, koId: string, anhangId: string) =>
      api("GET", nutzer, `/api/kos/${koId}/office/${anhangId}`);
    const uebernimm = (nutzer: string, koId: string, anhangId: string) =>
      api("POST", nutzer, `/api/kos/${koId}/office/${anhangId}/uebernahme`);

    async function artikelMit(endung: string, inhalt: Buffer) {
      const mime = OFFICE_FORMATE.find((f) => f.endung === endung)?.mime ?? "";
      const ref = await objekte.put({
        name: `Probe.${endung}`,
        mime,
        data: `data:${mime};base64,${inhalt.toString("base64")}`,
        purpose: "attachment",
      });
      const artikel = await ko.create({
        title: `Fiktive Probe ${endung}`,
        statement: `Fiktiver Artikel mit ${endung}-Anhang.`,
        type: "best_practice",
        category: "Testanlage",
        author: "anna",
      });
      const mitAnhang = await ko.addAttachment(artikel.id, "anna", {
        name: `Probe.${endung}`,
        mime,
        objectId: ref.id,
        size: ref.size,
      });
      return { koId: artikel.id, anhangId: mitAnhang.attachments?.[0]?.id ?? "", start: ref.id };
    }

    async function bytesVon(objectId: string): Promise<Buffer> {
      const gespeichert = await objekte.read(objectId);
      const bytes = gespeichert ? decodeDataUrl(gespeichert.data)?.bytes : undefined;
      if (!bytes) {
        throw new Error(`Objekt ${objectId} fehlt`);
      }
      return bytes;
    }

    async function aktuellesObjekt(koId: string, anhangId: string): Promise<string> {
      return (await ko.get(koId))?.attachments?.find((a) => a.id === anhangId)?.objectId ?? "";
    }

    /** Über die echte Sitzungsroute öffnen und warten, bis der Editor das Dokument geladen hat. */
    async function oeffne(nutzer: string, koId: string, anhangId: string, bild: string) {
      const s = await api("POST", nutzer, `/api/kos/${koId}/office/${anhangId}/sitzung`);
      expect(s.status, JSON.stringify(s.body)).toBe(200);
      expect(s.body.schreibweg).toBe("direkt");
      const kennung = `${nutzer}-${Date.now()}`;
      seiten.set(kennung, hostSeite(s.body));
      if (!browser) {
        throw new Error("Chromium läuft nicht");
      }
      const seite = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await seite.goto(`http://localhost:${port}/probe/${kennung}`);
      await seite.waitForFunction(DOKUMENT_GELADEN, undefined, { timeout: 180_000 });
      await seite.waitForTimeout(2_000);
      await seite.screenshot({ path: join(BILDER, bild) });
      return seite;
    }

    async function sende(seite: Page, nachricht: unknown): Promise<void> {
      await seite.evaluate(`window.sende(${JSON.stringify(nachricht)})`);
    }

    /** Den Editor speichern lassen und warten, bis Klarwerk den Arbeitsstand hat. */
    async function speichere(seite: Page, koId: string, anhangId: string): Promise<void> {
      const ab = Date.now();
      await sende(seite, {
        MessageId: "Action_Save",
        Values: { DontTerminateEdit: true, DontSaveIfUnmodified: false, Notify: true },
      });
      await seite.waitForFunction(GESPEICHERT_SEIT(ab), undefined, { timeout: 120_000 });
      await warteAuf(
        async () => (await lage("anna", koId, anhangId)).body.sitzung?.arbeitsstandOffen === true,
        60_000,
        "Arbeitsstand bei Klarwerk",
      );
    }

    async function schliesse(seite: Page, koId: string, anhangId: string): Promise<void> {
      await seite.close();
      await warteAuf(
        async () => (await lage("anna", koId, anhangId)).body.sitzung?.laeuft === false,
        240_000,
        "Sitzungsende (UNLOCK des Editors)",
      );
    }

    const aendern = {
      word: (seite: Page, text: string) =>
        sende(seite, {
          MessageId: "Send_UNO_Command",
          Values: { Command: ".uno:InsertText", Args: { Text: { type: "string", value: text } } },
        }),
      excel: async (seite: Page, text: string) => {
        await sende(seite, {
          MessageId: "Send_UNO_Command",
          Values: { Command: ".uno:GoToCell", Args: { ToPoint: { type: "string", value: "A2" } } },
        });
        await sende(seite, {
          MessageId: "Send_UNO_Command",
          Values: {
            Command: ".uno:EnterString",
            Args: { StringName: { type: "string", value: text } },
          },
        });
      },
      powerpoint: async (seite: Page, text: string) => {
        // Das Textfeld bedeckt fast die ganze Folie; ein Klick in die Folienmitte setzt den Cursor
        // hinein, dann wird ans Ende getippt und das Feld verlassen.
        const rahmen = await seite.locator("#editor").boundingBox();
        if (!rahmen) {
          throw new Error("Editor-Rahmen ohne Lage");
        }
        await seite.mouse.click(rahmen.x + rahmen.width * 0.6, rahmen.y + rahmen.height * 0.5);
        await seite.waitForTimeout(1_000);
        await seite.mouse.dblclick(rahmen.x + rahmen.width * 0.6, rahmen.y + rahmen.height * 0.5);
        await seite.waitForTimeout(1_000);
        await seite.keyboard.press("End");
        await seite.keyboard.type(text, { delay: 30 });
        await seite.keyboard.press("Escape");
      },
    } as const;

    beforeAll(async () => {
      mkdirSync(BILDER, { recursive: true });
      port = await freierPort();
      await TestContainers.exposeHostPorts(port);
      const seitenHerkunft = `http://localhost:${port}`;
      const wopiHost = `http://host.testcontainers.internal:${port}`;
      const parameter = [
        "--o:ssl.enable=false",
        "--o:ssl.termination=false",
        `--o:net.frame_ancestors=${seitenHerkunft}`,
      ].join(" ");
      code = await new GenericContainer(ABBILD)
        .withEnvironment({ aliasgroup1: wopiHost, DONT_GEN_SSL_CERT: "1", extra_params: parameter })
        .withExposedPorts(CODE_PORT)
        .withWaitStrategy(
          Wait.forHttp("/hosting/discovery", CODE_PORT)
            .forStatusCode(200)
            .withStartupTimeout(300_000),
        )
        .start();
      const editorHerkunft = `http://${code.getHost()}:${code.getMappedPort(CODE_PORT)}`;

      const einrichtung = leseOfficeEditorUmgebung({
        KLARWERK_OFFICE_EDITOR_URL: editorHerkunft,
        KLARWERK_WOPI_HOST_URL: wopiHost,
        APP_BASE_URL: seitenHerkunft,
        KLARWERK_WOPI_SCHLUESSEL: SCHLUESSEL_HEX,
      });
      expect(einrichtung.eingerichtet).toBe(true);

      const nutzer = (id: string | undefined): SessionUser | undefined => {
        const k = KONTEN.find((x) => x.id === id);
        return k ? { id: k.id, role: k.role, spaceLesbar: new Set() } : undefined;
      };
      const guards: Guards = {
        async requireUser(request, reply) {
          const u = nutzer(request.headers["x-test-nutzer"] as string | undefined);
          if (!u) {
            reply.code(401).send({ error: "UNAUTHORIZED" });
          }
          return u;
        },
        async requirePermission(permission, request, reply) {
          const u = await this.requireUser(request, reply);
          if (u && !can(u.role, permission)) {
            reply.code(403).send({ error: "FORBIDDEN" });
            return undefined;
          }
          return u;
        },
      };
      app = Fastify();
      await app.register(
        officeRoutes(
          {
            ko,
            objekte,
            einrichtung,
            konten: async () => KONTEN,
            spaceLesbar: async () => new Set(),
            ablage: new SpeicherOfficeAblage(),
          },
          guards,
        ),
      );
      app.get<{ Params: { kennung: string } }>("/probe/:kennung", async (request, reply) =>
        reply.type("text/html; charset=utf-8").send(seiten.get(request.params.kennung) ?? ""),
      );
      await app.listen({ port, host: "0.0.0.0" });
      browser = await chromium.launch({ headless: true });
    }, 900_000);

    afterAll(async () => {
      await browser?.close();
      await app?.close();
      await code?.stop();
    });

    const faelle = [
      {
        name: "W1 · Word",
        endung: "docx",
        start: () => fiktivesDocx("Ausgangstext der fiktiven Anleitung."),
        aendere: aendern.word,
        marke: " KWPROBE-WORD",
        lies: (b: Buffer) => docxText(b),
        ausgang: "Ausgangstext der fiktiven Anleitung",
      },
      {
        name: "E1 · Excel",
        endung: "xlsx",
        start: () => fiktivesXlsx("Ausgangszelle der fiktiven Tabelle"),
        aendere: aendern.excel,
        marke: "KWPROBE-EXCEL",
        lies: ooxmlText,
        ausgang: "Ausgangszelle der fiktiven Tabelle",
      },
      {
        name: "P1 · PowerPoint",
        endung: "pptx",
        start: () => fiktivesPptx("Ausgangsfolie der fiktiven Praesentation"),
        aendere: aendern.powerpoint,
        marke: "KWPROBE-PPT",
        lies: ooxmlText,
        ausgang: "Ausgangsfolie der fiktiven Praesentation",
      },
    ] as const;

    for (const fall of faelle) {
      it(`${fall.name}: ändern, speichern, übernehmen, schließen und mit Inhalt wiederöffnen`, async () => {
        const startBytes = await fall.start();
        const { koId, anhangId, start } = await artikelMit(fall.endung, startBytes);
        const seite = await oeffne("anna", koId, anhangId, `${fall.endung}-01-geoeffnet.png`);

        await fall.aendere(seite, fall.marke);
        await speichere(seite, koId, anhangId);
        await seite.screenshot({ path: join(BILDER, `${fall.endung}-02-geaendert.png`) });
        const u = await uebernimm("anna", koId, anhangId);
        expect(u.status, JSON.stringify(u.body)).toBe(200);
        expect(u.body).toMatchObject({ fassung: 2, status: "offen" });

        await schliesse(seite, koId, anhangId);
        // Fassung 2 — oder höher, falls der Editor beim Schließen noch einmal gespeichert hat.
        expect((await ko.get(koId))?.version).toBeGreaterThanOrEqual(2);
        const aktuell = await aktuellesObjekt(koId, anhangId);
        expect(aktuell).not.toBe(start);
        const text = await fall.lies(await bytesVon(aktuell));
        expect(text).toContain(fall.marke.trim());
        expect(text).toContain(fall.ausgang);

        // Wiederöffnen: der Editor liest genau das Objekt der übernommenen Fassung.
        const vorher = objekte.gelesen.length;
        const wieder = await oeffne(
          "anna",
          koId,
          anhangId,
          `${fall.endung}-03-wiedergeoeffnet.png`,
        );
        expect(objekte.gelesen.slice(vorher)).toContain(aktuell);
        await wieder.close();

        // Rückweg: die Ausgangsfassung ist unverändert, der Verlauf nennt beide Stände.
        expect(Buffer.compare(await bytesVon(start), startBytes)).toBe(0);
        const l = await lage("anna", koId, anhangId);
        expect(l.body.verlauf.map((z: { objectId: string }) => z.objectId)).toEqual(
          expect.arrayContaining([start, aktuell]),
        );
      });
    }

    it("Z1 · zwei Konten in einer Sitzung; fremde Änderung → 409, gesichert, bewusst übernommen", async () => {
      const { koId, anhangId } = await artikelMit(
        "docx",
        await fiktivesDocx("Gemeinsamer Ausgangstext."),
      );
      const anna = await oeffne("anna", koId, anhangId, "zwei-01-anna.png");
      const bert = await oeffne("bert", koId, anhangId, "zwei-02-bert.png");

      await aendern.word(anna, " KWPROBE-ANNA");
      await aendern.word(bert, " KWPROBE-BERT");
      await speichere(anna, koId, anhangId);
      const erste = await uebernimm("anna", koId, anhangId);
      expect(erste.status, JSON.stringify(erste.body)).toBe(200);
      const nachErster = await docxText(await bytesVon(await aktuellesObjekt(koId, anhangId)));
      expect(nachErster).toContain("KWPROBE-ANNA");
      expect(nachErster).toContain("KWPROBE-BERT");

      // Jemand ändert den Artikeltext außerhalb der Editor-Sitzung.
      await ko.revise(koId, { statement: "Fremde Änderung während der Sitzung." }, "chef");
      const fassungFremd = (await ko.get(koId))?.version ?? 0;
      await aendern.word(bert, " KWPROBE-BERT-ZWEI");
      await speichere(bert, koId, anhangId);
      const konflikt = await uebernimm("bert", koId, anhangId);
      expect(konflikt.status).toBe(409);
      expect(konflikt.body.error).toBe("KO_STALE");
      expect((await ko.get(koId))?.statement).toBe("Fremde Änderung während der Sitzung.");
      await bert.screenshot({ path: join(BILDER, "zwei-03-konflikt.png") });

      // Schließen beider Ansichten: der Stand wird nicht übernommen, sondern gesichert.
      await anna.close();
      await schliesse(bert, koId, anhangId);
      await warteAuf(
        async () => (await lage("bert", koId, anhangId)).body.gesichert.length > 0,
        60_000,
        "gesicherter Konfliktstand",
      );
      expect((await ko.get(koId))?.version).toBe(fassungFremd);
      const gesichert = (await lage("bert", koId, anhangId)).body.gesichert;

      const bewusst = await api("POST", "bert", `/api/kos/${koId}/office/${anhangId}/gesichert`, {
        objectId: gesichert[gesichert.length - 1].objectId,
        expectedVersion: fassungFremd,
      });
      expect(bewusst.status, JSON.stringify(bewusst.body)).toBe(200);
      const endText = await docxText(await bytesVon(await aktuellesObjekt(koId, anhangId)));
      expect(endText).toContain("KWPROBE-ANNA");
      expect(endText).toContain("KWPROBE-BERT-ZWEI");
      expect((await ko.get(koId))?.statement).toBe("Fremde Änderung während der Sitzung.");

      const wieder = await oeffne("bert", koId, anhangId, "zwei-04-wiedergeoeffnet.png");
      await wieder.close();
    });
  },
);
