// ================================================================================================
// BPA-17 · NACHBEARBEITUNG IM TATSÄCHLICHEN EDITORHOST (Collabora CODE) — Ben-Befund AC01/AC10.
// ================================================================================================
//
// Die Routentests (`nachbearbeitung.test.ts`) ersetzen die Editor-Discovery. Diese Probe fährt den
// zusammenhängenden Weg mit dem eingebetteten Editor, den das Produkt tatsächlich verwendet
// (Office im Artikel, WOPI → Collabora CODE), nach dem Muster von
// `tests/office-artikel-editor/code-artikelweg.integration.test.ts`:
//
//   H1  Nachbearbeitung über die ECHTE Route (belegter Beschluss + native Sprechernotiz + Handout)
//       → Fassung 2 → im echten Editor öffnen (Document_Loaded, GetFile liest genau Fassung 2)
//       → im Editor speichern (PutFile) → als Fassung 3 übernehmen → Editor schließen
//       → Fassung 3 (vom Host serialisiert) trägt Änderung, native Notiz, private Notiz und
//         ausgeblendete Folie → erneut im Editor öffnen → Quellenprüfung (Belegstelle am früheren
//         Stand) → zweite Nachbearbeitung AUF dem vom Host geschriebenen Stand gelingt und wird
//         wiedergeöffnet geprüft.
//
// BELEG: `test-results/assistenz-dokumentnachbearbeitung/HOSTBELEG.json` bindet Abbild und die
// vom Host selbst gemeldete Version (`/hosting/capabilities`), Rolle, Quell- und Ergebnisfassungen,
// Objektkennungen und die Bildschirmfotos.
//
// GRENZEN, ausdrücklich: Host ist Collabora CODE im Container, NICHT Microsoft PowerPoint. Ob eine
// angefügte Notiz in PowerPoint (Desktop/Web) erscheint, belegt diese Probe nicht. Die Darstellung
// wird nur als Bildschirmfoto abgelegt, nicht beurteilt. Ohne Docker, Abbild oder Chromium scheitert
// die Datei am Start — dann fehlt ein Prüfmittel, das ist kein Befund am Produkt.

import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import JSZip from "jszip";
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
import { ooxmlText } from "../office-artikel-editor/ooxml";
import { PRIVATE_NOTIZ, VERBORGEN, synthetischePraesentation } from "./praesentation";

const ABBILD = process.env.KLARWERK_CODE_ABBILD ?? "collabora/code:latest";
const CODE_PORT = 9980;
const BELEGE = join(process.cwd(), "test-results", "assistenz-dokumentnachbearbeitung");
// Fiktiver Testschlüssel, nur für diese Probe.
const SCHLUESSEL_HEX = "2f".repeat(32);
const PPTX = OFFICE_FORMATE.find((f) => f.endung === "pptx")?.mime ?? "";

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
  return `<!doctype html><meta charset="utf-8"><title>Klarwerk BPA-17 Hostprobe</title>
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

/** Der Text aller Teile unter einem Pfadpräfix (Tags entfernt) — gleich wie der Host sie benennt. */
async function textUnter(bytes: Buffer, praefix: string): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const teile: string[] = [];
  for (const name of Object.keys(zip.files).sort()) {
    if (name.startsWith(praefix) && name.endsWith(".xml")) {
      teile.push(((await zip.file(name)?.async("string")) ?? "").replace(/<[^>]+>/g, ""));
    }
  }
  return teile.join(" ");
}

/** Ist die Folie mit diesem Text ausgeblendet (`show="0"`)? */
async function ausgeblendet(bytes: Buffer, text: string): Promise<boolean | undefined> {
  const zip = await JSZip.loadAsync(bytes);
  for (const name of Object.keys(zip.files)) {
    if (/^ppt\/slides\/slide\d+\.xml$/.test(name)) {
      const xml = (await zip.file(name)?.async("string")) ?? "";
      if (xml.replace(/<[^>]+>/g, "").includes(text)) {
        return /<p:sld\s[^>]*\sshow="(0|false)"/.test(xml);
      }
    }
  }
  return undefined;
}

const KONTEN: OfficeKonto[] = [
  { id: "anna", name: "Anna Beispiel", role: "experte", approved: true },
];

describe("BPA-17 · Hostweg Collabora CODE", { timeout: 900_000 }, () => {
  const objekte = new BeobachteterSpeicher({ repo: new InMemoryObjectRepo() });
  const ko = new KoService({
    repo: new InMemoryKoRepo(),
    versions: new InMemoryKoVersionRepo(),
    evidence: new InMemoryEvidenceRepo(),
  });
  const seiten = new Map<string, string>();
  const bilder: string[] = [];
  let port = 0;
  let app: FastifyInstance;
  let code: StartedTestContainer | undefined;
  let browser: Browser | undefined;
  let host: Record<string, unknown> = {};

  async function api(methode: "GET" | "POST", pfad: string, payload?: Record<string, unknown>) {
    const antwort = await app.inject({
      method: methode,
      url: pfad,
      headers: { "x-test-nutzer": "anna" },
      ...(payload === undefined ? {} : { payload }),
    });
    return { status: antwort.statusCode, body: antwort.json() };
  }

  async function bytesVon(objectId: string): Promise<Buffer> {
    const gespeichert = await objekte.read(objectId);
    const bytes = gespeichert ? decodeDataUrl(gespeichert.data)?.bytes : undefined;
    if (!bytes) {
      throw new Error(`Objekt ${objectId} fehlt`);
    }
    return bytes;
  }

  async function aktuellesObjekt(koId: string): Promise<string> {
    return (await ko.get(koId))?.attachments?.[0]?.objectId ?? "";
  }

  /** Über die echte Sitzungsroute öffnen und warten, bis der Editor das Dokument geladen hat. */
  async function oeffne(koId: string, anhangId: string, bild: string): Promise<Page> {
    const s = await api("POST", `/api/kos/${koId}/office/${anhangId}/sitzung`);
    expect(s.status, JSON.stringify(s.body)).toBe(200);
    expect(s.body.schreibweg).toBe("direkt");
    const kennung = `anna-${Date.now()}`;
    seiten.set(kennung, hostSeite(s.body));
    if (!browser) {
      throw new Error("Chromium läuft nicht");
    }
    const seite = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await seite.goto(`http://localhost:${port}/probe/${kennung}`);
    await seite.waitForFunction(DOKUMENT_GELADEN, undefined, { timeout: 180_000 });
    await seite.waitForTimeout(2_000);
    await seite.screenshot({ path: join(BELEGE, bild) });
    bilder.push(bild);
    return seite;
  }

  async function lage(koId: string, anhangId: string) {
    return api("GET", `/api/kos/${koId}/office/${anhangId}`);
  }

  beforeAll(async () => {
    mkdirSync(BELEGE, { recursive: true });
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
    // Die Hostversion, wie der Host sie selbst meldet — nicht aus dem Abbildnamen geraten.
    const faehigkeiten = await fetch(`${editorHerkunft}/hosting/capabilities`);
    host = (await faehigkeiten.json()) as Record<string, unknown>;

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

  it("H1 (K1 K4 K10): Nachbearbeitung → Editor öffnen → speichern → wiederöffnen → Quellen", async () => {
    expect(typeof host.productVersion, JSON.stringify(host)).toBe("string");

    // Ausgangslage: Artikel mit der synthetischen Präsentation und einer Belegstelle an ihr.
    const start = await synthetischePraesentation();
    const ref = await objekte.put({
      name: "Besprechung.pptx",
      mime: PPTX,
      data: `data:${PPTX};base64,${start.toString("base64")}`,
      purpose: "attachment",
      owner: "anna",
    });
    const artikel = await ko.create({
      title: "Pumpenwartung P1 fiktiv",
      statement: "Die fiktive Pumpe P1 wird regelmäßig gewartet.",
      type: "best_practice",
      category: "Testanlage",
      author: "anna",
    });
    const mitAnhang = await ko.addAttachment(artikel.id, "anna", {
      name: "Besprechung.pptx",
      mime: PPTX,
      objectId: ref.id,
      size: ref.size,
    });
    const koId = artikel.id;
    const anhangId = mitAnhang.attachments?.[0]?.id ?? "";
    await ko.addSource(koId, "anna", {
      label: "Folie 2 der Besprechungsfassung",
      excerpt: "Ausfallquote 2025: 4,2 %",
      objectId: ref.id,
    });

    // 1 · Nachbearbeitung über die echte Route.
    const nb = await api("POST", `/api/kos/${koId}/office/${anhangId}/nachbearbeitung`, {
      laufId: "h1-lauf",
      basisFassung: 1,
      schritte: [
        {
          id: "b1",
          art: "text",
          folieId: 256,
          alt: "monatlich",
          neu: "vierteljährlich",
          herkunft: {
            art: "meetingbeschluss",
            quelle: "Besprechungsnotiz 09.10. (synthetisch)",
            stelle: "TOP 2, 00:14:20",
          },
        },
      ],
      sprechernotizen: [
        {
          folieId: 256,
          text: "Auf das neue Intervall hinweisen.",
          herkunft: { art: "nutzerauftrag" },
        },
      ],
      folgeprodukte: { handout: true, sprechernotizen: true },
    });
    expect(nb.status, JSON.stringify(nb.body)).toBe(200);
    expect(nb.body).toMatchObject({ zustand: "gespeichert", neueFassung: 2 });
    expect(nb.body.pruefung).toMatchObject({ ok: true, notizenBestaetigt: [256] });
    const fassung2 = await aktuellesObjekt(koId);

    // 2 · Im echten Editor öffnen: GetFile liest genau Fassung 2.
    objekte.gelesen.length = 0;
    const seite = await oeffne(koId, anhangId, "H1-1-fassung2-geoeffnet.png");
    expect(objekte.gelesen).toContain(fassung2);

    // 3 · Im Editor speichern (PutFile) und als Fassung übernehmen.
    const ab = Date.now();
    await seite.evaluate(
      `window.sende(${JSON.stringify({
        MessageId: "Action_Save",
        Values: { DontTerminateEdit: true, DontSaveIfUnmodified: false, Notify: true },
      })})`,
    );
    await seite.waitForFunction(GESPEICHERT_SEIT(ab), undefined, { timeout: 120_000 });
    await warteAuf(
      async () => (await lage(koId, anhangId)).body.sitzung?.arbeitsstandOffen === true,
      60_000,
      "Arbeitsstand des Editors bei Klarwerk",
    );
    const ueb = await api("POST", `/api/kos/${koId}/office/${anhangId}/uebernahme`);
    expect(ueb.status, JSON.stringify(ueb.body)).toBe(200);
    expect(ueb.body.fassung).toBe(3);
    await seite.close();
    await warteAuf(
      async () => (await lage(koId, anhangId)).body.sitzung?.laeuft === false,
      240_000,
      "Sitzungsende (UNLOCK des Editors)",
    );

    // 4 · Der vom HOST geschriebene Stand trägt Änderung, native Notiz und Schutz.
    const fassung3 = await aktuellesObjekt(koId);
    expect(fassung3).not.toBe(fassung2);
    const vomHost = await bytesVon(fassung3);
    const folien = await textUnter(vomHost, "ppt/slides/");
    expect(folien).toContain("Wartungsintervall: vierteljährlich");
    expect(folien).not.toContain("monatlich");
    const notizen = await textUnter(vomHost, "ppt/notesSlides/");
    expect(notizen).toContain("Auf das neue Intervall hinweisen.");
    expect(notizen).toContain(PRIVATE_NOTIZ);
    expect(await ausgeblendet(vomHost, VERBORGEN)).toBe(true);
    expect(await ooxmlText(await bytesVon(fassung2))).toContain("vierteljährlich");

    // 5 · Wiederöffnen im Editor: GetFile liest genau Fassung 3.
    objekte.gelesen.length = 0;
    const wieder = await oeffne(koId, anhangId, "H1-2-fassung3-wiedergeoeffnet.png");
    expect(objekte.gelesen).toContain(fassung3);
    await wieder.close();
    await warteAuf(
      async () => (await lage(koId, anhangId)).body.sitzung?.laeuft === false,
      240_000,
      "Sitzungsende nach dem Wiederöffnen",
    );

    // 6 · Änderungs- und Quellenprüfung am heutigen Stand.
    const l = await lage(koId, anhangId);
    expect(l.body).toMatchObject({ fassung: 3, status: "offen" });
    expect(l.body.belegstellen).toEqual([
      expect.objectContaining({ label: "Folie 2 der Besprechungsfassung", stand: "frueher" }),
    ]);

    // 7 · Zweite Nachbearbeitung AUF dem vom Host geschriebenen Stand.
    const zwei = await api("POST", `/api/kos/${koId}/office/${anhangId}/nachbearbeitung`, {
      laufId: "h1-zwei",
      basisFassung: 3,
      schritte: [
        {
          id: "n2",
          art: "text",
          folieId: 256,
          alt: "vierteljährlich",
          neu: "quartalsweise",
          herkunft: { art: "nutzerauftrag", quelle: "Hostprobe (synthetisch)" },
        },
      ],
    });
    expect(zwei.status, JSON.stringify(zwei.body)).toBe(200);
    expect(zwei.body).toMatchObject({ zustand: "gespeichert", neueFassung: 4 });
    expect(zwei.body.pruefung).toMatchObject({ ok: true, bestaetigt: ["n2"] });
    const fassung4 = await aktuellesObjekt(koId);
    expect(await textUnter(await bytesVon(fassung4), "ppt/slides/")).toContain(
      "Wartungsintervall: quartalsweise",
    );

    writeFileSync(
      join(BELEGE, "HOSTBELEG.json"),
      `${JSON.stringify(
        {
          auftrag: "produkt:20261011:assistenz-dokumentnachbearbeitung",
          kandidat: process.env.KLARWERK_KANDIDAT ?? null,
          zeitpunkt: new Date().toISOString(),
          host: {
            abbild: ABBILD,
            productName: host.productName ?? null,
            productVersion: host.productVersion ?? null,
            productVersionHash: host.productVersionHash ?? null,
          },
          rolle: { nutzer: "anna", rolle: "experte", schreibweg: "direkt" },
          artikel: koId,
          anhang: anhangId,
          fassungen: {
            "1_quelle": ref.id,
            "2_nachbearbeitet": fassung2,
            "3_vom_host_gespeichert": fassung3,
            "4_nachbearbeitet_auf_hoststand": fassung4,
          },
          folgeprodukte: (nb.body.folgeprodukte as { art: string; objectId: string }[]).map(
            (f) => ({ art: f.art, objectId: f.objectId }),
          ),
          sprechernotizen: nb.body.sprechernotizen,
          belegstellen: l.body.belegstellen,
          bilder,
          grenzen: [
            "Host ist Collabora CODE, nicht Microsoft PowerPoint.",
            "Darstellung nur als Bildschirmfoto abgelegt, nicht beurteilt.",
          ],
        },
        null,
        2,
      )}\n`,
    );
  });
});
