// ================================================================================================
// AUFNAHME 20260922 · gesamt-reasoner-vertrag — R-2055 / NFR-MNT-03: MANDANTEN SEHEN KEINE FREMDEN
// DATEN, UND IHRE KI-KONFIGURATION IST JE KUNDE GETRENNT.
// ================================================================================================
//
// Originalwortlaut: „/03 — austauschbarer Reasoner, Mandantenfähigkeit." — Pflichtenheft NFR-MNT-03:
// „Mandantenfähigkeit (Daten-/Konfigurationsisolation pro Kunde). AK: Mandanten sehen keine fremden
// Daten."
//
// DAS MANDANTENMODELL DES PRODUKTS ist festgelegt und wird hier nicht neu entschieden: ein Kunde =
// ein Deployment mit eigenem Datenbestand (`services/app/src/addon-principal.ts:25-29`; der Satz
// „zwei Sätze sind zwei Datenbanken" an `inMemoryRepos`, `build-app.ts`). Die Instanzgrenze IST die
// Mandantengrenze. Bis hierher war diese Zusage nur behauptet — dieser Test misst sie: zwei
// vollständige Instanzen (`buildApp(buildServices())`, je ein eigener Repo-Satz) über die ECHTEN
// HTTP-Routen, und keine sieht Daten, Anmeldung oder KI-Zuordnung der anderen.
//
// WARUM IN EINEM PROZESS: im Betrieb laufen die Kunden in getrennten Prozessen. Zwei Instanzen im
// selben Prozess sind die strengere Probe — ein geteilter Modulzustand, der die Grenze unterliefe,
// fiele hier auf und nicht erst im Betrieb.
//
// AUSDRÜCKLICH NICHT GEPRÜFT, weil nicht gebaut: mehrere Kunden in EINER Instanz mit erzwungener
// Trennung je Anfrage. Das ist eine andere Architektur (dort als „v2/SSO" geführt) und keine
// Entscheidung, die dieser Test trifft.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

interface Kunde {
  app: App;
  headers: Record<string, string>;
  email: string;
  kennwort: string;
}

/** Eine eigene Kunden-Instanz mit eigenem Administrator. */
async function kundenInstanz(email: string, kennwort: string): Promise<Kunde> {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email, password: kennwort },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: kennwort },
  });
  expect(login.statusCode).toBe(200);
  return { app, headers: { authorization: `Bearer ${login.json().token}` }, email, kennwort };
}

async function koIds(kunde: Kunde): Promise<string[]> {
  const res = await kunde.app.inject({ method: "GET", url: "/api/kos", headers: kunde.headers });
  expect(res.statusCode).toBe(200);
  return (res.json() as { id: string }[]).map((ko) => ko.id);
}

describe("R-2055 / NFR-MNT-03: die Instanz ist die Mandantengrenze", () => {
  it("M1 · Kunde B sieht keines der Wissensobjekte von Kunde A", async () => {
    const kundeA = await kundenInstanz("admin@kunde-a.example", "kunde-a-geheim-1");
    const kundeB = await kundenInstanz("admin@kunde-b.example", "kunde-b-geheim-1");

    await kundeA.app.inject({
      method: "POST",
      url: "/api/admin/demo-seed",
      headers: kundeA.headers,
    });
    const beiA = await koIds(kundeA);
    // KALIBRIERUNG: ohne Bestand bei A bewiese die Leere bei B nichts.
    expect(beiA.length).toBeGreaterThan(0);

    const beiB = await koIds(kundeB);
    expect(beiB.filter((id) => beiA.includes(id))).toEqual([]);

    // Auch der gezielte Abruf einer fremden Kennung findet bei B nichts.
    const fremd = await kundeB.app.inject({
      method: "GET",
      url: `/api/kos/${beiA[0]}`,
      headers: kundeB.headers,
    });
    expect(fremd.statusCode).not.toBe(200);
  });

  it("M2 · Anmeldung und Sitzung von Kunde A gelten bei Kunde B nicht", async () => {
    const kundeA = await kundenInstanz("admin@kunde-a.example", "kunde-a-geheim-1");
    const kundeB = await kundenInstanz("admin@kunde-b.example", "kunde-b-geheim-1");

    // Die Sitzung von A öffnet bei B nichts.
    const mitFremderSitzung = await kundeB.app.inject({
      method: "GET",
      url: "/api/kos",
      headers: kundeA.headers,
    });
    expect(mitFremderSitzung.statusCode).toBe(401);

    // Das Konto von A existiert bei B nicht.
    const fremdesKonto = await kundeB.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: kundeA.email, password: kundeA.kennwort },
    });
    expect(fremdesKonto.statusCode).not.toBe(200);

    // Gegenprobe: bei A selbst gilt sie weiter.
    const eigene = await kundeA.app.inject({
      method: "GET",
      url: "/api/kos",
      headers: kundeA.headers,
    });
    expect(eigene.statusCode).toBe(200);
  });

  it("M3 · die KI-Zuordnung von Kunde A verändert die von Kunde B nicht", async () => {
    const kundeA = await kundenInstanz("admin@kunde-a.example", "kunde-a-geheim-1");
    const kundeB = await kundenInstanz("admin@kunde-b.example", "kunde-b-geheim-1");

    const gesetzt = await kundeA.app.inject({
      method: "PUT",
      url: "/api/reasoner/config",
      headers: kundeA.headers,
      payload: { global: "deterministic", perTask: { assist: "local" } },
    });
    expect(gesetzt.statusCode).toBe(200);

    const beiA = await kundeA.app.inject({
      method: "GET",
      url: "/api/reasoner/config",
      headers: kundeA.headers,
    });
    expect(beiA.json().taskConfig).toEqual({
      global: "deterministic",
      perTask: { assist: "local" },
    });
    expect(beiA.json().policySource).toBe("db");

    const beiB = await kundeB.app.inject({
      method: "GET",
      url: "/api/reasoner/config",
      headers: kundeB.headers,
    });
    expect(beiB.statusCode).toBe(200);
    expect(beiB.json().taskConfig).toEqual({ global: "auto", perTask: {} });
    expect(beiB.json().policySource).toBe("default");

    // Und umgekehrt: was B danach einstellt, erreicht A nicht.
    await kundeB.app.inject({
      method: "PUT",
      url: "/api/reasoner/config",
      headers: kundeB.headers,
      payload: { global: "local", perTask: {} },
    });
    const nochmalA = await kundeA.app.inject({
      method: "GET",
      url: "/api/reasoner/config",
      headers: kundeA.headers,
    });
    expect(nochmalA.json().taskConfig.global).toBe("deterministic");
  });
});
