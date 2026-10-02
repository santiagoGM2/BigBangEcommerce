import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { fixupConfigRules } from "@eslint/compat";

const eslintConfig = [
  ...fixupConfigRules([...nextVitals, ...nextTypescript]),
  {
    ignores: [".next/**", "node_modules/**", "_design-reference/**"],
  },
];

export default eslintConfig;
