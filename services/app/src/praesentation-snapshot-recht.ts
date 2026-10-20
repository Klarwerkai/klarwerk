// PP-05: zusätzliches UND am bestehenden Object-Downloadtor. Keine eigenen Rollen/Rechte/Ablage.
import { createHash } from "node:crypto";
import JSZip from "jszip";
import type { ObjectLifecycle } from "../../object-store";
import { FOLIEN_ABGLEICH_GRENZEN, pruefeAbgleichKoerper } from "./folien-abgleich-grenzen";
import {
  type DatenUmgebung,
  type Datenpunkt,
  type FoliensatzDaten,
  MAX_FOLIEN,
  elementBefund,
  fingerabdruck,
  inFassung,
  leseFolienDaten,
  vollLesbar,
} from "./praesentation-daten";
import { type AnhangUrteil, schutzrang } from "./sichtbarkeit";

// Nur der vom Downloadtor dekodierte Vertrag; der PP05-Schreiber bleibt unabhängig.
interface AusgabeBindung {
  datenpunktId: string;
  datenFassung: number;
  sldId: string;
  shapeId: string;
  zeile?: number;
  spalte?: number;
  bindungId?: string;
}
interface DeckVertrag {
  vertrag: "klara-pp05-v1" | "klara-pp06-v1";
  plan: {
    vertrag: "klara-pp05-v1" | "klara-pp06-v1";
    basis: { koId: string; anhangId: string; dateiFassung: string };
    fakten: { id: string; fassung: number; wert: string; fingerabdruck?: string }[];
  };
  bindungen: AusgabeBindung[];
}

const NEIN: AnhangUrteil = { sichtbar: false, vertraulich: true };
const PREFIX = "ppt/klara/pp05-";
const MANIFEST = /^ppt\/klara\/pp05-[^/]+\.json$/;
const PP06_PREFIX = "ppt/klara/pp06-";
const PP06_MANIFEST = /^ppt\/klara\/pp06-([0-9a-f]{64})\.json$/;
const PP07_VARIANTE = "ppt/klara/pp07-variante.json";
const PP07_UEBERNAHME = "ppt/klara/pp07-uebernahme.json";
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const objekt = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const kennung = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 200;
const fassung = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;

function deckVon(roh: unknown, vertrag: DeckVertrag["vertrag"]): DeckVertrag | undefined {
  if (
    !objekt(roh) ||
    roh.vertrag !== vertrag ||
    !objekt(roh.plan) ||
    roh.plan.vertrag !== vertrag ||
    !objekt(roh.plan.basis) ||
    !kennung(roh.plan.basis.koId) ||
    !kennung(roh.plan.basis.anhangId) ||
    typeof roh.plan.basis.dateiFassung !== "string" ||
    !/^[0-9a-f]{64}$/.test(roh.plan.basis.dateiFassung) ||
    !Array.isArray(roh.plan.fakten) ||
    roh.plan.fakten.length < 1 ||
    roh.plan.fakten.length > 12 ||
    !roh.plan.fakten.every(
      (f) =>
        objekt(f) &&
        kennung(f.id) &&
        fassung(f.fassung) &&
        typeof f.wert === "string" &&
        (vertrag !== "klara-pp06-v1" ||
          (typeof f.fingerabdruck === "string" && /^[0-9a-f]{64}$/.test(f.fingerabdruck))),
    ) ||
    !Array.isArray(roh.bindungen) ||
    !roh.bindungen.every(
      (b) =>
        objekt(b) &&
        kennung(b.datenpunktId) &&
        fassung(b.datenFassung) &&
        kennung(b.sldId) &&
        kennung(b.shapeId) &&
        (b.zeile === undefined || fassung(b.zeile)) &&
        (b.spalte === undefined || fassung(b.spalte)) &&
        (vertrag !== "klara-pp06-v1" ||
          (typeof b.bindungId === "string" && /^pp06:[0-9a-f]{64}$/.test(b.bindungId))),
    )
  )
    return undefined;
  return roh as unknown as DeckVertrag;
}

/**
 * undefined: kein erkannter Snapshot, bestehendes Anhangurteil unverändert.
 * AnhangUrteil: gebundener Snapshot; ausschließlich zusätzliche Einschränkung.
 * Rechte und Daten werden bei JEDEM Aufruf frisch gelesen, auch für alte Dateifassungen.
 */
export async function snapshotLesbar(
  bytes: Buffer,
  objectId: string,
  u?: DatenUmgebung,
  ableitung?: ObjectLifecycle["praesentationAbleitung"],
  objektBytes?: (id: string) => Promise<Buffer | undefined>,
): Promise<AnhangUrteil | undefined> {
  // O-1: private W10-Folgeobjekte enthalten ebenfalls Quellwerte. Ausschließlich die intern
  // gespeicherte Bindung ihrer eigenen Bytes an eine echte PPTX führt in dasselbe Tor.
  if (ableitung) {
    try {
      if (
        !u ||
        !objektBytes ||
        ableitung.inhaltSha256 !== hash(bytes) ||
        !kennung(ableitung.objectId) ||
        ableitung.objectId === objectId ||
        typeof ableitung.dateiFassung !== "string" ||
        !/^[0-9a-f]{64}$/.test(ableitung.dateiFassung)
      )
        return NEIN;
      const quelle = await objektBytes(ableitung.objectId);
      if (!quelle || hash(quelle) !== ableitung.dateiFassung) return NEIN;
      return (await snapshotLesbar(quelle, ableitung.objectId, u)) ?? NEIN;
    } catch {
      return NEIN;
    }
  }
  // Auch ein umbenanntes ZIP wird erkannt; MIME/Dateiname sind kein Rechtebeleg.
  if (bytes.length < 4 || bytes.readUInt32LE(0) !== 0x04034b50) return undefined;
  // ZIP-Namen stehen im Zentralverzeichnis unkomprimiert. Gewöhnliche Dateien erhalten
  // keinen neuen Parser-/Entpacklauf. Für PP05 gelten die unveränderten bestehenden Grenzen.
  const pp07Marker = bytes.includes(Buffer.from(PP07_VARIANTE));
  const pp07Uebernahme = bytes.includes(Buffer.from(PP07_UEBERNAHME));
  const pp06Marker = bytes.includes(Buffer.from(PP06_PREFIX));
  if (!bytes.includes(Buffer.from(PREFIX)) && !pp07Marker && !pp07Uebernahme && !pp06Marker)
    return undefined;
  if (await pruefeAbgleichKoerper(bytes, FOLIEN_ABGLEICH_GRENZEN)) return NEIN;
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    return NEIN;
  }
  const namen = Object.keys(zip.files).filter(
    (n) => (n.startsWith(PREFIX) || n.startsWith(PP06_PREFIX)) && !zip.files[n]?.dir,
  );
  if (namen.length === 0 && !pp07Uebernahme) return pp07Marker || pp06Marker ? NEIN : undefined;
  if (
    !u ||
    namen.length > MAX_FOLIEN ||
    namen.some((n) => !(n.startsWith(PP06_PREFIX) ? PP06_MANIFEST.test(n) : MANIFEST.test(n)))
  )
    return NEIN;
  let vertraulich = false;
  const quelle = u;
  const lesend: DatenUmgebung = {
    ...quelle,
    async artikel(id) {
      const artikel = await quelle.artikel(id);
      // Dieselbe Einstufung wie am bestehenden Leseweg, auch für ungeklärte Stufen.
      if (artikel && schutzrang(artikel.confidentiality) > 0) vertraulich = true;
      return artikel;
    },
  };
  try {
    const decks: DeckVertrag[] = [];
    for (const name of namen) {
      const text = await zip.file(name)?.async("string");
      if (!text || text.length > 1024 * 1024) return NEIN;
      const pp06 = name.startsWith(PP06_PREFIX);
      const deck = deckVon(JSON.parse(text), pp06 ? "klara-pp06-v1" : "klara-pp05-v1");
      if (!deck) return NEIN;
      if (
        pp06 &&
        deck.bindungen.some((b) => b.bindungId !== `pp06:${PP06_MANIFEST.exec(name)?.[1]}`)
      )
        return NEIN;
      decks.push(deck);
    }
    // PP07-Dateitiefen ändern nur Sichtbarkeit. Ihr Manifest verleiht keine Rechte:
    // dieselben PP05-Fakten und eine tatsächlich gespeicherte Bindung der Ausgangsdatei sind nötig.
    let variantenBasis: string | undefined;
    const varText = await zip.file(PP07_VARIANTE)?.async("string");
    if (varText !== undefined) {
      if (varText.length > 128 * 1024) return NEIN;
      const v: unknown = JSON.parse(varText);
      if (
        !objekt(v) ||
        v.vertrag !== "klara-pp07-variante-v1" ||
        !["kurz", "ausfuehrlich"].includes(String(v.tiefe)) ||
        typeof v.basis !== "string" ||
        !/^[0-9a-f]{64}$/.test(v.basis) ||
        !Array.isArray(v.datenbasis) ||
        v.datenbasis.length > MAX_FOLIEN ||
        !v.datenbasis.every((p) => objekt(p) && kennung(p.id) && fassung(p.fassung))
      )
        return NEIN;
      const erwartet = new Set(
        decks.flatMap((d) => d.plan.fakten.map((p) => `${p.id}@${p.fassung}`)),
      );
      const deklariert = new Set(v.datenbasis.map((p) => `${p.id}@${p.fassung}`));
      if (erwartet.size !== deklariert.size || [...erwartet].some((p) => !deklariert.has(p)))
        return NEIN;
      variantenBasis = v.basis;
    }
    const dateiFassung = hash(bytes);
    // Beim erneuten Aufbau bleiben frühere Folien und Manifeste erhalten. Ihre schon vorhandenen
    // PP02-Bindungen dürfen auf eine unveränderte Vorgängerdatei der tatsächlichen Deckkette zeigen.
    const dateifassungen = new Set([
      dateiFassung,
      ...decks.map((d) => d.plan.basis.dateiFassung),
      ...(variantenBasis ? [variantenBasis] : []),
    ]);
    const geprueft = new Map<string, Datenpunkt>();
    async function datenfassung(
      id: string,
      version: number,
      tiefe = 0,
    ): Promise<Datenpunkt | undefined> {
      const key = `${id}@${version}`;
      if (tiefe > 8) return undefined;
      const vorhanden = geprueft.get(key);
      if (vorhanden) return vorhanden;
      if (geprueft.size >= 80) return undefined;
      const aktuell = await lesend.datenpunkt(id);
      const dp = aktuell ? inFassung(aktuell, version) : undefined;
      if (!dp || !(await vollLesbar(dp, lesend))) return undefined;
      // In-Fassung-Lesen trägt die echten Eingaben. Fehlt eine davon, kann der Download nicht
      // auf einen frei formulierten Belegtext oder eine zufällig lesbare neue Eingabe ausweichen.
      geprueft.set(key, dp);
      for (const e of dp.rechenweg?.eingaben ?? [])
        if (!(await datenfassung(e.datenpunktId, e.fassung, tiefe + 1))) return undefined;
      for (const c of dp.korrekturen)
        if (!(await datenfassung(id, c.fassung - 1, tiefe))) return undefined;
      return dp;
    }
    let satz: FoliensatzDaten | undefined;
    let inDieserDateiGebunden = false;
    for (const deck of decks) {
      const basis = deck.plan.basis;
      const ziel = await lesend.artikel(basis.koId);
      if (!ziel?.attachments.some((a) => a.id === basis.anhangId)) return NEIN;
      for (const fakt of deck.plan.fakten) {
        const dp = await datenfassung(fakt.id, fakt.fassung);
        if (!dp || dp.wert !== fakt.wert) return NEIN;
        if (deck.vertrag === "klara-pp06-v1" && fingerabdruck(dp) !== fakt.fingerabdruck)
          return NEIN;
        const deklariert = deck.bindungen.filter(
          (b) => b.datenpunktId === fakt.id && b.datenFassung === fakt.fassung,
        );
        if (deklariert.length === 0) return NEIN;
        // Der eingebettete Text erteilt keine Rechte: die PP02-Bindung samt Dateifassung und
        // Element/Zelle muss tatsächlich in der bestehenden Ablage stehen und in den Bytes passen.
        for (const b of deklariert) {
          const passend = dp.bindungen.filter(
            (g) =>
              g.koId === basis.koId &&
              g.anhangId === basis.anhangId &&
              g.datenFassung === fakt.fassung &&
              dateifassungen.has(g.dateiFassung) &&
              (deck.vertrag !== "klara-pp06-v1" || g.id === b.bindungId) &&
              gleicherOrt(g, b),
          );
          const gespeichert =
            passend.find((g) => g.objectId === objectId && g.dateiFassung === dateiFassung) ??
            passend[0];
          if (!gespeichert) return NEIN;
          satz ??= await leseFolienDaten(bytes);
          if (elementBefund(dp, gespeichert, satz).lage !== "passt") return NEIN;
          if (gespeichert.objectId === objectId && gespeichert.dateiFassung === dateiFassung)
            inDieserDateiGebunden = true;
          if (variantenBasis && passend.some((g) => g.dateiFassung === variantenBasis))
            inDieserDateiGebunden = true;
        }
      }
    }
    if (pp07Uebernahme) {
      const text = await zip.file(PP07_UEBERNAHME)?.async("string");
      if (!text || text.length > 1024 * 1024) return NEIN;
      const b: unknown = JSON.parse(text);
      if (
        !objekt(b) ||
        b.vertrag !== "klara-pp07-uebernahme-v1" ||
        !objekt(b.basis) ||
        !kennung(b.basis.koId) ||
        !kennung(b.basis.anhangId) ||
        !Array.isArray(b.punkte) ||
        b.punkte.length > 80
      )
        return NEIN;
      const koId = b.basis.koId;
      const anhangId = b.basis.anhangId;
      const ziel = await lesend.artikel(koId);
      if (!ziel?.attachments.some((a) => a.id === anhangId)) return NEIN;
      for (const p of b.punkte) {
        if (
          !objekt(p) ||
          !kennung(p.id) ||
          !fassung(p.nachherFassung) ||
          typeof p.nachherAbdruck !== "string"
        )
          return NEIN;
        const dp = await datenfassung(p.id, p.nachherFassung);
        if (!dp || fingerabdruck(dp) !== p.nachherAbdruck) return NEIN;
      }
      // Ein Übernahmebeleg verleiht kein zusätzliches Leserecht. Ohne PP05 nur das bereits
      // normale erlaubte aktuelle Zielobjekt oder eine tatsächlich gespeicherte Dateibindung.
      if (!decks.length)
        inDieserDateiGebunden =
          ziel.attachments.some((a) => a.id === anhangId && a.objectId === objectId) ||
          [...geprueft.values()].some((p) =>
            p.bindungen.some((g) => g.objectId === objectId && g.dateiFassung === dateiFassung),
          );
    }
    return inDieserDateiGebunden ? { sichtbar: true, vertraulich } : NEIN;
  } catch {
    return NEIN;
  }
}

function gleicherOrt(
  a: AusgabeBindung | { sldId: string; shapeId: string; zeile?: number; spalte?: number },
  b: AusgabeBindung,
): boolean {
  return (
    a.sldId === b.sldId && a.shapeId === b.shapeId && a.zeile === b.zeile && a.spalte === b.spalte
  );
}
