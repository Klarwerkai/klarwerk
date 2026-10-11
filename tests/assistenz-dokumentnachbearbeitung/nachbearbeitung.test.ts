// ================================================================================================
// BPA-17 · PRÄSENTATION NACH DER BESPRECHUNG NACHBEARBEITEN — ÜBER DIE ECHTEN ROUTEN.
// (Auftrag produkt:20261011:assistenz-dokumentnachbearbeitung, Szenario BPA-S18)
// ================================================================================================
//
// Geprüft wird `officeRoutes` mit dem ECHTEN Wissensobjektdienst (Speicher-Repos mit Fassungsablage
// und Belegkette), dem echten Objektspeicher und dem unveränderten WOPI-Hostweg — dieselbe Welt wie
// `tests/office-artikel-editor/office-routes.test.ts`. Ersetzt sind nur die Anmeldung (Kopfzeile)
// und die Discovery des Editors. Die Präsentation ist synthetisch (`praesentation.ts`).
//
// Ein echtes PowerPoint- oder Collabora-Programm läuft hier NICHT. Belegt ist die Datei: gespeichert,
// aus dem Speicher und über die Editor-Tür (WOPI GetFile) wieder geöffnet, Teil für Teil geprüft.
//
//   N1  Belegter Beschluss + Nutzerauftrag gespeichert, Wiederöffnen zeigt sie an der richtigen
//       Folie; Übersicht trennt Beschluss/Auftrag/KI-Empfehlung; Quellenstand sichtbar.   (K1 K2 K10)
//   N2  Zahl ohne Beleg → Klärung; nachgerechnete Quelle → eingearbeitet; falsche Rechnung und
//       Diagrammänderung → Klärung.                                                         (K3)
//   N3  Echte Notiz an der Notizseite, Notizdatei für die Folie ohne Notizseite, Handout ohne
//       ausgeblendete Folie und ohne private Notiz.                                          (K4 K8)
//   N4  Vorlage byte-gleich, Quellen unverändert, Freigabestatus nie erhöht; freigegebener Artikel
//       ohne Freigaberecht bleibt beim Vorschlagsweg.                                        (K5)
//   N5  Paralleländerung: nichts überschrieben, konkreter Konflikt je Folie, privater Entwurf,
//       erneuter Auftrag auf dem heutigen Stand behält die fremde Änderung; laufende
//       Editor-Sitzung blockiert.                                                            (K6)
//   N6  Rücknahme über `zurueckholen`; Stopp vor dem Speichern und nach dem Speichern;
//       Wiederholung derselben Laufkennung schreibt nichts.                                  (K7)
//   N7  Lesender Teilnehmer ändert nichts; unsichtbarer Artikel 404 ohne Titel.             (K8)
//   N8  Folgeprodukte privat, nicht versandt/geteilt, nicht angehängt, Eigentümer/Ziel/Klasse;
//       über `GET /api/objects/:id` und `/raw` liest nur der Eigentümer (auch Admin nicht), und
//       ein Rechteentzug an der Quelle sperrt auch die Kopien.                          (K8 K9)
//   N9  Fehler nach der Übernahme: 500 mit erfolgten Wirkungen und Ergebniskennungen;
//       Wiederholung derselben Laufkennung erzeugt keine weiteren Kopien.                (K7)

import Fastify, { type FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Guards, SessionUser } from "../../services/app/src/http";
import { SpeicherOfficeAblage } from "../../services/app/src/office-ablage";
import { anhangVerlauf, leseOfficeEditorUmgebung } from "../../services/app/src/office-artikel";
import {
  type NachbearbeitungsErgebnis,
  fuehreNachbearbeitungAus,
  leseAuftrag,
} from "../../services/app/src/office-nachbearbeitung";
import { OFFICE_FORMATE } from "../../services/app/src/office-wopi";
import { objectRoutes } from "../../services/app/src/routes/object-routes";
import { type OfficeKonto, officeRoutes } from "../../services/app/src/routes/office-routes";
import {
  InMemoryEvidenceRepo,
  InMemoryKoRepo,
  InMemoryKoVersionRepo,
} from "../../services/knowledge-object/src/repo";
import { KoService } from "../../services/knowledge-object/src/service";
import { InMemoryObjectRepo, ObjectStore, decodeDataUrl } from "../../services/object-store";
import { can } from "../../services/rbac";
import {
  PRIVATE_NOTIZ,
  VERBORGEN,
  folienText,
  synthetischePraesentation,
  teilText,
  teile,
} from "./praesentation";

const PPTX = OFFICE_FORMATE.find((f) => f.endung === "pptx")?.mime ?? "";
const DISCOVERY = `<?xml version="1.0" encoding="utf-8"?>
<wopi-discovery><net-zone name="external-http">
<app name="impress"><action default="true" ext="pptx" name="edit" urlsrc="http://intern:9980/browser/abc/cool.html?"/><action ext="pptx" name="view" urlsrc="http://intern:9980/browser/abc/cool.html?"/></app>
</net-zone></wopi-discovery>`;

/**
 * Der echte Objektspeicher; `stoereNachPuts` lässt das N-te folgende `put` scheitern (Ben-Befund
 * AC07/G12: ein Fehler NACH der Übernahme). Ohne Angabe verhält er sich unverändert.
 */
class StoerbarerSpeicher extends ObjectStore {
  puts = 0;
  stoereBeiPut: number | undefined;
  override async put(input: Parameters<ObjectStore["put"]>[0]) {
    this.puts += 1;
    if (this.stoereBeiPut !== undefined && this.puts === this.stoereBeiPut) {
      throw Object.assign(new Error("Speicher gestört (Probe)"), { code: "SPEICHER_GESTOERT" });
    }
    return super.put(input);
  }
}

interface Welt {
  app: FastifyInstance;
  ko: KoService;
  objekte: StoerbarerSpeicher;
}

async function baueWelt(): Promise<Welt> {
  const objekte = new StoerbarerSpeicher({ repo: new InMemoryObjectRepo() });
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
        // Fiktiver Testschlüssel, nur für diesen Test (32 Byte hex).
        einrichtung: leseOfficeEditorUmgebung({
          KLARWERK_OFFICE_EDITOR_URL: "https://editor.beispiel.invalid",
          APP_BASE_URL: "https://klarwerk.beispiel.invalid",
          KLARWERK_WOPI_SCHLUESSEL: "1e".repeat(32),
        }),
        konten: async () => konten,
        spaceLesbar: async () => new Set(),
        holeDiscovery: async () => DISCOVERY,
        ablage: new SpeicherOfficeAblage(),
      },
      guards,
    ),
  );
  // Der BESTEHENDE Objektzugriffsweg (`GET /api/objects/:id` und `/raw`) mit denselben Herkünften
  // wie in build-app.ts: Träger aus dem Bestand, ein Träger frisch über `ko`.
  await app.register(
    objectRoutes(objekte, guards, {
      kos: async () => ko.list(),
      ko: (koId) => ko.get(koId),
    }),
  );
  await app.ready();
  return { app, ko, objekte };
}

const als = (nutzer: string) => ({ "x-test-nutzer": nutzer });

async function speichere(w: Welt, bytes: Buffer, owner: string) {
  return w.objekte.put({
    name: "Besprechung.pptx",
    mime: PPTX,
    data: `data:${PPTX};base64,${bytes.toString("base64")}`,
    purpose: "attachment",
    owner,
  });
}

async function artikelMitPraesentation(w: Welt, autor = "anna") {
  const ref = await speichere(w, await synthetischePraesentation(), autor);
  const ko = await w.ko.create({
    title: "Pumpenwartung P1 fiktiv",
    statement: "Die fiktive Pumpe P1 wird regelmäßig gewartet.",
    type: "best_practice",
    category: "Testanlage",
    author: autor,
  });
  const mitAnhang = await w.ko.addAttachment(ko.id, autor, {
    name: "Besprechung.pptx",
    mime: PPTX,
    objectId: ref.id,
    size: ref.size,
  });
  const anhangId = mitAnhang.attachments?.[0]?.id ?? "";
  await w.ko.addSource(ko.id, autor, {
    label: "Folie 2 der Besprechungsfassung",
    excerpt: "Ausfallquote 2025: 4,2 %",
    objectId: ref.id,
  });
  return { koId: ko.id, anhangId, objectId: ref.id };
}

async function bytesVon(w: Welt, objectId: string): Promise<Buffer> {
  const gespeichert = await w.objekte.read(objectId);
  const bytes = gespeichert ? decodeDataUrl(gespeichert.data)?.bytes : undefined;
  if (!bytes) {
    throw new Error("Objekt fehlt");
  }
  return bytes;
}

async function anhangBytes(w: Welt, koId: string, anhangId: string): Promise<Buffer> {
  const ko = await w.ko.get(koId);
  return bytesVon(w, ko?.attachments?.find((a) => a.id === anhangId)?.objectId ?? "");
}

async function nachbearbeiten(
  w: Welt,
  nutzer: string,
  koId: string,
  anhangId: string,
  body: unknown,
) {
  const a = await w.app.inject({
    method: "POST",
    url: `/api/kos/${koId}/office/${anhangId}/nachbearbeitung`,
    headers: als(nutzer),
    payload: body as Record<string, unknown>,
  });
  const antwort = a.json() as NachbearbeitungsErgebnis & Record<string, unknown>;
  return { status: a.statusCode, body: antwort };
}

const BESCHLUSS = {
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
};
const AUFTRAG = {
  id: "n1",
  art: "text",
  folieId: 256,
  alt: "Team Instandhaltung",
  neu: "Team Instandhaltung Nord",
  herkunft: { art: "nutzerauftrag", quelle: "Auftrag an Klara (synthetisch)" },
};
const KI = {
  id: "k1",
  art: "text",
  folieId: 257,
  alt: "Kosten je Einsatz",
  neu: "Durchschnittliche Kosten je Einsatz",
  herkunft: { art: "ki_empfehlung", grund: "Der Begriff wäre genauer." },
};
const ZAHL_OHNE_BELEG = {
  id: "z1",
  art: "text",
  folieId: 257,
  alt: "4,2 %",
  neu: "3,1 %",
  herkunft: {
    art: "meetingbeschluss",
    quelle: "Besprechungsnotiz 09.10. (synthetisch)",
    stelle: "TOP 3",
  },
};

describe("BPA-17 · Präsentation nach der Besprechung nachbearbeiten", () => {
  let w: Welt;
  beforeAll(async () => {
    w = await baueWelt();
  });
  afterAll(async () => {
    await w.app.close();
  });

  it("N1 (K1 K2 K10): belegte Korrektur gespeichert, wiedergeöffnet, Übersicht nach Herkunft", async () => {
    const { koId, anhangId, objectId } = await artikelMitPraesentation(w);
    const r = await nachbearbeiten(w, "anna", koId, anhangId, {
      laufId: "n1-lauf",
      basisFassung: 1,
      schritte: [BESCHLUSS, AUFTRAG, KI, ZAHL_OHNE_BELEG],
      folgeprodukte: { handout: true },
    });
    expect(r.status).toBe(200);
    expect(r.body.zustand).toBe("gespeichert");
    expect(r.body.neueFassung).toBe(2);
    expect(r.body.pruefung).toMatchObject({
      wiedergeoeffnet: true,
      fassung: 2,
      bestaetigt: ["b1", "n1"],
      nichtBestaetigt: [],
      ok: true,
    });

    // K2: jede Zeile trägt ihre Herkunft; Beschluss, Auftrag und KI-Empfehlung sind getrennt.
    const zeile = (id: string) => r.body.aenderungsuebersicht.find((z) => z.id === id);
    expect(zeile("b1")).toMatchObject({
      status: "eingearbeitet",
      folieNummer: 1,
      folienTitel: "Pumpenwartung P1 (fiktiv)",
      herkunft: {
        art: "meetingbeschluss",
        quelle: "Besprechungsnotiz 09.10. (synthetisch)",
        stelle: "TOP 2, 00:14:20",
      },
    });
    expect(zeile("n1")).toMatchObject({
      status: "eingearbeitet",
      herkunft: { art: "nutzerauftrag" },
    });
    expect(zeile("k1")).toMatchObject({
      status: "vorgeschlagen",
      herkunft: { art: "ki_empfehlung", grund: "Der Begriff wäre genauer." },
    });
    expect(zeile("k1")?.grund).toMatch(/nicht eingearbeitet/);
    expect(zeile("z1")?.status).toBe("klaerung");

    // K1/K10: WIEDERÖFFNEN — unabhängig vom Modul, über die Editor-Tür (neue Sitzung, GetFile).
    const s = await w.app.inject({
      method: "POST",
      url: `/api/kos/${koId}/office/${anhangId}/sitzung`,
      headers: als("anna"),
    });
    expect(s.statusCode).toBe(200);
    expect(s.json().fassung).toBe(2);
    const marke = encodeURIComponent(s.json().accessToken);
    const gelesen = await w.app.inject({
      method: "GET",
      url: `/wopi/files/${anhangId}/contents?access_token=${marke}`,
    });
    expect(gelesen.statusCode).toBe(200);
    const bytes = gelesen.rawPayload;
    expect(Buffer.compare(bytes, await anhangBytes(w, koId, anhangId))).toBe(0);
    const folie1 = await folienText(bytes, 1);
    expect(folie1).toContain("Wartungsintervall: vierteljährlich");
    expect(folie1).not.toContain("monatlich");
    expect(folie1).toContain("Verantwortlich: Team Instandhaltung Nord");
    // Die KI-Empfehlung und die unbelegte Zahl stehen NICHT im Dokument.
    const folie2 = await folienText(bytes, 2);
    expect(folie2).toContain("Ausfallquote 2025: 4,2 %");
    expect(folie2).not.toContain("3,1");
    expect(folie2).toContain("Kosten je Einsatz: 310 EUR");
    expect(folie2).not.toContain("Durchschnittliche");

    // K10: Quellenprüfung am neuen Stand — die Belegstelle hängt am besprochenen (früheren)
    // Dokumentstand und wird ehrlich so gezeigt, nicht still umgehängt.
    const lage = await w.app.inject({
      method: "GET",
      url: `/api/kos/${koId}/office/${anhangId}`,
      headers: als("anna"),
    });
    expect(lage.json()).toMatchObject({ fassung: 2, status: "offen" });
    expect(lage.json().verlauf).toHaveLength(2);
    expect(lage.json().belegstellen).toEqual([
      expect.objectContaining({ label: "Folie 2 der Besprechungsfassung", stand: "frueher" }),
    ]);
    expect((await w.ko.get(koId))?.sources?.[0]?.objectId).toBe(objectId);

    // Die gespeicherte Änderungsübersicht trennt die drei Herkünfte in eigenen Abschnitten.
    const uebersicht = r.body.folgeprodukte.find((f) => f.art === "aenderungsuebersicht");
    const text = (await bytesVon(w, uebersicht?.objectId ?? "")).toString("utf8");
    const a = text.indexOf("### Ausdrückliche Meetingbeschlüsse");
    const b = text.indexOf("### Nutzeraufträge");
    const c = text.indexOf("### Eigene KI-Empfehlungen (nicht eingearbeitet)");
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(text).toContain("TOP 2, 00:14:20");
    expect(text).toContain("Der Begriff wäre genauer.");
  });

  it("N2 (K3): keine Zahl ohne Grundlage; Rechnung wird nachgerechnet; Diagramm wird Klärung", async () => {
    const { koId, anhangId } = await artikelMitPraesentation(w);
    const ohne = await nachbearbeiten(w, "anna", koId, anhangId, {
      laufId: "n2-ohne",
      basisFassung: 1,
      schritte: [ZAHL_OHNE_BELEG],
    });
    expect(ohne.status).toBe(200);
    expect(ohne.body.zustand).toBe("nichts_gespeichert");
    expect(ohne.body.aenderungsuebersicht[0]?.status).toBe("klaerung");
    expect(ohne.body.aenderungsuebersicht[0]?.grund).toMatch(/3\.1.*ohne belegte.*erfunden/s);
    expect((await w.ko.get(koId))?.version).toBe(1);

    const falsch = await nachbearbeiten(w, "anna", koId, anhangId, {
      laufId: "n2-falsch",
      basisFassung: 1,
      schritte: [
        {
          ...ZAHL_OHNE_BELEG,
          zahlenbeleg: {
            quelle: "Störungsliste 2025 (synthetisch)",
            werte: ["42", "1000"],
            berechnung: { art: "anteil_prozent", eingaben: [42, 1000], ergebnis: "3,1" },
          },
        },
        { id: "d1", art: "diagramm", folieId: 257, herkunft: BESCHLUSS.herkunft },
      ],
    });
    expect(falsch.body.aenderungsuebersicht.map((z) => z.status)).toEqual(["klaerung", "klaerung"]);
    expect(falsch.body.aenderungsuebersicht[0]?.grund).toMatch(/ergibt 4\.2, nicht 3,1/);
    expect(falsch.body.aenderungsuebersicht[1]?.grund).toMatch(/Diagramm.*nicht unterstützt/);
    expect((await w.ko.get(koId))?.version).toBe(1);

    // Ben-Befund AC03: ein VORZEICHENWECHSEL ist eine Zahlenänderung — ohne Beleg wird er Klärung.
    const vorzeichen = (id: string, alt: string, neu: string) => ({
      id,
      art: "text",
      folieId: 257,
      alt,
      neu,
      herkunft: { art: "nutzerauftrag" },
    });
    const ohneVorzeichen = await nachbearbeiten(w, "anna", koId, anhangId, {
      laufId: "n2-vorzeichen",
      basisFassung: 1,
      schritte: [
        vorzeichen("v1", "-10 °C", "10 °C"),
        vorzeichen("v2", "Temperaturabweichung: -10 °C", "Temperaturabweichung: +10 °C"),
      ],
    });
    expect(ohneVorzeichen.status).toBe(200);
    expect(ohneVorzeichen.body.zustand).toBe("nichts_gespeichert");
    expect(ohneVorzeichen.body.aenderungsuebersicht.map((z) => z.status)).toEqual([
      "klaerung",
      "klaerung",
    ]);
    expect(ohneVorzeichen.body.aenderungsuebersicht[0]?.grund).toMatch(/Zahl 10 ohne belegte/);
    expect((await w.ko.get(koId))?.version).toBe(1);
    expect(await folienText(await anhangBytes(w, koId, anhangId), 2)).toContain(
      "Temperaturabweichung: -10 °C",
    );

    const belegt = await nachbearbeiten(w, "anna", koId, anhangId, {
      laufId: "n2-belegt",
      basisFassung: 1,
      schritte: [
        {
          ...ZAHL_OHNE_BELEG,
          zahlenbeleg: {
            quelle: "Störungsliste 2025 (synthetisch)",
            stelle: "Blatt Ausfälle, Zeile 7",
            werte: ["31", "1000"],
            berechnung: { art: "anteil_prozent", eingaben: [31, 1000], ergebnis: "3,1" },
          },
        },
      ],
    });
    expect(belegt.status).toBe(200);
    expect(belegt.body.aenderungsuebersicht[0]).toMatchObject({
      status: "eingearbeitet",
      zahlenbeleg: {
        quelle: "Störungsliste 2025 (synthetisch)",
        stelle: "Blatt Ausfälle, Zeile 7",
      },
    });
    expect(await folienText(await anhangBytes(w, koId, anhangId), 2)).toContain(
      "Ausfallquote 2025: 3,1 %",
    );
  });

  it("N3 (K4 K8): echte Notiz an der Notizseite, Notizdatei sonst; Handout ohne Verborgenes", async () => {
    const { koId, anhangId } = await artikelMitPraesentation(w);
    const r = await nachbearbeiten(w, "anna", koId, anhangId, {
      laufId: "n3-lauf",
      basisFassung: 1,
      schritte: [BESCHLUSS],
      sprechernotizen: [
        {
          folieId: 256,
          text: "Auf das neue Intervall hinweisen.",
          herkunft: { art: "nutzerauftrag" },
        },
        {
          folieId: 257,
          text: "Quelle der Ausfallquote nennen.",
          herkunft: { art: "nutzerauftrag" },
        },
      ],
      folgeprodukte: { handout: true, sprechernotizen: true },
    });
    expect(r.status).toBe(200);
    expect(r.body.sprechernotizen?.nativ).toEqual([256]);
    expect(r.body.sprechernotizen?.alsDatei).toEqual([
      { folieId: 257, grund: expect.stringMatching(/keine Notizseite/) },
    ]);
    expect(r.body.pruefung?.notizenBestaetigt).toEqual([256]);

    // Echte PowerPoint-Notiz: im Notizteil der gespeicherten Datei, die private Notiz bleibt stehen.
    const bytes = await anhangBytes(w, koId, anhangId);
    const notiz = await teilText(bytes, "ppt/notesSlides/notesSlide1.xml");
    expect(notiz).toContain(PRIVATE_NOTIZ);
    expect(notiz).toContain("Auf das neue Intervall hinweisen.");
    expect(notiz).toContain('Geändert: „monatlich" → „vierteljährlich"');

    // Für Folie 257 gibt es keine Notizseite: nichts erfunden, die Notiz steht in der Notizdatei.
    const notizdatei = r.body.folgeprodukte.find((f) => f.art === "sprechernotizen");
    expect(notizdatei).toMatchObject({ mime: "text/markdown" });
    const notizText = (await bytesVon(w, notizdatei?.objectId ?? "")).toString("utf8");
    expect(notizText).toContain("Quelle der Ausfallquote nennen.");
    expect(notizText).toContain("NICHT in der PowerPoint-Datei");
    expect(await teilText(bytes, "ppt/slides/slide2.xml")).not.toContain("Quelle der Ausfallquote");

    // Handout: sichtbare Folien des gespeicherten Stands, ohne ausgeblendete Folie und ohne Notizen.
    const handout = r.body.folgeprodukte.find((f) => f.art === "handout");
    expect(handout).toMatchObject({ mime: "text/markdown", herkunft: { fassung: 2 } });
    const handoutText = (await bytesVon(w, handout?.objectId ?? "")).toString("utf8");
    expect(handoutText).toContain("## Folie 1 · Pumpenwartung P1 (fiktiv)");
    expect(handoutText).toContain("Wartungsintervall: vierteljährlich");
    expect(handoutText).toContain("## Folie 2 · Kennzahlen 2025");
    expect(handoutText).not.toContain("Interne Kalkulation");
    expect(handoutText).not.toContain(VERBORGEN);
    expect(handoutText).not.toContain(PRIVATE_NOTIZ);
    expect(handoutText).not.toContain("Auf das neue Intervall hinweisen.");
  });

  it("N4 (K5): Vorlage unverändert, Quellen erhalten, Freigabestatus nie erhöht", async () => {
    const { koId, anhangId, objectId } = await artikelMitPraesentation(w);
    const vorher = await teile(await bytesVon(w, objectId));
    const r = await nachbearbeiten(w, "anna", koId, anhangId, {
      laufId: "n4-lauf",
      basisFassung: 1,
      schritte: [BESCHLUSS],
      sprechernotizen: [{ folieId: 256, text: "Hinweis.", herkunft: { art: "nutzerauftrag" } }],
      folgeprodukte: { sprechernotizen: true },
    });
    expect(r.status).toBe(200);
    const nachher = await teile(await anhangBytes(w, koId, anhangId));
    expect([...nachher.keys()]).toEqual([...vorher.keys()]);
    const geaendert = [...vorher.keys()].filter((k) => vorher.get(k) !== nachher.get(k));
    expect(geaendert).toEqual(["ppt/notesSlides/notesSlide1.xml", "ppt/slides/slide1.xml"]);
    expect(r.body.pruefung).toMatchObject({ vorlageUnveraendert: true, folienUnveraendert: true });
    expect(r.body.fachstatus).toMatchObject({ vorher: "offen", nachher: "offen" });
    expect((await w.ko.get(koId))?.sources).toEqual([
      expect.objectContaining({ label: "Folie 2 der Besprechungsfassung", objectId }),
    ]);

    // Freigegebener Artikel: ohne Freigaberecht bleibt es beim Vorschlagsweg, nichts geändert.
    const frei = await artikelMitPraesentation(w);
    await w.ko.reviseUndFreigeben(frei.koId, {}, "chef", { trust: 99 });
    const freigegeben = await w.ko.get(frei.koId);
    expect(freigegeben?.status).toBe("validiert");
    const anna = await nachbearbeiten(w, "anna", frei.koId, frei.anhangId, {
      laufId: "n4-frei",
      basisFassung: freigegeben?.version,
      schritte: [BESCHLUSS],
    });
    expect(anna.status).toBe(403);
    expect(anna.body.error).toBe("PROPOSAL_REQUIRED");
    expect((await w.ko.get(frei.koId))?.status).toBe("validiert");
    // Mit Freigaberecht: neue Fassung, Status `offen` — die KI-Bearbeitung stuft nie hoch.
    const chef = await nachbearbeiten(w, "chef", frei.koId, frei.anhangId, {
      laufId: "n4-chef",
      basisFassung: freigegeben?.version,
      schritte: [BESCHLUSS],
    });
    expect(chef.status).toBe(200);
    expect(chef.body.fachstatus).toMatchObject({ vorher: "validiert", nachher: "offen" });
    expect((await w.ko.get(frei.koId))?.status).toBe("offen");
  });

  it("N5 (K6): Paralleländerung wird nicht überschrieben; Konflikt je Folie, Entwurf, neuer Lauf", async () => {
    const { koId, anhangId } = await artikelMitPraesentation(w);
    // Bert speichert parallel einen geänderten Stand (Folie 257) — über denselben Fassungsweg.
    const fremd = await speichere(
      w,
      await synthetischePraesentation({ kennzahl: "Ausfallquote 2025: 3,9 %" }),
      "bert",
    );
    await w.ko.uebernimmOfficeFassung(
      koId,
      { anhangId, objectId: fremd.id, size: fremd.size, expectedVersion: 1 },
      "bert",
    );
    const KOSTEN = {
      id: "n2",
      art: "text",
      folieId: 257,
      alt: "Ausfallquote 2025",
      neu: "Ausfallquote im Jahr 2025",
      herkunft: { art: "nutzerauftrag" },
    };
    const r = await nachbearbeiten(w, "anna", koId, anhangId, {
      laufId: "n5-lauf",
      basisFassung: 1,
      schritte: [BESCHLUSS, KOSTEN],
    });
    expect(r.status).toBe(409);
    expect(r.body.zustand).toBe("konflikt");
    expect(r.body.konflikt).toMatchObject({
      basisFassung: 1,
      heutigeFassung: 2,
      zusammenfuehrbar: false,
    });
    expect(r.body.konflikt?.schritte).toEqual([
      expect.objectContaining({ id: "b1", lage: "passt_auf_heutigen_stand" }),
      expect.objectContaining({
        id: "n2",
        lage: "konflikt",
        heutigerText: expect.arrayContaining(["Ausfallquote 2025: 3,9 %"]),
      }),
    ]);
    expect(r.body.aenderungsuebersicht.every((z) => z.status !== "eingearbeitet")).toBe(true);
    // Nichts überschrieben: Fassung 2 ist Berts Stand.
    const ko = await w.ko.get(koId);
    expect(ko?.version).toBe(2);
    expect(ko?.attachments?.[0]?.objectId).toBe(fremd.id);
    // Der eigene Stand bleibt als privater Entwurf erhalten.
    const entwurf = r.body.folgeprodukte.find((f) => f.art === "entwurf");
    expect(entwurf).toMatchObject({ eigentuemer: "anna", ziel: "privat", versandt: false });
    const entwurfText = await folienText(await bytesVon(w, entwurf?.objectId ?? ""), 2);
    expect(entwurfText).toContain("Ausfallquote im Jahr 2025: 4,2 %");

    // Zulässige Zusammenführung: der Auftrag für den heutigen Stand, nur die passende Folie.
    const neu = await nachbearbeiten(w, "anna", koId, anhangId, {
      laufId: "n5-neu",
      basisFassung: 2,
      schritte: [BESCHLUSS],
    });
    expect(neu.status).toBe(200);
    expect(neu.body.neueFassung).toBe(3);
    const bytes = await anhangBytes(w, koId, anhangId);
    expect(await folienText(bytes, 1)).toContain("vierteljährlich");
    expect(await folienText(bytes, 2)).toContain("Ausfallquote 2025: 3,9 %");

    // Laufende Editor-Sitzung: nichts wird geschrieben.
    const s = await w.app.inject({
      method: "POST",
      url: `/api/kos/${koId}/office/${anhangId}/sitzung`,
      headers: als("bert"),
    });
    const lock = await w.app.inject({
      method: "POST",
      url: `/wopi/files/${anhangId}?access_token=${encodeURIComponent(s.json().accessToken)}`,
      headers: { "X-WOPI-Override": "LOCK", "X-WOPI-Lock": "bert-1" },
    });
    expect(lock.statusCode).toBe(200);
    const waehrend = await nachbearbeiten(w, "anna", koId, anhangId, {
      laufId: "n5-sitzung",
      basisFassung: 3,
      schritte: [AUFTRAG],
    });
    expect(waehrend.status).toBe(409);
    expect(waehrend.body.error).toBe("OFFICE_SITZUNG_LAEUFT");
    expect((await w.ko.get(koId))?.version).toBe(3);
  });

  it("N6 (K7): Rücknahme, Stopp mit sichtbarem Teilergebnis, keine doppelte Ausführung", async () => {
    const { koId, anhangId } = await artikelMitPraesentation(w);
    const lauf = {
      laufId: "n6-lauf",
      basisFassung: 1,
      schritte: [BESCHLUSS],
      folgeprodukte: { handout: true },
    };
    const r = await nachbearbeiten(w, "anna", koId, anhangId, lauf);
    expect(r.status).toBe(200);
    expect(r.body.ruecknahme).toMatchObject({ moeglich: true, ausFassung: 1 });

    // Dieselbe Laufkennung noch einmal: dasselbe Ergebnis, keine neue Fassung.
    const nochmal = await nachbearbeiten(w, "anna", koId, anhangId, lauf);
    expect(nochmal.status).toBe(200);
    expect(nochmal.body.wiederholt).toBe(true);
    expect((await w.ko.get(koId))?.version).toBe(2);

    // Stopp nach Abschluss ändert nichts; ein fremder oder unbekannter Lauf ist nicht zu finden.
    const stopp = (nutzer: string, laufId: string) =>
      w.app.inject({
        method: "POST",
        url: `/api/kos/${koId}/office/${anhangId}/nachbearbeitung/${laufId}/stopp`,
        headers: als(nutzer),
      });
    expect((await stopp("anna", "n6-lauf")).statusCode).toBe(409);
    expect((await stopp("bert", "n6-lauf")).statusCode).toBe(404);
    expect((await stopp("anna", "gibt-es-nicht")).statusCode).toBe(404);

    // Rücknahme: der gespeicherte Eingriff wird über den bestehenden Weg zurückgeholt.
    const zurueck = await w.app.inject({
      method: "POST",
      url: `/api/kos/${koId}/office/${anhangId}/zurueckholen`,
      headers: als("anna"),
      payload: { ausFassung: 1, expectedVersion: 2 },
    });
    expect(zurueck.statusCode).toBe(200);
    expect(zurueck.json().fassung).toBe(3);
    const folie1 = await folienText(await anhangBytes(w, koId, anhangId), 1);
    expect(folie1).toContain("Wartungsintervall: monatlich");
    expect(folie1).not.toContain("vierteljährlich");

    // Stopp: derselbe Kern, angehalten an einer bestimmten Abfrage.
    const deps = {
      ko: w.ko,
      objekte: w.objekte,
      verlauf: async (artikel: Parameters<typeof anhangVerlauf>[0], id: string) => {
        const fassungen = await w.ko.versionsOf(artikel.id);
        return anhangVerlauf(artikel, fassungen, await w.ko.evidenceOf(artikel.id), id);
      },
      jetzt: () => Date.now(),
    };
    async function mitStoppAb(n: number) {
      const neu = await artikelMitPraesentation(w);
      const artikel = await w.ko.get(neu.koId);
      const anhang = artikel?.attachments?.[0];
      if (!artikel || !anhang) {
        throw new Error("Artikel fehlt");
      }
      let abfragen = 0;
      const ergebnis = await fuehreNachbearbeitungAus(
        deps,
        { artikel, anhang, nutzerId: "anna", gestoppt: () => ++abfragen >= n },
        leseAuftrag({
          laufId: `stopp-${n}`,
          basisFassung: 1,
          schritte: [BESCHLUSS, AUFTRAG],
          folgeprodukte: { handout: true },
        }),
      );
      return { ergebnis, version: (await w.ko.get(neu.koId))?.version };
    }
    // Abfragen: 1 vor b1, 2 vor n1, 3 vor dem Hochladen, 4 nach dem Hochladen vor der Übernahme,
    // 5 vor dem Handout.
    const vorSchritt = await mitStoppAb(2);
    expect(vorSchritt.ergebnis).toMatchObject({ zustand: "gestoppt", gestopptVor: "schritt:n1" });
    // Vorbereitet ist nicht gespeichert: auch b1 heißt nicht „eingearbeitet", sagt aber, warum.
    const [b1, n1] = vorSchritt.ergebnis.aenderungsuebersicht;
    expect(b1).toMatchObject({ id: "b1", status: "nicht_ausgefuehrt" });
    expect(b1?.grund).toMatch(/Vorbereitet/);
    expect(n1).toMatchObject({ id: "n1", status: "nicht_ausgefuehrt" });
    expect(n1?.grund).toMatch(/bevor/);
    expect(vorSchritt.version).toBe(1);

    const vorSpeichern = await mitStoppAb(3);
    expect(vorSpeichern.ergebnis).toMatchObject({ zustand: "gestoppt", gestopptVor: "speichern" });
    expect(vorSpeichern.ergebnis.aenderungsuebersicht.map((z) => z.status)).toEqual([
      "nicht_ausgefuehrt",
      "nicht_ausgefuehrt",
    ]);
    expect(vorSpeichern.version).toBe(1);

    // Ben-Befund AC07: Stopp WÄHREND des Hochladens bestätigt (Abfrage 4 nach dem Upload) — die
    // Übernahme unterbleibt, die hochgeladene Datei ist als Teilergebnis ausgewiesen.
    const nachHochladen = await mitStoppAb(4);
    expect(nachHochladen.ergebnis).toMatchObject({
      zustand: "gestoppt",
      gestopptVor: "uebernahme",
    });
    expect(nachHochladen.ergebnis.neueFassung).toBeUndefined();
    expect(nachHochladen.version).toBe(1);
    expect(nachHochladen.ergebnis.aenderungsuebersicht.map((z) => z.status)).toEqual([
      "nicht_ausgefuehrt",
      "nicht_ausgefuehrt",
    ]);
    const hochgeladen = nachHochladen.ergebnis.nichtUebernommen?.objectId ?? "";
    expect(await w.objekte.metadata(hochgeladen)).toBeDefined();
    expect(await folienText(await bytesVon(w, hochgeladen), 1)).toContain("vierteljährlich");

    const nachSpeichern = await mitStoppAb(5);
    expect(nachSpeichern.ergebnis).toMatchObject({
      zustand: "gestoppt",
      gestopptVor: "handout",
      neueFassung: 2,
      pruefung: { ok: true, bestaetigt: ["b1", "n1"] },
      ruecknahme: { moeglich: true, ausFassung: 1 },
    });
    expect(nachSpeichern.ergebnis.folgeprodukte).toEqual([]);
    expect(nachSpeichern.version).toBe(2);
  });

  it("N7 (K8): lesender Teilnehmer ändert nichts; unsichtbarer Artikel verrät keinen Titel", async () => {
    const { koId, anhangId, objectId } = await artikelMitPraesentation(w);
    const vera = await nachbearbeiten(w, "vera", koId, anhangId, {
      laufId: "n7-vera",
      basisFassung: 1,
      schritte: [BESCHLUSS],
    });
    expect(vera.status).toBe(403);
    const ko = await w.ko.get(koId);
    expect(ko?.version).toBe(1);
    expect(ko?.attachments?.[0]?.objectId).toBe(objectId);

    const geheim = await artikelMitPraesentation(w, "chef");
    await w.ko.setConfidentiality(geheim.koId, "vertraulich", "chef");
    const anna = await w.app.inject({
      method: "POST",
      url: `/api/kos/${geheim.koId}/office/${geheim.anhangId}/nachbearbeitung`,
      headers: als("anna"),
      payload: { laufId: "n7-geheim", basisFassung: 1, schritte: [BESCHLUSS] },
    });
    expect(anna.statusCode).toBe(404);
    expect(anna.body).not.toContain("Pumpenwartung");
    expect((await w.ko.get(geheim.koId))?.version).toBe(1);
  });

  it("N8 (K8 K9): Folgeprodukte privat — Eigentümer allein, auch gegen Admin; Quellenentzug sperrt", async () => {
    // Der Artikel gehört Bert; Anna bearbeitet nach. So lässt sich Anna die Quelle später entziehen.
    const { koId, anhangId } = await artikelMitPraesentation(w, "bert");
    const r = await nachbearbeiten(w, "anna", koId, anhangId, {
      laufId: "n8-lauf",
      basisFassung: 1,
      schritte: [BESCHLUSS],
      sprechernotizen: [{ folieId: 257, text: "Notiz.", herkunft: { art: "nutzerauftrag" } }],
      folgeprodukte: { handout: true, sprechernotizen: true },
    });
    expect(r.status).toBe(200);
    expect(r.body.folgeprodukte.map((f) => f.art).sort()).toEqual([
      "aenderungsuebersicht",
      "handout",
      "sprechernotizen",
    ]);
    for (const f of r.body.folgeprodukte) {
      expect(f).toMatchObject({
        eigentuemer: "anna",
        ziel: "privat",
        schutzklasse: "vertraulich",
        versandt: false,
        gemeinsamFreigegeben: false,
        herkunft: { koId, anhangId, fassung: 2 },
      });
      const ref = await w.objekte.metadata(f.objectId);
      expect(ref?.lifecycle?.owner).toBe("anna");
      expect(ref?.lifecycle?.privatQuelle).toBe(koId);
      expect(ref?.confidentiality).toBe("vertraulich");
    }
    const ko = await w.ko.get(koId);
    expect(ko?.attachments).toHaveLength(1);
    expect(ko?.status).toBe("offen");

    // Über den BESTEHENDEN Objektzugriffsweg: Metadaten/Daten-URL und Rohbytes.
    const lies = async (nutzer: string, objectId: string) => {
      const meta = await w.app.inject({
        method: "GET",
        url: `/api/objects/${objectId}`,
        headers: als(nutzer),
      });
      const roh = await w.app.inject({
        method: "GET",
        url: `/api/objects/${objectId}/raw`,
        headers: als(nutzer),
      });
      return [meta.statusCode, roh.statusCode];
    };
    for (const f of r.body.folgeprodukte) {
      // Der Eigentümer liest.
      expect(await lies("anna", f.objectId)).toEqual([200, 200]);
      // Niemand sonst — weder der Artikelautor noch die Administratorin (`ko.validate`).
      expect(await lies("bert", f.objectId)).toEqual([404, 404]);
      expect(await lies("chef", f.objectId)).toEqual([404, 404]);
    }

    // Quellenrechte entzogen: der vertrauliche Artikel ist für Anna nicht mehr sichtbar — damit
    // auch keine ihrer Kopien, Handout eingeschlossen.
    await w.ko.setConfidentiality(koId, "vertraulich", "chef");
    for (const f of r.body.folgeprodukte) {
      expect(await lies("anna", f.objectId)).toEqual([404, 404]);
      expect(await lies("chef", f.objectId)).toEqual([404, 404]);
    }
  });

  it("N9 (K7): Fehler NACH der Übernahme — Wirkungen bleiben sichtbar, Wiederholung kopiert nicht", async () => {
    const { koId, anhangId } = await artikelMitPraesentation(w);
    // Puts dieses Laufs: 1 Dokument (→ Übernahme), 2 Handout, 3 Änderungsübersicht.
    w.objekte.stoereBeiPut = w.objekte.puts + 2;
    const lauf = {
      laufId: "n9-lauf",
      basisFassung: 1,
      schritte: [BESCHLUSS],
      folgeprodukte: { handout: true },
    };
    try {
      const r = await nachbearbeiten(w, "anna", koId, anhangId, lauf);
      expect(r.status).toBe(500);
      expect(r.body).toMatchObject({
        error: "NACHBEARBEITUNG_TEILFEHLER",
        zustand: "teilfehler",
        fehler: { code: "SPEICHER_GESTOERT" },
        ruecknahme: { moeglich: true, ausFassung: 1 },
      });
      const wirkungen = r.body.wirkungen as { art: string; fassung?: number; objectId?: string }[];
      expect(wirkungen.map((x) => x.art)).toEqual(["hochgeladen", "fassung"]);
      expect(wirkungen[1]?.fassung).toBe(2);
      // Die gespeicherte Fassung ist real und trägt genau das gemeldete Objekt.
      const ko = await w.ko.get(koId);
      expect(ko?.version).toBe(2);
      expect(ko?.attachments?.[0]?.objectId).toBe(wirkungen[1]?.objectId);

      // Dieselbe Laufkennung noch einmal: derselbe Stand, kein weiteres Objekt, keine Fassung.
      const puts = w.objekte.puts;
      const nochmal = await nachbearbeiten(w, "anna", koId, anhangId, lauf);
      expect(nochmal.status).toBe(500);
      expect(nochmal.body).toMatchObject({ zustand: "teilfehler", wiederholt: true });
      expect(nochmal.body.wirkungen).toEqual(r.body.wirkungen);
      expect(w.objekte.puts).toBe(puts);
      expect((await w.ko.get(koId))?.version).toBe(2);
    } finally {
      w.objekte.stoereBeiPut = undefined;
    }
  });
});
