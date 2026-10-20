// PP-08: textbasierte Vorbereitung am bestehenden PP-02/03-Kontext.
// Keine Ablage, kein Modell, kein Host-/Audiozugriff. Rückgaben referenzieren Datenfassungen;
// ihre Herkunft und Kontrollen werden bei JEDEM Aufruf vom bestehenden Datenweg neu gelesen.
import {
  DatenFehler,
  type FolieMitElementen,
  zahlAusWert,
  zahlStehtImText,
} from "./praesentation-daten";
import type { KontrollierteSicht } from "./praesentation-pruefung-anschluss";
import type { VortragsDeck } from "./praesentation-vortrag-deck";

export class VortragsKonflikt extends Error {}

export interface VortragsKontext {
  koId: string;
  anhangId: string;
  dateiFassung: string;
  folien: readonly FolieMitElementen[];
  datenpunkte: readonly KontrollierteSicht[];
  deck?: VortragsDeck;
}
export interface AussageBezug {
  id: string;
  fassung: number;
}
export interface VortragsNotiz {
  sldId: string;
  text: string;
  uebergang: string;
  sekunden: number;
  aussagen: AussageBezug[];
  detailSldIds: string[];
}
export interface NachbereitungsEintrag {
  sldId: string;
  aussage: AussageBezug;
  art: "rueckfrage" | "erklaerung" | "zusage" | "korrektur";
  text: string;
  quelle: string;
}
export interface VortragsAuftrag {
  basis: string;
  modus: "vorbereiten" | "probe" | "frage" | "nachbereitung";
  zielSekunden: number;
  notizen: VortragsNotiz[];
  probe?: { ausdruecklichGestartet: true; sldId: string; text: string };
  frage?: { text: string; aussage?: AussageBezug; sldId?: string };
  nachbereitung: NachbereitungsEintrag[];
}
export interface VortragsAufgabe {
  schluessel: string;
  titel: string;
  arbeit: string;
  sldId: string;
  aussage?: AussageBezug;
  herkunft: { art: "vorbereitung" | "probe" | "nachbereitung"; text: string; quelle: string };
}
export interface VortragsErgebnis {
  basis: string;
  modus: VortragsAuftrag["modus"];
  notizen: VortragsNotiz[];
  sprechhilfen: VortragsNotiz[];
  belegfolien: { aussage: AussageBezug; sldIds: string[] }[];
  zeit: { geplant: number; ziel: number; abweichung: number };
  leitfragen: { sldId: string; aussage: AussageBezug; text: string }[];
  aufgaben: VortragsAufgabe[];
  probe: null | {
    woerter: number;
    schaetzungSekunden: { von: number; bis: number };
    langeSaetze: number;
    grundlage: string;
  };
  antwort: null | {
    stand: "beleg" | "auswahl_noetig" | "kein_beleg";
    kandidaten: AussageBezug[];
    sldIds: string[];
    grund: string;
  };
}

const ungueltig = (text: string): never => {
  throw new DatenFehler("ungueltig", text);
};
const objekt = (x: unknown): Record<string, unknown> =>
  x && typeof x === "object" && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : ungueltig("Ein Objekt wird erwartet.");
const text = (x: unknown, feld: string, max = 6000, pflicht = false): string => {
  if (typeof x !== "string" || x.length > max || (pflicht && !x.trim()))
    return ungueltig(`${feld}: gültigen Text angeben (höchstens ${max} Zeichen).`);
  return x.trim();
};
const liste = (x: unknown, feld: string, max: number): unknown[] =>
  Array.isArray(x) && x.length <= max
    ? x
    : ungueltig(`${feld}: Liste mit höchstens ${max} Einträgen angeben.`);
const sekunden = (x: unknown): number =>
  typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= 28800
    ? x
    : ungueltig("Zeit in ganzen Sekunden von 0 bis 28800 angeben.");
const bezug = (x: unknown): AussageBezug => {
  const r = objekt(x);
  if (!Number.isSafeInteger(r.fassung) || Number(r.fassung) < 1)
    return ungueltig("Datenfassung fehlt.");
  return { id: text(r.id, "Datenpunkt", 100, true), fassung: Number(r.fassung) };
};
export function leseVortragsAuftrag(roh: unknown): VortragsAuftrag {
  const r = objekt(roh);
  if (!["vorbereiten", "probe", "frage", "nachbereitung"].includes(String(r.modus)))
    return ungueltig("Vortragsaktion fehlt.");
  const a: VortragsAuftrag = {
    basis: text(r.basis, "Dateifassung", 64, true),
    modus: r.modus as VortragsAuftrag["modus"],
    zielSekunden: sekunden(r.zielSekunden),
    notizen: liste(r.notizen ?? [], "Notizen", 100).map((n) => {
      const o = objekt(n);
      return {
        sldId: text(o.sldId, "Folie", 100, true),
        text: text(o.text ?? "", "Notiz"),
        uebergang: text(o.uebergang ?? "", "Übergang", 2000),
        sekunden: sekunden(o.sekunden),
        aussagen: liste(o.aussagen ?? [], "Aussagen", 100).map(bezug),
        detailSldIds: liste(o.detailSldIds ?? [], "Detailfolien", 30).map((s) =>
          text(s, "Detailfolie", 100, true),
        ),
      };
    }),
    nachbereitung: liste(r.nachbereitung ?? [], "Nachbereitung", 100).map((n) => {
      const o = objekt(n);
      if (!["rueckfrage", "erklaerung", "zusage", "korrektur"].includes(String(o.art)))
        return ungueltig("Art der Nachbereitung fehlt.");
      return {
        sldId: text(o.sldId, "Folie", 100, true),
        aussage: bezug(o.aussage),
        art: o.art as NachbereitungsEintrag["art"],
        text: text(o.text, "Nachbereitung", 6000, true),
        quelle: text(o.quelle, "Herkunft der bereitgestellten Notiz", 1000, true),
      };
    }),
  };
  if (a.modus === "probe") {
    const p = objekt(r.probe);
    if (p.ausdruecklichGestartet !== true) return ungueltig("Probevortrag ausdrücklich starten.");
    a.probe = {
      ausdruecklichGestartet: true,
      sldId: text(p.sldId, "Folie des Probetexts", 100, true),
      text: text(p.text, "Bereitgestellter Probetext", 60000, true),
    };
  }
  if (a.modus === "frage") {
    const f = objekt(r.frage);
    a.frage = {
      text: text(f.text, "Rückfrage", 2000, true),
      ...(f.aussage === undefined ? {} : { aussage: bezug(f.aussage) }),
      ...(f.sldId === undefined ? {} : { sldId: text(f.sldId, "Folie", 100, true) }),
    };
  }
  if (a.modus === "nachbereitung" && !a.nachbereitung.length)
    return ungueltig("Vom Nutzer bereitgestellte Nachbereitung fehlt.");
  return a;
}

/** Eine ausdrücklich genannte Einheit/Periode darf die Zahlensuche nicht still verlieren. */
function fragePasst(d: KontrollierteSicht, frage: string): boolean {
  const quartal = frage.match(/\bQ[1-4]\b/iu)?.[0];
  const jahr = frage.match(/\b(?:19|20)\d{2}\b/u)?.[0];
  if (quartal && !d.zeitraum?.toLowerCase().includes(quartal.toLowerCase())) return false;
  if (jahr && !d.zeitraum?.includes(jahr)) return false;
  const einheiten = [
    ...frage.matchAll(/[-−+]?\d+(?:[.,]\d+)*\s*(T€|Mio\.?\s*€|EUR|Euro|€|%|USD|\$)/giu),
  ];
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s|\./gu, "")
      .replace(/euro|eur/gu, "€");
  for (const m of einheiten) {
    if (zahlAusWert(m[0]) !== d.zahl) continue;
    const einheit = m[1] ?? "";
    const erlaubt = [d.einheit, d.wert.match(/T€|Mio\.?\s*€|EUR|Euro|€|%|USD|\$/iu)?.[0]]
      .filter((x): x is string => !!x)
      .map(norm);
    if (!erlaubt.includes(norm(einheit))) return false;
  }
  return (
    zahlStehtImText(frage, d.wert) ||
    (d.zahl !== undefined &&
      [...frage.matchAll(/[-−+]?\d+(?:[.,]\d+)*/g)].some((m) => zahlAusWert(m[0]) === d.zahl))
  );
}

export function vortragAuswerten(k: VortragsKontext, a: VortragsAuftrag): VortragsErgebnis {
  if (k.dateiFassung !== a.basis)
    throw new VortragsKonflikt(
      "Die Präsentationsfassung hat sich geändert. Notizen und Zuordnungen an der aktuellen Fassung erneut prüfen.",
    );
  const folien = new Map(k.folien.map((f) => [f.sldId, f]));
  const punkte = new Map(k.datenpunkte.map((d) => [d.id, d]));
  const folie = (id: string) =>
    folien.get(id) ?? ungueltig("Die gewählte Folie ist in dieser Fassung nicht vorhanden.");
  const amOrt = (d: KontrollierteSicht, id?: string) =>
    d.bindungen.some(
      (b) =>
        b.koId === k.koId &&
        b.anhangId === k.anhangId &&
        (!id || b.sldId === id) &&
        (b.lage === "aktuell" || b.lage === "bestaetigt_in_neuer_fassung") &&
        folien.has(b.sldId),
    );
  const belegfolien =
    k.deck?.dateiFassung === k.dateiFassung
      ? k.deck.belegfolien.map((b) => ({
          aussage: { id: b.datenpunktId, fassung: b.datenFassung },
          sldIds: b.sldIds,
        }))
      : [];
  const belegAmOrt = (b: AussageBezug, id: string) =>
    belegfolien.some(
      (p) => p.aussage.id === b.id && p.aussage.fassung === b.fassung && p.sldIds.includes(id),
    );
  const aussage = (b: AussageBezug, id?: string) => {
    const d = punkte.get(b.id);
    if (!d || (!amOrt(d, id) && !(id && belegAmOrt(b, id))))
      return ungueltig(
        "Die Aussage ist an dieser Folie nicht aktuell lesbar gebunden. Herkunft und Bindung prüfen.",
      );
    if (d.fassung !== b.fassung)
      throw new VortragsKonflikt(
        "Die Aussage wurde geändert. Die Zuordnung zur neuen Datenfassung ausdrücklich erneut prüfen.",
      );
    return d;
  };
  const aufgaben: VortragsAufgabe[] = [];
  const add = (
    sldId: string,
    titel: string,
    arbeit: string,
    herkunft: VortragsAufgabe["herkunft"],
    b?: AussageBezug,
  ) => {
    aufgaben.push({
      schluessel: `${herkunft.art}:${sldId}:${b?.id ?? ""}:${aufgaben.length}`,
      sldId,
      titel,
      arbeit,
      herkunft,
      ...(b ? { aussage: b } : {}),
    });
  };
  const gesehen = new Set<string>();
  for (const n of a.notizen) {
    folie(n.sldId);
    if (gesehen.has(n.sldId)) return ungueltig("Jede Folie nur einmal im Vortragsplan führen.");
    gesehen.add(n.sldId);
    for (const b of n.aussagen) aussage(b, n.sldId);
    for (const id of n.detailSldIds) {
      folie(id);
      if (!n.aussagen.some((b) => amOrt(aussage(b, n.sldId), id) || belegAmOrt(b, id)))
        return ungueltig(
          "Eine Detailfolie muss dieselbe Aussage aktuell belegen. Nur ihre Position genügt nicht.",
        );
    }
    const h = {
      art: "vorbereitung" as const,
      text: n.text,
      quelle: "Vom Nutzer bereitgestellte Sprechernotiz",
    };
    if (!n.text)
      add(
        n.sldId,
        "Erklärung ergänzen",
        "Die Kernaussage und ihre Bedeutung in eigenen Worten erläutern.",
        h,
        n.aussagen[0],
      );
    if (!n.sekunden) add(n.sldId, "Zeitrahmen ergänzen", "Geplante Dauer dieser Folie angeben.", h);
    for (const b of n.aussagen) {
      const d = aussage(b, n.sldId);
      const stand = d.kontrolle ?? d.pruefstand;
      for (const arbeit of stand.naechsteArbeit ?? [])
        add(
          n.sldId,
          "Datenprüfung offen",
          arbeit,
          { ...h, text: "", quelle: "Aktueller PP-02/03-Prüfstand" },
          b,
        );
    }
  }
  for (const n of a.nachbereitung) {
    folie(n.sldId);
    aussage(n.aussage, n.sldId);
    add(
      n.sldId,
      {
        rueckfrage: "Rückfrage beantworten",
        erklaerung: "Erklärung ergänzen",
        zusage: "Zusage nachhalten",
        korrektur: "Korrektur prüfen",
      }[n.art],
      n.text,
      { art: "nachbereitung", text: n.text, quelle: n.quelle },
      n.aussage,
    );
  }
  const relevant = k.datenpunkte.filter((d) => amOrt(d));
  const leitfragen = relevant.map((d) => ({
    sldId:
      d.bindungen.find((b) => b.koId === k.koId && b.anhangId === k.anhangId && amOrt(d, b.sldId))
        ?.sldId ?? "",
    aussage: { id: d.id, fassung: d.fassung },
    text:
      d.erfassung === "prognose"
        ? "Welche Annahmen und welches Modell tragen diese Prognose?"
        : d.rechenweg
          ? "Welche Eingaben, Formel und Rundung tragen diesen Wert?"
          : "Woher stammt diese Aussage, für welchen Zeitraum gilt sie und was erklärt sie?",
  }));
  let probe: VortragsErgebnis["probe"] = null;
  if (a.modus === "probe") {
    if (!a.probe?.ausdruecklichGestartet) return ungueltig("Probevortrag ausdrücklich starten.");
    const w = a.probe.text.match(/\S+/g)?.length ?? 0;
    probe = {
      woerter: w,
      schaetzungSekunden: { von: Math.ceil((w / 140) * 60), bis: Math.ceil((w / 100) * 60) },
      langeSaetze: a.probe.text.split(/[.!?]+/).filter((s) => (s.match(/\S+/g)?.length ?? 0) > 30)
        .length,
      grundlage:
        "Textschätzung mit angenommener Sprechgeschwindigkeit von 100–140 Wörtern/Minute; keine gemessene Redezeit und keine inhaltliche Verständlichkeitsabnahme.",
    };
    const n = a.notizen.find((n) => n.sldId === a.probe?.sldId);
    if (!n) return ungueltig("Probetext zuerst einer Folie im Vortragsplan zuordnen.");
    for (const token of new Set(a.probe.text.match(/\d+(?:[.,]\d+)*/g) ?? [])) {
      if (!n.aussagen.some((b) => zahlStehtImText(aussage(b).wert, token)))
        add(
          n.sldId,
          "Zahlenangabe belegen",
          `Die Zahlenangabe „${token}“ einer passenden Aussage zuordnen oder aus dem Probetext korrigieren.`,
          { art: "probe", text: token, quelle: "Ausdrücklich gestarteter Text-Probevortrag" },
        );
    }
  }
  let antwort: VortragsErgebnis["antwort"] = null;
  if (a.modus === "frage") {
    if (!a.frage) return ungueltig("Rückfrage fehlt.");
    if (a.frage.sldId) folie(a.frage.sldId);
    const f = a.frage;
    const kandidaten = f.aussage
      ? [aussage(f.aussage, f.sldId)]
      : relevant.filter(
          (d) => (!f.sldId || amOrt(d, f.sldId)) && d.art === "zahl" && fragePasst(d, f.text),
        );
    const stand =
      kandidaten.length === 1 ? "beleg" : kandidaten.length ? "auswahl_noetig" : "kein_beleg";
    const d = kandidaten.length === 1 ? kandidaten[0] : undefined;
    if (f.sldId)
      add(
        f.sldId,
        "Rückfrage erklären",
        f.text,
        { art: "vorbereitung", text: f.text, quelle: "Vom Nutzer gestellte Rückfrage" },
        d ? { id: d.id, fassung: d.fassung } : undefined,
      );
    antwort = {
      stand,
      kandidaten: kandidaten.map((x) => ({ id: x.id, fassung: x.fassung })),
      sldIds: d
        ? [
            ...new Set(
              d.bindungen
                .filter((b) => b.koId === k.koId && b.anhangId === k.anhangId && amOrt(d, b.sldId))
                .map((b) => b.sldId),
            ),
          ]
        : [],
      grund:
        stand === "beleg"
          ? "Herkunft und aktuellen Prüfstand der ausgewählten Datenfassung öffnen. Ein Beleg allein ersetzt keine fehlende Erklärung."
          : stand === "auswahl_noetig"
            ? "Mehrere Aussagen passen zur Zahl. Aussage oder Folie ausdrücklich auswählen."
            : "Keine eindeutig passende Zahl gefunden. Aussage ausdrücklich auswählen; eine Erklärung bleibt offen.",
    };
  }
  // Sprechhilfen verwenden ausschließlich gebundene Angaben; die Bedeutung bleibt eine
  // konkrete menschliche Erklärungsaufgabe. Vorschlag, keine fachliche Zusatzbehauptung.
  const sprechhilfen = k.folien
    .filter((f) => !f.ausgeblendet)
    .map((f, i, reihe): VortragsNotiz => {
      const daten = relevant.filter((d) => amOrt(d, f.sldId));
      const text = daten.length
        ? `Belegte Angaben: ${daten.map((d) => `${d.wert}${d.zeitraum ? ` (${d.zeitraum})` : " (Zeitraum offen)"}${d.erfassung === "prognose" ? " — Prognose, Annahmen erläutern" : ""}`).join("; ")}. Bedeutung und offene Prüfungen erläutern.`
        : "Kernaussage erläutern und fehlenden Beleg ergänzen.";
      const uebergang = reihe[i + 1]
        ? `Als Nächstes: ${reihe[i + 1]?.titel}.`
        : "Offene Fragen und nächste Schritte zusammenfassen.";
      return {
        sldId: f.sldId,
        text,
        uebergang,
        sekunden: Math.ceil(((`${text} ${uebergang}`.match(/\S+/g)?.length ?? 0) / 120) * 60),
        aussagen: daten.map((d) => ({ id: d.id, fassung: d.fassung })),
        detailSldIds: [],
      };
    });
  if (antwort?.stand === "beleg") {
    const b = antwort.kandidaten[0];
    if (b)
      antwort.sldIds = [
        ...new Set([
          ...antwort.sldIds,
          ...belegfolien
            .filter((x) => x.aussage.id === b.id && x.aussage.fassung === b.fassung)
            .flatMap((x) => x.sldIds),
        ]),
      ];
  }
  const geplant = a.notizen.reduce((s, n) => s + n.sekunden, 0);
  return {
    basis: k.dateiFassung,
    modus: a.modus,
    notizen: a.notizen,
    sprechhilfen,
    belegfolien,
    zeit: { geplant, ziel: a.zielSekunden, abweichung: geplant - a.zielSekunden },
    leitfragen,
    aufgaben,
    probe,
    antwort,
  };
}
