export type SupportedLang =
  | 'javascript'
  | 'typescript'
  | 'json'
  | 'markdown'
  | 'css'
  | 'html'

export async function formatWithPrettier(code: string, lang: SupportedLang): Promise<string> {
  const prettier = await import('prettier/standalone')
  let parser: string
  let plugins: any[] = []
  switch (lang) {
    case 'javascript':
      parser = 'babel'
      plugins = [await import('prettier/plugins/babel'), await import('prettier/plugins/estree')]
      break
    case 'typescript':
      parser = 'typescript'
      plugins = [await import('prettier/plugins/typescript'), await import('prettier/plugins/estree')]
      break
    case 'json':
      parser = 'json'
      plugins = [await import('prettier/plugins/babel'), await import('prettier/plugins/estree')]
      break
    case 'markdown':
      parser = 'markdown'
      plugins = [await import('prettier/plugins/markdown'), await import('prettier/plugins/estree')]
      break
    case 'css':
      parser = 'css'
      plugins = [await import('prettier/plugins/postcss')]
      break
    case 'html':
      parser = 'html'
      plugins = [await import('prettier/plugins/html'), await import('prettier/plugins/estree')]
      break
  }
  return prettier.format(code, { parser, plugins })
}
