// ================================================================================================
// JOB 4015 — EIN UNBEKANNTER ROLLENNAME SPERRT, STATT DAS RECHTETOR ABSTÜRZEN ZU LASSEN.
// ================================================================================================
//
// DER AUSGANGSBEFUND, gemessen am Basisstand `b0315de` und nicht abgeschrieben:
// `services/rbac/src/policy.ts:22` griff ungeprüft in die Rechtematrix —
// `return ROLE_PERMISSIONS[role].includes(permission);`. Für einen Rollennamen ausserhalb der vier
// bekannten ist `ROLE_PERMISSIONS[role]` `undefined`, und `.includes` wirft
//   TypeError: Cannot read properties of undefined (reading 'includes')
// Der Wurf passiert INNERHALB von `requirePermission` (`services/app/src/http.ts:194`) und läuft
// damit NICHT durch `sendError` (`http.ts:129-163`), sondern über Fastifys Standardweg. Gemessen am
// Draht kam vor der Reparatur:
//   GET /api/kos  →  500  {"statusCode":500,"error":"Internal Server Error",
//                          "message":"Cannot read properties of undefined (reading 'includes')"}
// Ein Rollenwert ausserhalb der Codeunion kann nur aus der Ablage kommen (Altbestand, Migration,
// von Hand gesetzte Zeile). Die Hausregel dafür steht ausgeschrieben in `build-app.ts:529-536`: im
// Zweifel NEIN — nicht Absturz und nicht offen.
//
// WARUM DAS KEINE KOSMETIK IST: ein 500 ist für den Aufrufer ein Serverfehler, den er wiederholen
// darf; eine 403 ist eine Entscheidung. Und ein Tor, das wirft statt zu entscheiden, ist an jeder
// Stelle, an der jemand den Wurf fängt und weiterläuft, keine Sperre mehr.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeGuards } from "../../services/app/src/http";
import type { Role } from "../../services/auth";
import { can, canChangeRole, canManageUsers } from "../../services/rbac";
import { type Buehne, baueBuehne, kopfFuer, schliesseBuehnen } from "./buehne";

/**
 * Rollennamen, die es in `ROLE_PERMISSIONS` (`policy.ts:13-18`) NICHT gibt.
 *
 * ================================================================================================
 * RUNDE 2 — WARUM DIESE LISTE LÄNGER IST ALS „gast" (Korrekturpflicht 1 des Prüfers, Runde 1).
 * ================================================================================================
 *
 * Runde 1 hat die Lücke mit `ROLE_PERMISSIONS[role] ?? []` geschlossen und dabei nur EINEN Namen
 * geprüft: „gast". Das ist der Name, unter dem Pedis Zeile den begrenzten Zugang beschreibt — aber
 * er ist auch der gutmütigste Fall, denn für ihn ist der Tabellengriff tatsächlich `undefined`, und
 * `?? []` greift. Der Prüfer hat am Draht gemessen, dass es andere gibt:
 *
 *   gespeicherte Rolle „constructor"  →  GET /api/kos  →  500
 *   {"statusCode":500,"error":"Internal Server Error",
 *    "message":"(ROLE_PERMISSIONS[role] ?? []).includes is not a function"}
 *
 * DER GRUND: ein Objektliteral erbt von `Object.prototype`. `ROLE_PERMISSIONS["constructor"]` ist
 * deshalb NICHT `undefined`, sondern die geerbte Funktion `Object` — und `?? []` springt nur bei
 * `null`/`undefined` ein. Der Griff liefert also einen Wert ohne `.includes`, und der TypeError
 * steht wieder da, wo er vorher stand. Ein Namensvorrat, der nur „gast" enthält, kann das nicht
 * sehen; deshalb steht hier die ganze Nachbarschaft: Datenfelder (`constructor`), Methoden
 * (`toString`, `valueOf`, `hasOwnProperty`) und der Sonderfall `__proto__`, der über einen Getter
 * das Prototyp-Objekt selbst zurückgibt.
 *
 * Alle diese Werte können nur aus der ABLAGE kommen (Altbestand, Migration, von Hand gesetzte
 * Zeile) — das Produkt selbst schreibt sie nie. Genau dafür gilt die Hausregel „im Zweifel nein".
 */
const UNBEKANNTE: readonly Role[] = [
  "gast",
  "constructor",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "__proto__",
].map((name) => name as Role);

describe("JOB 4015 · unbekannte Rolle sperrt", () => {
  it.each(UNBEKANNTE)(
    "R1: can() gibt für den unbekannten Rollennamen %s false zurück, statt zu werfen",
    (unbekannt) => {
      expect(can(unbekannt, "ko.read")).toBe(false);
      expect(can(unbekannt, "ko.create")).toBe(false);
      expect(can(unbekannt, "users.manage")).toBe(false);
    },
  );

  it.each(UNBEKANNTE)(
    "R2: canManageUsers() gibt für den unbekannten Rollennamen %s false zurück",
    (unbekannt) => {
      expect(canManageUsers(unbekannt)).toBe(false);
    },
  );

  it.each(UNBEKANNTE)(
    "R3: canChangeRole() lässt einen Akteur mit der unbekannten Rolle %s keine Rolle ändern",
    (unbekannt) => {
      expect(canChangeRole({ id: "akteur-1", role: unbekannt }, "ziel-2", "viewer")).toBe(false);
      // Auch nicht auf „admin", und auch nicht an sich selbst: der Aussperrschutz in `canChangeRole`
      // greift erst NACH `canManageUsers` — fiele die erste Hürde, wäre die zweite wirkungslos.
      expect(canChangeRole({ id: "akteur-1", role: unbekannt }, "akteur-1", "admin")).toBe(false);
    },
  );

  it("R5: die bekannten vier Rollen behalten ihre Rechte unverändert", () => {
    // Die Gegenrichtung zu R1–R3: ein Vorgabewert an der falschen Stelle könnte eine BEKANNTE Rolle
    // entrechten. Diese Zeilen sind die Matrix aus `policy.ts:13-18`, von aussen nachgefragt.
    expect(can("viewer", "ko.read")).toBe(true);
    expect(can("viewer", "ko.create")).toBe(false);
    expect(can("experte", "ko.create")).toBe(true);
    expect(can("experte", "ko.validate")).toBe(false);
    expect(can("controller", "conflict.resolve")).toBe(true);
    expect(can("controller", "users.manage")).toBe(false);
    expect(can("admin", "users.manage")).toBe(true);
    expect(canManageUsers("admin")).toBe(true);
    expect(canManageUsers("controller")).toBe(false);
    expect(canChangeRole({ id: "a", role: "admin" }, "b", "viewer")).toBe(true);
  });

  describe("am Draht", () => {
    let buehne: Buehne;

    afterEach(schliesseBuehnen);

    beforeEach(async () => {
      buehne = await baueBuehne();
    });

    /**
     * Schreibt den Rollenwert DIREKT an das Konto — am Dienst vorbei, denn `changeRole` lässt einen
     * Namen ausserhalb der Union (zu Recht) nicht hinein. Genau so entsteht er im Betrieb: aus der
     * Ablage, nicht aus dem Produkt. Dieselbe Begründung wie in
     * `tests/demo-zugang-gaeste/aufbau.ts:92-98`.
     */
    async function setzeRolle(rolle: Role): Promise<void> {
      const konto = await buehne.repos.users.findById(buehne.konto.viewer.id);
      if (!konto) {
        throw new Error("Das Prüfkonto fehlt — der Aufbau ist kaputt, nicht das Produkt.");
      }
      await buehne.repos.users.update({ ...konto, role: rolle });
    }

    it.each(UNBEKANNTE)(
      "R4: eine angemeldete Sitzung mit der unbekannten Rolle %s bekommt 403 FORBIDDEN, nicht 500",
      async (unbekannt) => {
        await setzeRolle(unbekannt);
        const antwort = await buehne.app.inject({
          method: "GET",
          url: "/api/kos",
          headers: kopfFuer(buehne, "viewer"),
        });
        // Die 500 ist der Ausgangsbefund und wird deshalb EIGEN genannt: eine Prüfung, die nur
        // `toBe(403)` sagt, meldet bei einem Absturz zwar rot, aber nicht, dass es der Absturz war.
        expect(antwort.statusCode, `Rumpf: ${antwort.body}`).not.toBe(500);
        expect(antwort.statusCode, `Rumpf: ${antwort.body}`).toBe(403);
        expect(antwort.json()).toMatchObject({ error: "FORBIDDEN" });
      },
    );

    it("R6: die Sitzung ist echt — dieselbe Sitzung mit BEKANNTER Rolle kommt durch", async () => {
      // Ohne diese Gegenrichtung wäre R4 auch dann grün, wenn der Token schlicht ungültig wäre —
      // dann käme allerdings 401 und nicht 403; R6 schliesst die Lücke trotzdem ausdrücklich.
      // Dieselbe Sitzung, derselbe Token: erst die unbekannte Rolle, dann die bekannte zurück.
      await setzeRolle("constructor" as Role);
      await setzeRolle("viewer");
      const antwort = await buehne.app.inject({
        method: "GET",
        url: "/api/kos",
        headers: kopfFuer(buehne, "viewer"),
      });
      expect(antwort.statusCode, antwort.body).toBe(200);
    });

    it("R7: `requirePermission` selbst entscheidet — ohne Route, direkt am Tor", async () => {
      // Der Nachweis aus Lieferung 7 an der Stelle, die der Auftrag nennt (`http.ts:185-210`):
      // nicht über eine Route, sondern am Guard-Bündel selbst. Damit hängt die Aussage nicht daran,
      // welche Route zufällig gewählt wurde. Der Name ist „constructor", weil genau er die Runde 1
      // überlebt hat: für ihn lieferte der Tabellengriff einen Wert ohne `.includes`.
      await setzeRolle("constructor" as Role);
      const guards = makeGuards(buehne.services.auth);
      const gemessen: { status?: number; rumpf?: unknown } = {};
      const reply = {
        code(status: number) {
          gemessen.status = status;
          return this;
        },
        send(rumpf: unknown) {
          gemessen.rumpf = rumpf;
          return this;
        },
      };
      const request = {
        headers: { authorization: `Bearer ${buehne.sitzung.viewer}` },
      };
      const user = await guards.requirePermission(
        "ko.read",
        request as never,
        reply as unknown as never,
      );
      expect(user).toBeUndefined();
      expect(gemessen.status).toBe(403);
      expect(gemessen.rumpf).toMatchObject({ error: "FORBIDDEN" });
    });
  });
});
