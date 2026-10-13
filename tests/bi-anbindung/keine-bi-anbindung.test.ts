// ================================================================================================
// Aufnahme gesamt-bi-anbindung (R-0770 / R-2193) — DIE GRENZE AM HEUTIGEN BESTAND.
// ================================================================================================
//
// R-0770 (Notiz F-0770): „Ausgeschlossen ist die Anbindung fremder Werkzeuge, nicht die eigene
// Auswertung; der Datei-Export bleibt der offene Weg nach aussen." Die Einordnung steht in
// `docs/entscheidungen/bi-anbindung.md`. Diese Datei hält die dort behauptete Grenze fest:
//   B1  Kein Dienst-Schlüssel erreicht eine Auswertungs- oder Kennzahlenroute; der Vertrag der
//       Integrationsschnittstelle führt keine.
//   B2  Der MCP-Zugang bietet kein Auswertungswerkzeug.
//   B3  Server und Oberfläche kennen kein fremdes BI-Produkt.
//   B4  Die Klarstellung steht in Entscheidungsseite und Modulbeschreibung.
// Eigene Auswertung und Datei-Export halten `tests/admin-wissenskennzahlen/anzeige-und-export.test.ts`
// und `tests/library/library-export.test.ts`.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DIENST_RECHTE, DIENST_ROUTEN } from "../../services/app/src/dienst-schluessel";
import { INTEGRATIONS_VERTRAG } from "../../services/app/src/integrations-vertrag";
import { MCP_WERKZEUGE } from "../../services/app/src/routes/mcp-routes";
import { repoPfad } from "../support/repoPfad";

const AUSWERTUNG = /analytics|wissenskennzahlen|kennzahl|auswertung|\bbi\b/i;
const BI_PRODUKT = /power\s?bi|tableau|metabase|apache superset|looker|qlik/i;

function quelldateien(wurzel: string): string[] {
  return readdirSync(repoPfad(wurzel), { recursive: true, encoding: "utf8" })
    .filter((datei) => /\.(ts|tsx)$/.test(datei) && !datei.split(/[\\/]/).includes("node_modules"))
    .map((datei) => join(wurzel, datei));
}

describe("R-0770 · keine Anbindung fremder BI-Werkzeuge", () => {
  it("B1 kein Dienst-Recht und keine Dienst-Route führt zu einer Auswertung", () => {
    expect(DIENST_RECHTE.filter((recht) => AUSWERTUNG.test(recht))).toEqual([]);
    expect(DIENST_ROUTEN.filter((route) => AUSWERTUNG.test(route.pfad))).toEqual([]);
    expect(INTEGRATIONS_VERTRAG.filter((route) => AUSWERTUNG.test(route.pfad))).toEqual([]);
  });

  it("B2 der MCP-Zugang bietet kein Auswertungswerkzeug", () => {
    expect(MCP_WERKZEUGE.filter((w) => AUSWERTUNG.test(w.name))).toEqual([]);
  });

  it("B3 Server und Oberfläche nennen kein fremdes BI-Produkt", () => {
    const treffer = [...quelldateien("services"), ...quelldateien("apps/web/src")].filter((datei) =>
      BI_PRODUKT.test(readFileSync(repoPfad(datei), "utf8")),
    );
    expect(treffer).toEqual([]);
  });

  it("B4 die Klarstellung steht in Entscheidungsseite und Modulbeschreibung", () => {
    const satz = "Ausgeschlossen ist die Anbindung fremder Werkzeuge, nicht die eigene Auswertung";
    expect(readFileSync(repoPfad("docs/entscheidungen/bi-anbindung.md"), "utf8")).toContain(satz);
    const modul = readFileSync(repoPfad("specs/stories/library-analytics.md"), "utf8");
    expect(modul).toContain(satz);
    expect(modul).toContain("docs/entscheidungen/bi-anbindung.md");
  });
});
