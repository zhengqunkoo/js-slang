import { getName, OpCodes } from './compiler'

const LDF_MAX_OS_SIZE_OFFSET = 1
const LDF_ADDRESS_OFFSET = 2
const LDF_ENV_EXTENSION_COUNT_OFFSET = 3
const LDCN_VALUE_OFFSET = 1
const LDCB_VALUE_OFFSET = 1

// VIRTUAL MACHINE

// "registers" are the global variables of our machine.
// These contain primitive values (numbers or boolean
// values) or arrays of primitive values

// P is an array that contains an SVML machine program:
// the op-codes of instructions and their arguments
let P: number[] = []
// PC is program counter: index of the next instruction
let PC = 0
// HEAP is array containing all dynamically allocated data structures
let HEAP: any[] = []
// next free slot in heap
let FREE = 0
// OS is address of current environment in HEAP; initially a dummy value
let ENV = -Infinity
// OS is address of current operand stack in HEAP; initially a dummy value
let OS = -Infinity
// temporary value, used by PUSH and POP; initially a dummy value
let RES = -Infinity

// some general-purpose registers
let A: any = 0
let B: any = 0
let C: any = 0
let D: any = 0
let E: any = 0
let F: any = 0
let G: any = 0
let H: any = 0

function show_executing(s: string) {
  window.console.log('', '--- RUN ---' + s)
  window.console.log(PC, 'PC :')
  window.console.log(getName(P[PC]), 'instr:')
}

// for debugging: show all registers
export function show_registers(s: string) {
  show_executing(s)
  window.console.log('', '--- REGISTERS ---')
  window.console.log(RES, 'RES:')
  window.console.log(A, 'A  :')
  window.console.log(B, 'B  :')
  window.console.log(C, 'C  :')
  window.console.log(D, 'D  :')
  window.console.log(E, 'E  :')
  window.console.log(F, 'F  :')
  window.console.log(G, 'G  :')
  window.console.log(H, 'H  :')
  window.console.log(OS, 'OS :')
  window.console.log(ENV, 'ENV:')
  window.console.log(RTS, 'RTS:')
  window.console.log(TOP_RTS, 'TOP_RTS:')
}

// register that says if machine is running
let RUNNING = true

const NORMAL = 0
const DIV_ERROR = 1
// TODO unused
// const OUT_OF_MEMORY_ERROR = 2; // not used yet: memory currently unbounded

let STATE = NORMAL

// general node layout
const TAG_SLOT = 0
const SIZE_SLOT = 1
const FIRST_CHILD_SLOT = 2
const LAST_CHILD_SLOT = 3

// NEW expects tag in A and size in B
function NEW() {
  HEAP[FREE + TAG_SLOT] = A
  HEAP[FREE + SIZE_SLOT] = B
  RES = FREE
  FREE = FREE + B
}

// number nodes layout
//
// 0: tag  = -100
// 1: size = 5
// 2: offset of first child from the tag: 6 (no children)
// 3: offset of last child from the tag: 5 (must be less than first)
// 4: value

const NUMBER_TAG = -100
const NUMBER_SIZE = 5
const NUMBER_VALUE_SLOT = 4

function NEW_NUMBER() {
  C = A
  A = NUMBER_TAG
  B = NUMBER_SIZE
  NEW()
  HEAP[RES + FIRST_CHILD_SLOT] = 6
  HEAP[RES + LAST_CHILD_SLOT] = 5 // no children
  HEAP[RES + NUMBER_VALUE_SLOT] = C
}

// bool nodes layout
//
// 0: tag  = -101
// 1: size = 5
// 2: offset of first child from the tag: 6 (no children)
// 3: offset of last child from the tag: 5 (must be less than first)
// 4: value

const BOOL_TAG = -101
const BOOL_SIZE = 5
const BOOL_VALUE_SLOT = 4

function NEW_BOOL() {
  C = A
  A = BOOL_TAG
  B = BOOL_SIZE
  NEW()
  HEAP[RES + FIRST_CHILD_SLOT] = 6
  HEAP[RES + LAST_CHILD_SLOT] = 5 // no children
  HEAP[RES + BOOL_VALUE_SLOT] = C
}

// undefined nodes layout
//
// 0: tag  = -106
// 1: size = 4
// 2: offset of first child from the tag: 5 (no children)
// 3: offset of last child from the tag: 4 (must be less than first)

const UNDEFINED_TAG = -106
const UNDEFINED_SIZE = 4

function NEW_UNDEFINED() {
  A = UNDEFINED_TAG
  B = UNDEFINED_SIZE
  NEW()
  HEAP[RES + FIRST_CHILD_SLOT] = 5
  HEAP[RES + LAST_CHILD_SLOT] = 4 // no children
}

// operandstack nodes layout
//
// 0: tag  = -105
// 1: size = maximal number of entries + 4
// 2: first child slot = 4
// 3: last child slot = current top of stack; initially 3 (empty stack)
// 4: first entry
// 5: second entry
// ...

const OS_TAG = -105

// expects max size in A
function NEW_OS() {
  C = A
  A = OS_TAG
  B = C + 4
  NEW()
  HEAP[RES + FIRST_CHILD_SLOT] = 4
  // operand stack initially empty
  HEAP[RES + LAST_CHILD_SLOT] = 3
}

// PUSH and POP are convenient subroutines that operate on
// the operand stack OS
// PUSH expects its argument in A
function PUSH_OS() {
  B = HEAP[OS + LAST_CHILD_SLOT] // address of current top of OS
  B = B + 1
  HEAP[OS + LAST_CHILD_SLOT] = B // update address of current top of OS
  HEAP[OS + B] = A
}

// POP puts the top-most value into RES
// uses B
function POP_OS() {
  B = HEAP[OS + LAST_CHILD_SLOT] // address of current top of OS
  HEAP[OS + LAST_CHILD_SLOT] = B - 1 // update address of current top of OS
  RES = HEAP[OS + B]
}

// closure nodes layout
//
// 0: tag  = -103
// 1: size = 8
// 2: offset of first child from the tag: 6 (only environment)
// 3: offset of last child from the tag: 6
// 4: stack size = max stack size needed for executing function body
// 5: address = address of function
// 6: environment
// 7: extension count = number of entries by which to extend env

const CLOSURE_TAG = -103
const CLOSURE_SIZE = 8
const CLOSURE_OS_SIZE_SLOT = 4
const CLOSURE_ADDRESS_SLOT = 5
const CLOSURE_ENV_SLOT = 6
const CLOSURE_ENV_EXTENSION_COUNT_SLOT = 7

// expects stack size in A, address in B, environment extension count in C
function NEW_CLOSURE() {
  E = A
  F = B
  A = CLOSURE_TAG
  B = CLOSURE_SIZE
  NEW()
  A = E
  B = F
  HEAP[RES + FIRST_CHILD_SLOT] = CLOSURE_ENV_SLOT
  HEAP[RES + LAST_CHILD_SLOT] = CLOSURE_ENV_SLOT
  HEAP[RES + CLOSURE_OS_SIZE_SLOT] = A
  HEAP[RES + CLOSURE_ADDRESS_SLOT] = B
  HEAP[RES + CLOSURE_ENV_SLOT] = ENV
  HEAP[RES + CLOSURE_ENV_EXTENSION_COUNT_SLOT] = C
}

// expects closure in A, environment in B
export function SET_CLOSURE_ENV() {
  HEAP[A + CLOSURE_ENV_SLOT] = B
}

// stackframe nodes layout
//
// 0: tag  = -104
// 1: size = 7
// 2: offset of first child from the tag: 5 (environment)
// 3: offset of last child from the tag: 6 (operand stack)
// 4: program counter = return address
// 5: environment
// 6: operand stack

const RTS_FRAME_TAG = -104
const RTS_FRAME_SIZE = 7
const RTS_FRAME_PC_SLOT = 4
const RTS_FRAME_ENV_SLOT = 5
const RTS_FRAME_OS_SLOT = 6

// expects current PC, ENV, OS in their registers
function NEW_RTS_FRAME() {
  A = RTS_FRAME_TAG
  B = RTS_FRAME_SIZE
  NEW()
  HEAP[RES + FIRST_CHILD_SLOT] = RTS_FRAME_ENV_SLOT
  HEAP[RES + LAST_CHILD_SLOT] = RTS_FRAME_OS_SLOT
  HEAP[RES + RTS_FRAME_PC_SLOT] = PC + 2 // next instruction!
  HEAP[RES + RTS_FRAME_ENV_SLOT] = ENV
  HEAP[RES + RTS_FRAME_OS_SLOT] = OS
}

let RTS: any[] = []
let TOP_RTS = -1

// expects stack frame in A
function PUSH_RTS() {
  TOP_RTS = TOP_RTS + 1
  RTS[TOP_RTS] = A
}

// places stack frame into RES
function POP_RTS() {
  RES = RTS[TOP_RTS]
  TOP_RTS = TOP_RTS - 1
}

// environment nodes layout
//
// 0: tag  = -102
// 1: size = number of entries + 4
// 2: first child = 4
// 3: last child
// 4: first entry
// 5: second entry
// ...

const ENV_TAG = -102

// expects number of env entries in A
// changes B
function NEW_ENVIRONMENT() {
  C = A
  A = ENV_TAG
  B = C + 4
  NEW()
  HEAP[RES + FIRST_CHILD_SLOT] = 4
  HEAP[RES + LAST_CHILD_SLOT] = 3 + C
}

// expects env in A, by-how-many in B
function EXTEND() {
  D = A
  A = HEAP[A + SIZE_SLOT] - 4 + B
  NEW_ENVIRONMENT()
  for (B = HEAP[D + FIRST_CHILD_SLOT]; B <= HEAP[D + LAST_CHILD_SLOT]; B = B + 1) {
    HEAP[RES + B] = HEAP[D + B]
  }
}

// debugging: show current heap
function is_node_tag(x: number) {
  return x !== undefined && x <= -100 && x >= -110
}
function node_kind(x: number) {
  return x === NUMBER_TAG
    ? 'number'
    : x === BOOL_TAG
    ? 'bool'
    : x === CLOSURE_TAG
    ? 'closure'
    : x === RTS_FRAME_TAG
    ? 'RTS frame'
    : x === OS_TAG
    ? 'OS'
    : x === ENV_TAG
    ? 'environment'
    : x === UNDEFINED_TAG
    ? 'undefined'
    : ' (unknown node kind)'
}
export function show_heap(s: string) {
  const len = HEAP.length
  let i = 0
  window.console.log('', '--- HEAP --- ' + s)
  while (i < len) {
    window.console.log(
      '',
      i.toString() +
      ': ' +
      HEAP[i].toString() + // TODO is_number(HEAP[i]) &&
        (is_node_tag(HEAP[i]) ? ' (' + node_kind(HEAP[i]) + ')' : '')
    )
    i = i + 1
  }
}

function show_heap_value(address: number) {
  window.console.log(
    '',
    'result: heap node of type = ' +
      node_kind(HEAP[address]) +
      ', value = ' +
      HEAP[address + NUMBER_VALUE_SLOT].toString()
  )
}

// SVMLa implementation

// We implement our machine with an array M that
// contains subroutines. Each subroutine implements
// a machine instruction, using a nullary function.
// The machine can then index into M using the op-codes
// of the machine instructions. To be implementable on
// common hardware, the subroutines have the
// following structure:
// * they have no parameters
// * they do not return any results
// * they do not have local variables
// * they do not call other functions except the
//   subroutines PUSH and POP
// * each line is very simple, for example an array access
// Ideally, each line can be implemented directly with a
// machine instruction of a real computer. In that case,
// the subroutines could become machine language macros,
// and the compiler could generate real machine code.

const M: Array<() => void> = []

M[OpCodes.START] = () => {
  A = 1 // first OS only needs to hold one closure
  NEW_OS()
  OS = RES
  A = 0
  NEW_ENVIRONMENT()
  ENV = RES
  PC = PC + 1
}

M[OpCodes.LDCN] = () => {
  A = P[PC + LDCN_VALUE_OFFSET]
  NEW_NUMBER()
  A = RES
  PUSH_OS()
  PC = PC + 2
}

M[OpCodes.LDCB] = () => {
  A = P[PC + LDCB_VALUE_OFFSET]
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 2
}

M[OpCodes.LDCU] = () => {
  NEW_UNDEFINED()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.PLUS] = () => {
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT] + A
  NEW_NUMBER()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.MINUS] = () => {
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT] - A
  NEW_NUMBER()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.TIMES] = () => {
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT] * A
  NEW_NUMBER()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.EQUAL] = () => {
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT] === A
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.LESS] = () => {
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT] < A
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.GEQ] = () => {
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT] >= A
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.LEQ] = () => {
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT] <= A
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.GREATER] = () => {
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT] > A
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.NOT] = () => {
  POP_OS()
  A = !HEAP[RES + BOOL_VALUE_SLOT]
  NEW_BOOL()
  A = RES
  PUSH_OS()
  PC = PC + 1
}

M[OpCodes.DIV] = () => {
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  E = A
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT] / A
  NEW_NUMBER()
  A = RES
  PUSH_OS()
  PC = PC + 1
  E = E === 0
  if (E) {
    STATE = DIV_ERROR
  }
  if (E) {
    RUNNING = false
  }
}

M[OpCodes.POP] = () => {
  POP_OS()
  PC = PC + 1
}

M[OpCodes.ASSIGN] = () => {
  POP_OS()
  HEAP[ENV + HEAP[ENV + FIRST_CHILD_SLOT] + P[PC + 1]] = RES
  PC = PC + 2
}

M[OpCodes.JOF] = () => {
  POP_OS()
  A = HEAP[RES + NUMBER_VALUE_SLOT]
  if (!A) {
    PC = P[PC + 1]
  }
  if (A) {
    PC = PC + 2
  }
}

M[OpCodes.GOTO] = () => {
  PC = P[PC + 1]
}

M[OpCodes.LDF] = () => {
  A = P[PC + LDF_MAX_OS_SIZE_OFFSET]
  B = P[PC + LDF_ADDRESS_OFFSET]
  C = P[PC + LDF_ENV_EXTENSION_COUNT_OFFSET]
  NEW_CLOSURE()
  A = RES
  PUSH_OS()
  PC = PC + 4
}

M[OpCodes.LD] = () => {
  A = HEAP[ENV + HEAP[ENV + FIRST_CHILD_SLOT] + P[PC + 1]]
  PUSH_OS()
  PC = PC + 2
}

M[OpCodes.CALL] = () => {
  G = P[PC + 1] // lets keep number of arguments in G
  // we peek down OS to get the closure
  F = HEAP[OS + HEAP[OS + LAST_CHILD_SLOT] - G]
  // prep for EXTEND
  A = HEAP[F + CLOSURE_ENV_SLOT]
  // A is now env to be extended
  H = HEAP[A + LAST_CHILD_SLOT]
  // H is now offset of last child slot
  B = HEAP[F + CLOSURE_ENV_EXTENSION_COUNT_SLOT]
  // B is now the environment extension count
  EXTEND() // after this, RES is new env
  E = RES
  H = E + H + G
  // H is now address where last argument goes in new env
  for (C = H; C > H - G; C = C - 1) {
    POP_OS() // now RES has the address of the next arg
    HEAP[C] = RES // copy argument into new env
  }
  POP_OS() // closure is on top of OS; pop it as not needed
  NEW_RTS_FRAME() // saves PC+2, ENV, OS
  A = RES
  PUSH_RTS()
  PC = HEAP[F + CLOSURE_ADDRESS_SLOT]
  A = HEAP[F + CLOSURE_OS_SIZE_SLOT] // closure stack size
  NEW_OS() // uses B and C
  OS = RES
  ENV = E
}

M[OpCodes.RTN] = () => {
  POP_RTS()
  H = RES
  PC = HEAP[H + RTS_FRAME_PC_SLOT]
  ENV = HEAP[H + RTS_FRAME_ENV_SLOT]
  POP_OS()
  A = RES
  OS = HEAP[H + RTS_FRAME_OS_SLOT]
  PUSH_OS()
}

M[OpCodes.DONE] = () => {
  RUNNING = false
}

function run() {
  while (RUNNING) {
    // show_registers("run loop");
    // show_heap("run loop");
    if (M[P[PC]] === undefined) {
      window.console.error(P[PC], 'unknown op-code:')
    } else {
      M[P[PC]]()
    }
  }
  if (STATE === DIV_ERROR) {
    POP_OS()
    window.console.error(RES, 'execution aborted:')
  } else {
    POP_OS()
    show_heap_value(RES)
  }
}

export function runWithP(p: number[]) {
  P = p
  PC = 0
  HEAP = []
  FREE = 0
  ENV = -Infinity
  OS = -Infinity
  RES = -Infinity
  RTS = []
  TOP_RTS = -1
  STATE = NORMAL
  RUNNING = true

  A = 0
  B = 0
  C = 0
  D = 0
  E = 0
  F = 0
  G = 0
  H = 0

  run()
}
