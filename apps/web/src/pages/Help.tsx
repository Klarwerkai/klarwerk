import { ArrowRight, ExternalLink, Lock, Mail } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useSupportKontakt } from "../api/support";
import { useRole } from "../app/RoleContext";
import { type Role, routePathAllows } from "../app/navigation";
import { UploadLimitsHint } from "../components/UploadLimitsHint";
import { Card, PageHeader } from "../components/ui";
import { HELP_TOPICS, type HelpSearchItem, filterHelpTopics } from "../lib/helpTopics";
import {
  ISO_HELP_LABELS,
  ISO_HELP_TOPICS,
  helpAbsaetze,
  isoHelpSprache,
  isoQuellenAnzeige,
} from "../lib/helpTopics.iso";
import {
  BIBLIOTHEK_GRUPPEN,
  BIBLIOTHEK_TEILE,
  FUNKTIONS_ARTIKEL,
  funktionsArtikel,
  hilfeArtikel,
} from "../lib/hilfeBibliothek";
import { HILFE_FAQ, hilfeFaqSprache } from "../lib/hilfeFaq";
import { type PilotSchritt, pilotRolleAusSitzung, pilotSchritte } from "../lib/pilotChecklist";
import { PILOT_OBSERVATIONS } from "../lib/pilotObservationGuide";

// SCRUM-219: produktnahe Hilfe mit clientseitiger Suche über Titel/Text/Tags. Links nur auf
// echte App-Routen, ehrlicher Leerzustand. Kein Backend, keine KI-Suche, kein CMS.
//
// JOB 3338 (ISO-HILFE): dieselbe Suche trägt jetzt zusätzlich vier ISO-Kapitel. Sie kommen NICHT
// aus `HELP_TOPICS`, sondern aus `helpTopics.iso.ts` — aus zwei Gründen, die beide gemessen sind:
//   · Ihr Text liegt fertig in DE/EN im Modul statt als i18n-Schlüssel (siehe Kopf dort).
//   · Die Seitenhilfe des Zahnrads rechnet „genau EIN Kapitel je Route" (JOB 3028). Drei ISO-
//     Kapitel zeigen auf schon belegte Routen; in `HELP_TOPICS` hätten sie /bibliothek,
//     /validierung und /aufgaben still ihren Erklärsatz gekostet.
// Der SUCHRAUM ist derselbe: beide Listen werden zu aufgelösten Items und laufen durch denselben
// DOM-freien Filter. Ein ISO-Kapitel trägt zusätzlich `sources` — EXTERNE Adressen, die als eigener
// Block unter dem Text stehen und den Tabwechsel am Link ankündigen. Der interne Handlungslink
// bleibt davon getrennt: er ist eine App-Route und öffnet keinen Tab.
//
// JOB 3468 (REVIEW26-HILFE-IMPORT): genau EIN Kapitel verlangt zusätzlich die geltenden
// Upload-Grenzen auf seiner Karte — der Dateiimport. Die Zahlen stehen NICHT in seinem Text: sie
// kommen vom Server und werden von der einen vorhandenen Anzeige dafür gezeigt
// (`components/UploadLimitsHint.tsx`). Liegen sie nicht vor, zeigt die Karte den Zusatz GAR NICHT —
// ohne frische Grundlage wird keine Grenze behauptet. Das Kapitel selbst hängt an keinem Abruf und
// bleibt in jedem Zustand auffindbar und lesbar, auch offline.
//
// WAS ENTSCHEIDET: das Merkmal `uploadLimits` des Kapitels, NICHT seine Kennung. Eine Seite, die
// „wenn id === 'fileimport'" fragt, ist ein Sonderfall und läuft beim nächsten Kapitel auseinander
// — dieselbe Erwägung wie beim ISO-Zweig eine Zeile weiter unten (`istIso` hängt an `sources`).
type HilfeEintrag = HelpSearchItem & {
  to: string;
  sources?: readonly string[];
  uploadLimits?: boolean;
  // R-0935 / R-0924: eine häufige Frage statt eines Kapitels. Sie läuft durch DENSELBEN Suchraum und
  // DIESELBE Suchregel; erst das Ergebnis wird an diesem Merkmal in Kapitel und Fragen geteilt.
  faq?: true;
  // R-0890 (Nacharbeit 5): ein Funktionsartikel der Bibliothek — die Kennung des Artikels. Auch er
  // läuft durch denselben Suchraum und wird erst im Ergebnis abgetrennt.
  funktion?: string;
};

// ================================================================================================
// JOB 4022 · EINSTIEG-HILFE — DIE ROLLE DES LESENDEN, WENN SIE FESTSTEHT.
// ================================================================================================
//
// Die Einstiegsführung („so läuft der erste Arbeitsweg", Karte unten) bot bis hierher JEDEM einen
// Link je Schritt an — auch auf Routen, die seine Rolle nicht betreten darf. Sie fragt jetzt
// VORHER, was der Router ohnehin entscheidet (`routes.tsx:184-188`). Es werden dabei KEINE Rechte
// geändert und keine Route geöffnet: die Fläche nimmt dasselbe Urteil nur vorweg, statt den
// Lesenden hineinlaufen zu lassen.
//
// WARUM DER WURF GEFANGEN WIRD. `useRole` wirft ohne `<RoleProvider>` (`app/RoleContext.tsx:63-69`).
// In der Anwendung steht der Provider immer (`App.tsx`) — die Hilfeseite ist aber die eine Seite,
// die an keinem Abruf hängt und in jeder Lage lesbar bleiben soll (dieselbe Zusage, die der Kopf
// oben für das Importkapitel trifft); drei vorhandene Prüfstände montieren sie ohne jede Umgebung.
// Ohne Rollenquelle ist die Rolle UNBEKANNT, und dann steht weder ein „öffnen"-Link noch eine
// Sperrbehauptung da — die Voreinstellung auf „offen" wäre genau der behobene Fehler in neuer Form.
//
// KEIN BEDINGTER HOOK: `useRole` wird bei jedem Rendern gerufen, in derselben Reihenfolge;
// gefangen wird allein sein Wurf.
//
// JOB 4358: „bekannt" heisst seit diesem Job nicht mehr „der Provider steht", sondern „die Rolle
// stammt aus einer Sitzung". Die Unterscheidung trifft `pilotRolleAusSitzung`
// (`lib/pilotChecklist.ts`) — dieselbe eine Quelle, die auch über Link und Sperre entscheidet.
// Ohne sie sprang der Vorschauwert `"experte"` ein, solange `/auth/me` lief oder scheiterte.
function useRolleWennBekannt(): Role | null {
  try {
    return pilotRolleAusSitzung(useRole());
  } catch {
    return null;
  }
}

export function Help(): JSX.Element {
  const { t, i18n } = useTranslation();
  // JOB 4022: die Einstiegsführung aus der Sicht der lesenden Rolle — die Rollenfrage beantwortet
  // die EINE Routenquelle (`lib/pilotChecklist.ts`), nicht diese Seite.
  const rolle = useRolleWennBekannt();
  const schritte: readonly PilotSchritt[] = pilotSchritte(rolle);
  const offeneSchritte = schritte.filter((schritt) => schritt.zugang === "offen").length;
  const [q, setQ] = useState("");
  // R-1064: der Supportweg dieser Installation (`api/support.ts`). Hängt an einem Abruf — die Seite
  // tut es nicht: jede Lage ausser „eingerichtet" ist ein Satz, kein leerer Platz.
  const support = useSupportKontakt();
  // Die Lieferung kennt DE und EN; alles andere (nl) fällt auf DE — wie `fallbackLng` in i18n.ts.
  const isoLng = isoHelpSprache(i18n.language);

  // R-0935 / R-0924: die häufigen Fragen als eigene Sammlung unter den Kapiteln — derselbe Suchraum,
  // aber KEIN Kapitel (`data-hilfe-thema` bleibt den Kapiteln vorbehalten; die Seitenhilfe des
  // Zahnrads zählt Kapitel je Route). Quelle ist die Lesefassung `lib/hilfeFaq.ts` in
  // Anwendersprache und DE/EN/NL (P-HILFE-ANWENDERSPRACHE) — NICHT `faqContent.ts` wörtlich, das
  // Rollen- und Prüfbegriffe trägt und Klaras Wissensbasis bleibt.
  const faqLng = hilfeFaqSprache(i18n.language);

  // R-0890 / R-0935: der Bibliotheksartikel eines Kapitels als ein Text — für die Suche.
  const artikeltext = (kapitelId: string): string | null => {
    const artikel = hilfeArtikel(kapitelId, i18n.language);
    return artikel ? BIBLIOTHEK_TEILE.map((teil) => artikel[teil]).join(" ") : null;
  };

  // i18n-Texte auflösen → durchsuchbare Items (DOM-freie Filterung im Helper).
  const items: HilfeEintrag[] = [
    ...HELP_TOPICS.map((topic) => {
      const suchtext = artikeltext(topic.id);
      return {
        id: topic.id,
        title: t(topic.titleKey),
        body: t(topic.bodyKey),
        tags: topic.tags,
        to: topic.to,
        // Nur setzen, wenn das Kapitel es WIRKLICH verlangt: ein Feld mit `undefined` ist unter
        // `exactOptionalPropertyTypes` etwas anderes als ein fehlendes.
        ...(topic.uploadLimits === true ? { uploadLimits: true } : {}),
        // R-0890 / R-0935: der zugeklappte Artikel ist durchsuchbar, ohne angezeigt zu werden.
        ...(suchtext ? { suchtext } : {}),
      };
    }),
    ...ISO_HELP_TOPICS.map((topic) => ({
      id: topic.id,
      title: topic.title[isoLng],
      body: topic.body[isoLng],
      tags: topic.tags,
      to: topic.to,
      sources: topic.sources,
    })),
    ...HILFE_FAQ.map((faq) => ({
      id: faq.id,
      title: faq.frage[faqLng],
      body: faq.antwort[faqLng],
      tags: [],
      to: faq.route,
      faq: true as const,
    })),
    ...FUNKTIONS_ARTIKEL.map((artikel) => {
      const { titel, teile } = funktionsArtikel(artikel, i18n.language);
      return {
        id: `funktion:${artikel.id}`,
        title: titel,
        body: "",
        tags: [],
        to: artikel.route,
        funktion: artikel.id,
        suchtext: BIBLIOTHEK_TEILE.map((teil) => teile[teil]).join(" "),
      };
    }),
  ];
  const treffer = filterHelpTopics(items, q);
  const visible = treffer.filter(
    (eintrag) => eintrag.faq !== true && eintrag.funktion === undefined,
  );
  const faqTreffer = treffer.filter((eintrag) => eintrag.faq === true);
  const funktionTreffer = new Set(
    treffer.flatMap((eintrag) => (eintrag.funktion === undefined ? [] : [eintrag.funktion])),
  );
  const suchAktiv = q.trim().length > 0;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader kicker={t("help.kicker")} title={t("nav.help")} pageKey="hilfe" />
      <p className="-mt-3 mb-4 text-sm text-muted">{t("help.intro")}</p>
      {/* R-1064: DER SUPPORTWEG DIESER INSTALLATION. Er wird vom Betreiber festgelegt
          (KLARWERK_SUPPORT_URL / KLARWERK_SUPPORT_LABEL, geprüft in `support-routes.ts`) — die
          Seite erfindet keinen. Ein Link steht NUR im Zustand „eingerichtet", und dann mit
          sichtbarem Ziel; jede andere Lage sagt in einem Satz, was ist. Nicht durchsuchbar (fester
          Orientierungspunkt wie die zwei Karten darunter), die Suche bleibt unberührt.
          KEIN EIGENES BAUTEIL und KEINE bedingte Klasse — dieselben zwei Wächter wie bei der
          Einstiegsführung unten (`mega84` Bauteilauflage, `mega47` Klassenbindungen): jede Lage
          ist ein eigener Zweig mit wörtlicher Klassenkette. */}
      <Card
        data-testid="hilfe-support"
        data-support-zustand={support.zustand}
        className="mb-5 border-dashed"
      >
        <h2 className="text-[14px] font-semibold text-ink">{t("help.support.title")}</h2>
        {support.zustand === "eingerichtet" ? (
          <div className="mt-1">
            <p className="text-[12.5px] leading-relaxed text-muted">
              {t("help.support.configured")}
            </p>
            {support.art === "https" ? (
              <a
                href={support.ziel}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="hilfe-support-link"
                className="mt-1.5 inline-flex flex-wrap items-baseline gap-1 text-[13px] font-semibold text-ai hover:underline"
              >
                <ExternalLink size={12} aria-hidden="true" className="self-center" />
                <span>{support.bezeichnung ?? t("help.support.linkDefault")}</span>
                <span className="font-mono text-[10px] font-normal text-muted-2">
                  ({t("help.support.newTab")})
                </span>
              </a>
            ) : (
              <a
                href={support.ziel}
                data-testid="hilfe-support-link"
                className="mt-1.5 inline-flex flex-wrap items-baseline gap-1 text-[13px] font-semibold text-ai hover:underline"
              >
                <Mail size={12} aria-hidden="true" className="self-center" />
                <span>{support.bezeichnung ?? t("help.support.mailDefault")}</span>
              </a>
            )}
            <p
              data-testid="hilfe-support-ziel"
              className="mt-0.5 break-all font-mono text-[11px] text-muted-2"
            >
              {support.anzeige}
            </p>
          </div>
        ) : null}
        {support.zustand === "nicht_eingerichtet" ? (
          <p
            data-testid="hilfe-support-hinweis"
            className="mt-1 text-[12.5px] leading-relaxed text-muted"
          >
            {t("help.support.notConfigured")}
          </p>
        ) : null}
        {support.zustand === "ungueltig" ? (
          <p
            data-testid="hilfe-support-hinweis"
            className="mt-1 text-[12.5px] leading-relaxed text-muted"
          >
            {t("help.support.invalid")}
          </p>
        ) : null}
        {support.zustand === "fehler" ? (
          <p
            data-testid="hilfe-support-hinweis"
            className="mt-1 text-[12.5px] leading-relaxed text-muted"
          >
            {t("help.support.loadError")}
          </p>
        ) : null}
        {support.zustand === "laedt" ? (
          <p
            data-testid="hilfe-support-hinweis"
            className="mt-1 text-[12.5px] leading-relaxed text-muted-2"
          >
            {t("help.support.loading")}
          </p>
        ) : null}
      </Card>
      {/* R-0443 (Aufnahme gesamt-hilfen): der Einstieg in die eigene Seite „So arbeitet Klarwerk“
          (`pages/Arbeitsweise.tsx`). Nicht durchsuchbar — ein fester Orientierungspunkt wie die
          Karten darunter. */}
      <Link
        to="/so-arbeitet-klarwerk"
        data-testid="hilfe-arbeitsweise"
        className="mb-5 flex items-center justify-between gap-2 rounded-card border border-hairline bg-surface px-4 py-3 text-[13px] font-semibold text-ink hover:border-ink/30"
      >
        <span>{t("arbeitsweise.einstieg")}</span>
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
      {/* SCRUM-305: kompakte Einstiegsführung für den ersten Nutzerlauf — ehrlich, Stage-1, nicht
          durchsuchbar (fixer Orientierungspunkt), stört die normale Hilfe-Suche nicht.
          JOB 4022: jeder Schritt sagt jetzt, ob er für die lesende Rolle begehbar ist. */}
      <Card className="mb-5 border-dashed">
        <h2 className="text-[14px] font-semibold text-ink">{t("pilot.access.title")}</h2>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
          {t("pilot.access.subtitle")}
        </p>
        {/* Die Zugangszeile ist GERECHNET (`offeneSchritte`), keine feste Zahl — und sie behauptet
            nichts, solange die Rolle nicht feststeht. */}
        {rolle === null ? (
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-2">
            {t("pilot.access.roleUnknown")}
          </p>
        ) : (
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-2">
            {t("pilot.access.summary", {
              rolle: t(`role.name.${rolle}`),
              offen: offeneSchritte,
              gesamt: schritte.length,
            })}
          </p>
        )}
        {/* Eine Zeile je Schritt. Der Schritttext steht IMMER da — der Gast soll den ganzen Weg
            kennen, auch den Teil, der nicht ihm gehört. Daneben steht genau eine von drei
            Auskünften: der Weg hinein, die verlangte Rolle, oder (Rolle bzw. Route noch nicht
            bekannt) gar nichts.
            BEWUSST KEIN EIGENES BAUTEIL: ein `<EinstiegsSchritt>` wäre die schönere Gliederung,
            zählt aber in der Bauteil-Auflage von `tests/app/mega84-bildbeschreibungsweg-sammler.
            test.tsx` mit (gemessen: 378 → 379, Tor rot). Die Auflage dort nachzuziehen wäre eine
            Änderung an einem fremden Wächter für eine reine Formfrage — die Zeile bleibt deshalb,
            wo sie vorher auch stand: in der Liste. */}
        <ol className="mt-3 space-y-2">
          {schritte.map((schritt) => (
            <li key={schritt.item.id} className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink font-mono text-[10px] font-semibold text-white">
                {schritt.item.n}
              </span>
              <span className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-text">
                {t(schritt.item.labelKey)}
              </span>
              {schritt.zugang === "offen" ? (
                <Link
                  to={schritt.item.to}
                  className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-ai hover:opacity-80"
                >
                  {t("help.openRoute")}
                  <ArrowRight size={12} />
                </Link>
              ) : null}
              {schritt.zugang === "gesperrt" ? (
                <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-muted-2">
                  <Lock size={11} aria-hidden="true" />
                  {t("pilot.access.locked", { rolle: t(`role.name.${schritt.minRole}`) })}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </Card>
      {/* SCRUM-307: was im Alltag hakt, in einen BESTEHENDEN Bereich einordnen — kein Backend, keine
          Speicherung; der Eintrag zur Bedienung bewusst ohne Produktlink (`pilotObservationGuide.ts`
          `to: null`). Nicht durchsuchbar (fester Orientierungspunkt), nicht überladen.
          JOB 4067: umgestellt sind allein die TEXTE (`pilot.obs.*` in `i18n.ts`, de/en/nl) — sie
          sprechen jetzt dieselbe Sprache wie die Karte darüber. Die SCHLÜSSELNAMEN heissen weiter
          `pilot.obs.*`, und das ist kein vergessener Rest: ein Schlüsselname ist kein angezeigter
          Text, und ein Umbenennen wäre eine Änderung an `lib/pilotObservationGuide.ts`. */}
      <Card className="mb-5 border-dashed">
        <h2 className="text-[14px] font-semibold text-ink">{t("pilot.obs.title")}</h2>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{t("pilot.obs.subtitle")}</p>
        <ul className="mt-3 space-y-2.5">
          {PILOT_OBSERVATIONS.map((obs) => (
            <li key={obs.id} className="flex flex-col gap-1 border-l-2 border-hairline pl-3">
              <span className="text-[12.5px] leading-relaxed text-text">{t(obs.labelKey)}</span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted">
                <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                  {t("pilot.obs.mapLabel")}:
                </span>
                <span>{t(obs.mapKey)}</span>
                {obs.to ? (
                  <Link
                    to={obs.to}
                    className="inline-flex items-center gap-1 font-semibold text-ai hover:opacity-80"
                  >
                    {t("pilot.obs.openFlow")}
                    <ArrowRight size={12} />
                  </Link>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("help.search")}
        data-testid="hilfe-suche"
        className="mb-5 h-10 w-full rounded-input border border-hairline bg-surface px-3 text-sm outline-none focus:border-ink/30"
      />
      {visible.length === 0 && faqTreffer.length === 0 && funktionTreffer.size === 0 ? (
        // R-0474: unter dem Satz steht der nächste Schritt. Die Frage an das Wissen nur, wenn die
        // Rolle aus einer Sitzung stammt UND der Router sie auf `/fragen` lässt — dieselbe
        // Zurückhaltung wie die Einstiegsführung oben (JOB 4358).
        <Card
          data-testid="hilfe-nulltreffer"
          className="border-dashed text-center text-sm text-muted"
        >
          <p>{t("help.noResults")}</p>
          {rolle !== null && routePathAllows("/fragen", rolle) && q.trim() ? (
            <Link
              to={`/fragen?q=${encodeURIComponent(q.trim())}`}
              data-testid="hilfe-als-frage"
              className="mt-1.5 inline-flex items-center gap-1 font-semibold text-ai hover:opacity-80"
            >
              {t("erstnutzer.hilfe.alsFrage", { q: q.trim() })}
              <ArrowRight size={12} />
            </Link>
          ) : (
            <p className="mt-1">{t("erstnutzer.hilfe.anderesWort")}</p>
          )}
        </Card>
      ) : null}
      {visible.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {visible.map((topic) => {
            // Ein ISO-Kapitel erkennt man an seinen externen Quellen — nicht an seiner ID.
            const istIso = topic.sources !== undefined;
            const merkmale = topic.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-pill bg-hairline-soft px-1.5 py-0.5 font-mono text-[10px] text-muted-2"
              >
                {tag}
              </span>
            ));
            // R-0890: der Bibliotheksartikel zu dieser Funktion nach dem Fünf-Teil-Bauplan
            // (`lib/hilfeBibliothek.ts`). ISO-Kapitel haben keinen — dort ist er `null`.
            const artikel = hilfeArtikel(topic.id, i18n.language);
            // Trifft die Suche im Artikel, steht er offen — sonst sähe man nicht, WO sie traf.
            const suche = q.trim().toLowerCase();
            const artikelTrifft =
              suche.length > 0 && (topic.suchtext ?? "").toLowerCase().includes(suche);
            // Der Inhalt ist für beide Kartenformen DERSELBE und wird einmal gebaut.
            const inhalt = (
              <>
                <h3 className="text-[14px] font-semibold text-ink">{topic.title}</h3>
                {/* Absätze der Quelle bleiben Absätze. Ein Text ohne Leerzeile ergibt genau einen —
                    die bestehenden Kapitel sehen aus wie vorher. Nichts wird gekürzt. */}
                <div className="mt-1.5 flex-1 space-y-2">
                  {helpAbsaetze(topic.body).map((absatz) => (
                    <p
                      key={absatz.slice(0, 40)}
                      data-hilfe-absatz=""
                      className="text-[13px] leading-relaxed text-muted"
                    >
                      {absatz}
                    </p>
                  ))}
                </div>
                {/* R-0890: „Ausführlich erklärt" — natives `details`, standardmäßig zugeklappt, damit
                    die Seite kurz bleibt (P-HILFE-ANWENDERSPRACHE). Die Teile tragen KEIN
                    `data-hilfe-absatz`: das bleibt dem Kapiteltext vorbehalten, den die
                    vorhandenen Wächter lesen. */}
                {artikel ? (
                  <details
                    data-hilfe-artikel={topic.id}
                    open={artikelTrifft || undefined}
                    className="mt-2.5 rounded-input border border-hairline bg-page px-2.5 py-2"
                  >
                    <summary className="cursor-pointer text-[12.5px] font-semibold text-ink">
                      {t("hilfebibliothek.oeffnen")}
                    </summary>
                    <dl className="mt-1.5 space-y-2">
                      {BIBLIOTHEK_TEILE.map((teil) => (
                        <div key={teil}>
                          <dt className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                            {t(`hilfebibliothek.teil.${teil}`)}
                          </dt>
                          <dd
                            data-hilfe-artikel-teil={teil}
                            className="mt-0.5 text-[12.5px] leading-relaxed text-text"
                          >
                            {artikel[teil]}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                ) : null}
                {/* JOB 3468: die geltenden Upload-Grenzen — AUS DER SERVERQUELLE, über die eine
                    vorhandene Anzeige. Sie entscheidet selbst, ob sie etwas sagt: ohne Werte
                    (laden, leer, Fehler, offline, kein Abfragekontext) rendert sie `null`
                    (`UploadLimitsHint.tsx:28-37`). Damit behauptet die Hilfe weder eine Zahl noch
                    eine Frische, und sie meldet auch keinen fremden Dienstfehler.
                    Die Klassenkette steht LITERAL da — der Klassenbindungs-Sammler
                    (`tests/app/mega47-modale-flaechen-sammler.test.tsx`) könnte eine erst zur
                    Laufzeit gebaute nicht auflösen (siehe den Block weiter unten). */}
                {topic.uploadLimits ? (
                  <UploadLimitsHint className="mt-2 text-[11px] text-muted-2" />
                ) : null}
                {istIso ? (
                  // `2701` ist ein SUCHALIAS, keine Normbezeichnung. Bei den ISO-Kapiteln bekommt
                  // die Merkmalsleiste deshalb eine Überschrift, die genau das sagt.
                  <div className="mt-2.5" data-testid={`hilfe-suchbegriffe-${topic.id}`}>
                    <span className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                      {ISO_HELP_LABELS.searchTerms[isoLng]}
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">{merkmale}</div>
                  </div>
                ) : (
                  <div className="mt-2.5 flex flex-wrap gap-1">{merkmale}</div>
                )}
                {topic.sources ? (
                  <div
                    data-testid={`hilfe-quellen-${topic.id}`}
                    className="mt-3 rounded-input border border-hairline bg-page px-2.5 py-2"
                  >
                    <div className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                      {ISO_HELP_LABELS.sources[isoLng]}
                    </div>
                    <ul className="mt-1.5 space-y-1">
                      {topic.sources.map((quelle) => (
                        <li key={quelle}>
                          {/* Die Ankündigung steht IM Link und ist damit Teil seines zugänglichen
                              Namens — wer ihn per Tastatur erreicht, hört sie vor dem Klick. */}
                          <a
                            href={quelle}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex flex-wrap items-baseline gap-1 text-[12.5px] font-medium text-ai hover:underline"
                          >
                            <ExternalLink size={11} aria-hidden="true" className="self-center" />
                            <span className="break-all">{isoQuellenAnzeige(quelle)}</span>
                            <span className="font-mono text-[10px] font-normal text-muted-2">
                              ({ISO_HELP_LABELS.newTab[isoLng]})
                            </span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <Link
                  to={topic.to}
                  data-testid={`hilfe-route-${topic.id}`}
                  className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-ai hover:opacity-80"
                >
                  {t("help.openRoute")}
                  <ArrowRight size={13} />
                </Link>
              </>
            );
            // ==================================================================================
            // ZWEI KARTEN STATT EINER BEDINGTEN KLASSE — und warum das kein Umweg ist.
            // ==================================================================================
            // Runde 1 schrieb hier `className={cx("flex flex-col", istIso && "sm:col-span-2")}`.
            // Das ist für den Klassenbindungs-Sammler (`tests/app/mega47-…`) eine UNAUFLÖSBARE
            // Bindung: `istIso` entsteht erst zur Laufzeit, der Sammler kann den Klassennamen
            // nicht mehr ausrechnen — 218 gemeldete Bindungen statt 217, Tor rot.
            //
            // Der Vertrag dieses Sammlers verlangt dann NICHT, den Pin hochzusetzen, sondern die
            // Klasse auflösbar zu schreiben (dort ausgeschrieben unter JOB 3267 Q1). Genau das
            // steht hier: der Zustand entscheidet über den ZWEIG, nicht über den Klassennamen.
            // Beide Ketten stehen wörtlich im Baum — wie schon vor diesem Job, wo die Karte
            // `className="flex flex-col"` trug.
            //
            // WARUM ÜBERHAUPT ZWEI BREITEN: die ISO-Kapitel sind Fliesstext über mehrere Absätze.
            // In einer halben Spalte stünde er als schmaler Turm; über die ganze Breite bleibt er
            // lesbar. Auf dem Telefon ist das Raster ohnehin einspaltig, dort ändert sich nichts.
            return istIso ? (
              <Card
                key={topic.id}
                data-hilfe-thema={topic.id}
                className="flex flex-col sm:col-span-2"
              >
                {inhalt}
              </Card>
            ) : (
              <Card key={topic.id} data-hilfe-thema={topic.id} className="flex flex-col">
                {inhalt}
              </Card>
            );
          })}
        </div>
      ) : null}
      {/* R-0890 (Nacharbeit 5): DIE FUNKTIONSARTIKEL, gegliedert nach den Teilen der Quelle. Jeder
          ist ein natives `details`, zugeklappt — bei einer laufenden Suche stehen die Treffer offen.
          Ohne Treffer bei laufender Suche steht der Abschnitt gar nicht da. */}
      {funktionTreffer.size > 0 ? (
        <section data-testid="hilfe-funktionen" className="mt-6">
          <h2 className="text-[15px] font-semibold text-ink">
            {t("hilfebibliothek.funktionen.titel")}
          </h2>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
            {t("hilfebibliothek.funktionen.untertitel")}
          </p>
          {BIBLIOTHEK_GRUPPEN.map((gruppe) => {
            const inGruppe = FUNKTIONS_ARTIKEL.filter(
              (artikel) => artikel.gruppe === gruppe && funktionTreffer.has(artikel.id),
            );
            if (inGruppe.length === 0) {
              return null;
            }
            return (
              <div key={gruppe} data-hilfe-gruppe={gruppe} className="mt-3">
                <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted-2">
                  {t(`hilfebibliothek.gruppe.${gruppe}`)}
                </h3>
                <ul className="mt-1.5 space-y-2">
                  {inGruppe.map((artikel) => {
                    const { titel, teile } = funktionsArtikel(artikel, i18n.language);
                    return (
                      <li key={artikel.id}>
                        <details
                          data-hilfe-artikel={artikel.id}
                          open={suchAktiv || undefined}
                          className="rounded-card border border-hairline bg-surface px-3.5 py-2.5"
                        >
                          <summary className="cursor-pointer text-[13px] font-semibold text-ink">
                            {titel}
                          </summary>
                          <dl className="mt-1.5 space-y-2">
                            {BIBLIOTHEK_TEILE.map((teil) => (
                              <div key={teil}>
                                <dt className="font-mono text-[9.5px] uppercase tracking-wider text-muted-2">
                                  {t(`hilfebibliothek.teil.${teil}`)}
                                </dt>
                                <dd
                                  data-hilfe-artikel-teil={teil}
                                  className="mt-0.5 text-[12.5px] leading-relaxed text-text"
                                >
                                  {teile[teil]}
                                </dd>
                              </div>
                            ))}
                          </dl>
                          {/* R-0935 (Nacharbeit 7, Ben): der Sprung in den Anwendungsbereich des
                              Artikels — mit derselben Rollenprüfung wie bei der FAQ darunter. */}
                          {rolle !== null &&
                          artikel.route !== "/hilfe" &&
                          routePathAllows(artikel.route, rolle) ? (
                            <Link
                              to={artikel.route}
                              data-testid={`hilfe-funktion-route-${artikel.id}`}
                              className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-ai hover:opacity-80"
                            >
                              {t("help.openRoute")}
                              <ArrowRight size={13} />
                            </Link>
                          ) : null}
                        </details>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
      ) : null}
      {/* R-0935 / R-0924: DIE SAMMLUNG HÄUFIGER FRAGEN. Eine Frage ist ein natives
          `details`/`summary` — aufklappbar mit Tastatur, ohne eigenen Zustand. Der Sprung in den
          Bereich steht nur, wenn die Rolle aus einer Sitzung stammt UND der Router sie hineinlässt
          (dieselbe Zurückhaltung wie die Einstiegsführung oben, JOB 4022/4358), und nie auf
          `/hilfe` selbst. Ohne Treffer bei laufender Suche steht die Sammlung gar nicht da. */}
      {faqTreffer.length > 0 ? (
        <section data-testid="hilfe-faq" className="mt-6">
          <h2 className="text-[15px] font-semibold text-ink">{t("hilfefaq.titel")}</h2>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
            {t("hilfefaq.untertitel")}
          </p>
          <ul className="mt-3 space-y-2">
            {faqTreffer.map((faq) => (
              <li key={faq.id} data-hilfe-faq={faq.id}>
                <details className="rounded-card border border-hairline bg-surface px-3.5 py-2.5">
                  <summary className="cursor-pointer text-[13px] font-semibold text-ink">
                    {faq.title}
                  </summary>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{faq.body}</p>
                  {rolle !== null && faq.to !== "/hilfe" && routePathAllows(faq.to, rolle) ? (
                    <Link
                      to={faq.to}
                      data-testid={`hilfe-faq-route-${faq.id}`}
                      className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-ai hover:opacity-80"
                    >
                      {t("help.openRoute")}
                      <ArrowRight size={13} />
                    </Link>
                  ) : null}
                </details>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
