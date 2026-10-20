// ================================================================================================
// produkt:20261011:assistenz-minimalistische-oberflaeche (UI-MIN-14/15) — DIE TÜREN DIESES AUFTRAGS
// STEHEN DECKUNGSGLEICH IN DER HTTP-API-REFERENZ.
// ================================================================================================
//
// Der globale Prüfstand `tests/architektur-vertrag/http-api-referenz.test.ts` ist im integrierten
// Hauptstand 674c37a2 rot: dort fehlen 144 fremde Routen (Richtlinien, Vorlagen, Chat, WOPI, …) in der
// Referenz. Er bleibt unverändert. Dieser Fall misst mit DERSELBEN Bühne, derselben Aufzählung und
// demselben Schlüssel nur die Türen, die dieser Auftrag eingeführt bzw. übernommen hat: den
// Begleiterkanal (`/api/me/klara/begleiter/**`, samt neuer Stopptür) und den Office-Kontext
// (`/api/klara/sessions/:id/office-kontext**`). Jede hat genau eine Zeile, keine ist erfunden.
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { baueBuehne, schliesseBuehnen } from "../beta-rollenabnahme/buehne";
import {
  AUTOMATISCHE_METHODEN,
  schluessel,
  zaehleRegistrierteRouten,
} from "../beta-rollenabnahme/registrierte-routen";
import { repoPfad } from "../support/repoPfad";

const REFERENZ = readFileSync(repoPfad("docs/architektur/http-api-referenz.md"), "utf8");
const ZEILE = /^\| `([A-Z]+)` \| `([^`]+)` \|(.*)\|\s*$/;

/** Die Türen dieses Auftrags — am Pfad erkannt, nicht aus einer Liste behauptet. */
const EIGEN = (k: string): boolean =>
  k.includes("/api/me/klara/begleiter") || /\/api\/klara\/sessions\/:\/office-kontext/.test(k);

let registriert: string[];

beforeAll(async () => {
  const buehne = await baueBuehne();
  const aufzaehlung = zaehleRegistrierteRouten(buehne.app);
  const automatisch: readonly string[] = AUTOMATISCHE_METHODEN;
  registriert = [
    ...new Set(
      aufzaehlung.routen
        .filter((r) => !automatisch.includes(r.methode))
        .map((r) => schluessel(r.methode, r.pfad)),
    ),
  ];
});

afterAll(schliesseBuehnen);

function referenzSchluessel(): string[] {
  const liste: string[] = [];
  for (const zeile of REFERENZ.split("\n")) {
    const m = ZEILE.exec(zeile);
    if (m) {
      liste.push(schluessel(m[1] ?? "", m[2] ?? ""));
    }
  }
  return liste;
}

describe("UI-MIN-14/15 · Begleiterkanal und Office-Kontext in der API-Referenz", () => {
  it("jede eigene registrierte Tür hat genau eine Zeile; keine eigene Zeile ist erfunden", () => {
    const eigeneRouten = registriert.filter(EIGEN).sort();
    const eigeneZeilen = referenzSchluessel().filter(EIGEN);
    // Kalibrierung: der Kanal mit Stopptür und Klärungstür (7, Nacharbeit 58) und der
    // Office-Kontext (3) und die erhaltene Browser-Sitzung (1) sind wirklich verdrahtet.
    expect(eigeneRouten).toContain(
      schluessel("POST", "/api/me/klara/begleiter/adapter/:instanz/aktionen/:aktion/stopp"),
    );
    expect(eigeneRouten).toContain(
      schluessel("POST", "/api/me/klara/begleiter/auftraege/:schluessel/klaeren"),
    );
    expect(eigeneRouten).toHaveLength(11);
    expect(eigeneRouten.filter((k) => !eigeneZeilen.includes(k))).toEqual([]);
    expect(eigeneZeilen.filter((k) => !eigeneRouten.includes(k))).toEqual([]);
    expect([...eigeneZeilen].sort()).toEqual(eigeneRouten);
  });
});
