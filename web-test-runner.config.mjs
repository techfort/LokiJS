import { esbuildPlugin } from "@web/dev-server-esbuild";

export default {
  plugins: [esbuildPlugin({ ts: true, target: "auto" })],
  //   files: ["spec/**/*.spec.ts"],
  testRunnerHtml: (testFramework) => `
      <html>
            <head>
                <script src='src/incremental-indexeddb-adapter.js'></script>
                <script type="module" src="${testFramework}"></script>
                <script src='../node_modules/jest-browser-globals/build-es5/index.js'></script> 
            </head>
      </html>
      `,
};
