import fs from "fs";
import path from "path";

export function loadTextFile(filePath: string, fallback = ""): string {
  try {
    const resolved = path.resolve(filePath);
    return fs.readFileSync(resolved, "utf-8").trim();
  } catch {
    console.warn(`[loadTextFile] Could not read "${filePath}" — using fallback`);
    return fallback;
  }
}
