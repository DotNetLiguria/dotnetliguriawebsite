// declare module "*.css";
// declare module "*.scss";

declare module "*.module.css";
declare module "*.module.scss";
declare module "*.png";
declare module "*.jpg";

/** Photo files under /Contents (e.g. "speakers/ada_lovelace.jpg"), listed at build time by vite.config.ts. */
declare module "virtual:content-photos" {
    const files: readonly string[];
    export default files;
}

// declare module "*.css" {
//     const classes: { readonly [key: string]: string };
//     export default classes;
// }

/*
declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}
*/

// declare module '*.scss' {
//     const classes: { [key: string]: string };
//     export default classes;
// }
