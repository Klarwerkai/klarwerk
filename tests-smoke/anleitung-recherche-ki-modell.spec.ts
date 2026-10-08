// AUFTRAG aufnahme:20260922:gesamt-dokumenterzeugung — Nacharbeit 10 (Bens Prüfbefund).
//
// DER OFFENE BELEG: ein kandidatengleicher Durchlauf von Recherche und KI-Entwurf mit wirksamer
// Testdokumenteinwilligung, tatsächlicher Modellantwort und nachvollziehbarer Herkunft. Der
// Kandidaten-Preflight (HILFE/7809be1b…/KANDIDATEN-PREFLIGHT.json) stand vor zwei Schritten still:
// `policy_incomplete` (keine zentrale Freigabe öffentlicher KI) und `externalConsentGranted=false`.
//
// DIESE SONDE VERVOLLSTÄNDIGT DIE VORBEREITUNG ÜBER DIE BESTEHENDEN WEGE und fährt dann genau die
// Aufrufe, die das Word-Panel (`apps/web/public/word-addin/anleitung.js`) macht:
//   1. Adminfreigabe öffentlicher KI über `PUT /api/reasoner/config` (`kiFreigabe`, protokolliert;
//      Zuordnung global/je Aufgabe unverändert) — am Ende auf den Vorher-Stand zurückgesetzt.
//   2. Synthetische, validierte Testquelle (`POST /api/kos`, `admin-validate`).
//   3. Klara-Sitzung für ein SYNTHETISCHES API-Testdokument — keine echte Word-Datei.
//   4. Einwilligung für genau diese Sitzung und dieses Dokument (`POST …/consent`) — am Ende
//      widerrufen (`DELETE …/consent`).
//   5. Recherche wie `anleitungRecherche`: `POST /api/ask` mit `questionSource: "manual"`, `thread`.
//   6. KI-Entwurf wie `anleitungKiEntwurf`: `POST /api/klara/sessions/{id}/zuruf`, `art: erstellen`.
//
// WANN SIE LÄUFT: nur im VOLLEN Smoke (`npm run smoke:ui`, Modell ausschliesslich aus
// KLARWERK_SHIP_SMOKE_API_KEY). Im hermetischen Tor (`smoke:ui:gate`) ist sie über `@modell`
// ausgenommen — benannt in `tests/smoke/tor-ausnahme.test.ts`. Nur Chromium: sie prüft HTTP-Wege,
// keine Engine-Mechanik; mehrere Engines hiessen mehrere Freigaben und Einwilligungen auf demselben
// geteilten Bestand.
//
// WAS SIE NICHT ERSETZT: die Realabnahme in Word Web (Menschenprobe) und eine Einwilligung für ein
// echtes Dokument — die bleibt beim berechtigten Nutzer.
import { type APIRequestContext, expect, test } from "@playwright/test";
import { SMOKE_MAIL, SMOKE_PASS } from "./support/auth";

test.skip(({ browserName }) => browserName !== "chromium", "HTTP-Sonde — eine Engine genügt");

const INSTANZ = "smoke-anleitung-instanz";
const DOKUMENT = "smoke-anleitung-synthetisches-testdokument";
const FRAGE = "Was gilt vor einer synthetischen Prüfung für den blauen Testhebel?";

interface TaskConfig {
  global: string;
  perTask: Record<string, string>;
  kiFreigabe?: { oeffentlicheKi?: boolean; vertraulicheInhalte?: boolean };
}

async function json<T>(
  antwort: Awaited<ReturnType<APIRequestContext["get"]>>,
  schritt: string,
): Promise<T> {
  const text = await antwort.text();
  expect(antwort.ok(), `${schritt}: HTTP ${antwort.status()} ${text.slice(0, 300)}`).toBe(true);
  return JSON.parse(text) as T;
}

test("Anleitung: Recherche und KI-Entwurf mit Einwilligung, echter Modellantwort und Herkunft @modell", async ({
  request,
}, testInfo) => {
  const login = await json<{ token?: string }>(
    await request.post("/api/auth/login", { data: { email: SMOKE_MAIL, password: SMOKE_PASS } }),
    "Anmeldung",
  );
  expect(typeof login.token, "Anmeldung liefert ein Sitzungstoken").toBe("string");
  const auth = { authorization: `Bearer ${login.token}` };

  const vorher = await json<{ taskConfig: TaskConfig }>(
    await request.get("/api/reasoner/config", { headers: auth }),
    "KI-Konfiguration lesen",
  );
  const zuordnung = { global: vorher.taskConfig.global, perTask: vorher.taskConfig.perTask };
  const freigabeVorher = {
    oeffentlicheKi: vorher.taskConfig.kiFreigabe?.oeffentlicheKi === true,
    vertraulicheInhalte: vorher.taskConfig.kiFreigabe?.vertraulicheInhalte === true,
  };

  let sitzung: { sessionId: string; documentContextId: string } | null = null;
  let gebunden: Record<string, string> = {};
  try {
    // 1. Adminfreigabe öffentlicher KI — nur dieser Schalter, die Zuordnung bleibt.
    await json(
      await request.put("/api/reasoner/config", {
        headers: auth,
        data: { ...zuordnung, kiFreigabe: { ...freigabeVorher, oeffentlicheKi: true } },
      }),
      "Adminfreigabe öffentlicher KI",
    );

    // 2. Synthetische, validierte Testquelle.
    const ko = await json<{ id: string }>(
      await request.post("/api/kos", {
        headers: auth,
        data: {
          title: "Synthetische Testhebelprüfung",
          statement: "Vor jeder synthetischen Prüfung den blauen Testhebel in Stellung A bringen.",
          type: "best_practice",
          category: "Test",
          confidentiality: "intern",
          conditions: ["Nur im synthetischen Testwerk"],
          measures: ["Testhebel auf Stellung A stellen."],
          neededValidations: 1,
        },
      }),
      "Testquelle anlegen",
    );
    await json(
      await request.put(`/api/kos/${ko.id}`, { headers: auth, data: { action: "admin-validate" } }),
      "Testquelle validieren",
    );
    const quelle = await json<{ status: string; version: number; title: string }>(
      await request.get(`/api/kos/${ko.id}`, { headers: auth }),
      "Testquelle lesen",
    );
    expect(quelle.status).toBe("validiert");

    // 3. Sitzung für das synthetische Testdokument.
    sitzung = await json<{ sessionId: string; documentContextId: string }>(
      await request.post("/api/klara/sessions", {
        headers: auth,
        data: {
          addinInstanceId: INSTANZ,
          documentDescriptor: { kind: "saved", hostDocumentId: DOKUMENT },
        },
      }),
      "Klara-Sitzung",
    );
    gebunden = {
      ...auth,
      "x-klara-session": sitzung.sessionId,
      "x-klara-instance": INSTANZ,
      "x-klara-document": sitzung.documentContextId,
    };
    const ohneEinwilligung = await json<Record<string, unknown>>(
      await request.get("/api/klara/ai-status", { headers: gebunden }),
      "KI-Status vor der Einwilligung",
    );
    // Mit Freigabe bleibt allein die Einwilligung offen — kein `policy_incomplete` mehr.
    expect(ohneEinwilligung.blockedReason, JSON.stringify(ohneEinwilligung)).toBe(
      "external_consent_missing",
    );

    // 4. Einwilligung für genau diese Sitzung und dieses Dokument.
    await json(
      await request.post(`/api/klara/sessions/${sitzung.sessionId}/consent`, { headers: gebunden }),
      "Einwilligung",
    );
    const mitEinwilligung = await json<Record<string, unknown>>(
      await request.get("/api/klara/ai-status", { headers: gebunden }),
      "KI-Status nach der Einwilligung",
    );
    expect(mitEinwilligung.externalConsentGranted, JSON.stringify(mitEinwilligung)).toBe(true);
    expect(mitEinwilligung.executionAllowed, JSON.stringify(mitEinwilligung)).toBe(true);

    // 5. Recherche — derselbe Aufruf wie `anleitungRecherche`.
    const recherche = await json<{
      result: { answered?: boolean; answer?: string | null; sources?: string[] };
    }>(
      await request.post("/api/ask", {
        headers: auth,
        data: { question: FRAGE, questionSource: "manual", thread: [], locale: "de" },
      }),
      "Recherche",
    );
    expect(recherche.result.sources ?? [], "die Testquelle ist Fundstelle").toContain(ko.id);

    // 6. KI-Entwurf — derselbe Aufruf wie `anleitungKiEntwurf`.
    const entwurf = await json<{
      entwurf: string;
      passagen: { text: string; marken: string[] }[];
      herkunft: {
        koId: string;
        titel: string;
        stufe: string;
        version: number;
        marke?: string;
        trust?: number;
        letztePruefungAm?: string | null;
      }[];
      anbieter: string;
      modell: string;
      aiGenerated: boolean;
    }>(
      await request.post(`/api/klara/sessions/${sitzung.sessionId}/zuruf`, {
        headers: gebunden,
        data: {
          art: "erstellen",
          text: `Formuliere eine Arbeitsanweisung zu: ${FRAGE}.`,
          koIds: [ko.id],
        },
      }),
      "KI-Entwurf",
    );
    // Tatsächliche Modellantwort: gekennzeichnet, mit benanntem Anbieter und Modell.
    expect(entwurf.aiGenerated).toBe(true);
    expect(entwurf.anbieter, "Anbieter benannt").toMatch(/\S/);
    expect(entwurf.modell, "ein Modell, kein deterministischer Ersatz").toMatch(/\S/);
    expect(entwurf.modell).not.toMatch(/ohne generatives Modell|deterministisch/i);
    expect(entwurf.entwurf).toMatch(/\S/);
    // Nachvollziehbare Herkunft: die Quelle mit Marke, Fassung und Prüfstand …
    expect(entwurf.herkunft).toHaveLength(1);
    expect(entwurf.herkunft[0]).toMatchObject({
      koId: ko.id,
      marke: "Q1",
      version: quelle.version,
      stufe: "validiert",
    });
    // … und mindestens eine Passage des Modelltexts trägt sie.
    expect(
      entwurf.passagen.some((p) => p.marken.includes("Q1")),
      JSON.stringify(entwurf.passagen),
    ).toBe(true);

    // Der Beleg — synthetische Daten, keine Zugangsdaten.
    await testInfo.attach("anleitung-recherche-ki-beleg.json", {
      contentType: "application/json",
      body: JSON.stringify(
        {
          testquelle: { id: ko.id, version: quelle.version, status: quelle.status },
          dokument: "synthetisches API-Testdokument; KEINE echte Word-Datei",
          statusVorEinwilligung: ohneEinwilligung,
          statusNachEinwilligung: mitEinwilligung,
          recherche: recherche.result,
          entwurf,
        },
        null,
        2,
      ),
    });
  } finally {
    // Aufräumen auf demselben geteilten Bestand: Einwilligung widerrufen, Freigabe zurück.
    if (sitzung) {
      await request.delete(`/api/klara/sessions/${sitzung.sessionId}/consent`, {
        headers: gebunden,
      });
    }
    await request.put("/api/reasoner/config", {
      headers: auth,
      data: { ...zuordnung, kiFreigabe: freigabeVorher },
    });
  }
});
