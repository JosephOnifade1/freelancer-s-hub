import React, { useRef } from 'react';
import { Editor } from '@tiptap/react';
import { 
  Bold, 
  Italic, 
  Strikethrough, 
  Superscript, 
  Type, 
  Link as LinkIcon, 
  Image as ImageIcon, 
  Youtube, 
  List, 
  ListOrdered, 
  AlertCircle, 
  Quote, 
  Code, 
  SquareCode, 
  Table as TableIcon,
  HelpCircle,
  CheckSquare,
  Minus
} from 'lucide-react';
import { cn } from "@/lib/utils";

interface EditorToolbarProps {
  editor: Editor | null;
  onSwitchMode: () => void;
  isMarkdown: boolean;
}

export const EditorToolbar = ({ editor, onSwitchMode, isMarkdown }: EditorToolbarProps) => {
  if (!editor && !isMarkdown) return null;

  const toggleLink = () => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);

    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editor) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      editor.chain().focus().setImage({ src: base64 }).run();
    };
    reader.readAsDataURL(file);
    
    // Reset the input so the same file can be uploaded again if needed
    event.target.value = '';
  };

  const addYoutubeVideo = () => {
    if (!editor) return;
    const url = window.prompt('YouTube URL');
    if (url) {
      editor.chain().focus().setYoutubeVideo({ src: url }).run();
    }
  };

  const addTable = () => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  if (isMarkdown) {
    return (
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Markdown Editor</span>
          <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
        </div>
        <button
          onClick={onSwitchMode}
          className="text-xs font-bold uppercase tracking-wider text-foreground hover:text-primary transition-colors"
        >
          Switch to Rich Text Editor
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-2 py-1.5 border-b bg-muted/30 overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleBold().run()}
          active={editor?.isActive('bold')}
          icon={Bold}
          tooltip="Bold"
        />
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          active={editor?.isActive('italic')}
          icon={Italic}
          tooltip="Italic"
        />
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleStrike().run()}
          active={editor?.isActive('strike')}
          icon={Strikethrough}
          tooltip="Strikethrough"
        />
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleSuperscript().run()}
          active={editor?.isActive('superscript')}
          icon={Superscript}
          tooltip="Superscript"
        />
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor?.isActive('heading', { level: 1 })}
          icon={Type}
          tooltip="Heading"
        />
        
        <div className="w-[1px] h-4 bg-border mx-1" />

        <ToolbarButton
          onClick={toggleLink}
          active={editor?.isActive('link')}
          icon={LinkIcon}
          tooltip="Link"
        />
        <ToolbarButton
          onClick={() => fileInputRef.current?.click()}
          icon={ImageIcon}
          tooltip="Upload Image"
        />
        <ToolbarButton
          onClick={addYoutubeVideo}
          icon={Youtube}
          tooltip="Video"
        />

        <div className="w-[1px] h-4 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          active={editor?.isActive('bulletList')}
          icon={List}
          tooltip="Unordered List"
        />
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          active={editor?.isActive('orderedList')}
          icon={ListOrdered}
          tooltip="Ordered List"
        />
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleTaskList().run()}
          active={editor?.isActive('taskList')}
          icon={CheckSquare}
          tooltip="Task List"
        />

        <div className="w-[1px] h-4 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleMark('spoiler').run()}
          active={editor?.isActive('spoiler')}
          icon={AlertCircle}
          tooltip="Spoiler"
        />
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          active={editor?.isActive('blockquote')}
          icon={Quote}
          tooltip="Quote"
        />
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleCode().run()}
          active={editor?.isActive('code')}
          icon={Code}
          tooltip="Inline Code"
        />
        <ToolbarButton
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
          active={editor?.isActive('codeBlock')}
          icon={SquareCode}
          tooltip="Code Block"
        />
        <ToolbarButton
          onClick={addTable}
          active={editor?.isActive('table')}
          icon={TableIcon}
          tooltip="Table"
        />
        <ToolbarButton
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          icon={Minus}
          tooltip="Horizontal Rule"
        />
      </div>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImageUpload} 
        accept="image/*" 
        className="hidden" 
      />
      <button
        onClick={onSwitchMode}
        className="ml-4 px-3 py-1 text-xs font-bold text-foreground hover:text-primary transition-colors whitespace-nowrap"
      >
        Switch to Markdown
      </button>
    </div>
  );
};

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  icon: React.ElementType;
  tooltip: string;
}

const ToolbarButton = ({ onClick, active, icon: Icon, tooltip }: ToolbarButtonProps) => (
  <button
    type="button"
    onMouseDown={(e) => {
      e.preventDefault();
      onClick();
    }}
    className={cn(
      "p-1.5 rounded-md hover:bg-muted transition-colors group relative",
      active ? "text-primary bg-primary/10" : "text-muted-foreground"
    )}
    title={tooltip}
  >
    <Icon className="h-4 w-4" />
  </button>
);
