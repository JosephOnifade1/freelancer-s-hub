import {defineConfig} from "vitest/config";
/** Explicit isolated suite: never discovers DB integration files or loads .env. */
export default defineConfig({test:{environment:"node",include:["tests/verification/**/*.test.ts"],fileParallelism:false}});
