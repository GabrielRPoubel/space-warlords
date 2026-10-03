import { useEffect, useRef } from 'react'
import { mulberry32 } from '../game/sim/galaxy.js'
import { hashStr } from '../game/sim/system.js'

// Pixel art determinística do cinturão de mineração (64×64):
// asteroides do tipo real (M metálico com brilhos, S rochoso, C
// carbonáceo) + estação orbital com painéis solares e feixe de
// mineração quando há estação ativa.
const S = 64

function px(ctx, x, y, cor) {
  ctx.fillStyle = cor
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1)
}
const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

const PALETA = {
  M: { base: [148, 153, 166], luz: [226, 230, 240], esc: [92, 97, 110], brilho: [255, 214, 90] },
  S: { base: [150, 141, 126], luz: [204, 196, 178], esc: [98, 92, 82], brilho: [215, 220, 228] },
  C: { base: [94, 87, 80], luz: [134, 125, 114], esc: [56, 52, 48], brilho: [150, 126, 102] },
}

function asteroide(ctx, rand, ax, ay, raio, pal, tipo) {
  for (let y = ay - raio - 1; y <= ay + raio + 1; y++)
    for (let x = ax - raio - 1; x <= ax + raio + 1; x++) {
      const d = Math.hypot(x - ax, y - ay)
      const borda = raio + (rand() - 0.5) * 1.6
      if (d > borda) continue
      const luz = 0.55 + 0.5 * (1 - d / raio) + 0.25 * (-(x - ax) - (y - ay)) / raio
      const f = Math.max(0.4, Math.min(1.45, luz))
      px(ctx, x, y, rgb(f < 1 ? mix(pal.esc, pal.base, f) : mix(pal.base, pal.luz, f - 1)))
    }
  // brilhos metálicos / veios
  const n = tipo === 'M' ? 4 : tipo === 'S' ? 2 : 1
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2
    const d = rand() * raio * 0.7
    px(ctx, ax + Math.cos(a) * d, ay + Math.sin(a) * d, rgb(pal.brilho))
  }
}

function desenhar(canvas, tipo, seedSistema, nome, ativo) {
  const ctx = canvas.getContext('2d')
  const rand = mulberry32((seedSistema ^ hashStr(`${nome}:cint`)) >>> 0)
  const pal = PALETA[tipo] || PALETA.S
  ctx.fillStyle = '#06070c'
  ctx.fillRect(0, 0, S, S)

  // estrelas de fundo
  for (let i = 0; i < 45; i++) {
    const x = Math.floor(rand() * S)
    const y = Math.floor(rand() * S)
    const a = 0.12 + rand() * 0.5
    ctx.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`
    ctx.fillRect(x, y, 1, 1)
  }

  // asteroides (lado direito/superior; longe da estação no canto)
  const asteroides = []
  for (let i = 0; i < 5; i++) {
    const raio = 2 + Math.floor(rand() * (i % 2 === 0 ? 6 : 4))
    const ax = 30 + Math.floor(rand() * 27)
    const ay = 7 + Math.floor(rand() * 31)
    asteroides.push({ ax, ay })
    asteroide(ctx, rand, ax, ay, raio, pal, tipo)
  }

  // estação no canto inferior esquerdo
  const bx = 6
  const by = 46
  if (ativo) {
    // pernas + plataforma
    ctx.fillStyle = '#5b6270'
    ctx.fillRect(bx + 2, by + 8, 1, 4)
    ctx.fillRect(bx + 8, by + 8, 1, 4)
    ctx.fillRect(bx + 14, by + 8, 1, 4)
    ctx.fillStyle = '#8b93a3'
    ctx.fillRect(bx, by + 6, 18, 2)
    // corpo
    ctx.fillStyle = '#aab2c0'
    ctx.fillRect(bx + 4, by, 10, 6)
    ctx.fillStyle = '#c9cfda'
    ctx.fillRect(bx + 4, by, 10, 1)
    // painéis solares
    ctx.fillStyle = '#3d66c4'
    ctx.fillRect(bx - 4, by + 1, 6, 3)
    ctx.fillRect(bx + 16, by + 1, 6, 3)
    ctx.fillStyle = '#6f9bec'
    ctx.fillRect(bx - 4, by + 1, 2, 3)
    ctx.fillRect(bx + 16, by + 1, 2, 3)
    ctx.fillStyle = '#2b4a94'
    ctx.fillRect(bx - 1, by + 2, 1, 1)
    ctx.fillRect(bx + 19, by + 2, 1, 1)
    // torre de mineração + antena
    ctx.fillStyle = '#d4dae4'
    ctx.fillRect(bx + 8, by - 6, 2, 6)
    ctx.fillStyle = '#ff5d5d'
    ctx.fillRect(bx + 8, by - 7, 2, 1)
    ctx.fillStyle = '#9aa2b0'
    ctx.fillRect(bx + 12, by - 4, 1, 4)
    ctx.fillStyle = '#ffd447'
    ctx.fillRect(bx + 12, by - 5, 1, 1)
    // feixe de mineração até o asteroide mais próximo
    let alvo = asteroides[0]
    let bd = Infinity
    for (const a of asteroides) {
      const d = Math.hypot(a.ax - (bx + 9), a.ay - (by - 7))
      if (d < bd) {
        bd = d
        alvo = a
      }
    }
    const passos = Math.round(bd * 2)
    for (let s = 0; s < passos; s++) {
      const t = s / passos
      const x = bx + 9 + (alvo.ax - (bx + 9)) * t
      const y = by - 7 + (alvo.ay - (by - 7)) * t
      const cor = s % 2 ? 'rgba(255,196,80,0.85)' : 'rgba(255,120,70,0.75)'
      ctx.fillStyle = cor
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1)
    }
    // faíscas na zona de corte
    for (let i = 0; i < 6; i++) {
      const a = rand() * Math.PI * 2
      ctx.fillStyle = 'rgba(255,235,150,0.8)'
      ctx.fillRect(
        Math.round(alvo.ax + Math.cos(a) * 3),
        Math.round(alvo.ay + Math.sin(a) * 3),
        1,
        1,
      )
    }
  } else {
    // sonda de prospecção (sem estação)
    ctx.fillStyle = '#aab2c0'
    ctx.fillRect(bx + 6, by + 6, 4, 3)
    ctx.fillStyle = '#6f9bec'
    ctx.fillRect(bx + 5, by + 7, 1, 1)
    ctx.fillRect(bx + 10, by + 7, 1, 1)
    ctx.fillStyle = '#d4dae4'
    ctx.fillRect(bx + 8, by + 3, 1, 3)
    ctx.fillStyle = '#ff5d5d'
    ctx.fillRect(bx + 8, by + 2, 1, 1)
  }
}

export default function CinturaoArt({ tipo = 'S', seedSistema = 1, nome = '?', ativo = false, size = 200 }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) desenhar(ref.current, tipo, seedSistema, nome, ativo)
  }, [tipo, seedSistema, nome, ativo])
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
