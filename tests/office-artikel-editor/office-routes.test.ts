// ================================================================================================
// OFFICE IM ARTIKEL · DER WEG ÜBER DIE ECHTEN ROUTEN (Auftrag produkt:20261007:office-artikel-editor).
// ================================================================================================
//
// Geprüft wird `officeRoutes` in einer Fastify-Instanz mit dem ECHTEN Wissensobjektdienst (Speicher-
// Repos mit Fassungsablage und Belegkette), dem echten Objektspeicher und dem unveränderten WOPI-
// Hostweg. Ersetzt sind nur die Anmeldung (Kopfzeile `x-test-nutzer` statt Sitzungscookie) und die
// Discovery des Editors (feste XML in Collabora-Form). Die Editor-Anfragen stellt der Test so, wie
// ein WOPI-Editor sie stellt: `access_token` in der Abfrage, `X-WOPI-*`-Kopfzeilen, Dateikörper.
//
// Ein echter Editor läuft hier NICHT. Was er auf dem Bildschirm zeigt, belegt dieser Test nicht.
//
//   O1  Word: Artikel → Sitzung → Sperre → Speichern → Übernahme → Wiederöffnen liefert byte-gleich
//       den gespeicherten Inhalt.                                                            (K1)
//   O2  Excel und PowerPoint: derselbe Weg, dieselbe Zusage.                                  (K2)
//   O3  Verlauf, alte Fassung lesbar, Rückholen als NEUE Fassung.                              (K3)
//   O4  Zwei Nutzer in einer Sitzung; fremde Änderung → 409 ohne Überschreiben; Schließen
//       sichert den Stand; bewusste Übernahme des gesicherten Stands.                          (K4)
//   O5  Dokumentänderung am freigegebenen Artikel: Status `offen`, nie hochgestuft; Experte ohne
//       Freigaberecht bekommt nur eine Lesemarke; Belegstellen am alten Dokumentstand markiert. (K5)
//   O6  Unberechtigte: unsichtbarer Artikel 404, Anonym 401, fremde/abgelaufene Marke 401,
//       entzogenes Konto ohne Zugriff.                                                         (K6)
//   O7  Nicht eingerichtet / Editor nicht erreichbar: sichtbarer Fehler, nichts geändert.       (K7)

import Fastify, { type FastifyInstance } from "fastify";
import JSZip from "jszip";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Guards, SessionUser } from "../../services/app/src/http";
import {
  type OfficeEditorEinrichtung,
  leseOfficeEditorUmgebung,
} from "../../services/app/src/office-artikel";
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

const EDITOR = "https://editor.beispiel.invalid";
const KLARWERK = "https://klarwerk.beispiel.invalid";
// Fiktiver Testschlüssel, nur für diesen Test (32 Byte hex).
const SCHLUESSEL_HEX = "0f".repeat(32);

const DISCOVERY = `<?xml version="1.0" encoding="utf-8"?>
<wopi-discovery><net-zone name="external-http">
<app name="writer"><action default="true" ext="docx" name="edit" urlsrc="http://intern:9980/browser/abc/cool.html?"/><action ext="docx" name="view" urlsrc="http://intern:9980/browser/abc/cool.html?"/></app>
<app name="calc"><action default="true" ext="xlsx" name="edit" urlsrc="http://intern:9980/browser/abc/cool.html?"/><action ext="xlsx" name="view" urlsrc="http://intern:9980/browser/abc/cool.html?"/></app>
<app name="impress"><action default="true" ext="pptx" name="edit" urlsrc="http://intern:9980/browser/abc/cool.html?&lt;ui=UI_LLCC&amp;&gt;"/><action ext="pptx" name="view" urlsrc="http://intern:9980/browser/abc/cool.html?"/></app>
</net-zone></wopi-discovery>`;

const mimeVon = (endung: string): string => {
  const f = OFFICE_FORMATE.find((x) => x.endung === endung);
  if (!f) {
    throw new Error(endung);
  }
  return f.mime;
};

/** Eine kleine, gültige ZIP-Datei mit fiktivem Inhalt (Platzhalter für .xlsx/.pptx). */
async function fiktivesPaket(text: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("inhalt.txt", text);
  return zip.generateAsync({ type: "nodebuffer" });
}

interface Welt {
  app: FastifyInstance;
  ko: KoService;
  objekte: ObjectStore;
  konten: OfficeKonto[];
}

async function baueWelt(einrichtung: OfficeEditorEinrichtung, discovery?: () => string) {
  const objekte = new ObjectStore({ repo: new InMemoryObjectRepo() });
  const ko = new KoService({
    repo: new InMemoryKoRepo(),
    versions: new InMemoryKoVersionRepo(),
    evidence: new InMemoryEvidenceRepo(),
  });
  const konten: OfficeKonto[] = [
    { id: "anna", name: "Anna Beispiel", role: "experte", approved: true },
    { id: "bert", name: "Bert Beispiel", role: "experte", approved: true },
    { id: "chef", name: "Chefin Beispiel", role: "admin", approved: true },
    { id: "vera", name: "Vera Beispiel", role: "viewer", approved: true },
  ];
  const nutzer = (id: string | undefined): SessionUser | undefined => {
    const k = konten.find((x) => x.id === id && x.approved);
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
  const app = Fastify();
  await app.register(
    officeRoutes(
      {
        ko,
        objekte,
        einrichtung,
        konten: async () => konten,
        spaceLesbar: async () => new Set(),
        holeDiscovery: async () => {
          if (!discovery) {
            return DISCOVERY;
          }
          return discovery();
        },
      },
      guards,
    ),
  );
  await app.ready();
  return { app, ko, objekte, konten } satisfies Welt;
}

const eingerichtet = leseOfficeEditorUmgebung({
  KLARWERK_OFFICE_EDITOR_URL: EDITOR,
  APP_BASE_URL: KLARWERK,
  KLARWERK_WOPI_SCHLUESSEL: SCHLUESSEL_HEX,
});

async function artikelMitAnhang(w: Welt, endung: string, inhalt: Buffer, autor = "anna") {
  const mime = mimeVon(endung);
  const ref = await w.objekte.put({
    name: `Anleitung.${endung}`,
    mime,
    data: `data:${mime};base64,${inhalt.toString("base64")}`,
    purpose: "attachment",
  });
  const ko = await w.ko.create({
    title: "Pumpe P1 fiktiv warten",
    statement: "Die fiktive Pumpe P1 wird monatlich geprüft.",
    type: "best_practice",
    category: "Testanlage",
    author: autor,
  });
  const mitAnhang = await w.ko.addAttachment(ko.id, autor, {
    name: `Anleitung.${endung}`,
    mime,
    objectId: ref.id,
    size: ref.size,
  });
  const anhang = mitAnhang.attachments?.[0];
  if (!anhang) {
    throw new Error("Anhang fehlt");
  }
  return { koId: ko.id, anhangId: anhang.id, objectId: ref.id };
}

/** Ein Editor-Client für genau eine Marke — so, wie der Editor den Host anspricht. */
function editor(w: Welt, anhangId: string, marke: string) {
  const url = (rest = "") =>
    `/wopi/files/${anhangId}${rest}?access_token=${encodeURIComponent(marke)}`;
  return {
    info: () => w.app.inject({ method: "GET", url: url() }),
    lies: () => w.app.inject({ method: "GET", url: url("/contents") }),
    sperre: (art: string, lock: string) =>
      w.app.inject({
        method: "POST",
        url: url(),
        headers: { "X-WOPI-Override": art, "X-WOPI-Lock": lock },
      }),
    speichere: (lock: string, koerper: Buffer) =>
      w.app.inject({
        method: "POST",
        url: url("/contents"),
        headers: {
          "X-WOPI-Override": "PUT",
          "X-WOPI-Lock": lock,
          "Content-Type": "application/octet-stream",
        },
        payload: koerper,
      }),
  };
}

const als = (nutzer: string) => ({ "x-test-nutzer": nutzer });

async function sitzung(w: Welt, nutzer: string, koId: string, anhangId: string) {
  const antwort = await w.app.inject({
    method: "POST",
    url: `/api/kos/${koId}/office/${anhangId}/sitzung`,
    headers: als(nutzer),
  });
  return { status: antwort.statusCode, body: antwort.json() };
}

async function lage(w: Welt, nutzer: string, koId: string, anhangId: string) {
  const antwort = await w.app.inject({
    method: "GET",
    url: `/api/kos/${koId}/office/${anhangId}`,
    headers: als(nutzer),
  });
  return { status: antwort.statusCode, body: antwort.json() };
}

async function uebernimm(w: Welt, nutzer: string, koId: string, anhangId: string) {
  const antwort = await w.app.inject({
    method: "POST",
    url: `/api/kos/${koId}/office/${anhangId}/uebernahme`,
    headers: als(nutzer),
  });
  return { status: antwort.statusCode, body: antwort.json() };
}

async function bytesDesAnhangs(w: Welt, koId: string, anhangId: string): Promise<Buffer> {
  const ko = await w.ko.get(koId);
  const objectId = ko?.attachments?.find((a) => a.id === anhangId)?.objectId ?? "";
  const gespeichert = await w.objekte.read(objectId);
  const bytes = gespeichert ? decodeDataUrl(gespeichert.data)?.bytes : undefined;
  if (!bytes) {
    throw new Error("Objekt fehlt");
  }
  return bytes;
}

describe("Office im Artikel · Routen", () => {
  let w: Welt;
  beforeAll(async () => {
    w = await baueWelt(eingerichtet);
  });
  afterAll(async () => {
    await w.app.close();
  });

  it("O1 (K1): Word bearbeiten, speichern, wieder öffnen — identischer Inhalt", async () => {
    const { koId, anhangId } = await artikelMitAnhang(
      w,
      "docx",
      await fiktivesDocx("Ausgangstext der fiktiven Anleitung"),
    );
    const s = await sitzung(w, "anna", koId, anhangId);
    expect(s.status).toBe(200);
    expect(s.body.schreibweg).toBe("direkt");
    expect(s.body.editorHerkunft).toBe(EDITOR);
    // Die Adresse zeigt auf die Editor-Herkunft des Browsers, nicht auf die interne Discovery.
    const adresse = new URL(s.body.editorUrl);
    expect(adresse.origin).toBe(EDITOR);
    expect(adresse.searchParams.get("WOPISrc")).toBe(`${KLARWERK}/wopi/files/${anhangId}`);

    const e = editor(w, anhangId, s.body.accessToken);
    const info = await e.info();
    expect(info.statusCode).toBe(200);
    expect(info.json()).toMatchObject({ UserCanWrite: true, PostMessageOrigin: KLARWERK });
    expect((await e.sperre("LOCK", "sitzung-word")).statusCode).toBe(200);
    const geaendert = await fiktivesDocx(
      "Ausgangstext der fiktiven Anleitung — geändert im Artikel",
    );
    expect((await e.speichere("sitzung-word", geaendert)).statusCode).toBe(200);

    const u = await uebernimm(w, "anna", koId, anhangId);
    expect(u.status).toBe(200);
    expect(u.body.fassung).toBe(2);
    expect((await e.sperre("UNLOCK", "sitzung-word")).statusCode).toBe(200);

    // Wiederöffnen: neue Sitzung, neue Marke, GetFile liefert byte-gleich den gespeicherten Stand.
    const wieder = await sitzung(w, "anna", koId, anhangId);
    expect(wieder.body.fassung).toBe(2);
    const gelesen = await editor(w, anhangId, wieder.body.accessToken).lies();
    expect(gelesen.statusCode).toBe(200);
    expect(Buffer.compare(gelesen.rawPayload, geaendert)).toBe(0);
    expect(await docxText(gelesen.rawPayload)).toBe(
      "Ausgangstext der fiktiven Anleitung — geändert im Artikel",
    );
    expect(Buffer.compare(await bytesDesAnhangs(w, koId, anhangId), geaendert)).toBe(0);
  });

  for (const endung of ["xlsx", "pptx"] as const) {
    it(`O2 (K2): ${endung} durchläuft denselben Weg`, async () => {
      const { koId, anhangId } = await artikelMitAnhang(
        w,
        endung,
        await fiktivesPaket(`Start ${endung}`),
      );
      const s = await sitzung(w, "anna", koId, anhangId);
      expect(s.status).toBe(200);
      expect(s.body.schreibweg).toBe("direkt");
      // Der WOPI-Platzhalter `<ui=…>` der Discovery steht nicht in der Adresse.
      expect(s.body.editorUrl).not.toContain("<");
      const e = editor(w, anhangId, s.body.accessToken);
      expect((await e.sperre("LOCK", `sitzung-${endung}`)).statusCode).toBe(200);
      const neu = await fiktivesPaket(`Geändert ${endung}`);
      expect((await e.speichere(`sitzung-${endung}`, neu)).statusCode).toBe(200);
      // Übernahme beim Schließen (Unlock), wie der Editor es beim Verlassen tut.
      expect((await e.sperre("UNLOCK", `sitzung-${endung}`)).statusCode).toBe(200);
      expect((await w.ko.get(koId))?.version).toBe(2);
      const wieder = await sitzung(w, "anna", koId, anhangId);
      const gelesen = await editor(w, anhangId, wieder.body.accessToken).lies();
      expect(Buffer.compare(gelesen.rawPayload, neu)).toBe(0);
    });
  }

  it("O3 (K3): Verlauf, alte Fassung lesbar, Rückholen als neue Fassung", async () => {
    const start = await fiktivesDocx("Fassung eins");
    const { koId, anhangId, objectId } = await artikelMitAnhang(w, "docx", start);
    const s = await sitzung(w, "anna", koId, anhangId);
    const e = editor(w, anhangId, s.body.accessToken);
    await e.sperre("LOCK", "s3");
    await e.speichere("s3", await fiktivesDocx("Fassung zwei"));
    await e.sperre("UNLOCK", "s3");

    const l = await lage(w, "anna", koId, anhangId);
    expect(l.status).toBe(200);
    expect(l.body.fassung).toBe(2);
    expect(l.body.verlauf).toHaveLength(2);
    expect(l.body.verlauf[0]).toMatchObject({ version: 1, objectId, aktuell: false });
    expect(l.body.verlauf[1]).toMatchObject({ version: 2, aktuell: true });
    // Das alte Objekt ist unverändert im Speicher.
    const alt = await w.objekte.read(objectId);
    expect(Buffer.compare(decodeDataUrl(alt?.data ?? "")?.bytes ?? Buffer.alloc(0), start)).toBe(0);

    const zurueck = await w.app.inject({
      method: "POST",
      url: `/api/kos/${koId}/office/${anhangId}/zurueckholen`,
      headers: als("anna"),
      payload: { ausFassung: 1, expectedVersion: 2 },
    });
    expect(zurueck.statusCode).toBe(200);
    expect(zurueck.json()).toMatchObject({ fassung: 3, status: "offen" });
    expect(Buffer.compare(await bytesDesAnhangs(w, koId, anhangId), start)).toBe(0);
    const danach = await lage(w, "anna", koId, anhangId);
    expect(danach.body.verlauf.at(-1)).toMatchObject({
      version: 3,
      restoredFrom: 1,
      aktuell: true,
    });
    // Der Artikelrückweg: die Fassung steht in der Historie und hat einen Snapshot.
    const versionen = await w.ko.versionsOf(koId);
    expect(versionen.map((v) => v.version)).toEqual([1, 2, 3]);
    const ko = await w.ko.get(koId);
    expect(ko?.history.at(-1)).toMatchObject({
      version: 3,
      anhangGeaendert: anhangId,
      anhangZurueckAus: 1,
    });
    // Der Artikeltext stammt NICHT aus Fassung 1 — nur das Dokument wurde zurückgeholt.
    expect(ko?.history.at(-1)).not.toHaveProperty("restoredFrom");

    // Ein veralteter Rückholversuch überschreibt nichts.
    const veraltet = await w.app.inject({
      method: "POST",
      url: `/api/kos/${koId}/office/${anhangId}/zurueckholen`,
      headers: als("anna"),
      payload: { ausFassung: 2, expectedVersion: 2 },
    });
    expect(veraltet.statusCode).toBe(409);
    expect((await w.ko.get(koId))?.version).toBe(3);
  });

  it("O4 (K4): zwei Nutzer gemeinsam, fremde Änderung ohne stillen Verlust", async () => {
    const { koId, anhangId } = await artikelMitAnhang(w, "docx", await fiktivesDocx("Gemeinsam"));
    const a = await sitzung(w, "anna", koId, anhangId);
    const b = await sitzung(w, "bert", koId, anhangId);
    expect(b.body.schreibweg).toBe("direkt");
    const ea = editor(w, anhangId, a.body.accessToken);
    const eb = editor(w, anhangId, b.body.accessToken);
    // Der Editor führt EINE Sitzung je Datei; beide Teilnehmer tragen dieselbe Sperre.
    expect((await ea.sperre("LOCK", "gemeinsam-1")).statusCode).toBe(200);
    expect((await eb.sperre("REFRESH_LOCK", "gemeinsam-1")).statusCode).toBe(200);
    const vonBert = await fiktivesDocx("Gemeinsam — Ergänzung von Bert");
    expect((await eb.speichere("gemeinsam-1", vonBert)).statusCode).toBe(200);
    // Ein zweiter Editor-Knoten mit eigener Sperre bekommt 409 und speichert nichts.
    const fremd = await eb.sperre("LOCK", "anderer-knoten");
    expect(fremd.statusCode).toBe(409);
    expect(fremd.headers["x-wopi-lock"]).toBe("gemeinsam-1");

    const lageBert = await lage(w, "bert", koId, anhangId);
    expect(lageBert.body.sitzung).toMatchObject({ laeuft: true, arbeitsstandOffen: true });

    expect((await uebernimm(w, "anna", koId, anhangId)).body.fassung).toBe(2);

    // Jetzt schreibt jemand AUSSERHALB der Editor-Sitzung am Artikel.
    await w.ko.revise(koId, { statement: "Fremde Änderung am Text." }, "chef");
    const danachBert = await fiktivesDocx("Gemeinsam — zweite Ergänzung von Bert");
    expect((await eb.speichere("gemeinsam-1", danachBert)).statusCode).toBe(200);
    const konflikt = await uebernimm(w, "bert", koId, anhangId);
    expect(konflikt.status).toBe(409);
    expect(konflikt.body.error).toBe("KO_STALE");
    expect(konflikt.body.message).toContain("nichts überschrieben");
    const ko = await w.ko.get(koId);
    expect(ko?.version).toBe(3);
    expect(ko?.statement).toBe("Fremde Änderung am Text.");

    // Schließen: der Stand wird nicht übernommen, aber gesichert und angezeigt.
    expect((await eb.sperre("UNLOCK", "gemeinsam-1")).statusCode).toBe(200);
    const gesichert = await lage(w, "bert", koId, anhangId);
    expect(gesichert.body.sitzung.laeuft).toBe(false);
    expect(gesichert.body.gesichert).toHaveLength(1);
    expect(gesichert.body.gesichert[0].eigen).toBe(true);

    // Bewusste Übernahme des gesicherten Stands auf die aktuelle Fassung.
    const bewusst = await w.app.inject({
      method: "POST",
      url: `/api/kos/${koId}/office/${anhangId}/gesichert`,
      headers: als("bert"),
      payload: { objectId: gesichert.body.gesichert[0].objectId, expectedVersion: 3 },
    });
    expect(bewusst.statusCode).toBe(200);
    expect(bewusst.json().fassung).toBe(4);
    expect(Buffer.compare(await bytesDesAnhangs(w, koId, anhangId), danachBert)).toBe(0);
    expect((await w.ko.get(koId))?.statement).toBe("Fremde Änderung am Text.");

    // Eine beliebige Objektkennung aus dem Rumpf wird nie übernommen.
    const erfunden = await w.app.inject({
      method: "POST",
      url: `/api/kos/${koId}/office/${anhangId}/gesichert`,
      headers: als("bert"),
      payload: { objectId: "erfunden", expectedVersion: 4 },
    });
    expect(erfunden.statusCode).toBe(400);
  });

  it("O5 (K5): Dokumentänderung stuft nie hoch; Belegstellen zeigen ihren Dokumentstand", async () => {
    const { koId, anhangId, objectId } = await artikelMitAnhang(
      w,
      "docx",
      await fiktivesDocx("Freigegebener Stand"),
    );
    await w.ko.addSource(koId, "anna", {
      label: "Abschnitt 2 der Anleitung",
      excerpt: "Monatlich prüfen.",
      objectId,
    });
    await w.ko.reviseUndFreigeben(koId, {}, "chef", { trust: 99 });
    expect((await w.ko.get(koId))?.status).toBe("validiert");

    // Experte ohne Freigaberecht: nur Ansicht, Marke ohne Schreibrecht, PutFile abgewiesen.
    const anna = await sitzung(w, "anna", koId, anhangId);
    expect(anna.body.schreibweg).toBe("vorschlag");
    const ea = editor(w, anhangId, anna.body.accessToken);
    expect((await ea.info()).json()).toMatchObject({ UserCanWrite: false, ReadOnly: true });
    expect((await ea.sperre("LOCK", "anna-x")).statusCode).toBe(401);
    expect((await w.ko.get(koId))?.status).toBe("validiert");

    // Mit Freigaberecht bearbeitet: neue Fassung, Status `offen`, Trust 0 — nicht hochgestuft.
    const chef = await sitzung(w, "chef", koId, anhangId);
    expect(chef.body.schreibweg).toBe("direkt");
    const ec = editor(w, anhangId, chef.body.accessToken);
    await ec.sperre("LOCK", "chef-1");
    await ec.speichere("chef-1", await fiktivesDocx("Geänderter Stand"));
    const u = await uebernimm(w, "chef", koId, anhangId);
    expect(u.body).toMatchObject({ status: "offen" });
    const ko = await w.ko.get(koId);
    expect(ko?.status).toBe("offen");
    expect(ko?.trust).toBe(0);
    await ec.sperre("UNLOCK", "chef-1");

    const l = await lage(w, "anna", koId, anhangId);
    expect(l.body.status).toBe("offen");
    expect(l.body.belegstellen).toEqual([
      expect.objectContaining({
        label: "Abschnitt 2 der Anleitung",
        stand: "frueher",
      }),
    ]);
    // Die Belegstelle selbst ist unverändert — nichts wird still umgehängt.
    expect(ko?.sources?.[0]?.objectId).toBe(objectId);
  });

  it("O6 (K6): Unberechtigte erreichen weder Editor noch Dokument", async () => {
    const { koId, anhangId } = await artikelMitAnhang(
      w,
      "docx",
      await fiktivesDocx("Vertraulich"),
      "chef",
    );
    await w.ko.setConfidentiality(koId, "vertraulich", "chef");

    // Experte sieht den vertraulichen Artikel nicht: wie am Detailabruf 404.
    expect((await lage(w, "anna", koId, anhangId)).status).toBe(404);
    expect((await sitzung(w, "anna", koId, anhangId)).status).toBe(404);
    // Ohne Anmeldung: 401.
    const anonym = await w.app.inject({
      method: "POST",
      url: `/api/kos/${koId}/office/${anhangId}/sitzung`,
    });
    expect(anonym.statusCode).toBe(401);
    // Lesende Rolle darf nichts übernehmen.
    expect((await uebernimm(w, "vera", koId, anhangId)).status).toBe(403);

    // WOPI ohne Marke, mit erfundener Marke, mit Marke eines anderen Anhangs: 401.
    expect((await w.app.inject({ method: "GET", url: `/wopi/files/${anhangId}` })).statusCode).toBe(
      401,
    );
    expect(
      (await w.app.inject({ method: "GET", url: `/wopi/files/${anhangId}?access_token=a.b` }))
        .statusCode,
    ).toBe(401);
    const chef = await sitzung(w, "chef", koId, anhangId);
    expect(chef.status).toBe(200);
    const andere = await artikelMitAnhang(w, "docx", await fiktivesDocx("Anderes"), "chef");
    expect((await editor(w, andere.anhangId, chef.body.accessToken).lies()).statusCode).toBe(401);
    // Ein anonymer Dateikörper wird vor dem Parsen abgewiesen.
    const roh = await w.app.inject({
      method: "POST",
      url: `/wopi/files/${anhangId}/contents`,
      headers: { "Content-Type": "application/octet-stream", "X-WOPI-Override": "PUT" },
      payload: Buffer.alloc(1024),
    });
    expect(roh.statusCode).toBe(401);

    // Eine gültige Marke hilft nicht mehr, sobald das Konto gesperrt ist.
    const ec = editor(w, anhangId, chef.body.accessToken);
    expect((await ec.lies()).statusCode).toBe(200);
    const konto = w.konten.find((k) => k.id === "chef") as { approved: boolean };
    konto.approved = false;
    try {
      expect((await ec.lies()).statusCode).toBe(404);
      expect((await ec.info()).statusCode).toBe(404);
    } finally {
      konto.approved = true;
    }
  });

  it("O7a (K7): Editor nicht erreichbar → sichtbarer Fehler, nichts geändert", async () => {
    const kaputt = await baueWelt(eingerichtet, () => {
      throw new Error("Verbindung abgelehnt");
    });
    try {
      const { koId, anhangId } = await artikelMitAnhang(
        kaputt,
        "docx",
        await fiktivesDocx("Unverändert"),
      );
      const s = await sitzung(kaputt, "anna", koId, anhangId);
      expect(s.status).toBe(502);
      expect(s.body.error).toBe("OFFICE_EDITOR_NICHT_ERREICHBAR");
      expect(s.body).not.toHaveProperty("accessToken");
      expect((await kaputt.ko.get(koId))?.version).toBe(1);
    } finally {
      await kaputt.app.close();
    }
  });

  it("O7b (K7): ohne Einrichtung kein Editor, aber eine klare Auskunft", async () => {
    const ohne = await baueWelt(leseOfficeEditorUmgebung({}));
    try {
      const { koId, anhangId } = await artikelMitAnhang(ohne, "docx", await fiktivesDocx("Ohne"));
      const l = await lage(ohne, "anna", koId, anhangId);
      expect(l.status).toBe(200);
      expect(l.body.editorEingerichtet).toBe(false);
      const s = await sitzung(ohne, "anna", koId, anhangId);
      expect(s.status).toBe(503);
      expect(s.body.error).toBe("OFFICE_EDITOR_NICHT_EINGERICHTET");
      const wopi = await ohne.app.inject({ method: "GET", url: `/wopi/files/${anhangId}` });
      expect(wopi.statusCode).toBe(404);
    } finally {
      await ohne.app.close();
    }
  });
});
