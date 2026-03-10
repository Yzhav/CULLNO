/** ファイルパスから拡張子なしのファイル名を取得 */
export function getBaseName(filePath: string): string {
  return filePath.split(/[/\\]/).pop()?.replace(/\.(tga|png|jpe?g)$/i, '') ?? ''
}
