import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  InMemoryObjectRepo,
  OBJECT_RETENTION_DAYS,
  type ObjectRef,
  ObjectStore,
  isTransientMedia,
  isWithinRetention,
} from "../../services/object-store";

// ==============================================================================================
// AUFTRAG-mega20 Block C — DER OBJEKT-LEBENSZYKLUS. ERST DER DATENVERTRAG, DANN (GETRENNT) DER LAUF.
// ==============================================================================================
//
// DER BEFUND. Ein gespeichertes Objekt wusste nichts über sich selbst außer Name, Typ, Größe,
// Zeitpunkt und (optional) Vertraulichkeit. Damit war „unreferenziert" nicht von „gerade erst
// hochgeladen und noch nicht gebunden" zu unterscheiden — und genau dieser Unterschied entscheidet
// zwischen einer korrekten Aufräumung und einem Datenverlust. Dazu fehlten `list` und `delete` im
// Repo: der Store war append-only, ein versehentlich hochgeladenes Original nicht mehr entfernbar.
//
// WAS HIER BELEGT WIRD: die positive Lebenszyklus-Zuordnung am Objekt, die konservative
// Aufbewahrung (laufender Upload gilt NICHT als Waise), die Unterscheidbarkeit transienter Medien,
// die neuen Repo-Fähigkeiten.
//
// WAS HIER AUSDRÜCKLICH NICHT GEBAUT IST: der Waisen-Sweep. Erst der Datenvertrag, dann getrennt
// der Lauf. Bis dahin sind Speicherreste der sichere Preis.
//
// R-1349: Der dritte Block dieser Datei prüfte die modulübergreifende Referenzprüfung
// `object-references.ts`. Kein Produktweg hat sie je gerufen; der getrennte Lauf kam mit R-0846 als
// `datenintegritaet.ts::ermittleWaisen` (eine Obermenge derselben Fundorte, im Betrieb über
// `tools/datenintegritaet.ts`). Die Referenzprüfung und ihr Block sind deshalb entfernt.

const PDF_DATA_URL = `data:application/pdf;base64,${Buffer.from("%PDF-1.4 Pruefbericht").toString("base64")}`;
const PNG_DATA_URL = `data:image/png;base64,${Buffer.from("PNG").toString("base64")}`;

type App = ReturnType<typeof buildApp>;

async function login(app: App, email: string, password: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  return { authorization: `Bearer ${res.json().token}` };
}

async function setup() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const headers = await login(app, "a@x.de", "secret123");
  return { app, headers, services };
}

async function hochladen(
  app: App,
  headers: Record<string, string>,
  payload: Record<string, unknown>,
) {
  const res = await app.inject({ method: "POST", url: "/api/objects", headers, payload });
  expect(res.statusCode).toBe(201);
  return res.json() as ObjectRef;
}

// ----------------------------------------------------------------------------------------------
// 1. DER DATENVERTRAG AM OBJEKT.
// ----------------------------------------------------------------------------------------------
describe("mega20 C: die Lebenszyklus-Zuordnung entsteht mit dem Objekt", () => {
  it("ein Upload trägt Zweck, Eigentümer und Schutzfrist — im selben Schreibvorgang", async () => {
    const { app, headers } = await setup();
    const ref = await hochladen(app, headers, {
      name: "Pruefbericht.pdf",
      mime: "application/pdf",
      data: PDF_DATA_URL,
      purpose: "anchor",
    });
    expect(ref.lifecycle?.purpose).toBe("anchor");
    // Der Eigentümer kommt aus der ANMELDUNG, nicht aus dem Body.
    expect(typeof ref.lifecycle?.owner).toBe("string");
    expect(ref.lifecycle?.owner).not.toBe("");
    expect(typeof ref.lifecycle?.retainUntil).toBe("string");
  });

  it("ein untergeschobener Eigentümer wird NICHT übernommen", async () => {
    const { app, headers } = await setup();
    const ref = await hochladen(app, headers, {
      name: "P.pdf",
      mime: "application/pdf",
      data: PDF_DATA_URL,
      purpose: "anchor",
      owner: "jemand-anders",
    });
    expect(ref.lifecycle?.owner).not.toBe("jemand-anders");
  });

  it("ein UNBEKANNTER Zweck wird zu `unknown` — der konservativsten Einstufung, nicht der gemeinten", async () => {
    const { app, headers } = await setup();
    const ref = await hochladen(app, headers, {
      name: "P.pdf",
      mime: "application/pdf",
      data: PDF_DATA_URL,
      purpose: "loesch-mich-bitte-sofort",
    });
    expect(ref.lifecycle?.purpose).toBe("unknown");
  });

  it("ohne Angabe steht ausdrücklich `unknown` am Objekt — nicht gar nichts", async () => {
    const { app, headers } = await setup();
    const ref = await hochladen(app, headers, {
      name: "P.pdf",
      mime: "application/pdf",
      data: PDF_DATA_URL,
    });
    expect(ref.lifecycle?.purpose).toBe("unknown");
  });

  it("ein TRANSIENTES Medium ist unterscheidbar — von einem Anker UND von einem Anhang", async () => {
    const { app, headers } = await setup();
    const medium = await hochladen(app, headers, {
      name: "aufnahme.mp3",
      mime: "audio/mpeg",
      data: PNG_DATA_URL,
      purpose: "media",
    });
    const anker = await hochladen(app, headers, {
      name: "P.pdf",
      mime: "application/pdf",
      data: PDF_DATA_URL,
      purpose: "anchor",
    });
    const anhang = await hochladen(app, headers, {
      name: "bild.png",
      mime: "image/png",
      data: PNG_DATA_URL,
      purpose: "attachment",
    });
    // Die Unterscheidung ist der Punkt: ALLE DREI sind unreferenziert. Nur eines war je dafür
    // gedacht, referenziert zu werden. Ohne diesen Marker müsste ein Lauf entweder alle Medien
    // behalten (dann räumt er nichts auf) oder alle unreferenzierten löschen (dann trifft er Anker).
    expect(isTransientMedia(medium)).toBe(true);
    expect(isTransientMedia(anker)).toBe(false);
    expect(isTransientMedia(anhang)).toBe(false);
  });
});

// ----------------------------------------------------------------------------------------------
// 2. DIE KONSERVATIVE AUFBEWAHRUNG — laufender Upload gilt nicht als Waise.
// ----------------------------------------------------------------------------------------------
describe("mega20 C: die Schutzfrist deckt das Fenster zwischen Upload und erster Referenz", () => {
  const jetzt = Date.parse("2026-07-26T10:00:00.000Z");
  const store = (): { store: ObjectStore; repo: InMemoryObjectRepo } => {
    const repo = new InMemoryObjectRepo();
    return { repo, store: new ObjectStore({ repo, now: () => jetzt }) };
  };

  it("ein GERADE hochgeladenes, noch unreferenziertes Objekt ist KEINE Waise", async () => {
    const { store: s } = store();
    const ref = await s.put({
      name: "P.pdf",
      mime: "application/pdf",
      data: PDF_DATA_URL,
      purpose: "anchor",
    });
    // Der reale Fall: der Nutzer hat übernommen, tippt noch, der Entwurf ist noch nicht gespeichert.
    expect(isWithinRetention(ref, jetzt)).toBe(true);
    expect(isWithinRetention(ref, jetzt + 29 * 24 * 60 * 60 * 1000)).toBe(true);
  });

  it("nach Ablauf der Frist ist es NICHT mehr geschützt — die Frist ist echt, nicht dekorativ", async () => {
    const { store: s } = store();
    const ref = await s.put({ name: "P.pdf", mime: "application/pdf", data: PDF_DATA_URL });
    expect(isWithinRetention(ref, jetzt + (OBJECT_RETENTION_DAYS + 1) * 24 * 60 * 60 * 1000)).toBe(
      false,
    );
  });

  it("ALTBESTAND ohne Zuordnung gilt IMMER als geschützt — die unbequeme Richtung", () => {
    // Über ein Objekt ohne Zuordnung weiß niemand, wozu es da ist. Ein Lauf, der darüber
    // hinweggeht, träfe zuerst die ältesten und damit am schwersten ersetzbaren Originale.
    const alt = {
      id: "alt-1",
      name: "alt.pdf",
      mime: "application/pdf",
      size: 10,
      kind: "document" as const,
      createdAt: "2020-01-01T00:00:00.000Z",
    };
    expect(isWithinRetention(alt, jetzt)).toBe(true);
    // Und eine UNLESBARE Frist ebenso: nie fail-open bei einer Löschentscheidung.
    expect(
      isWithinRetention(
        { ...alt, lifecycle: { purpose: "unknown", retainUntil: "kaputt" } },
        jetzt,
      ),
    ).toBe(true);
  });

  it("`list` liefert NUR Metadaten, `delete` sagt ehrlich, ob es etwas zu löschen gab", async () => {
    const { store: s } = store();
    const ref = await s.put({ name: "P.pdf", mime: "application/pdf", data: PDF_DATA_URL });
    const liste = await s.list();
    expect(liste).toHaveLength(1);
    // Keine Bytes in der Liste — ein Lauf über den Bestand darf nicht alle Originale laden.
    expect(JSON.stringify(liste)).not.toContain(PDF_DATA_URL);
    expect(await s.delete(ref.id)).toBe(true);
    expect(await s.delete(ref.id)).toBe(false); // schon weg ist kein Fehler
    expect(await s.list()).toHaveLength(0);
    expect(await s.read(ref.id)).toBeUndefined();
  });
});
