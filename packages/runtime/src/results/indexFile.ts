import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname } from "node:path";
import { readJsonFile, writeJsonFile } from "../json.js";
import type { ResultIndex } from "../types.js";

export async function readResultIndex(path: string): Promise<ResultIndex | null> {
  try {
    await access(path, constants.R_OK);
  } catch {
    return null;
  }
  return readJsonFile<ResultIndex>(path);
}

export async function writeResultIndex(path: string, index: ResultIndex): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeJsonFile(path, index);
}
