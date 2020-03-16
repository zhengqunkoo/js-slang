import fs = require('fs')
import util = require('util')

import { parse } from '../parser/parser'
import { createEmptyContext } from '../createContext'
import { compileToIns } from './svml-compiler'
import { assemble } from './svml-assembler'
import { stringifyProgram } from './util'

interface CliOptions {
  compileTo: 'debug' | 'json' | 'binary' | 'ast'
  sourceChapter: 1 | 2 | 3
  inputFilename: string
}

const readFileAsync = util.promisify(fs.readFile)

// This is a console program. We're going to print.
/* tslint:disable:no-console */

function parseOptions(): CliOptions | null {
  const ret: CliOptions = {
    compileTo: 'binary',
    sourceChapter: 3,
    inputFilename: ''
  }

  let endOfOptions = false
  let error = false
  const args = process.argv.slice(2)
  while (args.length > 0) {
    let option = args[0]
    let argument = args[1]
    let argShiftNumber = 2
    if (!endOfOptions && option.startsWith('--') && option.includes('=')) {
      ;[option, argument] = option.split('=')
      argShiftNumber = 1
    }
    if (!endOfOptions && option.startsWith('-')) {
      switch (option) {
        case '--compile-to':
        case '-t':
          switch (argument) {
            case 'debug':
            case 'json':
            case 'binary':
            case 'ast':
              ret.compileTo = argument
              break
            default:
              console.error('Invalid argument to --compile-to: %s', argument)
              error = true
              break
          }
          args.splice(0, argShiftNumber)
          break
        case '--chapter':
        case '-c':
          const argInt = parseInt(argument, 10)
          if (argInt === 1 || argInt === 2 || argInt === 3) {
            ret.sourceChapter = argInt
          } else {
            console.error('Invalid Source chapter: %d', argInt)
            error = true
          }
          args.splice(0, argShiftNumber)
          break
        case '--':
          endOfOptions = true
          args.shift()
          break
        default:
          console.error('Unknown option %s', option)
          args.shift()
          error = true
          break
      }
    } else {
      if (ret.inputFilename === '') {
        ret.inputFilename = args[0]
      } else {
        console.error('Excess non-option argument: %s', args[0])
        error = true
      }
      args.shift()
    }
  }

  if (ret.inputFilename === '') {
    console.error('No input file specified')
    error = true
  }

  return error ? null : ret
}

async function main() {
  const options = parseOptions()
  if (options == null) {
    process.exitCode = 1
    return
  }

  const source = await readFileAsync(options.inputFilename, 'utf8')
  const context = createEmptyContext(options.sourceChapter, [], null)
  const program = parse(source, context)

  let numWarnings = 0
  let numErrors = 0
  for (const error of context.errors) {
    console.error(
      '[%s] (%d:%d) %s',
      error.severity,
      error.location.start.line,
      error.location.start.column,
      error.explain()
    )
    switch (error.severity) {
      case 'Warning':
        ++numWarnings
        break
      case 'Error':
        ++numErrors
        break
    }
  }

  if (numWarnings > 0 || numErrors > 0) {
    console.error('%d warning(s) and %d error(s) produced.', numWarnings, numErrors)
  }

  if (typeof program === 'undefined') {
    process.exitCode = 1
    return
  }

  if (options.compileTo === 'ast') {
    console.log(JSON.stringify(program, undefined, 2))
    return
  }

  const compiled = compileToIns(program)

  if (options.compileTo === 'debug') {
    console.log(stringifyProgram(compiled).trimRight())
    return
  } else if (options.compileTo === 'json') {
    console.log(JSON.stringify(compiled))
    return
  }

  process.stdout.write(assemble(compiled))
}

main().catch(err => {
  console.error(err)
})
