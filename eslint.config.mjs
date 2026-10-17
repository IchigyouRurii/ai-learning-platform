import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([".next/**", "node_modules/**", "next-env.d.ts", ".local/**"]),
  {
    files: ["src/modules/teacher/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/student", "@/modules/student/**"],
              message: "教师端通过 platform 的公共接口与学生端共享数据。",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/student/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/modules/teacher", "@/modules/teacher/**"],
              message: "学生端通过 platform 的公共接口与教师端共享数据。",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/shared/**/*.{ts,tsx}", "src/modules/platform/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/modules/teacher",
                "@/modules/teacher/**",
                "@/modules/student",
                "@/modules/student/**",
              ],
              message: "共用层不能依赖教师端或学生端业务。",
            },
          ],
        },
      ],
    },
  },
]);
