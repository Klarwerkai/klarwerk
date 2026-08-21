// ================================================================================================
// JOB 1495 · D4 · H3 — DERSELBE BEZUG, ZWEIMAL GESETZT, BLEIBT EINE BEZIEHUNG.
// ================================================================================================
//
// WAS HIER ENTSTEHT UND WARUM. `InMemoryKantenRepo` (kanten-service.ts) ist der Prüfstand des
// Lesewegs: `setze` legt ab, `fuerKo` liest. Es dedupliziert nicht — zwei Aufrufe mit derselben
// fachlichen Beziehung, aber verschiedenen Kennungen, ergeben dort zwei Einträge. Für den Prüfstand
// ist das richtig; für einen Bestand, aus dem das Wissensnetz gespeist wird, wäre es die Doppelung,
// gegen die D3 die Kanonisierung gebaut hat — nur eine Ebene höher.
//
// DIE DREI ZUSAGEN, die JOB 1139 D1 einmal hatte und deren Stand verloren ist (D2-Rückgabe §5:
// Clone gelöscht, keine der 28 Sicherungen trägt ihn). Sie stehen im BEN-Urteil zu jenem Durchgang
// beschrieben und werden hier ausführbar gemacht:
//
//   1. DEDUPLIZIERUNG über den Beziehungsschlüssel (kanten-paar.ts) — kanonisches Paar plus Art.
//   2. ERHALT DER ÄLTESTEN HERKUNFT — wer sie zuerst gesetzt hat und wann, bleibt stehen.
//   3. EIGENSTÄNDIGE IDENTITÄT — die Kennung der ersten Setzung gewinnt; sie ist nicht aus den
//      Endpunkten abgeleitet und darf durch eine Wiederholung nicht wandern.
//
// WAS HIER AUSDRÜCKLICH NICHT ENTSTEHT. Kein öffentlicher Kuratierungsweg: `setze` ist wie beim
// Prüfstand ein Bestandsweg, kein Recht. Die Autorisierung `ko.relate` ist Scheibe S4 und
// ausdrücklich getrennt (kanten-service.ts:36-39). Und kein Postgres — der Adapter braucht
// Migration und Modulexport, die beide außerhalb der Lease liegen (D3-Rückgabe §5). Dieser Bestand
// ist die Vorlage, die ein solcher Adapter zu übersetzen hätte, nicht sein Ersatz.
import { beziehungsSchluessel, istSelbstbeziehung, kanonischesPaar } from "./kanten-paar";
import type { KantenRepo } from "./kanten-service";
import type { KuratierteKante } from "./kanten-types";

/**
 * Ein Bestand, in dem eine fachliche Beziehung genau einmal vorkommt.
 *
 * Der Schlüssel ist `beziehungsSchluessel` — kanonisches Endpunktpaar, Art und Richtungsklasse,
 * ohne Status, Urheber und Zeit. Damit ist „A ergänzt B" dieselbe Beziehung wie „B ergänzt A",
 * aber eine andere als „A widerspricht B".
 */
export class DeduplizierenderKantenBestand implements KantenRepo {
  // Schlüssel → Kante. Die Kennung der Kante bleibt daneben erhalten; sie ist NICHT der Index,
  // sonst wäre dieselbe Beziehung unter zwei Kennungen wieder zwei Einträge.
  private readonly nachBeziehung = new Map<string, KuratierteKante>();

  /**
   * Legt die Beziehung ab oder schreibt die vorhandene fort.
   *
   * BEIM ERSTEN MAL: kanonisiert und übernommen, wie sie kommt.
   *
   * BEIM WIEDERHOLTEN SETZEN wird NICHT ersetzt, sondern fortgeschrieben:
   *   · `id`, `urheber`, `gesetztAm` bleiben die der ERSTEN Setzung (Zusage 2 und 3),
   *   · `geaendertAm` und `status` folgen der NEUEN Setzung,
   *   · `version` zählt hoch.
   *
   * Warum die alte Herkunft gewinnt: Sie ist eine Tatsache über die Vergangenheit. Wer eine
   * bestehende Beziehung erneut setzt, ändert nicht, wer sie erfunden hat — sonst könnte ein
   * zweiter Mensch die Urheberschaft eines ersten still übernehmen.
   */
  async setze(kante: KuratierteKante): Promise<void> {
    // JOB 1543 D1 (SCRUM-546): AM EINGANG abgewiesen, nicht still verschluckt. Ein stilles Ignorieren
    // hieße, dass ein Kurator seine Beziehung gesetzt glaubt, während der Bestand leer bleibt — und
    // die Kuratierung ist eine Urheberaussage, über deren Verbleib niemand raten soll.
    if (istSelbstbeziehung(kante)) {
      throw new Error(
        `Eine Beziehung braucht zwei Enden: ${kante.quelleId} kann nicht auf sich selbst zeigen.`,
      );
    }
    const kanonisch = kanonischesPaar(kante);
    const schluessel = beziehungsSchluessel(kanonisch);
    const vorhanden = this.nachBeziehung.get(schluessel);

    if (vorhanden === undefined) {
      this.nachBeziehung.set(schluessel, { ...kanonisch });
      return Promise.resolve();
    }

    this.nachBeziehung.set(schluessel, {
      ...kanonisch,
      id: vorhanden.id,
      urheber: vorhanden.urheber,
      gesetztAm: vorhanden.gesetztAm,
      version: vorhanden.version + 1,
    });
    return Promise.resolve();
  }

  /**
   * Alle Beziehungen, an denen `koId` beteiligt ist — ungetrimmt und OHNE Sichtbarkeitsurteil.
   *
   * Das Trimmen ist Sache des Lesedienstes (`KantenLeseService`), und zwar dort an genau einer
   * Stelle. Ein Bestand, der selbst filtert, wäre die zweite Rechteauslegung, gegen die das ganze
   * Modul gebaut ist.
   *
   * Widerrufene Beziehungen bleiben enthalten: `widerrufen` ist eine Urheberaussage, keine
   * Löschung (kanten-types.ts). Wer sie aus dem Bestand entfernte, könnte später nicht mehr
   * unterscheiden, ob jemand zurückgenommen hat oder ob es die Beziehung nie gab.
   */
  async fuerKo(koId: string): Promise<readonly KuratierteKante[]> {
    return Promise.resolve(
      [...this.nachBeziehung.values()].filter((k) => k.quelleId === koId || k.zielId === koId),
    );
  }

  /** Wie viele verschiedene Beziehungen der Bestand führt — für Prüfstände und Zähler. */
  async anzahl(): Promise<number> {
    return Promise.resolve(this.nachBeziehung.size);
  }
}
