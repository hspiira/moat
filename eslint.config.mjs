import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

const config = [
  { ignores: ["server/dist/**", "server/server.js", "server/migrate.js"] },
  ...nextCoreWebVitals,
  ...nextTypeScript,
];

export default config;
