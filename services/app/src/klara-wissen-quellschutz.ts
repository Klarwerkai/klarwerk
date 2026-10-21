import {
  type KlaraNotiz,
  type KlaraNotizFilter,
  type KlaraNotizRepo,
  type NotizSchreibbedingung,
  notizIstQuellengebunden,
} from "./klara-notiz";

/** Aktuelle Quellrechte vor jedem privaten Lese-/Kopierweg, auch für Aufgabe und Scheduler. */
export class QuellgeschuetzteKlaraNotizen implements KlaraNotizRepo {
  constructor(
    private readonly basis: KlaraNotizRepo,
    private readonly erlaubt: (n: KlaraNotiz) => Promise<boolean>,
  ) {}
  private async lesbar(n: KlaraNotiz | null) {
    if (!n) return null;
    const erlaubt = (!n.quelle && !notizIstQuellengebunden(n)) || (await this.erlaubt(n));
    return erlaubt ? n : null;
  }
  async hole(kontoId: string, id: string) {
    return this.lesbar(await this.basis.hole(kontoId, id));
  }
  async zuVorgang(kontoId: string, vorgang: string) {
    return this.lesbar(await this.basis.zuVorgang(kontoId, vorgang));
  }
  async liste(kontoId: string, filter: KlaraNotizFilter) {
    const ns = await this.basis.liste(kontoId, filter);
    const ok = await Promise.all(ns.map((n) => this.lesbar(n)));
    return ok.filter((n): n is KlaraNotiz => n !== null);
  }
  anzahl(kontoId: string) {
    return this.basis.anzahl(kontoId);
  }
  async lege(n: KlaraNotiz, b?: NotizSchreibbedingung) {
    return !!(await this.lesbar(n)) && this.basis.lege(n, b);
  }
  async ersetze(n: KlaraNotiz, b?: NotizSchreibbedingung) {
    return !!(await this.lesbar(n)) && this.basis.ersetze(n, b);
  }
  entferne(kontoId: string, id: string) {
    return this.basis.entferne(kontoId, id);
  }
}
