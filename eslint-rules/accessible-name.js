// Flags interactive elements that a screen reader or voice-control user would
// hear as just "button" / "link" / "edit text": an icon-only control with no
// name, an <img> with no alt, or a form field with nothing labelling it.
//
// This is a static check, so it errs on the side of silence: anything it can't
// see through (a spread `{...props}`, a `{label}` expression, a child
// component that may render text) counts as "might have a name".
//
//   <button onClick={close}><XIcon /></button>              ← flagged
//   <button onClick={close} aria-label="Close"><XIcon /></button>   ← fine
//   <Button iconOnly leadingIcon={<XIcon />} />             ← flagged
//   <img src={url} />                                       ← flagged (alt="" is fine for decoration)
//
// Components checked: <button>, <a>, <Button>, <Link>, any element with
// role="button"/"link"/"switch"/…, and a <div>/<span> with onClick. See
// "Accessibility" in README.md.

const NAMING_ATTRS = new Set(['aria-label', 'aria-labelledby', 'title'])
const PRESS_ROLES = new Set(['button', 'link', 'switch', 'checkbox', 'radio', 'tab', 'menuitem', 'option'])
const SKIP_INPUT_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image'])
// Components that draw their own text (or take a `label` prop) — never icon-only on their own.
const TEXT_COMPONENTS = new Set(['Trans'])
// Wrappers that render a <label> around their children (see each page's own Field).
const LABEL_WRAPPERS = new Set(['label', 'Field', 'FormField'])
// Switch components that draw no text of their own: the caller must name them.
const SWITCHES = new Set(['Toggle', 'MiniToggle', 'CalToggle'])

function attr(node, name) {
  return node.attributes.find((a) => a.type === 'JSXAttribute' && a.name.name === name)
}
function hasSpread(node) {
  return node.attributes.some((a) => a.type === 'JSXSpreadAttribute')
}
function staticValue(a) {
  if (!a || !a.value) return a ? true : undefined
  if (a.value.type === 'Literal') return a.value.value
  if (a.value.type === 'JSXExpressionContainer' && a.value.expression.type === 'Literal') return a.value.expression.value
  return undefined // dynamic
}
function hasNamingAttr(node) {
  return node.attributes.some((a) => a.type === 'JSXAttribute' && NAMING_ATTRS.has(a.name.name))
}
// aria-hidden on an element means it isn't announced at all, so it can't give a name.
function isHidden(node) {
  const a = attr(node, 'aria-hidden')
  const v = staticValue(a)
  return v === true || v === 'true'
}

/** True when the element's subtree can't contain any text (or anything dynamic that might be text). */
function isIconOnly(el) {
  for (const child of el.children ?? []) {
    switch (child.type) {
      case 'JSXText':
        if (child.value.trim()) return false
        break
      case 'JSXExpressionContainer':
        if (child.expression.type !== 'JSXEmptyExpression') return false
        break
      case 'JSXFragment':
        if (!isIconOnly(child)) return false
        break
      case 'JSXElement': {
        const o = child.openingElement
        const name = o.name.type === 'JSXIdentifier' ? o.name.name : null
        if (name === null || TEXT_COMPONENTS.has(name)) return false
        if (SWITCHES.has(name)) {
          if (!hasSpread(o) && !hasNamingAttr(o) && !attr(o, 'label')) context.report({ node: o, messageId: 'switch', data: { name } })
          return
        }

        if (name === 'img') { const alt = staticValue(attr(o, 'alt')); if (alt !== '' && alt !== undefined) return false; if (alt === undefined) return false }
        // A child element with its own accessible name or visible-text prop names the parent.
        if (hasNamingAttr(o) || hasSpread(o)) return false
        // sr-only text inside the control
        const cls = staticValue(attr(o, 'className'))
        if (typeof cls === 'string' && /\bsr-only\b/.test(cls)) return false
        if (!isIconOnly(child)) return false
        // A custom component (capitalised) with props other than icon styling might render text.
        if (/^[A-Z]/.test(name) && o.attributes.some((a) => a.type === 'JSXAttribute' && ['label', 'text', 'children', 'name', 'title'].includes(a.name.name))) return false
        break
      }
      default:
        return false
    }
  }
  return true
}

export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      control: 'Icon-only {{what}} has no accessible name. Add aria-label="…" (a short action, e.g. "Close", or "Delete shift: {name}"), or mark a decorative icon aria-hidden="true".',
      iconOnlyButton: '<Button iconOnly> needs an aria-label.',
      img: '<img> needs an alt attribute (alt="" if it is purely decorative).',
      switch: '<{{name}}> needs an aria-label (or label) naming what it controls — it has no text of its own.',
      field: 'Form field has no label. Wrap it in a <label>, give it an id with a matching <label htmlFor>, or add aria-label.',
    },
  },
  create(context) {
    const labelStack = []
    return {
      JSXElement(node) {
        const o = node.openingElement
        if (o.name.type !== 'JSXIdentifier') return
        const name = o.name.name
        if (LABEL_WRAPPERS.has(name)) labelStack.push(node)

        if (SWITCHES.has(name)) {
          if (!hasSpread(o) && !hasNamingAttr(o) && !attr(o, 'label')) context.report({ node: o, messageId: 'switch', data: { name } })
          return
        }

        if (name === 'img') {
          if (!attr(o, 'alt') && !hasSpread(o)) context.report({ node: o, messageId: 'img' })
          return
        }

        if (name === 'input' || name === 'textarea' || name === 'select') {
          if (name === 'input') {
            const t = staticValue(attr(o, 'type'))
            if (typeof t === 'string' && SKIP_INPUT_TYPES.has(t)) return
          }
          if (hasSpread(o) || hasNamingAttr(o) || attr(o, 'id') || attr(o, 'placeholder')) return
          if (labelStack.length) return
          if (isHidden(o)) return
          context.report({ node: o, messageId: 'field' })
          return
        }

        const role = staticValue(attr(o, 'role'))
        const isNative = name === 'button' || name === 'a'
        const isShared = name === 'Button' || name === 'Link'
        const isRole = typeof role === 'string' && PRESS_ROLES.has(role)
        const isClickDiv = (name === 'div' || name === 'span') && attr(o, 'onClick') && !attr(o, 'role')
        if (!isNative && !isShared && !isRole && !isClickDiv) return
        if (isHidden(o) || hasSpread(o) || hasNamingAttr(o)) return

        if (name === 'Button') {
          // leadingIcon/trailingIcon are icons, not names; only children or iconOnly matter.
          const iconOnly = attr(o, 'iconOnly')
          if (iconOnly && staticValue(iconOnly) !== false) { context.report({ node: o, messageId: 'iconOnlyButton' }); return }
          if (!iconOnly && isIconOnly(node) && !attr(o, 'children')) context.report({ node: o, messageId: 'control', data: { what: 'button' } })
          return
        }
        if (isShared && name === 'Link' && !isIconOnly(node)) return
        if (node.children.length === 0 && !isShared) return // self-closing: nothing to judge
        if (isIconOnly(node)) context.report({ node: o, messageId: 'control', data: { what: name === 'a' || name === 'Link' ? 'link' : 'control' } })
      },
      'JSXElement:exit'(node) {
        if (node.openingElement.name.type === 'JSXIdentifier' && LABEL_WRAPPERS.has(node.openingElement.name.name)) labelStack.pop()
      },
    }
  },
}
