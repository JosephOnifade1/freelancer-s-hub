import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { cn } from '@/lib/utils';
import { UserHoverCard } from '../UserHoverCard';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer = ({ content, className }: MarkdownRendererProps) => {
  const processedContent = content.replace(/(?:^|\s|\()([ubf]\/[a-zA-Z0-9_]+)\b/g, (match, p1, offset) => {
    // Check if this match is inside a markdown link URL or label
    const before = content.slice(0, offset);
    const isInsideLink = /\[[^\]]*$/.test(before) || /\([^\)]*$/.test(before);
    if (isInsideLink) return match;
    
    // Check if it's already a link by looking at preceding char
    const prevChar = content[offset - 1];
    if (prevChar === '/' || prevChar === '[') return match;

    const start = match.indexOf(p1);
    const prefixChar = match.substring(0, start);
    
    // Normalize prefix: b/ stays b/, u/ and f/ both resolve to /f/
    let targetLink = p1;
    if (p1.startsWith('u/')) {
      targetLink = p1.replace('u/', 'f/');
    }

    return `${prefixChar}[${p1}](/${targetLink})`;
  });

  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none break-words", className)}>
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]} 
        rehypePlugins={[
          rehypeRaw, 
          [rehypeSanitize, {
            ...defaultSchema,
            attributes: {
              ...defaultSchema.attributes,
              '*': ['className', 'style'],
              input: ['type', 'disabled', 'checked'],
              li: ['className'],
              ul: ['className'],
              span: ['data-spoiler', 'className'],
              iframe: ['src', 'allowfullscreen', 'frameborder', 'allow'],
            },
            tagNames: [...(defaultSchema.tagNames || []), 'input', 'u', 'span', 'sup', 'sub', 'iframe']
          }]
        ]}
        components={{
          img: ({ node, ...props }) => (
            <img {...props} className="rounded-lg border border-border my-4 shadow-sm" />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-4 rounded-lg border border-border">
              <table {...props} className="min-w-full divide-y divide-border" />
            </div>
          ),
          th: ({ node, ...props }) => (
            <th {...props} className="px-4 py-2 bg-muted/50 text-left font-bold" />
          ),
          td: ({ node, ...props }) => (
            <td {...props} className="px-4 py-2 border-t border-border" />
          ),
          a: ({ node, ...props }) => {
            const href = props.href || "";
            const isUserLink = (href.startsWith("/u/") || href.startsWith("/f/")) && href.length > 3;
            
            if (isUserLink) {
              const handle = href.replace("/u/", "").replace("/f/", "");
              return <UserHoverCard handle={handle}>{props.children}</UserHoverCard>;
            }
            
            return (
              <a 
                {...props} 
                className="text-primary hover:underline transition-all" 
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
              />
            );
          },
          code: ({ node, inline, ...props }: any) => (
            inline 
              ? <code {...props} className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" />
              : <code {...props} />
          ),
          pre: ({ node, ...props }) => (
            <pre {...props} className="bg-muted p-4 rounded-lg overflow-x-auto my-4 border border-border" />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote {...props} className="border-l-4 border-primary/40 pl-4 italic my-4 text-muted-foreground" />
          ),
          span: ({ node, ...props }: any) => {
            if (props['data-spoiler']) {
              return <span {...props} className="bg-foreground text-transparent hover:bg-muted hover:text-foreground transition-all duration-300 cursor-pointer rounded px-1" />;
            }
            return <span {...props} />;
          }
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};
