import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const config = [
  {
    // Playwright writes and deletes trace artifacts here mid-run, so linting
    // them fails on files that no longer exist by the time eslint opens them.
    ignores: [
      "server/dist/**",
      "server/server.js",
      "server/migrate.js",
      "test-results/**",
      "playwright-report/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
];

export default config;
