// ================================================================================================
// AUFTRAG-mega61 BLOCK C + D — DER VERMERK AM KONTO, UND DASS EINE ABLEHNUNG WIRKLICH WIRKT.
// ================================================================================================
//
// BLOCK C prüft, was der Banner voraussetzt: dass die Kenntnisnahme SERVERSEITIG am Konto liegt.
// Im Browserspeicher zu merken, dass jemand den Hinweis ÜBER den Browserspeicher gelesen hat, wäre
// zirkulär, und beim Gerätewechsel wäre die Quittung weg.
//
// BLOCK D prüft die einzige Zusage dieses Auftrags, die eine Oberfläche gar nicht belegen KANN:
// dass nach „Nicht einverstanden" die Sitzung wirklich beendet ist und eine geschützte Route
// danach abgewiesen wird. Ohne diesen Beleg wäre die Erklärung im Banner eine Behauptung.
import { describe, expect, it } from "vitest";
import { buildApp } from "../../services/app/src/build-app";
import { HINWEIS_TEXT_VERSION } from "../../services/auth/src/notice";

type App = ReturnType<typeof buildApp>;

async function angemeldet(app: App, email = "n@x.de"): Promise<{ authorization: string }> {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Nutzerin", email, password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
}

async function vermerkLesen(
  app: App,
  headers: { authorization: string },
): Promise<Record<string, unknown>> {
  const res = await app.inject({ method: "GET", url: "/api/auth/notice", headers });
  expect(res.statusCode).toBe(200);
  return res.json() as Record<string, unknown>;
}

describe("mega61 C · die Kenntnisnahme am Konto", () => {
  it("ein Konto OHNE Vermerk sieht den Hinweis", async () => {
    const app = buildApp();
    const headers = await angemeldet(app);
    const vermerk = await vermerkLesen(app, headers);
    expect(vermerk.due).toBe(true);
    expect(vermerk.currentVersion).toBe(HINWEIS_TEXT_VERSION);
    // Kein Vermerk heißt WIRKLICH kein Vermerk — keine vorgetäuschte Quittung.
    expect(vermerk.acknowledgedVersion).toBeUndefined();
    expect(vermerk.acknowledgedAt).toBeUndefined();
    await app.close();
  });

  it("setzen und lesen: die Quittung trägt Zeitpunkt UND gelesene Fassung", async () => {
    const app = buildApp();
    const headers = await angemeldet(app);
    const gesetzt = await app.inject({ method: "POST", url: "/api/auth/notice", headers });
    expect(gesetzt.statusCode).toBe(200);

    const vermerk = await vermerkLesen(app, headers);
    expect(vermerk.due).toBe(false);
    expect(vermerk.acknowledgedVersion).toBe(HINWEIS_TEXT_VERSION);
    // Der Zeitstempel ist echt und lesbar — nicht bloß vorhanden.
    expect(typeof vermerk.acknowledgedAt).toBe("string");
    expect(Number.isNaN(Date.parse(String(vermerk.acknowledgedAt)))).toBe(false);
    await app.close();
  });

  it("VERSIONSWECHSEL: eine alte Fassung lässt den Hinweis wieder erscheinen", async () => {
    // Die Fassung wird nicht simuliert, sondern über die ECHTE Auswertungsregel geprüft: was der
    // Server als „fällig" liefert, entscheidet allein der Vergleich mit HINWEIS_TEXT_VERSION.
    const { hinweisFaellig } = await import("../../services/auth/src/notice");
    expect(hinweisFaellig(undefined)).toBe(true); // nie quittiert
    expect(hinweisFaellig("2000-01-01.1")).toBe(true); // alte Fassung → wieder fragen
    expect(hinweisFaellig(HINWEIS_TEXT_VERSION)).toBe(false); // aktuelle Fassung → Ruhe

    // Und die Route benutzt genau diese Regel, statt eine zweite zu führen.
    const app = buildApp();
    const headers = await angemeldet(app);
    await app.inject({ method: "POST", url: "/api/auth/notice", headers });
    expect((await vermerkLesen(app, headers)).due).toBe(false);
    await app.close();
  });

  it("die Kenntnisnahme ist nur die EIGENE — ohne Anmeldung geht gar nichts", async () => {
    const app = buildApp();
    expect((await app.inject({ method: "GET", url: "/api/auth/notice" })).statusCode).toBe(401);
    expect((await app.inject({ method: "POST", url: "/api/auth/notice" })).statusCode).toBe(401);
    await app.close();
  });

  it("das Setzen steht im Prüfprotokoll — mit der Fassung, ohne IP und Browserkennung", async () => {
    const app = buildApp();
    const headers = await angemeldet(app);
    await app.inject({ method: "POST", url: "/api/auth/notice", headers });
    const audit = await app.inject({ method: "GET", url: "/api/audit", headers });
    expect(audit.statusCode).toBe(200);
    const roh = audit.body;
    expect(roh).toContain("notice.acknowledged");
    expect(roh).toContain(HINWEIS_TEXT_VERSION);
    // Die Grenze, die das Protokoll ohnehin zieht, gilt auch hier.
    expect(roh.toLowerCase()).not.toContain("user-agent");
    expect(roh).not.toContain("127.0.0.1");
    await app.close();
  });
});

describe("mega61 D · nach „Nicht einverstanden“ ist die Sitzung wirklich beendet", () => {
  it("KLICKPFAD-BELEG: nach dem Abmelden wird eine geschützte Route abgewiesen", async () => {
    const app = buildApp();
    const headers = await angemeldet(app);

    // Kalibrierung: VORHER geht die geschützte Route. Ohne diesen Schritt bewiese der Rest nichts —
    // ein 401 nach dem Abmelden wäre auch dann grün, wenn die Route generell nicht ginge.
    const vorher = await app.inject({ method: "GET", url: "/api/auth/me", headers });
    expect(vorher.statusCode).toBe(200);

    // Genau der Weg, den der Banner benutzt: der EINE vorhandene Abmeldeweg. Kein zweiter.
    const abmelden = await app.inject({ method: "POST", url: "/api/auth/logout", headers });
    expect(abmelden.statusCode).toBe(204);
    // Und das Cookie wird gelöscht — ohne es ist eine angemeldete Nutzung technisch unmöglich,
    // und genau das sagt der Banner der Nutzerin vorher.
    expect(String(abmelden.headers["set-cookie"])).toContain("Max-Age=0");

    const nachher = await app.inject({ method: "GET", url: "/api/auth/me", headers });
    expect(nachher.statusCode).toBe(401);
    // Auch die Kenntnisnahme selbst ist danach unerreichbar — die Sitzung ist wirklich weg.
    const vermerk = await app.inject({ method: "GET", url: "/api/auth/notice", headers });
    expect(vermerk.statusCode).toBe(401);
    await app.close();
  });
});
