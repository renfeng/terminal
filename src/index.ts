#!/usr/bin/env node

/**
 * terminal
 *
 * A generic MCP server that exposes a single 'execute' tool for running
 * CLI commands over stdio. Uses execFile (no shell) to prevent injection.
 *
 * Trust and blocking are managed by Kiro's autoApprove in mcp.json —
 * the server itself has no allowlist. Any CLI on the user's PATH can be called.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT = 30_000;

const EXECUTE_TOOL = {
  name: "execute",
  description:
    "Execute a CLI command. The command is run directly via execFile (not through a shell) " +
    "to prevent injection. Use for any CLI: mvn, git, gradle, docker, kubectl, npm, cargo, etc.",
  inputSchema: {
    type: "object" as const,
    properties: {
      command: {
        type: "string" as const,
        description: "The CLI command to run (e.g. 'mvn', 'git', 'gradle').",
      },
      args: {
        type: "array" as const,
        items: { type: "string" as const },
        description:
          'Arguments to pass to the command. Example: ["clean", "install", "-DskipTests"]',
      },
      cwd: {
        type: "string" as const,
        description:
          "Working directory for the command. Defaults to the server's cwd.",
      },
      timeout: {
        type: "number" as const,
        description:
          "Timeout in milliseconds. Default: 30000.",
      },
    },
    required: ["command", "args"],
  },
};

interface ExecuteArgs {
  command: string;
  args: string[];
  cwd?: string;
  timeout?: number;
}

export async function executeCli(
  command: string,
  args: string[],
  cwd?: string,
  timeout?: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const result = await execFileAsync(command, args, {
      cwd: cwd || process.cwd(),
      timeout: timeout,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env },
    });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      code?: number | string;
      killed?: boolean;
      signal?: string;
    };
    if (execError.killed || execError.signal === "SIGTERM") {
      return {
        stdout: execError.stdout || "",
        stderr: `Command timed out after ${timeout}ms\n${execError.stderr || ""}`,
        exitCode: 124,
      };
    }
    return {
      stdout: execError.stdout || "",
      stderr:
        execError.stderr ||
        (error instanceof Error ? error.message : String(error)),
      exitCode: typeof execError.code === "number" ? execError.code : 1,
    };
  }
}

async function main(): Promise<void> {
  const timeout =
    parseInt(process.env.CLI_TIMEOUT || "", 10) || DEFAULT_TIMEOUT;

  const server = new Server(
    { name: "terminal", version: "0.2.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [EXECUTE_TOOL],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: rawArgs } = request.params;

    if (name !== "execute") {
      return {
        content: [{ type: "text", text: `Error: Unknown tool '${name}'.` }],
        isError: true,
      };
    }

    const params = (rawArgs || {}) as unknown as ExecuteArgs;
    const result = await executeCli(
      params.command,
      params.args || [],
      params.cwd,
      params.timeout || timeout,
    );

    const parts: string[] = [];
    if (result.stdout) parts.push(result.stdout);
    if (result.stderr) parts.push(`[stderr]\n${result.stderr}`);
    if (result.exitCode !== 0) parts.push(`[exit code: ${result.exitCode}]`);

    const text = parts.join("\n") || "(no output)";

    return {
      content: [{ type: "text", text }],
      isError: result.exitCode !== 0,
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal:", error.message || error);
  process.exit(1);
});
