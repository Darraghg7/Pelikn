// Flags promise handlers that throw the error away without saying why:
// `.catch(() => {})`, `.catch(() => null)`, `.then(ok, () => {})`, and
// `.then(() => {})` alone — the idiom for firing a Supabase query, whose
// failure arrives as `{ error }` in the resolved value and is discarded.
//
// Pelikn's worst bugs have been failures nobody saw — a save that "worked", a
// delete toast that lied. Every handler must now either do something with the
// error (reportError, a toast, a fallback) or carry a comment inside it saying
// why ignoring it is safe:
//
//   .catch(() => { /* best-effort prefetch; the real load retries */ })
//
// The comment-inside rule mirrors core `no-empty`, which this config pairs
// with `allowEmptyCatch: false` for try/catch blocks.

const EMPTY_VALUES = new Set(['null', 'undefined'])

function isSilent(fn, sourceCode) {
  if (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression') return false
  if (sourceCode.getCommentsInside(fn).length > 0) return false
  const body = fn.body
  if (body.type === 'BlockStatement') return body.body.length === 0
  if (body.type === 'Literal' && body.value === null) return true
  if (body.type === 'Identifier' && EMPTY_VALUES.has(body.name)) return true
  if (body.type === 'UnaryExpression' && body.operator === 'void') return true
  return false
}

export default {
  meta: {
    type: 'problem',
    docs: { description: 'disallow promise rejection handlers that silently discard the error' },
    messages: {
      silent:
        'This swallows the error silently. Report it (reportError), show it (toast), or put a comment inside the handler saying why it is safe to ignore.',
    },
    schema: [],
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode()
    return {
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== 'MemberExpression' || callee.property.type !== 'Identifier') return
        const name = callee.property.name
        let handler = null
        if (name === 'catch') handler = node.arguments[0]
        else if (name === 'then') handler = node.arguments.length === 1 ? node.arguments[0] : node.arguments[1]
        if (handler && isSilent(handler, sourceCode)) {
          context.report({ node: handler, messageId: 'silent' })
        }
      },
    }
  },
}
