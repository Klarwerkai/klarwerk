// ================================================================================================
// JOB 3027 · R2 — DER TYP AM ENDPUNKT IST DER VERTRAG DES SERVERS, ZEICHEN FUER ZEICHEN.
// ================================================================================================
//
// DER BEFUND AUS RUNDE 1 (BEN, Korrekturpflicht 2): Der exakte Drahtvertrag stand in einem
// NEBENTYP, waehrend der Typ, der unmittelbar in `api.get<…>` steht, `confidentiality` und `origin`
// noch in der KO-Form fuehrte. Ein separater richtiger Hilfstyp genuegt nicht: gelesen wird, was am
// Endpunkt steht. Runde 2 loest das an der Wurzel — `KnowledgeObject` erlaubt die beiden Felder
// jetzt auch als `null` (die Leserouten senden es seit JOB 3009 wirklich so), und die Board-Zeile
// traegt sie als PFLICHTFELDER in der Serverform.
//
// DIESE DATEI IST DER WAECHTER DARUEBER, und sie misst in ZWEI Richtungen:
//
//   T · COMPILE-ZEIT. Die vier Felder des TATSAECHLICHEN Elements von
//       `endpoints.validation.board` werden auf EXAKTE Typgleichheit gegen den Serververtrag
//       (`BoardHerkunft` aus `services/validation`) geprueft — nicht auf Zuweisbarkeit. Eine
//       Zuweisbarkeitsprobe waere blind fuer die Verengung, die Runde 1 hatte: `Confidentiality`
//       ist an `Confidentiality | null` zuweisbar, und genau das war der Fehler.
//       Der Import des Endpunktmoduls ist bewusst ein reiner TYP-Import (`typeof import(…)`):
//       gemessen wird der Vertrag, nichts wird ausgefuehrt.
//
//   L · LAUFZEIT. Der Erzeuger des Servers (`mitHerkunft`) wird wirklich aufgerufen, und die
//       Client-Ableitung (`boardAuskunft`) liest SEINE Ausgabe. Damit haengt die Aussage nicht an
//       einem abgeschriebenen Fixture: aendert der Server seine Felder, faellt dieser Test — und
//       zwar mit den echten Schluesseln im Fehlertext.
//
// WARUM `.tsx` OHNE EIN EINZIGES JSX-ZEICHEN: der Typvergleich zieht `api/endpoints` und damit
// `api/client` (fetch, localStorage) in die Prüfung. Der Wurzel-Typprüfer ist Node-rein
// (`tsconfig.json`, lib ES2022 ohne DOM) — dort waere die Datei nicht prüfbar. Unter `.tsx` läuft
// sie im Web-Typprüfpfad `tsconfig.tests-tsx.json` (DOM-lib), der im Tor mitfährt.
import { describe, expect, it } from "vitest";

import type { ValidationBoardAuskunft } from "../../apps/web/src/api/types";
import { boardAuskunft } from "../../apps/web/src/lib/boardAuskunft";
import { mitHerkunft } from "../../services/validation";
import type { BoardHerkunft } from "../../services/validation/src/board-herkunft";

// ------------------------------------------------------------------------------------------------
// T · COMPILE-ZEIT
// ------------------------------------------------------------------------------------------------

/** Exakte Typgleichheit (beide Richtungen), nicht blosse Zuweisbarkeit. */
type Exakt<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

/** Das Element, das der Aufrufer von `endpoints.validation.board` wirklich in der Hand hat. */
type Endpunktzeile = Awaited<
  ReturnType<typeof import("../../apps/web/src/api/endpoints").endpoints.validation.board>
>[number];

// Jede Zeile hier ist ein Fehlschlag zur Compile-Zeit, sobald der Endpunkttyp vom Serververtrag
// abweicht. `true` ist die einzige zulaessige Belegung; jede Ungleichheit ergibt `false`.
const stufeIstServerform: Exakt<
  Endpunktzeile["confidentiality"],
  BoardHerkunft["confidentiality"]
> = true;
const beleglageIstServerform: Exakt<
  Endpunktzeile["confidentialityProvenance"],
  BoardHerkunft["confidentialityProvenance"]
> = true;
const herkunftIstServerform: Exakt<Endpunktzeile["origin"], BoardHerkunft["origin"]> = true;
// Die Quellenliste wird NICHT angezeigt (Lieferung 7), aber sie wird getragen — und zwar in der
// schlanken Uebersichtsform des Servers (drei Felder).
const quellenSindSchlank: Exakt<
  Endpunktzeile["originSources"][number],
  BoardHerkunft["originSources"][number]
> = true;
// Und der Drahtvertrag im Client ist derselbe wie das, was am Endpunkt steht — kein zweiter,
// nebenherlaufender „richtiger" Typ (das war der Befund aus Runde 1).
const vertragIstAmEndpunkt: Exakt<
  Pick<Endpunktzeile, keyof ValidationBoardAuskunft>,
  ValidationBoardAuskunft
> = true;

describe("JOB 3027 R2 · T: der Endpunkttyp ist zeichengleich mit dem Serververtrag", () => {
  it("alle fuenf Compile-Zeit-Gleichheiten halten", () => {
    // Der Beweis liegt im Compiler; dieser Fall haelt die Konstanten am Leben und macht den
    // Fehlschlag im Testlauf sichtbar, statt ihn nur im Typprüflauf zu melden.
    expect([
      stufeIstServerform,
      beleglageIstServerform,
      herkunftIstServerform,
      quellenSindSchlank,
      vertragIstAmEndpunkt,
    ]).toEqual([true, true, true, true, true]);
  });
});

// ------------------------------------------------------------------------------------------------
// L · LAUFZEIT — der echte Erzeuger des Servers, gelesen von der echten Ableitung des Clients
// ------------------------------------------------------------------------------------------------
describe("JOB 3027 R2 · L: die Client-Ableitung liest die ECHTE Serverausgabe", () => {
  it("der Server haengt genau die vier Felder an — nicht drei, nicht fuenf", () => {
    const angehaengt = Object.keys(mitHerkunft({})).sort();

    expect(angehaengt).toEqual(
      ["confidentiality", "confidentialityProvenance", "origin", "originSources"].sort(),
    );
  });

  it("ohne Einstufung sagt die Kette „nicht eingestuft“ — und ausdruecklich nicht „intern“", () => {
    const auskunft = boardAuskunft(mitHerkunft({}));

    expect(auskunft.stufe.lage).toBe("nicht_eingestuft");
    expect(auskunft.stufe.stufe).toBeNull();
    expect(auskunft.stufe.labelKey).toBe("val.stufe.nichtEingestuft");
    expect(auskunft.stufe.facetWert).not.toBe("intern");
    expect(auskunft.herkunft.lage).toBe("herkunft_unbekannt");
  });

  it("mit Einstufung und Herkunft reicht die Kette beide Werte unveraendert durch", () => {
    const auskunft = boardAuskunft(
      mitHerkunft({ confidentiality: "streng_vertraulich", origin: "word_addin" }),
    );

    expect(auskunft.stufe.lage).toBe("eingestuft");
    expect(auskunft.stufe.stufe).toBe("streng_vertraulich");
    expect(auskunft.stufe.labelKey).toBe("conf.level.streng_vertraulich");
    expect(auskunft.herkunft.lage).toBe("herkunft_bekannt");
    expect(auskunft.herkunft.labelKey).toBe("ko.originWordAddin.label");
  });

  it("eine UNGUELTIGE Stufe im Bestand wird zu „nicht eingestuft“, nicht zu „intern“", () => {
    // Dieselbe fail-safe Richtung wie am Server (`isValidConfidentiality` statt
    // `normalizeConfidentiality`): ein unbekannter Wert ist eine UNBEKANNTE Stufe.
    const auskunft = boardAuskunft(
      mitHerkunft({ confidentiality: "geheim" as never, origin: null }),
    );

    expect(auskunft.stufe.lage).toBe("nicht_eingestuft");
    expect(auskunft.stufe.facetWert).toBe("nicht_eingestuft");
  });

  it("ein Antwortstand OHNE die Felder ist die dritte Lage — der Server erzeugt sie nie", () => {
    // `mitHerkunft` liefert die Felder IMMER; die dritte Lage entsteht nur ausserhalb dieser Route
    // (alter Cache, anderer Lesepfad). Beide Richtungen an einer Stelle, damit die Unterscheidung
    // nicht theoretisch bleibt.
    expect(boardAuskunft({}).stufe.lage).toBe("auskunft_fehlt");
    expect(boardAuskunft({}).herkunft.lage).toBe("auskunft_fehlt");
    expect(boardAuskunft(mitHerkunft({})).stufe.lage).not.toBe("auskunft_fehlt");
  });
});
