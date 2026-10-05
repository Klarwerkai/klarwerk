// ================================================================================================
// BELEGDATEI-NEULADEN · DER SICHTBARE NAME IST NICHT DIE IDENTITÄT DER BELEGDATEI (Tor-Hälfte)
// ================================================================================================
//
// WORAN DIESE DATEI ANSCHLIESST, und was sie NICHT neu baut: der Anker einer Belegstelle
// (`KoSource.objectId`) wird seit JOB 4077 serverseitig gegen die Anhangsliste DESSELBEN Objekts
// bestätigt (`services/knowledge-object/src/source-anchor.ts`) und beim ANZEIGEN zu einem
// Dateinamen aufgelöst (`apps/web/src/lib/koSource.ts`, `quellennachweis`; darüber
// `apps/web/src/lib/askCitedSources.ts`, `originalweg`). Keine Zeile Produktcode ändert sich hier.
//
// WAS JOB 4077 NICHT GEMESSEN HAT und hier steht:
//   · ZWEI ANHÄNGE MIT GLEICHEM SICHTBAREM NAMEN. `ableitung-dateiname.test.ts` wählt aus mehreren
//     Anhängen mit VERSCHIEDENEN Namen. Ob der Name mitentscheidet, zeigt erst ein Köder mit
//     DEMSELBEN Namen, der VOR dem echten Anhang in der Liste steht.
//   · DER NAME ALS KENNUNG. Eine Belegstelle, die statt der Objektkennung den Dateinamen als Anker
//     schickt, wird auf der Vorgabestufe abgewiesen und auf einer offenen Stufe ohne Anker gespeichert.
//   · DIE UMBENENNUNG. Das Produkt hat HEUTE KEINEN Umbenennen-Weg für Anhänge (es gibt nur
//     `attach` und `detach`, `ko-routes.ts`). Die Tor-Hälfte misst deshalb die Ableitung auf dem
//     ECHTEN, vom Server gelesenen Objekt mit geändertem Anhangsnamen. Die Umbenennung IM
//     GESPEICHERTEN BESTAND, über einen echten Prozessneustart hinweg, steht in
//     `belegdatei-nach-neustart-und-umbenennung.integration.test.ts` (PostgreSQL).
//
// GEMESSEN WIRD ÜBER DIE ECHTEN ROUTEN (`buildApp(buildServices())`) und die ECHTEN Ableitungen der
// Fläche — kein gemockter Dienst.
import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { originalweg } from "../../apps/web/src/lib/askCitedSources";
import { quellennachweis } from "../../apps/web/src/lib/koSource";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Kopf = Record<string, string>;

const NAME = "Pruefprotokoll.pdf";
const NEUER_NAME = "Pruefprotokoll-freigegeben.pdf";
const ECHT = "%PDF-1.4 Belegdatei ECHT";
const KOEDER = "%PDF-1.4 Belegdatei KOEDER";

const dataUrl = (text: string): string =>
  `data:application/pdf;base64,${Buffer.from(text).toString("base64")}`;

async function anmelden(app: App, email: string, password: string): Promise<Kopf> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  expect(res.statusCode, res.body).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

async function objektAnlegen(app: App, kopf: Kopf, text: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers: kopf,
    payload: { name: NAME, mime: "application/pdf", data: dataUrl(text) },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

async function anhaengen(app: App, kopf: Kopf, koId: string, objectId: string): Promise<void> {
  const res = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers: kopf,
    payload: { action: "attach", attachment: { name: NAME, mime: "application/pdf", objectId } },
  });
  expect(res.statusCode, res.body).toBe(200);
}

function belegstelle(app: App, kopf: Kopf, koId: string, objectId: string) {
  return app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers: kopf,
    payload: { action: "add-source", source: { label: "Seite 4", excerpt: "Absatz 2", objectId } },
  });
}

async function lesen(app: App, kopf: Kopf, koId: string): Promise<KnowledgeObject> {
  const res = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers: kopf });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as KnowledgeObject;
}

async function eintrag(app: App, kopf: Kopf, titel: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: kopf,
    payload: {
      confidentiality: "intern",
      title: titel,
      statement: "Dichtung vor jedem Anlauf prüfen.",
      type: "best_practice",
      category: "Instandhaltung",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

/**
 * Ein Objekt mit ZWEI gleichnamigen Anhängen: der Köder liegt ZUERST in der Liste, die Belegstelle
 * ist an den ZWEITEN verankert. Eine Auflösung über den Namen träfe den Köder.
 */
async function aufbau() {
  const app = buildApp(buildServices());
  const reg = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "beleg-admin@klarwerk.test", password: "geheim12345" },
  });
  expect(reg.statusCode, reg.body).toBe(201);
  const kopf = await anmelden(app, "beleg-admin@klarwerk.test", "geheim12345");
  const koId = await eintrag(app, kopf, "Dichtungswechsel L4");
  const koeder = await objektAnlegen(app, kopf, KOEDER);
  const echt = await objektAnlegen(app, kopf, ECHT);
  await anhaengen(app, kopf, koId, koeder);
  await anhaengen(app, kopf, koId, echt);
  const angelegt = await belegstelle(app, kopf, koId, echt);
  expect(angelegt.statusCode, angelegt.body).toBe(200);
  return { app, kopf, koId, echt, koeder };
}

describe("Belegdatei: gleicher sichtbarer Name, verschiedene Dateien", () => {
  it("die Belegstelle führt zur verankerten Datei, nicht zur ersten mit demselben Namen", async () => {
    const { app, kopf, koId, echt, koeder } = await aufbau();
    const ko = await lesen(app, kopf, koId);
    expect(ko.attachments?.map((a) => a.name)).toEqual([NAME, NAME]);
    expect(ko.sources?.[0]?.objectId).toBe(echt);

    const weg = originalweg(ko, "de");
    expect(weg.quellen[0]?.datei?.objectId).toBe(echt);
    expect(weg.quellen[0]?.datei?.href).toBe(`/api/objects/${echt}/raw`);
    // Der Köder bleibt als FREIE Datei sichtbar — er wird weder verschwiegen noch zur Belegdatei.
    expect(weg.freieDateien.map((d) => d.objectId)).toEqual([koeder]);

    const roh = await app.inject({ method: "GET", url: `/api/objects/${echt}/raw`, headers: kopf });
    expect(roh.statusCode).toBe(200);
    expect(roh.body).toBe(ECHT);
    await app.close();
  });

  it("Ableitung am gelesenen Stand mit geändertem Anhangsnamen: neuer Name, gleiche Kennung und Bytes", async () => {
    const { app, kopf, koId, echt, koeder } = await aufbau();
    const ko = await lesen(app, kopf, koId);
    // Das Produkt hat keinen Umbenennen-Weg (Kopf der Datei). Geändert wird hier NUR die gelesene
    // Kopie — gemessen ist damit die Ableitung, nicht die Speicherung. Die GESPEICHERTE Umbenennung
    // samt Neustart und erneutem Laden der Oberfläche steht im PostgreSQL-Integrationslauf daneben.
    const umbenannt: KnowledgeObject = {
      ...ko,
      attachments: (ko.attachments ?? []).map((a) =>
        a.objectId === echt ? { ...a, name: NEUER_NAME } : a,
      ),
    };
    const quelle = umbenannt.sources?.[0];
    expect(quelle).toBeDefined();
    if (!quelle) {
      return;
    }
    expect(quellennachweis(quelle, umbenannt.attachments ?? [], "de").datei).toBe(NEUER_NAME);
    const weg = originalweg(umbenannt, "de");
    expect(weg.quellen[0]?.datei).toEqual({
      objectId: echt,
      name: NEUER_NAME,
      href: `/api/objects/${echt}/raw`,
    });
    expect(weg.freieDateien).toEqual([
      { objectId: koeder, name: NAME, href: `/api/objects/${koeder}/raw` },
    ]);
    const roh = await app.inject({ method: "GET", url: `/api/objects/${echt}/raw`, headers: kopf });
    expect(roh.body).toBe(ECHT);
    await app.close();
  });
});

describe("Belegdatei: fremde oder erfundene Kennung wird abgewiesen", () => {
  it("der sichtbare Dateiname als Anker: auf der Vorgabestufe 403, der Bestand bleibt unverändert", async () => {
    const { app, kopf, koId, echt } = await aufbau();
    const res = await belegstelle(app, kopf, koId, NAME);
    expect(res.statusCode, res.body).toBe(403);
    const ko = await lesen(app, kopf, koId);
    expect(ko.sources?.map((s) => s.objectId)).toEqual([echt]);
    await app.close();
  });

  it("der sichtbare Dateiname als Anker: auf offener Stufe entsteht die Quelle OHNE Anker", async () => {
    const { app, kopf, koId, echt } = await aufbau();
    const stufe = await app.inject({
      method: "PUT",
      url: "/api/external/policy",
      headers: kopf,
      payload: { stage: "search_attach" },
    });
    expect(stufe.statusCode, stufe.body).toBe(200);
    const res = await belegstelle(app, kopf, koId, NAME);
    expect(res.statusCode, res.body).toBe(200);
    const ko = await lesen(app, kopf, koId);
    expect(ko.sources?.map((s) => s.objectId ?? null)).toEqual([echt, null]);
    // Die ankerlose Quelle nennt KEINE Datei — auch nicht die mit ihrem Namen.
    expect(originalweg(ko, "de").quellen[1]?.datei).toBeNull();
    await app.close();
  });

  it("die Kennung eines Anhangs an einem FREMDEN Objekt: auf der Vorgabestufe 403", async () => {
    const { app, kopf, koId, echt } = await aufbau();
    const fremdesKo = await eintrag(app, kopf, "Anderes Objekt");
    const fremd = await objektAnlegen(app, kopf, "%PDF-1.4 fremd");
    await anhaengen(app, kopf, fremdesKo, fremd);
    const res = await belegstelle(app, kopf, koId, fremd);
    expect(res.statusCode, res.body).toBe(403);
    const ko = await lesen(app, kopf, koId);
    expect(ko.sources?.map((s) => s.objectId)).toEqual([echt]);
    await app.close();
  });
});
