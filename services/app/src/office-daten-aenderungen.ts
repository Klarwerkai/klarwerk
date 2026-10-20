// PP-07 ergänzt den vorhandenen W06-Schreibweg; ZIP/Folien/Notizen weiterhin dessen Leser.
import { createHash } from "node:crypto";
import JSZip from "jszip";
import type { KnowledgeObject } from "../../knowledge-object";
import type { DeckVertrag } from "./office-datenfolien";
import { ersetzeImLauf, lesePraesentation, notizAbsaetze } from "./office-nachbearbeitung";
import type { AenderungsPlan } from "./praesentation-aenderungen";
import { type AufbauPlan, leseAufbau, planeAufbau } from "./praesentation-aufbau";
import {
  DatenFehler,
  type DatenUmgebung,
  inFassung,
  leseFolienDaten,
  vollLesbar,
  zahlStehtImText,
} from "./praesentation-daten";
import type { DatenpunktAblage } from "./praesentation-daten-ablage";

export interface DateiKonflikt {
  id: string;
  sldId: string;
  datenpunktId: string;
  art: "element" | "diagramm" | "notiz" | "andere_datei" | "beleg" | "ungebunden";
  grund: string;
  sperrtUebernahme?: boolean;
}
export interface DateiWirkung {
  sldId: string;
  shapeId: string;
  datenpunktId: string;
  vorher: string;
  nachher: string;
  art: "text" | "tabelle" | "diagramm" | "beleg";
}
const hash = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
function pflicht<T>(wert: T | undefined | null): T {
  if (wert === undefined || wert === null)
    throw new DatenFehler("ungueltig", "Ein gebundener Dateiteil fehlt.");
  return wert;
}
const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
const encode = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/** Begrenzt gelesener PP05-Transportvertrag. Keine importierten Werte als Datenpunkt übernehmen. */
export async function leseDeckVertraege(
  zip: JSZip,
): Promise<{ pfad: string; deck: DeckVertrag }[]> {
  const namen = Object.keys(zip.files).filter((p) => /^ppt\/klara\/pp05-\d+\.json$/.test(p));
  if (namen.length > 20)
    throw new DatenFehler("ungueltig", "Zu viele PP05-Verträge in dieser Datei.");
  const out = [];
  for (const pfad of namen) {
    const text = await zip.file(pfad)?.async("string");
    if (!text || text.length > 1024 * 1024)
      throw new DatenFehler("ungueltig", "Deckvertrag fehlt oder ist zu groß.");
    let d: DeckVertrag;
    try {
      d = JSON.parse(text) as DeckVertrag;
    } catch {
      throw new DatenFehler("ungueltig", "Deckvertrag ist nicht lesbar.");
    }
    if (
      !d ||
      d.vertrag !== "klara-pp05-v1" ||
      !d.plan ||
      !d.plan.basis ||
      typeof d.plan.basis.koId !== "string" ||
      typeof d.plan.basis.anhangId !== "string" ||
      typeof d.plan.basis.dateiFassung !== "string" ||
      !Array.isArray(d.plan.fakten) ||
      d.plan.fakten.length > 12 ||
      !Array.isArray(d.folien) ||
      d.folien.length > 160 ||
      !Array.isArray(d.bindungen) ||
      !Array.isArray(d.belegfolien) ||
      !Array.isArray(d.diagramme) ||
      d.folien.some(
        (f) =>
          !f ||
          typeof f.sldId !== "string" ||
          !["haupt", "detail", "einzelfolie"].includes(f.rolle) ||
          !Array.isArray(f.datenpunkte) ||
          f.datenpunkte.some(
            (p) => !p || typeof p.id !== "string" || !Number.isSafeInteger(p.fassung),
          ),
      ) ||
      d.plan.fakten.some(
        (f) =>
          !f ||
          typeof f.id !== "string" ||
          !Number.isSafeInteger(f.fassung) ||
          typeof f.wert !== "string" ||
          typeof f.label !== "string" ||
          typeof f.einheit !== "string" ||
          typeof f.zeitraum !== "string" ||
          typeof f.zustand !== "string" ||
          !Array.isArray(f.belege) ||
          f.belege.some((b) => typeof b !== "string") ||
          (f.zahl !== undefined && !Number.isFinite(f.zahl)),
      ) ||
      d.bindungen.length > 500 ||
      d.diagramme.length > 20 ||
      d.belegfolien.length > 80 ||
      d.bindungen.some(
        (b) =>
          !b ||
          typeof b.datenpunktId !== "string" ||
          typeof b.sldId !== "string" ||
          typeof b.shapeId !== "string" ||
          !Number.isSafeInteger(b.datenFassung),
      ) ||
      d.belegfolien.some(
        (b) =>
          !b ||
          typeof b.datenpunktId !== "string" ||
          !Number.isSafeInteger(b.datenFassung) ||
          !Array.isArray(b.sldIds) ||
          b.sldIds.some((s) => typeof s !== "string"),
      ) ||
      d.diagramme.some(
        (c) =>
          !c ||
          typeof c.teil !== "string" ||
          !/^ppt\/charts\/[\w-]+\.xml$/.test(c.teil) ||
          typeof c.sldId !== "string" ||
          !Array.isArray(c.datenpunkte) ||
          c.datenpunkte.some((id) => typeof id !== "string"),
      )
    ) {
      throw new DatenFehler(
        "ungueltig",
        "Der PP05-Vertrag ist unvollständig. Vor einer Übernahme klären.",
      );
    }
    leseAufbau(d.plan.auftrag);
    out.push({ pfad, deck: d });
  }
  return out;
}

/** Ein einzelnes OOXML-Element lokalisieren, ohne andere Formen/Formatierung neu aufzubauen. */
function elementBereich(
  xml: string,
  shapeId: string,
): { von: number; bis: number; text: string } | undefined {
  const nvs = [...xml.matchAll(/<p:cNvPr\b[^>]*\bid="([^"]+)"[^>]*>/g)].filter(
    (m) => m[1] === shapeId,
  );
  if (nvs.length !== 1 || nvs[0]?.index === undefined) return undefined;
  const pos = nvs[0].index;
  for (const tag of ["p:sp", "p:graphicFrame"]) {
    const von = xml.lastIndexOf(`<${tag}>`, pos);
    if (von < 0) continue;
    const ende = xml.indexOf(`</${tag}>`, von);
    if (ende < pos) continue;
    const bis = ende + tag.length + 3;
    const t = xml.slice(von, bis);
    if ((t.match(/<p:cNvPr\b/g) ?? []).length === 1) return { von, bis, text: t };
  }
  return undefined;
}

function ersetzeZiel(
  xml: string,
  shapeId: string,
  alt: string,
  neu: string,
  zeile?: number,
  spalte?: number,
): string | undefined {
  const b = elementBereich(xml, shapeId);
  if (!b) return undefined;
  let ziel = b.text;
  let von = 0;
  let bis = ziel.length;
  if (zeile !== undefined) {
    const rows = [...ziel.matchAll(/<a:tr\b[^>]*>[\s\S]*?<\/a:tr>/g)];
    const row = rows[zeile - 1];
    if (!row || row.index === undefined || spalte === undefined) return undefined;
    const cell = [...row[0].matchAll(/<a:tc(?:\s[^>]*)?>[\s\S]*?<\/a:tc>/g)][spalte - 1];
    if (!cell || cell.index === undefined) return undefined;
    von = row.index + cell.index;
    bis = von + cell[0].length;
    ziel = cell[0];
  }
  const laeufe = [...ziel.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)];
  // Geteilte oder mehrdeutige Werte bleiben ein konkreter Konflikt statt einer stillen Ersetzung.
  if (laeufe.filter((m) => zahlStehtImText(decode(m[1] ?? ""), alt)).length !== 1) return undefined;
  const ersetzt = ersetzeImLauf(ziel, alt, neu);
  if (ersetzt === ziel) return undefined;
  const el = b.text.slice(0, von) + ersetzt + b.text.slice(bis);
  return xml.slice(0, b.von) + el + xml.slice(b.bis);
}

/** Nur die vom PP05-Schreiber belegten Textläufe ändern; manuelle Formate erhalten. */
function ersetzeTextlaeufe(
  xml: string,
  shapeId: string,
  altXml: string,
  neuXml: string,
): string | undefined {
  const b = elementBereich(xml, shapeId);
  const a = elementBereich(altXml, shapeId);
  const n = elementBereich(neuXml, shapeId);
  if (!b || !a || !n) return;
  const laeufe = (s: string) =>
    [...s.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((m) => decode(m[1] ?? ""));
  const vorher = laeufe(a.text);
  const aktuell = laeufe(b.text);
  const nachher = laeufe(n.text);
  if (JSON.stringify(vorher) !== JSON.stringify(aktuell)) return;
  let ersetzt: string;
  if (aktuell.length === nachher.length) {
    let i = 0;
    ersetzt = b.text.replace(
      /(<a:t(?:\s[^>]*)?>)[\s\S]*?(<\/a:t>)/g,
      (_m, v: string, h: string) => `${v}${encode(pflicht(nachher[i++]))}${h}`,
    );
  } else {
    const body = /<p:txBody>[\s\S]*?<\/p:txBody>/;
    const altBody = a.text.match(body)?.[0];
    const neuBody = n.text.match(body)?.[0];
    if (!altBody || !neuBody || b.text.match(body)?.[0] !== altBody) return;
    ersetzt = b.text.replace(altBody, neuBody);
  }
  return xml.slice(0, b.von) + ersetzt + xml.slice(b.bis);
}

export interface DateiAktualisierung {
  bytes: Buffer;
  wirkungen: DateiWirkung[];
  konflikte: DateiKonflikt[];
  deckVertraege: { pfad: string; deck: DeckVertrag }[];
  bindungsziele: {
    datenpunktId: string;
    sldId: string;
    shapeId: string;
    zeile?: number;
    spalte?: number;
  }[];
}

export async function aktualisiereDatenDatei(args: {
  bytes: Buffer;
  ko: KnowledgeObject;
  anhangId: string;
  plan: AenderungsPlan;
  u: DatenUmgebung;
  ablage: DatenpunktAblage;
  jetzt: number;
}): Promise<DateiAktualisierung> {
  const { zip, folien } = await lesePraesentation(args.bytes);
  const satz = await leseFolienDaten(args.bytes);
  const vertraege = await leseDeckVertraege(zip);
  const wirkungen: DateiWirkung[] = [];
  const konflikte: DateiKonflikt[] = [];
  const bindungsziele: DateiAktualisierung["bindungsziele"] = [];
  const bereich = new Map(folien.map((f) => [String(f.folieId), f]));
  const ursprung = new Map<string, string>();
  for (const f of folien) ursprung.set(f.pfad, await pflicht(zip.file(f.pfad)).async("string"));
  const konflikt = (k: Omit<DateiKonflikt, "id">) => {
    const id = hash(JSON.stringify(k));
    if (!konflikte.some((x) => x.id === id)) konflikte.push({ id, ...k });
  };
  const punkte = args.plan.nachher;
  let letzteFolie = Math.max(255, ...folien.map((f) => f.folieId));
  const neueBelegfolie = async (
    sldId: string,
    quelle: (typeof folien)[number],
    quellZip: JSZip,
    deck: DeckVertrag,
    id: string,
  ) => {
    const xml = await quellZip.file(quelle.pfad)?.async("string");
    const qp = quelle.pfad.replace(/\/([^/]+)$/, "/_rels/$1.rels");
    const rels = await quellZip.file(qp)?.async("string");
    const p = await zip.file("ppt/presentation.xml")?.async("string");
    const r = await zip.file("ppt/_rels/presentation.xml.rels")?.async("string");
    const ct = await zip.file("[Content_Types].xml")?.async("string");
    if (
      !xml ||
      !rels ||
      !p?.includes("</p:sldIdLst>") ||
      !r?.includes("</Relationships>") ||
      !ct?.includes("</Types>")
    )
      throw new DatenFehler(
        "ungueltig",
        "Eine zusätzliche Belegfolie kann in dieser Vorlage nicht sicher angefügt werden.",
      );
    const pfad = `ppt/slides/klaraPP07_${sldId}.xml`;
    const rid = `klaraPP07_${sldId}`;
    if (zip.file(pfad) || r.includes(`Id="${rid}"`))
      throw new DatenFehler(
        "ungueltig",
        "Die zusätzliche Belegseite kollidiert mit einem vorhandenen Dateiteil.",
      );
    zip.file(pfad, xml);
    zip.file(`ppt/slides/_rels/klaraPP07_${sldId}.xml.rels`, rels);
    zip.file(
      "ppt/presentation.xml",
      p.replace("</p:sldIdLst>", `<p:sldId id="${sldId}" r:id="${rid}"/></p:sldIdLst>`),
    );
    zip.file(
      "ppt/_rels/presentation.xml.rels",
      r.replace(
        "</Relationships>",
        `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/klaraPP07_${sldId}.xml"/></Relationships>`,
      ),
    );
    zip.file(
      "[Content_Types].xml",
      ct.replace(
        "</Types>",
        `<Override PartName="/${pfad}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/></Types>`,
      ),
    );
    deck.folien.push({
      sldId,
      rolle: "detail",
      titel: "Aktualisierte Belege",
      datenpunkte: [{ id, fassung: punkte.get(id)?.fassung ?? 1 }],
    });
  };
  const overlay: DatenpunktAblage = {
    lesen: async (id) => punkte.get(id) ?? args.ablage.lesen(id),
    vonArtikel: async (id) => (await args.ablage.vonArtikel(id)).map((p) => punkte.get(p.id) ?? p),
    gebundenAn: async (id, a) =>
      (await args.ablage.gebundenAn(id, a)).map((p) => punkte.get(p.id) ?? p),
    anlegen: async () => {
      throw new Error("Dateivorschau schreibt nicht.");
    },
    ersetzen: async () => {
      throw new Error("Dateivorschau schreibt nicht.");
    },
  };
  const neuePlaene = new Map<DeckVertrag, AufbauPlan>();
  for (const { deck } of vertraege)
    neuePlaene.set(
      deck,
      await planeAufbau({
        ziel: args.ko,
        anhangId: args.anhangId,
        dateiFassung: satz.fassung,
        auftrag: {
          ...deck.plan.auftrag,
          expectedVersion: args.ko.version,
          datenpunkte: deck.plan.fakten.map((f) => ({
            id: f.id,
            fassung: punkte.get(f.id)?.fassung ?? f.fassung,
          })),
        },
        u: args.plan.umgebung,
        ablage: overlay,
        jetzt: () => args.jetzt,
      }),
    );
  // Dieselbe PP05-Weitergabe-/Herkunftskontrolle auch für bereits bestehende Decks.
  const alle = [...punkte.values()].filter(
    (p) =>
      args.plan.geaendert.includes(p.id) ||
      p.bindungen.some((b) => b.koId === args.ko.id && b.anhangId === args.anhangId),
  );
  for (let i = 0; i < alle.length; i += 12) {
    const gruppe = alle.slice(i, i + 12);
    if (gruppe.length)
      await planeAufbau({
        ziel: args.ko,
        anhangId: args.anhangId,
        dateiFassung: satz.fassung,
        auftrag: {
          expectedVersion: args.ko.version,
          titel: "Datenaktualisierung",
          ziel: "Bestehende Daten prüfen und aktualisieren",
          publikum: "Bestehender Leserkreis",
          dauerMinuten: 1,
          design: "vorlage",
          diagramm: false,
          datenpunkte: gruppe.map((p) => ({ id: p.id, fassung: p.fassung })),
        },
        u: args.plan.umgebung,
        ablage: overlay,
        jetzt: () => args.jetzt,
      });
  }
  const ziele = new Map<
    string,
    { id: string; fassung: number; sldId: string; shapeId: string; zeile?: number; spalte?: number }
  >();
  for (const alt of args.plan.vorher.values()) {
    for (const b of alt.bindungen) {
      if (b.koId !== args.ko.id || b.anhangId !== args.anhangId) {
        if (args.plan.geaendert.includes(alt.id) && (await args.u.artikel(b.koId)))
          konflikt({
            sldId: b.sldId,
            datenpunktId: alt.id,
            art: "andere_datei",
            grund: `Weitere Bindung in Artikel ${b.koId}, Anhang ${b.anhangId}, Element ${b.shapeId}: diese Datei wird nicht mitgeschrieben.`,
          });
        continue;
      }
      ziele.set(`${b.sldId}:${b.shapeId}:${b.zeile ?? ""}:${b.spalte ?? ""}:${alt.id}`, {
        id: alt.id,
        fassung: b.datenFassung,
        sldId: b.sldId,
        shapeId: b.shapeId,
        ...(b.zeile === undefined ? {} : { zeile: b.zeile, spalte: b.spalte }),
      });
    }
  }
  for (const { deck } of vertraege)
    for (const b of deck.bindungen) {
      ziele.set(`${b.sldId}:${b.shapeId}:${b.zeile ?? ""}:${b.spalte ?? ""}:${b.datenpunktId}`, {
        id: b.datenpunktId,
        fassung: b.datenFassung,
        sldId: b.sldId,
        shapeId: b.shapeId,
        ...(b.zeile === undefined ? {} : { zeile: b.zeile, spalte: b.spalte }),
      });
    }
  if (ziele.size > 500)
    throw new DatenFehler(
      "ungueltig",
      "Mehr als 500 Bindungen: die Aktualisierung bitte aufteilen.",
    );
  const belegt = new Map<string, Set<string>>();
  for (const z of ziele.values()) {
    const alt = args.plan.vorher.get(z.id);
    const damals = alt ? inFassung(alt, z.fassung) : undefined;
    const neu = punkte.get(z.id);
    if (!damals || !neu) continue;
    const key = `${z.sldId}:${z.shapeId}:${z.zeile ?? ""}:${z.spalte ?? ""}`;
    const liste = belegt.get(key) ?? new Set<string>();
    liste.add(JSON.stringify([damals.wert, neu.wert]));
    belegt.set(key, liste);
  }
  const bearbeitet = new Set<string>();
  const alteWerte = new Map<string, { id: string; wert: string }>();
  for (const z of ziele.values()) {
    const aktuell = args.plan.vorher.get(z.id) ?? (await args.u.datenpunkt(z.id));
    const alt = aktuell ? inFassung(aktuell, z.fassung) : undefined;
    const neu = punkte.get(z.id) ?? aktuell;
    if (
      !alt ||
      !neu ||
      !(await vollLesbar(alt, args.u)) ||
      !(await vollLesbar(neu, args.plan.umgebung))
    )
      throw new DatenFehler("kein_zugriff", "Datenpunkt nicht gefunden.");
    const ort = `${z.sldId}:${z.shapeId}:${z.zeile ?? ""}:${z.spalte ?? ""}`;
    if ((belegt.get(ort)?.size ?? 0) > 1) {
      konflikt({
        sldId: z.sldId,
        datenpunktId: z.id,
        art: "element",
        grund: `Element ${z.shapeId} ist mit unterschiedlichen Datenwerten mehrfach gebunden. Keine eindeutige automatische Ersetzung; Inhalt bleibt erhalten.`,
      });
      continue;
    }
    if (alt.wert !== neu.wert) alteWerte.set(`${z.id}:${alt.wert}`, { id: z.id, wert: alt.wert });
    if (bearbeitet.has(ort)) {
      bindungsziele.push({
        datenpunktId: z.id,
        sldId: z.sldId,
        shapeId: z.shapeId,
        ...(z.zeile === undefined ? {} : { zeile: z.zeile, spalte: z.spalte }),
      });
      continue;
    }
    if (alt.wert === neu.wert) {
      const el = satz.folien
        .find((f) => f.sldId === z.sldId)
        ?.elemente.find((e) => e.shapeId === z.shapeId);
      const t =
        z.zeile === undefined
          ? el?.text
          : el?.zellen?.find((c) => c.zeile === z.zeile && c.spalte === z.spalte)?.text;
      if (t && zahlStehtImText(t, neu.wert))
        bindungsziele.push({
          datenpunktId: z.id,
          sldId: z.sldId,
          shapeId: z.shapeId,
          ...(z.zeile === undefined ? {} : { zeile: z.zeile, spalte: z.spalte }),
        });
      continue;
    }
    const f = bereich.get(z.sldId);
    const xml = f ? await zip.file(f.pfad)?.async("string") : undefined;
    const ersetzt = xml
      ? ersetzeZiel(xml, z.shapeId, alt.wert, neu.wert, z.zeile, z.spalte)
      : undefined;
    if (!f || !ersetzt) {
      konflikt({
        sldId: z.sldId,
        datenpunktId: z.id,
        art: "element",
        grund: `Element ${z.shapeId}${z.zeile ? `, Zelle ${z.zeile}/${z.spalte}` : ""}: bisheriger gebundener Wert „${alt.wert}“ fehlt, ist verteilt oder manuell verändert. Inhalt bleibt erhalten.`,
      });
      continue;
    }
    zip.file(f.pfad, ersetzt);
    bearbeitet.add(ort);
    wirkungen.push({
      sldId: z.sldId,
      shapeId: z.shapeId,
      datenpunktId: z.id,
      vorher: alt.wert,
      nachher: neu.wert,
      art: z.zeile ? "tabelle" : "text",
    });
    bindungsziele.push({
      datenpunktId: z.id,
      sldId: z.sldId,
      shapeId: z.shapeId,
      ...(z.zeile === undefined ? {} : { zeile: z.zeile, spalte: z.spalte }),
    });
  }
  for (const f of folien) {
    if (!f.notizPfad) continue;
    const text = await zip.file(f.notizPfad)?.async("string");
    if (!text) continue;
    const abs = notizAbsaetze(text);
    for (const { id, wert } of alteWerte.values()) {
      abs.forEach((a, i) => {
        if (zahlStehtImText(a, wert))
          konflikt({
            sldId: String(f.folieId),
            datenpunktId: id,
            art: "notiz",
            grund: `Notizseite ${f.notizPfad}, Absatz ${i + 1}: „${a.slice(0, 300)}“. PP05-v1 hat hier keine Datenbindung; diese konkrete Notiz wird unverändert zur Klärung erhalten.`,
          });
      });
    }
  }
  const belegIds = new Set(vertraege.flatMap((v) => v.deck.belegfolien.flatMap((b) => b.sldIds)));
  for (const f of satz.folien) {
    if (belegIds.has(f.sldId)) continue;
    for (const e of f.elemente) {
      for (const { id, wert } of alteWerte.values()) {
        const teile = e.zellen?.map((c) => ({
          text: c.text,
          key: `${f.sldId}:${e.shapeId}:${c.zeile}:${c.spalte}`,
          ort: `Zelle ${c.zeile}/${c.spalte}`,
        })) ?? [{ text: e.text, key: `${f.sldId}:${e.shapeId}::`, ort: "Text" }];
        for (const t of teile)
          if (!belegt.has(t.key) && zahlStehtImText(t.text, wert))
            konflikt({
              sldId: f.sldId,
              datenpunktId: id,
              art: "ungebunden",
              grund: `Element ${e.shapeId}, ${t.ort}: „${t.text.slice(0, 300)}“ enthält den bisherigen Wert „${wert}“, hat aber keine eindeutige Datenbindung. Unabhängigen manuellen Inhalt erhalten; möglichen Zusammenhang konkret klären.`,
            });
      }
    }
  }
  // Bestehende PP05-Diagramme und ihre native eingebettete Arbeitsmappe gemeinsam aktualisieren.
  for (const { deck } of vertraege)
    for (const c of deck.diagramme) {
      const alt = c.datenpunkte.map((id) => deck.plan.fakten.find((f) => f.id === id));
      const neuPlan = pflicht(neuePlaene.get(deck));
      const neu = c.datenpunkte.map((id) => neuPlan.fakten.find((f) => f.id === id));
      if (
        !neu.some(
          (p, i) =>
            p &&
            JSON.stringify([p.wert, p.label, p.einheit, p.zeitraum, p.waehrung, p.prognose]) !==
              JSON.stringify([
                alt[i]?.wert,
                alt[i]?.label,
                alt[i]?.einheit,
                alt[i]?.zeitraum,
                alt[i]?.waehrung,
                alt[i]?.prognose,
              ]),
        )
      )
        continue;
      const orig = await zip.file(c.teil)?.async("string");
      const relPfad = c.teil.replace(/\/([^/]+)$/, "/_rels/$1.rels");
      const rels = await zip.file(relPfad)?.async("string");
      const target = rels?.match(/Target="(?:\.\.\/)?embeddings\/([\w.-]+\.xlsx)"/)?.[1];
      const wbPfad = target ? `ppt/embeddings/${target}` : undefined;
      const wbBytes = wbPfad ? await zip.file(wbPfad)?.async("nodebuffer") : undefined;
      let ok =
        !!orig &&
        !!wbBytes &&
        !!neuPlan.diagramm &&
        alt.every((p) => p && p.zahl !== undefined) &&
        neu.every((p) => p && p.zahl !== undefined);
      const cache = orig?.match(/<c:numCache>[\s\S]*?<\/c:numCache>/)?.[0];
      const vals = cache
        ? [...cache.matchAll(/<c:pt idx="\d+"><c:v>([^<]+)<\/c:v><\/c:pt>/g)].map((m) =>
            Number(m[1]),
          )
        : [];
      const cat = orig?.match(/<c:strCache>[\s\S]*?<\/c:strCache>/)?.[0];
      const labels = alt.map((p) => (p?.prognose ? `${p.label} (Prognose)` : p?.label));
      const neueLabels = neu.map((p) => (p?.prognose ? `${p.label} (Prognose)` : p?.label));
      const kategorien = cat
        ? [...cat.matchAll(/<c:pt idx="\d+"><c:v>([^<]*)<\/c:v><\/c:pt>/g)].map((m) =>
            decode(m[1] ?? ""),
          )
        : [];
      ok =
        ok &&
        JSON.stringify(kategorien) === JSON.stringify(labels) &&
        vals.length === alt.length &&
        vals.every((v, i) => v === alt[i]?.zahl) &&
        pflicht(orig).includes(`<c:min val="${c.minimum}"/>`) &&
        pflicht(orig).includes(`<c:max val="${c.maximum}"/>`);
      let wb: JSZip | undefined;
      let sheet: string | undefined;
      if (wbBytes) {
        wb = await JSZip.loadAsync(wbBytes);
        sheet = await wb.file("xl/worksheets/sheet1.xml")?.async("string");
      }
      ok =
        ok &&
        !!sheet &&
        alt.every((p, i) =>
          new RegExp(`<c r="B${i + 2}"><v>${p?.zahl}</v></c>`).test(pflicht(sheet)),
        ) &&
        labels.every((l, i) =>
          pflicht(sheet).includes(
            `<c r="A${i + 2}" t="inlineStr"><is><t>${encode(pflicht(l))}</t></is></c>`,
          ),
        ) &&
        pflicht(sheet).includes(
          `<c r="B1" t="inlineStr"><is><t>${encode(deck.plan.diagramm?.einheit ?? "")}</t></is></c>`,
        ) &&
        pflicht(orig).includes(`<a:t>${encode(deck.plan.diagramm?.einheit ?? "")}</a:t>`);
      if (!ok || !orig || !wb || !sheet || !wbPfad) {
        konflikt({
          sldId: c.sldId,
          datenpunktId: c.datenpunkte.join(","),
          art: "diagramm",
          grund: `Diagramm ${c.teil}: Werte, Beschriftungen, native Arbeitsmappe oder Skala weichen vom gebundenen PP05-Stand ab, oder die neuen Einheiten/Zeiträume sind nicht mehr vergleichbar. Diagramm und Arbeitsmappe bleiben unverändert.`,
        });
        continue;
      }
      const zahlen = neu.map((p) => pflicht(p?.zahl));
      const min = Math.min(0, ...zahlen);
      const max = Math.max(0, ...zahlen);
      const maximum = min === max ? max + 1 : max;
      const neueCache = pflicht(cache).replace(
        /(<c:pt idx="(\d+)"><c:v>)[^<]+(<\/c:v><\/c:pt>)/g,
        (_m, a: string, i: string, b: string) => `${a}${zahlen[Number(i)]}${b}`,
      );
      const neueCat = pflicht(cat).replace(
        /(<c:pt idx="(\d+)"><c:v>)[^<]*(<\/c:v><\/c:pt>)/g,
        (_m, a: string, i: string, b: string) =>
          `${a}${encode(pflicht(neueLabels[Number(i)]))}${b}`,
      );
      zip.file(
        c.teil,
        orig
          .replace(pflicht(cache), neueCache)
          .replace(pflicht(cat), neueCat)
          .replace(
            `<a:t>${encode(deck.plan.diagramm?.einheit ?? "")}</a:t>`,
            `<a:t>${encode(pflicht(neuPlan.diagramm).einheit)}</a:t>`,
          )
          .replace(`<c:min val="${c.minimum}"/>`, `<c:min val="${min}"/>`)
          .replace(`<c:max val="${c.maximum}"/>`, `<c:max val="${maximum}"/>`),
      );
      zahlen.forEach((v, i) => {
        sheet = pflicht(sheet).replace(
          new RegExp(`(<c r="B${i + 2}"><v>)[^<]+(</v></c>)`),
          (_m, a: string, b: string) => `${a}${v}${b}`,
        );
        sheet = pflicht(sheet).replace(
          `<c r="A${i + 2}" t="inlineStr"><is><t>${encode(pflicht(labels[i]))}</t></is></c>`,
          `<c r="A${i + 2}" t="inlineStr"><is><t>${encode(pflicht(neueLabels[i]))}</t></is></c>`,
        );
      });
      sheet = sheet.replace(
        `<c r="B1" t="inlineStr"><is><t>${encode(deck.plan.diagramm?.einheit ?? "")}</t></is></c>`,
        `<c r="B1" t="inlineStr"><is><t>${encode(pflicht(neuPlan.diagramm).einheit)}</t></is></c>`,
      );
      wb.file("xl/worksheets/sheet1.xml", sheet);
      zip.file(wbPfad, await wb.generateAsync({ type: "nodebuffer" }));
      c.minimum = min;
      c.maximum = maximum;
      for (let i = 0; i < neu.length; i++)
        if (
          pflicht(neu[i]).wert !== pflicht(alt[i]).wert ||
          neueLabels[i] !== labels[i] ||
          neuPlan.diagramm?.einheit !== deck.plan.diagramm?.einheit
        )
          wirkungen.push({
            sldId: c.sldId,
            shapeId: c.shapeId,
            datenpunktId: pflicht(neu[i]).id,
            vorher: pflicht(alt[i]).wert,
            nachher: pflicht(neu[i]).wert,
            art: "diagramm",
          });
    }
  // Belegfolien über denselben PP05-Planungsweg neu aufbauen, nur wenn ihr alter Inhalt unverändert ist.
  for (const v of vertraege) {
    const neuPlan = pflicht(neuePlaene.get(v.deck));
    // Der PP05-Schreiber ist der einzige Erzeuger der Quellen-/Prüftexte und ihrer Aufteilung.
    const { schreibeDatenfolien } = await import("./office-datenfolien");
    const probe = await schreibeDatenfolien(args.bytes, neuPlan);
    const probeLeser = await lesePraesentation(probe.bytes);
    const { schreibeDatenfolien: altSchreiber } = await import("./office-datenfolien");
    const altProbe = await altSchreiber(args.bytes, v.deck.plan);
    const altLeser = await lesePraesentation(altProbe.bytes);
    const kontext = async (
      sldId: string,
      altId: string,
      neuId: string,
      shapeId: string,
      id: string,
      hard = false,
    ) => {
      const f = bereich.get(sldId);
      const a = altLeser.folien.find((f) => String(f.folieId) === altId);
      const n = probeLeser.folien.find((f) => String(f.folieId) === neuId);
      const xml = f ? await zip.file(f.pfad)?.async("string") : undefined;
      const ax = a ? await altLeser.zip.file(a.pfad)?.async("string") : undefined;
      const nx = n ? await probeLeser.zip.file(n.pfad)?.async("string") : undefined;
      if (!ax || !nx || elementBereich(ax, shapeId)?.text === elementBereich(nx, shapeId)?.text)
        return;
      const ersetzt = xml ? ersetzeTextlaeufe(xml, shapeId, ax, nx) : undefined;
      if (!f || !ersetzt) {
        konflikt({
          sldId,
          datenpunktId: id,
          art: "beleg",
          ...(hard ? { sperrtUebernahme: true } : {}),
          grund: `Element ${shapeId}: Bezugsrahmen, Beschriftung oder Prüfstand wurde manuell geändert. Konkreten Inhalt vor weiterer Verwendung klären; manuelle Änderung bleibt erhalten.`,
        });
        return;
      }
      zip.file(f.pfad, ersetzt);
      wirkungen.push({
        sldId,
        shapeId,
        datenpunktId: id,
        vorher: "Bisheriger Bezugsrahmen / Prüfstand",
        nachher: "Aktueller Bezugsrahmen / Prüfstand",
        art: "beleg",
      });
    };
    for (const b of v.deck.bindungen) {
      const alt = v.deck.plan.fakten.find((f) => f.id === b.datenpunktId);
      const neu = neuPlan.fakten.find((f) => f.id === b.datenpunktId);
      if (!alt || !neu) continue;
      if (b.zeile === undefined) {
        const a = altProbe.deck.bindungen.find(
          (x) => x.datenpunktId === b.datenpunktId && x.zeile === undefined,
        );
        const n = probe.deck.bindungen.find(
          (x) => x.datenpunktId === b.datenpunktId && x.zeile === undefined,
        );
        if (!a || !n) throw new DatenFehler("ungueltig", "Die PP05-Kontextbindung fehlt.");
        await kontext(b.sldId, a.sldId, n.sldId, "2", b.datenpunktId);
        await kontext(b.sldId, a.sldId, n.sldId, "4", b.datenpunktId, true);
      } else
        for (const [spalte, vorher, nachher] of [
          [1, `${alt.label} (${alt.einheit})`, `${neu.label} (${neu.einheit})`],
          [3, alt.zeitraum, neu.zeitraum],
          [
            4,
            `${alt.prognose ? "Prognose · " : ""}${alt.zustand}`,
            `${neu.prognose ? "Prognose · " : ""}${neu.zustand}`,
          ],
        ] as const) {
          if (vorher === nachher) continue;
          const f = bereich.get(b.sldId);
          const xml = f ? await zip.file(f.pfad)?.async("string") : undefined;
          const ersetzt = xml
            ? ersetzeZiel(xml, b.shapeId, vorher, nachher, b.zeile, spalte)
            : undefined;
          if (!f || !ersetzt) {
            konflikt({
              sldId: b.sldId,
              datenpunktId: b.datenpunktId,
              art: "beleg",
              ...(spalte === 4 ? { sperrtUebernahme: true } : {}),
              grund: `Element ${b.shapeId}, Zelle ${b.zeile}/${spalte}: bisheriger Bezugsrahmen oder Prüfstand fehlt oder wurde manuell geändert. Konkret klären; Inhalt bleibt erhalten.`,
            });
            continue;
          }
          zip.file(f.pfad, ersetzt);
          wirkungen.push({
            sldId: b.sldId,
            shapeId: b.shapeId,
            datenpunktId: b.datenpunktId,
            vorher,
            nachher,
            art: "beleg",
          });
        }
    }
    for (const c of v.deck.diagramme) {
      const a = altProbe.deck.diagramme[0];
      const n = probe.deck.diagramme[0];
      if (a && n) await kontext(c.sldId, a.sldId, n.sldId, "2", c.datenpunkte.join(","));
    }
    for (const beleg of v.deck.belegfolien) {
      const neuBeleg = probe.deck.belegfolien.find((b) => b.datenpunktId === beleg.datenpunktId);
      const altBeleg = altProbe.deck.belegfolien.find((b) => b.datenpunktId === beleg.datenpunktId);
      if (!neuBeleg || !altBeleg || altBeleg.sldIds.length !== beleg.sldIds.length) {
        konflikt({
          sldId: beleg.sldIds.join(","),
          datenpunktId: beleg.datenpunktId,
          art: "beleg",
          sperrtUebernahme: true,
          grund:
            "Die bisher gebundenen Belegseiten sind nicht mehr vollständig rekonstruierbar. Bestehende Detailfolien bleiben erhalten und müssen konkret geklärt werden.",
        });
        continue;
      }
      for (let i = 0; i < beleg.sldIds.length; i++) {
        const f = bereich.get(pflicht(beleg.sldIds[i]));
        const n = probeLeser.folien.find(
          (f) => String(f.folieId) === neuBeleg.sldIds[Math.min(i, neuBeleg.sldIds.length - 1)],
        );
        const o = altLeser.folien.find((f) => String(f.folieId) === altBeleg.sldIds[i]);
        const vorhanden = f ? ursprung.get(f.pfad) : undefined;
        const altXml = o ? await altLeser.zip.file(o.pfad)?.async("string") : undefined;
        const neuXml = n ? await probeLeser.zip.file(n.pfad)?.async("string") : undefined;
        const b = vorhanden ? elementBereich(vorhanden, "3") : undefined;
        const altB = altXml ? elementBereich(altXml, "3") : undefined;
        const neuB = neuXml ? elementBereich(neuXml, "3") : undefined;
        if (!f || !b || !altB || !neuB || b.text !== altB.text) {
          konflikt({
            sldId: pflicht(beleg.sldIds[i]),
            datenpunktId: beleg.datenpunktId,
            art: "beleg",
            sperrtUebernahme: true,
            grund:
              "Die Quellen-/Prüffolie wurde manuell geändert oder ist nicht mehr eindeutig. Unabhängigen Inhalt erhalten und Beleg ausdrücklich klären.",
          });
          continue;
        }
        zip.file(
          f.pfad,
          pflicht(vorhanden).slice(0, b.von) + neuB.text + pflicht(vorhanden).slice(b.bis),
        );
        await kontext(
          pflicht(beleg.sldIds[i]),
          String(pflicht(o).folieId),
          String(pflicht(n).folieId),
          "2",
          beleg.datenpunktId,
        );
        wirkungen.push({
          sldId: pflicht(beleg.sldIds[i]),
          shapeId: "3",
          datenpunktId: beleg.datenpunktId,
          vorher: "Bisheriger Quellen-/Prüfstand",
          nachher: "Aktuelle vorgeschlagene Datenfassung; Prüfung nach Übernahme nötig",
          art: "beleg",
        });
      }
      for (let i = beleg.sldIds.length; i < neuBeleg.sldIds.length; i++) {
        const q = probeLeser.folien.find((f) => String(f.folieId) === neuBeleg.sldIds[i]);
        if (!q) throw new DatenFehler("ungueltig", "Die neu benötigte PP05-Belegseite fehlt.");
        if (v.deck.folien.length >= 160)
          throw new DatenFehler(
            "ungueltig",
            "Der vorhandene PP05-Deckvertrag erreicht mit den zusätzlichen Belegen seine Grenze von 160 Folien. Die Dateivorschau wurde nicht gespeichert.",
          );
        const id = String(++letzteFolie);
        await neueBelegfolie(id, q, probeLeser.zip, v.deck, beleg.datenpunktId);
        beleg.sldIds.push(id);
        wirkungen.push({
          sldId: id,
          shapeId: "3",
          datenpunktId: beleg.datenpunktId,
          vorher: "Keine zusätzliche Belegseite",
          nachher: "Zusätzliche aktuelle Herkunfts-/Prüfdetails",
          art: "beleg",
        });
      }
    }
    const offeneFolien = new Set(konflikte.flatMap((k) => k.sldId.split(",")));
    v.deck.plan = neuPlan;
    for (const f of v.deck.folien)
      if (!offeneFolien.has(f.sldId))
        f.datenpunkte = f.datenpunkte.map((p) => ({
          id: p.id,
          fassung: punkte.get(p.id)?.fassung ?? p.fassung,
        }));
    for (const b of v.deck.bindungen)
      if (
        bindungsziele.some(
          (z) =>
            z.datenpunktId === b.datenpunktId &&
            z.sldId === b.sldId &&
            z.shapeId === b.shapeId &&
            z.zeile === b.zeile &&
            z.spalte === b.spalte,
        )
      )
        b.datenFassung = punkte.get(b.datenpunktId)?.fassung ?? b.datenFassung;
    for (const b of v.deck.belegfolien)
      if (!b.sldIds.some((id) => offeneFolien.has(id)))
        b.datenFassung = punkte.get(b.datenpunktId)?.fassung ?? b.datenFassung;
    zip.file(v.pfad, JSON.stringify(v.deck));
  }
  const result = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const erneut = await leseFolienDaten(result);
  for (const w of wirkungen.filter((w) => w.art === "text" || w.art === "tabelle")) {
    const el = erneut.folien
      .find((f) => f.sldId === w.sldId)
      ?.elemente.find((e) => e.shapeId === w.shapeId);
    if (!el || !zahlStehtImText(el.text, w.nachher))
      throw new DatenFehler(
        "ungueltig",
        "Wiederöffnungsprüfung der aktualisierten Werte fehlgeschlagen.",
      );
  }
  return { bytes: result, wirkungen, konflikte, deckVertraege: vertraege, bindungsziele };
}

/** Zwei echte Dateien, gleiche Datenbasis; im kurzen Vortrag sind die Vertiefungen ausgeblendet. */
export async function schreibeTiefe(
  bytes: Buffer,
  tiefe: "kurz" | "ausfuehrlich",
): Promise<{ bytes: Buffer; folien: string[]; basis: string }> {
  const { zip, folien } = await lesePraesentation(bytes);
  const decks = await leseDeckVertraege(zip);
  if (!decks.length)
    throw new DatenFehler(
      "ungueltig",
      "Diese Präsentation hat noch keinen PP05-Deckvertrag. Zuerst den vorhandenen Folienaufbau verwenden.",
    );
  const rollen = new Map(
    decks.flatMap((d) => d.deck.folien.map((f) => [f.sldId, f.rolle] as const)),
  );
  for (const f of folien) {
    const rolle = rollen.get(String(f.folieId));
    if (!rolle) continue;
    const xml = await pflicht(zip.file(f.pfad)).async("string");
    const sichtbar = tiefe === "ausfuehrlich" || rolle === "haupt";
    zip.file(
      f.pfad,
      xml.replace(/<p:sld\b([^>]*)>/, (m, attrs: string) =>
        m.startsWith("<p:sld ") || m === "<p:sld>"
          ? `<p:sld${attrs.replace(/\s+show="[^"]*"/g, "")} show="${sichtbar ? "1" : "0"}">`
          : m,
      ),
    );
  }
  const basis = hash(bytes);
  zip.file(
    "ppt/klara/pp07-variante.json",
    JSON.stringify({
      vertrag: "klara-pp07-variante-v1",
      tiefe,
      basis,
      datenbasis: decks.flatMap((d) =>
        d.deck.plan.fakten.map((f) => ({ id: f.id, fassung: f.fassung })),
      ),
    }),
  );
  const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const gelesen = await leseFolienDaten(out);
  return {
    bytes: out,
    folien: gelesen.folien.filter((f) => !f.ausgeblendet).map((f) => f.sldId),
    basis,
  };
}
