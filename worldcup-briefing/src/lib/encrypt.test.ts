import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./encrypt";

const testSecret = "a-very-long-test-secret-at-least-32-chars!!";

describe("encrypt / decrypt", () => {
  it("encrypt then decrypt returns the original string", () => {
    const plaintext = "hello world";
    const ciphertext = encrypt(plaintext, testSecret);
    expect(decrypt(ciphertext, testSecret)).toBe(plaintext);
  });

  it("handles empty string", () => {
    const ciphertext = encrypt("", testSecret);
    expect(decrypt(ciphertext, testSecret)).toBe("");
  });

  it("handles long strings with special characters", () => {
    const plaintext = JSON.stringify({
      key: "value",
      nested: { arr: [1, 2, 3] },
      unicode: "日本語",
    });
    const ciphertext = encrypt(plaintext, testSecret);
    expect(decrypt(ciphertext, testSecret)).toBe(plaintext);
  });

  it("two encryptions of the same string produce different outputs", () => {
    const plaintext = "same string";
    const a = encrypt(plaintext, testSecret);
    const b = encrypt(plaintext, testSecret);
    expect(a).not.toBe(b);
  });

  it("decrypt with wrong secret throws an error", () => {
    const ciphertext = encrypt("sensitive data", testSecret);
    expect(() => decrypt(ciphertext, "wrong-secret-that-is-also-at-least-32-chars")).toThrow();
  });

  it("output format contains iv, authTag, and ciphertext as hex", () => {
    const ciphertext = encrypt("data", testSecret);
    const parts = ciphertext.split(":");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toHaveLength(24);
    expect(parts[1]).toHaveLength(32);
    expect(parts[2].length).toBeGreaterThan(0);
  });
});
