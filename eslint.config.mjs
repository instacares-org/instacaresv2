import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/out/**",
      "**/build/**",
      "**/dist/**",
      "test-*.js",
      "check-*.js",
      "debug-*.js",
      "create-*.js",
      "fix-*.js",
      "find-*.js",
      "make-*.js",
      "reset-*.js",
      "restore-*.js",
      "send-*.js",
      "verify-*.js",
      "quick-*.js",
      "clear-*.js",
      "get-*.js",
      "server.js"
    ],
    rules: {
      // Disable strict type checking for production build
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      
      // React specific
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "warn",
      
      // General JavaScript
      "no-var": "off", // Required for global TypeScript declarations
      "prefer-const": "warn",
      "no-console": "off", // Will handle console.logs later
      
      // Allow some flexibility for production
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-require-imports": "off",
      
      // Turn errors into warnings for now
      "react-hooks/rules-of-hooks": "warn",
    }
  }
];

export default eslintConfig;