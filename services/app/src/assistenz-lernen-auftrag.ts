// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 — LAUF ÜBER DEN AKTIONSKERN.
// ================================================================================================
//
// `planeLauf` (assistenz-lernen.ts) entscheidet nur, WAS ein Lauf tun darf. Ausgeführt wird hier
// nichts: Diese Brücke übersetzt einen vollständig freigegebenen Laufplan einer bestätigten
// persönlichen Funktion in die Eingabe eines gebundenen Klara-Auftrags (Klara 05,
// `klara-auftrag.ts`). Anlegen, Grenze, Ausführung, Rechte, Nachlesen, Wiederholschutz, Abbruch und
// Rücknahme sind dann die des vorhandenen Aktionskerns (`POST …/auftraege`,
// `POST …/schritte/:schluessel/ausfuehrung`) — kein zweiter Ausführungs- oder Rechteweg.
//
// UMFANG — bewusst eng:
//   · Nur die Hosts Klarwerk-Web und Word (über den Programmadapter, `assistenz-lernen-word.ts`)
//     und nur, was der Aktionskern als Aktion kennt: einen Entwurf anlegen. Ein Bericht wird ein
//     Entwurf mit Titel und Inhalt aus den Eingaben dieses Laufs (in Word: der Markierung).
//   · Folgenreiche Wirkungen (Senden, Veröffentlichen, Löschen, Bestellen) kennt der Aktionskern
//     nicht; ein Plan mit ihnen wird nicht übersetzt. Finder/Chrome haben keinen Laufweg.
//   · Nur ein Plan ohne Halt: steht ein Entscheidungspunkt, ein Hostwechsel oder eine fehlende
//     Bestätigung an, entscheidet erst die Person.
//
// NACHARBEIT 31 (Ben zu 91ee246d): eine AUSWAHL wird nicht mehr als „Feld: Wert“ in den Text
// geschrieben. Die Ordnungsfelder des Entwurfs (Art, Kategorie, Vertraulichkeit, Fachgebiet) setzt
// der Aktionskern strukturiert (`felder` im Planschritt) und liest sie einzeln nach; jede andere
// Auswahl kann ein Entwurf nicht abbilden — dann hält der Lauf VOR der Ausführung an
// (`auswahl_nicht_unterstuetzt`). Freitext-Eingaben außer Titel/Kernaussage bleiben Textzeilen.
//
// EQF-06-K02 (Nacharbeit 51): gelernte QUELLEN (Schritte „Quelle n“ mit der Kennung eines
// Wissensobjekts) gehen als `quellen` in den Planschritt. Der Aktionskern liest sie im Lauf über den
// vorhandenen Leseweg und übernimmt Titel, aktuelle Fassung, Ort und Kernaussage in den Entwurf;
// `pruefeEntwurf` prüft danach den Bezug jeder Quelle im Ergebnis.
import { kernaussageAusKlartext } from "../../structure";
import type { LaufPlan, LaufSchritt, PersoenlicheFunktion } from "./assistenz-lernen";
import { istQuellZiel } from "./assistenz-lernen-vorfuehrungen";
import { istWordProgramm } from "./assistenz-lernen-word";
import {
  KLARA_KOERPER_MAX,
  KLARA_QUELLEN_MAX,
  type KlaraAuftragEingabe,
  type KlaraAuftragZiel,
  type KlaraEntwurfsfeld,
  type KlaraEntwurfsfelder,
} from "./klara-auftrag";
import { koerperSteht, quellZeile } from "./klara-ausfuehrung";

/** Die Kennung des Hosts Klarwerk-Web — dieselbe wie im P06-Vormachweg (`klarwerk_web`). */
export const HOST_KLARWERK_WEB = "klarwerk_web";

const TITELFELD = /^(titel|title|betreff)$/i;
const INHALTSFELD = /^(kernaussage|aussage|inhalt|statement)$/i;
const TITEL_MAX = 300;
const INHALT_MAX = 2_000;

type EntwurfsOrdnung = Partial<Record<KlaraEntwurfsfeld, unknown>>;

/** Die Auswahlfelder der Erfassung, die ein neuer Entwurf strukturiert trägt. */
export const AUSWAHL_ENTWURFSFELD: Readonly<Record<string, KlaraEntwurfsfeld>> = {
  Art: "type",
  Kategorie: "category",
  Vertraulichkeit: "confidentiality",
  Fachgebiet: "domain",
};

export type BrueckenGrund =
  | "nicht_freigegeben"
  | "andere_fassung"
  | "anderes_objekt"
  | "anderer_host"
  | "aussenwirkung"
  | "auswahl_nicht_unterstuetzt"
  | "ohne_speichern"
  | "kein_titel"
  | "zu_lang";

export type Bruecke =
  | { ok: true; eingabe: KlaraAuftragEingabe; ziel: KlaraAuftragZiel }
  | { ok: false; grund: BrueckenGrund; text: string };

function nein(grund: BrueckenGrund, text: string): Bruecke {
  return { ok: false, grund, text };
}

function feldname(s: LaufSchritt): string {
  return s.ziel?.name.trim() ?? "";
}

function istTitel(s: LaufSchritt): boolean {
  return TITELFELD.test(feldname(s));
}

function istInhalt(s: LaufSchritt): boolean {
  return INHALTSFELD.test(feldname(s));
}

/** EQF-06-K02: ein Lauf-Schritt „Quelle n lesen“ mit der Kennung des Wissensobjekts. */
function istQuelle(s: LaufSchritt): boolean {
  return s.art === "oeffnen" && istQuellZiel(s.ziel) && (s.wert ?? "").trim() !== "";
}

/** Das Entwurfsfeld einer Auswahl — `undefined`, wenn ein Entwurf diese Auswahl nicht kennt. */
function entwurfsfeld(s: LaufSchritt): KlaraEntwurfsfeld | undefined {
  return AUSWAHL_ENTWURFSFELD[feldname(s)];
}

/**
 * Übersetzt den Laufplan in einen gebundenen Klara-Auftrag mit dem Planschritt `entwurf_erstellen`
 * (bei „Ergebnis zur Prüfung“ danach `oeffnen` seines Ergebnisses). Der Titel kommt aus dem
 * Titelfeld des Laufs, der Inhalt aus dem Inhaltsfeld; weitere gesetzte Werte stehen als
 * „Feld: Wert“ darunter.
 */
export function alsKlaraAuftrag(f: PersoenlicheFunktion, plan: LaufPlan): Bruecke {
  if (plan.stand !== "vollstaendig") {
    const text =
      plan.stand === "abgelehnt"
        ? `Der Lauf ist abgelehnt: ${plan.text}`
        : "Der Lauf hält an. Erst entscheidest du, dann läuft er.";
    return nein("nicht_freigegeben", text);
  }
  if (plan.version !== f.version) {
    const text = `Der Plan gehört zu Fassung ${plan.version}, nicht ${f.version}.`;
    return nein("andere_fassung", text);
  }
  if (plan.objekt.kennung !== f.bindung.objekt) {
    return nein("anderes_objekt", "Der Plan gilt für ein anderes Ziel als das bestätigte.");
  }
  // Nacharbeit 41: Word-Routinen laufen jetzt über den Programmadapter (BPA-04) — Ziel- und
  // Markierungsprüfung am Rand, dieselbe Wirkung (ein Entwurf in Klarwerk) hier. Jeder andere Host
  // (Finder, Chrome …) hat keinen Laufweg.
  if (f.bindung.host !== HOST_KLARWERK_WEB && !istWordProgramm(f.bindung.host)) {
    return nein("anderer_host", `${f.bindung.anwendung} läuft über seinen eigenen Hostweg.`);
  }
  const folgenreich = plan.schritte.find((s) =>
    ["senden", "veroeffentlichen", "loeschen", "bestellen"].includes(s.art),
  );
  if (folgenreich) {
    const was = feldname(folgenreich) || folgenreich.art;
    const text = `„${was}“ wirkt nach außen; das ist keine Aktion des Aktionskerns.`;
    return nein("aussenwirkung", text);
  }
  if (!plan.schritte.some((s) => s.art === "speichern")) {
    return nein("ohne_speichern", "Die Funktion speichert nichts; es wird kein Entwurf angelegt.");
  }
  const unbekannt = plan.schritte.find((s) => s.art === "auswahl" && !entwurfsfeld(s));
  if (unbekannt) {
    const was = feldname(unbekannt) || unbekannt.art;
    const text = `Die Auswahl „${was}“ kann ein Entwurf nicht übernehmen. Nichts angelegt.`;
    return nein("auswahl_nicht_unterstuetzt", text);
  }
  const felder: Partial<Record<KlaraEntwurfsfeld, string>> = {};
  for (const s of plan.schritte) {
    const feld = s.art === "auswahl" ? entwurfsfeld(s) : undefined;
    if (feld && s.wert !== undefined) {
      felder[feld] = s.wert.trim();
    }
  }
  const gesetzt = plan.schritte.filter((s) => s.art === "eingabe" && s.wert !== undefined);
  const titel = gesetzt.find(istTitel)?.wert?.trim() ?? "";
  if (!titel) {
    return nein("kein_titel", "Ohne Titel wird kein Entwurf angelegt.");
  }
  const haupt = gesetzt.filter(istInhalt).map((s) => s.wert ?? "");
  const uebrige = gesetzt.filter((s) => !istTitel(s) && !istInhalt(s));
  const weitere = uebrige.map((s) => `${feldname(s) || s.art}: ${s.wert ?? ""}`);
  // Nacharbeit 45: der Inhalt aus Word (Markierung bzw. ganzes Dokument) ist VOLLTEXT. Er geht wie
  // beim Word-Ganzdokumentweg als Körper in den Entwurf; die Kernaussage ist dessen kanonischer
  // erster Satzteil — dieselbe Regel, die der Entwurfsweg ohnehin anwendet.
  const ausWord = istWordProgramm(f.bindung.host);
  const text = [...haupt, ...weitere].join("\n").trim();
  const koerper = ausWord ? text : "";
  const inhalt = ausWord ? kernaussageAusKlartext(text) : text;
  const zuLang = titel.length > TITEL_MAX || inhalt.length > INHALT_MAX;
  if (zuLang || koerper.length > KLARA_KOERPER_MAX) {
    return nein("zu_lang", "Titel oder Inhalt sind für einen Entwurf zu lang.");
  }
  const mitFeldern: { felder?: KlaraEntwurfsfelder } =
    Object.keys(felder).length > 0 ? { felder } : {};
  // EQF-06-K02: die gelernten Quellen in ihrer Reihenfolge (Kennungen). Gelesen werden sie erst im
  // Lauf vom Aktionskern — jetzt, mit den Rechten der Person und in ihrer aktuellen Fassung.
  const quellen = [...new Set(plan.schritte.filter(istQuelle).map((s) => (s.wert ?? "").trim()))];
  if (quellen.length > KLARA_QUELLEN_MAX) {
    return nein("zu_lang", `Höchstens ${KLARA_QUELLEN_MAX} Quellen je Bericht.`);
  }
  const ziel: KlaraAuftragZiel = { art: "neuer_entwurf", id: null, titel, stand: null, pfad: null };
  const name = f.definition.name;
  // EQF-06-K06: „Ergebnis zur Prüfung“ ist ein eigener Planschritt des Aktionskerns — das Ergebnis
  // des ersten Schritts öffnen (`ausSchritt`). Der Server bestätigt dabei Ziel und Rechte; erst das
  // Öffnen durch die Person schließt den Auftrag ab. „Gemeinsam schrittweise“ hat dieselben zwei
  // Schritte, jeden erst auf den Klick der Person. „Selbstständig“ hat nur den Anlageschritt.
  const zurPruefung = f.ausfuehrung === "zur_pruefung" || f.ausfuehrung === "schrittweise";
  const eingabe: KlaraAuftragEingabe = {
    quelle: "getippt",
    wortlaut: `Meine Funktion „${name}“ ausführen (Fassung ${f.version}, Lauf ${plan.lauf})`,
    ziel: zurPruefung
      ? `Entwurf „${titel}“ anlegen und dir zur Prüfung öffnen`
      : `Entwurf „${titel}“ anlegen`,
    erlaubteAktionen: zurPruefung ? ["entwurf_erstellen", "oeffnen"] : ["entwurf_erstellen"],
    erlaubteZiele: [ziel],
    erlaubteQuellen: [
      `Meine Funktion „${name}“ (Fassung ${f.version})`,
      ...quellen.map((id) => `Wissensobjekt ${id}`.slice(0, 200)),
    ],
    ergebnis: f.definition.ergebnis.slice(0, 600),
    geplanteSchritte: zurPruefung ? 2 : 1,
    plan: [
      {
        aktion: "entwurf_erstellen",
        ziel,
        ...(inhalt ? { inhalt } : {}),
        ...mitFeldern,
        ...(koerper ? { koerper } : {}),
        ...(quellen.length > 0 ? { quellen } : {}),
      },
      ...(zurPruefung ? [{ aktion: "oeffnen", ausSchritt: 1 }] : []),
    ],
  };
  return { ok: true, eingabe, ziel };
}

/** EQF-06-K06: die Schrittschlüssel des Aktionskerns je Planschritt eines Routinenlaufs. */
export const ROUTINEN_SCHRITT_BERICHT = "bericht-1";
export const ROUTINEN_SCHRITT_PRUEFEN = "pruefen-2";

/**
 * AC08: Ergebnisprüfung am NACHGELESENEN Entwurf — der Titel steht genau so da, jede Auswahl steht
 * genau so in IHREM Feld (nicht bloß im Text), jede weitere Eingabe steht im Inhalt.
 */
export function pruefeEntwurf(
  plan: LaufPlan,
  entwurf: {
    id: string;
    payload: { title?: string; statement?: string; bodyHtml?: unknown } & EntwurfsOrdnung;
  },
  /**
   * Nacharbeit 45: bei Word steht der Inhalt (Markierung bzw. ganzes Dokument) im Körper — geprüft
   * wird dort, vollständig; die Kernaussage ist nur sein kanonischer erster Satzteil.
   */
  inhaltImKoerper = false,
): { ok: boolean; abweichungen: string[] } {
  if (plan.stand !== "vollstaendig") {
    return { ok: false, abweichungen: ["Der Lauf war nicht freigegeben."] };
  }
  const abweichungen: string[] = [];
  const titel = entwurf.payload.title ?? "";
  const inhalt = entwurf.payload.statement ?? "";
  for (const s of plan.schritte) {
    // EQF-06-K02: jede gelernte Quelle steht mit ihrem Ort im Ergebnis (Ergebnisbezug).
    if (istQuelle(s)) {
      if (!koerperSteht(entwurf.payload.bodyHtml, quellZeile((s.wert ?? "").trim()))) {
        abweichungen.push(`„${feldname(s)}“ fehlt als Quelle im Entwurf ${entwurf.id}.`);
      }
      continue;
    }
    if ((s.art !== "eingabe" && s.art !== "auswahl") || s.wert === undefined) {
      continue;
    }
    let passt: boolean;
    if (s.art === "auswahl") {
      const feld = entwurfsfeld(s);
      passt = feld !== undefined && entwurf.payload[feld] === s.wert.trim();
    } else if (istTitel(s)) {
      passt = titel === s.wert.trim();
    } else if (inhaltImKoerper) {
      passt = koerperSteht(entwurf.payload.bodyHtml, s.wert);
    } else {
      passt = inhalt.includes(s.wert);
    }
    if (!passt) {
      abweichungen.push(`„${feldname(s)}“ weicht im Entwurf ${entwurf.id} ab.`);
    }
  }
  return { ok: abweichungen.length === 0, abweichungen };
}
