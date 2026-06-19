import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type ChatMarkdownProps = {
  content: string;
  className?: string;
  inverted?: boolean;
};

export function ChatMarkdown({
  content,
  className,
  inverted = false,
}: ChatMarkdownProps) {
  return (
    <div
      className={cn(
        "chat-markdown text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        inverted && "chat-markdown-inverted",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-2"
            >
              {children}
            </a>
          ),
          code: ({ className: codeClassName, children }) => {
            const isBlock = codeClassName?.includes("language-");

            if (isBlock) {
              return (
                <code className={cn("font-mono text-[0.85em]", codeClassName)}>
                  {children}
                </code>
              );
            }

            return (
              <code className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/10">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-lg bg-black/10 p-3 font-mono text-[0.85em] dark:bg-white/10">
              {children}
            </pre>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
