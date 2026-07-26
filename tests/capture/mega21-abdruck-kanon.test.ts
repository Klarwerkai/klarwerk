import { describe, expect, it } from "vitest";
import {
  CREATE_OPERATION_FINGERPRINT_VERSION,
  CREATE_OPERATION_WRITE_PATCH_VERSION,
  alsMenge,
  alsSchreibpatch,
  createOperationFingerprint,
} from "../../services/knowledge-object";

// ==============================================================================================
// AUFTRAG-mega21 Block A — DIE KANONISIERUNGSREGEL, GEPINNT.
// ==============================================================================================
//
// Beim Inhaltsabdruck ist die Kanonisierung die eigentliche Arbeit: Schlüsselreihenfolge,
// Leerraum, optionale Felder. Unser eigener Audit-Befund war die Lehre — eine Reihenfolge, auf die
// sich niemand festgelegt hat, wird irgendwann zur Falschmeldung.
//
// Die Regel steht ausgeschrieben in services/knowledge-object/src/document-create.ts (K1–K7). Hier
// steht ihr PIN. Jeder Fall unten benennt, WELCHE Regel er festhält und was passierte, wenn sie
// kippte: entweder ein Konflikt, den der Nutzer nicht verursacht hat (falsch-positiv — er hat
// nichts geändert und bekommt „anderer Inhalt"), oder ein stiller Alt-Erfolg (falsch-negativ — er
// hat etwas geändert und bekommt das alte Objekt). Beide Richtungen sind teuer, die zweite mehr.

describe("mega21 A: die Kanonisierungsregel des Inhaltsabdrucks", () => {
  it("K1 — der Abdruck trägt eine VERSION, damit eine spätere Regeländerung nicht still kollidiert", () => {
    // AUFTRAG-mega22 Block A — UMGEDREHTE ZUSICHERUNG. Bis mega21 stand hier
    // `expect(...).toBe("createop-v1")`. K8 IST eine Änderung der Kanonisierungsregel, und K1
    // existiert genau für diesen Fall: ein nach der neuen Regel gebildeter Abdruck darf NIE
    // stillschweigend mit einem nach der alten Regel gebildeten kollidieren. Der Pin ist damit
    // nicht schwächer geworden — er tut hier zum ersten Mal seine Arbeit.
    expect(CREATE_OPERATION_FINGERPRINT_VERSION).toBe("createop-v2");
    // Er ist ein Hex-SHA-256 und nichts anderes: kein Geheimnis, keine Signatur, ein Vergleichswert.
    expect(createOperationFingerprint({ a: 1 })).toMatch(/^[0-9a-f]{64}$/);
  });

  it("K4 — die SCHLÜSSELREIHENFOLGE eines Objekts ist gleichgültig (sonst: Konflikt ohne Anlass)", () => {
    // Der praktische Fall: die Oberfläche baut denselben Body je nach Codepfad in anderer
    // Feldreihenfolge. Ohne diese Regel wäre jeder zweite Wiederholversuch ein Konflikt.
    const a = createOperationFingerprint({ title: "T", statement: "S", category: "K" });
    const b = createOperationFingerprint({ category: "K", statement: "S", title: "T" });
    expect(a).toBe(b);
  });

  it("K4 — VERSCHACHTELT ebenso, in jeder Tiefe", () => {
    const a = createOperationFingerprint({ x: { p: 1, q: { m: "a", n: "b" } } });
    const b = createOperationFingerprint({ x: { q: { n: "b", m: "a" }, p: 1 } });
    expect(a).toBe(b);
  });

  it('K2 — im STRUKTURTEIL ist Abwesenheit EIN Wert: undefined, null, "" und Leerraum sind gleich', () => {
    // AUFTRAG-mega22 Block A — DER GELTUNGSBEREICH IST EINGEGRENZT, DIE REGEL BLEIBT.
    //
    // K2 gilt für das, was die ROUTE deterministisch aufbaut (Dokumente, Belegstellen, Prüfermenge)
    // — dort ist `asset: null` gegen ein fehlendes `asset` wirklich derselbe Inhalt, und ob die
    // Oberfläche ein leeres Feld mitschickt, darf keinen Vorgang spalten.
    //
    // Für eine SCHREIBLADUNG gilt K2 NICHT. Genau diese Fälle pinnten bis mega21 die FALSCHE
    // Gleichheit; die Gegenprobe steht im nächsten `it` (K8) und am Ende dieser Datei.
    const leer = createOperationFingerprint({ title: "T" });
    expect(createOperationFingerprint({ title: "T", asset: null })).toBe(leer);
    expect(createOperationFingerprint({ title: "T", asset: undefined })).toBe(leer);
    expect(createOperationFingerprint({ title: "T", asset: "" })).toBe(leer);
    expect(createOperationFingerprint({ title: "T", asset: "   \n\t " })).toBe(leer);
    expect(createOperationFingerprint({ title: "T", tags: [] })).toBe(leer);
    expect(createOperationFingerprint({ title: "T", meta: {} })).toBe(leer);
  });

  it("K3 — AUSSEN wird getrimmt, INNEN nicht (doppelter Leerraum im Absatz ist Inhalt)", () => {
    expect(createOperationFingerprint({ s: "  Text  " })).toBe(
      createOperationFingerprint({ s: "Text" }),
    );
    expect(createOperationFingerprint({ s: "a  b" })).not.toBe(
      createOperationFingerprint({ s: "a b" }),
    );
  });

  it("K3 — NFC: dieselbe Zeichenfolge in zwei Unicode-Schreibweisen ist derselbe Inhalt", () => {
    // „ü" als ein Zeichen gegen „u" + Kombinierendes Trema. Ein Tastaturwechsel (macOS/Windows)
    // erzeugt genau diesen Unterschied — er darf keinen Konflikt auslösen.
    const komponiert = "Prüfbericht";
    const zerlegt = "Prüfbericht";
    expect(komponiert).not.toBe(zerlegt);
    expect(createOperationFingerprint({ s: komponiert })).toBe(
      createOperationFingerprint({ s: zerlegt }),
    );
  });

  it("K5 — die REIHENFOLGE einer Liste ist Inhalt (Anker- und Belegstellen-Reihenfolge)", () => {
    // Sie bestimmt die Reihenfolge der Anhänge und Quellen am entstehenden Objekt. Sie zu
    // ignorieren hiesse, zwei verschiedene Ergebnisse für denselben Vorgang zu halten.
    const a = createOperationFingerprint({ docs: ["eins", "zwei"] });
    const b = createOperationFingerprint({ docs: ["zwei", "eins"] });
    expect(a).not.toBe(b);
  });

  it("K5-Ausnahme — `reviewerIds` sind eine MENGE (Klickreihenfolge ist kein anderer Vorgang)", () => {
    expect(alsMenge(["b", "a"])).toEqual(["a", "b"]);
    expect(alsMenge(["a", "a", " a "])).toEqual(["a"]);
    expect(alsMenge(["a", "", "  "])).toEqual(["a"]);
    expect(alsMenge(undefined)).toEqual([]);
    // Und damit ist der Abdruck über die Menge stabil.
    expect(createOperationFingerprint({ r: alsMenge(["b", "a"]) })).toBe(
      createOperationFingerprint({ r: alsMenge(["a", "b"]) }),
    );
  });

  it("K6 — Zahlen und Wahrheitswerte zählen, NaN/Infinity sind abwesend", () => {
    expect(createOperationFingerprint({ n: 3 })).not.toBe(createOperationFingerprint({ n: 4 }));
    expect(createOperationFingerprint({ b: true })).not.toBe(
      createOperationFingerprint({ b: false }),
    );
    expect(createOperationFingerprint({ t: "x", n: Number.NaN })).toBe(
      createOperationFingerprint({ t: "x" }),
    );
    expect(createOperationFingerprint({ t: "x", n: Number.POSITIVE_INFINITY })).toBe(
      createOperationFingerprint({ t: "x" }),
    );
  });

  it("DIE GEGENRICHTUNG — eine ECHTE Inhaltsänderung ändert den Abdruck (sonst: stiller Alt-Erfolg)", () => {
    const basis = { title: "T", bodyHtml: "<p>500 h</p>" };
    expect(createOperationFingerprint({ ...basis, bodyHtml: "<p>250 h</p>" })).not.toBe(
      createOperationFingerprint(basis),
    );
    expect(createOperationFingerprint({ ...basis, title: "T2" })).not.toBe(
      createOperationFingerprint(basis),
    );
  });

  it('`true` und `"true"` sind NICHT dasselbe — der Typ ist Teil des Inhalts', () => {
    expect(createOperationFingerprint({ x: true })).not.toBe(
      createOperationFingerprint({ x: "true" }),
    );
    expect(createOperationFingerprint({ x: 1 })).not.toBe(createOperationFingerprint({ x: "1" }));
  });
});

// ==============================================================================================
// AUFTRAG-mega22 Block A — K8: DIE UMGEDREHTEN GEGENPROBEN.
// ==============================================================================================
//
// bens SB-A: der Entwurfs-Merge macht einen Unterschied, den K2 einebnete.
//
//     Schlüssel FEHLT     ⇒ Altwert BLEIBT.
//     Schlüssel DA, leer  ⇒ Altwert GEHT.
//
// Zwei Anfragen, von denen die eine Inhalt bewahrt und die andere ihn löscht, trugen denselben
// Abdruck. Unter demselben Vorgangsschlüssel entschied damit der GEWINNER eines Rennens über
// Erhalt oder Verlust — und der Verlierer bekam 200 statt `IDEMPOTENCY_PAYLOAD_MISMATCH`.
//
// Jeder Fall unten hält fest, dass genau diese Gleichsetzung NICHT mehr stattfindet. Die
// Ende-zu-Ende-Gegenprobe (derselbe Schlüssel ⇒ echter 409 an der echten Route, je einmal für ein
// Textfeld und einmal für eine Liste) steht in mega22-abdruck-schreibsemantik.test.ts.
describe("mega22 A: K8 — der Abdruck bildet die SCHREIBSEMANTIK ab", () => {
  it("K8 trägt eine eigene VERSION im serialisierten Text", () => {
    expect(CREATE_OPERATION_WRITE_PATCH_VERSION).toBe("patch-v1");
    expect(alsSchreibpatch({ a: 1 })).toContain("patch-v1");
  });

  it('TEXTFELD — `fehlt` gegen `""`: NICHT mehr derselbe Abdruck (sonst: stiller Body-Verlust)', () => {
    // Der praktische Fall, wörtlich: `bodyHtml` fehlt ⇒ der alte Body überlebt den Merge.
    // `bodyHtml: ""` ⇒ der alte Body wird gelöscht. Das sind zwei verschiedene Schreibvorgänge.
    const behalten = createOperationFingerprint({ inhalt: alsSchreibpatch({ title: "T" }) });
    const loeschen = createOperationFingerprint({
      inhalt: alsSchreibpatch({ title: "T", bodyHtml: "" }),
    });
    expect(behalten).not.toBe(loeschen);
    // Und `null` ist ebenfalls eine ausdrückliche Leerung, nicht Abwesenheit.
    expect(
      createOperationFingerprint({ inhalt: alsSchreibpatch({ title: "T", bodyHtml: null }) }),
    ).not.toBe(behalten);
  });

  it("LISTE — `fehlt` gegen `[]`: NICHT mehr derselbe Abdruck (sonst: stiller Belegstellen-Verlust)", () => {
    // `pendingSources` fehlt ⇒ die gespeicherten Belegstellen bleiben. `pendingSources: []` ⇒ sie
    // werden gelöscht (normalizeDraftPayload setzt eine leere Liste nicht wieder ein).
    const behalten = createOperationFingerprint({ inhalt: alsSchreibpatch({ title: "T" }) });
    const loeschen = createOperationFingerprint({
      inhalt: alsSchreibpatch({ title: "T", pendingSources: [] }),
    });
    expect(behalten).not.toBe(loeschen);
    // Dasselbe für die Ankerdokumente und für `tags`.
    expect(
      createOperationFingerprint({ inhalt: alsSchreibpatch({ title: "T", anchorDocuments: [] }) }),
    ).not.toBe(behalten);
    expect(
      createOperationFingerprint({ inhalt: alsSchreibpatch({ title: "T", tags: [] }) }),
    ).not.toBe(behalten);
  });

  it("K8.1 — `undefined` bleibt abwesend: über JSON ist es von „nicht mitgeschickt“ nicht zu trennen", () => {
    // Und `mergeDraftPayload` behandelt es ausdrücklich genauso. Die Regel bildet die Grenze des
    // Merges ab — keine strengere und keine mildere.
    expect(alsSchreibpatch({ title: "T", bodyHtml: undefined })).toBe(
      alsSchreibpatch({ title: "T" }),
    );
  });

  it("K8.2/K8.3 — NFC, Aussen-Trim, Schlüsselordnung und Listenreihenfolge gelten UNVERÄNDERT", () => {
    // Der strenge Zweig ist strenger bei der ABWESENHEIT und in allem anderen dieselbe Regel —
    // zwei Auffassungen davon, was ein Umlaut ist, hätten wir uns nicht leisten können.
    expect(alsSchreibpatch({ s: "  Text  " })).toBe(alsSchreibpatch({ s: "Text" }));
    expect(alsSchreibpatch({ s: "Prüfbericht" })).toBe(alsSchreibpatch({ s: "Prüfbericht" }));
    expect(alsSchreibpatch({ a: 1, b: 2 })).toBe(alsSchreibpatch({ b: 2, a: 1 }));
    expect(alsSchreibpatch({ l: ["eins", "zwei"] })).not.toBe(
      alsSchreibpatch({ l: ["zwei", "eins"] }),
    );
    // Ein leerer Eintrag IN einer Liste fällt nicht weg — die Liste schriebe sonst anders.
    expect(alsSchreibpatch({ l: ["a", ""] })).not.toBe(alsSchreibpatch({ l: ["a"] }));
  });

  it("KEINE LADUNG ist etwas anderes als eine LEERE Ladung", () => {
    expect(alsSchreibpatch(undefined)).not.toBe(alsSchreibpatch({}));
  });

  it("DIE GEGENRICHTUNG — gleiche Ladung, gleicher Abdruck (sonst: Konflikt ohne Anlass)", () => {
    const a = { title: "T", bodyHtml: "<p>500 h</p>", tags: ["x"] };
    const b = { tags: ["x"], bodyHtml: "<p>500 h</p>", title: "T" };
    expect(createOperationFingerprint({ inhalt: alsSchreibpatch(a) })).toBe(
      createOperationFingerprint({ inhalt: alsSchreibpatch(b) }),
    );
  });

  it("DER TEXT ÜBERLEBT DEN ÄUSSEREN K2-LAUF — das ist der ganze Zweck der Vorserialisierung", () => {
    // Gäbe `alsSchreibpatch` ein OBJEKT zurück, räumte K2 die Leerwerte darin wieder weg und die
    // Regel wäre wirkungslos. Die Gegenprobe: roh eingesetzt sind die beiden Ladungen gleich —
    // über K8 sind sie es nicht.
    const roh = (p: unknown): string => createOperationFingerprint({ inhalt: p });
    expect(roh({ title: "T", bodyHtml: "" })).toBe(roh({ title: "T" }));
    expect(
      createOperationFingerprint({ inhalt: alsSchreibpatch({ title: "T", bodyHtml: "" }) }),
    ).not.toBe(createOperationFingerprint({ inhalt: alsSchreibpatch({ title: "T" }) }));
  });
});
