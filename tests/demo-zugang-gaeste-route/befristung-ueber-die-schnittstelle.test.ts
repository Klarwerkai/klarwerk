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
//
// JOB 3780: DIE VERDRAHTUNG IST UMGEZOGEN, DIE FÄLLE SIND UNVERÄNDERT. `baueDraht`, `anmelden`,
// `token`, `verwalte`, `ausDerListe` und `ich` standen bis hierher in dieser Datei; seit die
// Formprüfung von `role`/`approve`/`password` (`eingabeform-am-aenderungsweg.test.ts`) denselben
// Endpunkt misst, stehen sie in `./draht` — eine zweite Abschrift wäre ein zweiter Fastify-Aufbau
// über demselben Endpunkt. Der Aufräum-Haken wird weiterhin HIER registriert (siehe `draht.ts`).
import { afterEach, describe, expect, it } from "vitest";
import { MELDUNGEN } from "../../services/auth/src/meldungen";
import { STUNDE, adminUndGast } from "../demo-zugang-gaeste/aufbau";
import {
  anmelden,
  ausDerListe,
  baueDraht,
  ich,
  schliesseOffeneDraehte,
  token,
  verwalte,
} from "./draht";

afterEach(schliesseOffeneDraehte);

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

  it("R7 — ein unlesbares Datum wird nicht geschrieben: 400 mit eigenem Satz", async () => {
    // NACHGEZOGEN IN JOB 4011, nicht ergänzt. Bis dahin stand hier `403`/`INTERNAL` samt der
    // Begründung „ein eigener Satz wäre ein neuer Katalogschlüssel, und `meldungen.ts` gehört in
    // diesem Takt JOB 3756" — der offene Punkt, den `service.ts:402-406` selbst als eigenen
    // Auftrag notiert hatte. Er ist erledigt: `ACCESS_EXPIRY_UNREADABLE` nennt die Form des
    // Zeitpunkts, und ein Tippfehler bekommt die 400, die jede menschliche Eingabe bekommt.
    //
    // DIE WIRKUNG BLEIBT UNVERÄNDERT und wird weiter gemessen: nichts geschrieben, kein Vermerk.
    // Geändert hat sich, was der Mensch liest, nicht was das Produkt tut.
    const { k, app } = await baueDraht();
    const { gast } = await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");

    const antwort = await verwalte(app, sitzung, gast.id, { accessExpiresAt: "morgen" });

    expect(antwort.statusCode, antwort.body).toBe(400);
    expect(antwort.json().error).toBe("BAD_REQUEST");
    expect(antwort.json().message).toBe(MELDUNGEN.ACCESS_EXPIRY_UNREADABLE.de);
    expect(antwort.json().message).not.toBe(MELDUNGEN.INTERNAL.de);
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
  // DER FEHLERVERTRAG DES FREMDEN TYPS BLEIBT, WO ER IST — und seit JOB 4011 ist er NICHT mehr
  // derselbe wie der eines unlesbaren Datums. Bis dahin stand hier „dieselbe 403 mit ‚Unerwarteter
  // Fehler.', die ein unlesbares Datum schon heute bekommt (R7)"; dieser Satz ist berichtigt, nicht
  // ergänzt, denn R7 antwortet jetzt 400 `BAD_REQUEST` mit `ACCESS_EXPIRY_UNREADABLE`.
  //
  // DIE GRENZE LÄUFT ZWISCHEN „getippt" UND „so kann kein Formular aussehen": `"morgen"` ist ein
  // Tippfehler und bekommt einen Satz, der sagt, was fehlt. Ein Array, eine Zahl oder ein Objekt
  // kann keine Oberfläche erzeugen — dort ist „Unerwarteter Fehler." die ehrliche Auskunft, denn
  // etwas anderes als ein Fehler im Aufrufer ist es nicht. Ein gemeinsamer Satz für beide hiesse,
  // einem Menschen eine Eingabeform zu erklären, die er gar nicht getippt hat.
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
