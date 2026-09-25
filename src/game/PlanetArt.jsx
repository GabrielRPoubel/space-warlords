import { useEffect, useRef } from 'react'
import { mulberry32 } from './galaxy.js'
import { hashStr } from './system.js'

// Pixelart determinística do planeta (64×64, ampliada via CSS).
// Mesma seed + mesmo nome = mesma arte sempre.
const S = 64
const R = 29
const CX = 32
const CY = 32

function hexRgb(hex) {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function px(ctx, x, y, rgb) {
  ctx.fillStyle = `rgb(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0})`
  ctx.fillRect(x, y, 1, 1)
}

const shade = (c, f) => [c[0] * f, c[1] * f, c[2] * f]
const mix = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

function dentro(x, y) {
  const dx = x - CX
  const dy = y - CY
  return dx * dx + dy * dy <= R * R
}

// brilho esférico: luz do canto superior esquerdo
function luz(x, y) {
  const dx = (x - CX) / R
  const dy = (y - CY) / R
  const prof = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy))
  const dir = (-dx * 0.6 + -dy * 0.6) * 0.5 + 0.5
  return 0.45 + 0.4 * prof + 0.25 * dir * prof
}

function crateras(ctx, rand, base, n, maxR) {
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2
    const d = rand() * (R - maxR - 1)
    const crx = Math.round(CX + Math.cos(a) * d)
    const cry = Math.round(CY + Math.sin(a) * d)
    const cr = 1 + Math.floor(rand() * maxR)
    for (let y = cry - cr; y <= cry + cr; y++)
      for (let x = crx - cr; x <= crx + cr; x++) {
        if (!dentro(x, y)) continue
        const dd = Math.hypot(x - crx, y - cry)
        if (dd <= cr) px(ctx, x, y, shade(base, 0.55 + (dd / cr) * 0.25))
      }
  }
}

function desenharPlaneta(canvas, corpo, seedSistema) {
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, S, S)
  const rand = mulberry32((seedSistema ^ hashStr(corpo.nome)) >>> 0)
  const base = hexRgb(corpo.cor)
  const tipo = corpo.tipo

  // base esférica
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (!dentro(x, y)) continue
      px(ctx, x, y, shade(base, luz(x, y)))
    }

  if (tipo === 'gasoso') {
    const fase = rand() * 10
    const amp = 2 + rand() * 3
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        if (!dentro(x, y)) continue
        const faixa = Math.sin((y + Math.sin(x * 0.15) * amp) * 0.7 + fase)
        const f = faixa > 0.4 ? 1.18 : faixa < -0.4 ? 0.78 : 1
        px(ctx, x, y, shade(base, luz(x, y) * f))
      }
    // mancha (tipo Grande Mancha Vermelha)
    const mx = CX + Math.round((rand() - 0.5) * R)
    const my = CY + Math.round((rand() - 0.5) * R * 0.8)
    const mr = 4 + Math.floor(rand() * 4)
    const mancha = mix(base, [255, 120, 90], 0.55)
    for (let y = my - mr; y <= my + mr; y++)
      for (let x = mx - mr * 1.5; x <= mx + mr * 1.5; x++) {
        if (!dentro(x, y)) continue
        if ((x - mx) ** 2 / (mr * 1.5) ** 2 + (y - my) ** 2 / mr ** 2 <= 1)
          px(ctx, x, y, shade(mancha, luz(x, y)))
      }
  } else if (tipo === 'oceanico') {
    // continentes
    const verde = [63, 158, 77]
    const deserto = [194, 178, 128]
    for (let i = 0; i < 6; i++) {
      const a = rand() * Math.PI * 2
      const d = rand() * (R - 8)
      const bx = CX + Math.cos(a) * d
      const by = CY + Math.sin(a) * d
      const br = 3 + Math.floor(rand() * 5)
      const cor = rand() < 0.7 ? verde : deserto
      for (let y = Math.floor(by - br); y <= by + br; y++)
        for (let x = Math.floor(bx - br); x <= bx + br; x++) {
          if (!dentro(x, y)) continue
          if (Math.hypot(x - bx, y - by) <= br)
            px(ctx, x, y, shade(cor, luz(x, y)))
        }
    }
    // calotas polares + nuvens
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        if (!dentro(x, y)) continue
        if (y < 7 || y > 56) px(ctx, x, y, shade([240, 244, 248], luz(x, y)))
      }
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(rand() * S)
      const y = Math.floor(rand() * S)
      if (dentro(x, y)) ctx.fillRect(x, y, 2, 1)
    }
  } else if (tipo === 'lava') {
    crateras(ctx, rand, [40, 20, 14], 5, 3)
    // rachaduras incandescentes
    const quente = [255, 210, 60]
    for (let i = 0; i < 4; i++) {
      let x = CX + Math.round((rand() - 0.5) * R * 1.4)
      let y = CY + Math.round((rand() - 0.5) * R * 1.4)
      for (let s = 0; s < 14; s++) {
        if (dentro(x, y)) px(ctx, x, y, quente)
        x += Math.floor(rand() * 3) - 1
        y += Math.floor(rand() * 3) - 1
      }
    }
  } else if (tipo === 'gelado') {
    crateras(ctx, rand, base, 6, 3)
    ctx.fillStyle = 'rgba(240,246,252,0.6)'
    for (let i = 0; i < 12; i++) {
      const x = Math.floor(rand() * S)
      const y = Math.floor(rand() * S)
      if (dentro(x, y)) ctx.fillRect(x, y, 3, 2)
    }
  } else if (tipo === 'estrela') {
    // disco: núcleo branco → cor da classe na borda
    const branco = [255, 252, 240]
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        if (!dentro(x, y)) continue
        const d = Math.hypot(x - CX, y - CY) / R
        px(ctx, x, y, shade(mix(branco, base, d * d), luz(x, y)))
      }
    // granulação + coroa (raios determinísticos)
    for (let i = 0; i < 40; i++) {
      const x = Math.floor(rand() * S)
      const y = Math.floor(rand() * S)
      if (dentro(x, y)) px(ctx, x, y, shade(branco, 0.9 + rand() * 0.3))
    }
    ctx.fillStyle = `rgba(${base[0] | 0},${base[1] | 0},${base[2] | 0},0.85)`
    for (let i = 0; i < 10; i++) {
      const a = rand() * Math.PI * 2
      const len = 4 + Math.floor(rand() * 9)
      for (let s = 0; s < len; s++) {
        const x = Math.round(CX + Math.cos(a) * (R + s))
        const y = Math.round(CY + Math.sin(a) * (R + s))
        if (x >= 0 && x < S && y >= 0 && y < S) ctx.fillRect(x, y, 1, 1)
      }
    }
  } else {
    // rochoso / desértico / anão: crateras
    crateras(ctx, rand, base, tipo === 'ana' ? 12 : 8, 4)
  }
}

export default function PlanetArt({ corpo, seedSistema, size = 132 }) {
  const ref = useRef(null)
  const chave = corpo?.nome ?? '?'
  useEffect(() => {
    if (ref.current && corpo) desenharPlaneta(ref.current, corpo, seedSistema)
  }, [corpo, seedSistema, chave])

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
