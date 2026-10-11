import { createHash } from "node:crypto";
import type { Role } from "../../auth";
import { type KnowledgeObject, responsibleOf } from "../../knowledge-object";
import type { SessionUser } from "./http";
import { darfSehen } from "./sichtbarkeit";
import {
  type SpaceFassung,
  type SpaceZugangsweg,
  darfInSpaceSchreiben,
  darfSpaceInhalteLesen,
  eigenesSpaceRecht,
  istArchiviert,
  lesbareSpaces,
  zugangswege,
} from "./spaces";

// ================================================================================================
// SPACES VERWALTEN — ZUGRIFFSHERKUNFT, ARCHIVFOLGEN, BESTANDSZUORDNUNG (ADMIN-07).
// ================================================================================================
//
// Auftrag `produkt:20261007:spaces:admin-20261009`. Reine Rechnungen über den bestehenden Regeln —
// kein zweites Rechtemodell: wer liest, entscheidet weiter `darfSpaceInhalteLesen`/`darfSehen`, wer
// schreibt `darfInSpaceSchreiben`, woher ein Recht kommt `zugangswege`.
//
// AUSKUNFTSGRENZE: Titel eines Artikels nennen diese Rechnungen nur, wenn der Betrachter ihn nach
// `darfSehen` sehen darf. Sonst steht dort `null` und der Artikel zählt nur mit — so bekommt auch
// die Kontoverwaltung über Archivfolgen oder Bestandsbilanz keinen geschützten Titel (K3).

export interface Konto {
  id: string;
  name: string;
  role: Role;
}

function sitzung(k: Konto, spaces: readonly SpaceFassung[]): SessionUser {
  return { id: k.id, role: k.role, spaceLesbar: lesbareSpaces(spaces, k.id) };
}

function grundlageAus(daten: unknown): string {
  return createHash("sha256").update(JSON.stringify(daten)).digest("hex").slice(0, 32);
}

/** Die Sichtregel des Betrachters — von der Route als `(ko) => darfSehen(user, ko)` übergeben. */
export type BetrachterSieht = (ko: KnowledgeObject) => boolean;

function titelFuer(sieht: BetrachterSieht, ko: KnowledgeObject): string | null {
  return sieht(ko) ? ko.title : null;
}

// ------------------------------------------------------------------------------------------------
// K2 · WER HAT ZUGRIFF, AUF WELCHEM WEG, MIT WELCHER WIRKUNG.
// ------------------------------------------------------------------------------------------------

export interface ZugriffsZeile {
  nutzer: string;
  name: string;
  role: Role;
  /** Jeder Weg einzeln: Zuständigkeit, direkt, je Team — die Herkunft. */
  wege: (SpaceZugangsweg & { teamName?: string })[];
  /** Die Wirkung aller Wege zusammen — dieselbe Auskunft wie `eigenesRecht`. */
  wirksam: ReturnType<typeof eigenesSpaceRecht>;
}

export interface Zugriffsuebersicht {
  spaceId: string;
  version: number;
  archiviert: boolean;
  zugang: SpaceFassung["zugang"];
  personen: ZugriffsZeile[];
  /** Bei offenem Zugang: wie viele Konten OHNE eigenen Weg über „offen" lesen. */
  offenWeitere: number;
}

/**
 * Alle Konten mit einem BENANNTEN Weg (zuständig, direkt, Team). Der offene Zugang wird als Regel
 * gezählt, nicht als Personenliste — sonst stünde jede Konto-Kennung der Instanz in der Antwort.
 */
export function zugriffsuebersicht(
  space: SpaceFassung,
  konten: readonly Konto[],
  teamName: (id: string) => string | undefined,
): Zugriffsuebersicht {
  const personen: ZugriffsZeile[] = [];
  let offenWeitere = 0;
  for (const k of konten) {
    const nutzer = { id: k.id, role: k.role };
    const wege = zugangswege(space, nutzer);
    const benannt = wege.filter((w) => w.art !== "offen");
    if (benannt.length === 0) {
      if (wege.length > 0) {
        offenWeitere += 1;
      }
      continue;
    }
    personen.push({
      nutzer: k.id,
      name: k.name,
      role: k.role,
      wege: wege.map((w) => (w.team ? { ...w, teamName: teamName(w.team) ?? w.team } : w)),
      wirksam: eigenesSpaceRecht(space, nutzer),
    });
  }
  personen.sort((a, b) => a.name.localeCompare(b.name) || a.nutzer.localeCompare(b.nutzer));
  return {
    spaceId: space.id,
    version: space.version,
    archiviert: istArchiviert(space),
    zugang: space.zugang,
    personen,
    offenWeitere,
  };
}

// ------------------------------------------------------------------------------------------------
// K5 · WAS DAS ARCHIVIEREN BEWIRKT — UND WAS ES VERHINDERT.
// ------------------------------------------------------------------------------------------------

export type Verantwortungsfrage =
  | "zustaendig_ohne_konto"
  | "verantwortung_ohne_konto"
  | "verantwortung_ohne_zugang";

export interface ArchivFolgen {
  spaceId: string;
  name: string;
  version: number;
  archiviert: boolean;
  /** Lesen: unverändert — so viele Konten lesen die Inhalte weiter. */
  leserBleiben: number;
  /** Schreiben: entfällt für diese Personen (hinein-/herausbewegen, Spacepflege). */
  schreibenEntfaellt: { id: string; name: string }[];
  artikel: {
    gesamt: number;
    /** Offene Aufgaben: Artikel mit Status „offen" (Prüfung steht aus). */
    offen: number;
    /** Nur die für den Betrachter sichtbaren offenen Artikel — mit Titel. */
    offenSichtbar: { id: string; title: string; version: number }[];
  };
  /** Offene Verantwortungsfragen — jede einzelne verhindert das Archivieren. */
  verantwortungsfragen: {
    art: Verantwortungsfrage;
    anzahl: number;
    /** Sichtbare betroffene Artikel mit Titel; unsichtbare zählen nur in `anzahl`. */
    artikel: { id: string; title: string }[];
  }[];
  darfArchivieren: boolean;
  grund: string | null;
  grundlage: string;
}

export function archivFolgen(
  space: SpaceFassung,
  alleArtikel: readonly KnowledgeObject[],
  konten: readonly Konto[],
  sieht: BetrachterSieht,
  darfBearbeiten: boolean,
): ArchivFolgen {
  const imSpace = alleArtikel
    .filter((k) => k.spaceId === space.id)
    .sort((a, b) => a.id.localeCompare(b.id));
  const kontoIds = new Set(konten.map((k) => k.id));
  const leserBleiben = konten.filter((k) => darfSpaceInhalteLesen(space, k.id)).length;
  const schreibenEntfaellt = istArchiviert(space)
    ? []
    : konten
        .filter((k) => darfInSpaceSchreiben(space, { id: k.id, role: k.role }))
        .map((k) => ({ id: k.id, name: k.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
  const offen = imSpace.filter((k) => k.status === "offen");

  const fragen: ArchivFolgen["verantwortungsfragen"] = [];
  if (!kontoIds.has(space.verantwortlich)) {
    fragen.push({ art: "zustaendig_ohne_konto", anzahl: 1, artikel: [] });
  }
  const ohneKonto = imSpace.filter((k) => !kontoIds.has(responsibleOf(k)));
  const ohneZugang = imSpace.filter(
    (k) => kontoIds.has(responsibleOf(k)) && !darfSpaceInhalteLesen(space, responsibleOf(k)),
  );
  for (const [art, liste] of [
    ["verantwortung_ohne_konto", ohneKonto],
    ["verantwortung_ohne_zugang", ohneZugang],
  ] as const) {
    if (liste.length > 0) {
      fragen.push({
        art,
        anzahl: liste.length,
        artikel: liste
          .map((k) => ({ id: k.id, title: titelFuer(sieht, k) }))
          .filter((k): k is { id: string; title: string } => k.title !== null),
      });
    }
  }

  let grund: string | null = null;
  if (istArchiviert(space)) {
    grund = "Der Space ist bereits archiviert.";
  } else if (!darfBearbeiten) {
    grund = "Nur die Spacezuständigen oder die Kontoverwaltung archivieren diesen Space.";
  } else if (fragen.length > 0) {
    grund =
      "Offene Verantwortungsfragen: erst klären (Zuständigkeit oder Artikelverantwortung neu setzen), dann archivieren.";
  }
  return {
    spaceId: space.id,
    name: space.name,
    version: space.version,
    archiviert: istArchiviert(space),
    leserBleiben,
    schreibenEntfaellt,
    artikel: {
      gesamt: imSpace.length,
      offen: offen.length,
      offenSichtbar: offen
        .filter((k) => sieht(k))
        .map((k) => ({ id: k.id, title: k.title, version: k.version })),
    },
    verantwortungsfragen: fragen,
    darfArchivieren: grund === null,
    grund,
    // Nacharbeit 3 (Ben, K5): die Grundlage trägt die WIRKSAMEN Folgen — je Konto Rolle, Wege
    // (zuständig/direkt/je Team/offen) und Gesamtrecht, dazu die gezeigten Leser- und
    // Schreiberfolgen. Teams lösen Mitglieder beim Lesen auf; eine Teamänderung zwischen Vorschau
    // und Bestätigung ändert keine Spacefassung, wohl aber diese Grundlage (→ 409, neue Vorschau).
    grundlage: grundlageAus({
      space: [space.id, space.version],
      artikel: imSpace.map((k) => [k.id, k.version, k.status, responsibleOf(k)]),
      konten: [...konten]
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((k) => {
          const nutzer = { id: k.id, role: k.role };
          return [k.id, k.role, eigenesSpaceRecht(space, nutzer), zugangswege(space, nutzer)];
        }),
      leserBleiben,
      schreibenEntfaellt: schreibenEntfaellt.map((p) => p.id),
      fragen: fragen.map((f) => [f.art, f.anzahl]),
      darfBearbeiten,
    }),
  };
}

// ------------------------------------------------------------------------------------------------
// K6 · BESTANDSZUORDNUNG — VORHANDENE INHALTE BEKOMMEN EINEN FÜHRENDEN SPACE, OHNE MEHR SICHT.
// ------------------------------------------------------------------------------------------------
//
// Eine Regel ordnet alle Artikel OHNE Space, die ein Tag tragen, einem Zielspace zu. Ein Artikel
// wird nur übernommen, wenn danach NIEMAND mehr sieht als vorher, und wenn Autor und
// Artikelverantwortung ihn weiter sehen. Alles andere ist eine benannte Ausnahme und bleibt
// unverändert. Artikel, die schon einen Space haben, werden nie umgehängt.

export interface BestandsRegel {
  tag: string;
  zielSpaceId: string;
}

export type BestandsAusnahme =
  | "mehrdeutig"
  | "erweitert"
  | "autor_verliert"
  | "verantwortung_verliert"
  | "verwaist";

export interface BestandsPlan {
  regeln: { tag: string; zielSpaceId: string; zielName: string; zielVersion: number }[];
  bilanz: {
    gesamt: number;
    bereitsZugeordnet: number;
    ohneSpace: number;
    zuordenbar: number;
    ausnahmen: number;
    ohneRegel: number;
  };
  zuordnungen: {
    koId: string;
    version: number;
    /** `null`, wenn der Betrachter den Artikel nicht sehen darf. */
    title: string | null;
    zielSpaceId: string;
    zielName: string;
    /** So viele Konten sehen ihn danach nicht mehr — eine Einschränkung, keine Erweiterung. */
    verlieren: number;
  }[];
  ausnahmen: {
    koId: string;
    title: string | null;
    art: BestandsAusnahme;
    ziele: string[];
  }[];
  grundlage: string;
}

export function bestandsPlan(
  regeln: readonly BestandsRegel[],
  spaces: readonly SpaceFassung[],
  alleArtikel: readonly KnowledgeObject[],
  konten: readonly Konto[],
  sieht: BetrachterSieht,
): BestandsPlan {
  const ziel = (id: string) => spaces.find((s) => s.id === id);
  const regelZeilen = regeln.map((r) => {
    const s = ziel(r.zielSpaceId);
    return {
      tag: r.tag,
      zielSpaceId: r.zielSpaceId,
      zielName: s?.name ?? r.zielSpaceId,
      zielVersion: s?.version ?? 0,
    };
  });
  const sitzungen = konten.map((k) => ({ k, s: sitzung(k, spaces) }));
  const bekannt = new Set(spaces.map((s) => s.id));
  const sortiert = [...alleArtikel].sort((a, b) => a.id.localeCompare(b.id));

  const plan: BestandsPlan = {
    regeln: regelZeilen,
    bilanz: {
      gesamt: sortiert.length,
      bereitsZugeordnet: 0,
      ohneSpace: 0,
      zuordenbar: 0,
      ausnahmen: 0,
      ohneRegel: 0,
    },
    zuordnungen: [],
    ausnahmen: [],
    grundlage: "",
  };

  for (const ko of sortiert) {
    const spaceId = typeof ko.spaceId === "string" ? ko.spaceId : null;
    if (spaceId) {
      if (bekannt.has(spaceId)) {
        plan.bilanz.bereitsZugeordnet += 1;
      } else {
        // Ein Artikel mit unbekanntem Space ist für alle verborgen (fail-closed) — benannt, nie still.
        plan.ausnahmen.push({ koId: ko.id, title: null, art: "verwaist", ziele: [] });
      }
      continue;
    }
    plan.bilanz.ohneSpace += 1;
    const tags = new Set(ko.tags.map((t) => t.toLocaleLowerCase()));
    const ziele = [
      ...new Set(
        regeln.filter((r) => tags.has(r.tag.toLocaleLowerCase())).map((r) => r.zielSpaceId),
      ),
    ];
    if (ziele.length === 0) {
      plan.bilanz.ohneRegel += 1;
      continue;
    }
    const title = titelFuer(sieht, ko);
    if (ziele.length > 1) {
      plan.ausnahmen.push({ koId: ko.id, title, art: "mehrdeutig", ziele });
      continue;
    }
    const zielId = ziele[0] as string;
    const nachher: KnowledgeObject = { ...ko, spaceId: zielId };
    let erweitert = false;
    let verlieren = 0;
    for (const { s } of sitzungen) {
      const vor = darfSehen(s, ko);
      const nach = darfSehen(s, nachher);
      if (!vor && nach) {
        erweitert = true;
      } else if (vor && !nach) {
        verlieren += 1;
      }
    }
    const siehtNachher = (id: string): boolean => {
      const eintrag = sitzungen.find((x) => x.k.id === id);
      return eintrag ? darfSehen(eintrag.s, nachher) : false;
    };
    let art: BestandsAusnahme | null = null;
    if (erweitert) {
      art = "erweitert";
    } else if (!siehtNachher(ko.author)) {
      art = "autor_verliert";
    } else if (!siehtNachher(responsibleOf(ko))) {
      art = "verantwortung_verliert";
    }
    if (art) {
      plan.ausnahmen.push({ koId: ko.id, title, art, ziele });
      continue;
    }
    plan.zuordnungen.push({
      koId: ko.id,
      version: ko.version,
      title,
      zielSpaceId: zielId,
      zielName: ziel(zielId)?.name ?? zielId,
      verlieren,
    });
  }
  plan.bilanz.zuordenbar = plan.zuordnungen.length;
  plan.bilanz.ausnahmen = plan.ausnahmen.length;
  plan.grundlage = grundlageAus({
    regeln: regelZeilen.map((r) => [r.tag, r.zielSpaceId, r.zielVersion]),
    zuordnungen: plan.zuordnungen.map((z) => [z.koId, z.version, z.zielSpaceId, z.verlieren]),
    ausnahmen: plan.ausnahmen.map((a) => [a.koId, a.art]),
    konten: konten.map((k) => k.id).sort(),
  });
  return plan;
}

/** Prüft die Regeln eines Bestandsplans — `string` ist die Absage in Worten. */
export function pruefeBestandsRegeln(
  roh: unknown,
  spaces: readonly SpaceFassung[],
): BestandsRegel[] | string {
  if (!Array.isArray(roh) || roh.length === 0 || roh.length > 50) {
    return "Erwartet wird eine Liste von 1 bis 50 Regeln { tag, zielSpaceId }.";
  }
  const raus: BestandsRegel[] = [];
  for (const eintrag of roh) {
    const e = (typeof eintrag === "object" && eintrag !== null ? eintrag : {}) as Record<
      string,
      unknown
    >;
    const tag = typeof e.tag === "string" ? e.tag.normalize("NFC").trim() : "";
    const zielSpaceId = typeof e.zielSpaceId === "string" ? e.zielSpaceId : "";
    if (!tag || tag.length > 80) {
      return "Jede Regel braucht ein Tag.";
    }
    const s = spaces.find((x) => x.id === zielSpaceId);
    if (!s) {
      return "Ein Zielspace ist unbekannt.";
    }
    if (istArchiviert(s)) {
      return `Der Zielspace „${s.name}“ ist archiviert und nimmt keine Inhalte auf.`;
    }
    raus.push({ tag, zielSpaceId });
  }
  return raus;
}
