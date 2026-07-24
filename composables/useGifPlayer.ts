// Decodes and renders GIFs onto a canvas frame-by-frame instead of leaving
// playback to the browser's native <img> decoder, so speed (tied to the
// pitch slider) and a ghost-trail echo (tied to the reverb slider) can be
// applied - neither is possible once a GIF is just an <img> the browser owns.
import { decompressFrames, parseGIF, type ParsedFrame } from 'gifuct-js'

interface DecodedGif {
  width: number
  height: number
  frames: ParsedFrame[]
}

// Decoding is pure CPU work keyed only by URL, so cache it across
// plays/replays the same way useLoopPlayer caches decoded audio buffers.
const gifCache = new Map<string, Promise<DecodedGif>>()

function loadGif(url: string): Promise<DecodedGif> {
  let cached = gifCache.get(url)
  if (!cached) {
    cached = fetch(url)
      .then(res => res.arrayBuffer())
      .then((buffer) => {
        const gif = parseGIF(buffer)
        const frames = decompressFrames(gif, true)
        return { width: gif.lsd.width, height: gif.lsd.height, frames }
      })
    gifCache.set(url, cached)
  }
  return cached
}

const MIN_FRAME_DELAY_MS = 20
const HISTORY_LIMIT = 48
const ECHO_SPACING = 3
const MAX_ECHOES = 8

// Tape grain ("overdrive" visual)
const GRAIN_FRAME_COUNT = 3
const GRAIN_FLICKER_INTERVAL_MS = 70
const GRAIN_MAX_ALPHA = 0.35
const GRAIN_TINT_COLOR = 'rgba(120, 72, 20, 1)'
const GRAIN_TINT_MAX_ALPHA = 0.28
const WOBBLE_MAX_PX = 2.5
const WOBBLE_WOW_HZ = 0.6
const WOBBLE_FLUTTER_HZ = 6.5

// Sine sum (slow "wow" + faster "flutter") rather than Math.random() per
// frame, so it reads as tape wow/flutter rather than glitch/static jitter.
function computeWobbleX(now: number, amount: number) {
  if (amount < 0.01) return 0
  const t = now / 1000
  const wow = Math.sin(t * WOBBLE_WOW_HZ * 2 * Math.PI)
  const flutter = Math.sin(t * WOBBLE_FLUTTER_HZ * 2 * Math.PI) * 0.4
  return (wow + flutter) * WOBBLE_MAX_PX * amount
}

function makeNoiseCanvas(width: number, height: number) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const nctx = c.getContext('2d')!
  const imageData = nctx.createImageData(width, height)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.random() * 255
    data[i] = data[i + 1] = data[i + 2] = v
    data[i + 3] = Math.random() * 255
  }
  nctx.putImageData(imageData, 0, 0)
  return c
}

export function useGifPlayer(getCanvas: () => HTMLCanvasElement | null) {
  let token = 0
  let rafId: number | null = null
  let speed = 1
  let echo = 0
  let grain = 0

  function setSpeed(value: number) {
    speed = Math.max(0.05, value)
  }

  function setEcho(value: number) {
    echo = Math.min(1, Math.max(0, value))
  }

  function setGrain(value: number) {
    grain = Math.min(1, Math.max(0, value))
  }

  function stop() {
    token++
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
  }

  async function load(url: string | null) {
    stop()
    const myToken = ++token
    if (!url) return

    const gif = await loadGif(url)
    if (myToken !== token) return
    const canvas = getCanvas()
    if (!canvas) return

    canvas.width = gif.width
    canvas.height = gif.height
    const visibleCtx = canvas.getContext('2d')
    if (!visibleCtx) return

    // Full-frame composite of the GIF's own state (disposal methods etc.),
    // kept off-screen so the echo trail below can be layered independently
    // on top of it without disturbing that composite.
    const gifCanvas = document.createElement('canvas')
    gifCanvas.width = gif.width
    gifCanvas.height = gif.height
    const gifCtx = gifCanvas.getContext('2d')
    const patchCanvas = document.createElement('canvas')
    const patchCtx = patchCanvas.getContext('2d')
    if (!gifCtx || !patchCtx) return

    // Grain textures are pure per-pixel noise, generated once here rather
    // than per frame - the render loop only ever composites these via
    // drawImage, which is GPU-accelerated.
    const grainFrames = Array.from({ length: GRAIN_FRAME_COUNT }, () => makeNoiseCanvas(gif.width, gif.height))
    let grainFrameIndex = 0
    let lastGrainSwapMs = 0

    function drawTapeOverlay(ctx: CanvasRenderingContext2D, now: number) {
      if (now - lastGrainSwapMs > GRAIN_FLICKER_INTERVAL_MS) {
        grainFrameIndex = (grainFrameIndex + 1) % grainFrames.length
        lastGrainSwapMs = now
      }
      ctx.save()
      ctx.globalAlpha = GRAIN_MAX_ALPHA * grain
      ctx.globalCompositeOperation = 'overlay'
      ctx.drawImage(grainFrames[grainFrameIndex], 0, 0)
      ctx.restore()

      ctx.save()
      ctx.globalAlpha = GRAIN_TINT_MAX_ALPHA * grain
      ctx.globalCompositeOperation = 'multiply'
      ctx.fillStyle = GRAIN_TINT_COLOR
      ctx.fillRect(0, 0, gif.width, gif.height)
      ctx.restore()
    }

    let frameIndex = 0
    let elapsedMs = 0
    let lastTime: number | null = null
    let previousFrame: ParsedFrame | null = null
    let restoreSnapshot: HTMLCanvasElement | null = null
    const history: HTMLCanvasElement[] = []

    function disposePreviousFrame() {
      if (!previousFrame) return
      const { left, top, width, height } = previousFrame.dims
      if (previousFrame.disposalType === 2) {
        gifCtx!.clearRect(left, top, width, height)
      } else if (previousFrame.disposalType === 3 && restoreSnapshot) {
        gifCtx!.clearRect(left, top, width, height)
        gifCtx!.drawImage(restoreSnapshot, left, top, width, height, left, top, width, height)
      }
      restoreSnapshot = null
    }

    function drawGifFrame(frame: ParsedFrame) {
      disposePreviousFrame()

      const { left, top, width, height } = frame.dims
      if (frame.disposalType === 3) {
        const snap = document.createElement('canvas')
        snap.width = width
        snap.height = height
        snap.getContext('2d')!.drawImage(gifCanvas, left, top, width, height, 0, 0, width, height)
        restoreSnapshot = snap
      }

      patchCanvas.width = width
      patchCanvas.height = height
      const imageData = patchCtx!.createImageData(width, height)
      imageData.data.set(frame.patch)
      patchCtx!.putImageData(imageData, 0, 0)
      gifCtx!.drawImage(patchCanvas, left, top)

      previousFrame = frame
    }

    function pushHistory() {
      const snap = document.createElement('canvas')
      snap.width = gif.width
      snap.height = gif.height
      snap.getContext('2d')!.drawImage(gifCanvas, 0, 0)
      history.push(snap)
      if (history.length > HISTORY_LIMIT) history.shift()
    }

    function render(now: number) {
      if (myToken !== token) return
      const activeCanvas = getCanvas()
      if (!activeCanvas) return
      const ctx = activeCanvas.getContext('2d')
      if (!ctx) return

      if (lastTime === null) lastTime = now
      elapsedMs += now - lastTime
      lastTime = now

      const frame = gif.frames[frameIndex]
      const delay = Math.max(MIN_FRAME_DELAY_MS, frame.delay || 100) / speed

      if (elapsedMs >= delay) {
        elapsedMs = 0
        drawGifFrame(frame)
        if (echo > 0.01) pushHistory()
        frameIndex = (frameIndex + 1) % gif.frames.length
      }

      ctx.clearRect(0, 0, gif.width, gif.height)

      const numEchoes = Math.round(echo * MAX_ECHOES)
      if (numEchoes > 0 && history.length > 0) {
        for (let i = numEchoes; i >= 1; i--) {
          const idx = history.length - 1 - i * ECHO_SPACING
          if (idx < 0) continue
          ctx.globalAlpha = Math.max(0, echo * 0.7 * (1 - (i - 1) / numEchoes))
          ctx.drawImage(history[idx], 0, 0)
        }
      }

      // Drawing the current frame at full opacity would paint over every
      // pixel of the echoes above (this is a full opaque frame, not a
      // sprite), hiding the trail entirely. Easing off alpha here lets the
      // history bleed through wherever the frame has changed since - static
      // regions look identical either way since old/new pixels match there.
      ctx.globalAlpha = numEchoes > 0 ? 1 - echo * 0.55 : 1
      const wobbleX = computeWobbleX(now, grain)
      if (wobbleX !== 0) {
        // Scoped to its own save/restore so the wobble only offsets the
        // current frame, not the echo history above.
        ctx.save()
        ctx.translate(wobbleX, 0)
        ctx.drawImage(gifCanvas, 0, 0)
        ctx.restore()
      } else {
        ctx.drawImage(gifCanvas, 0, 0)
      }
      ctx.globalAlpha = 1

      if (grain > 0.01) drawTapeOverlay(ctx, now)

      rafId = requestAnimationFrame(render)
    }

    // Draw the first frame immediately rather than waiting a tick so there's
    // no blank flash before the animation loop kicks in.
    drawGifFrame(gif.frames[0])
    frameIndex = 1 % gif.frames.length
    visibleCtx.drawImage(gifCanvas, 0, 0)

    rafId = requestAnimationFrame(render)
  }

  return { load, stop, setSpeed, setEcho, setGrain }
}
