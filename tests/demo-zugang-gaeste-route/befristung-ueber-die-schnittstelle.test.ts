// ================================================================================================
// JOB 3755 T2 — DER SCHREIBWEG ZUR BEFRISTUNG, ÜBER HTTP GEMESSEN
// ================================================================================================
//
// JOB 3665 hat die Befristung gebaut: das Konto trägt ein Ablaufdatum (`types.ts:51`), der Dienst
// kann es setzen und nehmen (`service.ts:401`), und nach Ablauf kommt niemand mehr herein. Es fehlte
// genau der Weg von außen: `services/auth/src/routes.ts` kannte am Basisstand `03272da` im Body von
// `PUT /api/users/:id` nur `role`, `approve`, `password` — die Zusage „sein Zugang läuft ab" war im
// Produkt vorhanden und für jeden Verwaltungsclient unerreichbar.
//
// WAS DIESE DATEI MISST UND WAS NICHT. Gemessen wird der HTTP-Weg am echten Fastify-Draht
// (`app.inject`, Vorbild `tests/q9-serverfehlertexte/server.test.ts:14-21`) — Recht, Wirkung,
// Antwortstand und Prüfprotokoll. NICHT gemessen wird eine Oberfläche: `apps/web/**` ist kein
// Zielpfad dieses Auftrags, der Admin-Knopf gehört anderen Jobs. Ein Mensch sieht die Wirkung also
// über die Nutzerliste und über die Anmeldung, nicht über eine Fläche.
//
// KEIN ZWEITER AUFBAU. Uhr, Ablagen und Prüfprotokoll kommen aus `tests/demo-zugang-gaeste/aufbau`
// — derselbe Kreis, den die Dienst-Fälle fahren. Läge hier ein eigener, könnten zwei Aussagen über
// dasselbe Verhalten gegen verschiedene Uhren messen und wären nicht mehr vergleichbar. Neu ist
// ausschließlich die HTTP-Schicht darüber.
//
// DIE ZWEI AUSSAGEN, DIE AUSEINANDERGEHALTEN WERDEN MÜSSEN (R2 gegen R3): `null` heißt „nimm die
// Befristung", ein FEHLENDES Feld heißt „ich sage dazu nichts". Behandelte die Route beides gleich,
// löschte jeder Rollenwechsel still die Befristung eines Gastkontos — der Ablauf wäre weg, und
// niemand sähe, wann er verschwunden ist.
import Fastify, { type FastifyInstance, type LightMyRequestResponse } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { MELDUNGEN } from "../../services/auth/src/meldungen";
import { authRoutes } from "../../services/auth/src/routes";
import type { PublicUser } from "../../services/auth/src/types";
import {
  GAST_PASSWORT,
  type Kreis,
  STUNDE,
  adminUndGast,
  baueKreis,
} from "../demo-zugang-gaeste/aufbau";

interface Draht {
  k: Kreis;
  app: FastifyInstance;
}

const offen: FastifyInstance[] = [];

afterEach(async () => {
  for (const app of offen.splice(0)) {
    await app.close();
  }
});

async function baueDraht(): Promise<Draht> {
  const k = baueKreis();
  const app = Fastify();
  await app.register(authRoutes(k.service));
  await app.ready();
  offen.push(app);
  return { k, app };
}

function anmelden(app: FastifyInstance, email: string): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: GAST_PASSWORT },
  });
}

/** Die Anmeldung, die gelingen MUSS — sonst misst der Fall darunter nichts. */
async function token(app: FastifyInstance, email: string): Promise<string> {
  const antwort = await anmelden(app, email);
  if (antwort.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${antwort.statusCode} ${antwort.body}`);
  }
  return antwort.json().token as string;
}

function verwalte(
  app: FastifyInstance,
  sitzung: string,
  id: string,
  body: Record<string, unknown>,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "PUT",
    url: `/api/users/${id}`,
    headers: { authorization: `Bearer ${sitzung}` },
    payload: body,
  });
}

/** Der Stand, den ein Mensch in der Nutzerliste sieht — nicht der aus der Antwort von eben. */
async function ausDerListe(
  app: FastifyInstance,
  sitzung: string,
  id: string,
): Promise<PublicUser | undefined> {
  const antwort = await app.inject({
    method: "GET",
    url: "/api/users",
    headers: { authorization: `Bearer ${sitzung}` },
  });
  expect(antwort.statusCode, `GET /api/users: ${antwort.body}`).toBe(200);
  return (antwort.json() as PublicUser[]).find((u) => u.id === id);
}

function ich(app: FastifyInstance, sitzung: string): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "GET",
    url: "/api/auth/me",
    headers: { authorization: `Bearer ${sitzung}` },
  });
}

describe("JOB 3755 · der Admin setzt die Befristung über die Schnittstelle", () => {
  it("R1 — setzen: die Antwort trägt den Wert, und die Nutzerliste zeigt ihn", async () => {
    const { k, app } = await baueDraht();
    const { gast } = await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");
    const ablauf = new Date(k.jetzt() + STUNDE).toISOString();

    const antwort = await verwalte(app, sitzung, gast.id, { accessExpiresAt: ablauf });

    expect(antwort.statusCode, antwort.body).toBe(200);
    // Die 200er-Antwort ist der FRISCH geschriebene Stand. Käme sie aus dem Stand vor dem Setzen,
    // meldete die Oberfläche „gespeichert" und zeigte dabei den alten Wert.
    expect(antwort.json().accessExpiresAt).toBe(ablauf);
    expect((await ausDerListe(app, sitzung, gast.id))?.accessExpiresAt).toBe(ablauf);
  });

  it("R1b — Rolle und Befristung in EINEM Aufruf: die Antwort trägt beides", async () => {
    // Die Befristung wird NACH `approve`/`role` verarbeitet, und die Antwort entsteht danach. Würde
    // sie aus dem Ergebnis von `changeRole` gebildet, fehlte ihr genau die Befristung, die der
    // Aufruf gerade gesetzt hat.
    const { k, app } = await baueDraht();
    const { gast } = await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");
    const ablauf = new Date(k.jetzt() + STUNDE).toISOString();

    const antwort = await verwalte(app, sitzung, gast.id, {
      role: "controller",
      accessExpiresAt: ablauf,
    });

    expect(antwort.statusCode, antwort.body).toBe(200);
    expect(antwort.json().role).toBe("controller");
    expect(antwort.json().accessExpiresAt).toBe(ablauf);
    const gelistet = await ausDerListe(app, sitzung, gast.id);
    expect(gelistet?.role).toBe("controller");
    expect(gelistet?.accessExpiresAt).toBe(ablauf);
  });

  it("R2 — nehmen: mit `null` ist die Befristung fort, und der Gast meldet sich wieder an", async () => {
    const { k, app } = await baueDraht();
    const { gast } = await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");

    const gesetzt = await verwalte(app, sitzung, gast.id, {
      accessExpiresAt: new Date(k.jetzt() - STUNDE).toISOString(),
    });
    expect(gesetzt.statusCode, gesetzt.body).toBe(200);
    // Die Voraussetzung des Falls, gemessen und nicht behauptet: der Gast ist wirklich draußen.
    const draussen = await anmelden(app, "gast@x.de");
    expect(draussen.statusCode).toBe(403);
    expect(draussen.json().error).toBe("NOT_APPROVED");

    const genommen = await verwalte(app, sitzung, gast.id, { accessExpiresAt: null });

    expect(genommen.statusCode, genommen.body).toBe(200);
    // Kein `null` und kein leerer String in der Antwort: „nie befristet" ist ein Zustand des
    // Kontos, kein Wert an ihm (dieselbe Zusage wie C2 auf der Dienstebene).
    expect(Object.hasOwn(genommen.json(), "accessExpiresAt")).toBe(false);
    expect((await ausDerListe(app, sitzung, gast.id))?.accessExpiresAt).toBeUndefined();
    // DER VERHALTENSBELEG, und er ist der eigentliche Punkt: nicht „das Feld ist leer", sondern
    // „der Mensch kommt wieder herein".
    const wieder = await anmelden(app, "gast@x.de");
    expect(wieder.statusCode, wieder.body).toBe(200);
    expect(wieder.json().token).toBeTruthy();
  });

  it("R3 — ein Aufruf mit nur `role` lässt die bestehende Befristung unberührt", async () => {
    // DIE NAHELIEGENDE HALBHEIT: `undefined` und `null` gleich zu behandeln. Dann löschte jeder
    // Rollenwechsel still die Befristung — ein Gastzugang würde unbefristet, ohne dass es jemand
    // beschlossen hätte.
    const { k, app } = await baueDraht();
    const { gast } = await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");
    const ablauf = new Date(k.jetzt() + STUNDE).toISOString();
    expect((await verwalte(app, sitzung, gast.id, { accessExpiresAt: ablauf })).statusCode).toBe(
      200,
    );

    const antwort = await verwalte(app, sitzung, gast.id, { role: "controller" });

    expect(antwort.statusCode, antwort.body).toBe(200);
    expect(antwort.json().role).toBe("controller");
    expect(antwort.json().accessExpiresAt).toBe(ablauf);
    expect((await ausDerListe(app, sitzung, gast.id))?.accessExpiresAt).toBe(ablauf);
    // Und es gibt keinen zweiten Setzvorgang: ein schweigender Aufruf schreibt nichts.
    expect((await k.audit.list({ action: "user.access-expiry-set", target: gast.id })).length).toBe(
      1,
    );
  });

  it("R4 — ein Nicht-Admin kommt diesen Weg nicht: 403, und das Konto bleibt unverändert", async () => {
    const { k, app } = await baueDraht();
    const { gast } = await adminUndGast(k);
    const adminSitzung = await token(app, "admin@x.de");
    const gastSitzung = await token(app, "gast@x.de");

    const antwort = await verwalte(app, gastSitzung, gast.id, {
      accessExpiresAt: new Date(k.jetzt() + STUNDE).toISOString(),
    });

    expect(antwort.statusCode, antwort.body).toBe(403);
    expect(antwort.json().error).toBe("FORBIDDEN");
    expect(antwort.json().message).toBe(MELDUNGEN.ADMIN_REQUIRED.de);
    expect((await ausDerListe(app, adminSitzung, gast.id))?.accessExpiresAt).toBeUndefined();
    expect(await k.audit.list({ action: "user.access-expiry-set", target: gast.id })).toEqual([]);
  });

  it("R5 — der letzte unbefristete Admin: 403 LAST_ADMIN_DEMOTION, nichts geschrieben", async () => {
    // Kein zweiter Aussperrschutz an der Route: der Wurf kommt aus dem Dienst und wird über
    // `sendError` zur 403 mit dem vorhandenen Satz. Eine Regel, zweimal formuliert, liefe
    // auseinander.
    const { k, app } = await baueDraht();
    const { admin } = await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");

    const antwort = await verwalte(app, sitzung, admin.id, {
      accessExpiresAt: new Date(k.jetzt() + STUNDE).toISOString(),
    });

    expect(antwort.statusCode, antwort.body).toBe(403);
    expect(antwort.json().error).toBe("FORBIDDEN");
    expect(antwort.json().message).toBe(MELDUNGEN.LAST_ADMIN_DEMOTION.de);
    expect((await ausDerListe(app, sitzung, admin.id))?.accessExpiresAt).toBeUndefined();
    expect(await k.audit.list({ action: "user.access-expiry-set", target: admin.id })).toEqual([]);
    // Und die Instanz ist nicht verwaist: der Admin kommt weiterhin herein.
    expect((await anmelden(app, "admin@x.de")).statusCode).toBe(200);
  });

  it("R6 — Ende zu Ende: ein Datum in der Vergangenheit sperrt Anmeldung UND laufende Sitzung", async () => {
    const { k, app } = await baueDraht();
    const { gast } = await adminUndGast(k);
    const adminSitzung = await token(app, "admin@x.de");
    const gastSitzung = await token(app, "gast@x.de");
    expect(
      (await ich(app, gastSitzung)).statusCode,
      "die Gastsitzung trug von Anfang an nicht",
    ).toBe(200);

    const gesetzt = await verwalte(app, adminSitzung, gast.id, {
      accessExpiresAt: new Date(k.jetzt() - STUNDE).toISOString(),
    });
    expect(gesetzt.statusCode, gesetzt.body).toBe(200);

    // DIE REIHENFOLGE IST DIE AUSSAGE (BEN, Runde 1, Prüflücke 6): die laufende Sitzung wird ZUERST
    // befragt, VOR jedem neuen Anmeldeversuch. Stünde der Anmeldeversuch davor, hätte SCHON ER die
    // Sitzungen des Kontos gelöscht (`service.ts:zugangAbgelaufen`) — die 401 belegte dann den
    // Login, nicht die Prüfung in `authenticate`, und über die eigentliche Zusage („eine Sitzung
    // lebt 14 Tage und trägt trotzdem nicht weiter") wäre nichts gesagt.
    expect((await ich(app, gastSitzung)).statusCode).toBe(401);

    const anmeldung = await anmelden(app, "gast@x.de");
    expect(anmeldung.statusCode).toBe(403);
    expect(anmeldung.json().error).toBe("NOT_APPROVED");
  });

  it("R7 — ein unlesbares Datum wird nicht geschrieben: 403, und die Liste bleibt leer", async () => {
    // Es gibt KEINEN eigenen Meldungstext für diesen Fall, und es wird auch keiner erfunden: der
    // Katalog (`services/auth/src/meldungen.ts`) gehört in diesem Takt JOB 3756. Der Mensch liest
    // deshalb „Unerwarteter Fehler." — für eine Eingabe, die eine Oberfläche nie erzeugen dürfte,
    // ist das ehrlich, aber es bleibt ein offener Punkt.
    const { k, app } = await baueDraht();
    const { gast } = await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");

    const antwort = await verwalte(app, sitzung, gast.id, { accessExpiresAt: "morgen" });

    expect(antwort.statusCode, antwort.body).toBe(403);
    expect(antwort.json().error).toBe("FORBIDDEN");
    expect(antwort.json().message).toBe(MELDUNGEN.INTERNAL.de);
    expect((await ausDerListe(app, sitzung, gast.id))?.accessExpiresAt).toBeUndefined();
    expect(await k.audit.list({ action: "user.access-expiry-set", target: gast.id })).toEqual([]);
  });

  // ==============================================================================================
  // R9 · DER BEFUND AUS RUNDE 1 (BEN): EINE TYPANGABE IST KEINE PRÜFUNG.
  // ==============================================================================================
  //
  // `Body: { accessExpiresAt?: string | null }` ist eine Behauptung über fremde Eingabe, und der
  // Typprüfer sieht von einem HTTP-Rumpf nichts. Gemessen wurde in Runde 1 (BEN, eigene HTTP-Probe):
  //
  //   · `{"accessExpiresAt": ["2026-09-11T13:00:00.000Z"]}` → HTTP 200, und in der Nutzerliste stand
  //     danach ein ARRAY als Ablaufdatum. Der Grund: `ISO_ZEITSTEMPEL.exec(wert)` wandelt sein
  //     Argument still in eine Zeichenkette um, und ein einelementiges Array wird dabei zu genau
  //     seinem Inhalt. Das Konto trug einen Wert, den `types.ts:51` (`accessExpiresAt?: string`)
  //     ausschließt — ein kaputter Bestand, den kein Leseweg mehr sauber deuten kann.
  //   · `{"accessExpiresAt": {"toString": "kein Datum"}}` → HTTP 500. Die Umwandlung wirft
  //     (`toString` ist keine Funktion, `valueOf` liefert kein Primitiv), der Wurf ist kein
  //     `AuthError`, und `sendError` fällt auf „Unerwarteter Fehler." mit Status 500 zurück.
  //
  // WO DIE GRENZE LIEGT UND WARUM SIE HIER GEZOGEN WIRD, nicht im Dienst: Die Route ist die Stelle,
  // an der fremdes JSON auf eine typisierte Fläche trifft — sie prüft die FORM des Wertes (String,
  // `null`, nichts). Ob eine Zeichenkette ein LESBARES Ablaufdatum ist, entscheidet weiterhin
  // allein der Dienst (`service.ts:ablaufZeitpunkt`), und der Aussperrschutz ebenso. Zwei Fragen,
  // zwei Stellen, keine doppelte Auslegung.
  //
  // KEIN NEUER FEHLERVERTRAG: dieselbe 403 mit „Unerwarteter Fehler.", die ein unlesbares Datum
  // schon heute bekommt (R7). Ein eigener Satz für „falscher Typ" wäre ein neuer Katalogschlüssel,
  // und `meldungen.ts` gehört in diesem Takt JOB 3756.
  const FREMDE_TYPEN: { name: string; wert: unknown }[] = [
    // BENs erstes Gegenbeispiel: sieht nach der Umwandlung wie ein gültiger Zeitstempel aus.
    { name: "Array mit gültigem ISO-String", wert: ["2026-09-11T13:00:00.000Z"] },
    // BENs zweites: die Umwandlung wirft, und der Wurf war bis hierher kein AuthError (500).
    { name: "Objekt mit eigener, nicht aufrufbarer toString", wert: { toString: "kein Datum" } },
    { name: "Zahl", wert: 1789200000000 },
    { name: "Boolean", wert: true },
    { name: "leeres Array", wert: [] },
    { name: "Objekt mit Feld", wert: { accessExpiresAt: "2026-09-11T13:00:00.000Z" } },
    { name: "verschachteltes Array", wert: [["2026-09-11T13:00:00.000Z"]] },
  ];

  for (const { name, wert } of FREMDE_TYPEN) {
    it(`R9 — ${name}: 403, nichts geschrieben, kein Vermerk`, async () => {
      const { k, app } = await baueDraht();
      const { gast } = await adminUndGast(k);
      const sitzung = await token(app, "admin@x.de");

      const antwort = await verwalte(app, sitzung, gast.id, { accessExpiresAt: wert });

      expect(antwort.statusCode, antwort.body).toBe(403);
      expect(antwort.json().error).toBe("FORBIDDEN");
      expect(antwort.json().message).toBe(MELDUNGEN.INTERNAL.de);
      // Nicht nur „kein gültiger Wert", sondern GAR KEIN Wert: ein Feld, das `types.ts:51` nicht
      // kennt, darf nicht einmal als kaputter Bestand entstehen.
      const gelistet = await ausDerListe(app, sitzung, gast.id);
      expect(gelistet?.accessExpiresAt).toBeUndefined();
      expect(Object.hasOwn(gelistet ?? {}, "accessExpiresAt")).toBe(false);
      expect(await k.audit.list({ action: "user.access-expiry-set", target: gast.id })).toEqual([]);
    });
  }

  it("R9b — der fremde Typ wird VOR jedem Schreiben abgewiesen: auch Rolle und Freigabe bleiben", async () => {
    // Die Prüfung steht vor `approve`/`role`/`password` und nicht dazwischen. Läge sie danach,
    // wäre ein Aufruf zur Hälfte ausgeführt: die Rolle geändert, die Befristung abgelehnt — und
    // der Admin sähe einen Fehler, obwohl sein Aufruf etwas verändert hat.
    const { k, app } = await baueDraht();
    const { gast } = await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");
    const vorher = await ausDerListe(app, sitzung, gast.id);
    expect(vorher?.role).toBe("experte");

    const antwort = await verwalte(app, sitzung, gast.id, {
      role: "controller",
      approve: true,
      accessExpiresAt: ["2026-09-11T13:00:00.000Z"],
    });

    expect(antwort.statusCode, antwort.body).toBe(403);
    const nachher = await ausDerListe(app, sitzung, gast.id);
    expect(nachher?.role, "die Rolle wurde trotz abgewiesener Befristung geändert").toBe("experte");
    expect(nachher?.accessExpiresAt).toBeUndefined();
    expect(await k.audit.list({ action: "user.role-change", target: gast.id })).toEqual([]);
    expect(await k.audit.list({ action: "user.access-expiry-set", target: gast.id })).toEqual([]);
  });

  it("R9c — KALIBRIERUNG: `null` und ein String bleiben zulässig, die Prüfung sperrt nicht alles", async () => {
    // Ohne diesen Fall wäre R9 auch von einer Route erfüllt, die JEDE Befristung abweist — und die
    // Lieferung dieses Auftrags wäre dabei still verschwunden.
    const { k, app } = await baueDraht();
    const { gast } = await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");
    const ablauf = new Date(k.jetzt() + STUNDE).toISOString();

    expect((await verwalte(app, sitzung, gast.id, { accessExpiresAt: ablauf })).statusCode).toBe(
      200,
    );
    expect((await ausDerListe(app, sitzung, gast.id))?.accessExpiresAt).toBe(ablauf);
    expect((await verwalte(app, sitzung, gast.id, { accessExpiresAt: null })).statusCode).toBe(200);
    expect((await ausDerListe(app, sitzung, gast.id))?.accessExpiresAt).toBeUndefined();
  });

  it("R8 — das Prüfprotokoll trägt nach dem HTTP-Aufruf genau einen Vorgang, mit dem Admin", async () => {
    const { k, app } = await baueDraht();
    const { admin, gast } = await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");
    const ablauf = new Date(k.jetzt() + STUNDE).toISOString();

    expect((await verwalte(app, sitzung, gast.id, { accessExpiresAt: ablauf })).statusCode).toBe(
      200,
    );

    const eintraege = await k.audit.list({ action: "user.access-expiry-set", target: gast.id });
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0]?.actor).toBe(admin.id);
    expect(eintraege[0]?.payload).toMatchObject({ expiresAt: ablauf });
  });
});
