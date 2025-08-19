// build.ts
/// <reference lib="deno.ns" />
import * as esbuild from "https://deno.land/x/esbuild@v0.20.1/mod.js";
import { dirname, join } from "jsr:@std/path@0.213";
import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@0.9.0";
// --- Find deno.json
let denoCfgPath: string;
if (import.meta.dirname) {
  // const rootDir: string = dirname(import.meta.dirname);
  const rootDir: string = import.meta.dirname; // we are in root
  denoCfgPath = join(rootDir, "deno.jsonc");
} else {
  // Fallback if import.meta.dirname is not available
  console.warn("Could not find deno.json.");
  Deno.exit(1);
}
const entryPt = "./commandPalette.ts";
const outFile = "./dist/main.js";
const bannerText = "// ==UserScript==\n// ==/UserScript==";
// <https://esbuild.github.io/api/#format-esm>
const format = "esm"; // sys.mjs
async function build() {
  console.log("🚀 Starting build with esbuild...");
  try {
    // Ensure the output directory exists
    await Deno.mkdir("dist", { recursive: true });
    await esbuild.build({
      banner: {
        js: bannerText,
      },
      plugins: [
        ...denoPlugins({
          configPath: denoCfgPath,
        }),
      ],
      entryPoints: [entryPt],
      outfile: outFile,
      bundle: true,
      platform: "browser",
      format: format,
      target: "esnext",
      sourcemap: false,
      treeShaking: false,
      minify: false,
    });
    console.log("✅ Build completed successfully!");
  } catch (error) {
    console.error(`❌ Error during build process:`, error);
    Deno.exit(1);
  } finally {
    await esbuild.stop();
    console.log("esbuild service stopped.");
  }
}
build();
