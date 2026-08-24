import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const config = [
  {
    // Playwright writes and deletes trace artifacts here mid-run, so linting
    // them fails on files that no longer exist by the time eslint opens them.
    ignores: [
      "server/*.js",
      "test-results/**",
      "playwright-report/**",
      // The static export copied into the native shells. Generated, not ours.
      "ios/App/App/public/**",
      "native/android/**/assets/public/**",
      // Swift package checkouts and artifacts. Xcode recreates this whenever
      // the project is open, and Capacitor vendors its own bridge script in
      // there, so every warning it holds belongs to someone else.
      "ios/App/CapApp-SPM/.build/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
];

export default config;
