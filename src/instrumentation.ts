/**
 * Next.js instrumentation hook.
 *
 * Runs once when a server instance boots (both `next start` and the standalone
 * server). Per blueprint §22.5: production must fail startup when required
 * secrets are missing rather than silently serving with a public RPC or no
 * treasury wallet.
 *
 * Values are never logged — only variable names and a safe reason.
 */

export async function register() {
  // Only run on the server runtime (skip edge).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertEnvOrThrow, inspectEnv } = await import("./lib/env");

    if (process.env.NODE_ENV === "production") {
      assertEnvOrThrow();
    } else {
      // In development, surface problems loudly but do not block the dev server.
      const report = inspectEnv();
      if (!report.ok) {
        console.warn(
          `[env] Development environment has issues (non-blocking):\n` +
            report.issues.map((i) => `  - [${i.severity}] ${i.name}: ${i.problem}`).join("\n"),
        );
      }
    }
  }
}