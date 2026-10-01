// Ícones pixel art do menu do jogador (bitmaps, herdam currentColor).
const ESC = 2

function PixelIcone({ mapa }) {
  const sombras = []
  mapa.forEach((linha, y) => {
    ;[...linha].forEach((ch, x) => {
      if (ch === '#') sombras.push(`${x * ESC}px ${y * ESC}px 0 0 currentColor`)
    })
  })
  return (
    <span
      className="sw-px-icone"
      aria-hidden="true"
      style={{
        width: ESC,
        height: ESC,
        background: 'currentColor',
        boxShadow: sombras.join(','),
      }}
    />
  )
}

function Moldura({ mapa, larg }) {
  return (
    <span
      style={{
        display: 'block',
        width: larg * ESC,
        height: mapa.length * ESC,
      }}
    >
      <PixelIcone mapa={mapa} />
    </span>
  )
}

const MAPAS = {
  personagem: [
    '.....###.....',
    '....#####....',
    '....#####....',
    '...#######...',
    '...#######...',
    '....#####....',
    '.....###.....',
    '......#......',
    '...#######...',
    '..#########..',
    '..#########..',
    '.###########.',
    '.###########.',
  ],
  frota: [
    '......#......',
    '.....###.....',
    '.....###.....',
    '....#####....',
    '.............',
    '..#.......#..',
    '.###.....###.',
    '#####...#####',
    '#####...#####',
  ],
  comercio: [
    '#############',
    '#############',
    '##.........##',
    '##.##...##.##',
    '##..##.##..##',
    '##...###...##',
    '##..##.##..##',
    '##.##...##.##',
    '##.........##',
    '#############',
    '#############',
  ],
  navegacao: [
    '....#####....',
    '...##.#.##...',
    '..##..#..##..',
    '..#...#...#..',
    '.#...###...#.',
    '.#...###...#.',
    '##...###...##',
    '.#...###...#.',
    '.#....#....#.',
    '..#.......#..',
    '..##.....##..',
    '...##...##...',
    '....#####....',
  ],
  comunicacoes: [
    '#############',
    '#...........#',
    '#.#########.#',
    '#.#.......#.#',
    '#.#.......#.#',
    '#..#.....#..#',
    '#...#...#...#',
    '#....#.#....#',
    '#.....#.....#',
    '#...........#',
    '#############',
  ],
  nave: [
    '.....#.....',
    '.....#.....',
    '....###....',
    '....###....',
    '...#####...',
    '...#####...',
    '...#####...',
    '..#######..',
    '###..#..###',
    '##...#...##',
    '.....#.....',
    '.....#.....',
  ],
}

export function IconePersonagem() {
  return <Moldura mapa={MAPAS.personagem} larg={13} />
}

export function IconeFrota() {
  return <Moldura mapa={MAPAS.frota} larg={13} />
}

export function IconeComercio() {
  return <Moldura mapa={MAPAS.comercio} larg={13} />
}

export function IconeNavegacao() {
  return <Moldura mapa={MAPAS.navegacao} larg={13} />
}

export function IconeComunicacoes() {
  return <Moldura mapa={MAPAS.comunicacoes} larg={13} />
}

export function IconeNave() {
  return <Moldura mapa={MAPAS.nave} larg={11} />
}
