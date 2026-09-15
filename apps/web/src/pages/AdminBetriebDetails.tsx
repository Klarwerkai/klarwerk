// ==================================================================================================
// JOB 4025 · KUNDENBETRIEB-BACKUP TEIL 2 — DIE DETAILKARTE „SICHERUNG" DES REITERS „SYSTEM".
// ==================================================================================================
//
// Pedis Auftrag (Eingang `EINGANG-20260914-STARTAUFTRAG-PEDI-ff3fe5bb.md`, Punkt 3): „Backup
// anlegen, Restore einspielen, Update einspielen, jeweils mit SICHTBAREM ERGEBNIS IM ADMIN und
// Server-Nachweis." Diese Karte ist das sichtbare Ergebnis für BACKUP.
//
// WAS SIE SAGT: ob eine Sicherung existiert, wann sie entstand, wie groß sie ist, ob die
// PRÜFSUMMENDATEI danebenliegt, in welchem Verzeichnis gesucht wurde und wann diese Lesung stattfand.
//
// WAS SIE AUSDRÜCKLICH NICHT SAGT — und was als fester Satz danebensteht, statt vom Leser vermutet
// zu werden (Lehre JOB 3954: was eine Messung nicht beweist, steht dabei): (1) dass die Prüfsumme
// zum Inhalt der Sicherung PASST, und (2) dass eine WIEDERHERSTELLUNG gelingt. Beides prüft der
// Restore-Drill, und `docs/operations/restore-drill.md:80` zieht dieselbe Grenze für seine eigene
// Evidenz („Der Stub-Lauf ist kein Datenbank- oder Startnachweis").
//
// (1) IST DER BEFUND DES PRÜFERS AUS RUNDE 5, und er ist der Grund, warum die Marke unten die DATEI
// nennt und nicht ihren Abgleich: die Route öffnet den Dump nie. Sie liest die Sidecar, prüft deren
// Form und deren Endnamen — mehr nicht. „verified"/„geprüft"/„beglaubigt" wäre an einer Sicherung
// mit formgerechter, inhaltlich falscher Prüfsumme eine Behauptung ohne Messung, in jeder Sprache.
//
// DAS ZUSTANDSMODELL kommt NICHT aus einer zweiten Auslegung, sondern aus der einen Stelle, an der
// jede Detailkarte ihren Zustand rendert (`components/einstellungen/Abfragehuelle.tsx`): laden ·
// Fehler mit Ausweg · Bestand mit „Stand von …" · Bestand mit „nicht aktualisiert". Zwei Aussagen
// hängen darüber hinaus an einer FRISCHEN, erfolgreichen Lesung und werden sonst weggelassen:
//   · „keine Sicherung gefunden" entsteht ausschließlich aus `zustand: "gelesen"` mit leerer Liste,
//   · die Altersangabe entsteht ausschließlich gegen `gelesenUtc` DIESER Lesung.
// Ein fehlendes oder unlesbares Verzeichnis ist deshalb „nicht feststellbar" — nie „keine".
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { endpoints } from "../api/endpoints";
import type { SicherungenAuskunft, SicherungsEintrag } from "../api/types";
import { HelpTip } from "../components/HelpTip";
import { Abfragehuelle } from "../components/einstellungen/Abfragehuelle";
import { Detailkarte } from "../components/einstellungen/Detailkarte";
import { abfragelage, useIstOnline, wertBefund } from "../components/einstellungen/zeilenWert";
import { cx } from "../components/ui";

/**
 * Der Abfrageschlüssel — DIESELBE Kennung, die auch die Zeile im Reiter „System" fährt
 * (`pages/Admin.tsx`). Zeile und Karte teilen sich damit EINEN Zwischenspeicher und EINE Wahrheit;
 * innerhalb der Frischezeit des `QueryClient` (`main.tsx:43-45`, 30 s) fragt das Öffnen der Karte
 * den Server gar nicht erst noch einmal. Ein zweiter Schlüssel wäre ein zweiter Weg zu derselben
 * Auskunft — und zwei Wege driften.
 */
export const SICHERUNGEN_KEY = ["admin", "sicherungen"] as const;

/**
 * Der Übersetzer, wie `useTranslation()` ihn herausgibt.
 *
 * Bewusst KEINE eigene Kurzform wie `(k: string, o?: Record<string, unknown>) => string`: der
 * Webbau läuft mit `exactOptionalPropertyTypes`, und eine abgeschriebene Signatur nimmt dort das
 * echte `TFunction` nicht mehr an (gemessen am Tor: TS2345 an beiden Aufrufstellen). Ein zweiter,
 * ungefährer Typ für dieselbe Sache ist ohnehin genau die Bauform, aus der zwei Wahrheiten werden.
 */
type Uebersetzer = ReturnType<typeof useTranslation>["t"];

/**
 * Die Größe in Worten. Drei Schwellen, drei Schlüssel — die Einheit steht im Wörterbuch, nicht als
 * rohes Zeichen im Bauteil. `null` heißt „nicht messbar" und wird als solches gesagt, nie als 0.
 */
function groesseText(t: Uebersetzer, bytes: number | null): string {
  if (bytes === null) {
    return t("adm.backup.size.unknown");
  }
  if (bytes < 1024) {
    return t("adm.backup.size.b", { n: bytes });
  }
  if (bytes < 1024 * 1024) {
    return t("adm.backup.size.kb", { n: (bytes / 1024).toFixed(1) });
  }
  return t("adm.backup.size.mb", { n: (bytes / (1024 * 1024)).toFixed(1) });
}

/**
 * Das Alter einer Sicherung — AUSSCHLIESSLICH gegen `gelesenUtc` gebildet, nie gegen die Uhr des
 * Browsers. Der Grund ist derselbe wie überall in dieser Fläche: die Aussage gehört zu der Lesung,
 * aus der sie stammt. Ohne Zeitstempel im Namen gibt es kein Alter — und nichts wird geschätzt.
 */
function altersText(t: Uebersetzer, eintrag: SicherungsEintrag, gelesenUtc: string): string | null {
  if (eintrag.zeitpunktUtc === null) {
    return null;
  }
  const abstand = new Date(gelesenUtc).getTime() - new Date(eintrag.zeitpunktUtc).getTime();
  if (!Number.isFinite(abstand) || abstand < 0) {
    return null;
  }
  const stunden = Math.floor(abstand / 3_600_000);
  if (stunden < 1) {
    return t("adm.backup.age.now");
  }
  if (stunden < 24) {
    return t("adm.backup.age.hours", { count: stunden });
  }
  return t("adm.backup.age.days", { count: Math.floor(stunden / 24) });
}

/** Ein Zeitpunkt in der Sprache des Lesers; `null` bleibt eine Aussage, kein leeres Feld. */
function zeitText(t: Uebersetzer, iso: string | null): string {
  if (iso === null) {
    return t("adm.backup.time.unknown");
  }
  const zeit = new Date(iso);
  return Number.isNaN(zeit.getTime()) ? t("adm.backup.time.unknown") : zeit.toLocaleString();
}

// Drei flache Konstanten statt einer Kette im Attribut — dieselbe Bauform und dieselbe Begründung
// wie an der Standzeile der `Abfragehuelle` (JOB 3135, `Abfragehuelle.tsx:100-105`): der
// Klassenbindungs-Sammler (`tests/app/mega47-modale-flaechen-sammler.test.tsx`) löst einen lokalen
// Bezeichner mit literalem Wert auf, einen Eigenschaftszugriff `X.y` aber nicht. Offen bleibt damit
// allein die ENTSCHEIDUNG zwischen den beiden Marken — und die gehört hierher.
/** Die Marke am Ende der Zeile: Träger, Abstand, Schrift — unabhängig vom Befund. */
const MARKE = "ml-auto rounded-pill px-2.5 py-0.5 text-[11.5px] font-semibold";
/**
 * Die Prüfsummendatei liegt daneben und lautet auf genau diese Datei — NICHT „ihr Inhalt stimmt".
 * Der Name der Konstante ist der aus Runde 2; er bleibt, weil er außerhalb der Zielpfade dieses
 * Auftrags im Klassenbindungs-Register steht (`tests/app/mega47-modale-flaechen-sammler.test.tsx`).
 * Was der Leser sieht, entscheidet ohnehin das Wörterbuch, und dort steht seit Runde 6 die Datei.
 */
const MARKE_BEGLAUBIGT = "bg-trust-pos-bg text-trust-pos-text";
/**
 * Die Prüfsummendatei FEHLT — die Warnfarbe, nicht die Kritfarbe: die Sicherung ist da, ihr Zeugnis
 * fehlt. Seit Runde 7 sagt die Marke das auch aus: der Befund über eine EINZELNE Sicherung steht an
 * ihrem Eintrag und nirgends sonst (siehe Kopf des Wörterbuchblocks in `i18n.ts`).
 */
const MARKE_OHNE = "bg-trust-warn-bg text-trust-warn-text";

function Eintragszeile({
  eintrag,
  gelesenUtc,
  frisch,
}: {
  eintrag: SicherungsEintrag;
  gelesenUtc: string;
  /** Nur eine frische, erfolgreiche Lesung darf ein Alter behaupten (Auftrag §9). */
  frisch: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const alter = frisch ? altersText(t, eintrag, gelesenUtc) : null;
  return (
    <li
      data-sicherung={eintrag.datei}
      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5"
    >
      <span className="min-w-0 break-all font-mono text-[12.5px] text-text">{eintrag.datei}</span>
      <span className="text-[12px] text-muted-2">{zeitText(t, eintrag.zeitpunktUtc)}</span>
      {alter === null ? null : (
        <span data-testid="sicherung-alter" className="text-[12px] text-muted-2">
          {alter}
        </span>
      )}
      <span className="text-[12px] text-muted-2">{groesseText(t, eintrag.groesseBytes)}</span>
      {/* Die Marke trägt eine eigene Kennung, damit ein Wächter GENAU diesen Text lesen kann und
          nicht den halben Kartentext: die Reichweite dieser zwei Worte ist der Befund aus Runde 5,
          und sie wird in de/en/nl einzeln geprüft (`tests/kundenbetrieb-sicherung/
          admin-sicherung-mounted.test.tsx`, U7). */}
      <span
        data-testid="sicherung-marke"
        className={cx(MARKE, eintrag.beglaubigt ? MARKE_BEGLAUBIGT : MARKE_OHNE)}
      >
        {eintrag.beglaubigt ? t("adm.backup.certified") : t("adm.backup.uncertified")}
      </span>
    </li>
  );
}

/** Der Befund einer Auskunft: Liste, belegte Negativaussage oder ehrliches „nicht feststellbar". */
function Befund({
  daten,
  frisch,
}: {
  daten: SicherungenAuskunft;
  frisch: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  if (daten.zustand !== "gelesen") {
    // KEIN „keine Sicherung": es ist nicht bekannt, ob welche da sind. Der Grund steht dabei, als
    // Kennung des Betriebssystems — nur bei `unlesbar` gibt es überhaupt einen.
    const grund =
      daten.zustand === "kein_verzeichnis"
        ? t("adm.backup.reason.missing")
        : t("adm.backup.reason.unreadable", { grund: daten.grund });
    return (
      // `<output>` trägt implizit `role="status"` — dieselbe Wahl wie an der Standzeile der
      // `Abfragehuelle` (JOB 2064 A18, biome `useSemanticElements`): eine Statusregion, keine
      // Alarmregion. Der Befund ist eine Auskunft über die Lage, kein Alarm.
      <output
        data-testid="sicherung-unbekannt"
        className="block rounded-card border border-trust-warn-bg bg-trust-warn-bg px-3 py-2 text-[12.5px] leading-relaxed text-trust-warn-text"
      >
        {`${t("adm.backup.unknown")} ${grund}`}
      </output>
    );
  }
  if (daten.sicherungen.length === 0) {
    // Eine BELEGTE Negativaussage: es liegt eine erfolgreiche, vollständige Lesung dieses
    // Verzeichnisses vor. Deshalb steht das Verzeichnis im Satz — die Aussage gilt für genau eines.
    return (
      <p data-testid="sicherung-leer" className="text-[12.5px] leading-relaxed text-muted">
        {t("adm.backup.none", { verzeichnis: daten.verzeichnis })}
      </p>
    );
  }
  return (
    <ul data-testid="sicherung-liste" className="divide-y divide-hairline">
      {daten.sicherungen.map((e) => (
        <Eintragszeile key={e.datei} eintrag={e} gelesenUtc={daten.gelesenUtc} frisch={frisch} />
      ))}
    </ul>
  );
}

/**
 * JOB 4025 — die Karte „Sicherung" unter „System".
 *
 * Sie LIEST nur. Eine Sicherung aus der Oberfläche auszulösen bleibt draußen (Auftrag §10): dafür
 * müsste der Anwendungsserver ein Shell-Werkzeug starten, und Rechte, Zeitlimit, gleichzeitige
 * Läufe und Ausgabekanal sind eine eigene Sicherheitsentscheidung mit eigener Abnahme.
 */
export function SicherungDetail({ onZurueck }: { onZurueck: () => void }): JSX.Element {
  const { t } = useTranslation();
  // NUR die Erklärung der Karte liegt im „?"-Menü — der Ehrlichkeitssatz NICHT.
  //
  // Runde 1 hatte ihn an BEIDEN Orten: im Menü und sichtbar unten. Genau das war der Befund des
  // Zielbild-Wächters (`tests/design/zielbild-h6-kein-erklaertext.test.ts`, Fall `D-system`): er
  // liest je Karte die Absätze des „?"-Menüs und verlangt, dass GENAU DIESE Sätze im Sichtfeld
  // derselben Karte fehlen. Ein Satz an zwei Orten sind zwei Wahrheiten über dieselbe Sache — wird
  // morgen eine davon nachgeführt, driften sie auseinander.
  //
  // Warum die Auflösung SICHTBAR lautet und nicht „ab ins Menü": der Auftrag verlangt ihn dort
  // (Lieferung 6, „die Karte zeigt … einen festen Ehrlichkeitssatz"), und die Sache verlangt es
  // auch. Ein Satz, der eine falsche Beruhigung verhindern soll, kommt zu spät, wenn man ihn erst
  // aufklappen muss. Er ist kein Erklärtext ÜBER die Funktion, sondern die Reichweite DES BEFUNDS,
  // der darüber steht: dieselbe Bauform wie die Ehrlichkeitszeile unter „Meine Wirkung"
  // (`pages/Profile.tsx` → `MyImpactNumbers`).
  //
  // WEIL ER FEST IST, DARF ER NICHTS VORAUSSETZEN (Befund des Prüfers, Runde 6). In Runde 6 stand in
  // ihm „… und dass die Prüfsummendatei danebenliegt" — ein Satz, der auch dann dastand, wenn genau
  // diese Datei FEHLTE. Seit Runde 7 sagt er nur noch, was diese Anzeige tut und was sie nicht tut;
  // was für eine EINZELNE Sicherung gilt, sagt ausschliesslich ihre eigene Marke.
  const hilfeMenue = [{ titel: t("adm.backup.title"), text: t("adm.backup.help") }];
  const online = useIstOnline();
  const sicherungen = useQuery({
    queryKey: SICHERUNGEN_KEY,
    queryFn: endpoints.admin.sicherungen,
  });
  // Dieselben Bausteine, aus denen auch die `Abfragehuelle` ihren Zustand bildet — kein zweites
  // Modell, nur die eine Frage, die die Hülle nicht beantwortet: darf eine ALTERSangabe hier noch
  // als frische Wahrheit stehen? Bei gestörter oder ruhender Auffrischung: nein.
  const frisch = !wertBefund(abfragelage(sicherungen, online), null).nichtAktualisiert;

  return (
    <Detailkarte
      titel={t("adm.backup.title")}
      onZurueck={onZurueck}
      testId="detail-sicherung"
      hilfe={hilfeMenue}
    >
      <HelpTip
        title={t("seitenhilfe.admin.sicherung.titel")}
        body={t("seitenhilfe.admin.sicherung.text")}
      />
      <Abfragehuelle abfrage={sicherungen}>
        {(daten) => (
          <div className="space-y-3">
            <Befund daten={daten} frisch={frisch} />
            <div className="space-y-1 text-[11.5px] text-muted-2">
              <p data-testid="sicherung-verzeichnis">
                {t("adm.backup.dir", { verzeichnis: daten.verzeichnis })}
              </p>
              <p data-testid="sicherung-gelesen">
                {t("adm.backup.readAt", { zeit: zeitText(t, daten.gelesenUtc) })}
              </p>
            </div>
          </div>
        )}
      </Abfragehuelle>
      {/* DER FESTE EHRLICHKEITSSATZ. Er steht AUSSERHALB der Hülle und damit außerhalb ihrer Weiche
          — gerade im Fehler- und im Leerfall ist er der Satz, der eine falsche Beruhigung
          verhindert. Genau deshalb taugt er NICHT als Erholungsbeleg der Endpunkt-Matrix
          (`tests/design/h6-detail-zustandsweg.test.ts`): er ist auch bei Störung da. Dort steht als
          `inhalt` der Verzeichnis-Vorspann, den allein der Erfolgszweig der Hülle zeichnet. */}
      <p
        data-testid="sicherung-ehrlichkeit"
        className="rounded-card border border-hairline bg-page px-3 py-2 text-[11px] leading-relaxed text-muted-2"
      >
        {t("adm.backup.honesty")}
      </p>
    </Detailkarte>
  );
}
