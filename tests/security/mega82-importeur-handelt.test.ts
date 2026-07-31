// ================================================================================================
// AUFTRAG-mega82 BLOCK A — WER IMPORTIERT, HANDELT. WER IM IMPORT GENANNT WIRD, HANDELT NICHT.
// ================================================================================================
//
// DER BEFUND (ben, sammel79 → mega80 ROT). mega78 und mega80 haben den Anhangs-Nachweis an einen
// SERVERSEITIG feststehenden Urheber gebunden: `attachments[].author` kommt aus der Anmeldung,
// `EvidenceRecord.createdBy` ebenso, und für die reine Fließtext-Fundstelle springt der VERFASSER
// der Fassung ein — aber nur für das, was er in GENAU DIESER Mutation neu eingebracht hat.
//
// Genau dieser Verfasser war die benannte Restgröße (sichtbarkeit.ts, mega80 Block B): der
// Import-Re-Sync rief `koService.revise` mit `item.author ?? actor` auf. `item.author` stammt aus
// dem REQUEST. Damit war der letzte Nachweis, den mega80 aufgebaut hat, über einen einzigen Weg
// FÄLSCHBAR — und der Weg braucht keinen Adapter, sondern nur den generischen Eingang:
//
//   1. Ein Nutzer mit `ko.create` reicht `ImportItem[]` an POST /api/library/import/candidates ein.
//      `ImportItem` erlaubt frei geliefertes `author` UND `bodyHtml` (library-analytics/types.ts).
//   2. Er setzt `bodyHtml` auf die Kennung eines FREMDEN, für ihn unsichtbaren Objekts und
//      `author` auf die Kennung des HOCHLADENDEN dieses Objekts.
//   3. Ein Controller nimmt den Kandidaten an. Bei aktivem Upsert-Strang revidiert der Re-Sync ein
//      vorhandenes Wissensobjekt mit `item.author` als Revisions- und Schnappschussautor.
//   4. Die Differenzregel aus mega80 sieht die Fundstelle korrekt als NEU — und `vomHochladenden`
//      akzeptiert den frei gelieferten String. Die Zuordnung wird `nachgewiesen`, die Rohbytes
//      öffnen sich.
//
// DIE REGEL AB HIER: der authentifizierte `actor` ist der ALLEINIGE Mutations- und
// Schnappschussakteur des Imports. Der Quellautor reist weiter — aber als METADATUM
// (`originalAuthor`, `KoSource.author`), nie als Handelnder.
//
// DER ZWEITE FUNDORT, selbst erhoben und NICHT hinter dem Schalter: `POST /api/library/import`
// (importJson) schrieb `author: item.author` direkt in das neue Wissensobjekt. `ko.author` ist
// keine Anzeige, sondern eine RECHTEPOSITION — `darfSehen` (sichtbarkeit.ts:76) öffnet ein
// vertrauliches Objekt für seinen Autor, `ko-routes.ts:1154` erlaubt ihm das Löschen, und
// `KoService.create` trägt denselben String als v1-Schnappschussautor und als Akteur des
// `ko.created`-Belegs ein (knowledge-object/src/service.ts:1254/1266). Der Accept-Pfad war dafür
// seit WP-SAMMEL21-FIX schon richtig gebaut (`author: actor` + `originalAuthor`); der JSON-Import
// war es nie.
//
// ALLE FÄLLE SIND AM DRAHT GEBAUT — dieselbe Regel wie mega74/76/78: die Objekte reisen durch die
// echten HTTP-Wege, damit der Test unabhängig davon bleibt, wie der Import intern zugeschnitten ist.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

// Der Re-Sync-/Upsert-Strang hängt am generischen Import-Enable (build-app.ts:364). Er ist im
// Betrieb Vorgabe AUS — dieser Test schaltet ihn AN, weil genau der eingeschaltete Zustand das
// Fenster ist, das geschlossen werden muss.
const ENV_KEYS = ["KLARWERK_CONFLUENCE_IMPORT", "KLARWERK_SKIP_KEYCHAIN"] as const;
const vorher: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

beforeAll(() => {
  for (const key of ENV_KEYS) {
    vorher[key] = process.env[key];
  }
  process.env.KLARWERK_CONFLUENCE_IMPORT = "1";
  process.env.KLARWERK_SKIP_KEYCHAIN = "1";
});

afterAll(() => {
  for (const key of ENV_KEYS) {
    if (vorher[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = vorher[key];
    }
  }
});

async function anmelden(app: App, email: string): Promise<{ auth: Auth; id: string }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim12345" },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  const body = res.json();
  return { auth: { authorization: `Bearer ${body.token}` }, id: body.user.id as string };
}

/** Admin · Hochladender (experte) · Angreifer (experte, darf einreichen) · Controller (nimmt an). */
async function setup(marke: string) {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: `admin@${marke}.test`, password: "geheim12345" },
  });
  const admin = await anmelden(app, `admin@${marke}.test`);
  for (const [email, role] of [
    [`hochladender@${marke}.test`, "experte"],
    [`angreifer@${marke}.test`, "experte"],
    [`controller@${marke}.test`, "controller"],
  ] as const) {
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: admin.auth,
      payload: { name: email, email, password: "geheim12345", role },
    });
    if (res.statusCode !== 201) {
      throw new Error(`Konto ${email} nicht angelegt: ${res.statusCode} ${res.body}`);
    }
  }
  return {
    app,
    admin,
    hochladender: await anmelden(app, `hochladender@${marke}.test`),
    angreifer: await anmelden(app, `angreifer@${marke}.test`),
    controller: await anmelden(app, `controller@${marke}.test`),
  };
}

async function hochladen(app: App, wer: Auth): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers: wer,
    payload: {
      name: "typenschild.png",
      mime: "image/png",
      data: PNG_DATA_URL,
      kind: "image",
      purpose: "attachment",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json().id as string;
}

async function rohbytes(app: App, wer: Auth, objectId: string) {
  return app.inject({ method: "GET", url: `/api/objects/${objectId}/raw`, headers: wer });
}

interface Kandidat {
  title: string;
  statement: string;
  type: "best_practice";
  category: string;
  externalId: string;
  provider: string;
  sourceVersion: number;
  confidentiality: "intern" | "vertraulich";
  author?: string;
  bodyHtml?: string;
}

async function einreichen(app: App, wer: Auth, item: Kandidat): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/library/import/candidates",
    headers: wer,
    payload: { items: [item] },
  });
  expect(res.statusCode, res.body).toBe(201);
  return res.json()[0].id as string;
}

async function annehmen(app: App, wer: Auth, kandidatId: string) {
  const res = await app.inject({
    method: "PUT",
    url: `/api/library/import/candidates/${kandidatId}`,
    headers: wer,
    payload: { action: "accept" },
  });
  expect(res.statusCode, res.body).toBe(200);
  return res.json();
}

describe("mega82 A — der Importeur handelt, nicht der Genannte", () => {
  it("ein eingereichter Quellautor macht aus einer fremden Kennung keinen Nachweis", async () => {
    const { app, hochladender, angreifer, controller } = await setup("mega82a");

    // 1. Das Opfer lädt ein Objekt hoch und bindet es NIRGENDS. Trägerlos ist fail-closed
    //    (mega76 B) — ohne diese Vorbedingung wäre jedes spätere 404 nichtssagend.
    const objectId = await hochladen(app, hochladender.auth);
    const vorbedingung = await rohbytes(app, angreifer.auth, objectId);
    expect(
      vorbedingung.statusCode,
      `VORBEDINGUNG: ein trägerloses fremdes Objekt ist fail-closed. Antwort: ${vorbedingung.statusCode}`,
    ).toBe(404);

    // 2. Ein harmloser Erst-Import legt das Ziel-Wissensobjekt mit Herkunfts-Anker an. INTERN,
    //    damit es für jeden sichtbar ist — der Angreifer braucht einen sichtbaren Träger.
    const ersterKandidat = await einreichen(app, angreifer.auth, {
      title: "Wartungsplan Anlage 7",
      statement: "Aus der Quelle importiert.",
      type: "best_practice",
      category: "Anlage 7",
      externalId: "SEITE-82",
      provider: "Confluence",
      sourceVersion: 1,
      confidentiality: "intern",
    });
    const erstesKo = await annehmen(app, controller.auth, ersterKandidat);
    const koId = erstesKo.koId as string;
    expect(koId, "Der Erst-Accept muss ein Wissensobjekt erzeugt haben.").toBeTruthy();

    // 3. DER ANGRIFF. Derselbe Herkunfts-Anker, höhere Quellversion — also der Re-Sync-Zweig.
    //    Im Rumpf steht die Kennung des FREMDEN Objekts, und `author` behauptet, der Hochladende
    //    dieses Objekts habe die Fassung geschrieben.
    const angriffsKandidat = await einreichen(app, angreifer.auth, {
      title: "Wartungsplan Anlage 7",
      statement: "Aus der Quelle importiert.",
      type: "best_practice",
      category: "Anlage 7",
      externalId: "SEITE-82",
      provider: "Confluence",
      sourceVersion: 2,
      confidentiality: "intern",
      author: hochladender.id,
      bodyHtml: `<p>Siehe Abbildung <img src="/api/objects/${objectId}/raw" alt="" /></p>`,
    });
    const zweiterAccept = await annehmen(app, controller.auth, angriffsKandidat);
    expect(
      zweiterAccept.koId,
      "Der Re-Sync soll dasselbe Wissensobjekt fortschreiben, nicht ein zweites anlegen.",
    ).toBe(koId);

    // 4. DIE ZUSAGE. Der eingereichte Name ist kein Nachweis — der Angreifer bekommt die Rohbytes
    //    des fremden Objekts weiterhin NICHT.
    const nachher = await rohbytes(app, angreifer.auth, objectId);
    expect(
      nachher.statusCode,
      `Ein frei gelieferter \`item.author\` hat die fremde Objektkennung zum Nachweis erhoben.
      Der Angreifer liest die Rohbytes eines Objekts, das er nie öffnen durfte. Antwort: ${nachher.statusCode}`,
    ).toBe(404);

    // 5. Der Hochladende selbst verliert nichts — sein eigenes Objekt bleibt ihm offen.
    const eigen = await rohbytes(app, hochladender.auth, objectId);
    expect(eigen.statusCode, eigen.body).toBe(200);
  });

  it("der Schnappschuss des Re-Syncs trägt den Annehmenden, der Quellautor bleibt Metadatum", async () => {
    const { app, angreifer, controller } = await setup("mega82b");

    const ersterKandidat = await einreichen(app, angreifer.auth, {
      title: "Prüfprotokoll Kessel 3",
      statement: "Erstfassung aus der Quelle.",
      type: "best_practice",
      category: "Anlage 3",
      externalId: "SEITE-83",
      provider: "Confluence",
      sourceVersion: 1,
      confidentiality: "intern",
      author: "Frieda Fremdautorin",
    });
    const koId = (await annehmen(app, controller.auth, ersterKandidat)).koId as string;

    // DIE GEGENPROBE: ein legitimer Re-Import läuft unverändert durch …
    const zweiterKandidat = await einreichen(app, angreifer.auth, {
      title: "Prüfprotokoll Kessel 3 (überarbeitet)",
      statement: "Zweite Fassung aus der Quelle.",
      type: "best_practice",
      category: "Anlage 3",
      externalId: "SEITE-83",
      provider: "Confluence",
      sourceVersion: 2,
      confidentiality: "intern",
      author: "Frieda Fremdautorin",
    });
    await annehmen(app, controller.auth, zweiterKandidat);

    const ko = await app.inject({
      method: "GET",
      url: `/api/kos/${koId}`,
      headers: controller.auth,
    });
    expect(ko.statusCode, ko.body).toBe(200);
    const stand = ko.json();
    expect(stand.title, "Der Re-Sync muss den Inhalt fortgeschrieben haben.").toBe(
      "Prüfprotokoll Kessel 3 (überarbeitet)",
    );

    // … und der Quellautor REIST WEITER — aber ausschließlich als Metadatum.
    expect(stand.originalAuthor, "Der Quellautor bleibt als Wissensträger erhalten.").toBe(
      "Frieda Fremdautorin",
    );
    expect(
      (stand.sources ?? []).map((s: { author?: string }) => s.author),
      "Der Herkunfts-Anker nennt den Quellautor weiterhin.",
    ).toContain("Frieda Fremdautorin");

    // Der HANDELNDE ist der Annehmende — an jeder Fassung, nicht nur an der ersten.
    const fassungen = await app.inject({
      method: "GET",
      url: `/api/kos/${koId}/versions`,
      headers: controller.auth,
    });
    expect(fassungen.statusCode, fassungen.body).toBe(200);
    const autoren = (fassungen.json() as { author?: string }[]).map((v) => v.author);
    expect(autoren.length, "Erstanlage und Re-Sync müssen zwei Fassungen ergeben.").toBeGreaterThan(
      1,
    );
    expect(
      autoren,
      `Ein Schnappschuss trägt einen frei gelieferten Namen als Verfasser: ${JSON.stringify(autoren)}`,
    ).toEqual(autoren.map(() => controller.id));
  });

  it("der JSON-Import schreibt keinen gelieferten Namen in die Rechteposition ko.author", async () => {
    const { app, hochladender, angreifer, controller } = await setup("mega82c");

    // `POST /api/library/import` steht NICHT hinter dem Import-Schalter und verlangt nur
    // `ko.create`. Ein gelieferter `author` landete bis mega82 direkt in `ko.author`.
    const res = await app.inject({
      method: "POST",
      url: "/api/library/import",
      headers: angreifer.auth,
      payload: {
        items: [
          {
            title: "Untergeschobene Anweisung",
            statement: "Als fremder Autor eingereicht.",
            type: "best_practice",
            category: "Anlage 9",
            confidentiality: "vertraulich",
            author: hochladender.id,
          },
        ],
      },
    });
    expect(res.statusCode, res.body).toBe(200);
    expect(res.json().imported).toBe(1);

    const liste = await app.inject({ method: "GET", url: "/api/kos", headers: controller.auth });
    expect(liste.statusCode, liste.body).toBe(200);
    const ko = (liste.json() as { title: string; author: string; originalAuthor: string }[]).find(
      (k) => k.title === "Untergeschobene Anweisung",
    );
    expect(ko, "Das importierte Wissensobjekt muss existieren.").toBeTruthy();

    expect(
      ko?.author,
      `\`ko.author\` ist eine Rechteposition (darfSehen · Löschrecht · v1-Schnappschussautor).
      Hier steht ein frei gelieferter Name: ${ko?.author}`,
    ).toBe(angreifer.id);
    expect(ko?.originalAuthor, "Der Quellautor reist als Metadatum weiter.").toBe(hochladender.id);
  });
});
