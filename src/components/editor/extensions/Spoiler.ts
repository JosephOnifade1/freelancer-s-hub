import { Mark, mergeAttributes, type RawCommands } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    spoiler: {
      toggleSpoiler: () => ReturnType;
    };
  }
}

export const Spoiler = Mark.create({
  name: 'spoiler',

  parseHTML() {
    return [
      {
        tag: 'span[data-spoiler]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-spoiler': 'true',
        class: 'bg-foreground text-transparent hover:bg-muted hover:text-foreground transition-all duration-300 cursor-pointer rounded px-1',
      }),
      0,
    ];
  },

  addCommands(): Partial<RawCommands> {
    return {
      toggleSpoiler:
        () =>
        ({ commands }) => {
          return commands.toggleMark(this.name);
        },
    };
  },
});
