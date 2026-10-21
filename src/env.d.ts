/// <reference types="astro/client" />

// Vite inlines these as data: URLs; used to embed fonts in the share image.
declare module '*.woff2?inline' {
  const url: string;
  export default url;
}
