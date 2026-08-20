// ================================================================================================
// JOB 1453 · D1 — DIE INSTANZIDENTITÄT KOMMT NICHT VON AUSSEN.
// ================================================================================================
//
// HERKUNFT. `BEN-PRUEFUNG-JOB-1390-D1.md` Korrekturpflicht 2, im Wortlaut:
//
//     „Für die Mandanten-Zusicherung einen äußeren Alias-/Transitweg und das resultierende
//      Sitzungsobjekt prüfen; erwartet ist, dass kein äußerer Tenantwert die Serverkonstante
//      ersetzt."
//
// UND DIE RÜGE, DIE DIESEN TEST NÖTIG MACHT (`:8`): Der Vorgänger prüfte mit einem Quelltext-
// sammler auf direkte Ausdrücke wie `request.body.tenantId` und belegte damit — so BEN —
// „keine Herkunftsverfolgung über einen Alias oder über ein zuvor gebundenes Objekt".
// Ein solcher Sammler ist ein Struktur-Pin: er sieht Zeichenfolgen, nicht Verhalten.
//
// DESHALB IST HIER KEIN SAMMLER. Jeder Fall unten ruft `createSession()` wirklich auf,
// schmuggelt einen Mandantenwert auf einem anderen Weg hinein und liest danach BEIDES:
// die zurückgegebene Sicht UND das im Repository tatsächlich abgelegte Sitzungsobjekt.
// Genau Letzteres verlangt die Auflage („das resultierende Sitzungsobjekt").
//
// WAS DIESER TEST NICHT BEHAUPTET. Er prüft den Dienst, nicht die HTTP-Route. Kommt der
// Mandantenwert über einen Header, den erst `build-app` in den Dienst reicht, sieht ihn dieser
// Test nicht — die Route ist nicht Teil der Lease von JOB 1453 und bleibt offen (Rückgabe §6).
//
// KALIBRIERUNG. Der rote Ausgangslauf entsteht durch eine punktgenaue Mutation an
// `klara-session-service.ts:448` (`tenantId: KLARA_SINGLE_TENANT_ID` → äußerer Wert gewinnt);
// dann fällt A1 mit `expected 'fremd-mandant' to be 'klarwerk-single-tenant'`. Ohne diese
// Mutation ist der Test grün, und das ist die Zusicherung.

import { describe, expect, it } from "vitest";
import {
  KLARA_SINGLE_TENANT_ID,
  type KlaraDocumentDescriptor,
  type KlaraPolicyQuelle,
  KlaraSessionService,
} from "../../services/app/src/services/klara-session-service";
import { InMemoryKlaraSessionRepo } from "../../services/reasoner";

const T0 = Date.parse("2026-08-20T20:45:00.000Z");
const FREMD = "fremd-mandant";

function aufbau() {
  let zaehler = 0;
  const quelle: KlaraPolicyQuelle = {
    choice: "deterministic",
    source: "default",
    effectiveAnswerProvider: "deterministic",
    cloudConfigured: false,
    localConfigured: false,
    providerLabel: "Cloud-Anbieter",
    modelLabel: "cloud-modell",
    localProviderLabel: "Lokaler Anbieter",
  };
  const repo = new InMemoryKlaraSessionRepo();
  const dienst = new KlaraSessionService({
    repo,
    policy: () => quelle,
    now: () => T0,
    newId: () => `id-${++zaehler}`,
  });
  return { dienst, repo };
}

/** Legt eine Sitzung an und liest BEIDE Seiten: die Sicht und das abgelegte Objekt. */
async function anlegen(
  descriptor: KlaraDocumentDescriptor,
  actorId = "anna",
  addinInstanceId = "addin-1",
) {
  const { dienst, repo } = aufbau();
  const sicht = await dienst.createSession(actorId, addinInstanceId, descriptor);
  const abgelegt = await repo.findSession(sicht.sessionId);
  return { sicht, abgelegt };
}

/** Ein `saved`-Descriptor mit zusätzlichen, im Vertrag nicht vorgesehenen Feldern. */
function mitZusatz(zusatz: Record<string, unknown>): KlaraDocumentDescriptor {
  return {
    kind: "saved",
    hostDocumentId: "word-doc-1",
    ...zusatz,
  } as unknown as KlaraDocumentDescriptor;
}

describe("JOB 1390 · Auflage 2 — kein äußerer Tenantwert ersetzt die Serverkonstante", () => {
  it("A1 · direkt: ein `tenantId` im Descriptor wird nicht übernommen — Sicht UND abgelegtes Objekt", async () => {
    const { sicht, abgelegt } = await anlegen(mitZusatz({ tenantId: FREMD }));

    expect(sicht.tenantId).toBe(KLARA_SINGLE_TENANT_ID);
    // Das ist der Teil, den die Auflage ausdrücklich verlangt: das RESULTIERENDE Objekt.
    expect(abgelegt?.tenantId).toBe(KLARA_SINGLE_TENANT_ID);
  });

  it("A2 · über Aliasnamen: `tenant`, `tenant_id`, `mandantId`, `orgId` tragen genauso wenig", async () => {
    for (const feld of ["tenant", "tenant_id", "mandantId", "orgId", "TenantId"]) {
      const { sicht, abgelegt } = await anlegen(mitZusatz({ [feld]: FREMD }));
      expect(sicht.tenantId, `Alias ${feld}`).toBe(KLARA_SINGLE_TENANT_ID);
      expect(abgelegt?.tenantId, `Alias ${feld} im Bestand`).toBe(KLARA_SINGLE_TENANT_ID);
    }
  });

  it("A3 · über ein gebundenes Objekt: der Wert steht im `hostDocumentId` und wirkt nur auf den Dokumentkontext", async () => {
    const { sicht, abgelegt } = await anlegen({
      kind: "saved",
      hostDocumentId: `tenantId=${FREMD}`,
    });

    expect(sicht.tenantId).toBe(KLARA_SINGLE_TENANT_ID);
    expect(abgelegt?.tenantId).toBe(KLARA_SINGLE_TENANT_ID);
    // Gegenprobe, damit der Fall nicht leerläuft: der Wert IST angekommen — nur eben dort,
    // wo er hingehört. Ohne diese Zeile bewiese A3 nur, dass irgendetwas nicht passiert ist.
    expect(sicht.documentContextId).toMatch(/^doc-s-[0-9a-f]{32}$/);
    expect(sicht.documentContextId).not.toContain(FREMD);
  });

  it("A4 · über die Bindungsfelder: Mandantenwerte in `actorId` und `addinInstanceId` bleiben dort", async () => {
    const { sicht, abgelegt } = await anlegen(
      { kind: "saved", hostDocumentId: "word-doc-1" },
      FREMD,
      `addin-${FREMD}`,
    );

    expect(sicht.tenantId).toBe(KLARA_SINGLE_TENANT_ID);
    expect(abgelegt?.tenantId).toBe(KLARA_SINGLE_TENANT_ID);
    // Auch hier die Gegenprobe: die Werte sind wirklich durchgereicht worden.
    expect(sicht.actorId).toBe(FREMD);
    expect(sicht.addinInstanceId).toBe(`addin-${FREMD}`);
  });

  it("A5 · ungespeicherter Kontext: derselbe Schmuggelweg über die Nonce trägt ebenfalls nicht", async () => {
    const { sicht, abgelegt } = await anlegen({
      kind: "unsaved",
      clientDocumentNonce: `nonce-tenantId-${FREMD}`,
    } as unknown as KlaraDocumentDescriptor);

    expect(sicht.tenantId).toBe(KLARA_SINGLE_TENANT_ID);
    expect(abgelegt?.tenantId).toBe(KLARA_SINGLE_TENANT_ID);
  });

  it("B1 · die Konstante selbst ist gepinnt — eine stille Umbenennung fiele hier auf", () => {
    // Kein Struktur-Pin über fremden Code, sondern die eine Zusicherung, auf der alle Fälle
    // oben ruhen: Ändert jemand den Wert, sind A1-A5 wertlos, ohne dass sie rot würden.
    expect(KLARA_SINGLE_TENANT_ID).toBe("klarwerk-single-tenant");
  });
});
