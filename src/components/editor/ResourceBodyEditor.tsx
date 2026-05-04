import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Superscript from "@tiptap/extension-superscript";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import Youtube from "@tiptap/extension-youtube";
import { Markdown } from "@tiptap/markdown";
import {
  Bold,
  Code,
  CodeXml,
  CurlyBraces,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  ChevronDown,
  Quote,
  Type,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ResourceEditorMode = "markdown" | "rich-text";

interface ResourceBodyEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
  className?: string;
}

const normalizeMarkdown = (markdown: string) => markdown.replace(/\r\n/g, "\n");
const IMAGE_MARKDOWN_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;

interface MarkdownImagePreview {
  alt: string;
  src: string;
}

const extractMarkdownImages = (markdown: string): MarkdownImagePreview[] => {
  const matches = [...markdown.matchAll(IMAGE_MARKDOWN_REGEX)];

  return matches.map((match) => ({
    alt: match[1] || "Resource image",
    src: match[2],
  }));
};

export function ResourceBodyEditor({
  value,
  onChange,
  placeholder = "Describe the resource. What's the 'High-Signal' takeaway?",
  minHeight = "154px",
  className,
}: ResourceBodyEditorProps) {
  const [mode, setMode] = useState<ResourceEditorMode>("markdown");
  const modeRef = useRef<ResourceEditorMode>(mode);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const markdownTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const normalizedValue = useMemo(() => normalizeMarkdown(value), [value]);
  const imagePreviews = useMemo(() => extractMarkdownImages(normalizedValue), [normalizedValue]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: "my-4 max-w-full rounded-lg border border-border",
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Markdown.configure({
        markedOptions: {
          gfm: true,
          breaks: true,
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: normalizedValue,
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none px-5 py-4 focus:outline-none min-h-[220px] dark:prose-invert",
          "prose-headings:font-heading prose-p:font-body prose-li:font-body prose-blockquote:border-primary/35",
          "prose-pre:rounded-xl prose-pre:border prose-pre:border-border prose-pre:bg-muted",
          "prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-foreground",
          "prose-table:my-4 prose-table:w-full prose-th:bg-muted/70 prose-th:p-2 prose-td:p-2"
        ),
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      if (modeRef.current !== "rich-text") return;

      onChange(normalizeMarkdown(currentEditor.getMarkdown()));
    },
  });

  useEffect(() => {
    if (!editor) return;

    if (mode === "rich-text") {
      const currentMarkdown = normalizeMarkdown(editor.getMarkdown());
      if (currentMarkdown !== normalizedValue) {
        editor.commands.setContent(normalizedValue, {
          emitUpdate: false,
          contentType: "markdown",
        });
      }
    }
  }, [editor, mode, normalizedValue]);

  const switchToMarkdown = () => {
    if (!editor) {
      setMode("markdown");
      return;
    }

    const markdown = normalizeMarkdown(editor.getMarkdown());
    onChange(markdown);
    setMode("markdown");
  };

  const switchToRichText = () => {
    if (editor) {
      editor.commands.setContent(normalizedValue, {
        emitUpdate: false,
        contentType: "markdown",
      });
    }

    setMode("rich-text");
  };

  const handleModeChange = (nextMode: ResourceEditorMode) => {
    if (nextMode === mode) return;
    if (nextMode === "markdown") {
      switchToMarkdown();
      return;
    }

    switchToRichText();
  };

  const insertMarkdownAtSelection = (snippet: string) => {
    const textarea = markdownTextareaRef.current;
    if (!textarea) {
      const separator = normalizedValue && !normalizedValue.endsWith("\n") ? "\n\n" : "";
      onChange(`${normalizedValue}${separator}${snippet}`);
      return;
    }

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const nextValue = `${textarea.value.slice(0, start)}${snippet}${textarea.value.slice(end)}`;

    onChange(normalizeMarkdown(nextValue));

    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + snippet.length;
      textarea.setSelectionRange(cursor, cursor);
    });
  };

  const handleImageFiles = (files: FileList | null) => {
    if (!files?.length) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) return;

      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result;
        if (typeof dataUrl !== "string") return;

        if (mode === "rich-text" && editor) {
          editor.chain().focus().setImage({ src: dataUrl, alt: file.name, title: file.name }).run();
          return;
        }

        const snippet = `![${file.name}](${dataUrl})`;
        insertMarkdownAtSelection(normalizedValue ? `\n${snippet}\n` : snippet);
      };
      reader.readAsDataURL(file);
    });
  };

  return (
    <div
      className={cn(
        "w-full max-w-[700px] overflow-hidden rounded-[28px] border border-border/80 bg-background shadow-sm transition-all focus-within:border-primary/35 focus-within:shadow-[0_0_0_3px_rgba(99,102,241,0.08)]",
        className
      )}
    >
      <div className="border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur">
        {mode === "rich-text" ? (
          <ResourceRichTextToolbar
            editor={editor}
            onSwitchToMarkdown={() => handleModeChange("markdown")}
            onSelectLocalImage={() => fileInputRef.current?.click()}
          />
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-medium text-muted-foreground">Markdown Editor</div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex w-fit items-center justify-center rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted/50"
              >
                Add Image
              </button>
              <button
                type="button"
                onClick={() => handleModeChange("rich-text")}
                className="inline-flex w-fit items-center justify-center rounded-full bg-muted px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted/80"
              >
                Switch to Rich Text
              </button>
            </div>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          handleImageFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {imagePreviews.length > 0 && (
        <div className="border-b border-border/60 bg-muted/20 px-4 py-3">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Image Preview
          </div>
          <div className="flex flex-wrap gap-3">
            {imagePreviews.map((image, index) => (
              <div key={`${image.src}-${index}`} className="w-24 overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
                <img src={image.src} alt={image.alt} className="h-20 w-full object-cover" />
                <div className="truncate px-2 py-1 text-[11px] text-muted-foreground">
                  {image.alt || `Image ${index + 1}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ minHeight }} className="bg-background">
        {mode === "markdown" ? (
          <Textarea
            ref={markdownTextareaRef}
            value={value}
            onChange={(event) => onChange(normalizeMarkdown(event.target.value))}
            placeholder={placeholder}
            className="min-h-[154px] resize-y border-0 bg-transparent px-5 py-4 font-mono text-sm leading-6 focus-visible:ring-0"
          />
        ) : (
          <EditorContent editor={editor} className="min-h-[154px]" />
        )}
      </div>

      <style>{`
        .ProseMirror {
          color: hsl(var(--foreground));
          line-height: 1.7;
          word-break: break-word;
        }
        .ProseMirror > *:first-child {
          margin-top: 0;
        }
        .ProseMirror > *:last-child {
          margin-bottom: 0;
        }
        .ProseMirror p {
          margin: 0.5rem 0 0.85rem;
        }
        .ProseMirror h1,
        .ProseMirror h2,
        .ProseMirror h3,
        .ProseMirror h4,
        .ProseMirror h5,
        .ProseMirror h6 {
          font-family: var(--font-heading, inherit);
          font-weight: 700;
          line-height: 1.25;
          color: hsl(var(--foreground));
          margin: 1.4rem 0 0.65rem;
        }
        .ProseMirror h1 {
          font-size: 2rem;
          letter-spacing: -0.03em;
        }
        .ProseMirror h2 {
          font-size: 1.55rem;
          letter-spacing: -0.02em;
        }
        .ProseMirror h3 {
          font-size: 1.25rem;
        }
        .ProseMirror h4 {
          font-size: 1.05rem;
        }
        .ProseMirror h5,
        .ProseMirror h6 {
          font-size: 0.95rem;
        }
        .ProseMirror strong {
          font-weight: 700;
          color: hsl(var(--foreground));
        }
        .ProseMirror em {
          font-style: italic;
        }
        .ProseMirror a {
          color: hsl(var(--primary));
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .ProseMirror hr {
          border: 0;
          border-top: 1px solid hsl(var(--border));
          margin: 1.5rem 0;
        }
        .ProseMirror ul,
        .ProseMirror ol {
          margin: 0.7rem 0 1rem;
          padding-left: 1.4rem;
        }
        .ProseMirror ul {
          list-style: disc;
        }
        .ProseMirror ol {
          list-style: decimal;
        }
        .ProseMirror ul ul,
        .ProseMirror ul ol,
        .ProseMirror ol ul,
        .ProseMirror ol ol {
          margin: 0.35rem 0 0.35rem;
          padding-left: 1.25rem;
        }
        .ProseMirror li {
          margin: 0.18rem 0;
        }
        .ProseMirror li p {
          margin: 0;
        }
        .ProseMirror blockquote {
          border-left: 4px solid hsl(var(--primary) / 0.35);
          color: hsl(var(--muted-foreground));
          margin: 1rem 0;
          padding: 0.2rem 0 0.2rem 1rem;
        }
        .ProseMirror blockquote p {
          margin: 0.3rem 0;
        }
        .ProseMirror code {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        }
        .ProseMirror :not(pre) > code {
          background: hsl(var(--muted) / 0.82);
          border: 1px solid hsl(var(--border) / 0.9);
          border-radius: 0.45rem;
          color: hsl(var(--foreground));
          font-size: 0.9em;
          padding: 0.14rem 0.38rem;
        }
        .ProseMirror pre {
          background: hsl(var(--muted) / 0.36);
          border: 1px solid hsl(var(--border) / 0.7);
          border-radius: 0.35rem;
          margin: 1rem 0 1.2rem;
          overflow-x: auto;
          padding: 0.9rem 1rem;
        }
        .ProseMirror pre code {
          background: transparent;
          border: 0;
          color: hsl(var(--foreground));
          display: block;
          font-size: 0.88rem;
          line-height: 1.65;
          padding: 0;
          white-space: pre;
        }
        .ProseMirror img {
          display: block;
          max-width: min(100%, 24rem);
          height: auto;
          margin: 1rem 0;
        }
        .ProseMirror table {
          border-collapse: collapse;
          table-layout: fixed;
          width: 100%;
          margin: 1rem 0;
          overflow: hidden;
        }
        .ProseMirror td,
        .ProseMirror th {
          min-width: 1em;
          border: 1px solid hsl(var(--border));
          padding: 0.6rem 0.75rem;
          vertical-align: top;
          position: relative;
        }
        .ProseMirror th {
          background: hsl(var(--muted) / 0.7);
          font-weight: 600;
        }
        .ProseMirror td p,
        .ProseMirror th p {
          margin: 0;
        }
        .ProseMirror .selectedCell:after {
          background: rgba(99, 102, 241, 0.12);
          content: "";
          left: 0;
          right: 0;
          top: 0;
          bottom: 0;
          pointer-events: none;
          position: absolute;
          z-index: 2;
        }
        .ProseMirror ul[data-type="taskList"] {
          list-style: none;
          padding: 0;
          margin: 0.8rem 0 1rem;
        }
        .ProseMirror ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          margin: 0.22rem 0;
        }
        .ProseMirror ul[data-type="taskList"] li > label {
          margin-top: 0.2rem;
          display: inline-flex;
          align-items: center;
        }
        .ProseMirror ul[data-type="taskList"] li > div {
          flex: 1;
        }
        .ProseMirror ul[data-type="taskList"] input[type="checkbox"] {
          accent-color: hsl(var(--primary));
        }
      `}</style>
    </div>
  );
}

interface ResourceRichTextToolbarProps {
  editor: Editor | null;
  onSwitchToMarkdown: () => void;
  onSelectLocalImage: () => void;
}

function ResourceRichTextToolbar({
  editor,
  onSwitchToMarkdown,
  onSelectLocalImage,
}: ResourceRichTextToolbarProps) {
  const editorState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      isBold: currentEditor.isActive("bold"),
      isItalic: currentEditor.isActive("italic"),
      isParagraph: currentEditor.isActive("paragraph"),
      isHeading: currentEditor.isActive("heading", { level: 1 }),
      isSubheading: currentEditor.isActive("heading", { level: 2 }),
      isLink: currentEditor.isActive("link"),
      isBulletList: currentEditor.isActive("bulletList"),
      isOrderedList: currentEditor.isActive("orderedList"),
      isBlockquote: currentEditor.isActive("blockquote"),
      isInlineCode: currentEditor.isActive("code"),
      isCodeBlock: currentEditor.isActive("codeBlock"),
    }),
  });

  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Enter a link URL", previousUrl ?? "https://");

    if (url === null) return;

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: trimmedUrl })
      .run();
  };

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="overflow-x-auto">
        <div className="flex min-w-max items-center gap-1 text-muted-foreground">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-full bg-muted/60 px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                Style
                <ChevronDown className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuCheckboxItem
                checked={editorState.isParagraph}
                onCheckedChange={() => editor.chain().focus().setParagraph().run()}
              >
                Normal
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={editorState.isHeading}
                onCheckedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              >
                Heading
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={editorState.isSubheading}
                onCheckedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              >
                Subheading
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ToolbarButton onActivate={() => editor.chain().focus().toggleBold().run()} active={editorState.isBold} label="Bold" icon={Bold} />
          <ToolbarButton onActivate={() => editor.chain().focus().toggleItalic().run()} active={editorState.isItalic} label="Italic" icon={Italic} />

          <ToolbarSeparator />

          <ToolbarButton onActivate={() => editor.chain().focus().toggleBulletList().run()} active={editorState.isBulletList} label="Bullet list" icon={List} />
          <ToolbarButton onActivate={() => editor.chain().focus().toggleOrderedList().run()} active={editorState.isOrderedList} label="Numbered list" icon={ListOrdered} />

          <ToolbarSeparator />

          <ToolbarButton onActivate={() => editor.chain().focus().toggleBlockquote().run()} active={editorState.isBlockquote} label="Blockquote" icon={Quote} />
          <ToolbarButton onActivate={() => editor.chain().focus().toggleCodeBlock().run()} active={editorState.isCodeBlock} label="Code block" icon={CurlyBraces} />
          <ToolbarButton onActivate={() => editor.chain().focus().setHorizontalRule().run()} label="Horizontal rule" icon={Minus} />

          <ToolbarSeparator />

          <ToolbarButton onActivate={setLink} active={editorState.isLink} label="Link" icon={LinkIcon} />
          <ToolbarButton onActivate={() => editor.chain().focus().toggleCode().run()} active={editorState.isInlineCode} label="Inline code" icon={CodeXml} />
          <ToolbarButton onActivate={onSelectLocalImage} label="Upload image" icon={ImageIcon} />
        </div>
      </div>

      <button
        type="button"
        onClick={onSwitchToMarkdown}
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-muted px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted/80"
      >
        Switch to Markdown
      </button>
    </div>
  );
}

interface ToolbarButtonProps {
  onActivate: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  icon: React.ElementType;
}

function ToolbarButton({ onActivate, active, disabled, label, icon: Icon }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onMouseDown={(event) => {
        event.preventDefault();
        if (!disabled) onActivate();
      }}
      disabled={disabled}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-[#586d7a] transition-all",
        active
          ? "bg-primary/12 text-primary shadow-sm"
          : "hover:bg-muted/70 hover:text-foreground",
        disabled && "cursor-not-allowed opacity-40"
      )}
      title={label}
      aria-label={label}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function ToolbarSeparator() {
  return <div className="mx-1 h-6 w-px bg-border/80" aria-hidden="true" />;
}
