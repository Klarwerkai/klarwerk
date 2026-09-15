// ================================================================================================
// JOB 4076 · S2 — DER EIGENTLICHE BEWEIS: DIE ANMELDUNG TRÄGT IM DRITTANBIETER-KONTEXT
// ================================================================================================
//
// DIE AUSGANGSLAGE, und sie ist kein Verdacht: das Klara-Seitenfenster
// (`/word-addin/taskpane.html`) liegt in Word für das Web in einem Rahmen fremder Herkunft. Sein
// `fetch("/api/auth/me", { credentials: "include" })` geht dort OHNE Cookie hinaus — der Browser
// schickt es im Drittanbieter-Kontext nicht mit (ITP;
// https://learn.microsoft.com/en-us/office/dev/add-ins/develop/itp-and-third-party-cookies).
// Der Poll konnte also gar nicht grün werden; er lief in die Frist und meldete „Zeit abgelaufen".
//
// DIESER FALL FÄHRT GENAU DIESE LAGE AB, in der Reihenfolge des echten Wegs:
//   1. Der Anmeldedialog (top-level, eigene Herkunft) meldet sich an und bekommt sein COOKIE.
//   2. Mit dem Cookie — und NUR damit, ohne Bearer — holt er den Übergabecode.
//   3. Das Seitenfenster löst den Code ein: OHNE Cookie, OHNE Authorization.
//   4. Mit dem zurückgegebenen Schlüssel öffnet es eine echte geschützte Route: OHNE Cookie.
//   5. GEGENPROBE: derselbe Aufruf ohne den Schlüssel bleibt 401 — die Lage ist echt, nicht
//      dadurch grün, dass der Prüfstand die Anmeldung ohnehin durchliesse.
//
// Das ist der Punkt, an dem der Auftrag hängt (§8.1): ein Aufruf OHNE JEDES COOKIE kommt an eine
// geschützte Route, weil die Anmeldung aus dem Dialog übergeben wurde. Ohne Microsoft-Konto
// messbar — was NICHT gemessen ist, ist ein Lauf im echten Office-Web-Host (das bleibt F-Aufgabe).
import { afterEach, describe, expect, it } from "vitest";
import { anmelden, baueDraht, schliesseOffeneDraehte } from "../demo-zugang-gaeste-route/draht";
import { adminUndGast } from "../demo-zugang-gaeste/aufbau";
import { codeHolenMitCookie, einloesen, ichMitSchluessel } from "./uebergabe";

afterEach(schliesseOffeneDraehte);

/**
 * Der Cookie-Kopf, den ein Browser aus einer `Set-Cookie`-Antwort bilden WÜRDE: Name=Wert, ohne
 * die Attribute. Bewusst aus der echten Antwort geschnitten und nicht selbst zusammengesetzt —
 * sonst prüfte dieser Fall einen Cookienamen, den der Test kennt, und nicht den, den der Server
 * setzt.
 */
function cookieKopf(gesetzt: string | string[] | undefined): string {
  const roh = Array.isArray(gesetzt) ? (gesetzt[0] ?? "") : (gesetzt ?? "");
  const erstes = roh.split(";")[0] ?? "";
  expect(erstes, "die Anmeldung hat kein Sitzungscookie gesetzt").toMatch(/^kw_session=.+/);
  return erstes;
}

describe("JOB 4076 · S2 · das Einlösen gelingt ohne Cookie, und der Schlüssel öffnet danach eine echte Route", () => {
  it("S2 — Dialog mit Cookie → Code → Seitenfenster ohne Cookie → geschützte Route", async () => {
    const { k, app } = await baueDraht();
    const { gast } = await adminUndGast(k);

    // 1. Der Dialog meldet sich an. Was er BEHÄLT, ist das Cookie — den Rumpf-Token benutzt dieser
    //    Fall bewusst NICHT: der SSO-Weg und eine bestehende Sitzung haben ihn nicht, und genau für
    //    die ist die Übergabe gebaut.
    const angemeldet = await anmelden(app, "gast@x.de");
    expect(angemeldet.statusCode, angemeldet.body).toBe(200);
    const cookie = cookieKopf(angemeldet.headers["set-cookie"]);

    // 2. Der Code — allein mit dem Cookie.
    const ausgabe = await codeHolenMitCookie(app, cookie);
    expect(ausgabe.statusCode, ausgabe.body).toBe(201);
    const code = ausgabe.json().code as string;

    // 3. Das Einlösen: der Aufruf trägt WEDER Cookie NOCH Authorization (s. `einloesen`).
    const eingeloest = await einloesen(app, code);
    expect(eingeloest.statusCode, eingeloest.body).toBe(200);
    const schluessel = eingeloest.json().token as string;
    expect(typeof schluessel).toBe("string");
    expect(schluessel.length).toBeGreaterThan(0);
    // Die Identität kommt mit — aber das Seitenfenster glaubt ihr nicht: es holt sie frisch (4.).
    expect(eingeloest.json().user.id).toBe(gast.id);

    // 4. DER BEWEIS: eine echte geschützte Route, ohne Cookie, nur mit dem Schlüssel.
    const auskunft = await ichMitSchluessel(app, schluessel);
    expect(auskunft.statusCode, auskunft.body).toBe(200);
    expect(auskunft.json().id).toBe(gast.id);
    expect(auskunft.json().name).toBe("Gast");

    // 5. DIE GEGENPROBE: ohne den Schlüssel und ohne Cookie ist dieselbe Route 401. Ohne diesen
    //    Halbsatz wäre Punkt 4 auch von einer Route erfüllt, die gar nichts prüft.
    const blank = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(blank.statusCode).toBe(401);
  });

  it("S2b — der Schlüssel öffnet den Weg genauso oft, wie das Fenster ihn braucht", async () => {
    // Das Seitenfenster schickt ihn an JEDEM Abruf mit (eine Stelle setzt den Kopf). Wäre der
    // Schlüssel selbst einmalig, klappte die Anmeldung scheinbar und der erste echte Griff
    // scheiterte — genau die Halbheit, die §8.4 ausschliesst.
    const { k, app } = await baueDraht();
    await adminUndGast(k);
    const angemeldet = await anmelden(app, "gast@x.de");
    const cookie = cookieKopf(angemeldet.headers["set-cookie"]);
    const code = (await codeHolenMitCookie(app, cookie)).json().code as string;
    const schluessel = (await einloesen(app, code)).json().token as string;

    for (let i = 0; i < 3; i += 1) {
      expect((await ichMitSchluessel(app, schluessel)).statusCode, `Abruf ${i}`).toBe(200);
    }
  });
});
