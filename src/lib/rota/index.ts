/**
 * Rota rules live here. The phone rota and the desktop rota are different
 * screens over the same rules: if you are about to write hours, cost,
 * closed-day, leave, split-shift or publish logic inside a rota page,
 * put it here instead and have both screens call it.
 */
export * from './hours'
export * from './stations'
export * from './week'
