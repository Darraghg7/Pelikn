import { RuleTester } from 'eslint'
import { describe, it } from 'vitest'
import rule from './no-silent-catch.js'

RuleTester.describe = describe
RuleTester.it = it
const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } })

tester.run('no-silent-catch', rule, {
  valid: [
    'p.catch((e) => reportError(e, "x"))',
    'p.catch(() => { /* offline — retried on the next check */ })',
    'p.catch(() => { setFailed(true) })',
    'p.then(ok, (e) => toast(e.message))',
    'p.then(({ error }) => { if (error) reportError(error) })',
    'p.catch(unsupported)',
    'p.then(() => { /* never rejects */ })',
  ],
  invalid: [
    'p.catch(() => {})',
    'p.catch(()=>{})',
    'p.catch(() => null)',
    'p.catch(() => undefined)',
    'p.catch(function () {})',
    'p.then(ok, () => {})',
    'supabase.from("t").delete().eq("id", 1).then(() => {})',
  ].map((code) => ({ code, errors: [{ messageId: 'silent' }] })),
})
