import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "convex/_generated/**",
    ],
  },
  ...nextCoreWebVitals,
];

export default eslintConfig;
