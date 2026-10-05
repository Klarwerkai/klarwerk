// ================================================================================================
// PRÜFSTATUS-ANZEIGE (R-0216 × R-0231) · BENS ROTE GEGENPROBE BEN-07, DAUERHAFT ÜBERNOMMEN.
// ================================================================================================
//
// Herkunft: `ORIGINAL-BEN/r3-konflikt-gegenprobe.test.ts` (Ben, Runde 3, Kandidat 9f3abccf). Dort
// lief sie rot: Kalibrierung grün, Detail/Bibliothek/Antwort je „expected 'Zu prüfen' to be
// 'In Prüfung'" (Messbericht `ORIGINAL-BEN/r3-konflikt-gegenprobe.json`, 1 bestanden, 3 rot).
//
// Inhalt und Erwartungen sind UNVERÄNDERT. Angepasst sind nur die Importpfade (Repository statt
// Bens Prüfbaum), eine typsichere Stelle statt `!` und diese Kopfzeilen.
//
// Der Ablauf geht ausschließlich über die Produkt-Routen (Fastify-Injection, In-Memory-Bestand):
// anlegen → positiv bewerten (validiert/99) → echten Wahrheitswiderspruch melden → erneut lesen
// (offen/87, Anzeigestatus `konflikt`). Danach müssen Detail, Bibliothek und Antwort „In Prüfung"
// zeigen. Korrektur: `apps/web/src/lib/koOverview.ts` (`konflikt` → „In Prüfung", unabhängig vom
// zurückgesetzten Kern).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Conflict, KnowledgeObject } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { conflictAwareSourceRefs } from "../../apps/web/src/lib/askView";
import { koOverview } from "../../apps/web/src/lib/koOverview";
import { libraryMaturity } from "../../apps/web/src/lib/libraryMaturity";
import { useReadiness } from "../../apps/web/src/lib/useReadiness";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const app = buildApp(buildServices());
let vorher: KnowledgeObject;
let nachher: KnowledgeObject;
let conflicts: Conflict[];

beforeAll(async () => {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ben Test", email: "ben@probe.test", password: "test-only-password" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "ben@probe.test", password: "test-only-password" },
  });
  expect(login.statusCode).toBe(200);
  const headers = { authorization: `Bearer ${login.json().token}` };
  async function create(title: string): Promise<string> {
    const r = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title,
        statement: title,
        confidentiality: "intern",
        type: "best_practice",
        category: "Test",
        neededValidations: 1,
      },
    });
    expect(r.statusCode).toBe(201);
    return r.json().id as string;
  }
  const a = await create("Vor der Wartung Druck ablassen");
  const b = await create("Während der Wartung Druck beibehalten");
  const rate = await app.inject({
    method: "PUT",
    url: `/api/kos/${a}`,
    headers,
    payload: { action: "rate", verdict: "up" },
  });
  expect(rate.statusCode).toBe(200);
  vorher = (await app.inject({ method: "GET", url: `/api/kos/${a}`, headers })).json();
  const conflict = await app.inject({
    method: "PUT",
    url: `/api/kos/${a}`,
    headers,
    payload: {
      action: "conflict",
      conflict: { koA: a, koB: b, type: "truth", description: "Widerspruch zur Wartung" },
    },
  });
  expect(conflict.statusCode).toBe(201);
  nachher = (await app.inject({ method: "GET", url: `/api/kos/${a}`, headers })).json();
  conflicts = (await app.inject({ method: "GET", url: "/api/conflicts", headers })).json();
});

afterAll(async () => {
  await app.close();
});

describe("R-0216: realer Wahrheitswiderspruch gegen zuvor validiertes Wissen", () => {
  it("Kalibrierung: validiert 99 wird durch Konflikt offen 87 mit Anzeigestatus konflikt", () => {
    expect(vorher.status).toBe("validiert");
    expect(vorher.trust).toBe(99);
    expect(nachher.status).toBe("offen");
    expect(nachher.trust).toBe(87);
    expect(nachher.anzeigestatus).toBe("konflikt");
    expect(koOverview(vorher).usability).toBe("ready");
  });

  it.each(["Detail", "Bibliothek", "Antwort"] as const)(
    "%s: zurückgeholtes Objekt ist In Prüfung",
    (weg) => {
      const quelle = conflictAwareSourceRefs([nachher.id], [nachher], conflicts)[0];
      const actual =
        weg === "Detail"
          ? koOverview(nachher).usability
          : weg === "Bibliothek"
            ? libraryMaturity(nachher).usability
            : quelle?.usability;
      expect(actual, `${weg}: keine Nutzbarkeit abgeleitet`).toBeDefined();
      if (!actual) {
        return;
      }
      const label = i18n.t(useReadiness(actual).labelKey, { lng: "de" });
      expect(label).toBe("In Prüfung");
    },
  );
});
