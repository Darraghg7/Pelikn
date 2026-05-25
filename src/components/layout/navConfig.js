// Re-export from the JSX source. Vite resolves './navConfig' to this file
// first (before .jsx), so we proxy through to let JSX be processed correctly.
export * from './navConfig.jsx'
