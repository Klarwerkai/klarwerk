import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../api/client";
import { endpoints } from "../../api/endpoints";
import { type RegelVorschau, type Regelstand, klaraWissenApi } from "../../api/klaraWissen";
import { useSession } from "../../app/AuthContext";
import { useAssistenzT } from "../../lib/assistenzProfil";
import { gespeicherteFassungHref } from "../../lib/objektbezug";
import { anfrageEpoche, aufRechtekontextwechsel } from "../../lib/rechtekontext";
import { Button, Field, TextInput } from "../ui";

interface RegelProps {
  id: string;
  fassung: number;
  notiztext: string;
  geaendert: boolean;
}
export function KlaraRegelvorschlag(props: RegelProps) {
  const { user } = useSession();
  const epoche = useSyncExternalStore(aufRechtekontextwechsel, anfrageEpoche, anfrageEpoche);
  return (
    <Auswahl
      key={JSON.stringify([props.id, props.fassung, user?.id, epoche])}
      {...props}
      konto={user?.id ?? ""}
      epoche={epoche}
    />
  );
}
function Auswahl({
  id,
  fassung,
  notiztext,
  geaendert,
  konto,
  epoche,
}: RegelProps & { konto: string; epoche: number }) {
  const { t } = useAssistenzT();
  const client = useQueryClient();
  const [suche, setSuche] = useState("");
  const [ziel, setZiel] = useState<{
    id: string;
    version: number;
    title: string;
    statement: string;
  } | null>(null);
  const [auszug, setAuszug] = useState("");
  const [aussage, setAussage] = useState("");
  const [vorschau, setVorschau] = useState<RegelVorschau | null>(null);
  const [ergebnis, setErgebnis] = useState("");
  const [fehler, setFehler] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const markierung = useRef<HTMLTextAreaElement>(null);
  const treffer = useQuery({
    queryKey: ["klara-regelziel", konto, epoche, suche.trim()],
    queryFn: () => endpoints.library.search({ q: suche.trim(), status: "validiert" }),
    enabled: suche.trim().length >= 2 && !ziel && Boolean(konto),
  });

  async function weiter() {
    if (!ziel || laeuft || geaendert) return;
    setLaeuft(true);
    setFehler("");
    try {
      if (vorschau) {
        const r = await klaraWissenApi.regelEinreichen(id, fassung, vorschau);
        setErgebnis(r.koId);
        void client.invalidateQueries({ queryKey: ["klara-beitragsstand", konto, id] });
      } else {
        setVorschau(
          await klaraWissenApi.regelVorschau(id, fassung, {
            koId: ziel.id,
            basis: ziel.version,
            auszug,
            aussage,
          }),
        );
      }
    } catch (e) {
      setVorschau(null);
      setFehler(
        e instanceof ApiError && e.status === 409
          ? "klarawissen.regel.veraltet"
          : "klarawissen.regel.fehler",
      );
      if (e instanceof ApiError && [403, 404, 409].includes(e.status)) {
        setZiel(null);
        void treffer.refetch();
      }
    } finally {
      setLaeuft(false);
    }
  }
  if (ergebnis)
    return (
      <output>
        {t("klarawissen.regel.fertig")}{" "}
        <Link className="underline" to={`/wissen/${encodeURIComponent(ergebnis)}`}>
          {t("klarawissen.regel.oeffnen")}
        </Link>
      </output>
    );
  return (
    <fieldset disabled={geaendert || laeuft} className="space-y-2">
      {vorschau ? (
        <div className="space-y-2 rounded-card border border-hairline bg-page p-3">
          <p className="font-semibold">
            {vorschau.titel} · v{vorschau.basis}
          </p>
          <p>
            {vorschau.space ?? t("klarawissen.regel.bibliothek")} ·{" "}
            {t(`klarawissen.${vorschau.stufe}`)}
          </p>
          <p>{t("klarawissen.regel.bisher")}</p>
          <blockquote>{vorschau.bisher}</blockquote>
          <p>{t("klarawissen.regel.neu")}</p>
          <blockquote>{vorschau.aussage}</blockquote>
          <p>{t("klarawissen.regel.quellfassung", { n: fassung })}</p>
          <blockquote>{vorschau.auszug}</blockquote>
          <Button type="button" onClick={() => setVorschau(null)}>
            {t("klarawissen.regel.bearbeiten")}
          </Button>
        </div>
      ) : (
        <>
          <Field label={t("klarawissen.regel.suchen")}>
            <TextInput
              value={suche}
              onChange={(e) => {
                setSuche(e.target.value);
                setZiel(null);
                setFehler("");
              }}
            />
          </Field>
          {treffer.isError && !ziel ? <p role="alert">{t("klarawissen.regel.fehler")}</p> : null}
          {!ziel && suche.trim().length >= 2 && treffer.data?.length === 0 ? (
            <p>{t("klarawissen.regel.leer")}</p>
          ) : null}
          {!ziel && suche.trim().length >= 2
            ? treffer.data?.map((k) => (
                <Button type="button" key={k.id} onClick={() => setZiel(k)}>
                  {k.title} · v{k.version}
                </Button>
              ))
            : null}
          {ziel ? (
            <>
              <p className="font-semibold">
                {ziel.title} · v{ziel.version}
              </p>
              <p>
                {t("klarawissen.regel.bisher")} {ziel.statement}
              </p>
              <Field label={t("klarawissen.regel.markieren")}>
                <textarea ref={markierung} value={notiztext} readOnly className="w-full" rows={4} />
              </Field>
              <Button
                type="button"
                onClick={() => {
                  const el = markierung.current;
                  if (!el) return;
                  const teil = notiztext.slice(el.selectionStart, el.selectionEnd).trim();
                  if (teil.length === 0 || teil.length > 4000) {
                    setFehler("klarawissen.regel.auszugfehlt");
                    return;
                  }
                  setAuszug(teil);
                  if (!aussage) setAussage(teil);
                  setFehler("");
                }}
              >
                {t("klarawissen.regel.auswaehlen")}
              </Button>
              <Field label={t("klarawissen.regel.beleg")}>
                <textarea
                  value={auszug}
                  onChange={(e) => setAuszug(e.target.value)}
                  maxLength={4000}
                  className="w-full"
                  rows={2}
                />
              </Field>
              <Field label={t("klarawissen.regel.neu")}>
                <textarea
                  value={aussage}
                  onChange={(e) => setAussage(e.target.value)}
                  maxLength={4000}
                  className="w-full"
                  rows={3}
                />
              </Field>
            </>
          ) : null}
        </>
      )}
      {ziel ? <p className="text-sm text-muted">{t("klarawissen.regel.publikum")}</p> : null}
      {fehler ? <p role="alert">{t(fehler)}</p> : null}
      {ziel ? (
        <Button
          type="button"
          disabled={
            !auszug.trim() ||
            !notiztext.includes(auszug.trim()) ||
            !aussage.trim() ||
            aussage.trim() === ziel.statement.trim()
          }
          onClick={() => void weiter()}
        >
          {t(vorschau ? "klarawissen.regel.einreichen" : "klarawissen.vorschau")}
        </Button>
      ) : null}
    </fieldset>
  );
}

export function KlaraRegelstaende({ staende }: { staende: Regelstand[] }) {
  const { t } = useAssistenzT();
  if (!staende.length) return null;
  return (
    <section aria-label={t("klarawissen.regel.urteile")}>
      <h5 className="font-semibold">{t("klarawissen.regel.urteile")}</h5>
      <ul className="space-y-2">
        {staende.map((s) => (
          <li
            key={
              s.stand === "nicht_verfuegbar"
                ? `privat-${s.notizFassung}`
                : `${s.koId}-${s.basis}-${s.notizFassung}`
            }
          >
            {s.stand === "nicht_verfuegbar" ? (
              t("klarawissen.regel.nicht_verfuegbar")
            ) : (
              <>
                <Link
                  className="underline"
                  to={
                    s.ergebnisVersion
                      ? gespeicherteFassungHref(s.koId, s.ergebnisVersion)
                      : `/wissen/${encodeURIComponent(s.koId)}`
                  }
                >
                  {s.titel}
                </Link>
                <p>
                  {t(`klarawissen.regel.stand.${s.stand}`)} ·{" "}
                  {t("klarawissen.regel.basis", { n: s.basis })}
                  {s.ergebnisVersion ? ` → v${s.ergebnisVersion}` : ""}
                </p>
                {s.stand === "uebernommen" &&
                s.ergebnisVersion !== undefined &&
                s.aktuelleVersion > s.ergebnisVersion &&
                s.aktuelleVersionFreigegeben ? (
                  <Link
                    className="block underline"
                    to={gespeicherteFassungHref(s.koId, s.aktuelleVersion)}
                  >
                    {t("klarawissen.regel.aktuellFreigegeben", { n: s.aktuelleVersion })}
                  </Link>
                ) : null}
                {s.grund ? <p>{s.grund}</p> : null}
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
