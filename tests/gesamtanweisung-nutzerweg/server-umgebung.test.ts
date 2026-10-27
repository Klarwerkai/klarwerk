import { describe, expect, it } from "vitest";
import { fehlendePflichtwerte, pruefeStartvertrag } from "../../services/app/src/start-vertrag";
import { serverUmgebung } from "./weg";

const url = "postgresql://fixture@127.0.0.1:5432/klarwerk_test";

describe("Lokale Prozess-Testumgebung", () => {
  it("liefert die vollständigen Produktionspflichtwerte für den lokalen Prüfserver", () => {
    const env = serverUmgebung(url, 3100);
    expect(env).toMatchObject({
      NODE_ENV: "production",
      DATABASE_URL: url,
      APP_BASE_URL: "https://wissen.kunde.test",
      PORT: "3100",
      KLARWERK_TRUST_PROXY: "127.0.0.1/32",
    });
    expect(fehlendePflichtwerte(env)).toEqual([]);
    expect(() => pruefeStartvertrag(env)).not.toThrow();
  });

  it.each([undefined, "", "true", "0.0.0.0/0", "::/0"])(
    "der Startvertrag verweigert weiterhin den fehlenden oder pauschalen Proxywert %s",
    (proxy) => {
      const env = { ...serverUmgebung(url, 3100), KLARWERK_TRUST_PROXY: proxy };
      expect(fehlendePflichtwerte(env)).toEqual(["KLARWERK_TRUST_PROXY"]);
      expect(() => pruefeStartvertrag(env)).toThrow("KLARWERK_TRUST_PROXY");
    },
  );
});
