// Render do mapa do sistema (Canvas 2D) — Space Warlords
// Puro e sem estado: recebe (canvas, sistema, estrela, selNome, vista)
// e devolve os corpos com posição de tela (p/ clique).
// colonizados: {nomePlaneta: {cor, civ, mil}} — anel + pontos de construção
function hashN(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  return (h >>> 0) / 4294967296
}
export function raioTela(au, escala) {
  return (46 + 95 * Math.log10(1 + au * 6)) * escala
}

export const TAM_PX = {
  lava: 5,
  desertico: 5,
  rochoso: 5,
  oceanico: 6,
  gelado: 7,
  gasoso: 12,
}

export function desenhar(canvas, sistema, estrela, selNome, vista, colonizados = null) {
  const ctx = canvas.getContext('2d')
  const w = canvas.width
  const h = canvas.height
  const cx = w / 2 + vista.ox
  const cy = h / 2 + vista.oy
  const esc = vista.escala
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(0, 0, w, h)

  for (let i = 0; i < 120; i++) {
    const k = (i + 0.5) / 120
    const sx = ((k * 12.9) % 1) * w
    const sy = ((k * 7.7) % 1) * h
    ctx.fillStyle = `rgba(255,255,255,${0.05 + (k % 0.12)})`
    ctx.fillRect(sx, sy, 1, 1)
  }

  for (const c of sistema.cinturoes) {
    const r = raioTela(c.au, esc)
    const n = c.denso ? 320 : 200
    for (let i = 0; i < n; i++) {
      const a = ((i * 2.39996) % (Math.PI * 2) + c.au) % (Math.PI * 2)
      const jitter = (((i * 37) % 10) - 5) * esc
      ctx.fillStyle = c.denso
        ? 'rgba(255,150,100,0.4)'
        : 'rgba(200,200,200,0.3)'
      ctx.fillRect(
        cx + Math.cos(a) * (r + jitter),
        cy + Math.sin(a) * (r + jitter),
        2,
        2,
      )
    }
  }

  const todos = [
    ...sistema.planetas.map((p) => ({ ...p, ana: false })),
    ...sistema.anas.map((a) => ({
      nome: a.nome,
      tipo: 'ana',
      au: a.au,
      cor: '#8b8b98',
      angulo: (a.au * 1.7) % (Math.PI * 2),
      luas: [],
    })),
  ]

  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 1
  for (const p of todos) {
    ctx.beginPath()
    ctx.arc(cx, cy, raioTela(p.au, esc), 0, Math.PI * 2)
    ctx.stroke()
  }

  for (const p of todos) {
    const r = raioTela(p.au, esc)
    const px = cx + Math.cos(p.angulo) * r
    const py = cy + Math.sin(p.angulo) * r
    const t = (p.ana ? 3 : TAM_PX[p.tipo] || 5) * Math.min(1.6, esc)
    ctx.fillStyle = p.cor
    ctx.fillRect(px - t / 2, py - t / 2, t, t)
    const corCol = colonizados?.[p.nome]
    if (corCol) {
      ctx.strokeStyle = corCol.cor || corCol
      ctx.lineWidth = 1.5
      ctx.strokeRect(px - t / 2 - 4, py - t / 2 - 4, t + 8, t + 8)
      // construções pixel art: bloco civil c/ telhado, torreta militar em cruz
      const nCiv = Math.min(4, corCol.civ || 0)
      const nMil = Math.min(3, corCol.mil || 0)
      for (let b = 0; b < nCiv; b++) {
        const a = hashN(`${p.nome}:c${b}`) * Math.PI * 2
        const bx = Math.round(px + Math.cos(a) * (t / 2 + 7)) - 2
        const by = Math.round(py + Math.sin(a) * (t / 2 + 7)) - 1
        ctx.fillStyle = '#ffd9ae'
        ctx.fillRect(bx, by + 1, 4, 2)
        ctx.fillStyle = '#ffe9c9'
        ctx.fillRect(bx, by, 4, 1)
      }
      for (let b = 0; b < nMil; b++) {
        const a = hashN(`${p.nome}:m${b}`) * Math.PI * 2
        const bx = Math.round(px + Math.cos(a) * (t / 2 + 11))
        const by = Math.round(py + Math.sin(a) * (t / 2 + 11))
        ctx.fillStyle = '#ff4d5e'
        ctx.fillRect(bx - 1, by, 3, 1)
        ctx.fillRect(bx, by - 1, 1, 3)
      }
    }
    if (!p.ana && esc > 0.6) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.font = '11px monospace'
      ctx.fillText(p.nome.split(' ')[1], px + 8, py - 6)
    }
    if (p.luas?.length && TAM_PX[p.tipo] >= 12) {
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      p.luas.forEach((_, m) => {
        const la = p.angulo + (m + 1) * 1.1
        ctx.fillRect(
          px + Math.cos(la) * (t / 2 + 7) - 1,
          py + Math.sin(la) * (t / 2 + 7) - 1,
          2,
          2,
        )
      })
    }
    if (p.nome === selNome) {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 1.5
      ctx.strokeRect(px - t / 2 - 5, py - t / 2 - 5, t + 10, t + 10)
    }
  }

  const rs =
    Math.min(42, Math.max(12, 8 + 10 * Math.sqrt(estrela.raioSol))) * esc
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rs * 3)
  g.addColorStop(0, estrela.cor)
  g.addColorStop(1, 'transparent')
  ctx.fillStyle = g
  ctx.fillRect(cx - rs * 3, cy - rs * 3, rs * 6, rs * 6)
  ctx.fillStyle = estrela.cor
  ctx.fillRect(cx - rs / 2, cy - rs / 2, rs, rs)
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '12px monospace'
  ctx.fillText(sistema.nome, cx + rs / 2 + 8, cy + 4)

  const vg = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.35,
    w / 2, h / 2, Math.max(w, h) * 0.72,
  )
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, w, h)

  const corpoEstrela = {
    nome: sistema.nome,
    tipo: 'estrela',
    au: 0,
    cor: estrela.cor,
    angulo: 0,
    luas: [],
    sx: cx,
    sy: cy,
    sraio: rs / 2 + 8,
  }
  if (corpoEstrela.nome === selNome) {
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1.5
    ctx.strokeRect(
      cx - rs / 2 - 5,
      cy - rs / 2 - 5,
      rs + 10,
      rs + 10,
    )
  }

  return [
    ...todos.map((p) => {
      const r = raioTela(p.au, esc)
      return {
        ...p,
        sx: cx + Math.cos(p.angulo) * r,
        sy: cy + Math.sin(p.angulo) * r,
      }
    }),
    corpoEstrela,
  ]
}
