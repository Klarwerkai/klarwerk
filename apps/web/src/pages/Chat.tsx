// ================================================================================================
// INTERNER CHAT — `/chat` und `/chat/:id` (produkt:20261007:interner-chat).
// ================================================================================================
//
// Die Seite zeigt nur, was der Server für diese Person freigibt (`chat-routes.ts`): Gespräche nach
// Teilnahme, Space- und Artikelrecht; Verweise, Ausschnitte und Anhänge je Nachricht gegen die
// aktuelle Sichtbarkeit. Sie legt keine eigene Rechteregel an.
//
// SENDESTATUS: Jede Sendung trägt eine Sendekennung. Während sie läuft, steht sie als „Wird
// gesendet …" im Verlauf; scheitert sie, bleibt sie mit Grund und „Erneut senden" stehen. Die
// Wiederholung schickt DIESELBE Kennung — der Server legt dann nichts doppelt an. Offene Sendungen
// überleben den Seitenwechsel innerhalb der App (`ausgang` unten); nach einem Neuladen zählt allein
// der gespeicherte Verlauf des Servers.
//
// KLARA: Ein Entwurf aus Klara liegt nur im Speicher (`api/chat.ts`). Ziel und Text stehen sichtbar
// da; erst „Senden" macht daraus eine Nachricht.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  type ChatKonto,
  type GespraechAnlage,
  type GespraechSicht,
  type GespraechZeile,
  type NachrichtEingabe,
  type NachrichtSicht,
  abonniereKlaraEntwurf,
  chatApi,
  leseKlaraEntwurf,
  neueSendeKennung,
  setzeKlaraEntwurf,
} from "../api/chat";
import { ApiError } from "../api/client";
import { useRole } from "../app/RoleContext";
import { Button, Card, PageHeader, SectionLabel, TextInput } from "../components/ui";

interface Ausgehend {
  eingabe: NachrichtEingabe;
  status: "laeuft" | "fehlgeschlagen";
  grund: string | null;
  am: string;
}

/** Offene Sendungen je Gespräch — überleben den Seitenwechsel innerhalb der App. */
const ausgang = new Map<string, Ausgehend[]>();

const KNOPF_LINK = "text-[12.5px] font-semibold text-brand-text hover:underline";

function fehlergrund(fehler: unknown, t: TFunction): string {
  if (fehler instanceof ApiError) {
    if (fehler.code === "ERWAEHNUNG_OHNE_ZUGANG") {
      return t("chat.fehler.erwaehnung");
    }
    if (fehler.code === "VERWEIS_UNBEKANNT" || fehler.code === "ANHANG_UNBEKANNT") {
      return t("chat.fehler.verweis");
    }
    if (fehler.status === 408 || fehler.status >= 500) {
      return t("chat.fehler.netz");
    }
    return fehler.message || t("chat.fehler.allgemein");
  }
  return t("chat.fehler.netz");
}

function ArtMarke({ g }: { g: GespraechSicht }): JSX.Element {
  const { t } = useTranslation();
  return (
    <span className="inline-flex flex-wrap gap-1 text-[11px]">
      <span
        data-testid="chat-art"
        className="rounded-btn border border-hairline px-1.5 py-0.5 text-muted"
      >
        {t(`chat.art.${g.art}`)}
      </span>
      <span
        data-testid="chat-sichtbarkeit"
        data-sichtbarkeit={g.sichtbarkeit}
        className="rounded-btn bg-page px-1.5 py-0.5 text-muted"
      >
        {t(`chat.sichtbarkeit.${g.sichtbarkeit}`)}
      </span>
    </span>
  );
}

function NeuesGespraech({
  konten,
  ich,
  spaces,
}: {
  konten: ChatKonto[];
  ich: string;
  spaces: { id: string; name: string }[];
}): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [art, setArt] = useState<"direkt" | "gruppe" | "space">("direkt");
  const [person, setPerson] = useState("");
  const [gruppenname, setGruppenname] = useState("");
  const [mitglieder, setMitglieder] = useState<string[]>([]);
  const [spaceId, setSpaceId] = useState("");
  const gruppennameId = useId();
  const andere = konten.filter((k) => k.id !== ich);
  const anlegen = useMutation({
    mutationFn: (eingabe: GespraechAnlage) => chatApi.anlegen(eingabe),
    onSuccess: async (g) => {
      await queryClient.invalidateQueries({ queryKey: ["chat", "liste"] });
      navigate(`/chat/${encodeURIComponent(g.id)}`);
    },
  });
  let eingabe: GespraechAnlage | null = null;
  if (art === "direkt" && person) {
    eingabe = { art, teilnehmer: [person] };
  } else if (art === "gruppe" && gruppenname.trim() && mitglieder.length > 0) {
    eingabe = { art, titel: gruppenname.trim(), teilnehmer: mitglieder };
  } else if (art === "space" && spaceId) {
    eingabe = { art, spaceId };
  }
  return (
    <form
      data-testid="chat-neu"
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (eingabe) {
          anlegen.mutate(eingabe);
        }
      }}
    >
      <SectionLabel>{t("chat.neu.titel")}</SectionLabel>
      <label className="block text-[12.5px] text-muted">
        {t("chat.neu.art")}
        <select
          data-testid="chat-neu-art"
          value={art}
          onChange={(e) => setArt(e.target.value as "direkt" | "gruppe" | "space")}
          className="mt-1 h-9 w-full rounded-input border border-hairline bg-surface px-2 text-sm text-text"
        >
          <option value="direkt">{t("chat.art.direkt")}</option>
          <option value="gruppe">{t("chat.art.gruppe")}</option>
          <option value="space">{t("chat.art.space")}</option>
        </select>
      </label>
      {art === "direkt" ? (
        <label className="block text-[12.5px] text-muted">
          {t("chat.neu.person")}
          <select
            data-testid="chat-neu-person"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            className="mt-1 h-9 w-full rounded-input border border-hairline bg-surface px-2 text-sm text-text"
          >
            <option value="">{t("chat.neu.waehlen")}</option>
            {andere.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {art === "gruppe" ? (
        <>
          <label htmlFor={gruppennameId} className="block text-[12.5px] text-muted">
            {t("chat.neu.gruppenname")}
          </label>
          <TextInput
            id={gruppennameId}
            data-testid="chat-neu-gruppenname"
            value={gruppenname}
            onChange={(e) => setGruppenname(e.target.value)}
            maxLength={80}
          />
          <fieldset className="m-0 border-0 p-0">
            <legend className="text-[12.5px] text-muted">{t("chat.neu.mitglieder")}</legend>
            <ul className="mt-1 max-h-40 space-y-1 overflow-y-auto">
              {andere.map((k) => (
                <li key={k.id}>
                  <label className="flex items-center gap-2 text-[13px] text-text">
                    <input
                      type="checkbox"
                      data-testid="chat-neu-mitglied"
                      data-konto={k.id}
                      checked={mitglieder.includes(k.id)}
                      onChange={(e) =>
                        setMitglieder((alt) =>
                          e.target.checked ? [...alt, k.id] : alt.filter((x) => x !== k.id),
                        )
                      }
                    />
                    {k.name}
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        </>
      ) : null}
      {art === "space" ? (
        spaces.length === 0 ? (
          <p className="text-[12.5px] text-muted-2">{t("chat.neu.keinSpace")}</p>
        ) : (
          <label className="block text-[12.5px] text-muted">
            {t("chat.neu.space")}
            <select
              data-testid="chat-neu-space"
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
              className="mt-1 h-9 w-full rounded-input border border-hairline bg-surface px-2 text-sm text-text"
            >
              <option value="">{t("chat.neu.waehlen")}</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )
      ) : null}
      <Button
        type="submit"
        variant="primary"
        data-testid="chat-neu-oeffnen"
        disabled={!eingabe || anlegen.isPending}
      >
        {t("chat.neu.oeffnen")}
      </Button>
      {anlegen.isError ? (
        <p role="alert" className="text-[12.5px] text-trust-crit-text">
          {fehlergrund(anlegen.error, t)}
        </p>
      ) : null}
    </form>
  );
}

function Erwaehnungen(): JSX.Element {
  const { t, i18n } = useTranslation();
  const abfrage = useQuery({ queryKey: ["chat", "erwaehnungen"], queryFn: chatApi.erwaehnungen });
  const liste = abfrage.data?.erwaehnungen ?? [];
  return (
    <section data-testid="chat-erwaehnungen" className="space-y-1">
      <SectionLabel>{t("chat.erwaehnungen.titel")}</SectionLabel>
      {abfrage.isSuccess && liste.length === 0 ? (
        <p className="text-[12.5px] text-muted-2">{t("chat.erwaehnungen.leer")}</p>
      ) : null}
      <ul className="space-y-1">
        {liste.map((e) => (
          <li key={e.nachrichtId}>
            <Link
              data-testid="chat-erwaehnung"
              data-nachricht={e.nachrichtId}
              to={`/chat/${encodeURIComponent(e.gespraechId)}?nachricht=${encodeURIComponent(e.nachrichtId)}`}
              className="block rounded-btn px-2 py-1 text-[12.5px] text-text hover:bg-hairline-soft"
            >
              <span className="font-semibold">
                {t("chat.erwaehnungen.eintrag", {
                  wer: e.vonName ?? t("chat.nachricht.unbekannt"),
                  gespraech: e.gespraechTitel,
                })}
              </span>
              <span className="block truncate text-muted">{e.auszug}</span>
              <span className="block text-[11px] text-muted-2">
                {new Date(e.am).toLocaleString(i18n.language)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function GespraechsListe({
  gespraeche,
  aktiv,
}: {
  gespraeche: GespraechZeile[];
  aktiv: string | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <section className="space-y-1">
      <SectionLabel>{t("chat.liste.titel")}</SectionLabel>
      {gespraeche.length === 0 ? (
        <p className="text-[12.5px] text-muted-2">{t("chat.liste.leer")}</p>
      ) : null}
      <ul className="space-y-1">
        {gespraeche.map((g) => (
          <li key={g.id}>
            <Link
              data-testid="chat-gespraech-eintrag"
              data-gespraech={g.id}
              data-art={g.art}
              aria-current={g.id === aktiv ? "page" : undefined}
              to={`/chat/${encodeURIComponent(g.id)}`}
              className={
                g.id === aktiv
                  ? "block rounded-btn bg-hairline-soft px-2 py-1.5"
                  : "block rounded-btn px-2 py-1.5 hover:bg-hairline-soft"
              }
            >
              <span className="block truncate text-[13px] font-semibold text-text">{g.titel}</span>
              <ArtMarke g={g} />
              {g.letzte ? (
                <span className="block truncate text-[12px] text-muted">
                  {g.letzte.vonName ? `${g.letzte.vonName}: ` : ""}
                  {g.letzte.text}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AusschnittAnzeige({ n }: { n: NachrichtSicht }): JSX.Element | null {
  const { t } = useTranslation();
  const a = n.ausschnitt;
  if (!a) {
    return null;
  }
  if (!a.sichtbar) {
    return (
      <p data-testid="chat-ausschnitt-gesperrt" className="mt-1 text-[12px] italic text-muted-2">
        {t("chat.nachricht.ausschnittGesperrt")}
      </p>
    );
  }
  let ziel: string | null = null;
  if (a.koId) {
    ziel = `/wissen/${encodeURIComponent(a.koId)}`;
  } else if (a.pfad?.startsWith("/klara-vorschau")) {
    ziel = a.pfad;
  }
  return (
    <figure data-testid="chat-ausschnitt" data-fiktiv={a.fiktiv ? "ja" : "nein"} className="mt-1">
      <blockquote className="border-l-2 border-brand pl-2 text-[12.5px] italic text-text">
        {a.text}
      </blockquote>
      <figcaption className="mt-0.5 text-[11.5px] text-muted">
        {t("chat.nachricht.ausschnitt", { quelle: a.quelle })}
        {a.fassung ? ` · ${t("chat.nachricht.ausschnittFassung", { fassung: a.fassung })}` : ""}
        {a.fiktiv ? ` · ${t("chat.nachricht.ausschnittFiktiv")}` : ""}
        {ziel ? (
          <>
            {" · "}
            <Link data-testid="chat-ausschnitt-quelle" to={ziel} className={KNOPF_LINK}>
              {t("chat.nachricht.zurQuelle")}
            </Link>
          </>
        ) : null}
      </figcaption>
    </figure>
  );
}

function NachrichtInhalt({ n }: { n: NachrichtSicht }): JSX.Element {
  const { t } = useTranslation();
  // Feste Reihenfolge je Nachricht: die Stelle ist der Schlüssel.
  const verweise = n.verweise.map((v, stelle) => ({ v, schluessel: `verweis-${stelle}` }));
  const anhaenge = n.anhaenge.map((a, stelle) => ({ a, schluessel: `anhang-${stelle}` }));
  return (
    <>
      <p
        className="whitespace-pre-wrap break-words text-[13.5px] text-text"
        data-testid="chat-text"
      >
        {n.text}
      </p>
      {n.erwaehnungen.length > 0 ? (
        <p data-testid="chat-erwaehnt" className="mt-1 text-[11.5px] text-muted">
          {t("chat.nachricht.erwaehnt", {
            namen: n.erwaehnungen.map((e) => e.name ?? e.id).join(", "),
          })}
        </p>
      ) : null}
      <AusschnittAnzeige n={n} />
      {verweise.length > 0 ? (
        <ul className="mt-1 space-y-0.5">
          {verweise.map(({ v, schluessel }) =>
            v.sichtbar ? (
              <li key={schluessel}>
                <Link
                  data-testid="chat-verweis"
                  data-ko={v.koId}
                  to={`/wissen/${encodeURIComponent(v.koId)}`}
                  className={KNOPF_LINK}
                >
                  {t("chat.nachricht.verweis", { titel: v.titel, fassung: v.fassung })}
                </Link>
                <span className="block text-[11.5px] text-muted-2">{v.vorschau}</span>
              </li>
            ) : (
              <li
                key={schluessel}
                data-testid="chat-verweis-gesperrt"
                className="text-[12px] text-muted-2"
              >
                {t("chat.nachricht.verweisGesperrt")}
              </li>
            ),
          )}
        </ul>
      ) : null}
      {anhaenge.length > 0 ? (
        <ul className="mt-1 space-y-0.5">
          {anhaenge.map(({ a, schluessel }) =>
            a.sichtbar && a.url.startsWith("/api/objects/") ? (
              <li key={schluessel}>
                <a
                  data-testid="chat-anhang"
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className={KNOPF_LINK}
                >
                  {t("chat.nachricht.anhang", { name: a.name })}
                </a>
              </li>
            ) : (
              <li
                key={schluessel}
                data-testid="chat-anhang-gesperrt"
                className="text-[12px] text-muted-2"
              >
                {t("chat.nachricht.anhangGesperrt")}
              </li>
            ),
          )}
        </ul>
      ) : null}
    </>
  );
}

function WissenKnopf({ n, gespraechId }: { n: NachrichtSicht; gespraechId: string }) {
  const { t } = useTranslation();
  const { role } = useRole();
  const queryClient = useQueryClient();
  const uebernehmen = useMutation({
    mutationFn: () => chatApi.inWissen(n.id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["chat", "gespraech", gespraechId] }),
  });
  const entwurfId = n.eigeneUebernahme?.entwurfId ?? uebernehmen.data?.entwurfId;
  if (entwurfId) {
    return (
      <p data-testid="chat-wissen-erfolgt" className="mt-1 text-[11.5px] text-muted">
        {t("chat.wissen.erfolgt")}
        {" · "}
        <Link
          data-testid="chat-wissen-entwurf"
          to={`/erfassen?draft=${encodeURIComponent(entwurfId)}`}
          className={KNOPF_LINK}
        >
          {t("chat.wissen.oeffnen")}
        </Link>
      </p>
    );
  }
  if (role === "viewer") {
    return null;
  }
  return (
    <div className="mt-1">
      <button
        type="button"
        data-testid="chat-wissen"
        disabled={uebernehmen.isPending}
        onClick={() => uebernehmen.mutate()}
        className="text-[11.5px] font-semibold text-brand-text hover:underline disabled:opacity-60"
      >
        {uebernehmen.isPending ? t("chat.wissen.laeuft") : t("chat.wissen.knopf")}
      </button>
      {uebernehmen.isError ? (
        <span role="alert" className="ml-2 text-[11.5px] text-trust-crit-text">
          {t("chat.wissen.fehler")}
        </span>
      ) : null}
    </div>
  );
}

function Verfasser({ n }: { n: NachrichtSicht }): JSX.Element {
  const { t, i18n } = useTranslation();
  return (
    <p className="text-[11.5px] text-muted">
      <span className="font-semibold text-text">
        {n.eigene ? t("chat.nachricht.ich") : (n.vonName ?? t("chat.nachricht.unbekannt"))}
      </span>
      {" · "}
      {new Date(n.am).toLocaleString(i18n.language)}
      {n.ausKlara ? (
        <span data-testid="chat-aus-klara">{` · ${t("chat.nachricht.ausKlara")}`}</span>
      ) : null}
    </p>
  );
}

function Verfassen({
  g,
  konten,
  ich,
  onSenden,
}: {
  g: GespraechSicht;
  konten: ChatKonto[];
  ich: string;
  onSenden: (eingabe: NachrichtEingabe) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [erwaehnt, setErwaehnt] = useState<string[]>([]);
  const [anhaenge, setAnhaenge] = useState<string[]>([]);
  const waehlbar = (
    g.art === "direkt" || g.art === "gruppe"
      ? konten.filter((k) => g.teilnehmer.some((p) => p.id === k.id))
      : konten
  ).filter((k) => k.id !== ich && !erwaehnt.includes(k.id));
  const name = (id: string): string => konten.find((k) => k.id === id)?.name ?? id;
  return (
    <form
      data-testid="chat-verfassen"
      className="mt-3 space-y-2 border-t border-hairline pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        const inhalt = text.trim();
        if (!inhalt) {
          return;
        }
        const artikel = g.artikel;
        onSenden({
          text: inhalt,
          sendeKennung: neueSendeKennung(),
          erwaehnungen: erwaehnt,
          anhaenge: artikel ? anhaenge.map((anhangId) => ({ koId: artikel.koId, anhangId })) : [],
        });
        setText("");
        setErwaehnt([]);
        setAnhaenge([]);
      }}
    >
      <label className="block text-[12.5px] text-muted">
        {t("chat.eingabe.label")}
        <textarea
          data-testid="chat-eingabe"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("chat.eingabe.platzhalter")}
          rows={3}
          maxLength={4000}
          className="mt-1 w-full rounded-input border border-hairline bg-surface px-3 py-2 text-sm text-text"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[12px] text-muted">
          <span className="sr-only">{t("chat.eingabe.erwaehnen")}</span>
          <select
            data-testid="chat-erwaehnen"
            value=""
            onChange={(e) => {
              const id = e.target.value;
              if (id) {
                setErwaehnt((alt) => [...alt, id]);
                setText((alt) => `${alt}${alt && !alt.endsWith(" ") ? " " : ""}@${name(id)} `);
              }
            }}
            className="h-8 rounded-input border border-hairline bg-surface px-2 text-[12.5px] text-text"
          >
            <option value="">{t("chat.eingabe.erwaehnenWaehlen")}</option>
            {waehlbar.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </select>
        </label>
        {erwaehnt.map((id) => (
          <button
            key={id}
            type="button"
            data-testid="chat-erwaehnt-chip"
            aria-label={t("chat.eingabe.entfernen", { name: name(id) })}
            onClick={() => setErwaehnt((alt) => alt.filter((x) => x !== id))}
            className="rounded-btn bg-page px-2 py-0.5 text-[12px] text-text"
          >
            @{name(id)} ×
          </button>
        ))}
      </div>
      {g.artikel && g.artikel.anhaenge.length > 0 ? (
        <fieldset className="m-0 border-0 p-0">
          <legend className="text-[12px] text-muted">{t("chat.eingabe.anhaenge")}</legend>
          {g.artikel.anhaenge.map((a) => (
            <label key={a.id} className="mr-3 inline-flex items-center gap-1 text-[12.5px]">
              <input
                type="checkbox"
                data-testid="chat-anhang-waehlen"
                checked={anhaenge.includes(a.id)}
                onChange={(e) =>
                  setAnhaenge((alt) =>
                    e.target.checked ? [...alt, a.id] : alt.filter((x) => x !== a.id),
                  )
                }
              />
              {a.name}
            </label>
          ))}
        </fieldset>
      ) : null}
      <p className="text-[11.5px] text-muted-2">{t("chat.eingabe.hinweisLinks")}</p>
      <Button type="submit" variant="primary" data-testid="chat-senden" disabled={!text.trim()}>
        {t("chat.eingabe.senden")}
      </Button>
    </form>
  );
}

function NachrichtZeile({
  n,
  hervor,
  gespraechId,
}: {
  n: NachrichtSicht;
  hervor: string | null;
  gespraechId: string;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <li
      tabIndex={-1}
      data-testid="chat-nachricht"
      data-nachricht={n.id}
      data-status={n.eigene ? "gesendet" : "empfangen"}
      data-hervorgehoben={hervor === n.id ? "ja" : "nein"}
      className={
        hervor === n.id
          ? "rounded-card border border-brand bg-page px-3 py-2 outline-none"
          : "rounded-card border border-hairline px-3 py-2 outline-none"
      }
    >
      <Verfasser n={n} />
      <NachrichtInhalt n={n} />
      {n.eigene ? (
        <p data-testid="chat-status" className="mt-1 text-[11px] text-muted-2">
          {t("chat.status.gesendet")}
        </p>
      ) : null}
      <WissenKnopf n={n} gespraechId={gespraechId} />
    </li>
  );
}

/** Führt Verlaufsstücke zusammen: jede Nachricht einmal, die jüngere Fassung gewinnt, nach Zeit. */
function zusammenfuehren(
  alt: readonly NachrichtSicht[],
  neu: readonly NachrichtSicht[],
): NachrichtSicht[] {
  const nachId = new Map<string, NachrichtSicht>();
  for (const n of alt) {
    nachId.set(n.id, n);
  }
  for (const n of neu) {
    nachId.set(n.id, n);
  }
  return [...nachId.values()].sort((a, b) => a.am.localeCompare(b.am) || a.id.localeCompare(b.id));
}

function GespraechAnsicht({
  id,
  konten,
  ich,
}: {
  id: string;
  konten: ChatKonto[];
  ich: string;
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [parameter] = useSearchParams();
  const hervor = parameter.get("nachricht");
  const [offen, setOffenRoh] = useState<Ausgehend[]>(() => ausgang.get(id) ?? []);
  const abfrage = useQuery({
    queryKey: ["chat", "gespraech", id],
    queryFn: () => chatApi.gespraech(id),
    // Kein Push-Kanal: neue Nachrichten anderer kommen über regelmäßiges Nachladen.
    refetchInterval: 5_000,
  });

  const setOffen = (f: (alt: Ausgehend[]) => Ausgehend[]): void => {
    setOffenRoh((alt) => {
      const neu = f(alt);
      ausgang.set(id, neu);
      return neu;
    });
  };

  const senden = async (eingabe: NachrichtEingabe): Promise<void> => {
    const kennung = eingabe.sendeKennung;
    setOffen((alt) => [
      ...alt.filter((a) => a.eingabe.sendeKennung !== kennung),
      { eingabe, status: "laeuft", grund: null, am: new Date().toISOString() },
    ]);
    try {
      await chatApi.senden(id, eingabe);
      await queryClient.invalidateQueries({ queryKey: ["chat", "gespraech", id] });
      setOffen((alt) => alt.filter((a) => a.eingabe.sendeKennung !== kennung));
      void queryClient.invalidateQueries({ queryKey: ["chat", "liste"] });
    } catch (fehler) {
      const grund = fehlergrund(fehler, t);
      setOffen((alt) =>
        alt.map((a) =>
          a.eingabe.sendeKennung === kennung ? { ...a, status: "fehlgeschlagen", grund } : a,
        ),
      );
    }
  };

  // Nacharbeit 3 (Ben, K2/K3): der Server liefert die jüngsten Nachrichten und sagt, ob es Älteres
  // gibt. Ältere Seiten werden auf Wunsch nachgeladen und bleiben hier gesammelt — samt der Seite,
  // die beim Nachladen zu sehen war, damit beim Eintreffen neuer Nachrichten keine Lücke entsteht.
  const [frueher, setFrueher] = useState<NachrichtSicht[]>([]);
  const [frueherNoch, setFrueherNoch] = useState<boolean | null>(null);
  const [laedtFrueher, setLaedtFrueher] = useState(false);
  const [frueherFehler, setFrueherFehler] = useState(false);
  const daten = abfrage.data;
  // Nacharbeit 6 (Ben, K4): die schon angezeigten älteren Nachrichten werden im selben Takt wie die
  // jüngste Seite neu gegen die Rechte gehalten. Angezeigt wird immer die JÜNGSTE Antwort des
  // Servers; was er nicht mehr liefert, fällt weg. Scheitert die Prüfung, bleiben die älteren
  // Nachrichten ausgeblendet, statt alte Inhaltsansichten weiter zu zeigen.
  const frueherIds = useMemo(() => frueher.map((n) => n.id), [frueher]);
  const auffrischung = useQuery({
    queryKey: ["chat", "frueher", id, frueherIds.join(",")],
    queryFn: async () => {
      const raus: NachrichtSicht[] = [];
      for (let i = 0; i < frueherIds.length; i += 500) {
        const teil = await chatApi.auffrischen(id, frueherIds.slice(i, i + 500));
        raus.push(...teil.nachrichten);
      }
      return raus;
    },
    enabled: frueherIds.length > 0,
    refetchInterval: 5_000,
    retry: false,
  });
  const frueherSicht = auffrischung.isError ? [] : (auffrischung.data ?? frueher);
  const verlauf = useMemo(
    () => zusammenfuehren(frueherSicht, daten?.nachrichten ?? []),
    [frueherSicht, daten],
  );
  const zielImVerlauf = hervor ? verlauf.some((n) => n.id === hervor) : true;
  // Die Zielnachricht einer Erwähnung wird EIGENS geladen, wenn sie nicht im gezeigten Verlauf
  // steht — gleich, wie viele neuere Nachrichten seither kamen. Dieselbe Leseregel am Server, und
  // dieselbe regelmäßige Neuprüfung wie der Verlauf (Nacharbeit 6).
  const ziel = useQuery({
    queryKey: ["chat", "nachricht", hervor],
    queryFn: () => chatApi.nachricht(hervor ?? ""),
    enabled: Boolean(hervor) && Boolean(daten) && !zielImVerlauf,
    refetchInterval: 5_000,
    retry: false,
  });
  // Scheitert die Neuprüfung, wird die alte Ansicht NICHT weiter gezeigt.
  const zielDaten = ziel.isError ? undefined : ziel.data;
  useEffect(() => {
    if (!hervor || (!daten && !zielDaten)) {
      return;
    }
    // Nur die Nachricht im Verlauf oder im Zielblock — nicht der gleichnamige Erwähnungslink.
    const el = document.querySelector<HTMLElement>(
      `[data-testid="chat-nachricht"][data-nachricht="${CSS.escape(hervor)}"]`,
    );
    el?.scrollIntoView({ block: "center" });
    el?.focus();
  }, [hervor, daten, zielDaten]);

  const frueherLaden = async (): Promise<void> => {
    const aelteste = verlauf[0];
    if (!aelteste || !daten) {
      return;
    }
    setLaedtFrueher(true);
    setFrueherFehler(false);
    try {
      const seite = await chatApi.aeltere(id, aelteste.id);
      // Ausgangspunkt ist die zuletzt GEPRÜFTE Ansicht, nicht der Stand des ersten Nachladens.
      const bisher = zusammenfuehren(frueherSicht, daten.nachrichten);
      setFrueher(zusammenfuehren(bisher, seite.nachrichten));
      setFrueherNoch(seite.aelterVorhanden);
    } catch {
      setFrueherFehler(true);
    } finally {
      setLaedtFrueher(false);
    }
  };

  if (abfrage.isPending) {
    return <p className="text-sm text-muted">{t("chat.seite.laedt")}</p>;
  }
  if (abfrage.isError) {
    return (
      <p role="alert" data-testid="chat-nicht-gefunden" className="text-sm text-muted">
        {t("chat.seite.fehler")}
      </p>
    );
  }
  const g = abfrage.data.gespraech;
  const nachrichten = verlauf;
  const aelterVorhanden = frueherNoch ?? abfrage.data.aelterVorhanden;
  const gespeichert = new Set(nachrichten.map((n) => n.sendeKennung).filter(Boolean));
  const ausstehend = offen.filter((a) => !gespeichert.has(a.eingabe.sendeKennung));
  return (
    <div data-testid="chat-gespraech" data-gespraech={g.id} data-art={g.art}>
      <header className="mb-3 border-b border-hairline pb-2">
        <h2 data-testid="chat-gespraech-titel" className="text-[16px] font-semibold text-ink">
          {g.titel}
        </h2>
        <ArtMarke g={g} />
        {g.art === "gruppe" || g.art === "direkt" ? (
          <p data-testid="chat-teilnehmer" className="mt-1 text-[12px] text-muted">
            {t("chat.gespraech.teilnehmer", {
              namen: g.teilnehmer.map((p) => p.name ?? p.id).join(", "),
            })}
          </p>
        ) : null}
        {g.artikel ? (
          <Link
            data-testid="chat-artikel-ruecklink"
            data-ko={g.artikel.koId}
            to={`/wissen/${encodeURIComponent(g.artikel.koId)}`}
            className={`mt-1 block ${KNOPF_LINK}`}
          >
            {t("chat.gespraech.zumArtikel", {
              titel: g.artikel.titel,
              fassung: g.artikel.fassung,
            })}
          </Link>
        ) : null}
        {g.space ? (
          <Link
            data-testid="chat-space-ruecklink"
            to={`/spaces/${encodeURIComponent(g.space.id)}`}
            className={`mt-1 block ${KNOPF_LINK}`}
          >
            {t("chat.gespraech.zumSpace", { name: g.space.name })}
          </Link>
        ) : null}
      </header>
      {nachrichten.length === 0 && ausstehend.length === 0 ? (
        <p className="text-[12.5px] text-muted-2">{t("chat.gespraech.leer")}</p>
      ) : null}
      {hervor && !zielImVerlauf ? (
        <section data-testid="chat-ziel" className="mb-3">
          <SectionLabel>{t("chat.ziel.titel")}</SectionLabel>
          {ziel.isPending ? (
            <p className="text-[12.5px] text-muted">{t("chat.seite.laedt")}</p>
          ) : null}
          {zielDaten ? (
            <ol className="space-y-2">
              <NachrichtZeile n={zielDaten.nachricht} hervor={hervor} gespraechId={g.id} />
            </ol>
          ) : null}
          {ziel.isError ? (
            <p role="alert" data-testid="chat-ziel-fehlt" className="text-[12.5px] text-muted">
              {t("chat.ziel.fehlt")}
            </p>
          ) : null}
        </section>
      ) : null}
      {aelterVorhanden ? (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Button
            data-testid="chat-aeltere"
            disabled={laedtFrueher}
            onClick={() => void frueherLaden()}
          >
            {laedtFrueher ? t("chat.seite.laedt") : t("chat.verlauf.aeltere")}
          </Button>
          {frueherFehler ? (
            <span role="alert" className="text-[12px] text-trust-crit-text">
              {t("chat.fehler.allgemein")}
            </span>
          ) : null}
        </div>
      ) : null}
      {auffrischung.isError ? (
        <p role="alert" data-testid="chat-frueher-fehler" className="mb-2 text-[12px] text-muted">
          {t("chat.verlauf.auffrischenFehler")}
        </p>
      ) : null}
      <ol data-testid="chat-verlauf" className="space-y-2">
        {nachrichten.map((n) => (
          <NachrichtZeile key={n.id} n={n} hervor={hervor} gespraechId={g.id} />
        ))}
        {ausstehend.map((a) => (
          <li
            key={a.eingabe.sendeKennung}
            data-testid="chat-nachricht"
            data-status={a.status === "laeuft" ? "wird-gesendet" : "fehlgeschlagen"}
            className="rounded-card border border-dashed border-hairline px-3 py-2"
          >
            <p className="text-[11.5px] text-muted">
              <span className="font-semibold text-text">{t("chat.nachricht.ich")}</span>
              {" · "}
              {new Date(a.am).toLocaleString(i18n.language)}
            </p>
            <p className="whitespace-pre-wrap break-words text-[13.5px] text-text">
              {a.eingabe.text}
            </p>
            {a.status === "laeuft" ? (
              <p data-testid="chat-status" className="mt-1 text-[11px] text-muted-2">
                {t("chat.status.laeuft")}
              </p>
            ) : (
              <div role="alert" className="mt-1 flex flex-wrap items-center gap-2">
                <span data-testid="chat-status" className="text-[12px] text-trust-crit-text">
                  {t("chat.status.fehlgeschlagen", { grund: a.grund ?? "" })}
                </span>
                <Button data-testid="chat-erneut" onClick={() => void senden(a.eingabe)}>
                  {t("chat.status.erneut")}
                </Button>
                <Button
                  variant="ghost"
                  data-testid="chat-verwerfen"
                  onClick={() =>
                    setOffen((alt) =>
                      alt.filter((x) => x.eingabe.sendeKennung !== a.eingabe.sendeKennung),
                    )
                  }
                >
                  {t("chat.status.verwerfen")}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ol>
      <Verfassen g={g} konten={konten} ich={ich} onSenden={(e) => void senden(e)} />
    </div>
  );
}

function KlaraEntwurf({
  gespraeche,
  aktiv,
}: {
  gespraeche: GespraechZeile[];
  aktiv: string | undefined;
}): JSX.Element | null {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const entwurf = useSyncExternalStore(abonniereKlaraEntwurf, leseKlaraEntwurf);
  const [ziel, setZiel] = useState(aktiv ?? "");
  const [text, setText] = useState<string | null>(null);
  const [kennung, setKennung] = useState(() => neueSendeKennung());
  const [lage, setLage] = useState<{ status: "ruhe" | "laeuft" | "fehler"; grund: string }>({
    status: "ruhe",
    grund: "",
  });
  useEffect(() => {
    if (aktiv) {
      setZiel(aktiv);
    }
  }, [aktiv]);
  if (!entwurf) {
    return null;
  }
  const a = entwurf.ausschnitt;
  const inhalt = text ?? t("chat.klara.vorschlag", { quelle: a.quelle });
  const gewaehlt = gespraeche.find((g) => g.id === ziel);
  const senden = async (): Promise<void> => {
    if (!gewaehlt || !inhalt.trim()) {
      return;
    }
    setLage({ status: "laeuft", grund: "" });
    try {
      await chatApi.senden(gewaehlt.id, {
        text: inhalt.trim(),
        sendeKennung: kennung,
        erwaehnungen: [],
        anhaenge: [],
        ausschnitt: a,
        ausKlara: true,
      });
      setzeKlaraEntwurf(null);
      setText(null);
      setKennung(neueSendeKennung());
      setLage({ status: "ruhe", grund: "" });
      await queryClient.invalidateQueries({ queryKey: ["chat"] });
      navigate(`/chat/${encodeURIComponent(gewaehlt.id)}`);
    } catch (fehler) {
      // Dieselbe Kennung bleibt stehen — „Erneut senden" dupliziert nicht.
      setLage({ status: "fehler", grund: fehlergrund(fehler, t) });
    }
  };
  return (
    <Card className="mb-4" data-testid="chat-klara-entwurf">
      <SectionLabel>{t("chat.klara.titel")}</SectionLabel>
      <p className="mb-2 text-[12.5px] text-muted">{t("chat.klara.hinweis")}</p>
      <label className="block text-[12.5px] text-muted">
        {t("chat.klara.ziel")}
        <select
          data-testid="chat-klara-ziel"
          value={ziel}
          onChange={(e) => setZiel(e.target.value)}
          className="mt-1 h-9 w-full rounded-input border border-hairline bg-surface px-2 text-sm text-text"
        >
          <option value="">{t("chat.klara.zielWaehlen")}</option>
          {gespraeche.map((g) => (
            <option key={g.id} value={g.id}>
              {`${g.titel} (${t(`chat.art.${g.art}`)})`}
            </option>
          ))}
        </select>
      </label>
      {gespraeche.length === 0 ? (
        <p className="mt-1 text-[12px] text-muted-2">{t("chat.klara.keinZiel")}</p>
      ) : null}
      <p data-testid="chat-klara-empfaenger" className="mt-2 text-[13px] font-semibold text-text">
        {gewaehlt
          ? t("chat.klara.empfaenger", {
              titel: gewaehlt.titel,
              art: t(`chat.art.${gewaehlt.art}`),
              sichtbarkeit: t(`chat.sichtbarkeit.${gewaehlt.sichtbarkeit}`),
            })
          : t("chat.klara.keinEmpfaenger")}
      </p>
      <label className="mt-2 block text-[12.5px] text-muted">
        {t("chat.klara.text")}
        <textarea
          data-testid="chat-klara-text"
          value={inhalt}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={4000}
          className="mt-1 w-full rounded-input border border-hairline bg-surface px-3 py-2 text-sm text-text"
        />
      </label>
      <figure data-testid="chat-klara-ausschnitt" className="mt-2">
        <blockquote className="border-l-2 border-brand pl-2 text-[12.5px] italic text-text">
          {a.text}
        </blockquote>
        <figcaption className="mt-0.5 text-[11.5px] text-muted">
          {t("chat.nachricht.ausschnitt", { quelle: a.quelle })}
          {a.fiktiv ? ` · ${t("chat.nachricht.ausschnittFiktiv")}` : ""}
        </figcaption>
      </figure>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          data-testid="chat-klara-senden"
          disabled={!gewaehlt || !inhalt.trim() || lage.status === "laeuft"}
          onClick={() => void senden()}
        >
          {lage.status === "fehler" ? t("chat.klara.erneut") : t("chat.klara.senden")}
        </Button>
        <Button
          variant="ghost"
          data-testid="chat-klara-verwerfen"
          onClick={() => {
            setzeKlaraEntwurf(null);
            setText(null);
            setLage({ status: "ruhe", grund: "" });
          }}
        >
          {t("chat.klara.verwerfen")}
        </Button>
        {lage.status === "laeuft" ? (
          <span className="text-[12px] text-muted">{t("chat.klara.laeuft")}</span>
        ) : null}
        {lage.status === "fehler" ? (
          <span
            role="alert"
            data-testid="chat-klara-fehler"
            className="text-[12px] text-trust-crit-text"
          >
            {t("chat.klara.fehler", { grund: lage.grund })}
          </span>
        ) : null}
      </div>
    </Card>
  );
}

export function Chat(): JSX.Element {
  const { t } = useTranslation();
  const { id } = useParams<{ id?: string }>();
  const konten = useQuery({ queryKey: ["chat", "konten"], queryFn: chatApi.konten });
  const liste = useQuery({
    queryKey: ["chat", "liste"],
    queryFn: chatApi.liste,
    refetchInterval: 15_000,
  });
  const gespraeche = useMemo(() => liste.data?.gespraeche ?? [], [liste.data]);
  const ich = konten.data?.ich ?? "";
  return (
    // `page-chat` setzt der Seitenkopf selbst (`PageHeader pageKey`), die Hülle trägt keinen zweiten.
    <div data-testid="chat-seite">
      <PageHeader
        pageKey="chat"
        kicker={t("chat.seite.titel")}
        title={t("chat.seite.titel")}
        lead={t("chat.seite.lead")}
        actions={
          id ? (
            <Link to="/chat" className={KNOPF_LINK}>
              {t("chat.seite.zurueck")}
            </Link>
          ) : undefined
        }
      />
      <KlaraEntwurf gespraeche={gespraeche} aktiv={id} />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="space-y-4">
          {liste.isPending ? <p className="text-sm text-muted">{t("chat.seite.laedt")}</p> : null}
          {liste.isError ? (
            <p role="alert" className="text-sm text-trust-crit-text">
              {t("chat.fehler.allgemein")}
            </p>
          ) : null}
          <GespraechsListe gespraeche={gespraeche} aktiv={id} />
          <Erwaehnungen />
          {konten.data ? (
            <NeuesGespraech
              konten={konten.data.konten}
              ich={ich}
              spaces={liste.data?.spaces ?? []}
            />
          ) : null}
        </Card>
        <Card>
          {id ? (
            <GespraechAnsicht key={id} id={id} konten={konten.data?.konten ?? []} ich={ich} />
          ) : (
            <p className="text-[13px] text-muted">{t("chat.gespraech.waehlen")}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
