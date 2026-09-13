// ================================================================================================
// JOB 3780 — DERSELBE WERT, DIESELBE ANTWORT: DIE FORMPRÜFUNG AM ÄNDERUNGSWEG
// ================================================================================================
//
// DER BEFUND, DEN DIESE DATEI EINHOLT, stammt aus JOB 3755 Runde 2 (Abschnitt REST (c)): „`role`,
// `approve` und `password` an diesem Endpunkt haben weiterhin keine Laufzeitprüfung — eine
// unbekannte Rolle liefe still durch, wo `POST /api/users` sie mit 400 `UNKNOWN_ROLE` abweist."
//
// ZWEI WEGE, EINE EINGABE, ZWEI ANTWORTEN — das war der Zustand:
//   · `POST /api/users`     prüft jedes Feld zur Laufzeit (routes.ts:641-664) und weist `"chef"`
//                           mit 400 „Unbekannte Rolle." ab.
//   · `PUT /api/users/:id`  deklarierte `Body: { role?: Role; approve?: boolean; password?: string }`
//                           — eine BEHAUPTUNG über fremde Eingabe, keine Prüfung (derselbe Satz,
//                           den BEN in JOB 3755 für `accessExpiresAt` aufgeschrieben hat) — und
//                           schrieb `"chef"` ins Konto. `types.ts:1` kennt diesen Wert nicht.
//
// AM UNVERÄNDERTEN STAND `be5c09b` SELBST GEMESSEN (nicht aus einem Auftrag übernommen):
//   {"role":"chef"}                → 200, und die Nutzerliste zeigt danach `role: "chef"`
//   {"role":""}                    → 204, Rolle unverändert (still verschluckt)
//   {"role":123} / {"role":["admin"]} / {"role":null} → 200 bzw. 204, Wert im Konto
//   {"password":12345678}          → 500 („Unerwarteter Fehler.") — pbkdf2 wirft, der Wurf ist
//                                    kein AuthError, `sendError` fällt auf 500 zurück
//   {"password":""}                → 204, still verschluckt (`if (password)`)
//   {"approve":"true"}             → 204, nichts freigegeben, kein Vermerk
//   {"approve":true,"role":"chef"} → 200: erst freigegeben, DANN die unbekannte Rolle geschrieben
//
// WO DIE GRENZE LIEGT, und sie ist dieselbe wie in JOB 3755: Die Route urteilt über die FORM
// (bekannter Rollenname · Zeichenkette · Boolean). Ob eine Zeichenkette ein STARKES Passwort ist,
// ob der letzte Admin ausgesperrt würde und ob sich jemand selbst herabstuft, entscheidet allein
// der Dienst. Zwei Fragen, zwei Stellen — K5 misst genau diese Trennung.
//
// GEPRÜFT WIRD VOR DEM ERSTEN SCHREIBEN. Ein Aufruf, der zur Hälfte ausgeführt wird (freigegeben,
// Rolle abgelehnt), wäre die schlechtere Hälfte der beiden — F6 misst es am Prüfprotokoll.
import { afterEach, describe, expect, it } from "vitest";
import { MELDUNGEN } from "../../services/auth/src/meldungen";
import type { PublicUser, Role } from "../../services/auth/src/types";
import { GAST_PASSWORT, type Kreis, STUNDE, adminUndGast } from "../demo-zugang-gaeste/aufbau";
import { anmelden, ausDerListe, baueDraht, schliesseOffeneDraehte, token, verwalte } from "./draht";

afterEach(schliesseOffeneDraehte);

/**
 * Ein NOCH NICHT freigegebenes Konto auf derselben Bühne.
 *
 * `adminUndGast` gibt seinen Gast bereits frei (`aufbau.ts:87`) — an einem freigegebenen Konto ist
 * „die Freigabe wurde NICHT erteilt" nicht messbar, weil der Sollzustand schon dasteht. Das hier
 * ist kein zweiter Aufbau, sondern ein weiteres Konto im selben Kreis.
 */
function nochNichtFrei(k: Kreis): Promise<PublicUser> {
  return k.service.register({ name: "Neuling", email: "neu@x.de", password: GAST_PASSWORT });
}

/** Alle vier Vorgänge, die dieser Endpunkt schreiben kann — ein abgewiesener Aufruf schreibt keinen. */
const VORGAENGE = [
  "user.role-change",
  "user.approve",
  "user.password-reset",
  "user.access-expiry-set",
] as const;

async function vermerke(k: Kreis, target: string): Promise<Record<string, number>> {
  const gezaehlt: Record<string, number> = {};
  for (const action of VORGAENGE) {
    gezaehlt[action] = (await k.audit.list({ action, target })).length;
  }
  return gezaehlt;
}

describe("JOB 3780 · der Änderungsweg prüft die Form von role, approve und password", () => {
  // ==============================================================================================
  // F1–F3 · DIE ROLLE
  // ==============================================================================================

  it("F1 — `chef` wird abgewiesen, und in der Nutzerliste steht weiterhin die alte Rolle", async () => {
    // DER FALL PRÜFT BEIDES: die Antwort UND den Stand, den ein Mensch sieht. Ein Test, der nur
    // den Statuscode liest, wäre auch von einer Route erfüllt, die 400 meldet und trotzdem schreibt.
    const { k, app } = await baueDraht();
    const { gast } = await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");
    expect((await ausDerListe(app, sitzung, gast.id))?.role).toBe("experte");

    const antwort = await verwalte(app, sitzung, gast.id, { role: "chef" });

    expect(antwort.statusCode, antwort.body).toBe(400);
    expect(antwort.json().error).toBe("BAD_REQUEST");
    // Byte-gleich zur Antwort von `POST /api/users` (routes.ts:659-664) — derselbe Wert, dieselbe
    // Anwendung, dieselbe Antwort. Das ist die eigentliche Lieferung.
    expect(antwort.json().message).toBe(MELDUNGEN.UNKNOWN_ROLE.de);
    expect((await ausDerListe(app, sitzung, gast.id))?.role).toBe("experte");
    expect(await k.audit.list({ action: "user.role-change", target: gast.id })).toEqual([]);
  });

  it("F1b — dieselbe Eingabe an beiden Wegen: Anlegen und Ändern antworten gleich", async () => {
    // DIE ZUSAGE DIESES AUFTRAGS IN EINEM FALL. Nicht „es gibt jetzt eine Prüfung", sondern: die
    // beiden Antworten sind nicht mehr zu unterscheiden.
    const { k, app } = await baueDraht();
    const { gast } = await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");

    const anlegen = await app.inject({
      method: "POST",
      url: "/api/users",
      headers: { authorization: `Bearer ${sitzung}` },
      payload: { name: "Neu", email: "neu2@x.de", password: GAST_PASSWORT, role: "chef" },
    });
    const aendern = await verwalte(app, sitzung, gast.id, { role: "chef" });

    expect(anlegen.statusCode, anlegen.body).toBe(400);
    expect(aendern.statusCode).toBe(anlegen.statusCode);
    expect(aendern.json()).toEqual(anlegen.json());
  });

  const FREMDE_ROLLEN: { name: string; wert: unknown }[] = [
    // F2: der leere Name lief bis hierher durch `if (role)` und wurde STILL verschluckt — 204 auf
    // einen Aufruf, der nichts getan hat, ist die Unwahrheit, die hier verschwindet.
    { name: "leerer Rollenname", wert: "" },
    { name: "Zahl", wert: 123 },
    { name: "Array mit gültigem Rollennamen", wert: ["admin"] },
    { name: "null", wert: null },
    { name: "Boolean", wert: true },
    { name: "Objekt", wert: { role: "admin" } },
    // Groß-/Kleinschreibung ist KEINE Auslegungssache: `types.ts:1` kennt nur Kleinschreibung.
    { name: "richtiger Name in falscher Schreibweise", wert: "Admin" },
  ];

  for (const { name, wert } of FREMDE_ROLLEN) {
    it(`F2/F3 — ${name}: 400 UNKNOWN_ROLE, nichts geschrieben`, async () => {
      const { k, app } = await baueDraht();
      const { gast } = await adminUndGast(k);
      const sitzung = await token(app, "admin@x.de");

      const antwort = await verwalte(app, sitzung, gast.id, { role: wert });

      expect(antwort.statusCode, antwort.body).toBe(400);
      expect(antwort.json().error).toBe("BAD_REQUEST");
      expect(antwort.json().message).toBe(MELDUNGEN.UNKNOWN_ROLE.de);
      // Nicht nur „kein gültiger Wert", sondern GAR KEIN Wert: die alte Rolle steht unverändert da.
      expect((await ausDerListe(app, sitzung, gast.id))?.role).toBe("experte");
      expect(await k.audit.list({ action: "user.role-change", target: gast.id })).toEqual([]);
    });
  }

  // ==============================================================================================
  // F4 · DAS PASSWORT — EINE ABLEHNUNG STATT EINES SERVERFEHLERS
  // ==============================================================================================

  const FREMDE_PASSWOERTER: { name: string; wert: unknown }[] = [
    // Gemessen: 500. `service.ts:839` prüft `.length` — eine Zahl hat keines, `undefined < 8` ist
    // `false`, und `pbkdf2` wirft erst tief drinnen. Der Mensch bekommt einen Serverfehler statt
    // einer Ablehnung (BENs Muster aus JOB 3755).
    { name: "Zahl mit acht Stellen", wert: 12345678 },
    // Dieser Fall war als EINZIGER schon am unveränderten Stand 400 — aus dem falschen Grund: ein
    // Array HAT ein `.length`, und `1 < 8` traf zufällig zu. Bei zwölf Einträgen im Array wäre er
    // durchgelaufen. Er bleibt in der Liste, weil die Antwort danach aus der FORM folgt und nicht
    // aus der Länge eines fremden Behälters.
    { name: "Array mit langem String", wert: ["achtzeichenlang"] },
    { name: "null", wert: null },
    { name: "Objekt", wert: { password: "achtzeichenlang" } },
    { name: "Boolean", wert: true },
  ];

  for (const { name, wert } of FREMDE_PASSWOERTER) {
    it(`F4 — Passwort als ${name}: 400 WEAK_PASSWORD statt 500, nichts geschrieben`, async () => {
      const { k, app } = await baueDraht();
      const { gast } = await adminUndGast(k);
      const sitzung = await token(app, "admin@x.de");

      const antwort = await verwalte(app, sitzung, gast.id, { password: wert });

      expect(antwort.statusCode, antwort.body).toBe(400);
      expect(antwort.json().error).toBe("WEAK_PASSWORD");
      expect(antwort.json().message).toBe(MELDUNGEN.WEAK_PASSWORD.de);
      expect(await k.audit.list({ action: "user.password-reset", target: gast.id })).toEqual([]);
      // DER VERHALTENSBELEG: das alte Passwort trägt weiterhin. Ein halb ausgeführter Reset (Hash
      // geschrieben, Antwort rot) sperrte den Gast aus, ohne dass es jemand beschlossen hätte.
      expect((await anmelden(app, "gast@x.de")).statusCode).toBe(200);
    });
  }

  it("F4b — ein leeres Passwort wird nicht mehr still verschluckt", async () => {
    // Gemessen am unveränderten Stand: 204 — `if (password)` ist bei `""` falsch, der Aufruf tat
    // nichts und sagte es nicht. Die FORM ist hier in Ordnung (eine Zeichenkette), also urteilt der
    // DIENST: zu kurz. Genau die Trennung, die K5 festhält.
    const { k, app } = await baueDraht();
    const { gast } = await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");

    const antwort = await verwalte(app, sitzung, gast.id, { password: "" });

    expect(antwort.statusCode, antwort.body).toBe(400);
    expect(antwort.json().error).toBe("WEAK_PASSWORD");
    expect(await k.audit.list({ action: "user.password-reset", target: gast.id })).toEqual([]);
  });

  // ==============================================================================================
  // F5 · DIE FREIGABE
  // ==============================================================================================

  const FREMDE_FREIGABEN: { name: string; wert: unknown }[] = [
    // Gemessen: 204. `approve === true` trifft `"true"` nicht — der Aufrufer hält die Freigabe für
    // erteilt, das Konto ist unverändert, und es entsteht kein Vermerk.
    { name: "Zeichenkette `true`", wert: "true" },
    { name: "Zahl 1", wert: 1 },
    { name: "Zeichenkette `yes`", wert: "yes" },
    { name: "null", wert: null },
    { name: "Objekt", wert: { approve: true } },
  ];

  for (const { name, wert } of FREMDE_FREIGABEN) {
    it(`F5 — Freigabe als ${name}: 403 mit „Unerwarteter Fehler.", nichts freigegeben`, async () => {
      // DER SCHWÄCHERE SATZ, BEWUSST GEWÄHLT: 403 mit `INTERNAL` ist derselbe Fehlervertrag, den
      // JOB 3755 vier Zeilen darüber für einen Formverstoß ohne eigenen Satz genommen hat
      // (`routes.ts`, R7/R9). Ehrlicher wäre „Freigabe muss ja oder nein sein." — das ist ein NEUER
      // Katalogschlüssel, und `meldungen.ts` ist REST (a) aus JOB 3755 und ein eigener Auftrag.
      const { k, app } = await baueDraht();
      await adminUndGast(k);
      const neuling = await nochNichtFrei(k);
      const sitzung = await token(app, "admin@x.de");

      const antwort = await verwalte(app, sitzung, neuling.id, { approve: wert });

      expect(antwort.statusCode, antwort.body).toBe(403);
      expect(antwort.json().error).toBe("FORBIDDEN");
      expect(antwort.json().message).toBe(MELDUNGEN.INTERNAL.de);
      expect((await ausDerListe(app, sitzung, neuling.id))?.approved).toBe(false);
      expect(await k.audit.list({ action: "user.approve", target: neuling.id })).toEqual([]);
    });
  }

  // ==============================================================================================
  // F6 · DIE REIHENFOLGE — GEPRÜFT WIRD VOR DEM ERSTEN SCHREIBEN
  // ==============================================================================================

  it("F6 — `{approve:true, role:'chef'}`: weder freigegeben noch umbenannt, kein einziger Vermerk", async () => {
    // AM UNVERÄNDERTEN STAND WAR DAS KONTO DANACH FREIGEGEBEN **UND** TRUG `chef`: `:746` gibt frei,
    // `:749` schreibt die unbekannte Rolle. Läge die Formwache hinter den Schreibaufrufen, wäre
    // dieser Fall die Hälfte davon — freigegeben, Rolle abgelehnt, Fehler gemeldet. Genau dagegen
    // hat JOB 3755 seine Prüfung vor den ersten Schreibvorgang gestellt (R9b).
    const { k, app } = await baueDraht();
    await adminUndGast(k);
    const neuling = await nochNichtFrei(k);
    const sitzung = await token(app, "admin@x.de");
    const vorher = await vermerke(k, neuling.id);
    expect(vorher).toEqual({
      "user.role-change": 0,
      "user.approve": 0,
      "user.password-reset": 0,
      "user.access-expiry-set": 0,
    });

    const antwort = await verwalte(app, sitzung, neuling.id, { approve: true, role: "chef" });

    expect(antwort.statusCode, antwort.body).toBe(400);
    expect(antwort.json().message).toBe(MELDUNGEN.UNKNOWN_ROLE.de);
    const gelistet = await ausDerListe(app, sitzung, neuling.id);
    expect(gelistet?.approved, "die Freigabe wurde trotz abgewiesener Rolle erteilt").toBe(false);
    expect(gelistet?.role).toBe("experte");
    expect(await vermerke(k, neuling.id)).toEqual(vorher);
  });

  it("F6b — alle vier Felder auf einmal, eines falsch: nichts wird geschrieben", async () => {
    // Dieselbe Aussage mit voller Breite: auch die Befristung von JOB 3755 bleibt ungeschrieben,
    // obwohl sie ZULETZT verarbeitet würde — die Wache steht vor allem, nicht zwischen den Teilen.
    const { k, app } = await baueDraht();
    await adminUndGast(k);
    const neuling = await nochNichtFrei(k);
    const sitzung = await token(app, "admin@x.de");

    const antwort = await verwalte(app, sitzung, neuling.id, {
      approve: true,
      role: "controller",
      password: 12345678,
      accessExpiresAt: new Date(k.jetzt() + STUNDE).toISOString(),
    });

    expect(antwort.statusCode, antwort.body).toBe(400);
    expect(antwort.json().error).toBe("WEAK_PASSWORD");
    const gelistet = await ausDerListe(app, sitzung, neuling.id);
    expect(gelistet?.approved).toBe(false);
    expect(gelistet?.role).toBe("experte");
    expect(gelistet?.accessExpiresAt).toBeUndefined();
    expect(await vermerke(k, neuling.id)).toEqual({
      "user.role-change": 0,
      "user.approve": 0,
      "user.password-reset": 0,
      "user.access-expiry-set": 0,
    });
  });

  // ==============================================================================================
  // K1–K7 · DIE GEGENRICHTUNG — eine Route, die ALLES abweist, ist hier NICHT grün
  // ==============================================================================================

  const BEKANNTE_ROLLEN: Role[] = ["viewer", "experte", "controller", "admin"];

  for (const rolle of BEKANNTE_ROLLEN) {
    it(`K1 — die bekannte Rolle \`${rolle}\` geht weiterhin durch`, async () => {
      const { k, app } = await baueDraht();
      const { gast } = await adminUndGast(k);
      const sitzung = await token(app, "admin@x.de");

      const antwort = await verwalte(app, sitzung, gast.id, { role: rolle });

      expect(antwort.statusCode, antwort.body).toBe(200);
      expect(antwort.json().role).toBe(rolle);
      expect((await ausDerListe(app, sitzung, gast.id))?.role).toBe(rolle);
      expect(await k.audit.list({ action: "user.role-change", target: gast.id })).toHaveLength(1);
    });
  }

  it("K2 — `{approve:true}` gibt weiterhin frei, und der Neuling kommt herein", async () => {
    const { k, app } = await baueDraht();
    await adminUndGast(k);
    const neuling = await nochNichtFrei(k);
    const sitzung = await token(app, "admin@x.de");
    expect((await anmelden(app, "neu@x.de")).statusCode, "war schon vorher freigegeben").toBe(403);

    const antwort = await verwalte(app, sitzung, neuling.id, { approve: true });

    expect(antwort.statusCode, antwort.body).toBe(200);
    expect(antwort.json().approved).toBe(true);
    expect(await k.audit.list({ action: "user.approve", target: neuling.id })).toHaveLength(1);
    expect((await anmelden(app, "neu@x.de")).statusCode).toBe(200);
  });

  it("K3 — `{approve:false}` bleibt eine gültige Eingabe: kein Fehler, keine Freigabe", async () => {
    // `false` heißt „gib nicht frei" und wird VERSTANDEN — anders als `"true"`, das niemand deuten
    // kann. Ein Rücknehmen der Freigabe gibt es an diesem Endpunkt nicht, also bleibt es bei 204.
    const { k, app } = await baueDraht();
    await adminUndGast(k);
    const neuling = await nochNichtFrei(k);
    const sitzung = await token(app, "admin@x.de");

    const antwort = await verwalte(app, sitzung, neuling.id, { approve: false });

    expect(antwort.statusCode, antwort.body).toBe(204);
    expect((await ausDerListe(app, sitzung, neuling.id))?.approved).toBe(false);
    expect(await k.audit.list({ action: "user.approve", target: neuling.id })).toEqual([]);
  });

  it("K4 — ein ausreichend langes Passwort wird weiterhin gesetzt, und der Gast meldet sich damit an", async () => {
    const { k, app } = await baueDraht();
    const { gast } = await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");

    const antwort = await verwalte(app, sitzung, gast.id, { password: "achtzeichen" });

    expect(antwort.statusCode, antwort.body).toBe(204);
    expect(await k.audit.list({ action: "user.password-reset", target: gast.id })).toHaveLength(1);
    const neu = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "gast@x.de", password: "achtzeichen" },
    });
    expect(neu.statusCode, neu.body).toBe(200);
  });

  it("K5 — zu kurz urteilt weiterhin der DIENST, nicht die Route", async () => {
    // DIE TRENNUNG, GEMESSEN STATT BEHAUPTET. Beide Stellen antworten mit 400 `WEAK_PASSWORD` —
    // unterscheidbar sind sie nur an der REIHENFOLGE: die Formwache der Route steht VOR allen
    // Schreibaufrufen, die Längenprüfung des Dienstes läuft erst in `resetPassword`, also NACH
    // `changeRole`. Wäre die Länge in die Route gewandert, bliebe die Rolle hier `experte`.
    //
    // DASS DIESER AUFRUF HALB AUSGEFÜHRT WIRD, IST EIN OFFENER PUNKT und kein Ziel dieses Auftrags:
    // ihn zu schließen hieße, „zu schwach" ein zweites Mal in der Route auszulegen (§10 — der
    // Dienst ist heiß und gehört JOB 3756). Der Fall hält den Zustand ehrlich fest, statt ihn zu
    // verschweigen.
    const { k, app } = await baueDraht();
    const { gast } = await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");

    const antwort = await verwalte(app, sitzung, gast.id, { role: "controller", password: "kurz" });

    expect(antwort.statusCode, antwort.body).toBe(400);
    expect(antwort.json().error).toBe("WEAK_PASSWORD");
    expect(antwort.json().message).toBe(MELDUNGEN.WEAK_PASSWORD.de);
    expect(
      (await ausDerListe(app, sitzung, gast.id))?.role,
      "die Längenprüfung ist in die Route gewandert — dann gäbe es zwei Urteile über zu schwach",
    ).toBe("controller");
    expect(await k.audit.list({ action: "user.password-reset", target: gast.id })).toEqual([]);
  });

  it("K6 — ein Aufruf ohne eines dieser Felder antwortet weiterhin 204", async () => {
    const { k, app } = await baueDraht();
    const { gast } = await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");
    // Gegen den Stand VORHER und nicht gegen Null: der Aufbau hat den Gast bereits freigegeben
    // (`aufbau.ts:87`), sein Prüfprotokoll trägt also schon einen Vorgang. Gegen Null zu zählen
    // hieße, die Bühne zu prüfen statt den Aufruf.
    const vorher = await vermerke(k, gast.id);

    const antwort = await verwalte(app, sitzung, gast.id, {});

    expect(antwort.statusCode, antwort.body).toBe(204);
    expect(await vermerke(k, gast.id)).toEqual(vorher);
  });

  it("K7 — Rolle, Freigabe, Passwort und Befristung zusammen: alles wird geschrieben", async () => {
    // Die Gegenrichtung in voller Breite. Ohne diesen Fall wäre F6b auch von einer Route erfüllt,
    // die kombinierte Aufrufe grundsätzlich abweist — und die Lieferung von JOB 3755 (`:758-764`:
    // die Antwort trägt den Stand NACH der Befristung) verschwände still.
    const { k, app } = await baueDraht();
    await adminUndGast(k);
    const neuling = await nochNichtFrei(k);
    const sitzung = await token(app, "admin@x.de");
    const ablauf = new Date(k.jetzt() + STUNDE).toISOString();

    const antwort = await verwalte(app, sitzung, neuling.id, {
      approve: true,
      role: "controller",
      password: "achtzeichen",
      accessExpiresAt: ablauf,
    });

    expect(antwort.statusCode, antwort.body).toBe(200);
    expect(antwort.json().approved).toBe(true);
    expect(antwort.json().role).toBe("controller");
    expect(antwort.json().accessExpiresAt).toBe(ablauf);
    expect(await vermerke(k, neuling.id)).toEqual({
      "user.role-change": 1,
      "user.approve": 1,
      "user.password-reset": 1,
      "user.access-expiry-set": 1,
    });
  });
});
