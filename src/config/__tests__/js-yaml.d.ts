// js-yaml は型定義を同梱しない（@types/js-yaml も未導入）。cms-config.test.ts が使う load だけを宣言する。
declare module 'js-yaml' {
  const yaml: { load(input: string): unknown };
  export default yaml;
}
