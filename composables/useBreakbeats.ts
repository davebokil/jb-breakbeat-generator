export interface BreakbeatRecord {
  id: string
  name: string
  title: string
  tracks: string[]
  gifs: string[]
  labelColors: string[]
}

const RECORDS: BreakbeatRecord[] = [
  {
    id: 'james-brown',
    name: 'James Brown',
    title: 'THE GODFATHER OF SOUL BREAKBEAT GENERATOR',
    tracks: [
      '/audio/james-brown/bemyself.wav',
      '/audio/james-brown/cold.wav',
      '/audio/james-brown/csl1.wav',
      '/audio/james-brown/csl2.wav',
      '/audio/james-brown/dead.wav',
      '/audio/james-brown/funky.wav',
      '/audio/james-brown/give.wav',
      '/audio/james-brown/hustle.wav',
      '/audio/james-brown/president.wav',
      '/audio/james-brown/proud.wav',
      '/audio/james-brown/sp4.wav'
    ],
    gifs: [
      '/gifs/james-brown/flippity.gif',
      '/gifs/james-brown/moonwalk.gif',
      '/gifs/james-brown/pan.gif',
      '/gifs/james-brown/rev.gif',
      '/gifs/james-brown/spin.gif',
      '/gifs/james-brown/spinz.gif',
      '/gifs/james-brown/splitz.gif',
      '/gifs/james-brown/tap.gif'
    ],
    labelColors: ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#800080']
  },
  {
    id: 'amen-brother',
    name: 'The Winstons – Amen, Brother',
    title: 'AMEN BROTHER BREAKBEAT GENERATOR',
    tracks: [
      '/audio/amen-brother/amen1.wav',
      '/audio/amen-brother/amen2.wav'
    ],
    gifs: [
      '/gifs/amen-brother/rave.gif'
    ],
    labelColors: ['#c9a227']
  }
]

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
    records: RECORDS,
    pickTrack: (record: BreakbeatRecord, excluding?: string) => pickRandom(record.tracks, excluding),
    pickGif: (record: BreakbeatRecord, excluding?: string) => pickRandom(record.gifs, excluding),
    pickLabelColor: (record: BreakbeatRecord, excluding?: string) => pickRandom(record.labelColors, excluding)
  }
}
