declare const __APP_VERSION__: string;

/** The release this client was built from (vite.config.ts reads it from packages/server/Cargo.toml); `dev` outside a build. */
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
