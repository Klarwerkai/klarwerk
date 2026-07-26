// AUFTRAG-mega14 Block A-2 (bens SB-1) — die Anzeige der Integritätsprüfung darf keine URSACHE
// behaupten, die der Code nicht kennt. Und zwar in BEIDE Richtungen.
//
// Vorher kannte `Admin.tsx` zwei Zustände: grün oder „Kette verletzt ✗ — Manipulation erkannt".
// Der Server lieferte nur `{ok, count}` und konnte einen echten Kettenbruch gar nicht von einer
// durch jsonb-Schlüsselreihenfolge erklärbaren Hashabweichung unterscheiden. Die rote Meldung war
// damit eine Falschaussage gegenüber dem Nutzer.
//
// Es sind DREI Zustände. Die Grenze zwischen Gelb und Rot ist bewusst streng:
//   GRÜN  — nichts weicht ab.
//   GELB  — Verkettung lückenlos UND jede Abweichung ist als Feldreihenfolge aufgelöst.
//   ROT   — alles andere: echter Kettenbruch, nicht aufgelöste oder NICHT GEPRÜFTE Abweichung.
//
// bens Reichweitengrenze, die auch gegen uns schneidet: die Kette hat keinen extern signierten
// Kettenkopf. Ein Angreifer mit ausreichendem DB-Zugriff könnte theoretisch einen Eintrag und alle
// Folgehashes neu bilden. Die Oberfläche darf deshalb weder „Manipulation erkannt" noch
// „Manipulation ausgeschlossen" behaupten. Gelb sagt „die VORLIEGENDEN Werte passen zum
// gespeicherten Hash" — nicht „die Werte sind unverändert". Das ist eine Aussage über den Befund,
// keine über die Vergangenheit.

import type { AuditVerifyReport, ChainDeviationKind } from "../api/types";

export type AuditVerifyTone = "ok" | "warn" | "crit";

export interface AuditVerifyView {
  tone: AuditVerifyTone;
  key: string;
  params: Record<string, string | number>;
  // Nur im roten Zustand: der i18n-Schlüssel für die Art der ersten Abweichung. Wird von der
  // Oberfläche aufgelöst und als {{kind}} eingesetzt — kein englischer Rohbezeichner im Text.
  kindKey?: string;
}

const KIND_KEY: Record<ChainDeviationKind, string> = {
  linkage: "adm.sich.verify.kind.linkage",
  serialisation: "adm.sich.verify.kind.serialisation",
  unresolved: "adm.sich.verify.kind.unresolved",
  unchecked: "adm.sich.verify.kind.unchecked",
};

export function auditVerifyView(report: AuditVerifyReport): AuditVerifyView {
  if (report.ok) {
    return { tone: "ok", key: "adm.sich.verify.ok", params: { count: report.count } };
  }

  // GELB: kein einziger Verkettungsbruch, und JEDE Nutzdaten-Abweichung ist durch eine Umordnung
  // derselben Schlüssel mit denselben Werten aufgelöst. Bleibt auch nur eine ungeprüft
  // (`unchecked`) oder unaufgelöst (`unresolved`), ist das nicht mehr Gelb.
  const alleAufgeloest =
    report.payloadDeviations > 0 && report.serialisationDeviations === report.payloadDeviations;
  if (report.linkageBreaks === 0 && alleAufgeloest) {
    return {
      tone: "warn",
      key: "adm.sich.verify.serialisation",
      params: { count: report.count, n: report.payloadDeviations },
    };
  }

  const first = report.firstDeviation;
  if (!first) {
    // Kann nach obiger Definition nicht auftreten (nicht ok ⇒ mindestens eine Abweichung). Wir
    // behaupten hier trotzdem keine Ursache, sondern melden ehrlich „ungeklärt".
    return { tone: "crit", key: "adm.sich.verify.unconfirmedPlain", params: {} };
  }
  return {
    tone: "crit",
    key: "adm.sich.verify.unconfirmed",
    params: { seq: first.seq, at: first.at, action: first.action },
    kindKey: KIND_KEY[first.kind],
  };
}
