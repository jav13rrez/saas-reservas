import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.next/**",
      "**/next-env.d.ts",
      "**/coverage/**",
      "reference/**",
      "archive/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["vitest.config.ts", "tests/setup.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      // Arrow shorthand returning void is idiomatic in JSX event handlers.
      "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: true }],
      "@typescript-eslint/no-floating-promises": "error",
      // Allow the omit-via-destructuring idiom: const { service: _service, ...rest } = input.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
    },
  },
  {
    // Root tooling files live outside any composite tsconfig project.
    files: ["**/*.js", "**/*.mjs", "vitest.config.ts", "tests/setup.ts"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
