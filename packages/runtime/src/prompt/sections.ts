import type { ValidationIssue } from "../types.js";

export type PromptSectionKind = "managed" | "user";

export type PromptSection = {
  kind: PromptSectionKind;
  name: string;
  content: string;
};

const sectionPattern =
  /<!-- planweave:(managed|user):start ([a-z0-9-]+) -->([\s\S]*?)<!-- planweave:\1:end \2 -->/g;

const markerPattern = /<!-- planweave:(managed|user):(start|end) ([a-z0-9-]+) -->/g;

function sectionIssue(code: string, message: string, path?: string): ValidationIssue {
  return { code, message, path };
}

export function findPromptSectionBoundaryIssues(markdown: string, path?: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const stack: Array<{ kind: PromptSectionKind; name: string }> = [];

  for (const match of markdown.matchAll(markerPattern)) {
    const kind = match[1] as PromptSectionKind;
    const boundary = match[2];
    const name = match[3];

    if (boundary === "start") {
      stack.push({ kind, name });
      continue;
    }

    const open = stack.pop();
    if (!open) {
      issues.push(sectionIssue("prompt_section_boundary_invalid", `Prompt section '${kind}:${name}' has an end marker without a start marker.`, path));
      continue;
    }
    if (open.kind !== kind || open.name !== name) {
      issues.push(
        sectionIssue(
          "prompt_section_boundary_invalid",
          `Prompt section '${open.kind}:${open.name}' is closed by mismatched end marker '${kind}:${name}'.`,
          path
        )
      );
    }
  }

  for (const open of stack) {
    issues.push(
      sectionIssue("prompt_section_boundary_invalid", `Prompt section '${open.kind}:${open.name}' has a start marker without an end marker.`, path)
    );
  }

  return issues;
}

export function assertPromptSectionsWellFormed(markdown: string, path?: string): void {
  const issues = findPromptSectionBoundaryIssues(markdown, path);
  if (issues.length > 0) {
    throw new Error(`${issues[0].code}: ${issues[0].message}`);
  }
}

export function parsePromptSections(markdown: string): PromptSection[] {
  return [...markdown.matchAll(sectionPattern)].map((match) => ({
    kind: match[1] as PromptSectionKind,
    name: match[2],
    content: match[3].replace(/^\n/, "").replace(/\n$/, "")
  }));
}

export function getPromptSection(markdown: string, kind: PromptSectionKind, name: string): string | null {
  const section = parsePromptSections(markdown).find((item) => item.kind === kind && item.name === name);
  return section?.content ?? null;
}

export function hasUserSection(markdown: string, name: string): boolean {
  return getPromptSection(markdown, "user", name) !== null;
}

export function formatSection(kind: PromptSectionKind, name: string, content: string): string {
  const body = content.endsWith("\n") ? content.slice(0, -1) : content;
  return `<!-- planweave:${kind}:start ${name} -->\n${body}\n<!-- planweave:${kind}:end ${name} -->`;
}

export function replacePromptSection(markdown: string, kind: PromptSectionKind, name: string, content: string): string {
  const pattern = new RegExp(
    `<!-- planweave:${kind}:start ${name} -->[\\s\\S]*?<!-- planweave:${kind}:end ${name} -->`
  );
  if (!pattern.test(markdown)) {
    throw new Error(`Prompt section '${kind}:${name}' does not exist.`);
  }
  return markdown.replace(pattern, formatSection(kind, name, content));
}
