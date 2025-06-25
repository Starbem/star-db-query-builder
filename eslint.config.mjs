import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettier from "eslint-plugin-prettier";
import { defineConfig } from "eslint/config";

export default defineConfig([
  // Ignore patterns (replaces .eslintignore)
  {
    ignores: [
      "dist/**",
      "build/**",
      "coverage/**",
      "node_modules/**",
      "*.js",
      "*.d.ts",
      "examples/**",
    ],
  },
  
  // Base configuration for all files
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      prettier: prettier,
    },
    rules: {
      // Prettier
      "prettier/prettier": "error",
      
      // TypeScript rules
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      
      // General rules
      "import/prefer-default-export": "off",
      "no-param-reassign": "off",
      "no-console": "off",
      "no-return-assign": "off",
      "array-callback-return": "off",
    },
  },
  
  // TypeScript specific configuration
  ...tseslint.configs.recommended.map(config => ({
    ...config,
    rules: {
      ...config.rules,
      "@typescript-eslint/no-explicit-any": "off",
    },
  })),
  
  // Prettier configuration
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    rules: {
      "prettier/prettier": "error",
    },
  },
]);
