// ================================================================================================
// R-0679 / R-2156 / FR-VAL-07 — GERÄTE-PUSH NEBEN DER E-MAIL.
// R-1655 — NEUE OBJEKTE AN DIE SCHNELLSTEN PRÜFER IHRES THEMAS, MIT OPT-OUT.
// ================================================================================================
//
// Was hier ohne echten Push-Dienst belegbar ist, wird belegt: die VAPID-Signatur ist mit dem
// öffentlichen Schlüssel prüfbar, der Versand trägt keine Nutzlast und geht nur an bekannte
// Push-Dienste, ein abgelaufenes Abo wird entfernt, ein Push-Ausfall kostet die E-Mail nicht, und
// eine Zuweisung am Draht stößt Push und E-Mail an. Was NICHT belegt ist und nicht belegt werden
// kann: dass ein echtes Gerät über einen echten Push-Dienst den Hinweis anzeigt.
import { createPublicKey, generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { makeAssignmentNotifier } from "../../services/app/src/notify";
import type { AuthService } from "../../services/auth";
import {
  ConsoleMailer,
  InMemoryPushAboRepo,
  type PushAbo,
  type PushFetch,
  PushKonfigurationError,
  type PushSender,
  createPushFromEnv,
  pushEndpunktErlaubt,
  vapidJwt,
  vapidPushSender,
} from "../../services/notifications";

function schluesselpaar(): { publicKey: string; privateKey: string } {
  const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const jwk = privateKey.export({ format: "jwk" });
  const x = Buffer.from(jwk.x ?? "", "base64url");
  const y = Buffer.from(jwk.y ?? "", "base64url");
  return {
    publicKey: Buffer.concat([Buffer.from([4]), x, y]).toString("base64url"),
    privateKey: jwk.d ?? "",
  };
}

const ENDPUNKT = "https://fcm.googleapis.com/fcm/send/geraet-1";

function abo(userId: string, endpoint = ENDPUNKT): PushAbo {
  return { userId, endpoint, p256dh: "p", auth: "a", angelegtAm: "2026-10-01T00:00:00.000Z" };
}

describe("R-0679 · VAPID-Push ohne Nutzlast", () => {
  it("P1 · der Ausweis (ES256) ist mit dem öffentlichen Schlüssel prüfbar und nennt Ziel und Ablauf", () => {
    const paar = schluesselpaar();
    const jwt = vapidJwt(
      { ...paar, subject: "mailto:betrieb@example.org" },
      "https://fcm.googleapis.com",
      1_800_000_000,
    );
    const [kopf, inhalt, signatur] = jwt.split(".");
    const punkt = Buffer.from(paar.publicKey, "base64url");
    const oeffentlich = createPublicKey({
      key: {
        kty: "EC",
        crv: "P-256",
        x: punkt.subarray(1, 33).toString("base64url"),
        y: punkt.subarray(33, 65).toString("base64url"),
      },
      format: "jwk",
    });
    expect(
      verify(
        "sha256",
        Buffer.from(`${kopf}.${inhalt}`),
        { key: oeffentlich, dsaEncoding: "ieee-p1363" },
        Buffer.from(signatur ?? "", "base64url"),
      ),
    ).toBe(true);
    expect(JSON.parse(Buffer.from(inhalt ?? "", "base64url").toString())).toEqual({
      aud: "https://fcm.googleapis.com",
      exp: 1_800_000_000 + 12 * 60 * 60,
      sub: "mailto:betrieb@example.org",
    });
  });

  it("P2 · Versand: leerer Rumpf, VAPID-Kopf; 201 zugestellt, 410 abgelaufen, fremder Host nie angefragt", async () => {
    const paar = schluesselpaar();
    const anfragen: { url: string; init: Parameters<PushFetch>[1] }[] = [];
    let antwort = 201;
    const sender = vapidPushSender(
      { ...paar, subject: "mailto:betrieb@example.org" },
      async (url, init) => {
        anfragen.push({ url, init });
        return { status: antwort };
      },
      () => 1_800_000_000_000,
    );
    expect(await sender.send(abo("u1"))).toBe("zugestellt");
    const erste = anfragen[0];
    expect(erste?.url).toBe(ENDPUNKT);
    expect(erste?.init.method).toBe("POST");
    expect(erste?.init.body.length).toBe(0);
    expect(erste?.init.headers.Authorization).toMatch(
      new RegExp(`^vapid t=[^.]+\\.[^.]+\\.[^.]+, k=${paar.publicKey}$`),
    );
    expect(erste?.init.headers.TTL).toBe("86400");

    antwort = 410;
    expect(await sender.send(abo("u1"))).toBe("abgelaufen");
    antwort = 500;
    expect(await sender.send(abo("u1"))).toBe("abgelehnt");

    const vorher = anfragen.length;
    expect(await sender.send(abo("u1", "https://intern.example.org/hook"))).toBe("abgelehnt");
    expect(anfragen.length).toBe(vorher);
  });

  it("P3 · nur https an bekannte Push-Dienste", () => {
    expect(pushEndpunktErlaubt(ENDPUNKT)).toBe(true);
    expect(pushEndpunktErlaubt("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(true);
    expect(pushEndpunktErlaubt("https://web.push.apple.com/abc")).toBe(true);
    expect(pushEndpunktErlaubt("https://db5p.notify.windows.com/w/?token=x")).toBe(true);
    expect(pushEndpunktErlaubt("http://fcm.googleapis.com/x")).toBe(false);
    expect(pushEndpunktErlaubt("https://fcm.googleapis.com:8443/x")).toBe(false);
    expect(pushEndpunktErlaubt("https://notify.windows.com/x")).toBe(false);
    expect(pushEndpunktErlaubt("https://fcm.googleapis.com.example.org/x")).toBe(false);
    expect(pushEndpunktErlaubt("https://127.0.0.1/x")).toBe(false);
    expect(pushEndpunktErlaubt("kein url")).toBe(false);
  });

  it("P4 · Konfiguration: ohne Werte kein Push; ein unbrauchbarer Wert wird benannt, nie ausgegeben", () => {
    expect(createPushFromEnv({})).toBeUndefined();
    const paar = schluesselpaar();
    const gut = createPushFromEnv({
      VAPID_PUBLIC_KEY: paar.publicKey,
      VAPID_PRIVATE_KEY: paar.privateKey,
      VAPID_SUBJECT: "mailto:betrieb@example.org",
    });
    expect(gut?.publicKey).toBe(paar.publicKey);
    let fehler: unknown;
    try {
      createPushFromEnv({
        VAPID_PUBLIC_KEY: paar.publicKey,
        VAPID_PRIVATE_KEY: "zu-kurz-GEHEIM",
        VAPID_SUBJECT: "mailto:betrieb@example.org",
      });
    } catch (e) {
      fehler = e;
    }
    expect(fehler).toBeInstanceOf(PushKonfigurationError);
    expect(String((fehler as Error).message)).toContain("VAPID_PRIVATE_KEY");
    expect(String((fehler as Error).message)).not.toContain("GEHEIM");
  });
});

describe("R-0679 · Zuweisungsbenachrichtigung: E-Mail UND Push", () => {
  const auth = {
    listUsers: async () => [{ id: "u1", name: "Pia", email: "pia@example.org" }],
  } as unknown as AuthService;

  it("N1 · Mail an die Person, Push an jedes ihrer Geräte; ein abgelaufenes Abo wird entfernt", async () => {
    const mailer = new ConsoleMailer();
    const abos = new InMemoryPushAboRepo();
    await abos.speichern(abo("u1", "https://fcm.googleapis.com/fcm/send/handy"));
    await abos.speichern(abo("u1", "https://fcm.googleapis.com/fcm/send/alt"));
    const gesendet: string[] = [];
    const sender: PushSender = {
      publicKey: "k",
      send: async (a) => {
        gesendet.push(a.endpoint);
        return a.endpoint.endsWith("/alt") ? "abgelaufen" : "zugestellt";
      },
    };
    await makeAssignmentNotifier(auth, mailer, { abos, sender })("ko-1", ["u1"]);

    expect(mailer.sent.map((m) => m.to)).toEqual(["pia@example.org"]);
    expect(gesendet.sort()).toEqual([
      "https://fcm.googleapis.com/fcm/send/alt",
      "https://fcm.googleapis.com/fcm/send/handy",
    ]);
    expect((await abos.fuer("u1")).map((a) => a.endpoint)).toEqual([
      "https://fcm.googleapis.com/fcm/send/handy",
    ]);
  });

  it("N2 · ein Push-Ausfall kostet weder die Mail noch die übrigen Geräte; er wird gemeldet", async () => {
    const mailer = new ConsoleMailer();
    const abos = new InMemoryPushAboRepo();
    await abos.speichern(abo("u1", "https://fcm.googleapis.com/fcm/send/kaputt"));
    await abos.speichern(abo("u1", "https://fcm.googleapis.com/fcm/send/heil"));
    const gemeldet: string[] = [];
    const gesendet: string[] = [];
    const sender: PushSender = {
      publicKey: "k",
      send: async (a) => {
        if (a.endpoint.endsWith("/kaputt")) {
          throw new Error("Netz weg");
        }
        gesendet.push(a.endpoint);
        return "zugestellt";
      },
    };
    await makeAssignmentNotifier(auth, mailer, {
      abos,
      sender,
      fehler: (art) => gemeldet.push(art),
    })("ko-1", ["u1"]);

    expect(mailer.sent).toHaveLength(1);
    expect(gesendet).toEqual(["https://fcm.googleapis.com/fcm/send/heil"]);
    expect(gemeldet).toEqual(["ausfall"]);
  });
});

// ------------------------------------------------------------------------------------------------
// Am Draht: echte App, echte Routen. `services.push` wird VOR buildApp durch einen aufzeichnenden
// Sender ersetzt — dieselbe Naht, die eine VAPID-Konfiguration füllt.
// ------------------------------------------------------------------------------------------------
type App = ReturnType<typeof buildApp>;
const PASSWORT = "geheim12345";

async function login(app: App, email: string): Promise<{ authorization: string }> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: PASSWORT },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

async function buehne() {
  const services = buildServices();
  const gesendet: PushAbo[] = [];
  services.push = {
    publicKey: "BOEFFENTLICH",
    send: async (a) => {
      gesendet.push(a);
      return "zugestellt";
    },
  };
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada", email: "ada@r1655.test", password: PASSWORT },
  });
  const ada = await login(app, "ada@r1655.test");
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: ada,
    payload: { name: "Erik", email: "erik@r1655.test", password: PASSWORT, role: "experte" },
  });
  if (angelegt.statusCode !== 201) {
    throw new Error(`Konto Erik nicht angelegt: ${angelegt.statusCode}`);
  }
  const erik = await login(app, "erik@r1655.test");
  const konten = await services.auth.listUsers();
  const adaId = konten.find((u) => u.email === "ada@r1655.test")?.id ?? "";
  return { services, app, ada, erik, adaId, gesendet };
}

async function reicheEin(app: App, auth: { authorization: string }, titel: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: auth,
    payload: {
      confidentiality: "intern",
      title: titel,
      statement: "Vor dem Öffnen den Druck ablassen.",
      type: "best_practice",
      category: "Hydraulik",
      neededValidations: 1,
    },
  });
  expect(res.statusCode).toBe(201);
  return res.json().id as string;
}

describe("R-0679 · Push-Routen und Zuweisung am Draht", () => {
  it("D1 · Gerät anmelden (nur bekannte Push-Dienste), Zuweisung stößt Push an, Abmelden wirkt", async () => {
    const { services, app, ada, adaId, gesendet } = await buehne();
    const config = await app.inject({ method: "GET", url: "/api/push/config", headers: ada });
    expect(config.json()).toEqual({ verfuegbar: true, publicKey: "BOEFFENTLICH" });

    const fremd = await app.inject({
      method: "POST",
      url: "/api/push/abo",
      headers: ada,
      payload: { endpoint: "https://intern.example.org/x", keys: { p256dh: "p", auth: "a" } },
    });
    expect(fremd.statusCode).toBe(400);
    const gut = await app.inject({
      method: "POST",
      url: "/api/push/abo",
      headers: ada,
      payload: { endpoint: ENDPUNKT, keys: { p256dh: "p", auth: "a" } },
    });
    expect(gut.statusCode).toBe(200);

    const koId = await reicheEin(app, ada, "Druck ablassen");
    const zuweisung = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers: ada,
      payload: { action: "assign", userIds: [adaId] },
    });
    expect(zuweisung.statusCode).toBe(204);
    expect(gesendet.map((a) => [a.userId, a.endpoint])).toEqual([[adaId, ENDPUNKT]]);
    expect((services.mailer as ConsoleMailer).sent).toHaveLength(1);

    const ab = await app.inject({
      method: "POST",
      url: "/api/push/abo/entfernen",
      headers: ada,
      payload: { endpoint: ENDPUNKT },
    });
    expect(ab.statusCode).toBe(200);
    expect(await services.pushAbos.fuer(adaId)).toEqual([]);
    await app.close();
  });
});

describe("R-1655 · Routing beim Einreichen am Draht", () => {
  it("D2 · ohne benannte Prüfer geht das neue Objekt an die schnelle Prüferin des Themas — samt Mail und Push", async () => {
    const { services, app, ada, erik, adaId, gesendet } = await buehne();
    await app.inject({
      method: "POST",
      url: "/api/push/abo",
      headers: ada,
      payload: { endpoint: ENDPUNKT, keys: { p256dh: "p", auth: "a" } },
    });
    // Gelernt: Ada (Admin, darf bewerten) hat ein Hydraulik-Objekt gleich nach der Anlage geprüft.
    const frueher = await reicheEin(app, erik, "Früheres Hydraulikwissen");
    const bewertet = await app.inject({
      method: "PUT",
      url: `/api/kos/${frueher}`,
      headers: ada,
      payload: { action: "rate", verdict: "up" },
    });
    expect(bewertet.statusCode).toBe(200);

    const neu = await reicheEin(app, erik, "Neues Hydraulikwissen");
    expect(await services.validation.openAssignmentsFor(adaId)).toEqual([
      expect.objectContaining({ koId: neu }),
    ]);
    expect(gesendet.map((a) => a.userId)).toEqual([adaId]);
    expect((services.mailer as ConsoleMailer).sent.map((m) => m.to)).toEqual(["ada@r1655.test"]);

    const m = await app.inject({ method: "GET", url: "/api/validation/pruefdauer", headers: ada });
    expect(m.json().automatisch).toEqual({ erledigt: 0, offen: 1, medianStunden: null });
    await app.close();
  });

  it("D3 · Opt-out am eigenen Konto: danach wird Ada nicht mehr geroutet", async () => {
    const { services, app, ada, erik, adaId } = await buehne();
    const frueher = await reicheEin(app, erik, "Früheres Hydraulikwissen");
    await app.inject({
      method: "PUT",
      url: `/api/kos/${frueher}`,
      headers: ada,
      payload: { action: "rate", verdict: "up" },
    });
    const ab = await app.inject({
      method: "PUT",
      url: "/api/me/pruefrouting",
      headers: ada,
      payload: { optOut: true },
    });
    expect(ab.json()).toEqual({ optOut: true });
    const stand = await app.inject({ method: "GET", url: "/api/me/pruefrouting", headers: ada });
    expect(stand.json()).toEqual({ optOut: true });

    await reicheEin(app, erik, "Neues Hydraulikwissen");
    expect(await services.validation.openAssignmentsFor(adaId)).toEqual([]);

    const falsch = await app.inject({
      method: "PUT",
      url: "/api/me/pruefrouting",
      headers: ada,
      payload: { optOut: "ja" },
    });
    expect(falsch.statusCode).toBe(400);
    await app.close();
  });
});
