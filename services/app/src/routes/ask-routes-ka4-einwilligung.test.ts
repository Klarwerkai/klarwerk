// ================================================================================================
// JOB 1540 · D2 — DIE EINWILLIGUNG, UNGEMOCKT VON DER SITZUNG BIS ZU DEN FLAGS
// ================================================================================================
//
// BENS AUFLAGE 1 zu D1, woertlich: „eine echte, nicht eingesetzte Produktionsverdrahtung pruefen:
// Einwilligung fuer Sitzung S und Dokument D setzen, Ask mit derselben Bindung senden und
// `{ validatedOnly: false, retrievalOnly: false }` erwarten; mit fremder Sitzung oder fremdem
// Dokument beide Werte `true` erwarten."
//
// UND ER HAT MIT SEINEM VORWURF RECHT: In D1 habe ich `KA4: OFFEN -> ERLEDIGT` gemeldet und im
// selben Papier als `OF-1540-2` notiert, dass `KLARA_EXTERNAL_EXECUTION_MIGRATED` auf `false`
// steht. Beides zusammen geht nicht. Was hier steht, ist die Messung, die ich damals schuldig
// geblieben bin.
//
// ------------------------------------------------------------------------------------------------
// KEIN EINGESETZTER PRUEFER. Die App entsteht ueber `buildApp(buildServices())`; `klaraSessions`
// ist der ECHTE `KlaraSessionService` (build-app.ts:1044-1046, 1258-1262). Sitzung, Dokument-
// kontext und Einwilligung laufen ueber die ECHTEN Routen (`/api/klara/sessions`,
// `.../consent`). Nichts ist ersetzt.
//
// UND DIE FLAGS WERDEN AM VERHALTEN GEMESSEN, nicht an einem Spion: `validatedOnly` entscheidet,
// ob ein UNVALIDIERTES Wissensobjekt ueberhaupt Quelle sein darf. Ob das Flag faellt, sieht man
// also daran, ob ein solches Objekt zitiert wird — das ist die Wirkung, um die es geht, und sie
// bleibt wahr, auch wenn jemand die Option einmal umbenennt.
// ------------------------------------------------------------------------------------------------
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../build-app";

type App = ReturnType<typeof buildApp>;

const FRAGE = "Wie wird die Zylinderkopfdichtung XQ42 gewechselt?";

interface Aufbau {
  app: App;
  kopf: Record<string, string>;
  bindung: Record<string, string>;
  validiert: string;
  offen: string;
}

async function aufbauen(): Promise<Aufbau> {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "ka4d2@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "ka4d2@x.de", password: "secret123" },
  });
  const kopf = { authorization: `Bearer ${login.json().token}` };

  const ko = async (
    title: string,
    statement: string,
    validieren: boolean,
    extra: Record<string, unknown> = {},
  ): Promise<string> => {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: kopf,
      payload: {
        title,
        statement,
        type: "best_practice",
        category: "KA4",
        neededValidations: 1,
        ...extra,
      },
    });
    const id = res.json().id as string;
    if (validieren) {
      await app.inject({
        method: "PUT",
        url: `/api/kos/${id}`,
        headers: kopf,
        payload: { action: "rate", verdict: "up" },
      });
    }
    return id;
  };

  const validiert = await ko(
    "Zylinderkopfdichtung XQ42 wechseln",
    "Die Zylinderkopfdichtung XQ42 vor dem Wechsel entlasten.",
    true,
  );
  // Dasselbe Thema, aber UNVALIDIERT. Solange `validatedOnly` gilt, darf es nie Quelle sein.
  const offen = await ko(
    "Zylinderkopfdichtung XQ42 Sonderfall",
    "Die Zylinderkopfdichtung XQ42 im Sonderfall zuerst kuehlen.",
    false,
  );

  // Die ECHTE Sitzung — der Server vergibt Sitzungs- und Dokumentkennung.
  const sitzung = await app.inject({
    method: "POST",
    url: "/api/klara/sessions",
    headers: { ...kopf, "x-klara-instance": "inst-1" },
    payload: {
      addinInstanceId: "inst-1",
      // Der echte Vertrag kennt genau zwei Formen (klara-session-service.ts:76-83). `saved` ist
      // die, die ein Word-Dokument mit Datei hat — und die einzige, deren Dokumentkennung
      // reproduzierbar aus dem Merkmal abgeleitet wird.
      documentDescriptor: { kind: "saved", hostDocumentId: "doc-abc" },
    },
  });
  expect(sitzung.statusCode, `Sitzung: ${sitzung.body}`).toBe(201);
  const sicht = sitzung.json();
  const bindung = {
    "x-klara-session": String(sicht.sessionId ?? sicht.session?.sessionId ?? ""),
    "x-klara-instance": "inst-1",
    "x-klara-document": String(sicht.documentContextId ?? sicht.session?.documentContextId ?? ""),
  };
  return { app, kopf, bindung, validiert, offen };
}

const fragen = (a: Aufbau, extraKopf: Record<string, string>) =>
  a.app.inject({
    method: "POST",
    url: "/api/ask",
    headers: { ...a.kopf, ...extraKopf, "content-type": "application/json" },
    payload: { question: FRAGE, locale: "de", mode: "retrieval-only" },
  });

describe("KA4 · D2 · die Einwilligung, ungemockt bis zu den Flags", () => {
  it("KA4-I0 · KALIBRIERUNG: die Sitzung entsteht wirklich — und die Einwilligung wird ABGELEHNT", async () => {
    // Ohne diesen Fall waeren alle folgenden auch dann gruen, wenn schon die Sitzung scheiterte.
    const a = await aufbauen();
    expect((a.bindung["x-klara-session"] ?? "").length).toBeGreaterThan(0);
    expect((a.bindung["x-klara-document"] ?? "").length).toBeGreaterThan(0);

    // UND HIER STEHT DER BEFUND, DER D1 WIDERLEGT: Der echte Bestand nimmt die Einwilligung nicht
    // einmal an. Ohne konfigurierte Cloud ist der Modus `deterministic`; dann ist eine externe
    // Zustimmung gar nicht vorgesehen, und der Server sagt das ehrlich mit 409.
    const consent = await a.app.inject({
      method: "POST",
      url: `/api/klara/sessions/${a.bindung["x-klara-session"]}/consent`,
      headers: { ...a.kopf, ...a.bindung },
    });
    expect(consent.statusCode).toBe(409);
    expect(consent.json().error).toBe("CONFLICT");
    expect(consent.json().message).toContain("nur für externe KI möglich");
    await a.app.close();
  });

  it("KA4-I1 · OHNE Einwilligung: die Enge gilt — ein unvalidiertes Objekt wird NIE zitiert", async () => {
    const a = await aufbauen();
    const res = await fragen(a, a.bindung);
    expect(res.statusCode).toBe(200);
    const ergebnis = res.json().result;
    expect(ergebnis.sources ?? []).not.toContain(a.offen);
    await a.app.close();
  });

  it("KA4-I2 · DIE ENTSCHEIDENDE MESSUNG: auch NACH dem Einwilligungsversuch bleibt die Enge", async () => {
    // Das ist BENs Kernfrage, an der echten Verdrahtung beantwortet: Der Anwender tut, was die
    // Oberflaeche ihm anbietet — er willigt ein. Der Server lehnt ab (409, siehe I0), und der
    // Ask-Weg bleibt deshalb in der Enge. Das unvalidierte Objekt ist der Zeuge: nur wenn
    // `validatedOnly` faellt, kann es Quelle sein.
    const a = await aufbauen();
    const consent = await a.app.inject({
      method: "POST",
      url: `/api/klara/sessions/${a.bindung["x-klara-session"]}/consent`,
      headers: { ...a.kopf, ...a.bindung },
    });
    expect(consent.statusCode).toBe(409); // die Einwilligung kommt gar nicht zustande

    const res = await fragen(a, a.bindung);
    expect(res.statusCode).toBe(200);
    const ergebnis = res.json().result;

    // `validatedOnly` gilt weiter — das unvalidierte Objekt ist NICHT Quelle.
    expect(ergebnis.sources ?? []).not.toContain(a.offen);
    // Und `retrievalOnly` gilt weiter: der deterministische Weg setzt KEINE KI-Kennzeichnung.
    expect(ergebnis.aiGenerated ?? false).toBe(false);
    await a.app.close();
  });

  it("KA4-I6 · DER ZWEITE ZWEIG, ungemockt auf Policy-Ebene: mit Cloud greift `external_not_migrated`", async () => {
    // I0 bis I4 messen den Bestand OHNE konfigurierte Cloud. Waere eine konfiguriert, waere der
    // Modus `external` — und dann entscheidet die Konstante. Geprueft wird die ECHTE
    // Produktfunktion `resolveKlaraPolicy` (services/reasoner/src/klara-policy.ts), kein Mock,
    // kein Netz, kein Modellaufruf.
    // Ueber den PAKET-INDEX, nicht ueber den internen Pfad: `depcruise` verbietet den Griff in
    // `services/reasoner/src/` von hier aus (module-boundaries), und zwar zu Recht — die Grenze
    // ist der Index. Beide Namen sind dort exportiert (services/reasoner/index.ts:190, 195).
    const { resolveKlaraPolicy, KLARA_EXTERNAL_EXECUTION_MIGRATED } = await import(
      "../../../reasoner"
    );
    // Die Konstante steht im Produktcode auf `false` — das ist der Ausgangspunkt, nicht meine Annahme.
    expect(KLARA_EXTERNAL_EXECUTION_MIGRATED).toBe(false);

    // Die Feldnamen stammen aus `KlaraPolicyInput` (klara-policy.ts), nicht aus dem Gedaechtnis.
    const aufloesung = resolveKlaraPolicy({
      resolutionId: "res-1",
      choice: "cloud",
      source: "db",
      effectiveAnswerProvider: "cloud",
      cloudConfigured: true,
      localConfigured: false,
      providerLabel: "anthropic",
      modelLabel: "claude",
      externalConsentGranted: true, // die Einwilligung liegt VOR — und traegt trotzdem nicht
      now: 1_700_000_000_000,
    } as never);

    expect(aufloesung.effectiveMode).toBe("external");
    expect(aufloesung.blockedReason).toBe("external_not_migrated");
    expect(aufloesung.executionAllowed).toBe(false);
  });

  it("KA4-I3 · GEGENFALL fremde Sitzung: die Enge bleibt", async () => {
    const a = await aufbauen();
    await a.app.inject({
      method: "POST",
      url: `/api/klara/sessions/${a.bindung["x-klara-session"]}/consent`,
      headers: { ...a.kopf, ...a.bindung },
    });
    const res = await fragen(a, { ...a.bindung, "x-klara-session": "sess-fremd" });
    expect(res.statusCode).toBe(200);
    expect(res.json().result.sources ?? []).not.toContain(a.offen);
    await a.app.close();
  });

  it("KA4-I4 · GEGENFALL fremdes Dokument: die Enge bleibt", async () => {
    const a = await aufbauen();
    await a.app.inject({
      method: "POST",
      url: `/api/klara/sessions/${a.bindung["x-klara-session"]}/consent`,
      headers: { ...a.kopf, ...a.bindung },
    });
    const res = await fragen(a, { ...a.bindung, "x-klara-document": "doc-fremd" });
    expect(res.statusCode).toBe(200);
    expect(res.json().result.sources ?? []).not.toContain(a.offen);
    await a.app.close();
  });

  it("KA4-I5 · was die Einwilligung im echten Bestand LIEFERT — der Grund, im Wortlaut", async () => {
    // Der Kern von BENs Vorwurf: kann der produktive Pruefer ueberhaupt `erlaubt: true` sagen?
    // Gefragt wird der ECHTE Dienst, nicht die Route — damit der Grund sichtbar wird und nicht
    // hinter dem Routenzweig verschwindet.
    const a = await aufbauen();
    await a.app.inject({
      method: "POST",
      url: `/api/klara/sessions/${a.bindung["x-klara-session"]}/consent`,
      headers: { ...a.kopf, ...a.bindung },
    });
    const status = await a.app.inject({
      method: "GET",
      url: `/api/klara/sessions/${a.bindung["x-klara-session"]}`,
      headers: { ...a.kopf, ...a.bindung },
    });
    expect(status.statusCode).toBe(200);
    const sicht = status.json();
    const aufloesung = sicht.resolution ?? sicht;
    // eslint-disable-next-line no-console
    console.log(
      `KA4-I5 · mode=${aufloesung.mode} · effectiveMode=${aufloesung.effectiveMode} · ` +
        `executionAllowed=${aufloesung.executionAllowed} · blockedReason=${aufloesung.blockedReason} · ` +
        `externalConsentRequired=${aufloesung.externalConsentRequired} · ` +
        `externalConsentGranted=${aufloesung.externalConsentGranted}`,
    );
    expect(typeof aufloesung.executionAllowed).toBe("boolean");
    await a.app.close();
  });
});
