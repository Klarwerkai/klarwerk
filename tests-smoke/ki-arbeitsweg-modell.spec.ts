// ================================================================================================
// BPA-13 · AC10 — DER REALE, ERLAUBTE ANBIETERLAUF MIT VERBRAUCHSBELEG (Ben, Nacharbeit 5)
// ================================================================================================
//
// DER OFFENE BELEG: „Realer erlaubter KI-/Codex-Adapterweg und tatsächlicher Verbrauch werden
// getrennt von Promptentwurf, manueller Übergabe und Simulation belegt." Diese Sonde fährt genau
// den Produktweg des Klara-KI-Arbeitswegs gegen das echte Modell — über die Routen, die auch die
// Oberfläche ruft (`apps/web/src/api/kiArbeitsweg.ts`):
//   1. Grundfreigabe öffentlicher KI und Zuordnung der Aufgabe `assist` an Anthropic über den
//      vorhandenen Adminweg `PUT /api/reasoner/config` — am Ende auf den Vorher-Stand zurück.
//   2. Reale Verbindungsprobe (`POST /api/me/klara/ki-verbindung/anthropic/pruefen`, users.manage).
//   3. Synthetische, ausdrücklich interne Testquelle; eigenes Klara-Gespräch mit Objektbezug.
//   4. KI-Auftrag auf dem API-Weg mit ausdrücklicher Dokumentfreigabe → Übergabe.
//   5. Beleg: Antwort vom GEBUNDENEN Anbieter, Belegklasse `realer_adapterlauf` mit Laufkennung aus
//      dem Modelllauf-Protokoll, Modell und vom Anbieter gemeldetem Verbrauch.
//
// WANN SIE LÄUFT: nur im VOLLEN Smoke (`npm run smoke:ui`, Zugangsdatum ausschliesslich aus der
// Betreiber-Einspeisung KLARWERK_SHIP_SMOKE_API_KEY). Im hermetischen Tor ist sie über `@modell`
// ausgenommen und in `tests/smoke/tor-ausnahme.test.ts` benannt. Nur Chromium: sie prüft
// HTTP-Wege, keine Engine-Mechanik.
//
// WAS SIE NICHT IST: keine Menschenprobe der Oberfläche und keine Freigabe weiterer Anbieter oder
// Kosten — ein einziger kurzer Lauf über den vorhandenen, genehmigten Smoke-Zugang.
import { type APIRequestContext, expect, test } from "@playwright/test";
import { SMOKE_MAIL, SMOKE_PASS } from "./support/auth";

test.skip(({ browserName }) => browserName !== "chromium", "HTTP-Sonde — eine Engine genügt");

interface TaskConfig {
  global: string;
  perTask: Record<string, string>;
  kiFreigabe?: { oeffentlicheKi?: boolean; vertraulicheInhalte?: boolean };
}

interface Beleg {
  am: string;
  klasse: string;
  text: string;
  modell: string | null;
  anbieterAnfrageId: string | null;
  verbrauch: { einheit: string; menge: number } | "nicht_erfasst";
}

async function json<T>(
  antwort: Awaited<ReturnType<APIRequestContext["get"]>>,
  schritt: string,
): Promise<T> {
  const text = await antwort.text();
  expect(antwort.ok(), `${schritt}: HTTP ${antwort.status()} ${text.slice(0, 400)}`).toBe(true);
  return JSON.parse(text) as T;
}

test("KI-Arbeitsweg: realer gebundener Anbieterlauf mit Verbrauchsbeleg @modell", async ({
  request,
}, testInfo) => {
  const login = await json<{ token?: string }>(
    await request.post("/api/auth/login", { data: { email: SMOKE_MAIL, password: SMOKE_PASS } }),
    "Anmeldung",
  );
  expect(typeof login.token, "Anmeldung liefert ein Sitzungstoken").toBe("string");
  const auth = { authorization: `Bearer ${login.token}` };

  const vorher = (
    await json<{ taskConfig: TaskConfig }>(
      await request.get("/api/reasoner/config", { headers: auth }),
      "KI-Konfiguration lesen",
    )
  ).taskConfig;

  try {
    // 1. Grundfreigabe und Zuordnung von `assist` an den gewählten Anbieter.
    await json(
      await request.put("/api/reasoner/config", {
        headers: auth,
        data: {
          global: vorher.global,
          perTask: { ...vorher.perTask, assist: "anthropic" },
          kiFreigabe: {
            oeffentlicheKi: true,
            vertraulicheInhalte: vorher.kiFreigabe?.vertraulicheInhalte === true,
          },
        },
      }),
      "Grundfreigabe und Zuordnung",
    );

    // 2. Reale Verbindungsprobe — erst danach gilt der API-Weg als verbunden.
    const probe = await json<{ ok: boolean; detail: string }>(
      await request.post("/api/me/klara/ki-verbindung/anthropic/pruefen", { headers: auth }),
      "Verbindungsprobe",
    );
    expect(probe.ok, `Probe: ${probe.detail}`).toBe(true);
    const faehigkeiten = await json<{
      faehigkeiten: { faehigkeit: string; status: string; anbieter: string | null }[];
    }>(await request.get("/api/me/klara/ki-faehigkeiten", { headers: auth }), "Fähigkeiten");
    expect(faehigkeiten.faehigkeiten.find((f) => f.faehigkeit === "api")).toMatchObject({
      status: "verbunden",
      anbieter: "anthropic",
    });

    // 3. Synthetische, ausdrücklich interne Testquelle und eigenes Gespräch.
    const ko = await json<{ id: string }>(
      await request.post("/api/kos", {
        headers: auth,
        data: {
          title: "Synthetisches Preisblatt BPA-13",
          statement: "Der synthetische Listenpreis beträgt 120 EUR je Lizenz.",
          type: "best_practice",
          category: "Test",
          confidentiality: "intern",
          measures: ["Rabatt im synthetischen Testwerk erst ab 10 Lizenzen."],
        },
      }),
      "Testquelle anlegen",
    );
    const gespraech = await json<{ gespraech: { id: string } }>(
      await request.post("/api/me/klara/gespraeche", {
        headers: auth,
        data: {
          objektbezug: {
            pfad: "/wissen",
            seitenName: "Wissen",
            objekt: "Synthetisches Preisblatt",
            koId: ko.id,
          },
        },
      }),
      "Gespräch beginnen",
    );
    const gid = gespraech.gespraech.id;

    // 4. KI-Auftrag auf dem API-Weg, ausdrücklich freigegebene Quelle → Übergabe.
    const vorbereitet = await json<{ auftrag: { job: { jobId: string }; prompt: string } }>(
      await request.post(`/api/me/klara/gespraeche/${gid}/ki-auftraege`, {
        headers: auth,
        data: {
          ziel: "Fasse die synthetischen Preisbedingungen in zwei Stichpunkten zusammen",
          ergebnisformat: "stichpunkte",
          anbieter: "anthropic",
          faehigkeit: "api",
          quellen: [ko.id],
          freigegebeneQuellen: [ko.id],
        },
      }),
      "Auftrag vorbereiten",
    );
    expect(vorbereitet.auftrag.prompt).toContain("120 EUR je Lizenz");
    const jobId = vorbereitet.auftrag.job.jobId;
    const uebergabe = await json<{
      gesendet: boolean;
      text: string;
      sicht: {
        job: { status: string; sendungen: number; anbieter: string };
        antworten: {
          inhalt: string | null;
          anbieter: string;
          modell: string | null;
          weg: string;
        }[];
        belege: Beleg[];
      };
    }>(
      await request.post(`/api/me/klara/gespraeche/${gid}/ki-auftraege/${jobId}/uebergabe`, {
        headers: auth,
        data: {},
      }),
      "Übergabe",
    );

    // 5. Der Beleg — nur Kennungen, Modell, Verbrauch und synthetische Inhalte.
    const s = uebergabe.sicht;
    const beleg = s.belege.at(-1);
    await testInfo.attach("ki-arbeitsweg-anbieterlauf-beleg.json", {
      contentType: "application/json",
      body: JSON.stringify(
        {
          auftrag: "produkt:20261011:assistenz-ki-arbeitsbegleitung (BPA-13, AC10)",
          anbieter: "anthropic (gebunden, kein Ausweichweg)",
          probe,
          faehigkeiten: faehigkeiten.faehigkeiten,
          testquelle: ko.id,
          gespraech: gid,
          jobId,
          job: s.job,
          antwort: s.antworten.at(-1),
          beleg,
          hinweis: "synthetische Testdaten; Zugangsdatum nur über die Betreiber-Einspeisung",
        },
        null,
        2,
      ),
    });
    expect(uebergabe.gesendet, uebergabe.text).toBe(true);
    expect(s.job).toMatchObject({
      status: "antwort_erhalten",
      sendungen: 1,
      anbieter: "anthropic",
    });
    expect(s.antworten.at(-1)).toMatchObject({ weg: "api", anbieter: "anthropic" });
    expect(s.antworten.at(-1)?.inhalt ?? "").toMatch(/\S/);
    expect(beleg?.klasse, beleg?.text).toBe("realer_adapterlauf");
    expect(beleg?.anbieterAnfrageId, "Laufkennung aus dem Modelllauf-Protokoll").toMatch(/\S/);
    expect(beleg?.modell ?? "", "Modell benannt").toMatch(/\S/);
    expect(beleg?.verbrauch).toMatchObject({ einheit: "token" });
    expect(
      typeof beleg?.verbrauch === "object" ? beleg.verbrauch.menge : 0,
      "vom Anbieter gemeldeter Verbrauch",
    ).toBeGreaterThan(0);
  } finally {
    // Aufräumen auf demselben geteilten Bestand: Zuordnung und Freigabe zurück.
    await request.put("/api/reasoner/config", {
      headers: auth,
      data: {
        global: vorher.global,
        perTask: vorher.perTask,
        kiFreigabe: {
          oeffentlicheKi: vorher.kiFreigabe?.oeffentlicheKi === true,
          vertraulicheInhalte: vorher.kiFreigabe?.vertraulicheInhalte === true,
        },
      },
    });
  }
});
