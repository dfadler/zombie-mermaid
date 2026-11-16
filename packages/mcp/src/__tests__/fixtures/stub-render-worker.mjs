// Stand-in render worker for mcp-render-worker.test.ts: misbehaves on demand
// so the real timeout / OOM / respawn paths run without a built dist/.
import { parentPort, threadId } from 'node:worker_threads'

parentPort.on('message', ({ diagram }) => {
  if (diagram === 'hang') for (;;); // synchronous busy loop, like ELK
  if (diagram === 'oom') {
    const keep = []
    for (;;) keep.push(new Array(100_000).fill(Math.random()))
  }
  if (diagram === 'crash') throw new Error('boom') // uncaught: worker 'error' event
  if (diagram === 'exit') process.exit(0)
  if (diagram === 'limit') {
    parentPort.postMessage({
      ok: false,
      name: 'LimitExceededError',
      message: 'maxNodes exceeded: 9 > 1',
      line: undefined,
    })
    return
  }
  if (diagram === 'width') {
    parentPort.postMessage({
      ok: false,
      name: 'AsciiWidthError',
      message: 'stub',
      line: undefined,
      width: [31, 20, true],
    })
    return
  }
  if (diagram === 'throw') {
    parentPort.postMessage({
      ok: false,
      name: 'MermaidParseError',
      message: 'Line 2: bad',
      line: 2,
    })
    return
  }
  parentPort.postMessage({ ok: true, text: `thread ${threadId}` })
})
