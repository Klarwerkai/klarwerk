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

  // produkt:20261013:lagebild-reale-werte-eingabe (LWE-03/LWE-07): die realen Lagebild-Werte samt
  // Herkunft und Beleg bleiben in ihrer Instanz — weder lesbar noch schreibbar von der anderen.
  // Alle Werte und Belege sind erfundene Testdaten.
  it("M4 · Lagebild-Werte und ihre Herkunft von Kunde A sind bei Kunde B weder lesbar noch schreibbar", async () => {
    const kundeA = await kundenInstanz("admin@kunde-a.example", "kunde-a-geheim-1");
    const kundeB = await kundenInstanz("admin@kunde-b.example", "kunde-b-geheim-1");
    const URL = "/api/management/lagebild-werte";
    const BELEG_A = "Zeiterfassung Kunde A Q3 (erfunden)";
    const eingabe = (stundensatz: number, beleg: string, anfrageId: string) => ({
      zeitraumVon: "2025-07-01",
      zeitraumBis: "2025-09-30",
      werte: {
        hourlyRate: { wert: stundensatz, herkunft: "eigene_eingabe" },
        hoursSavedPerValidatedKo: { wert: 1.5, herkunft: "gemessen", beleg },
        reuseFactor: { wert: 4, herkunft: "eigene_eingabe" },
      },
      basisVersion: 0,
      anfrageId,
    });
    type Bereich = {
      bereich: string;
      werte: null | {
        version: number;
        werte: { hourlyRate: { wert: number }; hoursSavedPerValidatedKo: { beleg: string } };
      };
    };
    const gesamtVon = async (kunde: Kunde) => {
      const res = await kunde.app.inject({ method: "GET", url: URL, headers: kunde.headers });
      expect(res.statusCode, res.body).toBe(200);
      return {
        roh: res.body,
        gesamt: (res.json().bereiche as Bereich[]).find((b) => b.bereich === "gesamt"),
      };
    };

    const beiAGesetzt = await kundeA.app.inject({
      method: "PUT",
      url: `${URL}/gesamt`,
      headers: kundeA.headers,
      payload: eingabe(72.5, BELEG_A, "mandant-a-0001"),
    });
    expect(beiAGesetzt.statusCode, beiAGesetzt.body).toBe(200);
    // KALIBRIERUNG: bei A ist der Stand samt Herkunft wirklich gespeichert.
    const a = await gesamtVon(kundeA);
    expect(a.gesamt?.werte?.version).toBe(1);
    expect(a.gesamt?.werte?.werte.hoursSavedPerValidatedKo.beleg).toBe(BELEG_A);

    // B liest nichts von A — weder Wert noch Beleg.
    const b = await gesamtVon(kundeB);
    expect(b.gesamt?.werte).toBeNull();
    expect(b.roh).not.toContain(BELEG_A);
    expect(b.roh).not.toContain("mandant-a-0001");

    // Die Sitzung von A öffnet bei B weder Lesen noch Schreiben.
    const fremdLesen = await kundeB.app.inject({
      method: "GET",
      url: URL,
      headers: kundeA.headers,
    });
    expect(fremdLesen.statusCode).toBe(401);
    const fremdSchreiben = await kundeB.app.inject({
      method: "PUT",
      url: `${URL}/gesamt`,
      headers: kundeA.headers,
      payload: eingabe(99, "Fremdschreibversuch (erfunden)", "mandant-a-0002"),
    });
    expect(fremdSchreiben.statusCode).toBe(401);
    expect((await gesamtVon(kundeB)).gesamt?.werte).toBeNull();

    // B pflegt eigene Werte: eigener Stand 1, unberührt vom Stand bei A — und A bleibt, wie er war.
    const beiBGesetzt = await kundeB.app.inject({
      method: "PUT",
      url: `${URL}/gesamt`,
      headers: kundeB.headers,
      payload: eingabe(55, "Auswertung Kunde B (erfunden)", "mandant-b-0001"),
    });
    expect(beiBGesetzt.statusCode, beiBGesetzt.body).toBe(200);
    expect(beiBGesetzt.json().eintrag.version).toBe(1);
    const aNachher = await gesamtVon(kundeA);
    expect(aNachher.gesamt?.werte?.werte.hourlyRate.wert).toBe(72.5);
    expect(aNachher.gesamt?.werte?.werte.hoursSavedPerValidatedKo.beleg).toBe(BELEG_A);
    expect(aNachher.roh).not.toContain("Auswertung Kunde B");
  });
});
