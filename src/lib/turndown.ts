import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const turndownService = new TurndownService({
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '_',
  strongDelimiter: '**',
});

// Use GFM plugin for strikethrough, tables, and task list items
turndownService.use(gfm);

// Custom rule for underline since standard markdown doesn't have it,
// we will output raw HTML `<u>` which rehype-raw can handle.
turndownService.addRule('underline', {
  filter: ['u'],
  replacement: (content) => `<u>${content}</u>`,
});

turndownService.addRule('superscript', {
  filter: ['sup'],
  replacement: (content) => `<sup>${content}</sup>`,
});

turndownService.addRule('subscript', {
  filter: ['sub'],
  replacement: (content) => `<sub>${content}</sub>`,
});

turndownService.addRule('spoiler', {
  filter: (node) => node.nodeName === 'SPAN' && node.hasAttribute('data-spoiler'),
  replacement: (content) => `<span data-spoiler="true">${content}</span>`,
});

export { turndownService };
