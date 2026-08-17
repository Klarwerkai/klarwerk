import { createHash } from "node:crypto";
import type { AuditEntry } from "./types";

export const GENESIS = "GENESIS";

// Hash über den Inhalt + Vorgänger-Hash. Jede nachträgliche Änderung bricht die Kette.
export function hashEntry(entry: Omit<AuditEntry, "hash">): string {
  const material = [
    entry.seq,
    entry.at,
    entry.actor,
    entry.action,
    entry.target,
    JSON.stringify(entry.payload),
    entry.prevHash,
  ].join("|");
  return createHash("sha256").update(material).digest("hex");
}

// ==================================================================================================
// JOB 498 · D8 — HASHVERSION V2 NEBEN V1, NICHT STATT V1
// ==================================================================================================
//
// `hashEntry` oben bleibt Zeichen für Zeichen, was es war. Das ist keine Vorsicht, sondern die
// Bedingung dafür, dass der Altbestand überhaupt noch prüfbar ist: 871 Einträge tragen kein
// `hashVersion`, und ihr gespeicherter Hash IST der V1-Hash. Jede Änderung an dieser Funktion
// würde sie alle gleichzeitig ungültig machen.
//
// V2 schließt drei benannte Lücken von V1:
//
//   1. FELDGRENZE. V1 verbindet mit `|`; ein `|` IM Wert verschiebt die Grenze, und zwei
//      verschiedene Einträge können dasselbe Material erzeugen. V2 stellt jedem Feld seine
//      UTF-8-BYTEZAHL voran — die Grenze steht damit in der Länge, nicht im Trennzeichen.
//   2. DOMÄNE. Ein V1-Material kann nie zufällig ein V2-Material sein.
//   3. VERSION IM MATERIAL. Sie ist das letzte Feld; ein Downgrade bricht den Hash.
//
// Dazu die Kanonisierung der Payload: `jsonb` liest Objektschlüssel kanonisch sortiert zurück,
// `JSON.stringify` folgt der Einfügereihenfolge. V2 hasht deshalb nicht die Schreibweise, sondern
// den WERT — der belegte Livebefund (182 von 871 Abweichungen) entsteht unter V2 gar nicht erst.

export const AUDIT_HASH_VERSION_V1 = 1;
export const AUDIT_HASH_VERSION_V2 = 2;

/** Die Domänenkennung des V2-Materials. */
export const AUDIT_HASH_DOMAIN_V2 = "klarwerk.audit.v2";

// Als Codepunkt konstruiert statt als rohes Byte in der Quelle — ein NUL im Quelltext ist für
// Diffs, Editoren und Werkzeuge eine Zumutung und verbirgt genau das, was hier zählt.
const FELDTRENNER = String.fromCharCode(0x1f); // U+001F UNIT SEPARATOR
const LAENGENTRENNER = String.fromCharCode(0x00);

const utf8 = new TextEncoder();

/** Die UTF-8-BYTEZAHL eines Feldwertes — normativ, niemals die Zeichenzahl. */
function bytelaenge(wert: string): number {
  return utf8.encode(wert).length;
}

/**
 * Vergleich nach UNICODE-CODEPOINT, nicht nach UTF-16-Einheit.
 *
 * WARUM NICHT DIE EINGEBAUTE SORTIERUNG: `Array.prototype.sort()` vergleicht UTF-16-Codeeinheiten.
 * Ein Astralzeichen wie U+1F600 beginnt mit dem Surrogat 0xD83D und landet damit VOR U+FFFD,
 * obwohl sein Codepoint (128512) weit darüber liegt. Wer so sortiert, erzeugt für dieselbe
 * Schlüsselmenge je nach Zeichenvorrat verschiedene kanonische Formen — und damit verschiedene
 * Hashes für denselben Wert.
 */
function vergleicheCodepunkte(a: string, b: string): number {
  const links = Array.from(a);
  const rechts = Array.from(b);
  const kuerzeste = Math.min(links.length, rechts.length);
  for (let i = 0; i < kuerzeste; i++) {
    const l = (links[i] as string).codePointAt(0) as number;
    const r = (rechts[i] as string).codePointAt(0) as number;
    if (l !== r) {
      return l - r;
    }
  }
  return links.length - rechts.length;
}

/**
 * Kanonische JSON-Darstellung: Objektschlüssel rekursiv nach Unicode-Codepoint, ARRAYS UNVERÄNDERT.
 *
 * DIE ARRAYREGEL IST DIE WICHTIGERE HÄLFTE. `inspect-chain.test.ts` nagelt sie fest: `ids:["b","a"]`
 * gegenüber `ids:["a","b"]` ist eine INHALTSÄNDERUNG und darf nicht wegnormiert werden. Ein
 * Kanonisierer, der auch Arrays sortierte, machte aus einer echten Manipulation eine gültige Kette
 * — er wäre schlimmer als gar keiner.
 *
 * Wertsemantik wie `JSON.stringify`: `toJSON` wird beachtet, Objektschlüssel mit `undefined`
 * entfallen, `undefined` in Arrays wird zu `null`, nicht endliche Zahlen werden zu `null`.
 */
export function canonicalJson(value: unknown): string {
  const wert = entpacke(value);
  if (wert === null) {
    return "null";
  }
  if (typeof wert === "number") {
    return Number.isFinite(wert) ? JSON.stringify(wert) : "null";
  }
  if (typeof wert === "boolean" || typeof wert === "string") {
    return JSON.stringify(wert);
  }
  if (typeof wert !== "object") {
    // undefined, function, symbol — dieselbe Behandlung wie in JSON.stringify an Arraystellen.
    return "null";
  }
  if (Array.isArray(wert)) {
    return `[${wert.map((element) => canonicalJson(element)).join(",")}]`;
  }
  const objekt = wert as Record<string, unknown>;
  const schluessel = Object.keys(objekt)
    .filter((k) => entpacke(objekt[k]) !== undefined)
    .sort(vergleicheCodepunkte);
  return `{${schluessel.map((k) => `${JSON.stringify(k)}:${canonicalJson(objekt[k])}`).join(",")}}`;
}

function entpacke(value: unknown): unknown {
  if (value !== null && typeof value === "object") {
    const mitToJson = value as { toJSON?: unknown };
    if (typeof mitToJson.toJSON === "function") {
      return (mitToJson as { toJSON: () => unknown }).toJSON();
    }
  }
  return value;
}

/**
 * Das V2-Hashmaterial, ausgeschrieben.
 *
 * Aufbau: Domäne, dann je Feld `UTF-8-Bytezahl` + NUL + Wert, alle Teile mit U+001F getrennt.
 * Feldfolge: `seq`, `at`, `actor`, `action`, `target`, `canonicalJson(payload)`, `prevHash`,
 * `hashVersion`.
 *
 * Die Funktion ist ausdrücklich exportiert, damit der Sollvektor SEINE LÄNGE belegen kann
 * (118 Bytes) und nicht nur seinen Hash. Ein Vektor, von dem nur der Hash geprüft wird, sagt bei
 * einem Fehler nicht, WO er liegt.
 */
export function auditMaterialV2(entry: Omit<AuditEntry, "hash">): string {
  const felder = [
    String(entry.seq),
    entry.at,
    entry.actor,
    entry.action,
    entry.target,
    canonicalJson(entry.payload),
    entry.prevHash,
    String(entry.hashVersion ?? AUDIT_HASH_VERSION_V2),
  ];
  const kodiert = felder.map((wert) => `${bytelaenge(wert)}${LAENGENTRENNER}${wert}`);
  return AUDIT_HASH_DOMAIN_V2 + FELDTRENNER + kodiert.join(FELDTRENNER);
}

/** Der V1-Hash unter seinem Versionsnamen. Identisch mit `hashEntry` — kein zweites Verhalten. */
export const hashEntryV1 = hashEntry;

/** Der V2-Hash über das Material aus `auditMaterialV2`. */
export function hashEntryV2(entry: Omit<AuditEntry, "hash">): string {
  return createHash("sha256").update(auditMaterialV2(entry), "utf8").digest("hex");
}

/**
 * DIE EINE ZENTRALE VERSIONSWAHL. Alle Prüfwege benutzen sie — `verifyChain`, `inspectChain`, die
 * Kandidatensuche und `pruefeValidationDecisionRef`.
 *
 * Fehlend oder `1` ⇒ V1. `2` ⇒ V2. Jeder andere Wert ⇒ `undefined`, und das heißt FAIL-CLOSED:
 * Wer eine Version nicht kennt, darf sie nicht durchwinken. Ein berechneter Hash wäre hier die
 * gefährlichste Antwort, weil er eine Prüfung behauptet, die nie stattgefunden hat.
 */
export function hashEntryFuerVersion(entry: Omit<AuditEntry, "hash">): string | undefined {
  const version = entry.hashVersion ?? AUDIT_HASH_VERSION_V1;
  if (version === AUDIT_HASH_VERSION_V1) {
    return hashEntryV1(entry);
  }
  if (version === AUDIT_HASH_VERSION_V2) {
    return hashEntryV2(entry);
  }
  return undefined;
}

// Die Prüffelder eines Eintrags — ohne `hash` (den prüfen wir) und ohne `eventId` (der geht in
// kein Material ein). `hashVersion` MUSS mit, sonst wählt der Prüfer die falsche Version.
function pruefmaterial(entry: AuditEntry): Omit<AuditEntry, "hash"> {
  return {
    seq: entry.seq,
    at: entry.at,
    actor: entry.actor,
    action: entry.action,
    target: entry.target,
    payload: entry.payload,
    prevHash: entry.prevHash,
    hashVersion: entry.hashVersion,
  };
}

// FR-AUD-02: Manipulation ist erkennbar — die Kette verifiziert lückenlos.
export function verifyChain(entries: readonly AuditEntry[]): boolean {
  let prev = GENESIS;
  for (const entry of entries) {
    if (entry.prevHash !== prev) {
      return false;
    }
    const expected = hashEntryFuerVersion(pruefmaterial(entry));
    if (expected === undefined || entry.hash !== expected) {
      return false;
    }
    prev = entry.hash;
  }
  return true;
}

// ---------------------------------------------------------------------------------------------------
// AUFTRAG-mega14 Block A (bens SB-1) — Ursachenunterscheidung NEBEN verifyChain.
//
// Warum: `verifyChain` liefert nur true/false. Die Oberfläche konnte deshalb einen echten
// Kettenbruch nicht von einer erklärbaren Hashabweichung unterscheiden — und behauptete trotzdem
// „Manipulation erkannt". Das ist eine Falschaussage gegenüber dem Nutzer.
//
// Der belegte Sachverhalt (Forensik 25.07.2026, 871 Einträge, 0 Kettenbrüche, 182 Nutzdaten-
// Abweichungen, davon 182 durch reine Schlüsselumordnung reproduziert): `hashEntry` hasht
// `JSON.stringify(payload)` — beim Schreiben in JS-Einfügereihenfolge. Postgres speichert `jsonb`
// kanonisch sortiert und liest so zurück. Der nachgerechnete Hash weicht ab, OHNE dass ein Wert
// verändert wurde.
//
// GRENZEN, bewusst:
//   - `hashEntry` bleibt Zeichen für Zeichen unverändert (Hash-Definition des Altbestands).
//   - `verifyChain` behält Signatur und Verhalten. `inspectChain` ist additiv.
//   - `serialisation` belegt: die VORLIEGENDEN Werte passen zum gespeicherten Hash. Es belegt NICHT,
//     dass die Werte historisch unverändert sind — die Kette hat keinen extern verankerten Kopf.
// ---------------------------------------------------------------------------------------------------

// Obergrenze der Umordnungssuche JE EINTRAG.
//
// AUFTRAG-mega35 D1 — KORRIGIERTE ZAHLEN. Hier stand bis mega34 eine Obergrenze von 4.320
// Varianten, begründet mit einem sechsschlüssligen Eintrag samt verschachteltem 3-Schlüssel-Objekt.
// Das war falsch: ein Eintrag dieser Form kommt im untersuchten Bestand gar nicht vor. Nachgezählt über
// alle 871 Zeilen des Exports (25.07.2026 16:29) mit derselben Zählweise wie `countOrderings`:
//   Maximum 720 — seq 757, `import.cleanup`, SECHS FLACHE Schlüssel (6! = 720).
//   Der verschachtelte Fall (`examples.load`, u. a. seq 714) hat 4 Schlüssel mit einem
//   3-Schlüssel-Unterobjekt: 4! * 3! = 144; davon gibt es 5 Einträge.
//   Verteilung Variantenzahl → Einträge: 1→682, 2→110, 6→36, 120→37, 144→5, 720→1.
//   KEIN Eintrag des Bestandes reißt den Deckel; die Reserve ist also rund das Siebzigfache.
//
// Ebenfalls korrigiert: die Aussage, JEDER Eintrag mit mehr als einem Payload-Schlüssel erzeuge
// eine Abweichung, ist zu absolut. 189 Einträge haben mehr als einen Schlüssel auf oberster Ebene,
// 182 davon weichen ab — SIEBEN nicht. Eine Abweichung entsteht nur, wenn JS-Einfügereihenfolge
// und die kanonische jsonb-Reihenfolge auseinanderfallen; stimmen sie zufällig überein, bleibt der
// Hash gültig.
//
// AUFTRAG-mega35 D2 — DIE KANTE DES DECKELS IST EIN MÖGLICHER FALSCHER ROTER ALARM.
// Ab NEUN flachen Schlüsseln übersteigt die Permutationszahl den Deckel: 8! = 40.320 liegt noch
// darunter und wird untersucht, 9! = 362.880 nicht mehr. Verschachtelte Objekte erreichen dieselbe
// Grenze schon mit weniger Schlüsseln auf oberster Ebene. Ein solcher Eintrag wird als `unchecked`
// gemeldet — und `auditVerifyState` färbt die Fläche daraufhin ROT, OBWOHL KEINE WERTÄNDERUNG
// VORLIEGEN MUSS: es kann sich um genau denselben harmlosen Reihenfolge-Effekt handeln, nur eben
// ungeprüft. Das ist bewusst fail-safe (lieber ein unbestätigter roter Zustand als eine unbelegte
// Entwarnung), aber es ist ein möglicher FEHLALARM und keine Manipulationsaussage. Die Anzeige sagt
// dazu korrekt „nicht geprüft" und nicht „Manipulation" — das bleibt so.
// Der Deckelwert selbst wird hier NICHT bewegt; Kanonisierung, Versionierung und ein extern
// verankerter Kettenkopf sind ein eigener Schnitt.
export const MAX_PAYLOAD_ORDERINGS = 50_000;

export type ChainDeviationKind =
  // prevHash zeigt nicht auf den Hash des Vorgängers — echter Kettenbruch.
  | "linkage"
  // Eintrags-Hash stimmt nicht, aber eine Umordnung DERSELBEN Schlüssel mit DENSELBEN Werten
  // reproduziert den gespeicherten Hash exakt.
  | "serialisation"
  // Eintrags-Hash stimmt nicht, Umordnung geprüft und NICHT gefunden. Ausdrücklich NICHT
  // „Manipulation bewiesen", sondern „mit diesen Mitteln nicht aufgelöst".
  | "unresolved"
  // Eintrags-Hash stimmt nicht, die Umordnungssuche wurde GAR NICHT ausgeführt, weil der Eintrag
  // MAX_PAYLOAD_ORDERINGS reißt. Muss von `unresolved` unterscheidbar bleiben: „nicht geprüft"
  // ist eine andere Aussage als „geprüft und nicht aufgelöst".
  | "unchecked";

export interface ChainDeviation {
  seq: number;
  at: string;
  action: string;
  kind: ChainDeviationKind;
}

export interface ChainInspection {
  ok: boolean;
  count: number;
  linkageBreaks: number;
  payloadDeviations: number;
  serialisationDeviations: number;
  unresolvedDeviations: number;
  uncheckedDeviations: number;
  firstDeviation?: ChainDeviation;
}

// Zählt die Zahl der Reihenfolge-Varianten VORHER ab, ohne sie zu erzeugen: je Objektknoten k!
// mal das Produkt der Varianten seiner Werte; Arrays behalten ihre Elementreihenfolge (jsonb auch),
// tragen aber die Varianten ihrer Elemente. Bricht bei Überschreitung sofort ab (kein Überlauf).
function countOrderings(value: unknown, cap: number): number {
  if (value === null || typeof value !== "object") {
    return 1;
  }
  let total = 1;
  const children = Array.isArray(value)
    ? value
    : Object.keys(value as Record<string, unknown>).map(
        (k) => (value as Record<string, unknown>)[k],
      );
  if (!Array.isArray(value)) {
    const keyCount = Object.keys(value as Record<string, unknown>).length;
    for (let i = 2; i <= keyCount; i++) {
      total *= i;
      if (total > cap) {
        return cap + 1;
      }
    }
  }
  for (const child of children) {
    total *= countOrderings(child, cap);
    if (total > cap) {
      return cap + 1;
    }
  }
  return total;
}

function* permutations<T>(items: readonly T[]): Generator<T[]> {
  if (items.length <= 1) {
    yield items.slice();
    return;
  }
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const tail of permutations(rest)) {
      yield [items[i] as T, ...tail];
    }
  }
}

function* arrayVariants(
  items: readonly unknown[],
  index: number,
  acc: unknown[],
): Generator<unknown[]> {
  if (index === items.length) {
    yield acc.slice();
    return;
  }
  for (const variant of orderingVariants(items[index])) {
    acc.push(variant);
    yield* arrayVariants(items, index + 1, acc);
    acc.pop();
  }
}

// Baut das Objekt in der vorgegebenen Schlüsselreihenfolge auf — die Einfügereihenfolge IST das,
// was `JSON.stringify` (und damit `hashEntry`) sieht.
function* objectVariants(
  source: Record<string, unknown>,
  keys: readonly string[],
  index: number,
  acc: Record<string, unknown>,
): Generator<Record<string, unknown>> {
  if (index === keys.length) {
    yield { ...acc };
    return;
  }
  const key = keys[index] as string;
  for (const variant of orderingVariants(source[key])) {
    acc[key] = variant;
    yield* objectVariants(source, keys, index + 1, acc);
    delete acc[key];
  }
}

// Alle inhaltsgleichen Reihenfolge-Varianten eines Wertes — REKURSIV, auch in verschachtelten
// Objekten. Ohne die Rekursion bleiben die `examples.load`-Einträge (Konflikt-Unterobjekt)
// unaufgelöst und die Oberfläche warnte fälschlich.
function* orderingVariants(value: unknown): Generator<unknown> {
  if (value === null || typeof value !== "object") {
    yield value;
    return;
  }
  if (Array.isArray(value)) {
    yield* arrayVariants(value, 0, []);
    return;
  }
  const source = value as Record<string, unknown>;
  for (const keyOrder of permutations(Object.keys(source))) {
    yield* objectVariants(source, keyOrder, 0, {});
  }
}

function payloadDeviationKind(
  entry: AuditEntry,
  cap: number,
): "serialisation" | "unresolved" | "unchecked" {
  // JOB 498 D8 — EINE UNBEKANNTE VERSION IST NICHT „NICHT GEPRÜFT", SONDERN „NICHT AUFLÖSBAR".
  //
  // Der Unterschied ist keine Wortklauberei: `unchecked` sagt in der Oberfläche „nicht geprüft"
  // und meint die Umordnungsschranke — eine Aussage über UNSEREN Aufwand. Eine unbekannte
  // Hashversion ist etwas anderes: sie ist geprüft worden, und die Prüfung ist gescheitert, weil
  // es kein Material gibt, mit dem sie gelingen könnte. Das ist `unresolved`.
  if (hashEntryFuerVersion(pruefmaterial(entry)) === undefined) {
    return "unresolved";
  }
  if (countOrderings(entry.payload, cap) > cap) {
    return "unchecked";
  }
  const base: Omit<AuditEntry, "hash" | "payload"> = {
    seq: entry.seq,
    at: entry.at,
    actor: entry.actor,
    action: entry.action,
    target: entry.target,
    prevHash: entry.prevHash,
    hashVersion: entry.hashVersion,
  };
  for (const candidate of orderingVariants(entry.payload)) {
    const kandidat = hashEntryFuerVersion({
      ...base,
      payload: candidate as Record<string, unknown>,
    });
    if (kandidat === entry.hash) {
      return "serialisation";
    }
  }
  return "unresolved";
}

// EIN Durchlauf über die Kette, der die URSACHE einer Abweichung benennt statt nur ok/nicht-ok.
// Zählweise wie im Forensik-Werkzeug (bens Auflage E): `linkageBreaks` und `payloadDeviations`
// werden UNABHÄNGIG gezählt — eine Zeile mit beiden Brüchen zählt in beiden. Für die Benennung
// der ersten Abweichung gilt innerhalb einer Zeile `linkage` vor Nutzdaten (wie in verifyChain,
// das prevHash zuerst prüft); über die Kette hinweg gewinnt die KLEINSTE seq.
export function inspectChain(
  entries: readonly AuditEntry[],
  options: { maxOrderings?: number } = {},
): ChainInspection {
  const cap = options.maxOrderings ?? MAX_PAYLOAD_ORDERINGS;
  let prev = GENESIS;
  let linkageBreaks = 0;
  let payloadDeviations = 0;
  let serialisationDeviations = 0;
  let unresolvedDeviations = 0;
  let uncheckedDeviations = 0;
  let firstDeviation: ChainDeviation | undefined;

  for (const entry of entries) {
    const linkageOk = entry.prevHash === prev;
    // JOB 498 D8: dieselbe zentrale Versionswahl wie in `verifyChain`. `undefined` heißt
    // „unbekannte Version" und ist damit nie gleich einem gespeicherten Hash — fail-closed.
    const expected = hashEntryFuerVersion(pruefmaterial(entry));
    const payloadOk = expected !== undefined && entry.hash === expected;

    let kind: ChainDeviationKind | undefined;
    if (!linkageOk) {
      linkageBreaks++;
      kind = "linkage";
    }
    if (!payloadOk) {
      payloadDeviations++;
      const payloadKind = payloadDeviationKind(entry, cap);
      if (payloadKind === "serialisation") {
        serialisationDeviations++;
      } else if (payloadKind === "unresolved") {
        unresolvedDeviations++;
      } else {
        uncheckedDeviations++;
      }
      kind ??= payloadKind;
    }
    if (kind && (!firstDeviation || entry.seq < firstDeviation.seq)) {
      firstDeviation = { seq: entry.seq, at: entry.at, action: entry.action, kind };
    }

    // Wie verifyChain: der nächste erwartete prevHash ist der GESPEICHERTE Hash dieses Eintrags —
    // ein einzelner Bruch pflanzt sich nicht als Kaskade durch die restliche Kette fort.
    prev = entry.hash;
  }

  return {
    ok: linkageBreaks === 0 && payloadDeviations === 0,
    count: entries.length,
    linkageBreaks,
    payloadDeviations,
    serialisationDeviations,
    unresolvedDeviations,
    uncheckedDeviations,
    ...(firstDeviation ? { firstDeviation } : {}),
  };
}
