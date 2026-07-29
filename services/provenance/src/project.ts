// AUFTRAG-mega45 Block A — die Projektion selbst. REIN, ohne Datenbank, ohne Netz, ohne Uhr.
//
// Sie bildet einen Bestandsauszug (ProvenanceInput) auf Knoten und Kanten ab. Alles, was sie
// ausgibt, steht so im Bestand; alles, was im Bestand keinen Erzeuger hat, gibt sie NICHT aus.
import type {
  ProvenanceAudit,
  ProvenanceEdge,
  ProvenanceEdgeKind,
  ProvenanceInput,
  ProvenanceNode,
  ProvenanceNodeStatus,
  ProvenanceProjection,
} from "./types";

/**
 * Obergrenze der dargestellten Knoten. Eine Herkunftskette hat typischerweise ein bis zwei Dutzend
 * Knoten; wo es mehr werden, wird gekürzt — und die Kürzung wird AUSGEWIESEN (A3).
 */
export const MAX_PROVENANCE_NODES = 60;

const knotenId = (art: string, id: string): string => `${art}:${id}`;

/** Ein Erzeuger, der diesen Namen verdient: eine nichtleere Kennung UND ein nichtleerer Zeitpunkt. */
function erzeugerTaugt(by: string | undefined, at: string | undefined): boolean {
  return typeof by === "string" && by.trim() !== "" && typeof at === "string" && at.trim() !== "";
}

/** Der Status des Wurzelobjekts aus seinen vorhandenen Feldern — nichts geraten. */
function koStatus(ko: ProvenanceInput["ko"]): ProvenanceNodeStatus {
  if (ko.status === "validiert") {
    return "menschlich_geprueft";
  }
  return ko.maschinellGeprueft ? "maschinell_bestaetigt" : "entwurf";
}

/**
 * Der Status eines Konfliktknotens. Er sagt, WIE GUT BELEGT die Behauptung „hier widerspricht sich
 * etwas" ist — nicht, ob der Widerspruch stimmt.
 */
function konfliktStatus(
  status: string,
  herkunft: "manual" | "auto" | undefined,
): ProvenanceNodeStatus {
  if (status === "geloest") {
    return "abgeloest";
  }
  return herkunft === "auto" ? "maschinell_bestaetigt" : "menschlich_geprueft";
}

export function projectProvenance(input: ProvenanceInput): ProvenanceProjection {
  const nodes: ProvenanceNode[] = [];
  const edges: ProvenanceEdge[] = [];
  const audit: ProvenanceAudit = { redactedByRights: 0, droppedWithoutOriginator: [] };

  const ohneErzeuger = (kind: ProvenanceEdgeKind, ref: string, grund: string): void => {
    audit.droppedWithoutOriginator.push({ kind, ref, grund });
  };

  // --- Wurzel: das Wissensobjekt ----------------------------------------------------------------
  const wurzel = knotenId("ko", input.ko.id);
  nodes.push({
    id: wurzel,
    kind: "wissensobjekt",
    label: input.ko.titel,
    status: koStatus(input.ko),
    // B3: fehlt der Beleg, ist GENAU DAS sichtbar — nicht eine leere Stelle.
    unbelegt: input.belege.length === 0,
  });

  // --- Originale und Quellen --------------------------------------------------------------------
  for (const o of input.originale) {
    nodes.push({
      id: knotenId("original", o.id),
      kind: "original",
      label: o.bezeichnung,
      status: "vermerk",
      at: o.zeitpunkt,
    });
  }
  for (const q of input.quellen) {
    nodes.push({
      id: knotenId("quelle", q.id),
      kind: "quelle",
      label: q.bezeichnung,
      status: "vermerk",
      at: q.zeitpunkt,
      ...(q.anbieter ? { detail: q.anbieter } : {}),
    });
  }

  // --- Belege: KO --belegt_durch--> Beleg --stammt_aus--> Quelle/Original ------------------------
  for (const b of input.belege) {
    const belegKnoten = knotenId("beleg", b.id);
    if (!erzeugerTaugt(b.urheber, b.zeitpunkt)) {
      // Ein Beleg ohne Erzeuger ist kein Beleg. Er wird nicht dargestellt, und das steht im Protokoll.
      ohneErzeuger("belegt_durch", b.id, "Evidence-Record ohne createdBy/createdAt");
      continue;
    }
    nodes.push({
      id: belegKnoten,
      kind: "beleg",
      label: b.bezeichnung,
      status: "vermerk",
      at: b.zeitpunkt,
    });
    edges.push({
      id: `belegt_durch:${b.id}`,
      kind: "belegt_durch",
      from: wurzel,
      to: belegKnoten,
      // mega26 Block B: der GRUND der Verknüpfung wird zum Kantentext — wörtlich, nicht umformuliert.
      origin: { by: b.urheber, at: b.zeitpunkt, ...(b.grund ? { reason: b.grund } : {}) },
    });
    const ziel =
      b.art === "source" && b.quelleId
        ? knotenId("quelle", b.quelleId)
        : b.originalId
          ? knotenId("original", b.originalId)
          : null;
    if (ziel !== null) {
      edges.push({
        id: `stammt_aus:${b.id}`,
        kind: "stammt_aus",
        from: belegKnoten,
        to: ziel,
        origin: { by: b.urheber, at: b.zeitpunkt },
      });
    }
  }

  // --- Prüfungen/Versionen: jüngere löst ältere ab ----------------------------------------------
  const versionen = [...input.versionen].sort((a, b) => a.version - b.version);
  for (const v of versionen) {
    if (!erzeugerTaugt(v.urheber, v.zeitpunkt)) {
      ohneErzeuger("loest_ab", `v${v.version}`, "Versions-Snapshot ohne author/at");
      continue;
    }
    nodes.push({
      id: knotenId("pruefung", String(v.version)),
      kind: "pruefung",
      label: v.vermerk,
      // Die aktuelle Fassung trägt den Status des Objekts, jede ältere ist abgelöst.
      status: v.version === input.ko.version ? koStatus(input.ko) : "abgeloest",
      at: v.zeitpunkt,
      detail: `v${v.version}`,
    });
  }
  for (let i = 1; i < versionen.length; i += 1) {
    const neu = versionen[i];
    const alt = versionen[i - 1];
    if (!neu || !alt || !erzeugerTaugt(neu.urheber, neu.zeitpunkt)) {
      continue;
    }
    edges.push({
      id: `loest_ab:${neu.version}`,
      kind: "loest_ab",
      from: knotenId("pruefung", String(neu.version)),
      to: knotenId("pruefung", String(alt.version)),
      origin: { by: neu.urheber, at: neu.zeitpunkt, reason: neu.vermerk },
    });
  }

  // --- Konflikte ---------------------------------------------------------------------------------
  for (const k of input.konflikte) {
    // A3 — DIE RECHTEPRÜFUNG, VOR ALLEM ANDEREN.
    //
    // Ist die Gegenseite für diesen Anwender nicht sichtbar, entfällt der GANZE Konflikt: Knoten,
    // beide Kanten, Beschreibung, Zitate. NICHT nur der Titel der Gegenseite.
    //
    // Warum so grob: der Konflikt-Datensatz IST der Verräter. Seine `beschreibung` zitiert
    // regelmässig beide Seiten, und `detector.quotes` trägt wörtliche Belegzitate aus dem
    // vertraulichen Objekt. Die Rot-Sonde in tests/app/mega45-herkunft-rechte.test.ts hat genau
    // das nachgewiesen: ohne diese Stelle standen „Uebernahmeangebot Nordwerk AG" und „Der
    // Kaufpreis liegt bei 240 Millionen Euro." im Graphen, obwohl die Gegenseite als unsichtbar
    // gekennzeichnet war. Ein anonymisierter Konfliktknoten wäre eine Anzeige, die ihr Geheimnis
    // im Klartext danebenlegt.
    //
    // Und es wird NICHTS an seiner Stelle ausgewiesen — keine Zahl, kein Platzhalter, kein
    // „1 weiterer". Gezählt wird ausschliesslich im Prüfprotokoll, das den Server nicht verlässt.
    // Dass diese Stelle VOR der Umfangs-Kürzung steht, ist ebenfalls Absicht: ein unsichtbarer
    // Knoten darf keinen Umfangsplatz belegen, sonst wäre die ehrliche Kürzungszahl rückrechenbar.
    if (!k.gegenseite.sichtbar) {
      audit.redactedByRights += 1;
      continue;
    }
    // Der Erzeuger: entweder der Mensch, der ihn behauptet hat (mega26 Block B), oder die
    // Erkennung, die sich über origin/detector ausweist. Fehlt BEIDES — der systematische Fall bei
    // manuellem Altbestand vor mega26 —, wird die Beziehung NICHT projiziert.
    const durchErkennung = k.herkunft === "auto" && k.erkenner !== undefined;
    const by = durchErkennung ? (k.erkenner?.bezeichnung ?? "") : (k.urheber ?? "");
    if (!erzeugerTaugt(by, k.zeitpunkt)) {
      ohneErzeuger(
        "widerspricht",
        k.id,
        "Konflikt ohne createdBy und ohne detector (manueller Altbestand vor mega26)",
      );
      continue;
    }
    const konfliktKnoten = knotenId("konflikt", k.id);
    nodes.push({
      id: konfliktKnoten,
      kind: "konflikt",
      label: k.beschreibung,
      status: konfliktStatus(k.status, k.herkunft),
      at: k.zeitpunkt,
      detail: k.art,
    });
    edges.push({
      id: `widerspricht:${k.id}`,
      kind: "widerspricht",
      from: wurzel,
      to: konfliktKnoten,
      origin: {
        by,
        at: k.zeitpunkt,
        // Das wörtliche Belegzitat der Erkennung, wo es eines gibt.
        ...(k.erkenner?.zitat
          ? { reason: k.erkenner.zitat }
          : k.erkenner?.begruendung
            ? { reason: k.erkenner.begruendung }
            : {}),
      },
    });
    // Ab hier ist die Gegenseite nachweislich sichtbar (der Frühausstieg oben hat den anderen Fall
    // bereits entfernt) — sie darf mit Kennung und Titel erscheinen.
    const gegen = knotenId("ko", k.gegenseite.id);
    nodes.push({
      id: gegen,
      kind: "wissensobjekt",
      label: k.gegenseite.titel,
      status: "vermerk",
    });
    edges.push({
      id: `widerspricht_gegen:${k.id}`,
      kind: "widerspricht",
      from: konfliktKnoten,
      to: gegen,
      origin: { by, at: k.zeitpunkt },
    });
  }

  // --- Modellläufe -------------------------------------------------------------------------------
  for (const l of input.laeufe) {
    // Der Lauf weist sich selbst aus: Anbieter + Zeitpunkt stehen IMMER im Protokoll. Der `akteur`
    // (mega26 Block A) ist optional und wird genommen, wo er da ist.
    const by = l.akteur?.trim() ? l.akteur : l.anbieter;
    if (!erzeugerTaugt(by, l.zeitpunkt)) {
      ohneErzeuger("erzeugt_von", l.id, "Modelllauf ohne Anbieter/Zeitpunkt");
      continue;
    }
    const laufKnoten = knotenId("lauf", l.id);
    nodes.push({
      id: laufKnoten,
      kind: "modelllauf",
      label: l.aufgabe,
      status: "vermerk",
      at: l.zeitpunkt,
      detail: l.modell ?? l.anbieter,
    });
    edges.push({
      id: `erzeugt_von:${l.id}`,
      kind: "erzeugt_von",
      from: wurzel,
      to: laufKnoten,
      origin: { by, at: l.zeitpunkt },
    });
  }

  // --- Umfangs-Kürzung, AUSGEWIESEN (A3) --------------------------------------------------------
  const behalten = nodes.slice(0, MAX_PROVENANCE_NODES);
  const behaltenIds = new Set(behalten.map((n) => n.id));
  const graph = {
    root: wurzel,
    nodes: behalten,
    edges: edges.filter((e) => behaltenIds.has(e.from) && behaltenIds.has(e.to)),
    truncated: {
      byScope: nodes.length > MAX_PROVENANCE_NODES,
      omittedNodes: Math.max(0, nodes.length - MAX_PROVENANCE_NODES),
    },
  };
  return { graph, audit };
}
