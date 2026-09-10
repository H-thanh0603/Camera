import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Next 16: flat config trực tiếp (không qua FlatCompat — eslint-config-next
// bản 16 export flat, dùng compat gây crash circular structure).
const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    // react-hooks v6 (đi kèm Next 16) thêm 2 rules mới. Patterns setState
    // trong effect của repo (fetch có cancelled-guard, hydrate 1 lần) đã
    // review là an toàn — hạ warn để giữ scope migration, refactor dần sau.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/incompatible-library": "warn",
    },
  },
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
];

export default eslintConfig;
