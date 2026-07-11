const AUDIO_TRACKS = [
  '/audio/cold.wav',
  '/audio/csl1.wav',
  '/audio/csl2.wav',
  '/audio/dead.wav',
  '/audio/funky.wav',
  '/audio/give.wav',
  '/audio/hustle.wav',
  '/audio/president.wav',
  '/audio/proud.wav',
  '/audio/sp4.wav'
]

const GIFS = [
  '/gifs/flippity.gif',
  '/gifs/moonwalk.gif',
  '/gifs/pan.gif',
  '/gifs/rev.gif',
  '/gifs/spin.gif',
  '/gifs/spinz.gif',
  '/gifs/splitz.gif',
  '/gifs/tap.gif'
]

const LABEL_COLORS = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#800080']

function pickRandom<T>(list: T[], excluding?: T): T {
  if (list.length === 1) return list[0]
  let pick: T
  do {
    pick = list[Math.floor(Math.random() * list.length)]
  } while (pick === excluding)
  return pick
}

export function useBreakbeats() {
  return {
    pickTrack: (excluding?: string) => pickRandom(AUDIO_TRACKS, excluding),
    pickGif: (excluding?: string) => pickRandom(GIFS, excluding),
    pickLabelColor: (excluding?: string) => pickRandom(LABEL_COLORS, excluding)
  }
}
