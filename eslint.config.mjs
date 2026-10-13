import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The landing page builds on its own (site/).
    "site/.next/**",
    "site/next-env.d.ts",
    "site/public/art/**",
    // Claude Code agent worktrees (local only).
    ".claude/**",
  ]),
]);

export default eslintConfig;
