// ================================================================================================
// JOB 4076 · S1 — DER ÜBERGABECODE: AUSGEBEN NUR MIT SITZUNG, EINLÖSEN GENAU EINMAL
// ================================================================================================
//
// WOFÜR ES DIESEN CODE ÜBERHAUPT GIBT. Word für das Web lädt das Klara-Seitenfenster
// (`/word-addin/taskpane.html`) in einem Rahmen FREMDER Herkunft; das Sitzungscookie erreicht es
// dort nicht (Drittanbieter-Kontext, ITP — Microsofts Originaldoku:
// https://learn.microsoft.com/en-us/office/dev/add-ins/develop/itp-and-third-party-cookies).
// Der Anmeldedialog dagegen ist TOP-LEVEL auf der eigenen Herkunft. Er kann das Cookie aber nicht
// LESEN (HttpOnly), und seine Nachricht an das Seitenfenster läuft durch die postMessage-Leitung
// des Office-Hosts. Deshalb reist ein einmaliger, kurzlebiger VERWEIS und nicht das Geheimnis.
//
// WAS DIESE DATEI MISST — die vier Eigenschaften, die den Weg tragen, jede einzeln:
//   S1a  ausgeben verlangt eine Sitzung (ohne: 401)
//   S1b  einlösen gelingt GENAU EINMAL; der zweite Versuch scheitert, obwohl die Frist noch läuft
//   S1c  nach Ablauf der Frist scheitert er — und die Frist ist wirklich ~120 s, nicht „irgendwann"
//   S1d  nach Abmeldung der ERZEUGENDEN Sitzung ist der Code tot
//
// KEIN ZWEITER AUFBAU. Uhr, Ablagen und Fastify-Draht kommen aus `tests/demo-zugang-gaeste/aufbau`
// und `tests/demo-zugang-gaeste-route/draht` — derselbe Kreis, gegen den `POST /api/auth/login`,
// `POST /api/auth/logout` und `GET /api/auth/me` schon gemessen werden. Das sind die ECHTEN Routen
// aus `services/auth/src/routes.ts` über einem echten `AuthService`; ein eigener Aufbau daneben
// wäre eine zweite Aussage über denselben Endpunkt, die nur heute mit der ersten übereinstimmt.
// ABWEICHUNG vom Auftrag (§6), bewusst und hier benannt: dort steht `buildApp(buildServices())`.
// Dieser Draht fährt dieselben Routen, hat aber eine INJIZIERTE Uhr für den Dienst — und ohne die
// wäre S1d („die Sitzung ist weg") nicht sauber von S1c („die Frist ist weg") zu trennen.
//
// DIE FRIST DES CODES LIEST `Date.now()` und nicht die Kreis-Uhr: sie gehört der Route, nicht dem
// Dienst. `vi.setSystemTime` stellt genau sie — deshalb fakt diese Datei ausschliesslich `Date`
// und keine Zeitgeber (ein gefälschter `setTimeout` hielte den Fastify-Draht an).
import { afterEach, describe, expect, it, vi } from "vitest";
import { baueDraht, ich, schliesseOffeneDraehte, token } from "../demo-zugang-gaeste-route/draht";
import { adminUndGast } from "../demo-zugang-gaeste/aufbau";
import { codeHolen, einloesen } from "./uebergabe";

afterEach(async () => {
  vi.useRealTimers();
  await schliesseOffeneDraehte();
});

describe("JOB 4076 · S1 · der Übergabecode trägt vier Eigenschaften, und jede wird gemessen", () => {
  it("S1a — ohne Sitzung gibt es keinen Code (401), mit Sitzung genau einen", async () => {
    const { k, app } = await baueDraht();
    await adminUndGast(k);

    const ohne = await codeHolen(app, null);
    expect(ohne.statusCode, ohne.body).toBe(401);
    expect(ohne.json().error).toBe("INVALID_CREDENTIALS");
    // Und kein Code im Rumpf der Absage — eine 401, die trotzdem etwas herausgibt, wäre der
    // schlimmste Fall dieses Wegs.
    expect(ohne.body).not.toContain("code");

    const sitzung = await token(app, "gast@x.de");
    const mit = await codeHolen(app, sitzung);
    expect(mit.statusCode, mit.body).toBe(201);
    const code = mit.json().code as string;
    // Kryptografisch zufällig und nicht ableitbar: 32 Bytes base64url sind 43 Zeichen. Der Wert
    // wird NICHT gegen ein Muster gepinnt, das ihn erratbar machte — gemessen wird die Länge und
    // dass zwei Aufrufe verschiedene Codes geben.
    expect(typeof code).toBe("string");
    expect(code.length).toBeGreaterThanOrEqual(43);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    const zweiter = await codeHolen(app, sitzung);
    expect(zweiter.json().code).not.toBe(code);
  });

  it("S1b — der Code löst GENAU EINMAL ein; der zweite Versuch scheitert bei laufender Frist", async () => {
    const { k, app } = await baueDraht();
    const { gast } = await adminUndGast(k);
    const sitzung = await token(app, "gast@x.de");
    const code = (await codeHolen(app, sitzung)).json().code as string;

    const erst = await einloesen(app, code);
    expect(erst.statusCode, erst.body).toBe(200);
    expect(erst.json().token).toBe(sitzung);
    expect(erst.json().user.id).toBe(gast.id);

    // KEINE Zeit vergangen, KEINE Abmeldung — allein die Einmaligkeit weist den zweiten ab.
    const nochmal = await einloesen(app, code);
    expect(nochmal.statusCode, nochmal.body).toBe(401);
  });

  it("S1c — nach Ablauf der Frist scheitert er; kurz davor nicht (die Grenze ist ~120 s)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const start = Date.parse("2026-09-15T08:00:00.000Z");
    vi.setSystemTime(start);
    const { k, app } = await baueDraht();
    await adminUndGast(k);
    const sitzung = await token(app, "gast@x.de");
    const frisch = (await codeHolen(app, sitzung)).json().code as string;
    const alt = (await codeHolen(app, sitzung)).json().code as string;

    // KURZ DAVOR gilt er noch. Ohne diesen halben Fall wäre „nach der Frist tot" auch von einer
    // Route erfüllt, die JEDEN Code sofort verwirft.
    vi.setSystemTime(start + 119_000);
    expect((await einloesen(app, frisch)).statusCode).toBe(200);

    // KURZ DANACH nicht mehr. Der zweite Code ist derselben Sekunde entstanden und wurde nicht
    // angefasst — er scheitert allein an der Zeit.
    vi.setSystemTime(start + 121_000);
    const abgelaufen = await einloesen(app, alt);
    expect(abgelaufen.statusCode, abgelaufen.body).toBe(401);
  });

  it("S1d — wird die erzeugende Sitzung abgemeldet, ist der Code tot", async () => {
    const { k, app } = await baueDraht();
    await adminUndGast(k);
    const sitzung = await token(app, "gast@x.de");
    const code = (await codeHolen(app, sitzung)).json().code as string;

    // Kalibrierung ZUERST: die Sitzung trägt in diesem Augenblick wirklich.
    expect((await ich(app, sitzung)).statusCode).toBe(200);

    const ab = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { authorization: `Bearer ${sitzung}` },
    });
    expect(ab.statusCode).toBe(204);

    const danach = await einloesen(app, code);
    expect(danach.statusCode, danach.body).toBe(401);
    // Und die Begründung ist die richtige: nicht die Frist (die läuft noch), sondern die Sitzung.
    expect((await ich(app, sitzung)).statusCode).toBe(401);
  });

  it("S1e — ein Rumpf ohne lesbaren Code wird abgewiesen, nicht mit einem Serverfehler beantwortet", async () => {
    const { k, app } = await baueDraht();
    await adminUndGast(k);
    // Was eine Oberfläche nie schickt, bekommt trotzdem eine ehrliche Absage: die Typangabe im
    // Route-Vertrag ist `unknown` und keine Behauptung über fremde Eingabe (JOB 3755 R2, BEN).
    for (const unsinn of [undefined, null, "", 12, { code: 1 }, ["x"]]) {
      const antwort = await einloesen(app, unsinn);
      expect(antwort.statusCode, JSON.stringify(unsinn)).toBe(401);
    }
  });
});
