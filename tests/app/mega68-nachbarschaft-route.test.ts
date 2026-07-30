// ================================================================================================
// AUFTRAG-mega68 — DIE NACHBARSCHAFT EINES WISSENSOBJEKTS: BEGRENZT, BEGRÜNDET, RECHTE-DICHT.
// ================================================================================================
//
// Drei Zusicherungen tragen diese Datei:
//  1. BEGRENZT: die Auskunft geht von EINEM Objekt aus und ist gedeckelt — nie der ganze Bestand.
//  2. BEGRÜNDET: ein Schlagwort, das (fast) alle tragen (`pilot-demo`), erzeugt KEINE Kante; der
//     Ausschluss steht ehrlich in der Antwort (`excludedTags`), statt still zu verschwinden.
//  3. RECHTE-DICHT: ein vertraulicher Nachbar existiert für Rollen ohne `ko.validate` NICHT —
//     geprüft an der SERIALISIERTEN Antwort (kein Titel, keine Id, kein Zähler-Leck), nicht an
//     der Absicht. Das ist die SCRUM-506-Regel, die auch Export (library-routes) und Herkunft
//     (provenance-routes) führen.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { Confidentiality } from "../../services/knowledge-object";

type TestApp = ReturnType<typeof buildApp>;

async function appWithUsers(): Promise<{
  app: TestApp;
  services: Awaited<ReturnType<typeof buildServices>>;
  headersFor: (email: string) => Promise<Record<string, string>>;
}> {
  const services = await buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@x.de", password: "secret123" },
  });
  const headersFor = async (email: string): Promise<Record<string, string>> => {
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password: "secret123" },
    });
    return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
  };
  const adminHeaders = await headersFor("admin@x.de");
  for (const [name, email, role] of [
    ["Expertin", "expertin@x.de", "experte"],
    ["Controllerin", "controllerin@x.de", "controller"],
  ] as const) {
    await app.inject({
      method: "POST",
      url: "/api/users",
      headers: adminHeaders,
      payload: { name, email, password: "secret123", role },
    });
  }
  return { app, services, headersFor };
}

async function seedKo(
  services: Awaited<ReturnType<typeof buildServices>>,
  title: string,
  tags: string[],
  confidentiality: Confidentiality = "intern",
): Promise<string> {
  const ko = await services.ko.create({
    title,
    statement: `Aussage zu ${title}`,
    type: "best_practice",
    category: "Betrieb",
    author: "u1",
    tags,
    confidentiality,
  });
  return ko.id;
}

interface NeighborhoodBody {
  center: { id: string; title: string; status: string };
  neighbors: { id: string; title: string; status: string; via: string[] }[];
  total: number;
  truncated: boolean;
  excludedTags: string[];
}

describe("mega68 · GET /api/kos/:id/neighbors — die Tür", () => {
  it("ohne Anmeldung: keine Auskunft", async () => {
    const { app, services } = await appWithUsers();
    const id = await seedKo(services, "Ventil", ["ventil"]);
    const res = await app.inject({ method: "GET", url: `/api/kos/${id}/neighbors` });
    expect([401, 403]).toContain(res.statusCode);
    await app.close();
  });

  it("unbekanntes Objekt: 404, kein Bestands-Leck", async () => {
    const { app, headersFor } = await appWithUsers();
    const res = await app.inject({
      method: "GET",
      url: "/api/kos/gibt-es-nicht/neighbors",
      headers: await headersFor("expertin@x.de"),
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe("mega68 · Schlagwortregel — ein Allerwelts-Schlagwort ist keine Verwandtschaft", () => {
  it("pilot-demo (alle tragen es) erzeugt keine Kante; echte Schlagwörter schon", async () => {
    const { app, services, headersFor } = await appWithUsers();
    // Nachbau des Demobestands: JEDES Objekt trägt pilot-demo, nur manche teilen echte Tags.
    const filter = await seedKo(services, "Filter F3 prüfen", ["filter", "wartung", "pilot-demo"]);
    const pumpe = await seedKo(services, "Pumpe P2 schmieren", ["pumpe", "wartung", "pilot-demo"]);
    const band = await seedKo(services, "Förderband Sichtprüfung", ["wartung", "pilot-demo"]);
    // Objekte, die mit dem Zentrum NUR pilot-demo teilen — sie dürfen NICHT auftauchen.
    const fremde: string[] = [];
    for (let i = 0; i < 10; i++) {
      fremde.push(await seedKo(services, `Fremdes Objekt ${i}`, [`einzel-${i}`, "pilot-demo"]));
    }
    const res = await app.inject({
      method: "GET",
      url: `/api/kos/${filter}/neighbors`,
      headers: await headersFor("expertin@x.de"),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as NeighborhoodBody;
    expect(body.center.id).toBe(filter);
    // Genau die zwei echten Wartungs-Nachbarn — nicht der ganze Demobestand.
    expect(body.neighbors.map((n) => n.id).sort()).toEqual([pumpe, band].sort());
    // Die Kanten nennen das echte gemeinsame Schlagwort und NIE das ubiquitäre.
    for (const n of body.neighbors) {
      expect(n.via).toContain("wartung");
      expect(n.via).not.toContain("pilot-demo");
    }
    // Der Ausschluss ist EHRLICH ausgewiesen, nicht still.
    expect(body.excludedTags).toContain("pilot-demo");
    // Kein Fremdobjekt erscheint — auch nicht als Titel-Fragment irgendwo in der Antwort.
    for (const id of fremde) {
      expect(res.body).not.toContain(id);
    }
    expect(res.body).not.toContain("Fremdes Objekt");
    await app.close();
  });

  it("kleiner Bestand: die Anteilsschwelle feuert nicht auf Rauschen (absoluter Boden)", async () => {
    const { app, services, headersFor } = await appWithUsers();
    // Nur zwei Objekte, ein ehrlich geteiltes Schlagwort: 100% Anteil, aber KEIN Allerwelts-Tag —
    // unter dem absoluten Boden trägt die Statistik nichts, die Kante bleibt.
    const a = await seedKo(services, "Kaltstart mit Vorwärmung", ["kaltstart"]);
    const b = await seedKo(services, "Kaltstart ohne Vorwärmung", ["kaltstart"]);
    const res = await app.inject({
      method: "GET",
      url: `/api/kos/${a}/neighbors`,
      headers: await headersFor("expertin@x.de"),
    });
    const body = res.json() as NeighborhoodBody;
    expect(body.neighbors.map((n) => n.id)).toEqual([b]);
    expect(body.neighbors[0]?.via).toContain("kaltstart");
    expect(body.excludedTags).toEqual([]);
    await app.close();
  });
});

describe("mega68 · Deckel — die Antwort hängt am Objekt, nicht am Bestand", () => {
  it("mehr Nachbarn als der Deckel: gedeckelt, ehrlich beziffert", async () => {
    const { app, services, headersFor } = await appWithUsers();
    const center = await seedKo(services, "Zentrum", ["wartung"]);
    for (let i = 0; i < 20; i++) {
      await seedKo(services, `Nachbar ${String(i).padStart(2, "0")}`, ["wartung"]);
    }
    // Füllmasse ohne Bezug, damit „wartung" (21 von 45) unter der Anteilsschwelle bleibt.
    for (let i = 0; i < 24; i++) {
      await seedKo(services, `Unbeteiligt ${i}`, [`sonst-${i}`]);
    }
    const res = await app.inject({
      method: "GET",
      url: `/api/kos/${center}/neighbors`,
      headers: await headersFor("expertin@x.de"),
    });
    const body = res.json() as NeighborhoodBody;
    expect(body.neighbors.length).toBe(12);
    expect(body.total).toBe(20);
    expect(body.truncated).toBe(true);
    // Deterministisch: gleicher Aufruf → gleiche Auswahl in gleicher Reihenfolge.
    const again = await app.inject({
      method: "GET",
      url: `/api/kos/${center}/neighbors`,
      headers: await headersFor("expertin@x.de"),
    });
    expect((again.json() as NeighborhoodBody).neighbors).toEqual(body.neighbors);
    await app.close();
  });
});

describe("mega68 · Vertraulichkeit — ein unsichtbarer Nachbar existiert nicht", () => {
  it("ohne ko.validate: weder Titel noch Id noch Zähler-Spur des vertraulichen Nachbarn", async () => {
    const { app, services, headersFor } = await appWithUsers();
    const center = await seedKo(services, "Zentrum Wartungsplan", ["wartung"]);
    const offen = await seedKo(services, "Offener Nachbar", ["wartung"]);
    const geheimId = await seedKo(
      services,
      "Geheimer Lieferantenpreis",
      ["wartung"],
      "vertraulich",
    );
    const res = await app.inject({
      method: "GET",
      url: `/api/kos/${center}/neighbors`,
      headers: await headersFor("expertin@x.de"),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as NeighborhoodBody;
    expect(body.neighbors.map((n) => n.id)).toEqual([offen]);
    // Geprüft an der SERIALISIERTEN Antwort: nichts vom vertraulichen Objekt reist mit.
    expect(res.body).not.toContain(geheimId);
    expect(res.body).not.toContain("Geheimer Lieferantenpreis");
    // Auch der Zähler verrät ihn nicht: total zählt NACH dem Rechte-Filter.
    expect(body.total).toBe(1);
    expect(body.truncated).toBe(false);
    await app.close();
  });

  it("mit ko.validate (Kuratorin): der vertrauliche Nachbar ist sichtbar", async () => {
    const { app, services, headersFor } = await appWithUsers();
    const center = await seedKo(services, "Zentrum Wartungsplan", ["wartung"]);
    const geheim = await seedKo(services, "Geheimer Lieferantenpreis", ["wartung"], "vertraulich");
    const res = await app.inject({
      method: "GET",
      url: `/api/kos/${center}/neighbors`,
      headers: await headersFor("controllerin@x.de"),
    });
    const body = res.json() as NeighborhoodBody;
    expect(body.neighbors.map((n) => n.id)).toContain(geheim);
    await app.close();
  });

  // ==============================================================================================
  // AUFTRAG-mega71 BLOCK C (bens gelber Punkt 2, am Quelltext nachgeprüft): bis mega71 wurden
  // `carriers` und die Ubiquitätsrechnung aus ALLEN Suchprojektionen berechnet; erst danach fielen
  // vertrauliche Kandidaten aus `visible`. Ein VERBORGENES Objekt konnte so ein Zentrums-
  // Schlagwort über die Schwelle (UBIQUITY_MIN_COUNT=5, Anteil > 1/2) heben, damit einen
  // SICHTBAREN Nachbarn aus der Antwort entfernen und in `excludedTags` auftauchen lassen —
  // kein Inhalts-Abfluss, aber eine Verhaltensspur unsichtbaren Bestands. Seit mega71 wird für
  // Rollen ohne erweiterte Sichtbarkeit die GRUNDMENGE gefiltert (eine Stelle, vor der Statistik):
  // die Antwort der eingeschränkten Rolle rechnet, als gäbe es nur den sichtbaren Bestand.
  it("GRENZTEST mega71 C: vier sichtbare Träger + ein vertraulicher — der verborgene verschiebt weder excludedTags noch die Nachbarwahl", async () => {
    const { app, services, headersFor } = await appWithUsers();
    // Sichtbare Träger von „wartung": Zentrum + drei Nachbarn = 4 < UBIQUITY_MIN_COUNT(5).
    const center = await seedKo(services, "Zentrum Wartungsplan", ["wartung"]);
    const n1 = await seedKo(services, "Nachbar Eins", ["wartung"]);
    const n2 = await seedKo(services, "Nachbar Zwei", ["wartung"]);
    const n3 = await seedKo(services, "Nachbar Drei", ["wartung"]);
    // DER eine vertrauliche Träger: hebt die Zählung auf 5 und den Anteil (5/7) über die Hälfte —
    // aber nur, wenn er fälschlich mitgezählt wird.
    const geheimId = await seedKo(services, "Geheimer Wartungsvermerk", ["wartung"], "vertraulich");
    // Füllmasse, damit die ANTEILSschwelle allein am vertraulichen Objekt kippt (5/7 > 1/2,
    // 4/6 wäre zwar auch > 1/2, scheitert aber am absoluten Boden 5).
    await seedKo(services, "Unbeteiligt A", ["sonst-a"]);
    await seedKo(services, "Unbeteiligt B", ["sonst-b"]);

    const res = await app.inject({
      method: "GET",
      url: `/api/kos/${center}/neighbors`,
      headers: await headersFor("expertin@x.de"),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as NeighborhoodBody;
    // Für die eingeschränkte Rolle zählt nur der sichtbare Bestand: 4 Träger < absoluter Boden →
    // „wartung" ist KEIN Allerwelts-Schlagwort, die drei sichtbaren Nachbarn bleiben.
    expect(body.excludedTags).toEqual([]);
    expect(body.neighbors.map((n) => n.id).sort()).toEqual([n1, n2, n3].sort());
    expect(body.total).toBe(3);
    // Und wie immer: nichts vom vertraulichen Objekt reist mit.
    expect(res.body).not.toContain(geheimId);
    expect(res.body).not.toContain("Geheimer Wartungsvermerk");

    // KALIBRIERUNG: für die Kuratorin ZÄHLT das vertrauliche Objekt legitim — 5 Träger von 7,
    // Anteil über der Hälfte → „wartung" ist für SIE ubiquitär und ehrlich ausgewiesen. Ohne
    // diesen Kontrast wäre der Grenzfall auch mit einer nie feuernden Schwelle grün.
    const kuratorin = await app.inject({
      method: "GET",
      url: `/api/kos/${center}/neighbors`,
      headers: await headersFor("controllerin@x.de"),
    });
    const kuratorinBody = kuratorin.json() as NeighborhoodBody;
    expect(kuratorinBody.excludedTags).toEqual(["wartung"]);
    expect(kuratorinBody.neighbors).toEqual([]);
    await app.close();
  });

  it("streng_vertraulich ist ebenso unsichtbar wie vertraulich", async () => {
    const { app, services, headersFor } = await appWithUsers();
    const center = await seedKo(services, "Zentrum", ["wartung"]);
    await seedKo(services, "Streng geheimer Nachbar", ["wartung"], "streng_vertraulich");
    const res = await app.inject({
      method: "GET",
      url: `/api/kos/${center}/neighbors`,
      headers: await headersFor("expertin@x.de"),
    });
    const body = res.json() as NeighborhoodBody;
    expect(body.neighbors).toEqual([]);
    expect(res.body).not.toContain("Streng geheimer Nachbar");
    await app.close();
  });
});
