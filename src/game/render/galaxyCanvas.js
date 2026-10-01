// Render do mapa da galáxia (Canvas 2D) — Space Warlords
// Otimizações: sprites pré-renderizados p/ brilhos (nada de gradiente
// por frame), camada estática do minimapa em offscreen, tudo com culling.
import { GRID_N } from '../sim/galaxy.js'
import { SIMBOLOS } from '../sim/nations.js'

export function viewportMundo(canvas, zoom) {
  const vw = 2 / GRID_N / zoom
  const vh = canvas ? vw * (canvas.height / Math.max(1, canvas.width)) : vw
  return { vw, vh }
}

// ---- sprites de brilho (glow + núcleo) com cache ----
// Cores e tamanhos são de conjuntos pequenos → o cache estabiliza rápido.
const spriteCache = new Map()

function spriteBrilho(cor, ri, gri, nucleo) {
  const key = `${cor}|${ri}|${gri}|${nucleo}`
  let cv = spriteCache.get(key)
  if (cv) return cv
  if (spriteCache.size > 600) spriteCache.clear()
  cv = document.createElement('canvas')
  cv.width = gri * 2
  cv.height = gri * 2
  const ctx = cv.getContext('2d')
  const g = ctx.createRadialGradient(gri, gri, 0, gri, gri, gri)
  g.addColorStop(0, cor)
  g.addColorStop(1, 'transparent')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, gri * 2, gri * 2)
  if (nucleo) {
    ctx.fillStyle =
      nucleo === 'cor' ? cor : nucleo === 'preto' ? '#000' : '#fff'
    ctx.fillRect(gri - ri / 2, gri - ri / 2, ri, ri)
  }
  spriteCache.set(key, cv)
  return cv
}

function blitSprite(ctx, cor, ri, gri, nucleo, px, py) {
  const cv = spriteBrilho(cor, ri, gri, nucleo)
  ctx.drawImage(cv, Math.round(px - gri), Math.round(py - gri))
}

// ---- poeira em espaço de tela ----
const N_GRAOS = 200
const TINTAS = [
  [157, 180, 255],
  [255, 217, 160],
  [255, 179, 200],
]
const DERIVA = [14, 30, 55]

function desenharPoeira(ctx, w, h, cam, agora) {
  for (let i = 0; i < N_GRAOS; i++) {
    const camada = i % 3
    const f = DERIVA[camada]
    const bx = ((i * 0.618034) % 1) * w
    const by = ((i * 0.754878) % 1) * h
    const sx = (((bx - cam.x * f) % w) + w) % w
    const sy = (((by - cam.y * f) % h) + h) % h
    const base = 0.06 + ((i * 0.37) % 0.16)
    const tw = 0.5 + 0.5 * Math.sin(agora / (500 + camada * 260) + i * 2.39)
    const a = base * tw
    const cor = i % 9 < 2 ? TINTAS[i % 3] : null
    if (i % 25 === 0) {
      const c = cor || [255, 255, 255]
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, 6)
      g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${(a * 1.4).toFixed(3)})`)
      g.addColorStop(1, 'transparent')
      ctx.fillStyle = g
      ctx.fillRect(sx - 6, sy - 6, 12, 12)
    }
    if (cor)
      ctx.fillStyle = `rgba(${cor[0]},${cor[1]},${cor[2]},${a.toFixed(3)})`
    else ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`
    const r = i % 17 === 0 ? 2 : 1
    ctx.fillRect(sx, sy, r, r)
  }
}

// ---- glifo 7x7 da nação ----
export function simboloNacao(ctx, tipo, variante, x, y, cor, k = 2.4, fundo = true) {
  if (fundo) {
    ctx.fillStyle = 'rgba(5,5,8,0.72)'
    ctx.beginPath()
    ctx.arc(x, y, 12 * k, 0, Math.PI * 2)
    ctx.fill()
  }
  const mapa = (SIMBOLOS[tipo] || SIMBOLOS.imperio)[variante % 10]
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(k, k)
  ctx.fillStyle = cor
  mapa.forEach((linha, yy) => {
    ;[...linha].forEach((ch, xx) => {
      if (ch === '#') ctx.fillRect((xx - 3.5) * 2, (yy - 3.5) * 2, 2, 2)
    })
  })
  ctx.restore()
}

export function desenharEspaco(
  canvas,
  todasEstrelas,
  cam,
  qx,
  qy,
  zoom,
  agora,
  anomalias = [],
  dip = null,
  zoomMin = 0.08,
) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, w, h)

  const { vw, vh } = viewportMundo(canvas, zoom)
  const vx0 = cam.x - vw / 2
  const vy0 = cam.y - vh / 2

  desenharPoeira(ctx, w, h, cam, agora)

  // nebulosas: fundo difuso (poucas → gradiente direto é barato)
  const escX = w / vw
  for (const a of anomalias) {
    if (a.kind !== 'nebulosa') continue
    if (a.x + a.raio < vx0 || a.x - a.raio > vx0 + vw) continue
    if (a.y + a.raio < vy0 || a.y - a.raio > vy0 + vh) continue
    for (const m of a.manchas) {
      const mx = ((a.x + m.dx * a.raio - vx0) / vw) * w
      const my = ((a.y + m.dy * a.raio - vy0) / vh) * h
      const mr = m.r * a.raio * escX
      if (mr < 1) continue
      const g = ctx.createRadialGradient(mx, my, 0, mx, my, mr)
      g.addColorStop(0, a.cor)
      g.addColorStop(1, 'transparent')
      ctx.globalAlpha = m.a
      ctx.fillStyle = g
      ctx.fillRect(mx - mr, my - mr, mr * 2, mr * 2)
    }
    ctx.globalAlpha = 1
  }

  // carta de navegação (grade + rótulos): some de perto, aparece de longe
  const tChart = Math.min(
    1,
    Math.max(0, (Math.log(4) - Math.log(zoom)) / (Math.log(4) - Math.log(zoomMin))),
  )

  ctx.lineWidth = 1
  if (tChart > 0.01) {
  for (let gx = 0; gx <= GRID_N; gx++) {
    const wx = (gx / GRID_N) * 2 - 1
    if (wx < vx0 - 0.01 || wx > vx0 + vw + 0.01) continue
    const sx = ((wx - vx0) / vw) * w
    const atual = gx === qx || gx === qx + 1
    ctx.strokeStyle = atual
      ? `rgba(251,146,60,${(0.28 * tChart).toFixed(3)})`
      : `rgba(255,255,255,${(0.05 * tChart).toFixed(3)})`
    ctx.beginPath()
    ctx.moveTo(sx, 0)
    ctx.lineTo(sx, h)
    ctx.stroke()
  }
  for (let gy = 0; gy <= GRID_N; gy++) {
    const wy = (gy / GRID_N) * 2 - 1
    if (wy < vy0 - 0.01 || wy > vy0 + vh + 0.01) continue
    const sy = ((wy - vy0) / vh) * h
    const atual = gy === qy || gy === qy + 1
    ctx.strokeStyle = atual
      ? `rgba(251,146,60,${(0.28 * tChart).toFixed(3)})`
      : `rgba(255,255,255,${(0.05 * tChart).toFixed(3)})`
    ctx.beginPath()
    ctx.moveTo(0, sy)
    ctx.lineTo(w, sy)
    ctx.stroke()
  }
  }

  // navegação escrita no mapa: rótulos somem de perto junto com a grade
  if (tChart > 0.01) {
  ctx.textAlign = 'left'
  for (let gx = 0; gx < GRID_N; gx++) {
    const cx0 = (gx / GRID_N) * 2 - 1
    const cx1 = ((gx + 1) / GRID_N) * 2 - 1
    if (cx1 < vx0 || cx0 > vx0 + vw) continue
    for (let gy = 0; gy < GRID_N; gy++) {
      const cy0 = (gy / GRID_N) * 2 - 1
      const cy1 = ((gy + 1) / GRID_N) * 2 - 1
      if (cy1 < vy0 || cy0 > vy0 + vh) continue
      // canto superior esquerdo da célula, preso à tela se fora da vista
      const lx = Math.min(
        Math.max(((cx0 - vx0) / vw) * w + 6, 4),
        w - 60,
      )
      const ly = Math.min(
        Math.max(((cy0 - vy0) / vh) * h + 14, 14),
        h - 8,
      )
      const atualQ = gx === qx && gy === qy
      ctx.font = '9px monospace'
      ctx.fillStyle = atualQ
        ? `rgba(251,146,60,${(0.85 * tChart).toFixed(3)})`
        : `rgba(255,255,255,${(0.28 * tChart).toFixed(3)})`
      ctx.fillText(`Q${gy * GRID_N + gx}`, lx, ly)
      ctx.font = '8px monospace'
      ctx.fillStyle = atualQ
        ? `rgba(251,146,60,${(0.6 * tChart).toFixed(3)})`
        : `rgba(255,255,255,${(0.18 * tChart).toFixed(3)})`
      ctx.fillText(`[${gx},${gy}]`, lx, ly + 11)
    }
  }
  ctx.textAlign = 'left'
  }

  // emblema da facção sobre o território
  if (dip) {
    if (tChart > 0.01) {
      for (const na of dip.nacoes) {
        let x0 = Infinity
        let y0 = Infinity
        let x1 = -Infinity
        let y1 = -Infinity
        for (const p of na.fronteira) {
          const sx = ((p.x - vx0) / vw) * w
          const sy = ((p.y - vy0) / vh) * h
          if (sx < x0) x0 = sx
          if (sy < y0) y0 = sy
          if (sx > x1) x1 = sx
          if (sy > y1) y1 = sy
        }
        const bw = x1 - x0
        const bh = y1 - y0
        if ((!isFinite(bw) || bw < 30) && (!isFinite(bh) || bh < 30)) continue
        const size = Math.min(
          260,
          Math.max(40, Math.min(isFinite(bw) ? bw : 1e9, isFinite(bh) ? bh : 1e9) * 0.45),
        )
        ctx.globalAlpha = tChart * 0.3
        simboloNacao(
          ctx,
          na.tipo,
          na.simbolo,
          (x0 + x1) / 2,
          (y0 + y1) / 2,
          na.cor,
          size / 16,
          false,
        )
      }
      ctx.globalAlpha = 1
    }
  }

  // zoom out: halo aditivo p/ florescer (núcleo galáctico incluso)
  const aditivo = zoom < 1
  if (aditivo) {
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = 0.65 + 0.35 * zoom
  }
  for (const s of todasEstrelas) {
    if (s.x < vx0 - 0.01 || s.x > vx0 + vw + 0.01) continue
    if (s.y < vy0 - 0.01 || s.y > vy0 + vh + 0.01) continue
    const px = ((s.x - vx0) / vw) * w
    const py = ((s.y - vy0) / vh) * h
    const esc = Math.min(1, (zoom / 4) ** 0.65)
    const r0 = s.tamanho * 2.6
    const r = Math.max(1, r0 * esc)
    if (zoom >= 1) {
      const gr = Math.max(2.5, (5 + r0 * 2.2) * esc)
      blitSprite(ctx, s.cor, Math.round(r), Math.round(gr), 'cor', px, py)
      if (zoom >= 3) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.font = '11px monospace'
        ctx.fillText(`S${s.id}`, px + 8, py - 8)
      }
    } else {
      // núcleo colorido + halo curto que encolhe com a distância
      const gr = Math.max(2, Math.min(7, Math.round((1.5 + s.tamanho * 1.1) * (0.45 + 0.55 * zoom) * 2) / 2))
      blitSprite(ctx, s.cor, s.tamanho > 2.2 ? 2 : 1, gr, 'cor', px, py)
    }
    if (dip && zoom >= 1) {
      const di = dip.dono[s.id]
      if (di != null) {
        const na = dip.nacoes[di]
        ctx.strokeStyle = na.cor
        ctx.lineWidth = 1.5
        ctx.strokeRect(px - r / 2 - 4, py - r / 2 - 4, r + 8, r + 8)
        if (na.capital === s.id && zoom >= 1) {
          const sy2 = py - r / 2 - 34
          const pr = 12 * 2.4 + 4 + 3 * Math.sin(agora / 500 + na.id * 1.7)
          ctx.strokeStyle = na.cor
          ctx.globalAlpha = 0.55
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(px, sy2, pr, 0, Math.PI * 2)
          ctx.stroke()
          ctx.globalAlpha = 1
          simboloNacao(ctx, na.tipo, na.simbolo, px, sy2, na.cor)
          if (zoom >= 4) {
            ctx.fillStyle = na.cor
            ctx.fillText(na.nome, px + 26, py - r / 2 - 30)
          }
        }
      }
    }
  }

  if (aditivo) {
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  }

  if (dip) {
    ctx.setLineDash([8, 6])
    for (const na of dip.nacoes) {
      const rx = (na.raio / vw) * w
      const ry = (na.raio / vh) * h
      const nx = ((na.centro.x - vx0) / vw) * w
      const ny = ((na.centro.y - vy0) / vh) * h
      if (nx + rx < 0 || nx - rx > w || ny + ry < 0 || ny - ry > h) continue
      ctx.strokeStyle = na.cor
      ctx.globalAlpha = 0.28
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.ellipse(nx, ny, rx, ry, 0, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    ctx.setLineDash([])
  }

  if (dip) {
    for (const na of dip.nacoes) {
      const f = na.fronteira
      if (!f || f.length < 3) continue
      ctx.beginPath()
      let visivel = false
      for (let i = 0; i < f.length; i++) {
        const sx = ((f[i].x - vx0) / vw) * w
        const sy = ((f[i].y - vy0) / vh) * h
        if (sx > -50 && sx < w + 50 && sy > -50 && sy < h + 50) visivel = true
        if (i === 0) ctx.moveTo(sx, sy)
        else ctx.lineTo(sx, sy)
      }
      if (!visivel) continue
      ctx.closePath()
      ctx.fillStyle = na.cor
      ctx.globalAlpha = 0.07
      ctx.fill()
      ctx.globalAlpha = 0.55
      ctx.strokeStyle = na.cor
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }

  if (dip && zoom < 1) {
    ctx.font = '12px monospace'
    ctx.textAlign = 'center'
    for (const na of dip.nacoes) {
      const nx2 = ((na.centro.x - vx0) / vw) * w
      const ny2 = ((na.centro.y - vy0) / vh) * h
      if (nx2 < 0 || nx2 > w || ny2 < 0 || ny2 > h) continue
      ctx.fillStyle = na.cor
      ctx.fillText(na.nome, nx2, ny2)
    }
    ctx.textAlign = 'left'
  }

  for (const a of anomalias) {
    if (a.kind === 'nebulosa') continue
    if (a.x < vx0 - 0.02 || a.x > vx0 + vw + 0.02) continue
    if (a.y < vy0 - 0.02 || a.y > vy0 + vh + 0.02) continue
    const px = ((a.x - vx0) / vw) * w
    const py = ((a.y - vy0) / vh) * h
    const esca = Math.min(1, (zoom / 4) ** 0.65)
    const r = Math.max(1.5, a.tamanho * 2.6 * esca)
    if (a.kind === 'smbh' || a.kind === 'buraco-negro') {
      const gr = Math.max(4, Math.round((a.kind === 'smbh' ? 52 : 20) * esca))
      blitSprite(ctx, a.cor, Math.round(r), gr, 'preto', px, py)
      ctx.strokeStyle = a.cor
      ctx.lineWidth = a.kind === 'smbh' ? 3 : 2
      ctx.strokeRect(px - r / 2 - 4, py - r / 2 - 4, r + 8, r + 8)
    } else if (a.kind === 'pulsar') {
      const ang = agora / 700 + a.fase
      ctx.strokeStyle = a.cor
      ctx.globalAlpha = 0.4
      ctx.lineWidth = 2
      const L = Math.max(6, 30 * esca)
      ctx.beginPath()
      ctx.moveTo(px - Math.cos(ang) * L, py - Math.sin(ang) * L)
      ctx.lineTo(px + Math.cos(ang) * L, py + Math.sin(ang) * L)
      ctx.stroke()
      ctx.globalAlpha = 1
      const gP = Math.max(3, Math.round(12 * esca))
      blitSprite(ctx, a.cor, Math.round(r), gP, 'branco', px, py)
    } else if (a.kind === 'neutron') {
      const gN = Math.max(2.5, Math.round(10 * esca))
      blitSprite(ctx, a.cor, Math.round(r), gN, 'branco', px, py)
      ctx.fillStyle = '#fff'
      ctx.fillRect(px - r, py - 1, r * 2, 2)
      ctx.fillRect(px - 1, py - r, 2, r * 2)
    } else {
      const gA = Math.max(2.5, Math.round(9 * esca))
      ctx.globalAlpha = 0.5
      blitSprite(ctx, a.cor, Math.round(r), gA, 'cor', px, py)
      ctx.globalAlpha = 1
    }
    if (a.kind === 'smbh' || zoom >= 4) {
      ctx.fillStyle = a.kind === 'smbh' ? '#fb923c' : 'rgba(255,255,255,0.6)'
      ctx.font = '11px monospace'
      ctx.fillText(a.nome, px + 8, py - 8)
    }
  }

  const vg = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.35,
    w / 2, h / 2, Math.max(w, h) * 0.72,
  )
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, w, h)
}

// ---- minimapa: camada estática em offscreen, dinâmica por cima ----
const miniCache = { key: null, cv: null }

function camadaEstatica(galaxia, nacoes, w, h) {
  const key = `${galaxia.seed}:${galaxia.shape}`
  if (miniCache.key === key && miniCache.cv) return miniCache.cv
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  const ctx = cv.getContext('2d')
  ctx.fillStyle = '#101014'
  ctx.fillRect(0, 0, w, h)
  for (const s of galaxia.stars) {
    const px = ((s.x + 1) / 2) * w
    const py = ((s.y + 1) / 2) * h
    const d = Math.min(3, Math.max(1.2, s.tamanho * 0.55))
    ctx.fillStyle = s.cor
    ctx.fillRect(px - d / 2, py - d / 2, d, d)
  }
  for (const a of galaxia.anomalias || []) {
    const px = ((a.x + 1) / 2) * w
    const py = ((a.y + 1) / 2) * h
    ctx.fillStyle = a.cor
    if (a.kind === 'smbh') ctx.fillRect(px - 2, py - 2, 4, 4)
    else if (a.kind === 'nebulosa') {
      ctx.globalAlpha = 0.55
      ctx.fillRect(px - 1.5, py - 1.5, 3, 3)
      ctx.globalAlpha = 1
    } else ctx.fillRect(px - 1, py - 1, 2, 2)
  }
  for (const na of nacoes) {
    const s = galaxia.stars[na.capital]
    if (!s) continue
    const px = ((s.x + 1) / 2) * w
    const py = ((s.y + 1) / 2) * h
    ctx.fillStyle = na.cor
    ctx.fillRect(px - 1.5, py - 1.5, 3, 3)
  }
  miniCache.key = key
  miniCache.cv = cv
  return cv
}

export function desenharMinimapa(canvas, galaxia, qx, qy, cam, zoom, aspect, nacoes = []) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  ctx.drawImage(camadaEstatica(galaxia, nacoes, w, h), 0, 0)
  ctx.strokeStyle = '#fb923c'
  ctx.lineWidth = 2
  ctx.strokeRect(
    (qx / GRID_N) * w,
    (qy / GRID_N) * h,
    w / GRID_N,
    h / GRID_N,
  )
  const vw = 2 / GRID_N / zoom
  const vh = vw * aspect
  const rx = ((cam.x - vw / 2 + 1) / 2) * w
  const ry = ((cam.y - vh / 2 + 1) / 2) * h
  const rw = Math.max(3, (vw / 2) * w)
  const rh = Math.max(2, (vh / 2) * h)
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 1
  ctx.strokeRect(rx, ry, rw, rh)
  const cx = ((cam.x + 1) / 2) * w
  const cy = ((cam.y + 1) / 2) * h
  ctx.fillStyle = '#fff'
  ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3)
}
