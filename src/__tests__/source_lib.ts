import { runInContext } from '../index'
import { mockContext } from '../mocks/context'
import { Finished } from '../types'

test('Can run loaded source lib', () => {
  const code = 'factorial(5);'
  const context = mockContext(2)
  const promise = runInContext(code, context, { scheduler: 'preemptive' })
  return promise.then(obj => {
    expect(obj).toMatchSnapshot()
    expect(context.errors).toMatchSnapshot()
    expect(obj.status).toBe('finished')
    expect((obj as Finished).value).toBe(120)
  })
})
