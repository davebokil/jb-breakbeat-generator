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

// Filter/EQ visual pairing
const FILTER_LOWPASS_BLUR_MAX_PX = 10
const EQ_HIGH_CUT_BLUR_MAX_PX = 6
const EQ_SAT_PCT_PER_DB = 6
const EQ_CONTRAST_PCT_PER_DB = 3
const EDGE_BLUR_PX = 3
const EDGE_MAX_ALPHA = 0.85
// Brightness first (a plain multiplier) to lift the diff map's typically
// dim values (edges rarely exceed ~110/255, flat regions sit near 0) into
// a visible range, THEN contrast to punch black/white separation - if
// contrast ran first, its 128-midpoint stretch would crush those
// below-midpoint values toward black instead of amplifying them.
const EDGE_BRIGHTNESS_PCT = 800
const EDGE_CONTRAST_PCT = 180
const BLOOM_BLUR_MAX_PX = 12
const BLOOM_MAX_ALPHA = 0.55
const ABERRATION_MAX_PX = 4
const ABERRATION_MAX_ALPHA = 0.55
const OVERDRIVE_CONTRAST_PCT = 45
const OVERDRIVE_SATURATE_PCT = 15
const OVERDRIVE_BRIGHTNESS_PCT = 6

// Sine sum (slow "wow" + faster "flutter") rather than Math.random() per
// frame, so it reads as tape wow/flutter rather than glitch/static jitter.
function computeWobbleX(now: number, amount: number) {
  if (amount < 0.01) return 0
  const t = now / 1000
  const wow = Math.sin(t * WOBBLE_WOW_HZ * 2 * Math.PI)
  const flutter = Math.sin(t * WOBBLE_FLUTTER_HZ * 2 * Math.PI) * 0.4
  return (wow + flutter) * WOBBLE_MAX_PX * amount
}

// Combines FILTER's lowpass side and EQ's mid saturate/contrast, high cut,
// low cut, and overdrive's contrast/brightness/saturation crush into a
// single canvas filter string applied to the base frame draw - cheaper
// than separate composite passes since the browser fuses blur+color into
// one pass. The "boost" halves (highpass sharpen, low bloom) need actual
// extra draws below since CSS filters have no sharpen/bloom primitive.
function computeBaseFilterString(filter: number, lowDb: number, midDb: number, highDb: number, drive: number) {
  const blurPx = Math.min(
    FILTER_LOWPASS_BLUR_MAX_PX + EQ_HIGH_CUT_BLUR_MAX_PX,
    (filter < 0 ? -filter * FILTER_LOWPASS_BLUR_MAX_PX : 0)
    + (highDb < 0 ? (-highDb / 12) * EQ_HIGH_CUT_BLUR_MAX_PX : 0),
  )
  const saturatePct = Math.max(0, 100 + midDb * EQ_SAT_PCT_PER_DB + drive * OVERDRIVE_SATURATE_PCT + Math.min(0, lowDb) * 0.5)
  const contrastPct = Math.max(0, 100 + midDb * EQ_CONTRAST_PCT_PER_DB + drive * OVERDRIVE_CONTRAST_PCT + Math.min(0, lowDb))
  const brightnessPct = Math.max(0, 100 + drive * OVERDRIVE_BRIGHTNESS_PCT + Math.min(0, lowDb) * 1.2)
  if (blurPx < 0.05 && saturatePct === 100 && contrastPct === 100 && brightnessPct === 100) return 'none'
  return `blur(${blurPx.toFixed(2)}px) saturate(${saturatePct.toFixed(0)}%) contrast(${contrastPct.toFixed(0)}%) brightness(${brightnessPct.toFixed(0)}%)`
}

// Cheap real-time "edge detect": difference a slightly blurred copy from
// the sharp original - flat regions cancel to near-black, edges (where
// blurring changed pixels the most) stay bright. Lightened onto the base
// frame so as FILTER goes right (or EQ HIGH boosts), smooth areas fall
// away and only edges read through, matching the highpass -> "strip away
// flat areas, leave edges" pairing.
function drawEdgeOverlay(
  mainCtx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  baseCanvas: HTMLCanvasElement,
  baseCtx: CanvasRenderingContext2D,
  blurCanvas: HTMLCanvasElement,
  blurCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
) {
  if (intensity < 0.01) return

  baseCtx.clearRect(0, 0, width, height)
  baseCtx.drawImage(source, 0, 0)

  blurCtx.clearRect(0, 0, width, height)
  blurCtx.filter = `blur(${EDGE_BLUR_PX}px)`
  blurCtx.drawImage(source, 0, 0)
  blurCtx.filter = 'none'

  baseCtx.globalCompositeOperation = 'difference'
  baseCtx.drawImage(blurCanvas, 0, 0)
  baseCtx.globalCompositeOperation = 'source-over'

  mainCtx.save()
  mainCtx.filter = `brightness(${EDGE_BRIGHTNESS_PCT}%) contrast(${EDGE_CONTRAST_PCT}%)`
  mainCtx.globalCompositeOperation = 'lighten'
  mainCtx.globalAlpha = intensity * EDGE_MAX_ALPHA
  mainCtx.drawImage(baseCanvas, 0, 0)
  mainCtx.restore()
}

// Bloom: a blurred, brightened copy screened on top so bright areas glow
// past their edges - the "bass = big soft shapes" half of the LOW band
// pairing. The cut half is folded into computeBaseFilterString's
// brightness/contrast dip instead, since there's no soft glow to remove.
function drawBloomOverlay(ctx: CanvasRenderingContext2D, source: HTMLCanvasElement, lowDb: number) {
  if (lowDb <= 0.01) return
  const t = lowDb / 12
  ctx.save()
  ctx.filter = `blur(${(t * BLOOM_BLUR_MAX_PX).toFixed(2)}px) brightness(140%) saturate(120%)`
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = t * BLOOM_MAX_ALPHA
  ctx.drawImage(source, 0, 0)
  ctx.restore()
}

// Masks a copy of source down to one color channel (multiplying by a pure
// R/G/B color zeroes the other two) and screens it back in at a horizontal
// offset - the classic chromatic-aberration fringe. Driven by overdrive
// alongside the existing tape grain/wobble, as another "dirt" layer on the
// clipping/saturation metaphor.
function drawChannelGhost(
  mainCtx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  scratch: HTMLCanvasElement,
  scratchCtx: CanvasRenderingContext2D,
  width: number,
  height: number,
  maskColor: string,
  dx: number,
  alpha: number,
) {
  scratchCtx.clearRect(0, 0, width, height)
  scratchCtx.drawImage(source, 0, 0)
  scratchCtx.globalCompositeOperation = 'multiply'
  scratchCtx.fillStyle = maskColor
  scratchCtx.fillRect(0, 0, width, height)
  scratchCtx.globalCompositeOperation = 'source-over'

  mainCtx.save()
  mainCtx.globalCompositeOperation = 'screen'
  mainCtx.globalAlpha = alpha
  mainCtx.drawImage(scratch, dx, 0)
  mainCtx.restore()
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
  let filter = 0
  let lowDb = 0
  let midDb = 0
  let highDb = 0

  function setSpeed(value: number) {
    speed = Math.max(0.05, value)
  }

  function setEcho(value: number) {
    echo = Math.min(1, Math.max(0, value))
  }

  function setGrain(value: number) {
    grain = Math.min(1, Math.max(0, value))
  }

  function setFilter(value: number) {
    filter = Math.min(1, Math.max(-1, value))
  }

  function setLowGain(db: number) {
    lowDb = Math.min(12, Math.max(-12, db))
  }

  function setMidGain(db: number) {
    midDb = Math.min(12, Math.max(-12, db))
  }

  function setHighGain(db: number) {
    highDb = Math.min(12, Math.max(-12, db))
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

    // Scratch canvases for the FILTER/EQ visual layer: edgeBase/edgeBlur
    // compute the highpass/HIGH-boost edge map (drawEdgeOverlay), channel
    // is reused for both the red- and blue-shifted chromatic-aberration
    // ghosts (drawChannelGhost).
    const edgeBaseCanvas = document.createElement('canvas')
    edgeBaseCanvas.width = gif.width
    edgeBaseCanvas.height = gif.height
    const edgeBaseCtx = edgeBaseCanvas.getContext('2d')
    const edgeBlurCanvas = document.createElement('canvas')
    edgeBlurCanvas.width = gif.width
    edgeBlurCanvas.height = gif.height
    const edgeBlurCtx = edgeBlurCanvas.getContext('2d')
    const channelCanvas = document.createElement('canvas')
    channelCanvas.width = gif.width
    channelCanvas.height = gif.height
    const channelCtx = channelCanvas.getContext('2d')
    if (!edgeBaseCtx || !edgeBlurCtx || !channelCtx) return

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
      ctx.filter = computeBaseFilterString(filter, lowDb, midDb, highDb, grain)
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
      ctx.filter = 'none'
      ctx.globalAlpha = 1

      // FILTER's highpass side and EQ HIGH's boost side both read as
      // "strip away flat areas, leave edges", so they drive one shared
      // edge overlay rather than stacking two separate effects.
      const edgeIntensity = Math.min(1, Math.max(0, filter) + (highDb > 0 ? (highDb / 12) * 0.5 : 0))
      drawEdgeOverlay(ctx, gifCanvas, edgeBaseCanvas, edgeBaseCtx, edgeBlurCanvas, edgeBlurCtx, gif.width, gif.height, edgeIntensity)

      drawBloomOverlay(ctx, gifCanvas, lowDb)

      if (grain > 0.05) {
        const dx = grain * ABERRATION_MAX_PX
        const alpha = grain * ABERRATION_MAX_ALPHA
        drawChannelGhost(ctx, gifCanvas, channelCanvas, channelCtx, gif.width, gif.height, 'rgb(255,0,0)', dx, alpha)
        drawChannelGhost(ctx, gifCanvas, channelCanvas, channelCtx, gif.width, gif.height, 'rgb(0,0,255)', -dx, alpha)
      }

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

  return { load, stop, setSpeed, setEcho, setGrain, setFilter, setLowGain, setMidGain, setHighGain }
}
