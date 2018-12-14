export { default as createContext } from './createContext'
export { Context, Result } from './types'
export * from './runner'
import { SourceError } from './types'

export function parseError(errors: SourceError[]): string {
  const errorMessagesArr = errors.map(error => {
    const line = error.location ? error.location.start.line : '<unknown>'
    const explanation = error.explain()
    return `Line ${line}: ${explanation}`
  })
  return errorMessagesArr.join('\n')
}
