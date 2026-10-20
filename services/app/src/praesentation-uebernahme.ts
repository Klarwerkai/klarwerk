// PP-07: Vorbereitung und prüfbare Rücknahme auf PP02-Daten, ohne weitere Ablage.
import { createHash } from "node:crypto";
import JSZip from "jszip";
import type { KnowledgeObject } from "../../knowledge-object";
import { aktualisiereDatenDatei, leseDeckVertraege } from "./office-daten-aenderungen";
import { type Aenderungsauftrag, planeAenderungen } from "./praesentation-aenderungen";
import {
  DIMENSIONEN,
  DatenFehler,
  type DatenUmgebung,
  type Datenpunkt,
  type Handelnder,
  type Inhalt,
  fingerabdruck,
  inFassung,
  pruefeHerkunftsgraph,
  vollLesbar,
} from "./praesentation-daten";
import type { DatenpunktAblage } from "./praesentation-daten-ablage";

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function quellAbdruck(
  ko: KnowledgeObject,
  version = ko.version,
  rueckBezug?: { anhangId: string; objectId: string },
): string {
  return JSON.stringify([
    version,
    ko.confidentiality,
    ko.spaceId,
    ko.author,
    ko.quellrechte,
    (ko.attachments ?? []).map((a) => [
      a.id,
      rueckBezug?.anhangId === a.id ? rueckBezug.objectId : a.objectId,
      a.name,
    ]),
  ]);
}
export const PP07_RECEIPT = "ppt/klara/pp07-uebernahme.json";
export interface UebernahmeBeleg {
  vertrag: "klara-pp07-uebernahme-v1";
  vorschauId: string;
  actor: string;
  am: string;
  basis: {
    koId: string;
    anhangId: string;
    artikelFassung: number;
    objectId: string;
    dateiFassung: string;
  };
  punkte: {
    id: string;
    vorherFassung: number;
    vorherStand: number;
    vorherAbdruck: string;
    nachherFassung: number;
    nachherAbdruck: string;
    bindungenVorher: string[];
  }[];
  konflikteOffen: { id: string; grund: string }[];
}
export async function leseUebernahmeBeleg(bytes: Buffer): Promise<UebernahmeBeleg | undefined> {
  const zip = await JSZip.loadAsync(bytes);
  const s = await zip.file(PP07_RECEIPT)?.async("string");
  if (!s) return;
  if (s.length > 1024 * 1024)
    throw new DatenFehler("ungueltig", "PP07-Übernahmebeleg ist zu groß.");
  let b: UebernahmeBeleg;
  try {
    b = JSON.parse(s) as UebernahmeBeleg;
  } catch {
    throw new DatenFehler("ungueltig", "PP07-Übernahmebeleg ist unlesbar.");
  }
  if (
    b.vertrag !== "klara-pp07-uebernahme-v1" ||
    typeof b.vorschauId !== "string" ||
    typeof b.actor !== "string" ||
    !b.basis ||
    typeof b.basis.koId !== "string" ||
    typeof b.basis.anhangId !== "string" ||
    !Number.isInteger(b.basis.artikelFassung) ||
    typeof b.basis.objectId !== "string" ||
    !Array.isArray(b.punkte) ||
    b.punkte.length > 200 ||
    !Array.isArray(b.konflikteOffen) ||
    b.punkte.some(
      (p) =>
        !p ||
        typeof p.id !== "string" ||
        !Number.isInteger(p.vorherFassung) ||
        !Number.isInteger(p.nachherFassung) ||
        !Number.isInteger(p.vorherStand) ||
        typeof p.vorherAbdruck !== "string" ||
        typeof p.nachherAbdruck !== "string" ||
        !Array.isArray(p.bindungenVorher) ||
        p.bindungenVorher.some((id) => typeof id !== "string"),
    )
  )
    throw new DatenFehler("ungueltig", "PP07-Übernahmebeleg ist unvollständig.");
  return b;
}

export async function bereiteDatenUebernahmeVor(args: {
  bytes: Buffer;
  ko: KnowledgeObject;
  anhangId: string;
  objectId: string;
  dateiFassung: string;
  auftraege: Aenderungsauftrag[];
  u: DatenUmgebung;
  ablage: DatenpunktAblage;
  h: Handelnder;
}) {
  const zip = await JSZip.loadAsync(args.bytes);
  const manifeste = await leseDeckVertraege(zip);
  const manifestPunkte: Datenpunkt[] = [];
  for (const id of new Set(manifeste.flatMap((v) => v.deck.plan.fakten.map((f) => f.id)))) {
    const p = await args.ablage.lesen(id);
    if (!p || !(await vollLesbar(p, args.u)))
      throw new DatenFehler("kein_zugriff", "Datenpunkt nicht gefunden.");
    manifestPunkte.push(p);
  }
  const kandidaten = [
    ...new Map(
      [
        ...(await args.ablage.vonArtikel(args.ko.id)),
        ...(await args.ablage.gebundenAn(args.ko.id, args.anhangId)),
        ...manifestPunkte,
      ].map((p) => [p.id, p] as const),
    ).values(),
  ];
  const plan = await planeAenderungen(kandidaten, args.auftraege, args.u, args.h);
  const datei = await aktualisiereDatenDatei({ ...args, plan, jetzt: Date.parse(args.h.jetzt) });
  const basis = {
    koId: args.ko.id,
    anhangId: args.anhangId,
    artikelFassung: args.ko.version,
    objectId: args.objectId,
    dateiFassung: args.dateiFassung,
  };
  const punkte = [];
  for (const p of plan.vorher.values()) {
    const neu = plan.nachher.get(p.id);
    if (!neu) continue;
    punkte.push({
      id: p.id,
      stand: p.stand,
      fassung: p.fassung,
      vorher: fingerabdruck(p),
      nachher: fingerabdruck(neu),
    });
  }
  const quellen: { id: string; version: number; abdruck: string }[] = [];
  const quellIds = new Set<string>();
  const gesehen = new Set<string>();
  const sammle = async (p: Datenpunkt, tiefe = 0): Promise<void> => {
    const key = `${p.id}@${p.fassung}`;
    if (gesehen.has(key)) return;
    if (tiefe > 8) throw new DatenFehler("ungueltig", "Die belegte Herkunft ist zu tief.");
    gesehen.add(key);
    quellIds.add(p.heimatKoId);
    if (p.quelle) quellIds.add(p.quelle.koId);
    for (const c of p.korrekturen) {
      const alt = inFassung(p, c.fassung - 1);
      if (alt) await sammle(alt, tiefe);
    }
    for (const e of p.rechenweg?.eingaben ?? []) {
      const heute = await args.u.datenpunkt(e.datenpunktId);
      const alt = heute ? inFassung(heute, e.fassung) : undefined;
      if (!alt) throw new DatenFehler("kein_zugriff", "Datenpunkt nicht gefunden.");
      await sammle(alt, tiefe + 1);
    }
  };
  for (const p of plan.vorher.values()) await sammle(p);
  for (const id of quellIds) {
    const ko = await args.u.artikel(id);
    if (!ko) throw new DatenFehler("kein_zugriff", "Datenpunkt nicht gefunden.");
    quellen.push({ id, version: ko.version, abdruck: quellAbdruck(ko) });
  }
  const vorschauId = hash(
    JSON.stringify({
      basis,
      auftraege: args.auftraege,
      punkte,
      quellen,
      wirkungen: datei.wirkungen,
      konflikte: datei.konflikte,
      quellkonflikte: plan.konflikte,
    }),
  );
  return { plan, datei, basis, vorschauId, quellen };
}

export async function betteUebernahmeBelegEin(bytes: Buffer, b: UebernahmeBeleg): Promise<Buffer> {
  if (JSON.stringify(b).length > 1024 * 1024)
    throw new DatenFehler(
      "ungueltig",
      "Der Übernahmebeleg wäre zu groß; nichts wurde gespeichert.",
    );
  const zip = await JSZip.loadAsync(bytes);
  zip.file(PP07_RECEIPT, JSON.stringify(b));
  const ct = await zip.file("[Content_Types].xml")?.async("string");
  if (ct && !ct.includes('Extension="json"'))
    zip.file(
      "[Content_Types].xml",
      ct.replace("</Types>", '<Default Extension="json" ContentType="application/json"/></Types>'),
    );
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

/** Echte neue Datenfassung beim Undo; alte Freigaben werden auch bei gleichem Fingerabdruck nicht wieder aktiv. */
export async function ruecknahmeDatenpunkt(
  dp: Datenpunkt,
  ref: UebernahmeBeleg["punkte"][number],
  u: DatenUmgebung,
  h: Handelnder,
): Promise<Datenpunkt> {
  if (!(await vollLesbar(dp, u)))
    throw new DatenFehler("kein_zugriff", "Datenpunkt nicht gefunden.");
  const alt = inFassung(dp, ref.vorherFassung);
  if (!alt || fingerabdruck(alt) !== ref.vorherAbdruck)
    throw new DatenFehler("ungueltig", "Die ursprüngliche Datenfassung ist nicht mehr belegt.");
  const bindungen = dp.bindungen.filter((b) => ref.bindungenVorher.includes(b.id));
  if (fingerabdruck(dp) === ref.vorherAbdruck) return { ...dp, bindungen };
  const felder: (keyof Inhalt)[] = [
    "art",
    "wert",
    "zahl",
    "einheit",
    "waehrung",
    "zeitraum",
    "bezugsgroesse",
    "erfassung",
    "quelle",
    "fundstelle",
    "rechenweg",
    "annahmen",
    "modellbezug",
  ];
  const vorher: Record<string, unknown> = {};
  const inhalt: Record<string, unknown> = {};
  for (const f of felder) {
    vorher[f] = dp[f] ?? null;
    if (alt[f] !== undefined) inhalt[f] = alt[f];
  }
  const metadaten = Object.fromEntries(
    Object.entries(dp).filter(([k]) => !felder.includes(k as keyof Inhalt)),
  );
  const fassung = dp.fassung + 1;
  const neu = {
    ...metadaten,
    ...inhalt,
    fassung,
    bindungen,
    korrekturen: [
      ...dp.korrekturen,
      {
        fassung,
        felder,
        vorher,
        grund: "PP07: bewusste Rücknahme der dokumentierten Datenänderung.",
        von: h.nutzerId,
        am: h.jetzt,
      },
    ],
  } as unknown as Datenpunkt;
  const fp = fingerabdruck(neu);
  const result = {
    ...neu,
    pruefungen: [
      ...dp.pruefungen,
      ...DIMENSIONEN.map((dimension) => ({
        id: h.kennung(),
        dimension,
        ergebnis: "klaerung" as const,
        grund:
          "Nach Rücknahme erneut prüfen; frühere fachliche Freigaben wurden nicht auf diese Datenfassung übertragen.",
        von: "klarwerk:pp07-ruecknahme",
        am: h.jetzt,
        datenFassung: fassung,
        fingerabdruck: fp,
      })),
    ],
  };
  await pruefeHerkunftsgraph(result, u);
  return result;
}
