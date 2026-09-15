// ================================================================================================
// JOB 4011 · EIN GAST ENTSTEHT BEFRISTET — IN EINEM SCHRITT, ODER GAR NICHT
// ================================================================================================
//
// DER BEFUND, am Basisstand `b0315de` (1.0.0-beta.1.503) Zeile für Zeile nachgelesen:
//
//   · `services/auth/src/routes.ts:643` deklariert den Anlageweg als
//     `Body: { name; email; password; role? }` — `accessExpiresAt` kommt darin nicht vor, und
//     `:658-683` prüft genau diese vier Felder.
//   · `:685-694` legt in drei Schritten an (`register` · `approveUser` · ggf. `changeRole`); eine
//     Befristung ist an keiner Stelle vorgesehen.
//   · Der ÄNDERUNGSWEG kann sie seit JOB 3755 (`:768`, `:813-819`, `:836-841`).
//
// Ein befristeter Gast entstand damit nur über ZWEI Aufrufe. Zwischen ihnen existierte ein Konto,
// das sich anmelden konnte und nie ablief — und scheiterte der zweite Aufruf oder unterblieb er,
// blieb genau dieses Konto im Bestand, ohne dass irgendetwas es als unfertig auswies.
//
// WAS DIESE DATEI MISST, und es ist ausdrücklich nicht der Statuscode: nach EINEM Aufruf existiert
// ein Gast, dessen Zugang endet — oder es existiert gar keiner. Gemessen an der NUTZERLISTE
// (`GET /api/users`) und an der ABGEWIESENEN ANMELDUNG, nicht an der Antwort allein. Eine Route,
// die 400 meldet und trotzdem anlegt, besteht keinen dieser Fälle.
//
// KEIN ZWEITER AUFBAU. Uhr, Ablagen, Prüfprotokoll und Fastify-Draht kommen aus
// `tests/demo-zugang-gaeste/aufbau` und `tests/demo-zugang-gaeste-route/draht` — derselbe Kreis,
// den der Änderungsweg fährt. Läge hier ein eigener, wären zwei Aussagen über DENSELBEN Endpunkt
// nicht mehr vergleichbar, und G6 („beide Wege antworten gleich") verlöre seinen Sinn.
//
// DIE OBERFLÄCHE IST TEIL 2 UND WIRD HIER NICHT BEHAUPTET. `apps/web/**` ist kein Zielpfad dieses
// Auftrags (JOB 3667 hält `i18n.ts` und die API-Dateien). Die Nutzenkette endet an der
// Schnittstelle, und genau dort wird sie gemessen.
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { MELDUNGEN } from "../../services/auth/src/meldungen";
import type { PublicUser } from "../../services/auth/src/types";
import {
  anmelden,
  baueDraht,
  schliesseOffeneDraehte,
  token,
  verwalte,
} from "../demo-zugang-gaeste-route/draht";
import { GAST_PASSWORT, STUNDE, adminUndGast } from "../demo-zugang-gaeste/aufbau";

afterEach(schliesseOffeneDraehte);

const NEU = "interessent@x.de";

/**
 * Der Anlageweg, wörtlich über HTTP. Bewusst HIER und nicht in `draht.ts`: `app.inject(` muss in
 * DIESER Datei stehen, sonst zählt sie der Herkunftswächter
 * (`tests/q9-serverfehlertexte/katalogschluessel-herkunft.test.ts`, `ROUTEN_MERKMAL`) nicht als
 * Routentest — und der neue Katalogschlüssel stünde dort als ungemessen da, obwohl er gemessen ist.
 */
function anlegen(
  app: FastifyInstance,
  sitzung: string,
  body: Record<string, unknown>,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${sitzung}` },
    payload: body,
  });
}

function anlegenMitSprache(
  app: FastifyInstance,
  sitzung: string,
  sprache: string,
  body: Record<string, unknown>,
): Promise<LightMyRequestResponse> {
  return app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${sitzung}`, "accept-language": sprache },
    payload: body,
  });
}

/** Die ganze Nutzerliste, so wie ein Mensch sie sieht — nicht die Antwort von eben. */
async function liste(app: FastifyInstance, sitzung: string): Promise<PublicUser[]> {
  const antwort = await app.inject({
    method: "GET",
    url: "/api/users",
    headers: { authorization: `Bearer ${sitzung}` },
  });
  expect(antwort.statusCode, `GET /api/users: ${antwort.body}`).toBe(200);
  return antwort.json() as PublicUser[];
}

describe("JOB 4011 · der Admin legt einen befristeten Gast in einem Schritt an", () => {
  it("G1 — befristet anlegen: 201 mit dem Feld, und die Nutzerliste zeigt es", async () => {
    const { k, app } = await baueDraht();
    await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");
    const ablauf = new Date(k.jetzt() + 24 * STUNDE).toISOString();

    const antwort = await anlegen(app, sitzung, {
      name: "Interessent",
      email: NEU,
      password: GAST_PASSWORT,
      accessExpiresAt: ablauf,
    });

    expect(antwort.statusCode, antwort.body).toBe(201);
    // Die 201er-Antwort ist der Stand NACH dem Setzen. Käme sie aus `approveUser` oder
    // `changeRole`, meldete sie „angelegt" und zeigte ein Konto ohne die Befristung, die derselbe
    // Aufruf gerade gesetzt hat.
    expect(antwort.json().accessExpiresAt).toBe(ablauf);
    expect(antwort.json().approved).toBe(true);
    const gelistet = (await liste(app, sitzung)).find((u) => u.email === NEU);
    expect(gelistet?.accessExpiresAt).toBe(ablauf);
  });

  it("G1b — mit Rolle UND Befristung in einem Aufruf: die Antwort trägt beides", async () => {
    // Die Reihenfolge im Anlageweg ist die Aussage: Befristung, Rolle, DANN Freigabe (seit
    // Runde 2 — s. `befristet-oder-gar-nicht.test.ts`). Weil die Freigabe zuletzt kommt und ihr
    // Schritt das Konto frisch liest, trägt die 201 beides; käme die Antwort aus einem früheren
    // Schritt, fehlte ihr entweder die Rolle oder die Befristung.
    const { k, app } = await baueDraht();
    await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");
    const ablauf = new Date(k.jetzt() + 24 * STUNDE).toISOString();

    const antwort = await anlegen(app, sitzung, {
      name: "Interessent",
      email: NEU,
      password: GAST_PASSWORT,
      role: "controller",
      accessExpiresAt: ablauf,
    });

    expect(antwort.statusCode, antwort.body).toBe(201);
    expect(antwort.json().role).toBe("controller");
    expect(antwort.json().accessExpiresAt).toBe(ablauf);
    const gelistet = (await liste(app, sitzung)).find((u) => u.email === NEU);
    expect(gelistet?.role).toBe("controller");
    expect(gelistet?.accessExpiresAt).toBe(ablauf);
  });

  it("G2 — ein Datum in der Vergangenheit sperrt den frisch angelegten Gast sofort", async () => {
    // DER VERHALTENSBELEG, und er ist der eigentliche Punkt von G1: nicht „das Feld steht da",
    // sondern „der Mensch kommt nicht herein" — dieselbe Kette wie R6 am Änderungsweg, nur mit
    // einem Konto, das es vor diesem einen Aufruf nicht gab.
    const { k, app } = await baueDraht();
    await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");
    const vergangen = new Date(k.jetzt() - STUNDE).toISOString();

    const antwort = await anlegen(app, sitzung, {
      name: "Interessent",
      email: NEU,
      password: GAST_PASSWORT,
      accessExpiresAt: vergangen,
    });
    expect(antwort.statusCode, antwort.body).toBe(201);
    expect(antwort.json().accessExpiresAt).toBe(vergangen);

    const versuch = await anmelden(app, NEU);
    expect(versuch.statusCode, versuch.body).toBe(403);
    expect(versuch.json().error).toBe("NOT_APPROVED");
    expect(versuch.json().message).toBe(MELDUNGEN.ACCESS_EXPIRED.de);
  });

  it("G3 — ein unlesbares Datum: 400 mit eigenem Satz, und es entsteht KEIN Konto", async () => {
    // DIE KERNZUSAGE DIESES AUFTRAGS. Die naheliegende Halbheit wäre, nach `register` einfach
    // `setAccessExpiry` hinterherzurufen — dann bliebe bei unlesbarer Eingabe genau das
    // unbefristete Konto zurück, das dieser Auftrag verhindert. Deshalb wird die NICHTENTSTEHUNG
    // gemessen und nicht der Statuscode allein.
    const { k, app } = await baueDraht();
    await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");
    const vorher = await liste(app, sitzung);

    const antwort = await anlegen(app, sitzung, {
      name: "Interessent",
      email: NEU,
      password: GAST_PASSWORT,
      accessExpiresAt: "morgen",
    });

    expect(antwort.statusCode, antwort.body).toBe(400);
    // Der Schlüssel wird am Feld `error` des Rumpfs verglichen, nicht über einen Textfund
    // irgendwo in der Antwort (Lehre aus JOB 3953 R1/R2).
    expect(antwort.json().error).toBe("BAD_REQUEST");
    expect(antwort.json().message).toBe(MELDUNGEN.ACCESS_EXPIRY_UNREADABLE.de);
    // Und ausdrücklich NICHT „Unerwarteter Fehler." — das war der Zustand vor diesem Auftrag.
    expect(antwort.json().message).not.toBe(MELDUNGEN.INTERNAL.de);

    const nachher = await liste(app, sitzung);
    expect(
      nachher.find((u) => u.email === NEU),
      "ein Konto ist trotzdem entstanden",
    ).toBeUndefined();
    expect(nachher.map((u) => u.email).sort()).toEqual(vorher.map((u) => u.email).sort());
    // Kein halber Zustand: keine Freigabe, keine Rolle, kein Vermerk.
    expect(await k.audit.list({ action: "user.access-expiry-set" })).toEqual([]);
    expect(await k.audit.list({ action: "user.approve" })).toHaveLength(1); // nur der Gast aus dem Aufbau
  });

  it("G3b EN — derselbe Tippfehler auf Englisch: 400 mit dem englischen Satz", async () => {
    // Der neue Schlüssel bringt seine Fremdsprachmessung am Tag seiner Einführung mit (dieselbe
    // Zusage wie ACCESS_EXPIRED in JOB 3756). Ohne EN/NL am DRAHT bürgt für die Übersetzung nur der
    // Katalogwächter — und der sähe einen deutschen Satz in der englischen Spalte nicht.
    const { app, k } = await baueDraht();
    await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");

    const antwort = await anlegenMitSprache(app, sitzung, "en", {
      name: "Interessent",
      email: NEU,
      password: GAST_PASSWORT,
      accessExpiresAt: "morgen",
    });

    expect(antwort.statusCode, antwort.body).toBe(400);
    expect(antwort.json().error).toBe("BAD_REQUEST");
    expect(antwort.json().message).toBe(MELDUNGEN.ACCESS_EXPIRY_UNREADABLE.en);
  });

  it("G3c NL — und auf Niederländisch: 400 mit dem niederländischen Satz", async () => {
    const { app, k } = await baueDraht();
    await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");

    const antwort = await anlegenMitSprache(app, sitzung, "nl", {
      name: "Interessent",
      email: NEU,
      password: GAST_PASSWORT,
      accessExpiresAt: "morgen",
    });

    expect(antwort.statusCode, antwort.body).toBe(400);
    expect(antwort.json().error).toBe("BAD_REQUEST");
    expect(antwort.json().message).toBe(MELDUNGEN.ACCESS_EXPIRY_UNREADABLE.nl);
  });

  const UNLESBAR = [
    "morgen",
    "09/12/2026", // parsbar, aber mehrdeutig: 9. Dezember oder 12. September?
    "2026-09-11", // ohne Uhrzeit: welcher Moment des Tages?
    "2026-09-11T12:00:00", // ohne Zone: JavaScript liest Ortszeit — hinge am Server
    "2026-02-30T00:00:00Z", // passt auf die Form und ist trotzdem kein Tag
    "",
  ];

  for (const wert of UNLESBAR) {
    it(`G3d — „${wert}" wird abgewiesen, und es entsteht kein Konto`, async () => {
      // Dieselbe Liste, die der Dienst am Änderungsweg abweist (C7 in
      // `tests/demo-zugang-gaeste/ablauf-setzen.test.ts`) — EINE Regel, an beiden Wegen dieselbe.
      const { k, app } = await baueDraht();
      await adminUndGast(k);
      const sitzung = await token(app, "admin@x.de");

      const antwort = await anlegen(app, sitzung, {
        name: "Interessent",
        email: NEU,
        password: GAST_PASSWORT,
        accessExpiresAt: wert,
      });

      expect(antwort.statusCode, antwort.body).toBe(400);
      expect(antwort.json().error).toBe("BAD_REQUEST");
      expect((await liste(app, sitzung)).find((u) => u.email === NEU)).toBeUndefined();
    });
  }

  const FREMDE_TYPEN: { name: string; wert: unknown }[] = [
    { name: "Array mit gültigem ISO-String", wert: ["2026-09-11T13:00:00.000Z"] },
    { name: "Objekt mit eigener, nicht aufrufbarer toString", wert: { toString: "kein Datum" } },
    { name: "Zahl", wert: 1789200000000 },
    { name: "Boolean", wert: true },
  ];

  for (const { name, wert } of FREMDE_TYPEN) {
    it(`G4 — fremder Typ (${name}): 403 INTERNAL, nichts entstanden`, async () => {
      // DIE GRENZE BLEIBT, WO SIE IST: ein Rumpf, den keine Oberfläche erzeugen kann, ist etwas
      // anderes als ein Tippfehler. Der neue Satz gilt für das, was ein Mensch tippt; der fremde
      // Typ behält den alten Fehlervertrag (R9/R9b am Änderungsweg).
      const { app, k } = await baueDraht();
      await adminUndGast(k);
      const sitzung = await token(app, "admin@x.de");

      const antwort = await anlegen(app, sitzung, {
        name: "Interessent",
        email: NEU,
        password: GAST_PASSWORT,
        accessExpiresAt: wert,
      });

      expect(antwort.statusCode, antwort.body).toBe(403);
      expect(antwort.json().error).toBe("FORBIDDEN");
      expect(antwort.json().message).toBe(MELDUNGEN.INTERNAL.de);
      expect((await liste(app, sitzung)).find((u) => u.email === NEU)).toBeUndefined();
      expect(await k.audit.list({ action: "user.access-expiry-set" })).toEqual([]);
    });
  }

  it("G5 — ohne Angabe entsteht ein unbefristetes Konto, ohne Ablauf-Vermerk", async () => {
    // Die Kalibrierung: eine Route, die JEDE Anlage befristet oder jede abweist, bestünde G1 und
    // G3 — und hätte den Bestandsweg zerstört. „Kein Ablauf" ist der gültige Normalzustand.
    const { k, app } = await baueDraht();
    await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");

    const antwort = await anlegen(app, sitzung, {
      name: "Interessent",
      email: NEU,
      password: GAST_PASSWORT,
    });

    expect(antwort.statusCode, antwort.body).toBe(201);
    // Kein `null` als Ersatz für „unbefristet": der Bestand kennt genau zwei Zustände, und das
    // Feld ist im unbefristeten gar nicht da (dieselbe Zusage wie R2 am Änderungsweg).
    expect(Object.hasOwn(antwort.json(), "accessExpiresAt")).toBe(false);
    const neu = (await liste(app, sitzung)).find((u) => u.email === NEU);
    expect(neu?.accessExpiresAt).toBeUndefined();
    expect(await k.audit.list({ action: "user.access-expiry-set", target: neu?.id ?? "" })).toEqual(
      [],
    );
    // Und der Gast kommt herein — ein Konto ohne Befristung ist ein offenes Konto.
    expect((await anmelden(app, NEU)).statusCode).toBe(200);
  });

  it("G5b — `null` beim Anlegen heißt ebenfalls unbefristet, nicht unlesbar", async () => {
    // BEIM ANLEGEN GIBT ES NICHTS ZU NEHMEN, deshalb fallen „fehlend" und `null` hier zusammen —
    // anders als am Änderungsweg, wo `null` „NIMM die Befristung" heißt und ein FEHLENDES Feld
    // „ich sage dazu nichts". Zwei Wege, zwei Vorgeschichten, eine begründete Abweichung.
    const { k, app } = await baueDraht();
    await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");

    const antwort = await anlegen(app, sitzung, {
      name: "Interessent",
      email: NEU,
      password: GAST_PASSWORT,
      accessExpiresAt: null,
    });

    expect(antwort.statusCode, antwort.body).toBe(201);
    expect(Object.hasOwn(antwort.json(), "accessExpiresAt")).toBe(false);
    const neu = (await liste(app, sitzung)).find((u) => u.email === NEU);
    expect(neu?.accessExpiresAt).toBeUndefined();
    expect(await k.audit.list({ action: "user.access-expiry-set", target: neu?.id ?? "" })).toEqual(
      [],
    );
  });

  it("G5c — das Prüfprotokoll trägt beim befristeten Anlegen GENAU EINEN Ablauf-Vorgang", async () => {
    // Maßstab ist R8 am Änderungsweg. Ein zweiter Vermerk (etwa weil der Weg erst anlegt und dann
    // ein zweites Mal setzt) wäre eine Unwahrheit im Prüfpfad: zwei Entscheidungen, wo der Mensch
    // eine getroffen hat.
    const { k, app } = await baueDraht();
    const { admin } = await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");
    const ablauf = new Date(k.jetzt() + 24 * STUNDE).toISOString();

    const antwort = await anlegen(app, sitzung, {
      name: "Interessent",
      email: NEU,
      password: GAST_PASSWORT,
      accessExpiresAt: ablauf,
    });
    expect(antwort.statusCode, antwort.body).toBe(201);
    const neuId = antwort.json().id as string;

    const eintraege = await k.audit.list({ action: "user.access-expiry-set", target: neuId });
    expect(eintraege).toHaveLength(1);
    expect(eintraege[0]?.actor).toBe(admin.id);
    expect(eintraege[0]?.payload).toMatchObject({ expiresAt: ablauf });
    // Und die Vermerke des Anlegens stehen daneben, unverändert.
    expect(await k.audit.list({ action: "user.approve", target: neuId })).toHaveLength(1);
  });

  it("G6 — dieselbe Eingabe an beiden Wegen: Anlegen und Ändern antworten gleich", async () => {
    // DAS HAUSPRINZIP (F1b in `eingabeform-am-aenderungsweg.test.ts:93-110`), jetzt auch für
    // `accessExpiresAt`. Nicht „es gibt jetzt eine Prüfung", sondern: die beiden Antworten sind
    // nicht mehr zu unterscheiden. Zwei Sätze für denselben Tippfehler wären zwei Auslegungen
    // desselben Begriffs.
    const { k, app } = await baueDraht();
    const { gast } = await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");

    const anlegenAntwort = await anlegen(app, sitzung, {
      name: "Interessent",
      email: NEU,
      password: GAST_PASSWORT,
      accessExpiresAt: "morgen",
    });
    const aendernAntwort = await verwalte(app, sitzung, gast.id, { accessExpiresAt: "morgen" });

    expect(anlegenAntwort.statusCode, anlegenAntwort.body).toBe(400);
    expect(aendernAntwort.statusCode).toBe(anlegenAntwort.statusCode);
    expect(aendernAntwort.json()).toEqual(anlegenAntwort.json());
  });

  it("G6b — auch der fremde Typ antwortet an beiden Wegen gleich", async () => {
    // Die Gegenrichtung zu G6: die Grenze zwischen „Tippfehler" (400) und „das kann keine
    // Oberfläche erzeugen" (403) verläuft an BEIDEN Wegen an derselben Stelle.
    const { k, app } = await baueDraht();
    const { gast } = await adminUndGast(k);
    const sitzung = await token(app, "admin@x.de");

    const anlegenAntwort = await anlegen(app, sitzung, {
      name: "Interessent",
      email: NEU,
      password: GAST_PASSWORT,
      accessExpiresAt: ["2026-09-11T13:00:00.000Z"],
    });
    const aendernAntwort = await verwalte(app, sitzung, gast.id, {
      accessExpiresAt: ["2026-09-11T13:00:00.000Z"],
    });

    expect(anlegenAntwort.statusCode, anlegenAntwort.body).toBe(403);
    expect(aendernAntwort.statusCode).toBe(anlegenAntwort.statusCode);
    expect(aendernAntwort.json()).toEqual(anlegenAntwort.json());
  });
});
