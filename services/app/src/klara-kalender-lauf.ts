import {
  type AusfuehrungsNachweis,
  type LaufStatus as EigenerLaufStatus,
  type KalenderErgebnis as EigenesErgebnis,
  type ExternerTermin,
  KalenderFehler,
  type KalenderSicht,
  type VorhandenerKalender,
} from "./eigener-kalender";
import type { SessionUser } from "./http";
import {
  type KlaraErinnerungAblage,
  type KlaraErinnerungDienst,
  KlaraErinnerungFehler,
  type KlaraErinnerungLauf,
  findeVorkommen,
} from "./klara-erinnerung";
import { lokalVon, plusTage } from "./klara-erinnerung-zeit";
import {
  type AnbieterTermin,
  type InternerTermin,
  type KalenderAnbindungDienst,
  KalenderAnbindungFehler,
  type KalenderLaufSteuerung,
} from "./klara-kalender-anbindung";

// ================================================================================================
// produkt:20261008:klara-kalender (Klara 11, AW-17, P07) — DER ANSCHLUSS AN DIE TATSÄCHLICHE
// AUSFÜHRUNG UND AN DEN EIGENEN KALENDER. Keine zweite Steuerung, keine neue Ablage.
// ================================================================================================
//
// EINE IDENTITÄT DURCH ALLE DREI WEGE (S09, AW17-K01/K03):
//   · Erinnerungssteuerung (`klara-erinnerung.ts`, C04): Auftrag = Erinnerung (`erinnerungId`),
//     Vorkommen/Lauf = `vorkommen_id` (`<erinnerungId>@<nominaler Termin>`).
//   · Eigener Kalender (`eigener-kalender.ts`, C06): ein Eintrag verweist auf DENSELBEN Auftrag
//     (`auftrag.taskId` = Erinnerung) und DASSELBE Vorkommen (`lauf.runId` = `vorkommen_id`).
//   · Kalenderanbindung (`klara-kalender-anbindung.ts`): `auftragId` und `ereignisId` der Zuordnung
//     sind genau diese beiden Kennungen (`kalenderIdentitaet`). Ein Eintrag ohne Lauf trägt seine
//     eigene `event_id` als Ereignis — er hat keinen Lauf, den eine Sperre anhalten könnte.
//
// DIE SPERRE WIRKT IN DER STEUERUNG: `KalenderAnbindungDienst.vorkommenSperre` ist dauerhaft
// gespeichert und wird von der EINEN Steuerung unmittelbar vor jeder Wirkung gelesen
// (`KlaraErinnerungSteuerungDeps.vorkommenSperre`). Dieser Anschluss (`erinnerungsLaufAnschluss`)
// setzt nach einer AUSDRÜCKLICHEN Entscheidung nur den einen wartenden Lauf fort bzw. beendet ihn —
// bei „Serie“ die ganze Erinnerung über den vorhandenen, fassungsgebundenen Statusweg. Ein
// geschlossener Dialog meldet „pausiert“ und ändert nichts.
//
// KEINE DUBLETTE IN DER GEMEINSAMEN ANSICHT: Der eigene Kalender zeigt seine Einträge; aus dem
// verbundenen Kalender kommen nur Termine, die NICHT Klaras eigene Projektion sind
// (`istKlaraProjektion`: Vorgangsschlüssel `kk-…`). Derselbe Auftrag erscheint so genau einmal.

/** Die gemeinsame Kennung eines Eintrags des eigenen Kalenders in der Kalenderanbindung. */
export function kalenderIdentitaet(e: {
  readonly id: string;
  readonly auftrag: { readonly taskId: string } | null;
  readonly lauf: { readonly runId: string } | null;
}): { auftragId: string; ereignisId: string } {
  return { auftragId: e.auftrag?.taskId ?? e.id, ereignisId: e.lauf?.runId ?? e.id };
}

/** Ein Termin, den Klara selbst angelegt hat (Vorgangsschlüssel der Zuordnung, auch `-g<n>`). */
export function istKlaraProjektion(t: Pick<AnbieterTermin, "vorgang">): boolean {
  return typeof t.vorgang === "string" && t.vorgang.startsWith("kk-");
}

// ------------------------------------------------------------------------------------------------
// ENTSCHEIDUNG → TATSÄCHLICHER LAUF
// ------------------------------------------------------------------------------------------------

/**
 * Der Anschluss der Kalenderanbindung an die EINE Erinnerungssteuerung. `pausiert` schreibt nichts:
 * die Sperre steht schon in der Ablage und wird vor jeder Wirkung gelesen. `laeuft` (ausdrücklich
 * fortgeführt): genau der Lauf dieses Vorkommens, der wegen der Kalendersperre wartet, wird zu einem
 * neuen Versuch mit Readback (wie die Klärung „fortführen“) — kein anderer. `beendet`: Einzeltermin →
 * nur dieser wartende Lauf endet; Serie → die Erinnerung wird über ihren Statusweg beendet.
 */
export function erinnerungsLaufAnschluss(
  ablage: KlaraErinnerungAblage,
  dienst: Pick<KlaraErinnerungDienst, "status">,
  jetzt: () => number = Date.now,
): KalenderLaufSteuerung {
  return {
    async melde(kontoId, auftragId, ereignisId, stand, umfang = "einzeltermin") {
      if (stand === "pausiert") {
        return;
      }
      const gelesen = await ablage.laeufe.hole(ereignisId);
      const lauf =
        gelesen && gelesen.erinnerungId === auftragId && gelesen.kontoId === kontoId
          ? gelesen
          : null;
      if (stand === "laeuft") {
        if (lauf?.status === "unklar" && lauf.ergebnis.grund === "kalender_pausiert") {
          const { grund: _grund, ...rest } = lauf.ergebnis;
          await ablage.laeufe.setze(ereignisId, ["unklar"], "fehlgeschlagen", rest, 1, jetzt());
        }
        return;
      }
      if (umfang === "serie") {
        const e = await ablage.erinnerungen.hole(kontoId, auftragId);
        if (e && (e.erinnerung.status === "aktiv" || e.erinnerung.status === "pausiert")) {
          await dienst.status(kontoId, auftragId, {
            fassung: e.erinnerung.fassung,
            aktion: "beenden",
          });
        }
        return;
      }
      if (lauf && (lauf.status === "unklar" || lauf.status === "fehlgeschlagen")) {
        await ablage.laeufe.setze(
          ereignisId,
          ["unklar", "fehlgeschlagen"],
          "abgebrochen",
          { ...lauf.ergebnis, grund: "kalender_beendet" },
          null,
          jetzt(),
        );
      }
    },
  };
}

// ------------------------------------------------------------------------------------------------
// DER AUSFÜHRUNGSNACHWEIS DES EIGENEN KALENDERS (C06) ÜBER DIESELBE ERINNERUNGSSTEUERUNG
// ------------------------------------------------------------------------------------------------

const ABGESCHLOSSEN: readonly KlaraErinnerungLauf["status"][] = [
  "zugestellt",
  "teilweise",
  "verpasst_gemeldet",
  "zusammengefasst",
  "uebersprungen",
];

/** Der Stand eines Laufs, wie der eigene Kalender ihn kennt — nur aus dem tatsächlichen Lauf. */
function laufSicht(l: KlaraErinnerungLauf): {
  status: EigenerLaufStatus;
  ergebnis: EigenesErgebnis | null;
} {
  if (l.status === "laeuft") {
    return { status: "laeuft", ergebnis: null };
  }
  if (ABGESCHLOSSEN.includes(l.status)) {
    return {
      status: "abgeschlossen",
      ergebnis: l.ergebnis.zugestelltAm
        ? { art: "erinnerung_zugestellt", am: l.ergebnis.zugestelltAm }
        : { art: "lauf_abgeschlossen", am: l.aktualisiertAm },
    };
  }
  if (l.status === "fehlgeschlagen") {
    return {
      status: "fehlgeschlagen",
      ergebnis: { art: "lauf_fehlgeschlagen", am: l.aktualisiertAm },
    };
  }
  if (l.status === "unklar") {
    // Wartet auf eine Entscheidung (z. B. Kalendersperre) — es ist noch nichts geschehen.
    return { status: "geplant", ergebnis: null };
  }
  return {
    status: "abgebrochen",
    ergebnis: l.ergebnis.zugestelltAm
      ? { art: "erinnerung_zugestellt", am: l.ergebnis.zugestelltAm }
      : l.ergebnis.routine
        ? { art: "bericht_gespeichert", am: l.ergebnis.routine.erstelltAm }
        : null,
  };
}

/**
 * Der `AusfuehrungsNachweis` des eigenen Kalenders über DIESELBE Erinnerungsablage und denselben
 * Dienst: nur die eigenen Erinnerungen der lesenden Person (fremd und unbekannt = `null`), Lauf und
 * Ergebnis nur so, wie sie tatsächlich gespeichert sind. Absagen und Serie schalten gehen über die
 * vorhandenen, fassungsgebundenen Wege des Dienstes; aktiver Einzelabbruch sperrt genau den
 * gespeicherten Lauf gegen neue Wirkungen und erhält Serie sowie bereits vorhandene Ergebnisse.
 */
export function erinnerungsAusfuehrung(
  ablage: KlaraErinnerungAblage,
  dienst: Pick<KlaraErinnerungDienst, "eintrag" | "status" | "vorkommen" | "laufAbbrechen">,
): AusfuehrungsNachweis {
  const erinnerung = async (user: SessionUser, id: string) => {
    try {
      return await dienst.eintrag(user.id, id);
    } catch (fehler) {
      if (fehler instanceof KlaraErinnerungFehler && fehler.status === 404) return null;
      throw fehler;
    }
  };
  const schluesselVon = (taskId: string, runId: string): string | null =>
    runId.startsWith(`${taskId}@`) ? runId.slice(taskId.length + 1) : null;
  return {
    async auftrag(user, taskId) {
      const e = await erinnerung(user, taskId);
      return e ? { titel: e.erinnerung.titel } : null;
    },
    async lauf(user, taskId, runId) {
      const e = await erinnerung(user, taskId);
      const schluessel = schluesselVon(taskId, runId);
      if (!e || schluessel === null) {
        return null;
      }
      const l = await ablage.laeufe.hole(runId);
      if (l) {
        return l.erinnerungId === taskId ? laufSicht(l) : null;
      }
      const v = findeVorkommen(e.erinnerung, schluessel)?.vorkommen;
      if (!v || v.id !== runId) {
        return null;
      }
      if (v.ausnahme?.art === "abgesagt") {
        return { status: "abgesagt", ergebnis: null };
      }
      return v.ausnahme?.art === "erledigt"
        ? { status: "abgeschlossen", ergebnis: null }
        : { status: "geplant", ergebnis: null };
    },
    async serie(user, seriesId) {
      const e = await erinnerung(user, seriesId);
      if (!e || e.erinnerung.zeitplan.art !== "serie") {
        return null;
      }
      return { pausiert: e.erinnerung.status === "pausiert" };
    },
    async laufAbsagen(user, taskId, runId) {
      const e = await erinnerung(user, taskId);
      const schluessel = schluesselVon(taskId, runId);
      if (!e || schluessel === null) {
        return false;
      }
      try {
        await dienst.vorkommen(user.id, taskId, schluessel, {
          fassung: e.erinnerung.fassung,
          aktion: "absagen",
        });
        return true;
      } catch {
        return false;
      }
    },
    async arbeitAbbrechen(user, taskId, runId) {
      const e = await erinnerung(user, taskId);
      if (!e) return false;
      try {
        return await dienst.laufAbbrechen(user.id, taskId, runId, e.erinnerung.fassung);
      } catch {
        return false;
      }
    },
    async serieSchalten(user, seriesId, pausiert) {
      const e = await erinnerung(user, seriesId);
      if (!e) {
        return false;
      }
      try {
        await dienst.status(user.id, seriesId, {
          fassung: e.erinnerung.fassung,
          aktion: pausiert ? "pausieren" : "fortsetzen",
        });
        return true;
      } catch {
        return false;
      }
    },
  };
}

// ------------------------------------------------------------------------------------------------
// DER VORHANDENE KALENDER IN DER GEMEINSAMEN ANSICHT — OHNE KLARAS EIGENE PROJEKTIONEN
// ------------------------------------------------------------------------------------------------

/**
 * Der vorhandene Kalender für den eigenen Kalender (Sichtwahl „vorhanden“/„beide“): die Termine
 * ALLER eigenen Anbindungen im Zeitraum, ohne Klaras Projektionen — die stehen schon als eigener
 * Eintrag da. Antwortet keine Anbindung, gilt der Kalender als nicht verbunden; interne Einträge
 * und Läufe bleiben davon unberührt (AW17-K06).
 */
export function vorhandenerKalenderAus(
  kalender: Pick<KalenderAnbindungDienst, "anbindungen" | "lese">,
): VorhandenerKalender {
  return {
    async istVerbunden(user) {
      return (await kalender.anbindungen(user.id)).length > 0;
    },
    async lies(user, von, bis) {
      const termine: ExternerTermin[] = [];
      let gelesen = false;
      for (const a of await kalender.anbindungen(user.id)) {
        const r = await kalender.lese(user.id, a.id, von, bis);
        if (!r.ok) {
          continue;
        }
        gelesen = true;
        for (const t of r.termine) {
          if (!istKlaraProjektion(t)) {
            termine.push({
              id: t.id,
              titel: t.titel,
              ganztaegig: false,
              beginn: t.beginn,
              ende: t.ende || null,
            });
          }
        }
      }
      return gelesen ? { verbunden: true, termine } : { verbunden: false };
    },
  };
}

// ------------------------------------------------------------------------------------------------
// EIN EINTRAG DES EIGENEN KALENDERS ALS INTERNER TERMIN (S09)
// ------------------------------------------------------------------------------------------------

function ortszeit(iso: string, zone: string): string {
  const l = lokalVon(Date.parse(iso), zone);
  return `${l.datum}T${l.uhrzeit}`;
}

/**
 * Der interne Termin zu einem Eintrag des eigenen Kalenders — mit SEINER Auftrags- und
 * Ereigniskennung (`kalenderIdentitaet`), gelesen mit den heutigen Rechten der Person. Ein Eintrag
 * mit geschützter Quelle gibt keinen Text her (403); ohne Ende gibt es keinen Kalendertermin
 * (400) — eine Dauer wird nicht erfunden. Ganztägig: von 00:00 des ersten bis 00:00 nach dem
 * letzten Tag, in der Zeitzone des Eintrags.
 */
export function internerTerminAus(s: KalenderSicht): InternerTermin {
  if (s.geschuetzt || s.titel === null) {
    throw new KalenderAnbindungFehler(
      403,
      "recht_fehlt",
      "Die Quelle dieses Eintrags ist dir nicht mehr freigegeben; er wird nicht eingetragen.",
    );
  }
  const auftrag = s.auftrag ? { taskId: s.auftrag.taskId } : null;
  const lauf = s.lauf ? { runId: s.lauf.runId } : null;
  const { auftragId, ereignisId } = kalenderIdentitaet({ id: s.id, auftrag, lauf });
  let beginn: string;
  let ende: string;
  if (s.ganztaegig) {
    beginn = `${s.beginn}T00:00`;
    ende = `${plusTage(s.ende ?? s.beginn, 1)}T00:00`;
  } else {
    if (s.ende === null) {
      throw new KalenderAnbindungFehler(
        400,
        "eingabe",
        "Dieser Eintrag hat kein Ende. Bitte im eigenen Kalender ein Ende setzen, dann eintragen.",
      );
    }
    beginn = ortszeit(s.beginn, s.zeitzone);
    ende = ortszeit(s.ende, s.zeitzone);
  }
  if (ende <= beginn) {
    throw new KalenderAnbindungFehler(400, "eingabe", "Das Ende liegt nicht nach dem Beginn.");
  }
  return {
    auftragId,
    ereignisId,
    fassung: s.fassung,
    privat: s.bereich === "persoenlich",
    serienart: s.serie ? "vorkommen" : "einzel",
    abgesagt: s.status === "abgesagt",
    inhalt: {
      titel: s.titel,
      beginn,
      ende,
      zeitzone: s.zeitzone,
      ort: "",
      beschreibung: s.notiz ?? "",
      teilnehmer: [],
    },
  };
}

/** Liest einen eigenen Eintrag mit heutigen Rechten; fremd und unbekannt antworten gleich (404). */
export function eigenerTerminAus(dienst: {
  hole(user: SessionUser, id: string): Promise<KalenderSicht>;
}): (user: SessionUser, eintragId: string) => Promise<InternerTermin> {
  return async (user, eintragId) => {
    let s: KalenderSicht;
    try {
      s = await dienst.hole(user, eintragId);
    } catch (fehler) {
      if (fehler instanceof KalenderFehler && fehler.status === 404) {
        throw new KalenderAnbindungFehler(404, "eingabe", "Kalendereintrag nicht gefunden.");
      }
      throw fehler;
    }
    return internerTerminAus(s);
  };
}
