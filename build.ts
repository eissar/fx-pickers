// build.ts
/// <reference lib="deno.ns" />
const cfg = {
  entryPoint: "./commandPalette.ts",
  outputPath: "dist/main.js",
};
await Deno.mkdir("dist", { recursive: true });
const command = new Deno.Command("deno", {
  args: ["emit", cfg.entryPoint],
  stdout: "piped",
  stderr: "piped",
});
(async () => {
  const { code, stdout, stderr } = await command.output();
  if (code !== 0) {
    const errorText = new TextDecoder().decode(stderr);
    console.error("Build failed:", errorText);
    Deno.exit(1);
  }
  await Deno.writeFile(cfg.outputPath, stdout);
  console.log(`✅ Successfully emitted ${cfg.outputPath}`);
})();
