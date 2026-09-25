import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  GRID_N,
  SHAPES,
  estrelasDoQuadrante,
  gerarGalaxia,
  novaSeed,
  quadrantDe,
} from '../game/galaxy.js'
import { gerarSistema } from '../game/system.js'
import { gerarNacoes, SIMBOLOS, TITULO } from '../game/nations.js'
import { NOME_ANOMALIA } from '../game/galaxy.js'
import SystemMap from '../game/SystemMap.jsx'

const SAVE_KEY = 'space-warlords-save-v1'
const ZOOM_INICIAL = 4
const ZOOM_MIN = 0.08 // zoom total: galáxia inteira visível
const ZOOM_MAX = 14
const ZOOM_SUAV = 7
const ACCEL = 0.42
const MAXV = 0.12
const ATRITO = 3.0

function lerSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw)
    if (typeof s.seed !== 'number' || !SHAPES.includes(s.shape)) return null
    return s
  } catch {
    return null
  }
}

function centroQuadrante(qx, qy) {
  const x0 = (qx / GRID_N) * 2 - 1
  const x1 = ((qx + 1) / GRID_N) * 2 - 1
  const y0 = (qy / GRID_N) * 2 - 1
  const y1 = ((qy + 1) / GRID_N) * 2 - 1
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }
}

// poeira em espaço de tela: sempre visível, com deriva sutil por camada
// (a antiga, em coords de mundo, sumia no zoom de perto). Tudo
// determinístico por índice: sem estado, sem custo de memória.
const N_GRAOS = 200
const TINTAS = [
  [157, 180, 255], // azulada
  [255, 217, 160], // âmbar
  [255, 179, 200], // rosada
]
const DERIVA = [14, 30, 55] // px por unidade de mundo, por camada

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
      // halo suave nos grãos raros
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

function viewportMundo(canvas, zoom) {
  const vw = 2 / GRID_N / zoom
  const vh = canvas ? vw * (canvas.height / Math.max(1, canvas.width)) : vw
  return { vw, vh }
}

// glifo 7x7 da nação (10 variantes por tipo), grande e opaco:
// pastilha escura + escala 2.4x (~34px). fundo=false p/ marca d'água.
function simboloNacao(ctx, tipo, variante, x, y, cor, k = 2.4, fundo = true) {
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

function desenharEspaco(canvas, todasEstrelas, cam, qx, qy, zoom, agora, anomalias = [], dip = null) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, w, h)

  const { vw, vh } = viewportMundo(canvas, zoom)
  const vx0 = cam.x - vw / 2
  const vy0 = cam.y - vh / 2

  desenharPoeira(ctx, w, h, cam, agora)

  // nebulosas: fundo difuso, antes de todo o resto
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

  ctx.lineWidth = 1
  for (let gx = 0; gx <= GRID_N; gx++) {
    const wx = (gx / GRID_N) * 2 - 1
    if (wx < vx0 - 0.01 || wx > vx0 + vw + 0.01) continue
    const sx = ((wx - vx0) / vw) * w
    const atual = gx === qx || gx === qx + 1
    ctx.strokeStyle = atual
      ? 'rgba(251,146,60,0.28)'
      : 'rgba(255,255,255,0.05)'
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
      ? 'rgba(251,146,60,0.28)'
      : 'rgba(255,255,255,0.05)'
    ctx.beginPath()
    ctx.moveTo(0, sy)
    ctx.lineTo(w, sy)
    ctx.stroke()
  }

  // emblema da facção sobre o território: invisível de perto,
  // quase opaco no zoom out total (interpolação em log = suave)
  if (dip) {
    const t = Math.min(
      1,
      Math.max(0, (Math.log(4) - Math.log(zoom)) / (Math.log(4) - Math.log(ZOOM_MIN))),
    )
    if (t > 0.01) {
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
        ctx.globalAlpha = t * 0.3
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

  for (const s of todasEstrelas) {
    if (s.x < vx0 - 0.01 || s.x > vx0 + vw + 0.01) continue
    if (s.y < vy0 - 0.01 || s.y > vy0 + vh + 0.01) continue
    const px = ((s.x - vx0) / vw) * w
    const py = ((s.y - vy0) / vh) * h
    // tamanho acompanha o zoom (curva suave: encolhe devagar ao afastar)
    const esc = Math.min(1, (zoom / 4) ** 0.65)
    const r0 = s.tamanho * 2.6
    const r = Math.max(1, r0 * esc)
    if (zoom >= 1) {
      const gr = Math.max(2.5, (5 + r0 * 2.2) * esc)
      const g = ctx.createRadialGradient(px, py, 0, px, py, gr)
      g.addColorStop(0, s.cor)
      g.addColorStop(1, 'transparent')
      ctx.fillStyle = g
      ctx.fillRect(px - gr, py - gr, gr * 2, gr * 2)
      ctx.fillStyle = s.cor
      ctx.fillRect(px - r / 2, py - r / 2, r, r)
      if (zoom >= 3) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)'
        ctx.font = '11px monospace'
        ctx.fillText(`S${s.id}`, px + 8, py - 8)
      }
    } else {
      // de longe: ponto seco (2000 gradientes/frame derrubariam o FPS)
      ctx.fillStyle = s.cor
      ctx.fillRect(px - r / 2, py - r / 2, r, r)
    }
    // nação dona: anel colorido + símbolo na capital (só de perto)
    if (dip && zoom >= 1) {
      const di = dip.dono[s.id]
      if (di != null) {
        const na = dip.nacoes[di]
        ctx.strokeStyle = na.cor
        ctx.lineWidth = 1.5
        ctx.strokeRect(px - r / 2 - 4, py - r / 2 - 4, r + 8, r + 8)
        if (na.capital === s.id && zoom >= 1) {
          const sy2 = py - r / 2 - 34
          // anel pulsante chamativo ao redor da pastilha
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

  // círculos de influência (bordas das nações)
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

  // fronteiras concretas: polígono cheio + contorno (influência é o tracejado)
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

  // de longe: nomes das nações nos centroides
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

  // objetos compactos + buracos negros (pulsar anima com o tempo)
  for (const a of anomalias) {
    if (a.kind === 'nebulosa') continue
    if (a.x < vx0 - 0.02 || a.x > vx0 + vw + 0.02) continue
    if (a.y < vy0 - 0.02 || a.y > vy0 + vh + 0.02) continue
    const px = ((a.x - vx0) / vw) * w
    const py = ((a.y - vy0) / vh) * h
    const esca = Math.min(1, (zoom / 4) ** 0.65)
    const r = Math.max(1.5, a.tamanho * 2.6 * esca)
    if (a.kind === 'smbh' || a.kind === 'buraco-negro') {
      const gr = Math.max(4, (a.kind === 'smbh' ? 52 : 20) * esca)
      const g2 = ctx.createRadialGradient(px, py, 0, px, py, gr)
      g2.addColorStop(0, a.cor)
      g2.addColorStop(1, 'transparent')
      ctx.fillStyle = g2
      ctx.fillRect(px - gr, py - gr, gr * 2, gr * 2)
      ctx.fillStyle = '#000'
      ctx.fillRect(px - r / 2, py - r / 2, r, r)
      ctx.strokeStyle = a.cor
      ctx.lineWidth = a.kind === 'smbh' ? 3 : 2
      ctx.strokeRect(px - r / 2 - 4, py - r / 2 - 4, r + 8, r + 8)
    } else if (a.kind === 'pulsar') {
      const fase = [...a.id].reduce((t, c) => t + c.charCodeAt(0), 0)
      const ang = agora / 700 + fase
      ctx.strokeStyle = a.cor
      ctx.globalAlpha = 0.4
      ctx.lineWidth = 2
      const L = Math.max(6, 30 * esca)
      ctx.beginPath()
      ctx.moveTo(px - Math.cos(ang) * L, py - Math.sin(ang) * L)
      ctx.lineTo(px + Math.cos(ang) * L, py + Math.sin(ang) * L)
      ctx.stroke()
      ctx.globalAlpha = 1
      const gP = Math.max(3, 12 * esca)
      const g2 = ctx.createRadialGradient(px, py, 0, px, py, gP)
      g2.addColorStop(0, a.cor)
      g2.addColorStop(1, 'transparent')
      ctx.fillStyle = g2
      ctx.fillRect(px - gP, py - gP, gP * 2, gP * 2)
      ctx.fillStyle = '#fff'
      ctx.fillRect(px - r / 2, py - r / 2, r, r)
    } else if (a.kind === 'neutron') {
      // brilho + centelha em cruz: identifica a estrela de nêutrons
      const gN = Math.max(2.5, 10 * esca)
      const g2 = ctx.createRadialGradient(px, py, 0, px, py, gN)
      g2.addColorStop(0, a.cor)
      g2.addColorStop(1, 'transparent')
      ctx.fillStyle = g2
      ctx.fillRect(px - gN, py - gN, gN * 2, gN * 2)
      ctx.fillStyle = '#fff'
      ctx.fillRect(px - r / 2, py - r / 2, r, r)
      ctx.fillRect(px - r, py - 1, r * 2, 2)
      ctx.fillRect(px - 1, py - r, 2, r * 2)
    } else {
      // anã branca: brilho contido de corpo morto
      ctx.globalAlpha = 0.5
      const gA = Math.max(2.5, 9 * esca)
      const g2 = ctx.createRadialGradient(px, py, 0, px, py, gA)
      g2.addColorStop(0, a.cor)
      g2.addColorStop(1, 'transparent')
      ctx.fillStyle = g2
      ctx.fillRect(px - gA, py - gA, gA * 2, gA * 2)
      ctx.globalAlpha = 1
      ctx.fillStyle = a.cor
      ctx.fillRect(px - r / 2, py - r / 2, r, r)
    }
    if (a.kind === 'smbh' || zoom >= 4) {
      ctx.fillStyle = a.kind === 'smbh' ? '#fb923c' : 'rgba(255,255,255,0.6)'
      ctx.font = '11px monospace'
      ctx.fillText(a.nome, px + 8, py - 8)
    }
  }

  // vinheta sutil nas bordas
  const vg = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.35,
    w / 2, h / 2, Math.max(w, h) * 0.72,
  )
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, w, h)
}

function desenharMinimapa(canvas, galaxia, qx, qy, cam, zoom, aspect, nacoes = []) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  ctx.fillStyle = '#101014'
  ctx.fillRect(0, 0, w, h)
  for (const s of galaxia.stars) {
    const px = ((s.x + 1) / 2) * w
    const py = ((s.y + 1) / 2) * h
    // ponto proporcional à classe: gigantes aparecem, anãs somem
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
  // capitais com a cor da nação
  for (const na of nacoes) {
    const s = galaxia.stars[na.capital]
    if (!s) continue
    const px = ((s.x + 1) / 2) * w
    const py = ((s.y + 1) / 2) * h
    ctx.fillStyle = na.cor
    ctx.fillRect(px - 1.5, py - 1.5, 3, 3)
  }
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

export default function GalaxyMap() {
  const [save, setSave] = useState(() => lerSave())
  const [tmpSeed, setTmpSeed] = useState(1337)
  const [tmpShape, setTmpShape] = useState('espiral')

  const seed = save?.seed ?? tmpSeed
  const shape = save?.shape ?? tmpShape
  const [qx, setQx] = useState(() => save?.qx ?? 5)
  const [qy, setQy] = useState(() => save?.qy ?? 5)
  const [cam, setCam] = useState(() => {
    if (save?.camX !== undefined) return { x: save.camX, y: save.camY }
    return centroQuadrante(save?.qx ?? 5, save?.qy ?? 5)
  })
  const [vel, setVel] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(() => save?.zoom ?? ZOOM_INICIAL)
  const [selId, setSelId] = useState(null)
  const [selAnom, setSelAnom] = useState(null)
  const [selNacao, setSelNacao] = useState(null)
  const [sistema, setSistema] = useState(null)

  const mainRef = useRef(null)
  const miniRef = useRef(null)
  const camRef = useRef(cam)
  camRef.current = cam
  const velRef = useRef(vel)
  velRef.current = vel
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const zoomAlvo = useRef(zoom)
  const qRef = useRef({ qx, qy })
  qRef.current = { qx, qy }
  const teclas = useRef(new Set())
  const sistemaRef = useRef(null)
  sistemaRef.current = sistema
  const selRef = useRef(null)
  selRef.current = selId
  const selAnomRef = useRef(null)
  selAnomRef.current = selAnom
  const selNacaoRef = useRef(null)
  selNacaoRef.current = selNacao
  const dipRef = useRef(null)

  const galaxia = useMemo(() => gerarGalaxia(seed, shape), [seed, shape])
  const estrelas = useMemo(
    () => estrelasDoQuadrante(galaxia, qx, qy),
    [galaxia, qx, qy],
  )
  const galRef = useRef(galaxia)
  galRef.current = galaxia

  const dip = useMemo(() => {
    const d = gerarNacoes(seed, galaxia.stars)
    const cap = {}
    d.nacoes.forEach((na) => {
      cap[na.capital] = na
    })
    return { ...d, cap }
  }, [seed, galaxia])
  dipRef.current = dip

  const estrelaSel =
    selId != null ? galaxia.stars.find((s) => s.id === selId) : null
  const sistemaPrev = estrelaSel ? gerarSistema(seed, estrelaSel) : null

  const aplicarZoom = useCallback((fator) => {
    zoomAlvo.current = Math.min(
      ZOOM_MAX,
      Math.max(ZOOM_MIN, zoomAlvo.current * fator),
    )
  }, [])

  const voltarGalaxia = useCallback(() => {
    const e = sistemaRef.current?.estrela
    if (e) {
      const q = quadrantDe(e.x, e.y)
      setQx(q.qx)
      setQy(q.qy)
      camRef.current = { x: e.x, y: e.y }
      setCam({ x: e.x, y: e.y })
      velRef.current = { x: 0, y: 0 }
      setVel({ x: 0, y: 0 })
    }
    setSistema(null)
  }, [])

  // restaura sistema aberto (reload com sistema no save)
  useEffect(() => {
    if (save?.sistemaId != null && !sistemaRef.current) {
      const e = galaxia.stars.find((s) => s.id === save.sistemaId)
      if (e) setSistema({ estrela: e, dados: gerarSistema(seed, e) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save, galaxia])

  useEffect(() => {
    const ajustar = () => {
      if (mainRef.current) {
        mainRef.current.width = window.innerWidth
        mainRef.current.height = window.innerHeight
      }
    }
    ajustar()
    window.addEventListener('resize', ajustar)
    return () => window.removeEventListener('resize', ajustar)
  }, [!!save, !!sistema])

  useEffect(() => {
    if (!save) return
    const canvas = mainRef.current
    if (!canvas) return
    const fn = (e) => {
      e.preventDefault()
      aplicarZoom(Math.exp(-e.deltaY * 0.0015))
    }
    canvas.addEventListener('wheel', fn, { passive: false })
    return () => canvas.removeEventListener('wheel', fn)
  }, [save, aplicarZoom, sistema])

  useEffect(() => {
    if (!save) return
    let raf = 0
    let ultimo = performance.now()
    let frame = 0
    const passo = (agora) => {
      try {
        const dt = Math.min(0.05, (agora - ultimo) / 1000)
        ultimo = agora
      if (!sistemaRef.current) {
        frame++

        const zt = zoomAlvo.current
        let zc = zoomRef.current
        // interpolação em log: suave de 0.1x a 14x
        if (Math.abs(Math.log(zt / zc)) > 0.002) {
          zc = Math.exp(
            Math.log(zc) +
              (Math.log(zt) - Math.log(zc)) * (1 - Math.exp(-ZOOM_SUAV * dt)),
          )
          if (Math.abs(Math.log(zt / zc)) <= 0.002) zc = zt
          zoomRef.current = zc
        }

        const t = teclas.current
        let ix = 0
        let iy = 0
        if (t.has('w') || t.has('arrowup')) iy -= 1
        if (t.has('s') || t.has('arrowdown')) iy += 1
        if (t.has('a') || t.has('arrowleft')) ix -= 1
        if (t.has('d') || t.has('arrowright')) ix += 1
        if (ix !== 0 && iy !== 0) {
          ix /= Math.SQRT2
          iy /= Math.SQRT2
        }

        // velocidade acompanha o zoom: de longe o voo é proporcionalmente rápido
        const fV = Math.min(12, Math.max(1, 4 / zc))
        const acc = ACCEL * fV
        const max = MAXV * fV
        let v = { ...velRef.current }
        v.x += ix * acc * dt
        v.y += iy * acc * dt
        const damp = Math.exp(-ATRITO * dt)
        v.x *= damp
        v.y *= damp
        const sp = Math.hypot(v.x, v.y)
        if (sp > max) {
          v.x = (v.x / sp) * max
          v.y = (v.y / sp) * max
        }
        if (ix === 0 && iy === 0 && sp < 0.002) {
          v.x = 0
          v.y = 0
        }

        const canvas = mainRef.current
        const { vw, vh } = viewportMundo(canvas, zc)
      let nx = camRef.current.x + v.x * dt
      let ny = camRef.current.y + v.y * dt
      // zoom total: viewport maior que a galáxia → centraliza
      nx = vw >= 2 ? 0 : Math.min(1 - vw / 2, Math.max(-1 + vw / 2, nx))
      ny = vh >= 2 ? 0 : Math.min(1 - vh / 2, Math.max(-1 + vh / 2, ny))
        if (nx !== camRef.current.x + v.x * dt) v.x = 0
        if (ny !== camRef.current.y + v.y * dt) v.y = 0

      velRef.current = v
      camRef.current = { x: nx, y: ny }
        if (frame % 6 === 0) {
          setCam(camRef.current)
          setVel({ ...v })
          setZoom(zc)
          const q = quadrantDe(nx, ny)
          if (q.qx !== qRef.current.qx || q.qy !== qRef.current.qy) {
            setQx(q.qx)
            setQy(q.qy)
          }
        }

        if (canvas) {
          const qc = quadrantDe(nx, ny)
          desenharEspaco(
            canvas,
            galRef.current.stars,
            camRef.current,
            qc.qx,
            qc.qy,
            zc,
            agora,
            galRef.current.anomalias || [],
            dip,
          )
        }
      }
      } catch (err) {
        // nunca deixa o loop morrer em silêncio: loga e segue no próx. frame
        console.error('[space-warlords] frame pulado:', err)
      }
      raf = requestAnimationFrame(passo)
    }
    raf = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(raf)
  }, [save, galaxia])

  useEffect(() => {
    if (!save || !miniRef.current || sistema) return
    const main = mainRef.current
    const aspect = main && main.width > 0 ? main.height / main.width : 9 / 16
    desenharMinimapa(miniRef.current, galaxia, qx, qy, cam, zoom, aspect, dip.nacoes)
  }, [save, galaxia, qx, qy, cam, zoom, sistema, dip])

  useEffect(() => {
    if (!save) return
    const id = setTimeout(() => {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          seed,
          shape,
          qx,
          qy,
          camX: cam.x,
          camY: cam.y,
          zoom,
          sistemaId: sistema?.estrela.id ?? null,
          salvoEm: Date.now(),
        }),
      )
    }, 500)
    return () => clearTimeout(id)
  }, [cam, qx, qy, save, seed, shape, zoom, sistema])

  useEffect(() => {
    if (!save) return
    const down = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return
      const k = e.key.toLowerCase()
      if (sistemaRef.current) return // SystemMap cuida do Esc
      // Esc fecha confirmação/ficha; o resto (WASD/zoom) continua livre
      if (
        k === 'escape' &&
        (selRef.current != null ||
          selAnomRef.current != null ||
          selNacaoRef.current != null)
      ) {
        e.preventDefault()
        setSelId(null)
        setSelAnom(null)
        setSelNacao(null)
        return
      }
      if (
        ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)
      ) {
        e.preventDefault()
        teclas.current.add(k)
        return
      }
      if (k === '+' || k === '=' || k === 'add') {
        e.preventDefault()
        aplicarZoom(1.15)
      } else if (k === '-' || k === '_' || k === 'subtract') {
        e.preventDefault()
        aplicarZoom(1 / 1.15)
      }
    }
    const up = (e) => teclas.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [save, aplicarZoom])

  const irParaQuadrante = useCallback((nx, ny) => {
    setQx(nx)
    setQy(ny)
    const c = centroQuadrante(nx, ny)
    camRef.current = c
    velRef.current = { x: 0, y: 0 }
    setVel({ x: 0, y: 0 })
    setCam(c)
  }, [])

  const clicarMinimapa = (e) => {
    const rect = miniRef.current.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * GRID_N
    const py = ((e.clientY - rect.top) / rect.height) * GRID_N
    irParaQuadrante(
      Math.min(GRID_N - 1, Math.max(0, Math.floor(px))),
      Math.min(GRID_N - 1, Math.max(0, Math.floor(py))),
    )
  }

  // clique: estrela → confirmação · anomalia → ficha (tolerância de 26px)
  const clicarEstrela = (e) => {
    const canvas = mainRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const z = zoomRef.current
    const { vw, vh } = viewportMundo(canvas, z)
    const c = camRef.current
    const wx = c.x - vw / 2 + ((e.clientX - rect.left) / rect.width) * vw
    const wy = c.y - vh / 2 + ((e.clientY - rect.top) / rect.height) * vh
    const tolX = (26 / rect.width) * vw
    const tolY = (26 / rect.height) * vh
    let melhor = null
    let melhorD = Infinity
    for (const s of galRef.current.stars) {
      const d = Math.hypot((s.x - wx) / tolX, (s.y - wy) / tolY)
      if (d < 1 && d < melhorD) {
        melhorD = d
        melhor = s
      }
    }
    let anom = null
    let anomD = Infinity
    for (const a of galRef.current.anomalias || []) {
      let d
      if (a.kind === 'nebulosa') {
        d = Math.hypot(a.x - wx, a.y - wy) / a.raio
      } else {
        d = Math.hypot((a.x - wx) / tolX, (a.y - wy) / tolY)
      }
      if (d < 1 && d < anomD) {
        anomD = d
        anom = a
      }
    }
    // prioriza o mais próximo do clique
    if (anom && (!melhor || anomD <= melhorD)) {
      setSelId(null)
      setSelNacao(null)
      setSelAnom(anom)
    } else if (melhor) {
      setSelAnom(null)
      // capital → ficha da nação; comum → entrada no sistema
      if (dipRef.current.cap[melhor.id]) {
        setSelId(null)
        setSelNacao(dipRef.current.cap[melhor.id])
      } else {
        setSelNacao(null)
        setSelId(melhor.id)
      }
    } else {
      setSelAnom(null)
      setSelNacao(null)
      setSelId(null)
    }
  }

  const entrarSistema = () => {
    if (!estrelaSel || !sistemaPrev) return
    setSistema({ estrela: estrelaSel, dados: sistemaPrev })
    setSelId(null)
  }

  const entrarNaCapital = () => {
    if (!selNacao) return
    const e = galaxia.stars[selNacao.capital]
    if (!e) return
    setSistema({ estrela: e, dados: gerarSistema(seed, e) })
    setSelNacao(null)
  }

  const iniciar = () => {
    const c = centroQuadrante(5, 5)
    const novo = { seed: tmpSeed, shape: tmpShape, qx: 5, qy: 5 }
    setQx(5)
    setQy(5)
    camRef.current = c
    velRef.current = { x: 0, y: 0 }
    setVel({ x: 0, y: 0 })
    zoomRef.current = ZOOM_INICIAL
    zoomAlvo.current = ZOOM_INICIAL
    setZoom(ZOOM_INICIAL)
    setCam(c)
    setSave(novo)
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify({
        ...novo,
        camX: c.x,
        camY: c.y,
        zoom: ZOOM_INICIAL,
        sistemaId: null,
        salvoEm: Date.now(),
      }),
    )
  }

  const novoSave = () => {
    if (!window.confirm('Começar um novo save? A galáxia atual será perdida.'))
      return
    localStorage.removeItem(SAVE_KEY)
    setSave(null)
    setSistema(null)
    setSelId(null)
    setSelAnom(null)
    setSelNacao(null)
    setTmpSeed(novaSeed())
  }

  if (!save) {
    return (
      <div className="sw-setup">
        <h1>SPACE WARLORDS</h1>
        <p>Nova campanha — escolha a galáxia (travada após iniciar)</p>
        <label>
          Forma:{' '}
          <select
            value={tmpShape}
            onChange={(e) => setTmpShape(e.target.value)}
          >
            {SHAPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Seed: <code>{tmpSeed}</code>
        </label>
        <div className="sw-buttons">
          <button onClick={() => setTmpSeed(novaSeed())}>Sortear seed</button>
          <button onClick={iniciar} className="sw-primary">
            Iniciar campanha
          </button>
        </div>
        <p className="sw-hint">2000 estrelas · 100 quadrantes · ~20/Q</p>
      </div>
    )
  }

  if (sistema) {
    return (
      <SystemMap
        sistema={sistema.dados}
        estrela={sistema.estrela}
        onVoltar={voltarGalaxia}
      />
    )
  }

  const rapidez = Math.hypot(vel.x, vel.y)

  return (
    <div className="sw-full">
      <canvas
        ref={mainRef}
        className="sw-canvas-full"
        onClick={clicarEstrela}
      />
      <div className="sw-hud-top">
        <strong>SPACE WARLORDS</strong>
        <span>
          Q{qy * GRID_N + qx} [{qx},{qy}] — {estrelas.length} estrelas · zoom{' '}
          {zoom.toFixed(1)}x · v={rapidez.toFixed(3)}
        </span>
        <span className="sw-hint">WASD voa · scroll = zoom total</span>
        <button onClick={novoSave} title="Apaga o save e volta à criação">
          Novo save
        </button>
      </div>
      <div className="sw-mini-wrap">
        <canvas
          ref={miniRef}
          width={180}
          height={180}
          className="sw-mini"
          onClick={clicarMinimapa}
          title="Mapa da galáxia (2000 estrelas) — clique p/ viajar"
        />
        <span className="sw-hint">
          seed {seed} · {shape} · {(galaxia.anomalias || []).length} anomalias
          · {dip.nacoes.length} nações
        </span>
      </div>
      {estrelaSel && sistemaPrev && (
        <div className="sw-modal">
          <div className="sw-panel" onClick={(e) => e.stopPropagation()}>
            <h2>SISTEMA S{estrelaSel.id}</h2>
            <p>
              Estrela {estrelaSel.tipo} · {estrelaSel.raioSol} R☉ ·{' '}
              {estrelaSel.tempK}K · L={sistemaPrev.L} L☉
            </p>
            {dip.dono[estrelaSel.id] != null && (
              <p>
                ★ {dip.nacoes[dip.dono[estrelaSel.id]].nome}
                {dip.nacoes[dip.dono[estrelaSel.id]].capital === estrelaSel.id
                  ? ' · capital'
                  : ''}
              </p>
            )}
            <p>
              {sistemaPrev.planetas.length} planeta(s) ·{' '}
              {sistemaPrev.cinturoes.length} cinturão(ões) ·{' '}
              {sistemaPrev.anas.length} planeta(s) anão(s)
            </p>
            <p className="sw-hint">
              linha da neve ≈ {sistemaPrev.snow} AU · seed do sistema{' '}
              {sistemaPrev.seed}
            </p>
            <div className="sw-buttons">
              <button className="sw-primary" onClick={entrarSistema}>
                Entrar no sistema
              </button>
              <button onClick={() => setSelId(null)}>Cancelar (Esc)</button>
            </div>
          </div>
        </div>
      )}
      {selAnom && (
        <div className="sw-modal">
          <div className="sw-panel" onClick={(e) => e.stopPropagation()}>
            <h2>{selAnom.nome}</h2>
            <p>
              {NOME_ANOMALIA[selAnom.kind]}
              {selAnom.kind === 'nebulosa' &&
                ` de ${selAnom.subtipo} · ~${Math.round(selAnom.raio * 4000)} anos-luz`}
              {selAnom.periodo != null && ` · período ${selAnom.periodo}ms`}
            </p>
            <p>{selAnom.desc}</p>
            <p className="sw-hint">
              Q{selAnom.quadrante} [{selAnom.qx},{selAnom.qy}] · (em breve:
              interação)
            </p>
            <div className="sw-buttons">
              <button onClick={() => setSelAnom(null)}>Fechar (Esc)</button>
            </div>
          </div>
        </div>
      )}
      {selNacao && (
        <div className="sw-modal">
          <div className="sw-panel" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: selNacao.cor }}>{selNacao.nome}</h2>
            <p>
              {TITULO[selNacao.tipo] ? `${TITULO[selNacao.tipo]} · ` : ''}
              {selNacao.tipo} · capital S{selNacao.capital} ·{' '}
              {selNacao.sistemas.length} sistema(s)
            </p>
            <ul className="sw-motivos">
              {selNacao.relacoes.map((r, i) => (
                <li key={i} className={r.tipo === 'aliado' ? 'ok' : 'no'}>
                  {r.tipo === 'aliado' ? '◆ aliado' : '✗ rival'}:{' '}
                  {dip.nacoes[r.com]?.nome} · {r.motivo}
                </li>
              ))}
            </ul>
            <div className="sw-buttons">
              <button className="sw-primary" onClick={entrarNaCapital}>
                Entrar no sistema da capital
              </button>
              <button onClick={() => setSelNacao(null)}>Fechar (Esc)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
