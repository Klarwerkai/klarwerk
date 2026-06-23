import { describe, expect, it } from "vitest";
import { ConsoleMailer } from "./mailer";
import { createMailerFromEnv } from "./smtp";

describe("notifications", () => {
  it("ConsoleMailer sammelt Nachrichten statt sie zu versenden", async () => {
    const mailer = new ConsoleMailer();
    await mailer.send({ to: "a@x.de", subject: "Hi", text: "Test" });
    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]?.to).toBe("a@x.de");
  });

  it("createMailerFromEnv: ohne SMTP_HOST undefined, mit Host definiert", () => {
    expect(createMailerFromEnv({})).toBeUndefined();
    expect(createMailerFromEnv({ SMTP_HOST: "smtp.example.com" })).toBeDefined();
  });
});
