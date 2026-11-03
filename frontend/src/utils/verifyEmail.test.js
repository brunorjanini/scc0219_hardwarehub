import { describe, expect, it } from "vitest";
import verifyEmail from "./verifyEmail";

describe("verifyEmail", () => {
  it.each(["ana@email.com", "a.b+c@usp.br", "admin@hardwarehub.com"])(
    "accepts %s",
    (email) => {
      expect(verifyEmail(email)).toBe(true);
    },
  );

  it.each(["", "admin", "ana@", "@email.com", "ana@email", "ana @email.com"])(
    "rejects %j",
    (email) => {
      expect(verifyEmail(email)).toBe(false);
    },
  );
});
