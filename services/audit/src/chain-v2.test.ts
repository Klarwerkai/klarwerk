import { describe, expect, it } from "vitest";
import {
  GENESIS,
  auditMaterialV2,
  canonicalJson,
  hashEntry,
  hashEntryV1,
  hashEntryV2,
  inspectChain,
  verifyChain,
} from "./chain";
import type { AuditEntry } from "./types";

// ================================================================================================
// JOB 498 · D8 — AUDIT-HASHVERSION V2: KANONISCH, DOMAENENGETRENNT, VERSIONSGEBUNDEN
// ================================================================================================
//
// WAS V1 NICHT KANN, an genau drei Stellen (D6 §5.1, D7 §8.1):
//
//   1. KEINE DOMAENENTRENNUNG UND KEINE FELDGRENZE. V1 verbindet die Felder mit einem einzelnen
//      `|`. Ein Feldwert, der selbst ein `|` traegt, verschiebt die Grenze — zwei VERSCHIEDENE
//      Eintraege erzeugen dasselbe Material. Der Fall `Trennzeichenkollision` unten fuehrt das
//      an echten Werten vor, statt es zu behaupten.
//   2. KEINE VERSION IM MATERIAL. Wer `hashVersion` auf 1 zuruecksetzt, ohne neu zu rechnen,
//      bliebe unbemerkt. Deshalb ist die Version das LETZTE Feld des V2-Materials.
//   3. `JSON.stringify(payload)` folgt der JS-Einfuegereihenfolge, `jsonb` liest kanonisch
//      sortiert zurueck — der belegte Livebefund (871 Eintraege, 182 Abweichungen).
//
// WAS HIER AUSDRUECKLICH NICHT PASSIERT: V1 wird nicht angefasst. `hashEntry` behaelt Zeichen fuer
// Zeichen sein heutiges Material; der Altbestand bleibt bitgenau pruefbar. V2 kommt DANEBEN.

/** Feldtrenner des V2-Materials (UNIT SEPARATOR). Als Escape geschrieben, nicht als rohes Byte. */
const US = String.fromCharCode(0x1f);
/** Trenner zwischen Laengenpraefix und Feldwert. */
const NUL = String.fromCharCode(0x00);

// ------------------------------------------------------------------------------------------------
// Hilfen
// ------------------------------------------------------------------------------------------------

/** Ein V1-Eintrag: ohne `hashVersion`, gehasht wie seit jeher. */
function siegelV1(partial: Omit<AuditEntry, "hash">): AuditEntry {
  return { ...partial, hash: hashEntry(partial) };
}

/** Ein V2-Eintrag: `hashVersion: 2` steht IM Material, nicht daneben. */
function siegelV2(partial: Omit<AuditEntry, "hash" | "hashVersion">): AuditEntry {
  const mitVersion = { ...partial, hashVersion: 2 };
  return { ...mitVersion, hash: hashEntryV2(mitVersion) };
}

function basis(seq: number, prevHash: string, action = "test.action") {
  return {
    seq,
    at: `2026-08-17T10:0${seq}:00.000Z`,
    actor: "actor-1",
    action,
    target: `ko-${seq}`,
    payload: { a: 1 } as Record<string, unknown>,
    prevHash,
  };
}

// ------------------------------------------------------------------------------------------------
// 1 — Der normative Unicode-Sollvektor
// ------------------------------------------------------------------------------------------------

// Auftrag §5.3 / D7 §8.2. Die Zahlen sind nicht abgeschrieben, sondern hier nachgerechnet: das
// Material ist 118 BYTES lang, und `len` ist die UTF-8-BYTEZAHL, niemals die Zeichenzahl.
const VEKTOR: Omit<AuditEntry, "hash"> = {
  seq: 1,
  at: "2026-01-01T00:00:00.000Z",
  actor: "anna",
  action: "ko.created",
  target: "ko-ä",
  payload: { grösse: 1, z: "ß" },
  prevHash: "GENESIS",
  hashVersion: 2,
};

const VEKTOR_SOLLHASH = "5c6e2fb5ea89e6fa8b7e8701f0cace39b59ef2ce5da8afdc309ff59beac7b5d8";

describe("JOB 498 D8 · der normative V2-Testvektor", () => {
  it("das Material ist exakt 118 Bytes lang", () => {
    expect(Buffer.byteLength(auditMaterialV2(VEKTOR), "utf8")).toBe(118);
  });

  it("der Sollhash wird zeichengenau getroffen", () => {
    expect(hashEntryV2(VEKTOR)).toBe(VEKTOR_SOLLHASH);
  });

  it("das Material traegt Domaene, Trenner und Feldfolge in der vorgeschriebenen Form", () => {
    const material = auditMaterialV2(VEKTOR);
    expect(material.startsWith("klarwerk.audit.v2")).toBe(true);
    // Acht Felder, also acht Trenner: einer nach der Domaene, sieben zwischen den Feldern.
    expect(material.split(US)).toHaveLength(9);
    // Die Version ist das LETZTE Feld — daran haengt die Downgrade-Erkennung weiter unten.
    expect(material.endsWith(`1${NUL}2`)).toBe(true);
  });

  it("`len` ist die BYTEZAHL, nicht die Zeichenzahl — zweifach belegt", () => {
    const material = auditMaterialV2(VEKTOR);
    // "ko-ä": 5 Bytes, 4 Zeichen. Eine Zeichenzaehlung schriebe hier 4.
    expect("ko-ä").toHaveLength(4);
    expect(Buffer.byteLength("ko-ä", "utf8")).toBe(5);
    expect(material).toContain(`5${NUL}ko-ä`);
    // Die kanonisierte Payload: 22 Bytes, 20 Zeichen. Eine Zeichenzaehlung schriebe hier 20.
    const nutzlast = canonicalJson(VEKTOR.payload);
    expect(nutzlast).toHaveLength(20);
    expect(Buffer.byteLength(nutzlast, "utf8")).toBe(22);
    expect(material).toContain(`22${NUL}${nutzlast}`);
  });
});

// ------------------------------------------------------------------------------------------------
// 2 — Trennzeichenkollision: der Mangel, den V2 baulich schliesst
// ------------------------------------------------------------------------------------------------

describe("JOB 498 D8 · Trennzeichenkollision", () => {
  // Zwei fachlich VERSCHIEDENE Eintraege. In V1 ergeben sie dasselbe Material, weil `|` sowohl
  // Trenner als auch Inhalt ist.
  const gemeinsam = {
    seq: 7,
    at: "2026-08-17T12:00:00.000Z",
    target: "ko-7",
    payload: {} as Record<string, unknown>,
    prevHash: GENESIS,
  };
  const linksImActor: Omit<AuditEntry, "hash"> = { ...gemeinsam, actor: "a|b", action: "c" };
  const linksInDerAction: Omit<AuditEntry, "hash"> = { ...gemeinsam, actor: "a", action: "b|c" };

  it("V1 kollidiert nachweislich — derselbe Hash fuer zwei verschiedene Eintraege", () => {
    // Das ist KEINE Behauptung ueber einen Mangel, sondern seine Vorfuehrung. Der Fall steht hier,
    // damit die Zusage von V2 einen gemessenen Gegenstand hat.
    expect(linksImActor.actor).not.toBe(linksInDerAction.actor);
    expect(linksImActor.action).not.toBe(linksInDerAction.action);
    expect(hashEntry(linksImActor)).toBe(hashEntry(linksInDerAction));
  });

  it("V2 trennt sie — die Feldgrenze steht in der Laenge, nicht im Trennzeichen", () => {
    const a = { ...linksImActor, hashVersion: 2 };
    const b = { ...linksInDerAction, hashVersion: 2 };
    expect(hashEntryV2(a)).not.toBe(hashEntryV2(b));
    // Und der Grund ist sichtbar: die Laengenpraefixe unterscheiden sich.
    expect(auditMaterialV2(a)).toContain(`3${NUL}a|b`);
    expect(auditMaterialV2(b)).toContain(`3${NUL}b|c`);
  });

  it("die Domaenenkennung schliesst aus, dass ein V1-Material je ein V2-Material ist", () => {
    expect(auditMaterialV2({ ...linksImActor, hashVersion: 2 })).toContain("klarwerk.audit.v2");
  });
});

// ------------------------------------------------------------------------------------------------
// 3 — canonicalJson: Objektschluessel nach Codepoint, Arrays unangetastet
// ------------------------------------------------------------------------------------------------

describe("JOB 498 D8 · canonicalJson", () => {
  it("sortiert Objektschluessel rekursiv, nicht nur auf der obersten Ebene", () => {
    expect(canonicalJson({ b: { d: 1, c: 2 }, a: 3 })).toBe('{"a":3,"b":{"c":2,"d":1}}');
  });

  it("sortiert nach UNICODE-CODEPOINT — ein Astralzeichen entlarvt die UTF-16-Sortierung", () => {
    const grinsen = "\u{1F600}"; // U+1F600, Codepoint 128512
    const ersatzzeichen = "�"; // U+FFFD, Codepoint 65533
    // NACH CODEPOINT gehoert U+FFFD zuerst.
    expect(ersatzzeichen.codePointAt(0)).toBeLessThan(grinsen.codePointAt(0) as number);
    // Die eingebaute Sortierung vergleicht UTF-16-Einheiten und dreht die Reihenfolge um:
    // das Surrogat 0xD83D liegt vor 0xFFFD. Genau daran scheitert eine naive Umsetzung.
    expect([grinsen, ersatzzeichen].sort()).toEqual([grinsen, ersatzzeichen]);
    // Die Kanonisierung muss trotzdem nach Codepoint ordnen.
    expect(canonicalJson({ [grinsen]: 1, [ersatzzeichen]: 2 })).toBe(
      `{${JSON.stringify(ersatzzeichen)}:2,${JSON.stringify(grinsen)}:1}`,
    );
  });

  it("laesst die Arrayreihenfolge unveraendert — sie ist Inhalt, keine Normierung", () => {
    // Der Pin aus inspect-chain.test.ts, hier auf der Kanonisierung selbst: `["b","a"]` ist eine
    // INHALTSAENDERUNG gegenueber `["a","b"]` und darf nicht wegsortiert werden.
    expect(canonicalJson({ ids: ["b", "a"] })).toBe('{"ids":["b","a"]}');
    expect(canonicalJson({ ids: ["a", "b"] })).not.toBe(canonicalJson({ ids: ["b", "a"] }));
  });

  it("kanonisiert Arrayelemente elementweise, ohne sie umzustellen", () => {
    expect(canonicalJson({ liste: [{ b: 1, a: 2 }, "x"] })).toBe('{"liste":[{"a":2,"b":1},"x"]}');
  });

  it("dieselbe Payload in anderer Einfuegereihenfolge ergibt dasselbe V2-Material", () => {
    // Das ist der Livebefund, baulich geschlossen: der jsonb-Roundtrip aendert die Reihenfolge,
    // nicht den Inhalt — und V2 hasht den Inhalt.
    const geschrieben = { zulu: "z", alpha: 1, mike: { yankee: true, bravo: [3, 2, 1] } };
    const zurueckgelesen = { mike: { bravo: [3, 2, 1], yankee: true }, alpha: 1, zulu: "z" };
    expect(canonicalJson(geschrieben)).toBe(canonicalJson(zurueckgelesen));
    const a = { ...basis(1, GENESIS), payload: geschrieben, hashVersion: 2 };
    const b = { ...basis(1, GENESIS), payload: zurueckgelesen, hashVersion: 2 };
    expect(hashEntryV2(a)).toBe(hashEntryV2(b));
  });
});

// ------------------------------------------------------------------------------------------------
// 4 — V1 bleibt unberuehrt (D6 T1)
// ------------------------------------------------------------------------------------------------

describe("JOB 498 D8 · V1 bleibt bitgenau (T1)", () => {
  it("`hashEntryV1` ist derselbe Hash wie `hashEntry` — der Zweitname aendert nichts", () => {
    const e = basis(1, GENESIS);
    expect(hashEntryV1(e)).toBe(hashEntry(e));
  });

  it("ein Eintrag OHNE hashVersion wird als V1 geprueft und verifiziert", () => {
    const e1 = siegelV1(basis(1, GENESIS));
    expect(e1.hashVersion).toBeUndefined();
    expect(verifyChain([e1])).toBe(true);
    expect(inspectChain([e1]).ok).toBe(true);
  });

  it("`hashVersion: 1` waehlt denselben V1-Hash wie ein fehlendes Feld", () => {
    const ohne = basis(1, GENESIS);
    expect(hashEntry({ ...ohne, hashVersion: 1 })).toBe(hashEntry(ohne));
    expect(verifyChain([siegelV1({ ...ohne, hashVersion: 1 })])).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------
// 5 — V2-Eintraege und die gemischte Kette (D6 T3)
// ------------------------------------------------------------------------------------------------

describe("JOB 498 D8 · V2 und Mischketten", () => {
  it("ein V2-Eintrag verifiziert", () => {
    const e = siegelV2(basis(1, GENESIS));
    expect(e.hashVersion).toBe(2);
    expect(verifyChain([e])).toBe(true);
  });

  it("die Version haengt IM Material — dieselben Felder, andere Version, anderer Hash", () => {
    const felder = basis(1, GENESIS);
    expect(hashEntryV2({ ...felder, hashVersion: 2 })).not.toBe(hashEntry(felder));
  });

  it("Mischkette [V1, V2, V1] bleibt vollstaendig gueltig (T3)", () => {
    const e1 = siegelV1(basis(1, GENESIS));
    const e2 = siegelV2(basis(2, e1.hash));
    const e3 = siegelV1(basis(3, e2.hash));
    expect(verifyChain([e1, e2, e3])).toBe(true);
    const bericht = inspectChain([e1, e2, e3]);
    expect(bericht.ok).toBe(true);
    expect(bericht.count).toBe(3);
    expect(bericht.linkageBreaks).toBe(0);
    expect(bericht.payloadDeviations).toBe(0);
    expect(bericht.firstDeviation).toBeUndefined();
  });
});

// ------------------------------------------------------------------------------------------------
// 6 — Manipuliertes Versionsdowngrade (D6 T8)
// ------------------------------------------------------------------------------------------------

describe("JOB 498 D8 · Downgrade V2 nach V1 (T8)", () => {
  it("`hashVersion` auf 1 zurueckgesetzt, Hash unveraendert ⇒ unresolved, NICHT serialisation", () => {
    const echt = siegelV2(basis(1, GENESIS));
    // Der Angriff: nur das Versionsfeld wird gesenkt. Der gespeicherte Hash bleibt der V2-Hash.
    const gefaelscht: AuditEntry = { ...echt, hashVersion: 1 };
    expect(gefaelscht.hash).toBe(echt.hash);

    expect(verifyChain([gefaelscht])).toBe(false);
    const bericht = inspectChain([gefaelscht]);
    expect(bericht.ok).toBe(false);
    expect(bericht.linkageBreaks).toBe(0);
    expect(bericht.payloadDeviations).toBe(1);
    // DIE EIGENTLICHE ZUSAGE: ein Downgrade ist keine Serialisierungsfrage. Wuerde es als
    // `serialisation` gemeldet, hiesse das in der Oberflaeche „erklaerbar, gelb" — und ein Angriff
    // waere als harmloser jsonb-Effekt getarnt.
    expect(bericht.serialisationDeviations).toBe(0);
    expect(bericht.unresolvedDeviations).toBe(1);
    expect(bericht.uncheckedDeviations).toBe(0);
    expect(bericht.firstDeviation?.kind).toBe("unresolved");
  });

  it("das Downgrade faellt in der Kette auf, ohne die Verkettung zu brechen", () => {
    const e1 = siegelV1(basis(1, GENESIS));
    const e2 = siegelV2(basis(2, e1.hash));
    const e3 = siegelV1(basis(3, e2.hash));
    const bericht = inspectChain([e1, { ...e2, hashVersion: 1 }, e3]);
    expect(bericht.linkageBreaks).toBe(0);
    expect(bericht.unresolvedDeviations).toBe(1);
    expect(bericht.firstDeviation?.seq).toBe(2);
  });
});

// ------------------------------------------------------------------------------------------------
// 7 — Unbekannte Version: fail-closed
// ------------------------------------------------------------------------------------------------

describe("JOB 498 D8 · unbekannte Hashversion faellt fail-closed", () => {
  const mitVersion = (v: number): AuditEntry => {
    const echt = siegelV2(basis(1, GENESIS));
    return { ...echt, hashVersion: v };
  };

  it("Version 3 ist nicht pruefbar — und gilt deshalb als NICHT gueltig", () => {
    // Fail-closed heisst hier woertlich: Wer eine Version nicht kennt, darf sie nicht durchwinken.
    // Ein `true` waere die gefaehrlichste Antwort, weil sie eine Pruefung behauptet, die nie lief.
    expect(verifyChain([mitVersion(3)])).toBe(false);
    const bericht = inspectChain([mitVersion(3)]);
    expect(bericht.ok).toBe(false);
    expect(bericht.payloadDeviations).toBe(1);
    expect(bericht.unresolvedDeviations).toBe(1);
    expect(bericht.serialisationDeviations).toBe(0);
  });

  it("auch 0, negative und gebrochene Werte werden abgewiesen", () => {
    for (const v of [0, -1, 1.5]) {
      expect(verifyChain([mitVersion(v)]), `Version ${v}`).toBe(false);
      expect(inspectChain([mitVersion(v)]).ok, `Version ${v}`).toBe(false);
    }
  });

  it("eine unbekannte Version kippt auch eine sonst heile Kette", () => {
    const e1 = siegelV1(basis(1, GENESIS));
    const e2 = { ...siegelV2(basis(2, e1.hash)), hashVersion: 99 };
    expect(verifyChain([e1, e2])).toBe(false);
  });
});

// ------------------------------------------------------------------------------------------------
// 8 — Der Bericht bleibt siebenfeldrig (D6 §5.7)
// ------------------------------------------------------------------------------------------------

describe("JOB 498 D8 · ChainInspection bekommt KEIN hashVersion", () => {
  it("die leere Kette meldet exakt die sieben bekannten Felder", () => {
    // `hashVersion` ist ein Feld von `AuditEntry`, niemals von `ChainInspection`. Vier unabhaengige
    // `toEqual`-Pins im Bestand haengen daran; dieser Fall ist der fuenfte und steht dort, wo die
    // Versagensursache entstuende.
    expect(inspectChain([])).toEqual({
      ok: true,
      count: 0,
      linkageBreaks: 0,
      payloadDeviations: 0,
      serialisationDeviations: 0,
      unresolvedDeviations: 0,
      uncheckedDeviations: 0,
    });
  });

  it("auch ein V2-Bericht traegt kein Versionsfeld", () => {
    const bericht = inspectChain([siegelV2(basis(1, GENESIS))]);
    expect(Object.keys(bericht).sort()).toEqual([
      "count",
      "linkageBreaks",
      "ok",
      "payloadDeviations",
      "serialisationDeviations",
      "uncheckedDeviations",
      "unresolvedDeviations",
    ]);
  });
});
