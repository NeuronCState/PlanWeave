export type PromptSectionKind = "managed" | "user";

export type PromptSection = {
  kind: PromptSectionKind;
  name: string;
  content: string;
};

const sectionPattern =
  /<!-- planweave:(managed|user):start ([a-z0-9-]+) -->([\s\S]*?)<!-- planweave:\1:end \2 -->/g;

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
