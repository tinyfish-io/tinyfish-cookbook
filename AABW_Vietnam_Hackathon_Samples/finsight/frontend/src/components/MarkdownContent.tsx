import React from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownContentProps {
  children: string;
  variant?: 'body' | 'brief' | 'compact';
}

const variantClasses: Record<NonNullable<MarkdownContentProps['variant']>, string> = {
  body: 'fs-markdown fs-markdown-body',
  brief: 'fs-markdown fs-markdown-brief',
  compact: 'fs-markdown fs-markdown-compact',
};

export function MarkdownContent({
  children,
  variant = 'body',
}: MarkdownContentProps) {
  if (!children?.trim()) return null;

  return (
    <div className={variantClasses[variant]}>
      <ReactMarkdown
        components={{
          p: ({ children: c }) => (
            <p className="mb-4 last:mb-0 leading-relaxed text-white/88">{c}</p>
          ),
          strong: ({ children: c }) => (
            <strong className="font-semibold text-white">{c}</strong>
          ),
          em: ({ children: c }) => (
            <em className="italic text-fs-gold-soft">{c}</em>
          ),
          ul: ({ children: c }) => (
            <ul className="mb-4 last:mb-0 space-y-2 list-none pl-0">{c}</ul>
          ),
          li: ({ children: c }) => (
            <li className="leading-relaxed text-white/85">{c}</li>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
