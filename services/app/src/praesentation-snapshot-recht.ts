// PP-05: zusätzliches UND am bestehenden Object-Downloadtor. Keine eigenen Rollen/Rechte/Ablage.
import { createHash } from "node:crypto";
import JSZip from "jszip";
import { FOLIEN_ABGLEICH_GRENZEN, pruefeAbgleichKoerper } from "./folien-abgleich-grenzen";
import type { AusgabeBindung, DeckVertrag } from "./office-datenfolien";
import {
  type DatenUmgebung,
  type Datenpunkt,
  type FoliensatzDaten,
  MAX_FOLIEN,
  elementBefund,
  inFassung,
  leseFolienDaten,
  vollLesbar,
} from "./praesentation-daten";
import { type AnhangUrteil, schutzrang } from "./sichtbarkeit";

const NEIN: AnhangUrteil = { sichtbar: false, vertraulich: true };
const PREFIX = "ppt/klara/pp05-";
const MANIFEST = /^ppt\/klara\/pp05-[^/]+\.json$/;
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const objekt = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const kennung = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= 200;
const fassung = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;

function deckVon(roh: unknown): DeckVertrag | undefined {
  if (
    !objekt(roh) ||
    roh.vertrag !== "klara-pp05-v1" ||
    !objekt(roh.plan) ||
    roh.plan.vertrag !== "klara-pp05-v1" ||
    !objekt(roh.plan.basis) ||
    !kennung(roh.plan.basis.koId) ||
    !kennung(roh.plan.basis.anhangId) ||
    typeof roh.plan.basis.dateiFassung !== "string" ||
    !/^[0-9a-f]{64}$/.test(roh.plan.basis.dateiFassung) ||
    !Array.isArray(roh.plan.fakten) ||
    roh.plan.fakten.length < 1 ||
    roh.plan.fakten.length > 12 ||
    !roh.plan.fakten.every(
      (f) => objekt(f) && kennung(f.id) && fassung(f.fassung) && typeof f.wert === "string",
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
        (b.spalte === undefined || fassung(b.spalte)),
    )
  )
    return undefined;
  return roh as unknown as DeckVertrag;
}

/**
 * undefined: kein PP05-Snapshot, bestehendes Anhangurteil unverändert.
 * AnhangUrteil: gebundener PP05-Snapshot; ausschließlich zusätzliche Einschränkung.
 * Rechte und Daten werden bei JEDEM Aufruf frisch gelesen, auch für alte Dateifassungen.
 */
export async function snapshotLesbar(
  bytes: Buffer,
  objectId: string,
  u?: DatenUmgebung,
): Promise<AnhangUrteil | undefined> {
  // Auch ein umbenanntes ZIP wird erkannt; MIME/Dateiname sind kein Rechtebeleg.
  if (bytes.length < 4 || bytes.readUInt32LE(0) !== 0x04034b50) return undefined;
  // ZIP-Namen stehen im Zentralverzeichnis unkomprimiert. Gewöhnliche Dateien erhalten
  // keinen neuen Parser-/Entpacklauf. Für PP05 gelten die unveränderten bestehenden Grenzen.
  if (!bytes.includes(Buffer.from(PREFIX))) return undefined;
  if (await pruefeAbgleichKoerper(bytes, FOLIEN_ABGLEICH_GRENZEN)) return NEIN;
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    return NEIN;
  }
  const namen = Object.keys(zip.files).filter((n) => n.startsWith(PREFIX) && !zip.files[n]?.dir);
  if (namen.length === 0) return undefined;
  if (!u || namen.length > MAX_FOLIEN || namen.some((n) => !MANIFEST.test(n))) return NEIN;
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
      const deck = deckVon(JSON.parse(text));
      if (!deck) return NEIN;
      decks.push(deck);
    }
    const dateiFassung = hash(bytes);
    // Beim erneuten Aufbau bleiben frühere Folien und Manifeste erhalten. Ihre schon vorhandenen
    // PP02-Bindungen dürfen auf eine unveränderte Vorgängerdatei der tatsächlichen Deckkette zeigen.
    const dateifassungen = new Set([dateiFassung, ...decks.map((d) => d.plan.basis.dateiFassung)]);
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
        }
      }
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
