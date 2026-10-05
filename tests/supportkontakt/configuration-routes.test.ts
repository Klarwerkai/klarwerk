// ================================================================================================
// R-1064 · SUPPORTKONTAKT — DIE BETREIBERKONFIGURATION AN DER ECHTEN APP.
// ================================================================================================
//
// WAS HIER ECHT IST: `buildApp(buildServices())` mit der echten Verdrahtung aus `build-app.ts`, die
// echte Route `GET /api/support`, die echte Anmeldung. Gesetzt werden ausschliesslich die zwei
// gewählten Betreiberwerte KLARWERK_SUPPORT_URL / KLARWERK_SUPPORT_LABEL — VOR dem Aufbau, und
// danach sofort zurückgestellt. Dass die Antwort trotzdem stimmt, belegt nebenbei, dass die App
// ihren Stand beim Aufbau festhält (Fall R6).
//
// DIE ZIELE SIND SYNTHETISCH: alle unter der reservierten Endung `.invalid` (RFC 2606). Sie
// beschreiben keinen echten Support, keine erreichbare Adresse und keine Zuständigkeit — sie
// belegen nur, dass jede Installation GENAU IHREN Wert ausliefert.
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { supportKontaktAusUmgebung } from "../../services/app/src/routes/support-routes";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

const URL_NAME = "KLARWERK_SUPPORT_URL";
const LABEL_NAME = "KLARWERK_SUPPORT_LABEL";

const A = {
  url: "https://support-a.invalid/servicedesk?quelle=klarwerk",
  label: "Servicedesk A (Testziel)",
};
const B = { url: "mailto:support-b@kunde-b.invalid" };

const offen: App[] = [];

afterEach(async () => {
  for (const app of offen.splice(0)) {
    await app.close();
  }
});

/** Setzt die zwei Werte, baut die App, stellt die Umgebung SOFORT wieder her. */
async function installation(werte: { url?: string; label?: string }): Promise<App> {
  const vorher = { url: process.env[URL_NAME], label: process.env[LABEL_NAME] };
  const setze = (name: string, wert: string | undefined): void => {
    if (wert === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = wert;
    }
  };
  setze(URL_NAME, werte.url);
  setze(LABEL_NAME, werte.label);
  let app: App;
  try {
    app = buildApp(buildServices());
  } finally {
    setze(URL_NAME, vorher.url);
    setze(LABEL_NAME, vorher.label);
  }
  offen.push(app);
  await app.ready();
  return app;
}

async function login(app: App, email: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "geheim12345" },
  });
  expect(res.statusCode, res.body).toBe(200);
  return { authorization: `Bearer ${res.json().token}` };
}

/** Erstkonto (Administrator) und eine Betrachterin — die kleinste Rolle, die die Hilfe sieht. */
async function konten(app: App): Promise<{ admin: Auth; betrachterin: Auth }> {
  const marke = Math.random().toString(36).slice(2, 8);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada", email: `ada@${marke}.test`, password: "geheim12345" },
  });
  const admin = await login(app, `ada@${marke}.test`);
  const neu = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: { name: "Vera", email: `vera@${marke}.test`, password: "geheim12345", role: "viewer" },
  });
  expect(neu.statusCode, neu.body).toBe(201);
  return { admin, betrachterin: await login(app, `vera@${marke}.test`) };
}

async function supportAntwort(app: App, wer?: Auth): Promise<{ status: number; body: string }> {
  const res = await app.inject({
    method: "GET",
    url: "/api/support",
    ...(wer ? { headers: wer } : {}),
  });
  return { status: res.statusCode, body: res.body };
}

describe("R-1064 · GET /api/support an der echten App", () => {
  it("R1: ohne Konfiguration startet die App und meldet ehrlich „nicht_eingerichtet“", async () => {
    const app = await installation({});
    const { betrachterin } = await konten(app);
    const antwort = await supportAntwort(app, betrachterin);
    expect(antwort.status).toBe(200);
    expect(JSON.parse(antwort.body)).toEqual({ zustand: "nicht_eingerichtet" });
  });

  it("R2: zwei Installationen, zwei Werte — jede liefert GENAU ihren eigenen Kontakt", async () => {
    const appA = await installation(A);
    const appB = await installation(B);
    const a = await supportAntwort(appA, (await konten(appA)).betrachterin);
    const b = await supportAntwort(appB, (await konten(appB)).betrachterin);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(JSON.parse(a.body)).toEqual({
      zustand: "eingerichtet",
      art: "https",
      ziel: A.url,
      anzeige: A.url,
      bezeichnung: A.label,
    });
    expect(JSON.parse(b.body)).toEqual({
      zustand: "eingerichtet",
      art: "mailto",
      ziel: B.url,
      anzeige: "support-b@kunde-b.invalid",
      bezeichnung: null,
    });
    // Keine Installation kennt den Wert der anderen.
    expect(a.body).not.toContain("kunde-b");
    expect(b.body).not.toContain("support-a");
  });

  it("R3: Lesen verlangt eine Anmeldung, aber KEIN Adminrecht", async () => {
    const app = await installation(A);
    const { admin, betrachterin } = await konten(app);
    expect((await supportAntwort(app)).status, "ohne Sitzung").toBe(401);
    const alsBetrachterin = await supportAntwort(app, betrachterin);
    const alsAdmin = await supportAntwort(app, admin);
    expect(alsBetrachterin.status, "Betrachterin wird abgewiesen").toBe(200);
    expect(alsBetrachterin.body, "die Rolle verändert den Kontakt").toBe(alsAdmin.body);
  });

  it("R4: javascript: und data: werden an der echten App abgewiesen — der Rohwert geht nicht hinaus", async () => {
    for (const roh of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>"]) {
      const app = await installation({ url: roh, label: "Hilfe" });
      const antwort = await supportAntwort(app, (await konten(app)).betrachterin);
      expect(antwort.status).toBe(200);
      expect(JSON.parse(antwort.body), roh).toEqual({ zustand: "ungueltig" });
      expect(antwort.body).not.toContain("alert");
      expect(antwort.body).not.toContain("script");
    }
  });

  it("R5: die Antwort trägt nur den freigegebenen Kontakt — keine Umgebungsnamen, keine Fremdwerte", async () => {
    const app = await installation(A);
    const antwort = await supportAntwort(app, (await konten(app)).betrachterin);
    const body = JSON.parse(antwort.body) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["anzeige", "art", "bezeichnung", "ziel", "zustand"]);
    expect(antwort.body).not.toMatch(/KLARWERK_|DATABASE|SECRET|TOKEN/i);
  });

  it("R6: der Wert wird beim Aufbau gelesen — spätere Änderungen der Umgebung wirken erst neu gebaut", async () => {
    const app = await installation(A);
    const wer = (await konten(app)).betrachterin;
    const vorher = process.env[URL_NAME];
    process.env[URL_NAME] = "https://andere.invalid/";
    try {
      expect(JSON.parse((await supportAntwort(app, wer)).body).ziel).toBe(A.url);
    } finally {
      if (vorher === undefined) {
        delete process.env[URL_NAME];
      } else {
        process.env[URL_NAME] = vorher;
      }
    }
  });
});

describe("R-1064 · die Prüfung der Betreiberwerte (dieselbe Funktion, die buildApp ruft)", () => {
  const ungueltig: [string, Record<string, string>][] = [
    ["javascript:", { [URL_NAME]: "javascript:alert(1)" }],
    ["JAVASCRIPT: grossgeschrieben", { [URL_NAME]: "JavaScript:alert(1)" }],
    ["data:", { [URL_NAME]: "data:text/html;base64,PHNjcmlwdD4=" }],
    ["http: ohne TLS", { [URL_NAME]: "http://support.invalid/" }],
    ["schemalos", { [URL_NAME]: "//support.invalid/hilfe" }],
    ["relativer Pfad", { [URL_NAME]: "/hilfe" }],
    ["ftp:", { [URL_NAME]: "ftp://support.invalid/" }],
    ["Zugangsdaten in der URL", { [URL_NAME]: "https://nutzer:kennwort@support.invalid/" }],
    ["mailto mit Kopfzeile", { [URL_NAME]: "mailto:a@support.invalid?bcc=b@fremd.invalid" }],
    ["mailto mit Liste", { [URL_NAME]: "mailto:a@support.invalid,b@fremd.invalid" }],
    ["mailto ohne Adresse", { [URL_NAME]: "mailto:" }],
    ["mailto ohne Domainpunkt", { [URL_NAME]: "mailto:a@localhost" }],
    ["Leerzeichen im Ziel", { [URL_NAME]: "https://support.invalid/a b" }],
    ["Steuerzeichen im Ziel", { [URL_NAME]: "https://support.invalid/\u0007" }],
    ["Ziel über 500 Zeichen", { [URL_NAME]: `https://support.invalid/${"x".repeat(500)}` }],
    // Ben F1: 104 Zeichen roh, 504 Zeichen normalisiert (jedes „ä" wird `%C3%A4`).
    [
      "normalisiertes Ziel über 500 Zeichen",
      { [URL_NAME]: `https://support.invalid/${"ä".repeat(80)}` },
    ],
    ["Bezeichnung über 80 Zeichen", { [URL_NAME]: A.url, [LABEL_NAME]: "x".repeat(81) }],
    [
      "Bezeichnung mit Richtungsumkehr (U+202E)",
      { [URL_NAME]: A.url, [LABEL_NAME]: `Hilfe${String.fromCodePoint(0x202e)}` },
    ],
  ];

  for (const [fall, env] of ungueltig) {
    it(`U: ${fall} → ungueltig, ohne Rohwert`, () => {
      const ergebnis = supportKontaktAusUmgebung(env);
      expect(ergebnis).toEqual({ zustand: "ungueltig" });
    });
  }

  it("leer oder nur Leerraum heisst „nicht_eingerichtet“ — nicht „ungueltig“", () => {
    expect(supportKontaktAusUmgebung({})).toEqual({ zustand: "nicht_eingerichtet" });
    expect(supportKontaktAusUmgebung({ [URL_NAME]: "   " })).toEqual({
      zustand: "nicht_eingerichtet",
    });
    // Eine Bezeichnung ohne Ziel macht noch keinen Kontakt.
    expect(supportKontaktAusUmgebung({ [LABEL_NAME]: "Servicedesk" })).toEqual({
      zustand: "nicht_eingerichtet",
    });
  });

  it("gültige Formen werden normalisiert ausgeliefert", () => {
    expect(supportKontaktAusUmgebung({ [URL_NAME]: "  MAILTO:hilfe@kunde.invalid  " })).toEqual({
      zustand: "eingerichtet",
      art: "mailto",
      ziel: "mailto:hilfe@kunde.invalid",
      anzeige: "hilfe@kunde.invalid",
      bezeichnung: null,
    });
    expect(
      supportKontaktAusUmgebung({
        [URL_NAME]: "HTTPS://Support.Kunde.invalid",
        [LABEL_NAME]: "  IT-Servicedesk ",
      }),
    ).toEqual({
      zustand: "eingerichtet",
      art: "https",
      ziel: "https://support.kunde.invalid/",
      anzeige: "https://support.kunde.invalid/",
      bezeichnung: "IT-Servicedesk",
    });
  });
});
