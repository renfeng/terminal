import { describe, it, expect } from "vitest";
import { executeCli } from "../index.js";

describe("executeCli", () => {
  it("should execute a simple command", async () => {
    const result = await executeCli("echo", ["hello", "world"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe("hello world");
    expect(result.stderr).toBe("");
  });

  it("should capture stderr", async () => {
    const result = await executeCli("node", [
      "-e",
      'process.stderr.write("oops")',
    ]);
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("oops");
  });

  it("should return non-zero exit code on failure", async () => {
    const result = await executeCli("node", ["-e", "process.exit(42)"]);
    expect(result.exitCode).toBe(42);
  });

  it("should handle command not found", async () => {
    const result = await executeCli("nonexistent-command-xyz", ["--help"]);
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toBeTruthy();
  });

  it("should respect cwd", async () => {
    const result = await executeCli("pwd", [], "/tmp");
    expect(result.exitCode).toBe(0);
    // /tmp may resolve to /private/tmp on macOS
    expect(result.stdout.trim()).toMatch(/\/tmp$/);
  });

  it("should timeout long-running commands", async () => {
    const result = await executeCli("sleep", ["10"], undefined, 100);
    expect(result.exitCode).toBe(124);
    expect(result.stderr).toContain("timed out");
  });
});
