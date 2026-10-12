// produkt:20261007:interner-chat — der Weg vom Artikel bzw. Space in sein Gespräch. Der Server legt
// das Gespräch beim ersten Mal an und öffnet danach dasselbe (`POST /api/chat/gespraeche`); wer den
// Artikel oder die Inhalte des Space nicht sehen darf, bekommt 404 und hier eine Meldung.
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { type GespraechAnlage, chatApi } from "../api/chat";
import { Button } from "./ui";

export function ChatGespraechKnopf({
  ziel,
}: {
  ziel: { art: "artikel"; koId: string } | { art: "space"; spaceId: string };
}): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const oeffnen = useMutation({
    mutationFn: (eingabe: GespraechAnlage) => chatApi.anlegen(eingabe),
    onSuccess: (g) => navigate(`/chat/${encodeURIComponent(g.id)}`),
  });
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        data-testid={ziel.art === "artikel" ? "artikel-gespraech" : "space-gespraech"}
        disabled={oeffnen.isPending}
        onClick={() => oeffnen.mutate(ziel)}
      >
        {ziel.art === "artikel" ? t("chat.artikel.knopf") : t("chat.space.knopf")}
      </Button>
      {oeffnen.isError ? (
        <span role="alert" className="text-[12px] text-trust-crit-text">
          {t("chat.fehler.allgemein")}
        </span>
      ) : null}
    </span>
  );
}
