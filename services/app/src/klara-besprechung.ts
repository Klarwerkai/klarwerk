import { createHash } from "node:crypto";
import type { MediaAnalysisService } from "../../media";
import { type ObjectStore, decodeDataUrl } from "../../object-store";
import { KlaraAufgabeDienst, type KlaraAufgabeRepo } from "./klara-aufgabe";
import { type KlaraNotiz, KlaraNotizDienst, type KlaraNotizRepo } from "./klara-notiz";
import { istDatum, istUhrzeit } from "./klara-erinnerung-zeit";
import { type KlaraWissensHerkunft, WissensFehler } from "./klara-wissensuebernahme";
import { webvttLesen } from "./meeting-dokumentbezug";
export interface BesprechungsSegment {
  id: string;
  text: string;
  startMs: number | null;
  endMs: number | null;
  sprecher: string | null;
  unsicher: boolean;
  ueberlappend: boolean;
}
export interface PrivateBesprechung {
  meetingId: string;
  transkriptFassung: number;
  meetingDatum: string | null;
  zeitzone: string | null;
  quelleNotizId: string | null;
  audioId: string | null;
  weg: "text" | "dateiimport" | "eigene_aufnahme";
  segmente: BesprechungsSegment[];
  asrEngine?: string;
}
export type ErgebnisArt =
  | "entscheidung"
  | "vorschlag"
  | "abgelehnt"
  | "widerspruch"
  | "offen"
  | "aufgabe"
  | "klaerung";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function obj(x: unknown): Record<string, unknown> {
  if (!x || typeof x !== "object" || Array.isArray(x))
    throw new WissensFehler(400, "Objekt erwartet.");
  return x as Record<string, unknown>;
}
function str(x: unknown, max = 20000): string {
  if (typeof x !== "string" || !x.trim() || x.length > max)
    throw new WissensFehler(400, "Gültiger Text fehlt.");
  return x;
}
function datum(x: unknown): string | null {
  if (x == null || x === "") return null;
  const s = str(x, 40);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(s) ||
    !istDatum(s.slice(0, 10)) ||
    !istUhrzeit(s.slice(11, 16)) ||
    !Number.isFinite(Date.parse(s))
  )
    throw new WissensFehler(400, "Meetingzeit mit tatsächlichem Offset erwartet.");
  return s;
}
export function besprechungsErgebnisse(b: PrivateBesprechung) {
  return b.segmente.map((s) => {
    const m =
      /^\s*(Beschluss|Entscheidung|Vorschlag|Abgelehnt|Verworfen|Widerspruch|Offen|Frage|Aufgabe):\s*(.+)$/is.exec(
        s.text,
      );
    const arten: Record<string, ErgebnisArt> = {
      beschluss: "entscheidung",
      entscheidung: "entscheidung",
      vorschlag: "vorschlag",
      abgelehnt: "abgelehnt",
      verworfen: "abgelehnt",
      widerspruch: "widerspruch",
      offen: "offen",
      frage: "offen",
      aufgabe: "aufgabe",
    };
    const art =
      m &&
      !s.unsicher &&
      !s.ueberlappend &&
      !(
        m[2]?.includes("?") &&
        ["beschluss", "entscheidung", "aufgabe"].includes((m[1] ?? "").toLowerCase())
      )
        ? (arten[(m[1] ?? "").toLowerCase()] ?? "klaerung")
        : "klaerung";
    return {
      id: s.id,
      art,
      text: s.text,
      quelle: {
        segmentId: s.id,
        transkriptFassung: b.transkriptFassung,
        startMs: s.startMs,
        endMs: s.endMs,
        zeile: b.segmente.indexOf(s) + 1,
      },
      zustaendigkeit: "klaerung" as const,
      unsicher: s.unsicher,
      ueberlappend: s.ueberlappend,
    };
  });
}
export class KlaraBesprechungsDienst {
  constructor(
    private readonly notizen: KlaraNotizRepo,
    private readonly rohNotizen: KlaraNotizRepo,
    private readonly aufgaben: KlaraAufgabeRepo,
    private readonly objects: ObjectStore,
    private readonly media: MediaAnalysisService,
    private readonly keineKi: () => boolean,
  ) {}
  async importiere(kontoId: string, roh: unknown) {
    const x = obj(roh);
    if (x.berechtigt !== true)
      throw new WissensFehler(400, "Berechtigung für diesen gewählten Import bestätigen.");
    let meetingId =
      x.meetingId == null
        ? `import-${hash(JSON.stringify({ text: x.vtt ?? x.text, datum: x.meetingDatum ?? null, zone: x.zeitzone ?? null }))}`
        : str(x.meetingId, 200);
    const titel = str(x.titel, 200);
    const meetingDatum = datum(x.meetingDatum);
    const zeitzone = x.zeitzone == null || x.zeitzone === "" ? null : str(x.zeitzone, 100);
    if (zeitzone) {
      try {
        new Intl.DateTimeFormat("de", { timeZone: zeitzone });
      } catch {
        throw new WissensFehler(400, "Zeitzone unbekannt.");
      }
    }
    const vtt = typeof x.vtt === "string" ? str(x.vtt) : null;
    const audioId = x.audioId == null ? null : str(x.audioId, 200);
    let asr: Awaited<ReturnType<MediaAnalysisService["analyze"]>> | null = null;
    if (audioId) {
      const a = await this.objects.metadata(audioId);
      if (
        !a ||
        a.lifecycle?.owner !== kontoId ||
        a.lifecycle.purpose !== "klara_audio" ||
        !a.mime.startsWith("audio/")
      )
        throw new WissensFehler(404, "Private Audioquelle nicht gefunden.");
      const roh = await this.objects.read(audioId);
      const bytes = roh ? decodeDataUrl(roh.data)?.bytes : undefined;
      if (!bytes) throw new WissensFehler(400, "Audioquelle nicht dekodierbar.");
      if (x.meetingId == null)
        meetingId = `audio-${hash(bytes.toString("base64") + String(meetingDatum) + String(zeitzone))}`;
      if (!vtt && !x.vorherigeNotiz) {
        const vorher = (
          await this.notizen.liste(kontoId, { woerter: [], art: null, limit: 2000 })
        ).find(
          (n) =>
            n.wissensHerkunft?.besprechung?.meetingId === meetingId &&
            !n.wissensHerkunft.besprechung.quelleNotizId,
        );
        if (vorher) {
          const r = await this.sicht(kontoId, vorher.id);
          return {
            ...r,
            wiederholt: true,
            verarbeitung: {
              stand: "bereits_importiert",
              modellaufrufe: 0,
              asr: "bereits_gespeichert",
            },
          };
        }
      }
      if (!vtt) {
        if (x.transkription !== true)
          throw new WissensFehler(409, "Verarbeitungsauftrag für die Audio-Transkription fehlt.");
        if (this.keineKi())
          throw new WissensFehler(403, "Keine KI: Transkription ist abgeschaltet.");
        asr = await this.media.analyze(audioId, "de", undefined, true);
        if (!asr.zeittranskript)
          throw new WissensFehler(
            409,
            "Zeitgebundene Transkription nicht verfügbar oder nicht freigegeben. VTT-Fassung bereitstellen; keine Zeitstellen erfinden.",
          );
        const aktuell = await this.objects.metadata(audioId);
        if (!aktuell || aktuell.lifecycle?.owner !== kontoId)
          throw new WissensFehler(404, "Audioquelle inzwischen entzogen.");
      }
    }
    let segmente: BesprechungsSegment[];
    if (asr?.zeittranskript) {
      segmente = asr.zeittranskript.segmente.map((s) => ({
        ...s,
        sprecher: null,
        unsicher: /unverständlich|rauschen|\[lücke\]/i.test(s.text),
        ueberlappend: false,
      }));
      for (const s of segmente)
        s.ueberlappend = segmente.some(
          (t) =>
            t.id !== s.id && (t.startMs ?? 0) < (s.endMs ?? 0) && (s.startMs ?? 0) < (t.endMs ?? 0),
        );
    } else if (vtt) {
      try {
        segmente = webvttLesen(vtt).map((s) => ({
          ...s,
          unsicher: /unverständlich|rauschen|\[lücke\]|\[unsicher\]/i.test(s.text),
          ueberlappend: false,
        }));
      } catch {
        throw new WissensFehler(400, "Ungültige VTT-Fassung.");
      }
      if (
        segmente.some(
          (s) =>
            !Number.isFinite(s.startMs) ||
            !Number.isFinite(s.endMs) ||
            (s.startMs ?? -1) < 0 ||
            (s.endMs ?? 0) <= (s.startMs ?? 0),
        )
      )
        throw new WissensFehler(400, "Ungültige Zeitstellen.");
      for (const s of segmente)
        s.ueberlappend = segmente.some(
          (t) =>
            t.id !== s.id && (t.startMs ?? 0) < (s.endMs ?? 0) && (s.startMs ?? 0) < (t.endMs ?? 0),
        );
    } else {
      segmente = str(x.text)
        .split(/\r?\n/)
        .filter((s) => s.trim())
        .map((text, i) => ({
          id: `zeile-${i + 1}`,
          text,
          startMs: null,
          endMs: null,
          sprecher: null,
          unsicher: /unverständlich|rauschen|\[lücke\]/i.test(text),
          ueberlappend: false,
        }));
    }
    if (
      !segmente.length ||
      segmente.length > 300 ||
      new Set(segmente.map((s) => s.id)).size !== segmente.length
    )
      throw new WissensFehler(400, "Keine eindeutigen Segmente (maximal 300).");
    const vorher =
      x.vorherigeNotiz == null ? null : await this.hole(kontoId, str(x.vorherigeNotiz, 200));
    if (vorher && vorher.wissensHerkunft?.besprechung?.meetingId !== meetingId)
      throw new WissensFehler(409, "Korrektur gehört zu einer anderen Besprechung.");
    const fassung = vorher ? (vorher.wissensHerkunft?.besprechung?.transkriptFassung ?? 0) + 1 : 1;
    const b: PrivateBesprechung = {
      meetingId,
      transkriptFassung: fassung,
      meetingDatum,
      zeitzone,
      quelleNotizId: null,
      audioId,
      weg: audioId
        ? x.weg === "eigene_aufnahme"
          ? "eigene_aufnahme"
          : "dateiimport"
        : vtt
          ? "dateiimport"
          : "text",
      segmente,
      ...(asr?.engine ? { asrEngine: asr.engine } : {}),
    };
    return this.speichere(kontoId, titel, b, vorher?.id ?? null, asr ? 1 : 0);
  }
  private async speichere(
    kontoId: string,
    titel: string,
    b: PrivateBesprechung,
    vorherigeNotiz: string | null,
    modellaufrufe = 0,
  ) {
    const inhalt = b.segmente
      .map(
        (s) =>
          `[${s.id}${s.startMs === null ? "" : ` · ${s.startMs}–${s.endMs} ms`}${s.sprecher ? ` · ${s.sprecher} (Importangabe)` : ""}] ${s.text}`,
      )
      .join("\n");
    if (inhalt.length > 20000) throw new WissensFehler(400, "Transkriptfassung zu groß.");
    const h: KlaraWissensHerkunft = {
      projekt: titel,
      abschnitt: b.meetingId,
      antwortFassung: String(b.transkriptFassung),
      anbieter: null,
      modell: null,
      vorherigeNotiz,
      textAbdruck: hash(inhalt),
      aussagen: [],
      besprechung: b,
    };
    const r = await new KlaraNotizDienst({ repo: this.notizen }).lege(
      kontoId,
      {
        vorgang: `meeting-${hash(JSON.stringify({ meetingId: b.meetingId, fassung: b.transkriptFassung, datum: b.meetingDatum, zone: b.zeitzone, inhalt }))}`,
        weg: "geschrieben",
        titel,
        inhalt,
        offeneFragen: [],
        objektbezug: { pfad: "/start", seitenName: "Private Besprechung", objekt: titel },
      },
      undefined,
      h,
    );
    return {
      notiz: r.notiz,
      wiederholt: r.wiederholt,
      verarbeitung: {
        stand: "importiert",
        segmente: b.segmente.length,
        modellaufrufe,
        asr: modellaufrufe ? "zeitgebunden_abgeschlossen" : "nicht_ausgefuehrt",
      },
      ergebnisse: besprechungsErgebnisse(b),
      fristenNormen: {
        stand: "quellenauswahl_erforderlich",
        grund:
          "Gewählte Originalpassagen können über die bestehende persönliche Fristenregel berücksichtigt werden. Relative Termine und Normphasen bleiben Klärung.",
      },
    };
  }
  async hole(
    kontoId: string,
    id: string,
  ): Promise<
    KlaraNotiz & { wissensHerkunft: KlaraWissensHerkunft & { besprechung: PrivateBesprechung } }
  > {
    const n = await this.notizen.hole(kontoId, id);
    if (!n?.wissensHerkunft?.besprechung)
      throw new WissensFehler(404, "Besprechung nicht gefunden.");
    return n as KlaraNotiz & {
      wissensHerkunft: KlaraWissensHerkunft & { besprechung: PrivateBesprechung };
    };
  }
  async sicht(kontoId: string, id: string) {
    const n = await this.hole(kontoId, id);
    return {
      notiz: n,
      ergebnisse: besprechungsErgebnisse(n.wissensHerkunft.besprechung),
      fristenNormen: { stand: "quellenauswahl_erforderlich" },
    };
  }
  async korrektur(kontoId: string, id: string, roh: unknown) {
    const x = obj(roh);
    const n = await this.hole(kontoId, id);
    if (n.fassung !== x.fassung) throw new WissensFehler(409, "Transkript inzwischen geändert.");
    const b = n.wissensHerkunft.besprechung;
    const segment = b.segmente.find((s) => s.id === x.segmentId);
    if (!segment) throw new WissensFehler(404, "Segment nicht gefunden.");
    const neu = str(x.text);
    if (neu === segment.text) return this.sicht(kontoId, id);
    return this.speichere(
      kontoId,
      n.titel,
      {
        ...b,
        transkriptFassung: b.transkriptFassung + 1,
        segmente: b.segmente.map((s) =>
          s.id === segment.id
            ? {
                ...s,
                text: neu,
                unsicher: /unverständlich|rauschen|\[lücke\]|\[unsicher\]/i.test(neu),
              }
            : s,
        ),
      },
      n.id,
    );
  }
  async uebernehmen(kontoId: string, id: string, roh: unknown) {
    const x = obj(roh);
    const n = await this.hole(kontoId, id);
    if (
      x.bewusst !== true ||
      x.fassung !== n.fassung ||
      !Array.isArray(x.auswahl) ||
      x.auswahl.length > 50
    )
      throw new WissensFehler(409, "Bewusste Auswahl und aktuelle Fassung erforderlich.");
    const b = n.wissensHerkunft.besprechung;
    const alle = besprechungsErgebnisse(b);
    const auswahl = [...new Set(x.auswahl.map((v) => str(v, 200)))].map((id) => {
      const a = alle.find((a) => a.id === id);
      if (!a) throw new WissensFehler(400, "Auswahl nicht in dieser Fassung.");
      return a;
    });
    if (!auswahl.length) throw new WissensFehler(400, "Ergebnis auswählen.");
    if (auswahl.some((a) => a.art === "aufgabe") && x.eigeneAufgaben !== true)
      throw new WissensFehler(
        409,
        "Zuständigkeit ungeklärt. Gewählte Folgeaufgabe bewusst selbst übernehmen.",
      );
    const aufgaben = [];
    const dienst = new KlaraAufgabeDienst({ repo: this.aufgaben, notizen: this.notizen });
    for (const a of auswahl.filter((a) => a.art === "aufgabe")) {
      const vorgang = `meeting-task-${hash(`${b.meetingId}:${a.id}`)}`;
      const alt = await this.aufgaben.zuVorgang(kontoId, vorgang);
      const inhalt = `${a.text}\nQuelle: /start?notiz=${id} · Transkriptfassung ${b.transkriptFassung} · Segment ${a.id} · ${a.quelle.startMs === null ? `Zeile ${a.quelle.zeile}` : `${a.quelle.startMs}–${a.quelle.endMs} ms`}\nPersönlich bewusst übernommen; Zuständigkeit im Meeting nicht automatisch belegt.`;
      if (alt) {
        aufgaben.push({ id: alt.id, wiederholt: true, abweichung: alt.inhalt !== inhalt });
        continue;
      }
      const r = await dienst.lege(
        kontoId,
        { vorgang, weg: "notiz", quelle: { notizId: id }, titel: a.text.slice(0, 200), inhalt },
        true,
      );
      aufgaben.push({ id: r.aufgabe.id, wiederholt: r.wiederholt, abweichung: false });
    }
    const abweichung = aufgaben.some((a) => a.abweichung);
    const text =
      auswahl
        .map(
          (a) =>
            `${a.art}: ${a.text}\nQuelle: Transkriptfassung ${b.transkriptFassung}, Segment ${a.id}, ${a.quelle.startMs === null ? `Zeile ${a.quelle.zeile}` : `${a.quelle.startMs}–${a.quelle.endMs} ms`}`,
        )
        .join("\n\n") +
      (abweichung
        ? "\n\nVorhandene Aufgaben weichen von dieser Transkriptfassung ab. In Meine Aufgaben prüfen; vorhandener Inhalt wurde erhalten."
        : "");
    const h: KlaraWissensHerkunft = {
      ...n.wissensHerkunft,
      textAbdruck: hash(text),
      vorherigeNotiz: id,
      besprechung: { ...b, quelleNotizId: id },
    };
    const z = await new KlaraNotizDienst({ repo: this.notizen }).lege(
      kontoId,
      {
        vorgang: `meeting-summary-${hash(
          `${b.meetingId}:${b.transkriptFassung}:${hash(text)}:${auswahl
            .map((a) => a.id)
            .sort()
            .join()}`,
        )}`,
        weg: "geschrieben",
        titel: `Übergabe: ${n.titel}`.slice(0, 200),
        inhalt: text,
        offeneFragen: auswahl
          .filter((a) => ["offen", "widerspruch", "klaerung"].includes(a.art))
          .map((a) => a.text.slice(0, 500)),
        objektbezug: {
          pfad: `/start?notiz=${id}`,
          seitenName: "Private Besprechung",
          objekt: n.titel,
        },
      },
      undefined,
      h,
    );
    return {
      notizId: z.notiz.id,
      aufgaben,
      privat: true,
      gemeinsam: "Erst über die bewusste Wissensübernahme an der privaten Übergabenotiz.",
      fristenNormen: "separate_bewusste_quellenauswahl",
    };
  }
  /** Ausgewählter Originalwortlaut als eigene Quelle für den unveränderten AW19-Leser.
   * Keine generierte Zusammenfassung und keine fingierte Gesprächsnachricht. */
  async fristquelle(kontoId: string, id: string, roh: unknown) {
    const x = obj(roh);
    const n = await this.hole(kontoId, id);
    const b = n.wissensHerkunft.besprechung;
    if (
      x.bewusst !== true ||
      x.fassung !== n.fassung ||
      !Array.isArray(x.auswahl) ||
      !x.auswahl.length ||
      x.auswahl.length > 50
    )
      throw new WissensFehler(409, "Bewusste Quellenauswahl und aktuelle Fassung erforderlich.");
    const ids = new Set(x.auswahl.map((v) => str(v, 200)));
    const segmente = b.segmente.filter((s) => ids.has(s.id));
    if (segmente.length !== ids.size || b.quelleNotizId)
      throw new WissensFehler(400, "Originalsegmente dieser Quellfassung auswählen.");
    if (segmente.some((s) => s.unsicher || s.ueberlappend))
      throw new WissensFehler(409, "Unsichere oder überlappende Originalpassagen zuerst klären.");
    const inhalt = segmente.map((s) => s.text).join("\n");
    const h: KlaraWissensHerkunft = {
      ...n.wissensHerkunft,
      textAbdruck: hash(inhalt),
      vorherigeNotiz: id,
      besprechung: { ...b, quelleNotizId: id, segmente },
    };
    const r = await new KlaraNotizDienst({ repo: this.notizen }).lege(
      kontoId,
      {
        vorgang: `meeting-fristquelle-${hash(`${id}:${b.transkriptFassung}:${segmente.map((s) => s.id).join()}`)}`,
        weg: "geschrieben",
        titel: `Fristquelle: ${n.titel}`.slice(0, 200),
        inhalt,
        offeneFragen: [],
        objektbezug: {
          pfad: `/start?notiz=${id}`,
          seitenName: "Private Besprechung",
          objekt: n.titel,
        },
      },
      undefined,
      h,
    );
    return { notizId: r.notiz.id, fassung: r.notiz.fassung, wiederholt: r.wiederholt };
  }
  async loesche(kontoId: string, id: string) {
    const n = await this.rohNotizen.hole(kontoId, id);
    const b = n?.wissensHerkunft?.besprechung;
    if (!b) return this.notizen.entferne(kontoId, id);
    if (b.quelleNotizId) return this.notizen.entferne(kontoId, id);
    const ns = (
      await this.rohNotizen.liste(kontoId, { woerter: [], art: null, limit: 2000 })
    ).filter((n) => n.wissensHerkunft?.besprechung?.meetingId === b.meetingId);
    const ids = new Set(ns.map((n) => n.id));
    for (const a of await this.aufgaben.liste(kontoId, null, 2000)) {
      if (a.privatNotizGebunden && a.bezug.art === "notiz" && ids.has(a.bezug.notizId))
        await this.aufgaben.entferne(kontoId, a.id);
    }
    for (const note of ns) await this.rohNotizen.entferne(kontoId, note.id);
    for (const audio of new Set(
      ns.map((n) => n.wissensHerkunft?.besprechung?.audioId).filter((s): s is string => !!s),
    ))
      await this.objects.delete(audio);
    return true;
  }
}
