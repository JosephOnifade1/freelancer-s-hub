import { useState, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Youtube from '@tiptap/extension-youtube';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Spoiler } from './extensions/Spoiler';

import { EditorToolbar } from './EditorToolbar';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { turndownService } from '@/lib/turndown';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export const Editor = ({ 
  value, 
  onChange, 
  placeholder = "Body text (optional)", 
  className,
  minHeight = "200px" 
}: EditorProps) => {
  const [isMarkdown, setIsMarkdown] = useState(false);
  const [markdownValue, setMarkdownValue] = useState(value);

  // Initialize marked HTML for Tiptap
  const getInitialHTML = () => {
    if (!value) return '';
    const rawHtml = marked.parse(value) as string;
    return DOMPurify.sanitize(rawHtml, { 
      ADD_TAGS: ['iframe'],
      ADD_ATTR: ['target', 'type', 'checked', 'allowfullscreen', 'frameborder', 'src', 'allow', 'data-spoiler'] 
    });
  };

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // extensions are enabled by default
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline underline-offset-4 cursor-pointer',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto my-4 border border-border',
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Underline,
      Superscript,
      Subscript,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Youtube.configure({
        controls: true,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Spoiler,
    ],
    content: getInitialHTML(),
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none px-4 py-3 min-h-[200px]",
          className
        ),
      },
    },
    onUpdate: ({ editor }) => {
      // When in RTE mode, we want to export markdown for the parent component
      // Only do this if we are not currently in markdown mode to prevent loop issues
      if (!isMarkdown) {
        const html = editor.getHTML();
        // Turndown converts the HTML back to Markdown accurately
        const markdown = turndownService.turndown(html);
        setMarkdownValue(markdown);
        onChange(markdown);
      }
    },
  });

  // Handle external value reset (e.g., after form submission)
  useEffect(() => {
    if (value === '') {
      setMarkdownValue('');
      if (editor && !editor.isEmpty) {
        editor.commands.setContent('');
      }
    }
  }, [value, editor]);

  const handleSwitchMode = () => {
    if (isMarkdown) {
      // Switching from Markdown to RTE
      // Parse the markdown securely to HTML and feed it to Tiptap
      const rawHtml = marked.parse(markdownValue) as string;
      const cleanHtml = DOMPurify.sanitize(rawHtml, { 
        ADD_TAGS: ['iframe'],
        ADD_ATTR: ['target', 'type', 'checked', 'allowfullscreen', 'frameborder', 'src', 'allow', 'data-spoiler'] 
      });
      editor?.commands.setContent(cleanHtml);
    } else {
      // Switching from RTE to Markdown
      const html = editor?.getHTML() || '';
      const markdown = turndownService.turndown(html);
      setMarkdownValue(markdown);
      // onChange is already called during onUpdate, but calling it here just to be safe
      onChange(markdown);
    }
    setIsMarkdown(!isMarkdown);
  };

  const handleMarkdownChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setMarkdownValue(newValue);
    onChange(newValue);
  };

  return (
    <div className={cn(
      "w-full border rounded-xl overflow-hidden bg-card flex flex-col focus-within:ring-1 focus-within:ring-primary/20 transition-all",
      className
    )}>
      <EditorToolbar 
        editor={editor} 
        onSwitchMode={handleSwitchMode} 
        isMarkdown={isMarkdown} 
      />
      
      <div className="flex-1 overflow-y-auto" style={{ minHeight }}>
        {isMarkdown ? (
          <Textarea
            value={markdownValue}
            onChange={handleMarkdownChange}
            placeholder={placeholder}
            className="w-full h-full min-h-[200px] border-0 focus-visible:ring-0 resize-none font-mono text-sm px-4 py-3 bg-transparent"
          />
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .is-editor-empty:before {
          content: attr(data-placeholder);
          float: left;
          color: #94a3b8;
          pointer-events: none;
          height: 0;
        }
        .prose table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 0;
          overflow: hidden;
        }
        .prose td, .prose th {
          min-width: 1em;
          border: 1px solid #e2e8f0;
          padding: 3px 5px;
          vertical-align: top;
          box-sizing: border-box;
          position: relative;
        }
        .prose th {
          font-weight: bold;
          text-align: left;
          background-color: rgba(0,0,0,0.05);
        }
        .dark .prose td, .dark .prose th {
          border-color: #334155;
        }
        ul[data-type="taskList"] {
          list-style: none;
          padding: 0;
        }
        ul[data-type="taskList"] p {
          margin: 0;
        }
        ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
        }
        ul[data-type="taskList"] li > label {
          margin-top: 0.2rem;
          user-select: none;
        }
        ul[data-type="taskList"] li > div {
          flex: 1;
        }
      `}} />
    </div>
  );
};
