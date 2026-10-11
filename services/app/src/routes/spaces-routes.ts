// ================================================================================================
// SPACES — PFLEGE, INHALTE JE SPACE UND ANSICHT, RECHTEVORSCHAU UND SPACEWECHSEL (`spaces.ts`).
// ================================================================================================
//
// RECHTE NACH DER BESTEHENDEN KONTOREGEL PLUS DEM SPACE SELBST:
//   · Anlegen: `ko.validate` (controller, admin) — wer über den Beitrag anderer urteilt, darf auch
//     einen Arbeitsraum für andere eröffnen. Die Zuständigkeit kann dabei an jedes Konto gehen.
//   · Bearbeiten: die Spacezuständigen oder die Kontoverwaltung (`users.manage`).
//   · Inhalte lesen: ausschliesslich über `darfSehen` (`../sichtbarkeit`) — dieselbe Regel wie
//     Detailabruf, Liste, Suche und Klara. Diese Datei filtert nie mit einer eigenen Auslegung.
//   · Verschieben: Schreibrecht im Quell- und im Zielspace (ohne Quellspace: Autor, Verantwortliche
//     oder `ko.validate`) — und nur mit der Grundlage einer Rechtevorschau, die noch stimmt.
//   · Löschen (aufnahme:20260922:gesamt-wissensprojekte): wer bearbeiten darf, nach einer
//     Löschvorschau und nur, wenn KEIN Artikel (auch keiner im Papierkorb) den Space noch als
//     führenden Space trägt. Sonst bliebe an ihm eine Kennung ohne Space, und `darfSehen` verbärge
//     ihn fail-closed vor allen — ein stiller Verlust. Die Artikel gehen vorher über den
//     gewöhnlichen Spacewechsel mit Rechtevorschau hinaus; das Löschen selbst bewegt keinen.
//
// EIN UNSICHTBARER SPACE ODER ARTIKEL IST 404, NICHT 403: eine Absage, die seine Existenz bestätigt,
// wäre schon eine Auskunft.
import { createHash, randomUUID } from "node:crypto";
import type { FastifyBaseLogger, FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import type { AuthService, PublicUser } from "../../../auth";
import {
  type KnowledgeObject,
  type KoService,
  responsibleKindOf,
  responsibleOf,
} from "../../../knowledge-object";
import { can } from "../../../rbac";
import { type Guards, type SessionUser, sendError } from "../http";
import { darfSehen, sichtbareFuer, sqlSichtbarkeitFuer } from "../sichtbarkeit";
import {
  type Konto,
  archivFolgen,
  bestandsPlan,
  pruefeBestandsRegeln,
  zugriffsuebersicht,
} from "../space-verwaltung";
import {
  SPACE_KONTEXTE,
  type SpaceEingabe,
  type SpaceFassung,
  SpaceFehler,
  type SpaceKontext,
  type SpacesRepo,
  darfInSpaceSchreiben,
  darfSpaceBearbeiten,
  darfSpaceInhalteLesen,
  darfSpaceSehen,
  eigenesSpaceRecht,
  istArchiviert,
  istGeloescht,
  kontextVon,
  lesbareSpaces,
  pruefeBegruendung,
  pruefeSpaceEingabe,
  vorgangVon,
} from "../spaces";
import type { TeamFassung, TeamsRepo } from "../teams";

export interface SpacesRouteDienste {
  spaces: SpacesRepo;
  ko: KoService;
  auth: AuthService;
  audit?: AuditService;
  /**
   * produkt:20261009:admin-teams — die Teams, die ein Space als Mitgliedschaftsweg binden kann.
   * Fehlt die Ablage, lässt sich kein Team neu binden; bestehende Bindungen bleiben stehen.
   */
  teams?: TeamsRepo;
  /** Uhr für `geaendertAm` — in Tests stellbar. */
  jetzt?: () => Date;
  /**
   * R-0571: die Prüfzuständigkeit aus dem Unternehmensverzeichnis. Nur gesetzt, wenn eine Zuordnung
   * Gruppe → Space konfiguriert ist (`KLARWERK_PRUEFZUSTAENDIGKEIT`). `abgleichen` gleicht die aus
   * dem Verzeichnis abgeleiteten Zuweisungen des Objekts mit seinem (neuen) Space ab und liefert
   * die jetzt Zuständigen — `undefined`, wenn das Objekt nicht (mehr) zu prüfen ist.
   */
  pruefzustaendigkeit?: {
    abgleichen: (koId: string, akteur: string) => Promise<string[] | undefined>;
  };
  /**
   * ADMIN-09: kommt ein Objekt in einen Space mit Freigaberegel, gilt deren Mindestzahl an
   * Zustimmungen für seinen laufenden Vorgang sofort (`FreigabeRegelDienst.anwenden`). Scheitert es,
   * holt die nächste Entscheidung es serverseitig nach.
   */
  freigaberegelAnwenden?: (koId: string, akteur: string) => Promise<void>;
}

/** Eine Zeile in einer Space- oder Ansichtsliste: dasselbe Objekt, keine Kopie. */
interface ArtikelZeile {
  id: string;
  version: number;
  title: string;
  statement: string;
  status: string;
  tags: string[];
  spaceId: string | null;
  spaceName: string | null;
  /** Firmenkontext des führenden Space; ohne Space `firma` (eigene Firmeninstanz). */
  kontext: SpaceKontext;
  partner: string | null;
}

function nichtGefunden(reply: FastifyReply, was: "Space" | "Wissensobjekt"): void {
  reply.code(404).send({ error: "NOT_FOUND", message: `${was} nicht gefunden.` });
}

/** `undefined` = kein Filter, sonst ein gültiger Kontext oder `UNGUELTIG`. */
function kontextAus(roh: string | undefined): SpaceKontext | "UNGUELTIG" | undefined {
  if (roh === undefined || roh === "") {
    return undefined;
  }
  return SPACE_KONTEXTE.includes(roh as SpaceKontext) ? (roh as SpaceKontext) : "UNGUELTIG";
}

function kontextFehler(reply: FastifyReply): void {
  reply.code(400).send({
    error: "KONTEXT_UNGUELTIG",
    message: "Erwartet wird kontext=firma, partner oder oeffentlich.",
  });
}

function fehler(reply: FastifyReply, e: unknown): void {
  if (e instanceof SpaceFehler) {
    reply.code(400).send({ error: e.code, message: e.message });
    return;
  }
  sendError(reply, e);
}

function archiviertAbsage(reply: FastifyReply): void {
  reply.code(409).send({
    error: "SPACE_ARCHIVIERT",
    message: "Dieser Space ist archiviert. Erst wiederaufnehmen, dann ändern.",
  });
}

function veraltet(reply: FastifyReply, aktuelleVersion: number): void {
  reply.code(409).send({
    error: "VERSION_VERALTET",
    message: "Der Space wurde inzwischen geändert. Bitte neu laden.",
    aktuelleVersion,
  });
}

export function spacesRoutes(dienste: SpacesRouteDienste, guards: Guards): FastifyPluginAsync {
  const jetzt = dienste.jetzt ?? (() => new Date());

  async function konten(): Promise<PublicUser[]> {
    return (await dienste.auth.listUsers()).filter((u) => u.approved);
  }

  async function namen(): Promise<Map<string, string>> {
    return new Map((await konten()).map((u) => [u.id, u.name]));
  }

  async function kontoListe(): Promise<Konto[]> {
    return (await konten()).map((u) => ({ id: u.id, name: u.name, role: u.role }));
  }

  /** Die jüngste Fassung — `undefined`, wenn es den Space nicht gibt oder er gelöscht ist. */
  async function aktuellerSpace(id: string): Promise<SpaceFassung | undefined> {
    const fassungen = await dienste.spaces.fassungen(id);
    const letzte = fassungen[fassungen.length - 1];
    return istGeloescht(letzte) ? undefined : letzte;
  }

  async function alleTeams(): Promise<TeamFassung[]> {
    return dienste.teams ? dienste.teams.aktuelle() : [];
  }

  /** Neu bindbar sind aktive Teams; eine schon bestehende Bindung bleibt auch archiviert stehen. */
  async function bindbareTeams(bisher?: SpaceFassung): Promise<Set<string>> {
    const teams = await alleTeams();
    return new Set([
      ...teams.filter((t) => !t.archiviert).map((t) => t.id),
      ...(bisher?.teams ?? []).map((b) => b.team),
    ]);
  }

  function spaceSicht(
    space: SpaceFassung,
    user: SessionUser,
    n: Map<string, string>,
    teams: readonly TeamFassung[] = [],
  ) {
    const team = (id: string) => teams.find((t) => t.id === id);
    return {
      ...space,
      kontext: kontextVon(space),
      partner: space.partner ?? null,
      verantwortlichName: n.get(space.verantwortlich) ?? null,
      mitglieder: space.mitglieder.map((m) => ({ ...m, name: n.get(m.nutzer) ?? null })),
      // produkt:20261009:admin-teams: die Teambindungen und — getrennt von den direkten
      // Mitgliedern — wer über welches Team dabei ist.
      teams: (space.teams ?? []).map((b) => ({
        ...b,
        name: team(b.team)?.name ?? null,
        archiviert: team(b.team)?.archiviert ?? false,
      })),
      teamMitglieder: (space.teamMitglieder ?? []).map((m) => ({
        ...m,
        name: n.get(m.nutzer) ?? null,
        teamName: team(m.team)?.name ?? null,
      })),
      eigenesRecht: eigenesSpaceRecht(space, user),
      darfBearbeiten: darfSpaceBearbeiten(space, user),
      darfInhalteLesen: darfSpaceInhalteLesen(space, user.id),
      // ADMIN-07: Status und Mitgliederzahl (direkt UND über Teams, je Person einmal) für die
      // Verwaltungsübersicht.
      archiviert: istArchiviert(space),
      vorgang: vorgangVon(space),
      mitgliederZahl: new Set([
        ...space.mitglieder.map((m) => m.nutzer),
        ...(space.teamMitglieder ?? []).map((m) => m.nutzer),
      ]).size,
    };
  }

  async function sichtbareArtikel(user: SessionUser): Promise<KnowledgeObject[]> {
    return sichtbareFuer(user, await dienste.ko.listForSearch({}, sqlSichtbarkeitFuer(user)));
  }

  function zeile(ko: KnowledgeObject, spaces: readonly SpaceFassung[]): ArtikelZeile {
    const spaceId = typeof ko.spaceId === "string" ? ko.spaceId : null;
    const space = spaceId ? spaces.find((s) => s.id === spaceId) : undefined;
    return {
      kontext: space ? kontextVon(space) : "firma",
      partner: space?.partner ?? null,
      id: ko.id,
      version: ko.version,
      title: ko.title,
      statement: ko.statement,
      status: ko.status,
      tags: ko.tags,
      spaceId,
      spaceName: spaceId ? (spaces.find((s) => s.id === spaceId)?.name ?? null) : null,
    };
  }

  /** Die Sicht eines BELIEBIGEN Kontos — so, wie `makeGuards` sie für dessen Anfrage bilden würde. */
  function sitzungVon(u: PublicUser, spaces: readonly SpaceFassung[]): SessionUser {
    return { id: u.id, role: u.role, spaceLesbar: lesbareSpaces(spaces, u.id) };
  }

  /** Wer darf diesen Artikel aus seinem jetzigen Space heraus (oder ohne Space) bewegen? */
  function darfVerschiebenAus(
    ko: KnowledgeObject,
    quelle: SpaceFassung | undefined,
    user: SessionUser,
  ): boolean {
    if (quelle) {
      return darfInSpaceSchreiben(quelle, user);
    }
    return ko.author === user.id || responsibleOf(ko) === user.id || can(user.role, "ko.validate");
  }

  interface Vorschau {
    koId: string;
    version: number;
    quelle: { id: string; name: string; version: number } | null;
    ziel: { id: string; name: string; version: number } | null;
    verlieren: { id: string; name: string; role: string }[];
    erhalten: { id: string; name: string; role: string }[];
    unveraendertMitZugang: number;
    autorBehaeltZugang: boolean;
    verantwortlicheBehaeltZugang: boolean;
    bleibt: {
      version: number;
      author: string;
      authorName: string | null;
      originalAuthor: string;
      historyEintraege: number;
      artikelVerantwortung: string;
      artikelVerantwortungName: string | null;
    };
    /**
     * ADMIN-07 (K4): die REGELN vorher und nachher — Zugang, Spaceregeln in Worten und
     * Zuständigkeit. Die Rechtewirkung allein sagt nicht, nach welchen Regeln der Artikel danach
     * gepflegt wird.
     */
    regeln: { quelle: RegelSicht | null; ziel: RegelSicht | null };
    darfAusfuehren: boolean;
    grund: string | null;
    /**
     * Nacharbeit 3 (Ben, K4): bindet die Bestätigung an die WIRKSAME Rechtelage — wer den Artikel
     * vorher und nachher sieht, Quell-/Zielstand, Regeln und das eigene Ausführungsrecht. Teams
     * lösen ihre Mitglieder beim Lesen auf (`teams.ts`); eine Teamänderung ändert keine
     * Spacefassung, wohl aber diese Grundlage.
     */
    grundlage: string;
  }

  interface RegelSicht {
    zugang: SpaceFassung["zugang"];
    regeln: string | null;
    verantwortlich: string;
    verantwortlichName: string | null;
  }

  function regelSicht(s: SpaceFassung | undefined, alle: readonly PublicUser[]): RegelSicht | null {
    return s
      ? {
          zugang: s.zugang,
          regeln: s.regeln ?? null,
          verantwortlich: s.verantwortlich,
          verantwortlichName: alle.find((u) => u.id === s.verantwortlich)?.name ?? null,
        }
      : null;
  }

  async function vorschau(
    ko: KnowledgeObject,
    zielId: string | null,
    user: SessionUser,
  ): Promise<Vorschau | "ZIEL_UNBEKANNT"> {
    const spaces = await dienste.spaces.aktuelle();
    const quelleId = typeof ko.spaceId === "string" ? ko.spaceId : null;
    const quelle = quelleId ? spaces.find((s) => s.id === quelleId) : undefined;
    const ziel = zielId ? spaces.find((s) => s.id === zielId) : undefined;
    if (zielId && (!ziel || !darfSpaceSehen(ziel, user))) {
      return "ZIEL_UNBEKANNT";
    }
    const nachher: KnowledgeObject = zielId
      ? { ...ko, spaceId: zielId }
      : (({ spaceId: _alt, ...ohne }) => ohne)(ko);
    const verlieren: Vorschau["verlieren"] = [];
    const erhalten: Vorschau["erhalten"] = [];
    let unveraendert = 0;
    const alle = await konten();
    const leserVor: string[] = [];
    const leserNach: string[] = [];
    for (const u of alle) {
      const sicht = sitzungVon(u, spaces);
      const vor = darfSehen(sicht, ko);
      const nach = darfSehen(sicht, nachher);
      if (vor) {
        leserVor.push(u.id);
      }
      if (nach) {
        leserNach.push(u.id);
      }
      if (vor && !nach) {
        verlieren.push({ id: u.id, name: u.name, role: u.role });
      } else if (!vor && nach) {
        erhalten.push({ id: u.id, name: u.name, role: u.role });
      } else if (vor && nach) {
        unveraendert += 1;
      }
    }
    const behaelt = (id: string): boolean => {
      const u = alle.find((k) => k.id === id);
      return u ? darfSehen(sitzungVon(u, spaces), nachher) : false;
    };
    let grund: string | null = null;
    if (quelleId === zielId) {
      grund = "Der Artikel liegt bereits in diesem Space.";
    } else if (quelleId && !quelle) {
      grund = "Der bisherige Space ist nicht mehr vorhanden.";
    } else if (quelle && istArchiviert(quelle)) {
      grund = "Der bisherige Space ist archiviert; erst wiederaufnehmen, dann verschieben.";
    } else if (ziel && istArchiviert(ziel)) {
      grund = "Der Zielspace ist archiviert und nimmt keine Inhalte auf.";
    } else if (!darfVerschiebenAus(ko, quelle, user)) {
      grund = "Für den bisherigen Space fehlt das Schreibrecht.";
    } else if (ziel && !darfInSpaceSchreiben(ziel, user)) {
      grund = "Für den Zielspace fehlt das Schreibrecht.";
    }
    const regeln = { quelle: regelSicht(quelle, alle), ziel: regelSicht(ziel, alle) };
    const grundlage = createHash("sha256")
      .update(
        JSON.stringify({
          ko: [ko.id, ko.version, responsibleOf(ko)],
          quelle: quelle ? [quelle.id, quelle.version] : null,
          ziel: ziel ? [ziel.id, ziel.version] : null,
          leserVor: [...leserVor].sort(),
          leserNach: [...leserNach].sort(),
          regeln,
          grund,
        }),
      )
      .digest("hex")
      .slice(0, 32);
    return {
      koId: ko.id,
      version: ko.version,
      quelle: quelle ? { id: quelle.id, name: quelle.name, version: quelle.version } : null,
      ziel: ziel ? { id: ziel.id, name: ziel.name, version: ziel.version } : null,
      verlieren,
      erhalten,
      unveraendertMitZugang: unveraendert,
      autorBehaeltZugang: behaelt(ko.author),
      verantwortlicheBehaeltZugang: behaelt(responsibleOf(ko)),
      bleibt: {
        version: ko.version,
        author: ko.author,
        authorName: alle.find((u) => u.id === ko.author)?.name ?? null,
        originalAuthor: ko.originalAuthor,
        historyEintraege: ko.history.length,
        artikelVerantwortung: responsibleOf(ko),
        artikelVerantwortungName: alle.find((u) => u.id === responsibleOf(ko))?.name ?? null,
      },
      regeln,
      darfAusfuehren: grund === null,
      grund,
      grundlage,
    };
  }

  async function sichtbaresKo(
    user: SessionUser,
    koId: unknown,
  ): Promise<KnowledgeObject | undefined> {
    if (typeof koId !== "string" || koId.length === 0) {
      return undefined;
    }
    const ko = await dienste.ko.get(koId);
    return ko && darfSehen(user, ko) ? ko : undefined;
  }

  function zielAus(body: unknown): string | null | undefined {
    const z = (body as { zielSpaceId?: unknown } | null)?.zielSpaceId;
    if (z === null) {
      return null;
    }
    return typeof z === "string" && z.length > 0 ? z : undefined;
  }

  interface Loeschvorschau {
    space: { id: string; name: string; version: number };
    /** Artikel mit diesem führenden Space, die der Betrachter sieht — mit Titel, zum Verschieben. */
    artikel: { id: string; title: string; version: number }[];
    /** Weitere Artikel mit diesem führenden Space, die der Betrachter nicht sieht — nur die Zahl. */
    weitereVerborgen: number;
    /** Artikel im Papierkorb mit diesem führenden Space — nur die Zahl. */
    imPapierkorb: number;
    /** Was mit dem Space verschwindet: seine gespeicherten Ansichten und Mitgliedschaften. */
    ansichten: number;
    mitglieder: number;
    darfLoeschen: boolean;
    grund: "SPACE_NICHT_LEER" | null;
  }

  /**
   * Die Folgen einer Löschung — für die Vorschau UND unmittelbar vor dem Schreiben. Gezählt wird
   * über den GESAMTEN Bestand samt Papierkorb, denn auch ein verborgener oder gelöschter Artikel
   * verlöre seinen Space. Titel bekommt nur, wer den Artikel sehen darf.
   */
  async function loeschLage(space: SpaceFassung, user: SessionUser): Promise<Loeschvorschau> {
    const fuehrend = (await dienste.ko.listEinschliesslichPapierkorb()).filter(
      (k) => k.spaceId === space.id,
    );
    const aktiv = fuehrend.filter((k) => !k.deletedAt);
    const sichtbar = aktiv.filter((k) => darfSehen(user, k));
    const leer = fuehrend.length === 0;
    return {
      space: { id: space.id, name: space.name, version: space.version },
      artikel: sichtbar
        .map((k) => ({ id: k.id, title: k.title, version: k.version }))
        .sort((a, b) => a.title.localeCompare(b.title)),
      weitereVerborgen: aktiv.length - sichtbar.length,
      imPapierkorb: fuehrend.length - aktiv.length,
      ansichten: space.ansichten.length,
      mitglieder: space.mitglieder.length,
      darfLoeschen: leer,
      grund: leer ? null : "SPACE_NICHT_LEER",
    };
  }

  /** Space für Löschvorschau und Löschung: 404 wie überall, 403 ohne Bearbeitungsrecht. */
  async function loeschbarerSpace(
    id: string,
    user: SessionUser,
    reply: FastifyReply,
  ): Promise<SpaceFassung | undefined> {
    const aktuell = await aktuellerSpace(id);
    if (!aktuell || !darfSpaceSehen(aktuell, user)) {
      nichtGefunden(reply, "Space");
      return undefined;
    }
    if (!darfSpaceBearbeiten(aktuell, user)) {
      reply.code(403).send({
        error: "FORBIDDEN",
        message: "Nur die Spacezuständigen oder die Kontoverwaltung löschen diesen Space.",
      });
      return undefined;
    }
    return aktuell;
  }

  /**
   * Die Löschung — nur unter `dienste.spaces.exklusiv` aufzurufen. Prüfung (Recht, Version, kein
   * führender Artikel) und Löschvermerk liegen in derselben Sperre wie jeder Spacewechsel; ein
   * Wechsel in diesen Space kann also weder zwischen Prüfung und Vermerk geschehen noch danach (der
   * Space fehlt dann in `aktuelle()`).
   */
  async function fuehreLoeschungAus(
    id: string,
    gesehen: unknown,
    user: SessionUser,
    reply: FastifyReply,
  ): Promise<void> {
    const aktuell = await loeschbarerSpace(id, user, reply);
    if (!aktuell) {
      return;
    }
    if (typeof gesehen !== "number") {
      reply.code(400).send({
        error: "VERSION_FEHLT",
        message: "Die zuletzt gesehene Version des Space fehlt.",
      });
      return;
    }
    const lage = await loeschLage(aktuell, user);
    if (gesehen !== aktuell.version) {
      reply.code(409).send({
        error: "VERSION_VERALTET",
        message: "Der Space wurde inzwischen geändert. Bitte die neue Vorschau prüfen.",
        vorschau: lage,
      });
      return;
    }
    if (!lage.darfLoeschen) {
      reply.code(409).send({
        error: "SPACE_NICHT_LEER",
        message: "Der Space ist noch führender Space von Artikeln. Bitte sie zuerst verschieben.",
        vorschau: lage,
      });
      return;
    }
    const am = jetzt().toISOString();
    const vermerk: SpaceFassung = {
      ...aktuell,
      version: aktuell.version + 1,
      geaendertVon: user.id,
      geaendertAm: am,
      geloeschtAm: am,
    };
    // Ein paralleler Bearbeiter (PUT, ausserhalb der Sperre) kann dieselbe Version belegt haben.
    if (!(await dienste.spaces.lege(vermerk))) {
      reply.code(409).send({
        error: "VERSION_VERALTET",
        message: "Der Space wurde inzwischen geändert. Bitte neu laden.",
      });
      return;
    }
    await dienste.audit?.record({
      actor: user.id,
      action: "space.geloescht",
      target: aktuell.id,
      payload: {
        vorherVersion: aktuell.version,
        version: vermerk.version,
        ansichten: aktuell.ansichten.length,
        mitglieder: aktuell.mitglieder.length,
      },
    });
    reply.code(200).send({ id: aktuell.id, version: vermerk.version, geloescht: true });
  }

  /** Der Spacewechsel — nur unter `dienste.spaces.exklusiv` aufzurufen. */
  async function fuehreWechselAus(
    rumpf: unknown,
    user: SessionUser,
    reply: FastifyReply,
    log: FastifyBaseLogger,
  ): Promise<void> {
    const body = (rumpf ?? {}) as {
      koId?: unknown;
      basis?: {
        quelleId?: unknown;
        quelleVersion?: unknown;
        zielId?: unknown;
        zielVersion?: unknown;
        grundlage?: unknown;
      };
    };
    const ko = await sichtbaresKo(user, body.koId);
    if (!ko) {
      nichtGefunden(reply, "Wissensobjekt");
      return;
    }
    const ziel = zielAus(rumpf);
    if (ziel === undefined) {
      reply.code(400).send({
        error: "ZIEL_FEHLT",
        message: "Erwartet wird zielSpaceId (Kennung oder null für „ohne Space“).",
      });
      return;
    }
    if (!body.basis || typeof body.basis !== "object") {
      reply.code(400).send({
        error: "VORSCHAU_FEHLT",
        message: "Ein Spacewechsel braucht die Grundlage der bestätigten Rechtevorschau.",
      });
      return;
    }
    const v = await vorschau(ko, ziel, user);
    if (v === "ZIEL_UNBEKANNT") {
      nichtGefunden(reply, "Space");
      return;
    }
    const basis = body.basis;
    // Nacharbeit 3 (Ben, K4): die Vorschau ist an ihr ZIEL gebunden, nicht nur an Versionen. Zwei
    // Spaces können dieselbe Versionsnummer tragen; ohne die Kennung ginge ein Wechsel nach B mit
    // der Rechtewirkung von A durch. Fehlt `zielId` in der Grundlage, gilt sie als nicht passend.
    const stimmt =
      "zielId" in basis &&
      (basis.zielId ?? null) === (v.ziel?.id ?? null) &&
      (basis.quelleId ?? null) === (v.quelle?.id ?? null) &&
      (basis.quelleVersion ?? null) === (v.quelle?.version ?? null) &&
      (basis.zielVersion ?? null) === (v.ziel?.version ?? null) &&
      // ADMIN-07 Nacharbeit 3 (Ben, K4): und an die wirksame Rechtelage. Wer zwischen Vorschau und
      // Bestätigung über ein Team hinzukam oder ging, ändert die Grundlage — dann 409 mit der
      // neuen Vorschau statt eines Wechsels mit unangezeigten Berechtigten.
      basis.grundlage === v.grundlage;
    if (!stimmt) {
      reply.code(409).send({
        error: "VORSCHAU_VERALTET",
        message:
          "Die Rechtelage hat sich seit der Vorschau geändert. Bitte die neue Vorschau prüfen.",
        vorschau: v,
      });
      return;
    }
    if (!v.darfAusfuehren) {
      reply.code(403).send({ error: "FORBIDDEN", message: v.grund ?? "Nicht erlaubt." });
      return;
    }
    try {
      const nachher = await dienste.ko.setLeadingSpace(ko.id, ziel, user.id, v.quelle?.id ?? null);
      // R-0571: wer laut Unternehmensverzeichnis für die Prüfung im NEUEN Space zuständig ist,
      // wird Prüfende(r) dieses Objekts — ohne Handpflege; die offenen Verzeichnis-Zuweisungen aus
      // dem alten Space werden zurückgezogen (Hand-Zuweisungen und erledigte Prüfungen bleiben).
      // Nicht die Autorin, und nicht für ein bereits validiertes Objekt (ein Umzug ist kein neuer
      // Prüfanlass). Scheitert der Abgleich, bleibt der Wechsel bestehen und die Antwort sagt es.
      const zustaendigkeit = dienste.pruefzustaendigkeit;
      let pruefzuweisung: string[] | "fehlgeschlagen" = [];
      if (zustaendigkeit) {
        try {
          pruefzuweisung = (await zustaendigkeit.abgleichen(nachher.id, user.id)) ?? [];
        } catch (fehlerWert) {
          log.warn(
            { err: fehlerWert, event: "pruefzustaendigkeit" },
            "Prüfzuständige aus dem Verzeichnis konnten nicht zugewiesen werden",
          );
          pruefzuweisung = "fehlgeschlagen";
        }
      }
      await dienste.freigaberegelAnwenden?.(nachher.id, user.id).catch((fehlerWert) => {
        log.warn(
          { err: fehlerWert, event: "freigaberegel" },
          "Freigaberegel des Zielspace konnte nicht sofort angewendet werden",
        );
      });
      reply.code(200).send({
        koId: nachher.id,
        version: nachher.version,
        author: nachher.author,
        historyEintraege: nachher.history.length,
        spaceId: typeof nachher.spaceId === "string" ? nachher.spaceId : null,
        vorschau: v,
        ...(zustaendigkeit ? { pruefzuweisung } : {}),
      });
    } catch (e) {
      if ((e as { code?: unknown }).code === "SPACE_STAND_VERALTET") {
        reply.code(409).send({
          error: "VORSCHAU_VERALTET",
          message: "Der Space dieses Artikels hat sich inzwischen geändert.",
        });
        return;
      }
      sendError(reply, e);
    }
  }

  return async (app) => {
    // Die Spaces, die dieser Mensch sehen darf — mit seinem Recht und der Zahl SEINER sichtbaren
    // Artikel darin (keine Gesamtzahl: die wäre eine Auskunft über Unsichtbares).
    // `?kontext=firma|partner|oeffentlich` grenzt auf einen Firmenkontext ein (Firmenfilter).
    app.get<{ Querystring: { kontext?: string } }>("/api/spaces", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const kontext = kontextAus(request.query.kontext);
      if (kontext === "UNGUELTIG") {
        kontextFehler(reply);
        return;
      }
      const spaces = await dienste.spaces.aktuelle();
      const artikel = await sichtbareArtikel(user);
      const n = await namen();
      const teams = await alleTeams();
      const sichtbar = spaces
        .filter((s) => darfSpaceSehen(s, user))
        .filter((s) => kontext === undefined || kontextVon(s) === kontext)
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
        .map((s) => ({
          ...spaceSicht(s, user, n, teams),
          artikelSichtbar: artikel.filter((k) => k.spaceId === s.id).length,
        }));
      reply.code(200).send({
        spaces: sichtbar,
        darfAnlegen: can(user.role, "ko.validate"),
        // ADMIN-07: die Bestandszuordnung ist der Kontoverwaltung vorbehalten (Server prüft erneut).
        darfBestandZuordnen: can(user.role, "users.manage"),
      });
    });

    // Der Firmenfilter über Artikel: alle für den Betrachter sichtbaren Artikel eines Kontexts —
    // `firma` (eigene Firmeninstanz, auch ohne Space), `partner` (optional `&partner=` für genau
    // einen Partner) oder `oeffentlich`. Die Berechtigung prüft `darfSehen` je Zeile: Inhalte eines
    // Partnerbereichs erscheinen nur für ausdrücklich berechtigte Konten. Die Liste der Partner nennt
    // nur Bereiche, die der Betrachter selbst sehen darf.
    app.get<{ Querystring: { kontext?: string; partner?: string } }>(
      "/api/spaces/artikel",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const kontext = kontextAus(request.query.kontext);
        if (kontext === undefined || kontext === "UNGUELTIG") {
          kontextFehler(reply);
          return;
        }
        const partner = request.query.partner?.trim() || null;
        const spaces = await dienste.spaces.aktuelle();
        const zeilen = (await sichtbareArtikel(user))
          .map((k) => zeile(k, spaces))
          .filter((z) => z.kontext === kontext && (!partner || z.partner === partner))
          .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
        const partnerBereiche = [
          ...new Set(
            spaces
              .filter((s) => kontextVon(s) === "partner" && darfSpaceSehen(s, user))
              .map((s) => s.partner ?? ""),
          ),
        ]
          .filter((p) => p.length > 0)
          .sort((a, b) => a.localeCompare(b));
        reply.code(200).send({ kontext, partner, artikel: zeilen, partnerBereiche });
      },
    );

    // Die Konten, die als Zuständige oder Mitglieder wählbar sind — Kennung, Name, Rolle; keine
    // Mailadressen.
    app.get("/api/spaces/konten", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send({
        konten: (await konten())
          .map((u) => ({ id: u.id, name: u.name, role: u.role }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      });
    });

    // produkt:20261009:admin-teams: die Teams, die als Mitgliedschaftsweg wählbar sind — aktiv,
    // mit Name, Zweck und Mitgliederzahl; keine Mitgliedernamen (die pflegt die Kontoverwaltung).
    app.get("/api/spaces/teams", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send({
        teams: (await alleTeams())
          .filter((t) => !t.archiviert)
          .map((t) => ({ id: t.id, name: t.name, zweck: t.zweck, mitglieder: t.mitglieder.length }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      });
    });

    app.get<{ Params: { id: string } }>("/api/spaces/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const fassungen = await dienste.spaces.fassungen(request.params.id);
      const aktuell = fassungen[fassungen.length - 1];
      if (!aktuell || istGeloescht(aktuell) || !darfSpaceSehen(aktuell, user)) {
        nichtGefunden(reply, "Space");
        return;
      }
      const n = await namen();
      reply.code(200).send({
        space: spaceSicht(aktuell, user, n, await alleTeams()),
        fassungen: fassungen.map((f) => ({
          version: f.version,
          geaendertVon: f.geaendertVon,
          geaendertVonName: n.get(f.geaendertVon) ?? null,
          geaendertAm: f.geaendertAm,
          // ADMIN-07: Archivieren und Wiederaufnehmen stehen mit Begründung im Verlauf.
          vorgang: vorgangVon(f),
          begruendung: f.begruendung ?? null,
        })),
      });
    });

    // Anlegen — Version 1.
    app.post<{ Body: unknown }>("/api/spaces", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      let eingabe: SpaceEingabe;
      try {
        eingabe = pruefeSpaceEingabe(
          request.body,
          new Set((await konten()).map((u) => u.id)),
          await bindbareTeams(),
        );
      } catch (e) {
        fehler(reply, e);
        return;
      }
      const am = jetzt().toISOString();
      const fassung: SpaceFassung = {
        ...eingabe,
        id: randomUUID(),
        version: 1,
        angelegtVon: user.id,
        angelegtAm: am,
        geaendertVon: user.id,
        geaendertAm: am,
        archiviert: false,
        vorgang: "angelegt",
      };
      await dienste.spaces.lege(fassung);
      await dienste.audit?.record({
        actor: user.id,
        action: "space.angelegt",
        target: fassung.id,
        payload: {
          version: 1,
          verantwortlich: fassung.verantwortlich,
          zugang: fassung.zugang,
          mitglieder: fassung.mitglieder.length,
          teams: (fassung.teams ?? []).map((b) => b.team),
        },
      });
      const angelegt = (await dienste.spaces.fassungen(fassung.id)).at(-1) ?? fassung;
      reply.code(201).send(spaceSicht(angelegt, user, await namen(), await alleTeams()));
    });

    // Bearbeiten — eine NEUE Fassung. `version` nennt die Fassung, die der Bearbeiter gesehen hat.
    app.put<{ Params: { id: string }; Body: unknown }>(
      "/api/spaces/:id",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const aktuell = await aktuellerSpace(request.params.id);
        if (!aktuell || !darfSpaceSehen(aktuell, user)) {
          nichtGefunden(reply, "Space");
          return;
        }
        if (!darfSpaceBearbeiten(aktuell, user)) {
          reply.code(403).send({
            error: "FORBIDDEN",
            message: "Nur die Spacezuständigen oder die Kontoverwaltung ändern diesen Space.",
          });
          return;
        }
        if (istArchiviert(aktuell)) {
          archiviertAbsage(reply);
          return;
        }
        const gesehen = (request.body as { version?: unknown } | null)?.version;
        if (typeof gesehen !== "number") {
          reply.code(400).send({
            error: "VERSION_FEHLT",
            message: "Die zuletzt gesehene Version des Space fehlt.",
          });
          return;
        }
        let eingabe: SpaceEingabe;
        try {
          eingabe = pruefeSpaceEingabe(
            request.body,
            new Set((await konten()).map((u) => u.id)),
            await bindbareTeams(aktuell),
          );
        } catch (e) {
          fehler(reply, e);
          return;
        }
        const fassung: SpaceFassung = {
          ...eingabe,
          id: aktuell.id,
          version: gesehen + 1,
          angelegtVon: aktuell.angelegtVon,
          angelegtAm: aktuell.angelegtAm,
          geaendertVon: user.id,
          geaendertAm: jetzt().toISOString(),
          archiviert: false,
          vorgang: "geaendert",
          // ADMIN-09: die Freigaberegel hat ihren eigenen Pflegeweg mit Wirkungsvorschau
          // (`freigaberegeln-routes.ts`); die Spacepflege reicht sie unverändert weiter.
          ...(aktuell.freigabe ? { freigabe: aktuell.freigabe } : {}),
        };
        const gelegt = gesehen === aktuell.version && (await dienste.spaces.lege(fassung));
        if (!gelegt) {
          reply.code(409).send({
            error: "VERSION_VERALTET",
            message: "Der Space wurde inzwischen geändert. Bitte neu laden.",
            aktuelleVersion: aktuell.version,
          });
          return;
        }
        await dienste.audit?.record({
          actor: user.id,
          action: "space.geaendert",
          target: fassung.id,
          payload: {
            vorherVersion: aktuell.version,
            version: fassung.version,
            verantwortlich: fassung.verantwortlich,
            vorherVerantwortlich: aktuell.verantwortlich,
            zugang: fassung.zugang,
            mitglieder: fassung.mitglieder.length,
            teams: (fassung.teams ?? []).map((b) => b.team),
            vorherTeams: (aktuell.teams ?? []).map((b) => b.team),
            regelnGeaendert: (fassung.regeln ?? "") !== (aktuell.regeln ?? ""),
          },
        });
        const gelesen = (await dienste.spaces.fassungen(fassung.id)).at(-1) ?? fassung;
        reply.code(200).send(spaceSicht(gelesen, user, await namen(), await alleTeams()));
      },
    );

    // Die Folgen einer Löschung — schreibt nichts.
    app.post<{ Params: { id: string } }>(
      "/api/spaces/:id/loeschung/vorschau",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const space = await loeschbarerSpace(request.params.id, user, reply);
        if (!space) {
          return;
        }
        reply.code(200).send(await loeschLage(space, user));
      },
    );

    // Die Löschung selbst — eine weitere Fassung mit Löschvermerk. `version` nennt die Fassung, deren
    // Vorschau bestätigt wurde. Trägt noch ein Artikel den Space, wird nichts geschrieben.
    app.post<{ Params: { id: string }; Body: unknown }>(
      "/api/spaces/:id/loeschung",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const gesehen = (request.body as { version?: unknown } | null)?.version;
        // Prüfen und Schreiben unter derselben Sperre wie jeder Spacewechsel (`exklusiv`).
        await dienste.spaces.exklusiv(() =>
          fuehreLoeschungAus(request.params.id, gesehen, user, reply),
        );
      },
    );

    // Die Artikel eines Space — ohne `ansicht` die, deren FÜHRENDER Space er ist; mit `ansicht` die
    // gespeicherte Ansicht (Tag) über alle Spaces. In beiden Fällen nur, was `darfSehen` erlaubt,
    // und immer dasselbe Objekt: Kennung und Fassung wie `GET /api/kos/:id`.
    app.get<{ Params: { id: string }; Querystring: { ansicht?: string } }>(
      "/api/spaces/:id/artikel",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const spaces = await dienste.spaces.aktuelle();
        const space = spaces.find((s) => s.id === request.params.id);
        if (!space || !darfSpaceSehen(space, user)) {
          nichtGefunden(reply, "Space");
          return;
        }
        const artikel = await sichtbareArtikel(user);
        const ansichtId = request.query.ansicht;
        if (ansichtId) {
          const ansicht = space.ansichten.find((a) => a.id === ansichtId);
          if (!ansicht) {
            reply.code(404).send({ error: "NOT_FOUND", message: "Ansicht nicht gefunden." });
            return;
          }
          const tag = ansicht.tag.toLocaleLowerCase();
          reply.code(200).send({
            space: { id: space.id, name: space.name },
            ansicht,
            artikel: artikel
              .filter((k) => k.tags.some((t) => t.toLocaleLowerCase() === tag))
              .map((k) => zeile(k, spaces)),
          });
          return;
        }
        reply.code(200).send({
          space: { id: space.id, name: space.name },
          ansicht: null,
          artikel: artikel.filter((k) => k.spaceId === space.id).map((k) => zeile(k, spaces)),
        });
      },
    );

    // Der Spacekontext eines Artikels: führender Space, Spacezuständigkeit und — getrennt davon —
    // die Artikelverantwortung. Dieselbe Auskunft liest Klara. Unsichtbarer Artikel → 404.
    app.get<{ Params: { koId: string } }>(
      "/api/spaces/kontext/artikel/:koId",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const ko = await sichtbaresKo(user, request.params.koId);
        if (!ko) {
          nichtGefunden(reply, "Wissensobjekt");
          return;
        }
        const spaces = await dienste.spaces.aktuelle();
        const n = await namen();
        const spaceId = typeof ko.spaceId === "string" ? ko.spaceId : null;
        const space = spaceId ? spaces.find((s) => s.id === spaceId) : undefined;
        const verantwortlich = responsibleOf(ko);
        reply.code(200).send({
          koId: ko.id,
          version: ko.version,
          title: ko.title,
          tags: ko.tags,
          space: space
            ? {
                id: space.id,
                name: space.name,
                zweck: space.zweck,
                zugang: space.zugang,
                verantwortlich: space.verantwortlich,
                verantwortlichName: n.get(space.verantwortlich) ?? null,
                eigenesRecht: eigenesSpaceRecht(space, user),
              }
            : null,
          artikelVerantwortung: {
            person: verantwortlich,
            name: n.get(verantwortlich) ?? null,
            art: responsibleKindOf(ko),
          },
          autor: { person: ko.author, name: n.get(ko.author) ?? null },
          darfVerschieben: darfVerschiebenAus(ko, space, user),
          ziele: spaces
            .filter((s) => s.id !== spaceId && darfInSpaceSchreiben(s, user))
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((s) => ({ id: s.id, name: s.name, zugang: s.zugang })),
        });
      },
    );

    // Die Rechtevorschau eines Spacewechsels. Schreibt nichts.
    app.post<{ Body: unknown }>("/api/spaces/verschiebung/vorschau", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const ko = await sichtbaresKo(user, (request.body as { koId?: unknown } | null)?.koId);
      if (!ko) {
        nichtGefunden(reply, "Wissensobjekt");
        return;
      }
      const ziel = zielAus(request.body);
      if (ziel === undefined) {
        reply.code(400).send({
          error: "ZIEL_FEHLT",
          message: "Erwartet wird zielSpaceId (Kennung oder null für „ohne Space“).",
        });
        return;
      }
      const v = await vorschau(ko, ziel, user);
      if (v === "ZIEL_UNBEKANNT") {
        nichtGefunden(reply, "Space");
        return;
      }
      reply.code(200).send(v);
    });

    // Der Spacewechsel selbst — nur mit der Grundlage der gezeigten Vorschau. Hat sich der Quell-
    // oder Zielspace seitdem geändert (Mitglieder, Zugang, Zuordnung), wird nichts geschrieben und
    // die neue Vorschau zurückgegeben: die Rechtewirkung muss VOR der Übernahme stimmen.
    app.post<{ Body: unknown }>("/api/spaces/verschiebung", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      // aufnahme:20260922:gesamt-wissensprojekte (Nacharbeit 4, Bens Befund): Artikel lesen,
      // Vorschau prüfen und schreiben unter derselben Sperre wie jede Spacelöschung. Quelle und Ziel
      // können so zwischen Prüfung und Schreiben nicht gelöscht werden — und eine Rücknahme, die
      // ungeprüft in einen inzwischen gelöschten Quellspace zurückschriebe, gibt es nicht mehr.
      await dienste.spaces.exklusiv(() => fuehreWechselAus(request.body, user, reply, request.log));
    });

    // ==============================================================================================
    // ADMIN-07 · produkt:20261007:spaces:admin-20261009 — Zugriffsherkunft, Archiv, Bestand.
    // ==============================================================================================

    // K2 · Wer hat Zugriff, über welchen Weg (zuständig, direkt, je Team), mit welcher Wirkung. Wer den
    // Space nicht sehen darf, erfährt nichts (404) — dieselbe Grenze wie `GET /api/spaces/:id`.
    app.get<{ Params: { id: string } }>("/api/spaces/:id/zugriff", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const space = await aktuellerSpace(request.params.id);
      if (!space || !darfSpaceSehen(space, user)) {
        nichtGefunden(reply, "Space");
        return;
      }
      const teams = await alleTeams();
      reply
        .code(200)
        .send(
          zugriffsuebersicht(
            space,
            await kontoListe(),
            (id) => teams.find((t) => t.id === id)?.name,
          ),
        );
    });

    async function folgenFuer(space: SpaceFassung, user: SessionUser) {
      return archivFolgen(
        space,
        await dienste.ko.list({}),
        await kontoListe(),
        (ko) => darfSehen(user, ko),
        darfSpaceBearbeiten(space, user),
      );
    }

    // K5 · Was das Archivieren bewirkt: Lesen bleibt, Schreiben entfällt, offene Aufgaben und
    // Verantwortungsfragen. Schreibt nichts.
    app.post<{ Params: { id: string } }>(
      "/api/spaces/:id/archivierung/vorschau",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const space = await aktuellerSpace(request.params.id);
        if (!space || !darfSpaceSehen(space, user)) {
          nichtGefunden(reply, "Space");
          return;
        }
        if (!darfSpaceBearbeiten(space, user)) {
          reply.code(403).send({
            error: "FORBIDDEN",
            message: "Nur die Spacezuständigen oder die Kontoverwaltung archivieren diesen Space.",
          });
          return;
        }
        reply.code(200).send(await folgenFuer(space, user));
      },
    );

    // Archivieren — eine neue Fassung, nur mit Begründung und der Grundlage der gezeigten Folgen.
    // Offene Verantwortungsfragen verhindern es (409); der Space bleibt in Liste und Verlauf stehen.
    app.post<{ Params: { id: string }; Body: unknown }>(
      "/api/spaces/:id/archivieren",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const aktuell = await aktuellerSpace(request.params.id);
        if (!aktuell || !darfSpaceSehen(aktuell, user)) {
          nichtGefunden(reply, "Space");
          return;
        }
        if (!darfSpaceBearbeiten(aktuell, user)) {
          reply.code(403).send({
            error: "FORBIDDEN",
            message: "Nur die Spacezuständigen oder die Kontoverwaltung archivieren diesen Space.",
          });
          return;
        }
        if (istArchiviert(aktuell)) {
          archiviertAbsage(reply);
          return;
        }
        const body = (request.body ?? {}) as {
          version?: unknown;
          grundlage?: unknown;
          begruendung?: unknown;
        };
        if (body.version !== aktuell.version) {
          veraltet(reply, aktuell.version);
          return;
        }
        let begruendung: string;
        try {
          begruendung = pruefeBegruendung(body.begruendung);
        } catch (e) {
          fehler(reply, e);
          return;
        }
        const folgen = await folgenFuer(aktuell, user);
        if (typeof body.grundlage !== "string") {
          reply.code(400).send({
            error: "VORSCHAU_FEHLT",
            message: "Das Archivieren braucht die bestätigte Folgenvorschau.",
          });
          return;
        }
        if (body.grundlage !== folgen.grundlage) {
          reply.code(409).send({
            error: "VORSCHAU_VERALTET",
            message: "Die Lage hat sich seit der Vorschau geändert. Bitte die neuen Folgen prüfen.",
            vorschau: folgen,
          });
          return;
        }
        if (!folgen.darfArchivieren) {
          reply.code(409).send({
            error: "OFFENE_VERANTWORTUNG",
            message: folgen.grund ?? "Archivieren ist nicht möglich.",
            vorschau: folgen,
          });
          return;
        }
        const fassung: SpaceFassung = {
          ...aktuell,
          version: aktuell.version + 1,
          geaendertVon: user.id,
          geaendertAm: jetzt().toISOString(),
          archiviert: true,
          vorgang: "archiviert",
          begruendung,
        };
        if (!(await dienste.spaces.lege(fassung))) {
          veraltet(reply, aktuell.version);
          return;
        }
        await dienste.audit?.record({
          actor: user.id,
          action: "space.archiviert",
          target: fassung.id,
          payload: {
            vorherVersion: aktuell.version,
            version: fassung.version,
            begruendung,
            artikel: folgen.artikel.gesamt,
            offeneAufgaben: folgen.artikel.offen,
            schreibenEntfaellt: folgen.schreibenEntfaellt.map((p) => p.id),
          },
        });
        const gelesen = (await dienste.spaces.fassungen(fassung.id)).at(-1) ?? fassung;
        reply.code(200).send(spaceSicht(gelesen, user, await namen(), await alleTeams()));
      },
    );

    // Wiederaufnehmen — eine neue Fassung mit Begründung; Mitglieder, Teams und Regeln gelten wieder
    // wie vor dem Archivieren.
    app.post<{ Params: { id: string }; Body: unknown }>(
      "/api/spaces/:id/wiederaufnehmen",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const aktuell = await aktuellerSpace(request.params.id);
        if (!aktuell || !darfSpaceSehen(aktuell, user)) {
          nichtGefunden(reply, "Space");
          return;
        }
        if (!darfSpaceBearbeiten(aktuell, user)) {
          reply.code(403).send({
            error: "FORBIDDEN",
            message:
              "Nur die Spacezuständigen oder die Kontoverwaltung nehmen diesen Space wieder auf.",
          });
          return;
        }
        if (!istArchiviert(aktuell)) {
          reply.code(409).send({
            error: "SPACE_AKTIV",
            message: "Dieser Space ist nicht archiviert.",
          });
          return;
        }
        const body = (request.body ?? {}) as { version?: unknown; begruendung?: unknown };
        if (body.version !== aktuell.version) {
          veraltet(reply, aktuell.version);
          return;
        }
        let begruendung: string;
        try {
          begruendung = pruefeBegruendung(body.begruendung);
        } catch (e) {
          fehler(reply, e);
          return;
        }
        const fassung: SpaceFassung = {
          ...aktuell,
          version: aktuell.version + 1,
          geaendertVon: user.id,
          geaendertAm: jetzt().toISOString(),
          archiviert: false,
          vorgang: "wiederaufgenommen",
          begruendung,
        };
        if (!(await dienste.spaces.lege(fassung))) {
          veraltet(reply, aktuell.version);
          return;
        }
        await dienste.audit?.record({
          actor: user.id,
          action: "space.wiederaufgenommen",
          target: fassung.id,
          payload: { vorherVersion: aktuell.version, version: fassung.version, begruendung },
        });
        const gelesen = (await dienste.spaces.fassungen(fassung.id)).at(-1) ?? fassung;
        reply.code(200).send(spaceSicht(gelesen, user, await namen(), await alleTeams()));
      },
    );

    // K6 · Bestandszuordnung: Artikel OHNE Space bekommen per Tag-Regel einen führenden Space — nur,
    // wenn danach niemand mehr sieht als vorher. Recht: die Kontoverwaltung (`users.manage`).
    async function plan(user: SessionUser, roh: unknown) {
      const spaces = await dienste.spaces.aktuelle();
      const regeln = pruefeBestandsRegeln(roh, spaces);
      if (typeof regeln === "string") {
        return regeln;
      }
      return bestandsPlan(regeln, spaces, await dienste.ko.list({}), await kontoListe(), (ko) =>
        darfSehen(user, ko),
      );
    }

    app.post<{ Body: unknown }>("/api/spaces/bestand/vorschau", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      const p = await plan(user, (request.body as { regeln?: unknown } | null)?.regeln);
      if (typeof p === "string") {
        reply.code(400).send({ error: "REGELN_UNGUELTIG", message: p });
        return;
      }
      reply.code(200).send(p);
    });

    app.post<{ Body: unknown }>("/api/spaces/bestand/zuordnung", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      const body = (request.body ?? {}) as { regeln?: unknown; grundlage?: unknown };
      // aufnahme:20260922:gesamt-wissensprojekte: Bilanz und Zuordnung unter derselben Sperre wie
      // Spacewechsel und Spacelöschung — kein Zielspace kann dazwischen gelöscht werden.
      await dienste.spaces.exklusiv(async () => {
        const p = await plan(user, body.regeln);
        if (typeof p === "string") {
          reply.code(400).send({ error: "REGELN_UNGUELTIG", message: p });
          return;
        }
        if (typeof body.grundlage !== "string") {
          reply.code(400).send({
            error: "VORSCHAU_FEHLT",
            message: "Die Bestandszuordnung braucht die bestätigte Bilanz.",
          });
          return;
        }
        if (body.grundlage !== p.grundlage) {
          reply.code(409).send({
            error: "VORSCHAU_VERALTET",
            message: "Bestand oder Rechte haben sich seit der Bilanz geändert. Bitte neu prüfen.",
            vorschau: p,
          });
          return;
        }
        const zugeordnet: { koId: string; zielSpaceId: string }[] = [];
        const fehlgeschlagen: { koId: string; grund: string }[] = [];
        for (const z of p.zuordnungen) {
          try {
            // `erwartet: null` — nur, wer noch OHNE Space ist; ein paralleler Wechsel bleibt stehen.
            await dienste.ko.setLeadingSpace(z.koId, z.zielSpaceId, user.id, null);
            zugeordnet.push({ koId: z.koId, zielSpaceId: z.zielSpaceId });
            await dienste.pruefzustaendigkeit?.abgleichen(z.koId, user.id).catch((fehlerWert) => {
              request.log.warn(
                { err: fehlerWert, event: "pruefzustaendigkeit" },
                "Prüfzuständige aus dem Verzeichnis konnten nicht zugewiesen werden",
              );
            });
            await dienste.freigaberegelAnwenden?.(z.koId, user.id).catch((fehlerWert) => {
              request.log.warn(
                { err: fehlerWert, event: "freigaberegel" },
                "Freigaberegel des Zielspace konnte nicht sofort angewendet werden",
              );
            });
          } catch (e) {
            fehlgeschlagen.push({
              koId: z.koId,
              grund:
                (e as { code?: unknown }).code === "SPACE_STAND_VERALTET"
                  ? "zwischenzeitlich_geaendert"
                  : "fehler",
            });
          }
        }
        const protokoll = {
          regeln: p.regeln.map((r) => ({ tag: r.tag, zielSpaceId: r.zielSpaceId })),
          bilanz: {
            ...p.bilanz,
            zugeordnet: zugeordnet.length,
            fehlgeschlagen: fehlgeschlagen.length,
          },
          zugeordnet,
          ausnahmen: p.ausnahmen.map((a) => ({ koId: a.koId, art: a.art, ziele: a.ziele })),
          fehlgeschlagen,
        };
        await dienste.audit?.record({
          actor: user.id,
          action: "space.bestand-zugeordnet",
          target: "spaces-bestand",
          payload: protokoll,
        });
        reply.code(200).send({ ...protokoll, ausnahmen: p.ausnahmen });
      });
    });

    // Die dokumentierten Bestandszuordnungen — prüfbar auch nach Reload. Nur Kennungen, keine Titel.
    app.get("/api/spaces/bestand/protokoll", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      const eintraege = (await dienste.audit?.list({ action: "space.bestand-zugeordnet" })) ?? [];
      reply.code(200).send({
        laeufe: eintraege.map((e) => ({
          wer: e.actor,
          am: e.at,
          ...(e.payload as Record<string, unknown>),
        })),
      });
    });
  };
}
