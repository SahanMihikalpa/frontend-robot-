import { useDeferredValue, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'

/**
 * Renders a tutor message as Markdown.
 *
 * The LLM has always answered in Markdown — the lesson prompt in
 * `unified_chat_orchestrator` explicitly asks for `## Key Concepts`,
 * `## Worked Example` and `**bold**` terms — but both learning pages printed
 * the string verbatim, so students read the syntax as literal characters:
 * "## Key Concepts", "**Precision**", "\[ \frac{TP}{TP + FP} \]".
 *
 * Raw HTML is deliberately NOT enabled (react-markdown ignores it unless
 * `rehype-raw` is added), so model output cannot inject markup into the page.
 */

/**
 * The model writes display math as `\[ … \]` and inline math as `\( … \)`,
 * which is LaTeX convention — remark-math only understands the `$` form.
 *
 * The body is copied across untouched, including its leading whitespace, so a
 * formula that sits inside a list item keeps the indentation that binds it to
 * that item. An unterminated opener (mid-stream) simply doesn't match and stays
 * literal until its closer arrives.
 */
function normalizeMath(src: string): string {
  return src
    .replace(/\\\[([\s\S]*?)\\\]/g, (_m, body: string) => `$$${body}$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_m, body: string) => `$${body}$`)
}

const REMARK_PLUGINS = [remarkGfm, remarkMath]

// KaTeX throws on malformed LaTeX by default; a half-written formula from a
// streaming lesson must not blank out the whole bubble, so render it in red
// instead and let the next token fix it.
const REHYPE_PLUGINS: any = [[rehypeKatex, { throwOnError: false, errorColor: '#EF4444' }]]

const COMPONENTS: any = {
  a: ({ node, ...props }: any) => <a {...props} target="_blank" rel="noopener noreferrer" />,
}

export default function TutorMarkdown({ text, className, style }: {
  text: string
  className?: string
  style?: React.CSSProperties
}) {
  // Lessons stream in token by token, and each token would otherwise re-parse
  // the whole document on the main thread. Deferring lets React drop
  // intermediate parses when they can't keep up with the stream.
  const deferred = useDeferredValue(text || '')
  const source = useMemo(() => normalizeMath(deferred), [deferred])

  return (
    <div className={className ? `md-body ${className}` : 'md-body'} style={style}>
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={COMPONENTS}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}
