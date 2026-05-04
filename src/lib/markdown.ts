const MARKDOWN_IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;

export const stripMarkdown = (markdown: string): string => {
  if (!markdown) return '';
  
  return markdown
    // Remove headers
    .replace(/^#+\s+/gm, '')
    // Remove links [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove bold/italic
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    // Remove italic
    .replace(/(\*|_)(.*?)\1/g, '$2')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, '')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    // Remove blockquotes
    .replace(/^\s*>\s+/gm, '')
    // Remove horizontal rules
    .replace(/^-{3,}|^\*{3,}|^_{3,}/gm, '')
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Replace multiple spaces/newlines
    .replace(/\s+/g, ' ')
    .trim();
};

export const extractMarkdownImages = (markdown: string) => {
  if (!markdown) return [];

  return [...markdown.matchAll(MARKDOWN_IMAGE_REGEX)].map((match) => ({
    alt: match[1] || "Post image",
    src: match[2],
  }));
};

export const removeMarkdownImages = (markdown: string): string => {
  if (!markdown) return "";
  return markdown.replace(MARKDOWN_IMAGE_REGEX, "").trim();
};
