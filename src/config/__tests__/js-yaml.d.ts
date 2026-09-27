// js-yaml は型定義を同梱しない（@types/js-yaml も未導入）。テストと e2e が使う load / dump だけを宣言する。
declare module 'js-yaml' {
  const yaml: { load(input: string): unknown; dump(value: unknown): string };
  export default yaml;
}
