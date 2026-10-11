// ================================================================================================
// ADMIN-16 · K3/K4/K5 — VORSCHAU UND BEGRENZTE ENTFERNUNG IN EINEM ISOLIERTEN BESTAND.
// ================================================================================================
//
// produkt:20261009:admin-demo-diagnose, Lieferbeleg: „Test mit zwei Demopaketen plus unabhängig
// angelegtem Beitrag; Vorschau und begrenzte Entfernung in isoliertem Bestand belegen."
//
// DER TISCH, frisch je Fall und ausschliesslich mit erfundenen Daten (`buildServices()` im Speicher):
//   · Paket A — das ausgelieferte Advisor-Paket, geladen über die echte Route.
//   · Paket B — ein zweites, erfundenes Paket mit eigener Kennung. Ausgeliefert ist heute nur EIN
//     Paket (`DEMO_PACKAGES`); B wird deshalb über dieselben Dienstfunktionen geladen, die auch die
//     Route ruft (`ladeDemoPaket`/`entferneDemoPaket`/`demoPaketVorschau`). Die Route selbst kennt B
//     nicht — das ist kein Mangel des Tests, sondern die Registerregel (unbekanntes Paket → 404).
//   · K — ein fiktiver Kundenbeitrag, angelegt von einem eigenen Expertenkonto über `POST /api/kos`.
//   · L — ein zweiter unabhängiger Beitrag, der einem A-Baustein absichtlich ÄHNELT: gleicher Titel
//     samt Beispielpräfix, Schlagworte `beispiel` und die Paketkennung als nacktes Schlagwort — aber
//     ohne Paketanker und ohne Registereintrag. Wer nach Titel oder Schlagwort-Ähnlichkeit auswählte,
//     träfe ihn.
//
// GEMESSEN: die Vorschau vor dem Entfernen nennt GENAU die Kennungen von A; das Entfernen trifft
// genau diese; B, K und L stehen danach Feld für Feld unverändert da — und umgekehrt für B.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { EXAMPLE_TITLE_PREFIX } from "../../services/app/src/example-packages";
import {
  ADVISOR_ICT_EN_V1,
  type DemoPackageDefinition,
  type DemoPackageItem,
} from "../../services/app/src/example-packages/advisor-ict-en-v1";
import {
  type DemoPackageServices,
  demoPaketVorschau,
  entferneDemoPaket,
  ladeDemoPaket,
} from "../../services/app/src/example-packages/demo-pakete";

const A = ADVISOR_ICT_EN_V1;

function baustein(key: string, area: string, title: string, absatz: string): DemoPackageItem {
  return {
    key,
    area,
    title,
    paragraphs: [absatz],
    type: "best_practice",
    contentSha256: "nur-verweis",
    bodySha256: createHash("sha256").update(absatz, "utf8").digest("hex"),
  };
}

/** Das zweite, erfundene Paket — eigene Kennung, eigene Bausteine. */
const B: DemoPackageDefinition = {
  id: "pruefpaket-b-v1",
  language: "en",
  fictional: true,
  title: { de: "Prüfpaket B", en: "Test package B", nl: "Testpakket B" },
  description: {
    de: "Zwei erfundene Bausteine für den Isolationstest.",
    en: "Two invented entries for the isolation test.",
    nl: "Twee verzonnen bouwstenen voor de isolatietest.",
  },
  items: [
    baustein(
      "B01",
      "Service",
      "Fictional opening hours of the demo service desk",
      "The fictional service desk of Demo Ltd is staffed on weekdays from 08:00 to 17:00.",
    ),
    baustein(
      "B02",
      "Technical",
      "Fictional restart order for the demo lab",
      "In the fictional demo lab, restart the test router before the test switch.",
    ),
  ],
};

interface Objekt {
  id: string;
  title: string;
  statement: string;
  version: number;
  status: string;
  category: string;
  tags?: string[];
  sources?: { externalId?: string | null }[];
}

/** Was „unverändert" heisst: jedes Feld, das ein Mensch an einem Beitrag sehen oder prüfen kann. */
function abbild(k: Objekt): Record<string, unknown> {
  return {
    id: k.id,
    title: k.title,
    statement: k.statement,
    version: k.version,
    status: k.status,
    category: k.category,
    tags: [...(k.tags ?? [])].sort(),
  };
}

const vonPaket = (kos: Objekt[], pkg: DemoPackageDefinition): string[] =>
  kos
    .filter((k) => (k.sources ?? []).some((s) => (s.externalId ?? "").startsWith(`${pkg.id}/`)))
    .map((k) => k.id)
    .sort();

async function tisch() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@demo-diagnose.test", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@demo-diagnose.test", password: "secret123" },
  });
  const adminId = login.json().user.id as string;
  const admin = { authorization: `Bearer ${login.json().token as string}` };

  // Ein eigenes, fiktives Expertenkonto — der „Kunde", der unabhängig etwas beiträgt.
  const konto = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: admin,
    payload: {
      name: "Erika Beispiel",
      email: "erika@demo-diagnose.test",
      password: "secret123",
      role: "experte",
    },
  });
  expect(konto.statusCode, konto.body).toBe(201);
  const expertenLogin = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "erika@demo-diagnose.test", password: "secret123" },
  });
  const experteId = expertenLogin.json().user.id as string;
  const experte = { authorization: `Bearer ${expertenLogin.json().token as string}` };

  const beitrag = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: experte,
    payload: {
      confidentiality: "intern",
      title: "Fiktive Musterfirma: Rückruf innerhalb von zwei Stunden",
      statement:
        "Bei der fiktiven Musterfirma GmbH erfolgt ein Kundenrückruf innerhalb von zwei Stunden.",
      type: "best_practice",
      category: "Service",
    },
  });
  expect(beitrag.statusCode, beitrag.body).toBe(201);
  const kId = (beitrag.json() as { id: string }).id;

  const erstesA = A.items[0] as DemoPackageItem;
  const aehnlich = await services.ko.create({
    title: `${EXAMPLE_TITLE_PREFIX}${erstesA.title}`,
    statement: "Eigene, fiktive Notiz einer Kundin — sie ähnelt einem Paketbaustein nur im Titel.",
    type: "best_practice",
    category: erstesA.area,
    author: experteId,
    tags: ["beispiel", A.id],
  });
  const lId = aehnlich.id;

  const dienste: DemoPackageServices = {
    ko: services.ko,
    validation: services.validation,
    conflicts: services.conflicts,
    overlaps: services.overlaps,
  };

  // Paket A über die echte Route, Paket B über dieselbe Dienstfunktion, die die Route ruft.
  const ladenA = await app.inject({
    method: "POST",
    url: `/api/admin/demo-packages/${A.id}/load`,
    headers: admin,
  });
  expect(ladenA.statusCode, ladenA.body).toBe(200);
  const ladenB = await ladeDemoPaket(dienste, B, adminId, "laden");
  expect(ladenB.created).toBe(2);
  expect(ladenB.failures).toEqual([]);

  const alle = (await services.ko.list()) as unknown as Objekt[];
  const aIds = vonPaket(alle, A);
  const bIds = vonPaket(alle, B);
  return { services, app, admin, experte, adminId, dienste, kId, lId, aIds, bIds };
}

async function abbilder(
  services: ReturnType<typeof buildServices>,
  ids: readonly string[],
): Promise<Record<string, unknown>[]> {
  const ergebnis: Record<string, unknown>[] = [];
  for (const id of ids) {
    const k = (await services.ko.get(id)) as unknown as Objekt | null;
    expect(k, `${id} fehlt`).not.toBeNull();
    ergebnis.push(abbild(k as Objekt));
  }
  return ergebnis;
}

describe("ADMIN-16 · K4 · Entfernen eines Demopakets trifft nur dessen Bestand", () => {
  it("der Tisch steht: 6 Bausteine A, 2 Bausteine B, 2 unabhängige Beiträge", async () => {
    const { services, aIds, bIds, kId, lId } = await tisch();
    expect(aIds).toHaveLength(6);
    expect(bIds).toHaveLength(2);
    const alle = (await services.ko.list()).map((k) => k.id).sort();
    expect(alle).toEqual([...aIds, ...bIds, kId, lId].sort());
  });

  it("Vorschau vor dem Entfernen nennt GENAU die Kennungen von A — nichts von B, K oder L", async () => {
    const { app, admin, aIds, bIds, kId, lId } = await tisch();
    const res = await app.inject({
      method: "GET",
      url: `/api/admin/demo-packages/${A.id}/preview?aktion=entfernen`,
      headers: admin,
    });
    expect(res.statusCode).toBe(200);
    const vorschau = res.json() as {
      aktion: string;
      entries: { id: string; behandlung: string }[];
      missing: number;
    };
    expect(vorschau.aktion).toBe("entfernen");
    expect(vorschau.entries.map((e) => e.id).sort()).toEqual(aIds);
    expect(vorschau.entries.every((e) => e.behandlung === "entfernen")).toBe(true);
    expect(vorschau.missing).toBe(0);
    for (const fremd of [...bIds, kId, lId]) {
      expect(
        vorschau.entries.some((e) => e.id === fremd),
        `${fremd} stünde in der Vorschau`,
      ).toBe(false);
    }
  });

  it("die Vorschau verändert nichts — zweimal gefragt, derselbe Bestand Feld für Feld", async () => {
    const { services, app, admin, aIds, bIds, kId, lId } = await tisch();
    const alle = [...aIds, ...bIds, kId, lId];
    const vorher = await abbilder(services, alle);
    for (const aktion of ["entfernen", "zuruecksetzen", "entfernen"]) {
      const res = await app.inject({
        method: "GET",
        url: `/api/admin/demo-packages/${A.id}/preview?aktion=${aktion}`,
        headers: admin,
      });
      expect(res.statusCode).toBe(200);
    }
    expect(await abbilder(services, alle)).toEqual(vorher);
  });

  it("Entfernen von A (Route): genau die angekündigten 6 gehen; B, K und L bleiben unverändert", async () => {
    const { services, app, admin, aIds, bIds, kId, lId } = await tisch();
    const bleibt = [...bIds, kId, lId];
    const vorher = await abbilder(services, bleibt);
    const vorschauB = await demoPaketVorschau(services.ko, B, "entfernen");

    const res = await app.inject({
      method: "DELETE",
      url: `/api/admin/demo-packages/${A.id}`,
      headers: admin,
    });
    expect(res.statusCode).toBe(200);
    const bilanz = res.json() as { removed: number; removedAssigned: number; failures: unknown[] };
    expect(bilanz.removed).toBe(6);
    expect(bilanz.removedAssigned).toBe(0);
    expect(bilanz.failures).toEqual([]);

    const rest = (await services.ko.list()).map((k) => k.id).sort();
    expect(rest).toEqual([...bleibt].sort());
    for (const weg of aIds) {
      expect(await services.ko.get(weg)).toBeFalsy();
    }
    expect(await abbilder(services, bleibt)).toEqual(vorher);
    // Paket B kennt danach genau denselben Bestand wie vorher.
    expect(await demoPaketVorschau(services.ko, B, "entfernen")).toEqual(vorschauB);
    // Und die Übersicht der Route zählt A ehrlich als leer.
    const uebersicht = await app.inject({
      method: "GET",
      url: "/api/admin/demo-packages",
      headers: admin,
    });
    const a = (uebersicht.json() as { packages: { id: string; loaded: number }[] }).packages.find(
      (p) => p.id === A.id,
    );
    expect(a?.loaded).toBe(0);
    // Wiederholt: nichts mehr da, nichts Fremdes getroffen.
    const nochmal = await app.inject({
      method: "DELETE",
      url: `/api/admin/demo-packages/${A.id}`,
      headers: admin,
    });
    expect((nochmal.json() as { removed: number }).removed).toBe(0);
    expect(await abbilder(services, bleibt)).toEqual(vorher);
  });

  it("Entfernen von B: genau seine 2 gehen; die 6 von A, K und L bleiben unverändert", async () => {
    const { services, adminId, dienste, aIds, bIds, kId, lId } = await tisch();
    const bleibt = [...aIds, kId, lId];
    const vorher = await abbilder(services, bleibt);
    const vorschau = await demoPaketVorschau(services.ko, B, "entfernen");
    expect(vorschau.entries.map((e) => e.id).sort()).toEqual(bIds);

    const bilanz = await entferneDemoPaket(dienste, B, adminId);
    expect(bilanz.removed).toBe(2);
    expect(bilanz.failures).toEqual([]);
    expect((await services.ko.list()).map((k) => k.id).sort()).toEqual([...bleibt].sort());
    expect(await abbilder(services, bleibt)).toEqual(vorher);
  });
});

describe("ADMIN-16 · K5 · die Rechte am Server bleiben, wie sie sind", () => {
  it("ein Expertenkonto darf weder Vorschau holen noch entfernen — und es ist nichts weg", async () => {
    const { services, app, experte, aIds, bIds, kId, lId } = await tisch();
    const vorher = (await services.ko.list()).length;
    const vorschau = await app.inject({
      method: "GET",
      url: `/api/admin/demo-packages/${A.id}/preview?aktion=entfernen`,
      headers: experte,
    });
    expect(vorschau.statusCode).toBe(403);
    const entfernen = await app.inject({
      method: "DELETE",
      url: `/api/admin/demo-packages/${A.id}`,
      headers: experte,
    });
    expect(entfernen.statusCode).toBe(403);
    const aufraeumen = await app.inject({
      method: "POST",
      url: "/api/admin/import/cleanup",
      headers: experte,
      payload: {},
    });
    expect(aufraeumen.statusCode).toBe(403);
    expect((await services.ko.list()).length).toBe(vorher);
    expect(vorher).toBe(aIds.length + bIds.length + [kId, lId].length);
  });
});
