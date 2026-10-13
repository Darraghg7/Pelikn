import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import tsParser from '@typescript-eslint/parser'
import rule from './accessible-name.js'

RuleTester.describe = describe
RuleTester.it = it
const tester = new RuleTester({
  languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
})

tester.run('accessible-name', rule, {
  valid: [
    '<button onClick={f}>Save</button>',
    '<button onClick={f} aria-label="Close"><svg /></button>',
    '<button onClick={f}><svg aria-hidden="true" />{label}</button>',
    '<button onClick={f}><svg /><span className="sr-only">Close</span></button>',
    '<button {...props}><svg /></button>',
    '<Button iconOnly aria-label="Close" leadingIcon={<X />} />',
    '<Button onClick={f}>Save</Button>',
    '<a href="/x" title="Home"><svg /></a>',
    '<img src={u} alt="Logo" />',
    '<img src={u} alt="" />',
    '<label>Name <input value={v} /></label>',
    '<input id="a" />',
    '<input type="hidden" />',
    '<input type="date" aria-label="From" />',
    '<Field label="Start"><input value={v} /></Field>',
    '<Toggle aria-label="Alerts" checked={c} />',
    '<div onClick={f}>Tap me</div>',
  ],
  invalid: [
    { code: '<button onClick={f}><svg /></button>', errors: [{ messageId: 'control' }] },
    { code: '<button onClick={f}>\n  <svg><path d="" /></svg>\n</button>', errors: [{ messageId: 'control' }] },
    { code: '<button onClick={f}><XIcon /></button>', errors: [{ messageId: 'control' }] },
    { code: '<a href="/back"><svg /></a>', errors: [{ messageId: 'control' }] },
    { code: '<div onClick={f}><svg /></div>', errors: [{ messageId: 'control' }] },
    { code: '<div role="button"><svg /></div>', errors: [{ messageId: 'control' }] },
    { code: '<Button iconOnly leadingIcon={<X />} />', errors: [{ messageId: 'iconOnlyButton' }] },
    { code: '<img src={u} />', errors: [{ messageId: 'img' }] },
    { code: '<input type="date" value={v} />', errors: [{ messageId: 'field' }] },
    { code: '<select value={v}><option /></select>', errors: [{ messageId: 'field' }] },
    { code: '<Toggle checked={c} />', errors: [{ messageId: 'switch' }] },
  ],
})
