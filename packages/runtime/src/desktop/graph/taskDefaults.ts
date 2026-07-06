import type { BlockType } from "../../types.js";

export function defaultTaskBlockTypes(): BlockType[] {
  return ["implementation", "review"];
}
