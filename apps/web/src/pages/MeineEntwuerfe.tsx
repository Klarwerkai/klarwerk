import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { endpoints } from "../api/endpoints";
import { useDirectory, useDrafts } from "../api/hooks";
import { useSession } from "../app/AuthContext";
import { GuardedLink, useGuardedNavigate } from "../app/NavGuardContext";
import { useToast } from "../app/ToastContext";
import { CaptureDraftList } from "../components/CaptureDraftList";

// ==================================================================================================
// JOB 3503 · ENTWUERFE-MENUEPUNKT — DIE EIGENE ÜBERSICHT DER ENTWÜRFE.
// ==================================================================================================
//
// Pedis Wortlaut (über Codex, 10.09.2026): „eigener sichtbarer Menüpunkt oben in der Topbar, öffnet
// eine eigenständige verständliche Übersicht, genauso aufgebaut wie Bibliothek." Bis hierher steckten
// die Entwürfe hinter einem Aufklapper: im Editor unter „Mehr" → „Entwürfe"
// (`components/erfassen/Blatt.tsx`) und im Arbeitsraum in der zugeklappten Karte „Entwürfe
// fortsetzen" (`pages/Capture.tsx`). Beide Wege bleiben unverändert — diese Seite ergänzt einen
// dritten, sie ersetzt keinen.
//
// „GENAUSO AUFGEBAUT WIE DIE BIBLIOTHEK" ist hier wörtlich genommen, und zwar an ihrem Bau und nicht
// an ihrer Komponente: `pages/Library.tsx` ist eine Hülle um EINE Fläche und trägt bewusst KEINEN
// `PageHeader` — „die Hülle nennt die Seite" (JOB 3063 H4). Genauso hier: den Namen trägt der
// Kopfband-Punkt, der auf dieser Route `aria-current="page"` steht; der Routen-Anker
// `data-testid="page-entwuerfe"` sitzt deshalb an der Fläche selbst. Eine zweite Überschrift
// „Meine Entwürfe" über einer Karte, die schon „Entwürfe fortsetzen" heisst, wäre doppelt gesagt.
//
// DREI DINGE, DIE DIESE SEITE AUSDRÜCKLICH NICHT TUT (Auftrag §3, Pedis Bedingung):
//   · KEIN zweiter Entwurfsspeicher. Sie liest `useDrafts()` — genau die Abfrage, aus der auch der
//     Editor und der Arbeitsraum ihre Liste beziehen, unter demselben Schlüssel `["drafts"]`. Wer
//     hier löscht, sieht es dort; wer dort speichert, sieht es hier.
//   · KEINE zweite Such-, Sortier- oder Löschlogik. Suchfeld, Sortierung, Ersteller-Filter und der
//     bestätigte Löschweg stehen EINMAL in `components/CaptureDraftList.tsx` (Rechenlogik in
//     `lib/draftListView.ts`) und werden von hier UNVERÄNDERT gerufen. Die Merkschlüssel sind
//     dieselben: wer hier nach „Ventil" sucht, findet den Filter im Editor sichtbar wieder.
//   · KEIN zweiter Ort für die Navigation. Der Menüpunkt steht in `app/navigation.ts`, die Route
//     entsteht daraus (`routes.tsx`) — der Kommentar in `shell/KopfbandPunkte.tsx` sagt, warum.
//
// KEIN AUF-/ZUKLAPPEN UND KEINE ZWEITE ÜBERSCHRIFT: dafür trägt `CaptureDraftList` seit diesem
// Auftrag die Darreichung `variant="seite"` — dieselben Zeilen und dieselbe Bedienung wie im
// Arbeitsraum, nur ohne Karten-Rahmen, ohne die Überschrift „Entwürfe fortsetzen" und ohne den
// Aufklapp-Knopf. Eine eigene Seite, die man erst aufklappen muss, wäre genau der Aufklapper, den
// dieser Auftrag ablösen soll.
//
// DIE DREI LAGEN STEHEN HIER UND NICHT IN DER LISTE — dieselbe Aufteilung wie im Editor (JOB 3266
// D1): „lädt", „leer" und „gestört" sind Auskünfte über den ABRUF, und die Liste sieht einen
// gescheiterten Abruf gar nicht (sie bekommt dann keine Entwürfe; ohne Entwürfe rendert sie sich
// selbst nicht).
//
// UND DER BESTAND BLEIBT STEHEN, WENN NUR DIE AUFFRISCHUNG SCHEITERT (REGELN §7): der Fehlersatz
// tritt NEBEN die Liste, nicht an ihre Stelle. Genau so hält es der Editor (`Blatt.tsx`,
// `blatt-entwuerfe-fehler`), und es sind dieselben zwei Textschlüssel — kein zweites Wort für
// dieselbe Störung.
export function MeineEntwuerfe(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const { push } = useToast();
  const qc = useQueryClient();
  const navigate = useGuardedNavigate();
  const drafts = useDrafts();
  const directory = useDirectory();
  const [confirmDiscardId, setConfirmDiscardId] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";
  const bestand = drafts.data ?? [];

  // ================================================================================================
  // LÖSCHEN — DERSELBE ENDPUNKT, DIESELBE QUITTUNG, KEIN DRITTER WEG.
  // ================================================================================================
  // `DELETE /api/drafts/<id>`, danach den Bestand für ungültig erklären: wörtlich der Weg des
  // Arbeitsraums (`Capture.tsx`) und des Editors (`Blatt.tsx`). Was diese beiden zusätzlich tun,
  // gehört ihrem eigenen Zustand: sie räumen den GERADE OFFENEN Entwurf aus Blatt und Adresse. Diese
  // Seite hat keinen offenen Entwurf — hier wäre das eine erfundene Handlung.
  //
  // §4b.5 gilt unverändert: bei einem Fehler bleibt der Eintrag STEHEN (gelöscht ist nur, was der
  // Server bestätigt hat); die Rückfrage geht zu, damit die Zeile wieder bedienbar ist.
  const entwurfLoeschen = useMutation({
    mutationFn: (id: string) => endpoints.drafts.remove(id),
    onSuccess: () => {
      setConfirmDiscardId(null);
      void qc.invalidateQueries({ queryKey: ["drafts"] });
      push("success", t("capture.draftDiscarded"));
    },
    onError: (e: unknown) => {
      setConfirmDiscardId(null);
      push("error", e instanceof Error ? e.message : t("state.error"));
    },
  });

  // Der Weg in den Editor ist der VORHANDENE eine Weg: die Kennung steht in der Adresse, und
  // `Blatt.tsx` lädt sie über `resumeDraftId` (`?draft=…`). Kein zweiter Ladeweg, kein
  // Zwischenzustand, der unterwegs verloren gehen könnte. Über den Ungespeichert-Wächter, weil der
  // Klick diese Seite wirklich verlässt.
  const entwurfOeffnen = (id: string): void => {
    navigate(`/erfassen?draft=${encodeURIComponent(id)}`);
  };

  // ================================================================================================
  // JOB 3668 — DER PAPIERKORB, VON HIER AUS ERREICHBAR.
  // ================================================================================================
  //
  // Pedi am 11.09.2026: *„Ich habe eben alle Entwürfe gelöscht. Nicht einer befindet sich im
  // Papierkorb."* Seit diesem Auftrag legt `DELETE /api/drafts/:id` den Entwurf in den Papierkorb,
  // und hier steht der Weg zurück.
  //
  // DERSELBE SCHLÜSSELSTAMM `["drafts"]` WIE DIE LISTE, und das ist kein Zufall: `invalidateQueries`
  // trifft mit dem Stamm BEIDE Abfragen. Wer löscht, sieht den Entwurf in derselben Bewegung aus der
  // Liste verschwinden und im Papierkorb erscheinen — ohne dass irgendein Aufruf zweimal von Hand
  // für ungültig erklärt werden müsste. Ein eigener, unabhängiger Schlüssel wäre ein zweiter
  // Bestand, der auseinanderlaufen kann.
  //
  // KEINE EIGENEN TEXTE: Die Wörter sind DIESELBEN, die der Papierkorb der Wissensobjekte benutzt
  // (`adm.trash.*`, dreisprachig vorhanden) — genau Pedis Punkt, dass gleiche Funktionen nicht auf
  // jeder Seite anders heissen dürfen. Was heute noch fehlt, steht in der Rückgabe dieses Jobs:
  // `capture.discardDraftQ` sagt weiterhin „Entwurf endgültig löschen?", und das stimmt seit diesem
  // Auftrag nicht mehr — `apps/web/src/i18n.ts` ist dafür kein Zielpfad.
  const papierkorb = useQuery({
    queryKey: ["drafts", "papierkorb"],
    queryFn: () => endpoints.drafts.trash(),
  });
  const geloescht = papierkorb.data ?? [];
  const [confirmPurgeId, setConfirmPurgeId] = useState<string | null>(null);

  const entwurfZurueckholen = useMutation({
    mutationFn: (id: string) => endpoints.drafts.restore(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["drafts"] });
      push("success", t("adm.trash.restored"));
    },
    onError: (e: unknown) => push("error", e instanceof Error ? e.message : t("state.error")),
  });

  // DER ZWEITE GRIFF. Er ist ausdrücklich getrennt vom ersten: erst fragt diese Fläche nach, dann
  // geht der Aufruf hinaus — und der Server prüft zusätzlich, dass der Entwurf wirklich im
  // Papierkorb liegt (`purgeTrashedDraft`). Ein Klick allein kann einen lebenden Entwurf also auf
  // keinem Weg unwiederbringlich entfernen.
  const entwurfEndgueltigLoeschen = useMutation({
    mutationFn: (id: string) => endpoints.drafts.purge(id),
    onSuccess: () => {
      setConfirmPurgeId(null);
      void qc.invalidateQueries({ queryKey: ["drafts"] });
      push("success", t("adm.trash.purged"));
    },
    onError: (e: unknown) => {
      // §4b.5 wie beim Löschen: bei einem Fehler bleibt der Eintrag STEHEN — entfernt ist nur, was
      // der Server bestätigt hat; die Rückfrage geht zu, damit die Zeile wieder bedienbar ist.
      setConfirmPurgeId(null);
      push("error", e instanceof Error ? e.message : t("state.error"));
    },
  });

  const zeitpunkt = (wert: string): string => {
    const datum = new Date(wert);
    return Number.isNaN(datum.getTime())
      ? wert
      : new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(datum);
  };

  // Nie ein erfundener Name: ohne Eintrag im Verzeichnis steht die Kennung da, und ohne bekannten
  // Löschenden steht nur der Zeitpunkt — „unbekannt" ist etwas anderes als „leer".
  const geloeschtVon = (id: string | undefined): string | undefined =>
    id === undefined ? undefined : ((directory.data ?? []).find((e) => e.id === id)?.name ?? id);

  const laedt = drafts.isLoading;
  const gestoert = drafts.isError;
  const leer = bestand.length === 0 && !laedt && !gestoert;

  return (
    <div data-testid="page-entwuerfe" className="pt-6">
      {/* Der wahre Suchraum, bevor gesucht wird — dieselben zwei Sätze wie im Arbeitsraum
          (AUFTRAG-BASIC-u2): die Admin-Ansicht bekommt ihren eigenen, statt einer Behauptung über
          „deine" Entwürfe. Daneben der Weg dorthin, wo validiertes Wissen steht. */}
      {bestand.length > 0 ? (
        <div
          data-testid="entwuerfe-suchraum"
          className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] leading-relaxed text-muted"
        >
          <span>{isAdmin ? t("capture.draftScope.noteAdmin") : t("capture.draftScope.note")}</span>
          <GuardedLink
            to="/bibliothek"
            data-testid="entwuerfe-zur-bibliothek"
            className="inline-flex items-center gap-1 font-semibold text-ink hover:underline"
          >
            {t("capture.draftScope.toLibrary")} <span aria-hidden="true">→</span>
          </GuardedLink>
        </div>
      ) : null}

      {laedt ? (
        <p data-testid="entwuerfe-laedt" className="text-[12.5px] text-muted">
          {t("state.loading")}
        </p>
      ) : null}

      {gestoert ? (
        <p data-testid="entwuerfe-fehler" role="alert" className="text-[12.5px] text-muted">
          {t("state.error")}
          <button
            type="button"
            data-testid="entwuerfe-erneut"
            onClick={() => {
              void drafts.refetch();
            }}
            className="ml-2 font-semibold underline"
          >
            {t("erfassen.erneutVersuchen")}
          </button>
        </p>
      ) : null}

      {leer ? (
        <div data-testid="entwuerfe-leer" className="space-y-2">
          <p className="text-[12.5px] text-muted">{t("erfassen.entwuerfe.keine")}</p>
          {/* Ein Leerzustand ohne Weg ist eine Sackgasse — derselbe Knopf, den die Bibliothek in
              ihrem Leerzustand zeigt (`lib.liste.erfassen`), und dasselbe Ziel. */}
          <GuardedLink
            to="/erfassen"
            data-testid="entwuerfe-leer-erfassen"
            className="inline-flex items-center gap-1 rounded-btn border border-hairline px-2.5 py-1 text-[12.5px] font-semibold text-text hover:bg-hairline-soft"
          >
            {t("lib.liste.erfassen")}
          </GuardedLink>
        </div>
      ) : null}

      <CaptureDraftList
        variant="seite"
        drafts={bestand}
        isAdmin={isAdmin}
        directory={directory.data ?? []}
        // Die Reichweiten-Plakette ist eine ADMIN-Auskunft (mega38 J4) und erscheint nur dort. Sie
        // trägt hier den vorhandenen, dreisprachigen Namen der Reichweite („Alle Ersteller") — der
        // Arbeitsraum schreibt an dieser Stelle eine fest verdrahtete deutsche Zeichenkette
        // (`Capture.tsx`, „Admin-Ansicht: alle Entwürfe"); die abzuschreiben hiesse, einen
        // unübersetzten Text zu vermehren. Den vollen Satz trägt ohnehin der Suchraum-Hinweis oben.
        scopeLabel={t("capture.draftAuthorAll")}
        // Diese Seite kennt weder einen gerade gespeicherten noch einen offenen Entwurf — beides ist
        // Zustand des Editors. Hier `null` zu übergeben ist die ehrliche Auskunft, nicht eine Lücke.
        highlightId={null}
        editingId={null}
        confirmDiscardId={confirmDiscardId}
        onConfirmDiscard={setConfirmDiscardId}
        discardPending={entwurfLoeschen.isPending}
        onDiscard={(id) => entwurfLoeschen.mutate(id)}
        onResume={(d) => entwurfOeffnen(d.id)}
      />

      {/* Der Weg zurück. Er steht UNTER der Liste und nicht neben ihr: der Papierkorb ist die
          Ausnahme, nicht die Hauptsache — und er trägt seine Zahl, damit man ihn nicht öffnen muss,
          um zu sehen, ob etwas drin ist. */}
      <section data-testid="entwuerfe-papierkorb" className="mt-6 border-t border-hairline pt-3">
        {/* KEIN AUFKLAPPER, und das ist eine übernommene Entscheidung und keine eigene: JOB 3503
            hat aus „Meine Entwürfe" einen Ort gemacht, der ohne Handbewegung dasteht, und der
            Wächter dieses Auftrags (`tests/entwuerfe-menuepunkt/kopfband-und-uebersicht.test.tsx`)
            hält es fest. Ein Papierkorb, den man erst aufklappen muss, wäre genau der Aufklapper
            an neuer Stelle — und Pedis Befund war ja, dass er ihn NICHT gefunden hat. */}
        <p
          data-testid="entwuerfe-papierkorb-titel"
          className="text-[12.5px] font-semibold text-ink"
        >
          {t("adm.trash.title")}
          {geloescht.length > 0 ? ` (${geloescht.length})` : ""}
        </p>

        <div className="mt-2">
          {papierkorb.isError ? (
            <p
              data-testid="entwuerfe-papierkorb-fehler"
              role="alert"
              className="text-[12.5px] text-muted"
            >
              {t("state.error")}
              <button
                type="button"
                data-testid="entwuerfe-papierkorb-erneut"
                onClick={() => {
                  void papierkorb.refetch();
                }}
                className="ml-2 font-semibold underline"
              >
                {t("erfassen.erneutVersuchen")}
              </button>
            </p>
          ) : null}

          {/* Der Bestand bleibt STEHEN, wenn nur die Auffrischung scheitert (REGELN §7): die
                Fehlerzeile tritt NEBEN die Liste, nicht an ihre Stelle. */}
          {geloescht.length === 0 && !papierkorb.isLoading && !papierkorb.isError ? (
            <p data-testid="entwuerfe-papierkorb-leer" className="text-[12.5px] text-muted">
              {t("adm.trash.empty")}
            </p>
          ) : null}

          <ul className="space-y-2">
            {geloescht.map((d) => {
              const name = geloeschtVon(d.deletedBy);
              return (
                <li
                  key={d.id}
                  data-testid={`entwuerfe-papierkorb-zeile-${d.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-btn border border-hairline px-2.5 py-1.5 text-[12.5px]"
                >
                  <span className="font-semibold text-text">
                    {d.payload.title?.trim() || t("capture.draftFallbackTitle")}
                  </span>
                  <span className="text-muted">
                    {name === undefined
                      ? zeitpunkt(d.deletedAt)
                      : t("adm.trash.deletedMeta", { name, date: zeitpunkt(d.deletedAt) })}
                  </span>
                  {confirmPurgeId === d.id ? (
                    <span className="ml-auto flex items-center gap-2">
                      <span className="text-muted">{t("adm.trash.purgeQ")}</span>
                      <button
                        type="button"
                        data-testid={`entwuerfe-papierkorb-endgueltig-nein-${d.id}`}
                        onClick={() => setConfirmPurgeId(null)}
                        className="font-semibold underline"
                      >
                        {t("adm.trash.keep")}
                      </button>
                      <button
                        type="button"
                        data-testid={`entwuerfe-papierkorb-endgueltig-ja-${d.id}`}
                        disabled={entwurfEndgueltigLoeschen.isPending}
                        onClick={() => entwurfEndgueltigLoeschen.mutate(d.id)}
                        className="font-semibold text-danger underline disabled:opacity-50"
                      >
                        {t("adm.trash.purge")}
                      </button>
                    </span>
                  ) : (
                    <span className="ml-auto flex items-center gap-3">
                      <button
                        type="button"
                        data-testid={`entwuerfe-papierkorb-zurueck-${d.id}`}
                        disabled={entwurfZurueckholen.isPending}
                        onClick={() => entwurfZurueckholen.mutate(d.id)}
                        className="font-semibold text-ink underline disabled:opacity-50"
                      >
                        {t("adm.trash.restore")}
                      </button>
                      <button
                        type="button"
                        data-testid={`entwuerfe-papierkorb-endgueltig-${d.id}`}
                        onClick={() => setConfirmPurgeId(d.id)}
                        className="font-semibold text-muted underline"
                      >
                        {t("adm.trash.purge")}
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    </div>
  );
}
