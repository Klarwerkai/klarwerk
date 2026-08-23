// ================================================================================================
// JOB 2065 D3/D4/D5 · I39 — DER WAECHTER UEBER DIE ZENTRALE WIRD SELBST GEPRUEFT.
// ================================================================================================
//
// `tools/zentrale-drift.ts` meldet, wenn die von Hand gepflegte Zentrale
// (`_relay/board/klarwerk-board.html`) vom Register (`OFFEN.md`) abweicht.
//
// WARUM AN SYNTHETISCHEN STAENDEN: `_relay/` steht in `.gitignore:25`. In jedem frischen Clone und
// in der Automatisierung gibt es die Zentrale nicht. Ein Fall, der den echten Bestand braeuchte,
// waere hier uebersprungen — und ein uebersprungener Fall belegt nichts.
//
// ES GIBT EINE ERHEBUNG UND ZWEI AUFRUFER: `tools/check` faehrt sie ueber
// `tools/zentrale-drift.sh` im Tor, dieser Test misst dieselben Funktionen UND faehrt den Starter
// zusaetzlich als Unterprozess. Ein Test, der nur die Funktionen ruft, belegt die KETTE nicht.
//
// D4 — DIE TRENNUNG DER BEFUNDE: FALSCH_OFFEN ist ein Fehler, UNGENANNT ist eine Zahl. Die
// kuratierte Auswahl ist gewollt und darf keinen Lauf beenden.
//
// D5 — DIE TRENNUNG DER FUNDORTE: D4 war in jeder Pruefstufe gruen, hat vier echte Driftfaelle
// gefunden und musste trotzdem zurueckgerollt werden — die Fundstelle ist das Board, und das darf
// niemand anfassen. Ab hier entscheidet der FUNDORT ueber Melden oder Sperren. Die Faelle
// „Board-Fund meldet" und „aenderbarer Fund sperrt" sichern genau diese Grenze.
//
// DIE KALIBRIERUNGEN TRAGEN DIESE DATEI. Ohne sie waere jedes Gruen wertlos: es koennte auch davon
// kommen, dass der Waechter gar nichts findet.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BOARD_ADRESSE,
  ZENTRALE_DATEI,
  istUnantastbar,
  liesRegister,
  liesZentrale,
  messeDrift,
  pruefeZentraleDrift,
  restzahlZeile,
} from "../../tools/zentrale-drift";

const WURZEL = join(import.meta.dirname, "../..");

// Ein Registerausschnitt in der Form, die OFFEN.md wirklich hat: Kopfzeile, Trennzeile,
// fuenf Spalten (Kennung | Zustand | Anker | Sache | Warum).
const REGISTER = `
**Stand: 23.08.2026**

## 1 — Entscheidungen

| Kennung | Zustand | Anker | Sache | Warum |
|---|---|---|---|---|
| S7 | ERLEDIGT | — | liefern wir aus | weil es entschieden ist |
| S2 | ERLEDIGT | — | bedingtes GO | dito |
| I39 | OFFEN | NACH-VORTEST | Die Zentrale hat keinen Erzeuger | Disziplin ueberlebt keine Nacht |
| G25 | BEFUND | — | ein offener Befund | trifft den Kernnutzen |
`;

function zentraleMit(sektionen: { titel: string; text: string }[]): string {
  // Die echte Zentrale traegt ihre Kennungen mal als <span class="kennung">, mal in <code>, mal im
  // Fliesstext. Die Vorrichtung baut deshalb alle drei Formen, nicht nur die bequemste.
  return sektionen
    .map((s) => `<section><h2><span class="nr">1</span>${s.titel}</h2><p>${s.text}</p></section>`)
    .join("\n");
}

/** Ein synthetischer Bestand auf der Platte. `wohin` entscheidet ueber Melden oder Sperren. */
function baueBestand(
  leseflaeche: string | null,
  register = REGISTER,
  wohin: string = ZENTRALE_DATEI,
): string {
  const wurzel = mkdtempSync(join(tmpdir(), "kw-job2065-"));
  writeFileSync(join(wurzel, "OFFEN.md"), register, "utf-8");
  if (leseflaeche !== null) {
    mkdirSync(dirname(join(wurzel, wohin)), { recursive: true });
    writeFileSync(join(wurzel, wohin), leseflaeche, "utf-8");
  }
  return wurzel;
}

/** Den echten Starter fahren — denselben, den `tools/check` ruft. */
function fahreStarter(wurzel: string, wohin: string = ZENTRALE_DATEI) {
  const r = spawnSync("./tools/zentrale-drift.sh", [wurzel, wohin], {
    cwd: WURZEL,
    encoding: "utf-8",
  });
  return { code: r.status, aus: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

// Eine Zentrale mit GENAU dem Fehler vom 31.07.: S7 ist im Register erledigt und steht hier
// trotzdem als Handlung.
const MIT_DRIFT = zentraleMit([
  { titel: "Bei dir offen", text: "Entscheidung S7 wartet auf dich." },
]);
// Der Sollstand: nennt eine offene Kennung, laesst die andere bewusst weg.
const KURATIERT = zentraleMit([
  { titel: "Jetzt dran", text: "Wir arbeiten an I39." },
  { titel: "Entschieden", text: "S7 und S2 sind beantwortet." },
]);

describe("JOB 2065 I39 · der Zentralen-Waechter meldet die Drift", () => {
  it("liest das Register wie der Erzeuger: Zustaende je Kennung, Kopf- und Trennzeile fallen weg", () => {
    const register = liesRegister(REGISTER);

    expect([...register.keys()].sort()).toEqual(["G25", "I39", "S2", "S7"]);
    expect(register.get("S7")).toEqual(["ERLEDIGT"]);
    expect(register.get("I39")).toEqual(["OFFEN"]);
    expect(register.get("Kennung"), "die Kopfzeile darf keine Kennung werden").toBeUndefined();
  });

  it("eine Kennung mit ZWEI Registerzeilen behaelt BEIDE Zustaende — sonst bleibt ein Widerspruch unsichtbar", () => {
    // Acht Kennungen tragen im echten Register zwei Zeilen. Wer nur die erste nimmt, sieht die
    // zweite nie — das war die Parserschwaeche aus JOB 2013 D2, hier von vornherein vermieden.
    const register = liesRegister(
      `${REGISTER}| S7 | OFFEN | — | dieselbe Kennung, zweite Zeile | … |\n`,
    );

    expect(register.get("S7")).toEqual(["ERLEDIGT", "OFFEN"]);
  });

  it("FALSCH_OFFEN — eine im Register abgeschlossene Kennung steht in einer Handlungssektion", () => {
    const register = liesRegister(REGISTER);
    const zentrale = liesZentrale(
      zentraleMit([
        {
          titel: "Bei dir offen",
          text: 'Entscheidung <span class="kennung">S7</span> wartet auf dich.',
        },
      ]),
      new Set(register.keys()),
    );

    const drift = messeDrift(register, zentrale);

    expect(drift.falschOffen.map((f) => f.kennung)).toEqual(["S7"]);
    expect(drift.falschOffen[0]?.sektion).toContain("Bei dir offen");
    expect(drift.falschOffen[0]?.imRegister).toEqual(["ERLEDIGT"]);
  });

  it("KALIBRIERUNG — dieselbe Sektion mit einer im Register OFFENEN Kennung ergibt KEINEN Fund", () => {
    // Ohne diesen Fall koennte der Fund oben auch davon kommen, dass jede Kennung in einer
    // Handlungssektion gemeldet wird. Dann waere der Waechter ein Rauschgenerator.
    const register = liesRegister(REGISTER);
    const zentrale = liesZentrale(
      zentraleMit([{ titel: "Bei dir offen", text: "Punkt I39 liegt bei dir." }]),
      new Set(register.keys()),
    );

    expect(messeDrift(register, zentrale).falschOffen).toEqual([]);
  });

  it("KALIBRIERUNG — dieselbe abgeschlossene Kennung unter „Entschieden“ ist KEIN Fund", () => {
    // Die Sektionen „Geplant", „Entschieden" und „Verlauf" duerfen Abgeschlossenes nennen; das ist
    // ihr Zweck. Meldete der Waechter auch dort, waere er nach dem ersten Lauf abgeschaltet.
    const register = liesRegister(REGISTER);
    const zentrale = liesZentrale(
      zentraleMit([{ titel: "Entschieden", text: "S7 und S2 sind beantwortet." }]),
      new Set(register.keys()),
    );

    expect(messeDrift(register, zentrale).falschOffen).toEqual([]);
  });

  it("eine Kennung mit einer offenen UND einer abgeschlossenen Zeile gilt NICHT als falsch offen", () => {
    const register = liesRegister(`${REGISTER}| S7 | OFFEN | — | zweite Zeile, noch offen | … |\n`);
    const zentrale = liesZentrale(
      zentraleMit([{ titel: "Bei dir offen", text: "S7 steht hier." }]),
      new Set(register.keys()),
    );

    expect(
      messeDrift(register, zentrale).falschOffen,
      "solange EINE Zeile offen ist, gehoert die Kennung zu Recht in eine Handlungssektion",
    ).toEqual([]);
  });

  it("UNGENANNT — was das Register offen fuehrt und die Lesefläche nirgends nennt, wird gezaehlt", () => {
    const register = liesRegister(REGISTER);
    const zentrale = liesZentrale(
      zentraleMit([{ titel: "Jetzt dran", text: "Wir arbeiten an I39." }]),
      new Set(register.keys()),
    );

    const drift = messeDrift(register, zentrale);

    expect(drift.offenImRegister, "I39 (OFFEN) und G25 (BEFUND) gelten beide als offen").toBe(2);
    expect(drift.genanntInZentrale).toBe(1);
    expect(drift.ungenannt).toEqual(["G25"]);
  });

  it("KALIBRIERUNG — der Waechter findet eine Kennung auch im blossen FLIESSTEXT, nicht nur in der Marke", () => {
    const register = liesRegister(REGISTER);
    const nurText = liesZentrale(
      zentraleMit([{ titel: "Bei dir offen", text: "Die Sache S7 ist noch zu klaeren." }]),
      new Set(register.keys()),
    );
    const inCode = liesZentrale(
      zentraleMit([
        { titel: "Bei dir offen", text: "Die Sache <code>S7</code> ist noch zu klaeren." },
      ]),
      new Set(register.keys()),
    );

    expect(nurText[0]?.kennungen).toEqual(["S7"]);
    expect(inCode[0]?.kennungen).toEqual(["S7"]);
  });

  it("KALIBRIERUNG — was das Register nicht fuehrt, wird nicht als Kennung gezaehlt", () => {
    // „Ship 11" und Versionsnummern haben dieselbe Form wie eine Kennung. Zaehlten sie mit, waere
    // jede Zahl auf der Zentrale eine Fundstelle und die Zahl „genannt" wertlos.
    const register = liesRegister(REGISTER);
    const zentrale = liesZentrale(
      zentraleMit([{ titel: "Stand", text: "Ship 11, Fassung V2 und Anlage A4 sind live." }]),
      new Set(register.keys()),
    );

    expect(zentrale[0]?.kennungen).toEqual([]);
  });
});

// ================================================================================================
// D4 — DIE AUSWAHL IST KEIN DEFEKT.
// ================================================================================================
describe("JOB 2065 I39 · die kuratierte Auswahl macht den Lauf NICHT rot", () => {
  it("POSITIVTEST — kuratierter Sollstand: GEPFLEGT, obwohl eine offene Kennung fehlt", () => {
    const befund = pruefeZentraleDrift(baueBestand(KURATIERT));

    expect(befund.art).toBe("GEPFLEGT");
    expect(befund.art !== "ABWESEND" && befund.drift.ungenannt).toEqual(["G25"]);
  });

  it("die Restzahl wird trotzdem BERICHTET — eine Zahl, die niemand sieht, ist keine Zahl (I41)", () => {
    const befund = pruefeZentraleDrift(baueBestand(KURATIERT));
    if (befund.art === "ABWESEND") {
      throw new Error("Vorbedingung verfehlt: der Bestand wurde nicht gefunden");
    }

    const zeile = restzahlZeile(befund.drift);

    expect(zeile).toContain("1 von 2");
    expect(zeile, "die Zahl darf nicht als Fehler klingen").toContain("kein Fehler");
  });

  it("NEGATIVTEST — wird eine Handlungskennung im Register abgeschlossen, kippt derselbe Stand auf DRIFT", () => {
    // Dieselbe Zentrale, nur das Register waechst um eine Zeile: aus I39 wird ERLEDIGT. Das ist der
    // echte Vorgang, gegen den der Waechter steht — die Zentrale bleibt stehen, das Register zieht
    // weiter.
    const nachher = REGISTER.replace(
      "| I39 | OFFEN | NACH-VORTEST |",
      "| I39 | ERLEDIGT | NACH-VORTEST |",
    );
    const befund = pruefeZentraleDrift(baueBestand(KURATIERT, nachher));

    expect(befund.art).toBe("DRIFT");
    expect(befund.art !== "ABWESEND" && befund.drift.falschOffen.map((f) => f.kennung)).toEqual([
      "I39",
    ]);
  });
});

// ================================================================================================
// D5 — DER FUNDORT ENTSCHEIDET UEBER MELDEN ODER SPERREN.
// ================================================================================================
describe("JOB 2065 I39 · melden statt sperren, wo niemand beheben darf", () => {
  it("die Unterscheidung ist eine PFADFRAGE — `_relay/` gehoert dem Kopf, alles in git ist unser", () => {
    // Beide Richtungen, sonst belegt die Zuordnung nichts: eine Funktion, die immer „unantastbar"
    // sagt, wuerde jeden Fund verstummen lassen.
    expect(istUnantastbar("_relay/board/klarwerk-board.html")).toBe(true);
    expect(istUnantastbar("_relay/kopf/klarwerk-offen.html")).toBe(true);
    expect(istUnantastbar("docs/uebersicht.html"), "docs/ liegt in git — dort darf man").toBe(
      false,
    );
    expect(istUnantastbar("tools/zentrale-drift.ts")).toBe(false);
    expect(istUnantastbar("apps/web/public/board.html")).toBe(false);
  });

  it("BOARD-FUND — echte Drift im Board: der Befund wird gemeldet, aber als melden markiert", () => {
    const befund = pruefeZentraleDrift(baueBestand(MIT_DRIFT));

    expect(befund.art).toBe("DRIFT");
    expect(
      befund.art === "DRIFT" && befund.meldenNichtSperren,
      "ein Fund im Board darf den Betrieb nicht anhalten",
    ).toBe(true);
  });

  it("AENDERBARER FUND — dieselbe Drift in einem verfolgten Pfad: derselbe Befund, aber sperrend", () => {
    // Dieselben Daten, nur der Fundort wechselt. Damit haengt die Entscheidung nachweislich am
    // Pfad und nicht an der Art des Fundes.
    const befund = pruefeZentraleDrift(
      baueBestand(MIT_DRIFT, REGISTER, "docs/uebersicht.html"),
      "docs/uebersicht.html",
    );

    expect(befund.art).toBe("DRIFT");
    expect(
      befund.art === "DRIFT" && befund.meldenNichtSperren,
      "wer beheben darf, muss auch beheben",
    ).toBe(false);
  });

  it("UEBER DEN STARTER — Board-Drift: Code 0, aber ALLE Fundstellen und die Adresse in der Ausgabe", () => {
    // Das ist der Kern von D5: der Betrieb laeuft weiter, und trotzdem geht der Befund nicht
    // verloren. Gemeldet ohne Fundstellen waere so schlecht wie gesperrt.
    const { code, aus } = fahreStarter(baueBestand(MIT_DRIFT));

    expect(code, aus).toBe(0);
    expect(aus, "die Fundstelle gehoert in die Ausgabe").toContain("FALSCH_OFFEN");
    expect(aus).toContain("S7");
    expect(aus).toContain("Bei dir offen");
    expect(aus, "wohin der Befund gehoert, muss dastehen").toContain(BOARD_ADRESSE);
    expect(aus).toContain("NICHT gesperrt");
  });

  it("UEBER DEN STARTER — dieselbe Drift an einer aenderbaren Stelle: Code 1", () => {
    const { code, aus } = fahreStarter(
      baueBestand(MIT_DRIFT, REGISTER, "docs/uebersicht.html"),
      "docs/uebersicht.html",
    );

    expect(code, aus).toBe(1);
    expect(aus).toContain("FALSCH_OFFEN");
    expect(aus, "hier gibt es keine Ausrede").toContain("hier zu beheben");
    expect(aus).not.toContain(BOARD_ADRESSE);
  });

  it("UEBER DEN STARTER — ein sauberer kuratierter Bestand: Code 0 und die Restzahl in der Ausgabe", () => {
    const { code, aus } = fahreStarter(baueBestand(KURATIERT));

    expect(code, aus).toBe(0);
    expect(aus).toContain("Lesefläche gepflegt");
    expect(aus, "die Auswahl wird berichtet, nicht beklagt").toContain("kein Fehler");
  });

  it("UEBER DEN STARTER — ohne Lesefläche: Code 2 und „NICHTS gemessen“, nicht Code 0", () => {
    // Die festgelegte ABWESEND-Politik, gefahren statt behauptet. Code 2 ist weder gruen noch rot:
    // `tools/check` meldet ihn und laeuft weiter, denn `_relay/` fehlt in jedem frischen Clone.
    const { code, aus } = fahreStarter(baueBestand(null));

    expect(code, aus).toBe(2);
    expect(aus).toContain("NICHTS gemessen");
    expect(code, "eine fehlende Lesefläche darf nie als gepflegt durchgehen").not.toBe(0);
  });

  it("ABWESEND ist auch in der Funktion ein eigener Befund und NIEMALS „gepflegt“", () => {
    const befund = pruefeZentraleDrift("/tmp/kw-job2065-eine-wurzel-die-es-nicht-gibt");

    expect(befund.art).toBe("ABWESEND");
    expect(befund.art).not.toBe("GEPFLEGT");
  });
});

// ================================================================================================
// D4/D5 — DIE KETTE, NICHT NUR DIE FUNKTION.
// ================================================================================================
describe("JOB 2065 I39 · der Aufrufer im Tor", () => {
  it("AUFRUFER — `tools/check` ruft den Waechter, und nur Code 1 haelt das Tor an", () => {
    // Das ist die Zeile, die bens „hat keinen realen Aufrufer" beantwortet. Faellt sie weg oder
    // wird der Rueckgabewert nicht mehr ausgewertet, faellt dieser Fall — der Waechter kann dann
    // nicht still verwaisen, und er kann auch nicht heimlich wieder zum Sperrer werden.
    const tor = readFileSync(join(WURZEL, "tools/check"), "utf-8");

    expect(tor, "tools/check muss den Starter rufen").toContain("./tools/zentrale-drift.sh");
    expect(tor, "der Rueckgabewert muss ausgewertet werden").toContain("zentrale_rc");
    expect(tor, "NUR Code 1 darf das Tor anhalten").toContain('[ "$zentrale_rc" = "1" ]');
    expect(tor, "Code 2 darf nicht abbrechen").not.toContain('[ "$zentrale_rc" = "2" ]');
  });
});
