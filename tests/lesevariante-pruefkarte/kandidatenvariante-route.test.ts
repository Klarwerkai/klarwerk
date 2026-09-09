// ================================================================================================
// JOB 3363 · LESEVARIANTE-PRUEFKARTE — DIE LESEÜBERSETZUNG EINES NOCH NICHT ANGENOMMENEN KANDIDATEN.
// ================================================================================================
//
// WORUM ES GEHT. JOB 3326 speichert Lesevarianten AM WISSENSOBJEKT (Primärschlüssel ko_id+lang).
// Ein Import-Kandidat der Prüfkarte in Stufe 2 IST aber noch kein Wissensobjekt: `koId` ist `null`,
// bis jemand „Annehmen" drückt. Für ihn gibt es also keine gespeicherte Zeile — und eine mit
// erfundener KO-Kennung wäre Betrug an der Vorführung.
//
// DIE ANTWORT: die Variante wird LIVE aus der lokalen Lieferung aufgelöst, über den ECHTEN
// Kandidaten. Der Client schickt eine Kandidaten-KENNUNG; erst der Server holt daraus Provider und
// Quellkennung und hält sie gegen dieselben Anker wie das Laden am Wissensobjekt (`ankerFuer`).
// Eine frei abfragbare provider/externalId-Route gibt es ausdrücklich NICHT: sie wäre ein Weg, die
// Lieferung ohne jeden Bezug zum Bestand auszulesen.
//
// GEMESSEN WIRD AN `buildApp(buildServices())` — derselben Verdrahtung, die der Server fährt. Nur
// so ist belegt, dass die Route überhaupt REGISTRIERT ist und dass sie denselben Kandidatenbestand
// sieht wie die Warteschlange (Auftrag §5.6).
import { describe, expect, it } from "vitest";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import { lokalisierungsPaket } from "../../services/app/src/lesevarianten";

/** S01 der Lieferung — eine der 36 Confluence-Seiten. Kennung und Texte kommen AUS der Lieferung. */
const S01 = (() => {
  const paket = lokalisierungsPaket("advisor-ict-en-v1");
  if (!paket) {
    throw new Error("Die Lieferung advisor-ict-en-v1 fehlt — ohne sie misst dieser Test nichts.");
  }
  const record = paket.records.find((r) => r.key === "S01");
  if (!record?.confluence_id || !record.de || !record.en) {
    throw new Error("Datensatz S01 der Lieferung ist unvollständig.");
  }
  return {
    paketId: paket.package_id,
    confluenceId: record.confluence_id,
    titelEn: record.en.title,
    titelDe: record.de.title,
    absatzDe: record.de.paragraphs[0] ?? "",
    absaetzeDe: record.de.paragraphs,
    absatzEn: record.en.paragraphs[0] ?? "",
    status: record.translation_status,
  };
})();

interface Kandidatenwunsch {
  externalId?: string;
  provider?: string;
}

async function aufbau(wunsch: Kandidatenwunsch = {}): Promise<{
  app: ReturnType<typeof buildApp>;
  services: AppServices;
  headers: Record<string, string>;
  kandidatId: string;
}> {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };
  // DIE ECHTE KETTE: `POST /api/library/import/candidates` → `createImportCandidates`. Kein
  // handgelegter Kandidat im Repo, kein Kunst-Wissensobjekt.
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/library/import/candidates",
    headers,
    payload: {
      items: [
        {
          title: S01.titelEn,
          statement: S01.absatzEn,
          type: "best_practice",
          category: "Onboarding",
          author: "importer",
          bodyHtml: `<p>${S01.absatzEn}</p>`,
          provider: wunsch.provider ?? "Confluence",
          ...(wunsch.externalId === undefined
            ? { externalId: S01.confluenceId }
            : { externalId: wunsch.externalId }),
        },
      ],
    },
  });
  const kandidat = (angelegt.json() as { id: string; status: string; koId: string | null }[])[0];
  if (!kandidat) {
    throw new Error(`Kandidat wurde nicht eingereiht: ${angelegt.statusCode} ${angelegt.body}`);
  }
  // Der Ausgangszustand, den dieser Job NICHT verändern darf.
  expect({ status: kandidat.status, koId: kandidat.koId }).toEqual({ status: "neu", koId: null });
  return { app, services, headers, kandidatId: kandidat.id };
}

function hole(
  app: ReturnType<typeof buildApp>,
  id: string,
  lang: string,
  headers?: Record<string, string>,
) {
  return app.inject({
    method: "GET",
    url: `/api/library/import/candidates/${id}/lesevariante/${lang}`,
    ...(headers ? { headers } : {}),
  });
}

describe("JOB 3363 · GET /api/library/import/candidates/:id/lesevariante/:lang", () => {
  it("K1 · DE liefert die gekennzeichnete Leseübersetzung des ECHTEN Kandidaten — ohne koId im Antworttyp", async () => {
    const { app, headers, kandidatId } = await aufbau();
    const res = await hole(app, kandidatId, "de", headers);
    expect(res.statusCode).toBe(200);
    const variante = res.json();
    expect({
      lang: variante.lang,
      originalLanguage: variante.originalLanguage,
      title: variante.title,
      statement: variante.statement,
      herkunft: variante.herkunft,
      status: variante.status,
      hatKoId: Object.hasOwn(variante, "koId"),
    }).toEqual({
      lang: "de",
      originalLanguage: "en",
      title: S01.titelDe,
      statement: S01.absatzDe,
      herkunft: `lokale Lieferung ${S01.paketId}`,
      status: S01.status,
      hatKoId: false,
    });
    // Der Fließtext reist mit (Auftrag §5.1 „title/statement/body") und ist entschärft — `<p>`-
    // Absätze aus reinem Text der Lieferung, kein durchgereichtes Fremd-HTML.
    expect(variante.bodyHtml).toBe(S01.absaetzeDe.map((p: string) => `<p>${p}</p>`).join(""));
    // Die Kennzeichnung „Zuordnung unbestätigt" reist mit — sie ist hier der ehrliche Zustand:
    // die Kernaussage des Kandidaten ist die vom Import erzeugte, nicht der gelieferte Rohkörper.
    expect(variante.quellabgleich).toBe("unbestaetigt");
  });

  it("K2 · der Kandidat bleibt danach unverändert: Status neu, koId null, kein zweiter Eintrag", async () => {
    const { app, headers, kandidatId } = await aufbau();
    await hole(app, kandidatId, "de", headers);
    const queue = await app.inject({
      method: "GET",
      url: "/api/library/import/candidates",
      headers,
    });
    const kandidaten = queue.json() as { id: string; status: string; koId: string | null }[];
    expect(kandidaten).toHaveLength(1);
    expect({
      id: kandidaten[0]?.id,
      status: kandidaten[0]?.status,
      koId: kandidaten[0]?.koId,
    }).toEqual({ id: kandidatId, status: "neu", koId: null });
  });

  it("K3 · EN ist die Originalsprache — es gibt KEINE Leseübersetzung dorthin (404, kein Originaltext als Übersetzung)", async () => {
    const { app, headers, kandidatId } = await aufbau();
    const res = await hole(app, kandidatId, "en", headers);
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("NO_LESEVARIANTE");
    expect(res.body).not.toContain(S01.absatzEn);
  });

  it("K4 · ein Kandidat ohne passenden Datensatz der Lieferung bekommt keine erfundene Variante", async () => {
    const { app, headers, kandidatId } = await aufbau({ externalId: "999999999" });
    const res = await hole(app, kandidatId, "de", headers);
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("NO_LESEVARIANTE");
  });

  it("K5 · DERSELBE Kennungswert bei einem FREMDEN Provider bekommt keine Variante (Providerfilter)", async () => {
    const { app, headers, kandidatId } = await aufbau({ provider: "Jira" });
    const res = await hole(app, kandidatId, "de", headers);
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("NO_LESEVARIANTE");
    expect(res.body).not.toContain(S01.titelDe);
  });

  it("K6 · ohne Anmeldung kein Text — dieselbe Rechteschwelle wie die Warteschlange", async () => {
    const { app, kandidatId } = await aufbau();
    const ohne = await hole(app, kandidatId, "de");
    const queue = await app.inject({ method: "GET", url: "/api/library/import/candidates" });
    expect({ variante: ohne.statusCode, queue: queue.statusCode }).toEqual({
      variante: 401,
      queue: 401,
    });
    expect(ohne.body).not.toContain(S01.titelDe);
  });

  it("K7 · eine unbekannte Kandidaten-Kennung ist 404 — keine Auskunft über die Lieferung", async () => {
    const { app, headers } = await aufbau();
    const res = await hole(app, "gibt-es-nicht", "de", headers);
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("NOT_FOUND");
    expect(res.body).not.toContain(S01.titelDe);
  });

  it("K8 · ein Kandidat ohne Providerangabe zählt wie Confluence — dieselbe Regel wie am Wissensobjekt", async () => {
    // `importProviderKey(null)` ist „confluence" (library-analytics/src/repo.ts) — Altbestand ohne
    // Provider verliert seine Übersetzung damit NICHT. Diese Zeile hält die Regel fest, statt sie
    // dem Zufall zu überlassen.
    const services = buildServices();
    const app = buildApp(services);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "b@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "b@x.de", password: "secret123" },
    });
    const headers = { authorization: `Bearer ${login.json().token}` };
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/library/import/candidates",
      headers,
      payload: {
        items: [
          {
            title: S01.titelEn,
            statement: S01.absatzEn,
            type: "best_practice",
            category: "Onboarding",
            externalId: S01.confluenceId,
          },
        ],
      },
    });
    const id = (angelegt.json() as { id: string }[])[0]?.id ?? "";
    const res = await hole(app, id, "de", headers);
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe(S01.titelDe);
  });
});

// ================================================================================================
// JOB 3363 · RUNDE 2 — DER SPRACHPARAMETER IST EINGABE, NICHT NUR EIN TYP (BEN, Korrekturpflicht 1).
// ================================================================================================
//
// WAS BEN GEMESSEN HAT: `:lang` lief bis Runde 1 unmittelbar in einen dynamischen Feldzugriff auf
// den Datensatz der Lieferung (`record[sprache as "de" | "en" | "nl"]`). Die Typbehauptung ist zur
// Laufzeit NICHTS. `original_language` traf ein echtes Feld des Datensatzes (die Zeichenkette
// „en"), `constructor` traf den Prototyp (eine Funktion) — beide sind wahrheitswertig, also lief
// der Code weiter bis `text.paragraphs.length` und warf. Antwort: HTTP 500, reproduzierbar.
//
// DIE REGEL, DIE HIER GEMESSEN WIRD: Ein Sprachwert, den die Lieferung nicht als Sprache FÜHRT, ist
// keine Sprache — er bekommt dieselbe ruhige Antwort wie jede andere Sprache ohne Fassung: 404
// `NO_LESEVARIANTE`, ohne Text, ohne Serverausnahme. Der Unterschied zwischen „unbekannt" und
// „gefährlich" wird bewusst NICHT gemacht: er wäre eine Auskunft darüber, welche Zeichenketten im
// Datensatz zufällig existieren.
describe("JOB 3363 R2 · kein Sprachwert erreicht den Datensatz ungeprüft", () => {
  // Datensatzfelder, Prototypschlüssel und eine schlicht unbekannte Sprache — in EINER Liste, weil
  // sie alle dieselbe Antwort verdienen.
  const BOESE_SPRACHEN = [
    // Felder des Lieferungs-Datensatzes: treffen echte Zeichenketten.
    "original_language",
    "key",
    "translation_status",
    "confluence_id",
    "semantic_id",
    // Prototypschlüssel: treffen Funktionen bzw. Objekte.
    "constructor",
    "toString",
    "valueOf",
    "hasOwnProperty",
    "__proto__",
    // Schlicht unbekannt — die Lieferung führt nur „de" und „en".
    "fr",
    "nl",
    // Leer und Unfug.
    "%20",
    "0",
  ];

  it("K9 · jeder dieser Werte antwortet kontrolliert 404 NO_LESEVARIANTE — nie 500, nie Text", async () => {
    const { app, headers, kandidatId } = await aufbau();
    // DIE BUCHFÜHRUNG IST EINE `Map` UND KEIN OBJEKT — und das ist kein Zierrat, sondern derselbe
    // Fehler in klein: `befund["__proto__"] = 404` an einem gewöhnlichen Objekt legt kein Feld an,
    // sondern setzt den Prototyp; der Fall wäre still aus der Bilanz gefallen. Genau diese Sorte
    // Zugriff ist der Gegenstand dieses Tests.
    const befund = new Map<string, number>();
    for (const sprache of BOESE_SPRACHEN) {
      const res = await hole(app, kandidatId, sprache, headers);
      befund.set(sprache, res.statusCode);
      expect(res.json().error, `${sprache} nennt einen anderen Fehler`).toBe("NO_LESEVARIANTE");
      // Und ausdrücklich: KEIN Text der Lieferung, weder deutsch noch englisch.
      expect(res.body).not.toContain(S01.titelDe);
      expect(res.body).not.toContain(S01.titelEn);
    }
    expect([...befund.entries()]).toEqual(BOESE_SPRACHEN.map((s) => [s, 404]));
  });

  it("K10 · der GLEICHE Kandidat antwortet unmittelbar davor und danach auf DE unverändert 200", async () => {
    // Die Kalibrierung zu K9: die Sperre schaltet nicht die ganze Route ab. Ohne diesen Fall wäre
    // ein pauschales 404 für JEDE Sprache ebenfalls grün.
    const { app, headers, kandidatId } = await aufbau();
    const vorher = await hole(app, kandidatId, "de", headers);
    await hole(app, kandidatId, "constructor", headers);
    const nachher = await hole(app, kandidatId, "de", headers);
    expect({ vorher: vorher.statusCode, nachher: nachher.statusCode }).toEqual({
      vorher: 200,
      nachher: 200,
    });
    expect(nachher.json().title).toBe(S01.titelDe);
  });

  it("K11 · auch der LADEWEG am Wissensobjekt liest nur geführte Sprachen (dieselbe eine Regel)", async () => {
    // `ladeLesevarianten` griff mit derselben Typbehauptung in den Datensatz. Dort kommt die Sprache
    // zwar aus `paket.languages`, ist also heute kontrolliert — aber die Regel gehört an EINE Stelle,
    // nicht an die eine, die gerade auffiel. Gemessen am echten Ladeweg: die Bilanz nennt genau die
    // geführten Sprachen ohne die Originalsprache, und das Laden bleibt grün.
    const { app, headers } = await aufbau();
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/lesevarianten/laden",
      headers,
      payload: { package: "advisor-ict-en-v1" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().sprachen).toEqual(["de"]);
  });
});
