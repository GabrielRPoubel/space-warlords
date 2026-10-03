import { useEffect, useRef } from 'react'
import { mulberry32 } from '../game/sim/galaxy.js'
import { COR_ELEMENTO, hashStr } from '../game/sim/system.js'

// Ícone pixel art 16×16 por item: mercadorias ganham desenho próprio;
// elementos viram pedra/gás/gota/cristal na cor do elemento.
const S = 16

function px(ctx, x, y, cor) {
  ctx.fillStyle = cor
  ctx.fillRect(x, y, 1, 1)
}

function sombra(c, f) {
  const h = c.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) * f
  const g = parseInt(h.slice(2, 4), 16) * f
  const b = parseInt(h.slice(4, 6), 16) * f
  return `rgb(${r | 0},${g | 0},${b | 0})`
}

const PADROES = {
  ALI: {
    cores: { g: '#2f9e44', G: '#8ce99a', s: '#6b4f2e', S: '#946c3f' },
    linhas: [
      '.......g........',
      '......ggg.......',
      '.....ggGgg......',
      '....ggGGGgg.....',
      '.....ggGgg......',
      '......gGg.......',
      '.......s........',
      '.......s........',
      '.......s........',
      '....sssssss.....',
      '...sSSSSSSSs....',
      '...sSSSSSSSs....',
      '....sssssss.....',
    ],
  },
  COMB: {
    cores: { o: '#b45309', O: '#f59e0b', w: '#ffe8c9' },
    linhas: [
      '......o.........',
      '......oo........',
      '....OOOOOO......',
      '...OOOOOOOO.....',
      '...OWWWWWWO.....',
      '...OWWWWWWO.....',
      '...OOwwwwOO.....',
      '...OOwwwwOO.....',
      '...OOwwwwOO.....',
      '...OWWWWWWO.....',
      '...OWWWWWWO.....',
      '...OOOOOOOO.....',
      '....OOOOOO......',
    ],
  },
  ENE: {
    cores: { e: '#f59e0b', E: '#fde047', W: '#fffbeb' },
    linhas: [
      '........ee......',
      '.......eE.......',
      '......eE........',
      '.....eE.........',
      '....eEEEEEEE....',
      '.......EEEE.....',
      '......EE........',
      '.....EE.........',
      '....EE..........',
      '...EE...........',
      '..EE............',
      '..e.............',
    ],
  },
  LUX: {
    cores: { P: '#6d28d9', p: '#c084fc', W: '#f5f3ff' },
    linhas: [
      '......PPPP......',
      '.....PppppP.....',
      '....PpWpppPp....',
      '...PpppppppP....',
      '...PpppppppP....',
      '...PpppppppP....',
      '....PpppppP.....',
      '.....PpppP......',
      '......PPP.......',
    ],
  },
  PGM: {
    cores: { s: '#4b5563', S: '#cbd5e1', W: '#ffffff' },
    linhas: [
      '.....ssssss.....',
      '....sSSSSSSs....',
      '...sSWSSSSSSs...',
      '..sSSSSSSSSSSs..',
      '..sSSSSSSSSSSs..',
      '..ssssssssssss..',
    ],
  },
  Au: {
    cores: { s: '#92400e', S: '#fbbf24', W: '#fff7d6' },
    linhas: [
      '.....ssssss.....',
      '....sSSSSSSs....',
      '...sSSWSSSSSs...',
      '..sSSSSSSSSSSs..',
      '..sSSSSSSSSSSs..',
      '..ssssssssssss..',
    ],
  },
}

// engrenagem procedural (MAN)
function engrenagem(ctx, cor) {
  const c = '#9aa3b2'
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const tx = Math.round(8 + Math.cos(a) * 6.4)
    const ty = Math.round(8 + Math.sin(a) * 6.4)
    ctx.fillStyle = i < 4 ? '#c7ccd6' : '#7b8494'
    ctx.fillRect(tx - 1, ty - 1, 2, 2)
  }
  for (let y = 2; y < 14; y++)
    for (let x = 2; x < 14; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5)
      if (d > 5.2 || d < 2.2) continue
      ctx.fillStyle = d < 3.2 ? sombra(c, 0.7) : sombra(c, 1 - (d - 3.2) * 0.12)
      ctx.fillRect(x, y, 1, 1)
    }
  ctx.fillStyle = '#e5e7eb'
  ctx.fillRect(4, 4, 1, 1)
  void cor
}

function rocha(ctx, rand, cor) {
  const larguras = []
  for (let y = 0; y < 10; y++) larguras.push(3 + rand() * 3.6)
  for (let y = 0; y < 10; y++) {
    const half = larguras[y]
    const x0 = Math.round(8 - half)
    const x1 = Math.round(8 + half)
    for (let x = x0; x < x1; x++) {
      const f = 0.75 + 0.45 * (1 - y / 10) + (x < 8 ? 0.08 : -0.08)
      px(ctx, x, 3 + y, sombra(cor, f))
    }
  }
  px(ctx, 6, 5, sombra(cor, 1.6))
  px(ctx, 9, 6, sombra(cor, 1.45))
  px(ctx, 10, 10, sombra(cor, 0.6))
  px(ctx, 5, 11, sombra(cor, 0.6))
}

function orbe(ctx, cor) {
  for (let y = 1; y < 15; y++)
    for (let x = 1; x < 15; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5)
      if (d > 6) continue
      const f = 0.55 + 0.55 * (1 - d / 6) + (x + y < 15 ? 0.2 : -0.1)
      px(ctx, x, y, sombra(cor, f))
    }
  px(ctx, 5, 4, sombra(cor, 1.9))
}

function gota(ctx, cor) {
  const larguras = [1, 2, 3, 4, 5, 6, 6, 6, 5, 4, 3, 1]
  larguras.forEach((half, y) => {
    for (let x = 8 - Math.ceil(half / 2); x < 8 + Math.ceil(half / 2); x++) {
      const f = 0.7 + 0.5 * (1 - y / 12) + (x < 8 ? 0.15 : -0.1)
      px(ctx, x, 2 + y, sombra(cor, f))
    }
  })
  px(ctx, 6, 6, sombra(cor, 1.8))
}

function cubo(ctx, cor) {
  for (let y = 3; y < 13; y++)
    for (let x = 3; x < 13; x++) {
      const topo = y < 6
      const esq = x < 6
      px(ctx, x, y, sombra(cor, topo ? 1.35 : esq ? 1.0 : 0.7))
    }
  px(ctx, 4, 4, sombra(cor, 1.7))
}

function carvao(ctx, rand, cor) {
  rocha(ctx, rand, cor)
  for (let i = 0; i < 3; i++) {
    const x = 4 + Math.floor(rand() * 8)
    const y = 4 + Math.floor(rand() * 7)
    px(ctx, x, y, sombra(cor, 1.9))
  }
}

const GASES = new Set(['H', 'He', 'CH4', 'NH3', 'O'])
const CRISTAIS = new Set(['NaCl', 'K'])

function desenhar(canvas, item) {
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, S, S)
  const pad = PADROES[item]
  if (pad) {
    const off = Math.floor((S - pad.linhas.length) / 2)
    pad.linhas.forEach((linha, y) => {
      for (let x = 0; x < linha.length; x++) {
        const ch = linha[x]
        if (ch !== '.') px(ctx, x, y + off, pad.cores[ch])
      }
    })
    return
  }
  const cor = COR_ELEMENTO[item] || '#9aa3b2'
  const rand = mulberry32(hashStr(`${item}:icone`))
  if (item === 'MAN') engrenagem(ctx, cor)
  else if (item === 'H2O') gota(ctx, cor)
  else if (item === 'C') carvao(ctx, rand, cor)
  else if (CRISTAIS.has(item)) cubo(ctx, cor)
  else if (GASES.has(item)) orbe(ctx, cor)
  else rocha(ctx, rand, cor)
}

export default function ItemIcone({ item, size = 26 }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) desenhar(ref.current, item)
  }, [item])
  return (
    <canvas
      ref={ref}
      width={S}
      height={S}
      className="sw-art"
      style={{ width: size, height: size }}
    />
  )
}
