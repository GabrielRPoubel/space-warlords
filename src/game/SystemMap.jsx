import { useEffect, useRef, useState } from 'react'
import PlanetArt from './PlanetArt.jsx'
import {
  COR_ELEMENTO,
  DESCR_ESTRELA,
  avaliarHabitabilidade,
  gerarRecursos,
} from './system.js'

// Mapa do sistema: estrela ao centro, órbitas em escala logarítmica,
// planetas clicáveis com ficha. Navegação igual à galáxia:
// WASD/setas com inércia, +/- e scroll = zoom suave.
function raioTela(au, escala) {
  return (46 + 95 * Math.log10(1 + au * 6)) * escala
}

const TAM_PX = {
  lava: 5,
  desertico: 5,
  rochoso: 5,
  oceanico: 6,
  gelado: 7,
  gasoso: 12,
}

const ACCEL = 1400 // px/s²
const MAXV = 620 // px/s
const ATRITO = 3.2
const ZOOM_SUAV = 7
const ESC_MIN = 0.4
const ESC_MAX = 3

function desenhar(canvas, sistema, estrela, selNome, vista) {
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

  // vinheta sutil nas bordas
  const vg = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.35,
    w / 2, h / 2, Math.max(w, h) * 0.72,
  )
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, w, h)

  // estrela clicável: entra na lista de corpos com seu raio de clique
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

export default function SystemMap({ sistema, estrela, onVoltar }) {
  const canvasRef = useRef(null)
  const [sel, setSel] = useState(null)
  const [zoomUi, setZoomUi] = useState(1)
  const [velUi, setVelUi] = useState(0)

  const vistaRef = useRef({ ox: 0, oy: 0, escala: 1 })
  const escAlvo = useRef(1)
  const velRef = useRef({ x: 0, y: 0 })
  const teclas = useRef(new Set())
  const corposRef = useRef([])
  const selRef = useRef(null)
  selRef.current = sel
  const voltarRef = useRef(onVoltar)
  voltarRef.current = onVoltar

  useEffect(() => {
    const ajustar = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth
        canvasRef.current.height = window.innerHeight
      }
    }
    ajustar()
    window.addEventListener('resize', ajustar)
    return () => window.removeEventListener('resize', ajustar)
  }, [])

  // loop igual ao da galáxia: inércia no WASD + zoom suave
  useEffect(() => {
    let raf = 0
    let ultimo = performance.now()
    let frame = 0
    const passo = (agora) => {
      try {
        const dt = Math.min(0.05, (agora - ultimo) / 1000)
        ultimo = agora
        frame++

      const v0 = vistaRef.current
      let esc = v0.escala
      const alvo = escAlvo.current
      if (Math.abs(alvo - esc) > 0.001) {
        esc = esc + (alvo - esc) * (1 - Math.exp(-ZOOM_SUAV * dt))
        if (Math.abs(alvo - esc) <= 0.001) esc = alvo
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

      // arrastar o mapa é o inverso: tecla move a câmera, fundo acompanha
      // (igual à galáxia: W sobe o campo de visão)
      let v = { ...velRef.current }
      v.x += -ix * ACCEL * dt
      v.y += -iy * ACCEL * dt
      const damp = Math.exp(-ATRITO * dt)
      v.x *= damp
      v.y *= damp
      const sp = Math.hypot(v.x, v.y)
      if (sp > MAXV) {
        v.x = (v.x / sp) * MAXV
        v.y = (v.y / sp) * MAXV
      }
      if (ix === 0 && iy === 0 && sp < 3) {
        v.x = 0
        v.y = 0
      }

      const nv = { ox: v0.ox + v.x * dt, oy: v0.oy + v.y * dt, escala: esc }
      vistaRef.current = nv
      velRef.current = v

      if (frame % 6 === 0) {
        setZoomUi(esc)
        setVelUi(sp)
      }
      if (canvasRef.current) {
        corposRef.current = desenhar(
          canvasRef.current,
          sistema,
          estrela,
          selRef.current?.nome,
          nv,
        )
      }
      } catch (err) {
        console.error('[space-warlords] frame do sistema pulado:', err)
      }
      raf = requestAnimationFrame(passo)
    }
    raf = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(raf)
  }, [sistema, estrela])

  // teclado: WASD/setas movem, +/- zoom, Esc volta
  useEffect(() => {
    const down = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return
      const k = e.key.toLowerCase()
      if (k === 'escape') {
        voltarRef.current()
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
        escAlvo.current = Math.min(ESC_MAX, escAlvo.current * 1.15)
      } else if (k === '-' || k === '_' || k === 'subtract') {
        e.preventDefault()
        escAlvo.current = Math.max(ESC_MIN, escAlvo.current / 1.15)
      }
    }
    const up = (e) => teclas.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // scroll = zoom (não-passivo p/ preventDefault)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const fn = (e) => {
      e.preventDefault()
      escAlvo.current = Math.min(
        ESC_MAX,
        Math.max(ESC_MIN, escAlvo.current * Math.exp(-e.deltaY * 0.0015)),
      )
    }
    canvas.addEventListener('wheel', fn, { passive: false })
    return () => canvas.removeEventListener('wheel', fn)
  }, [])

  const clicar = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    let melhor = null
    let melhorD = Infinity
    for (const p of corposRef.current) {
      const tol = Math.max(20, p.sraio || 0)
      const d = Math.hypot(p.sx - mx, p.sy - my)
      if (d < tol && d < melhorD) {
        melhorD = d
        melhor = p
      }
    }
    setSel(melhor)
  }

  const ficha = sel && {
    ...sel,
    detalhe: sistema.planetas.find((p) => p.nome === sel.nome),
  }
  const aval =
    ficha?.detalhe && !ficha.ana
      ? avaliarHabitabilidade(ficha.detalhe, estrela)
      : null
  const ehEstrela = ficha?.tipo === 'estrela'
  const hzIn = +(0.95 * Math.sqrt(sistema.L)).toFixed(2)
  const hzOut = +(1.4 * Math.sqrt(sistema.L)).toFixed(2)
  const noHZ = ehEstrela
    ? sistema.planetas.filter((p) => p.au >= hzIn && p.au <= hzOut)
    : []
  const [aba, setAba] = useState('geral')
  useEffect(() => {
    setAba('geral')
  }, [sel?.nome])
  const recs =
    ficha && aba === 'recursos'
      ? gerarRecursos(
          {
            nome: ficha.nome,
            tipo:
              ficha.tipo === 'estrela'
                ? 'estrela'
                : ficha.ana
                  ? 'ana'
                  : ficha.detalhe?.tipo || 'rochoso',
          },
          sistema.seed,
        )
      : null

  return (
    <div className="sw-full">
      <canvas ref={canvasRef} className="sw-canvas-full" onClick={clicar} />
      <div className="sw-hud-top">
        <strong>SISTEMA {sistema.nome}</strong>
        <span>
          {estrela.tipo} · {estrela.raioSol} R☉ · {estrela.tempK}K ·{' '}
          {sistema.planetas.length} planetas · zoom {zoomUi.toFixed(1)}x · v=
          {Math.round(velUi)}
        </span>
        <span className="sw-hint">WASD move · +/- ou scroll = zoom</span>
        <button onClick={onVoltar}>Voltar (Esc)</button>
      </div>
      {ficha && (
        <div className="sw-info">
          <div className="sw-ficha-top">
            <PlanetArt
              corpo={{
                nome: ficha.nome,
                tipo:
                  ficha.tipo === 'estrela'
                    ? 'estrela'
                    : ficha.ana
                      ? 'ana'
                      : ficha.detalhe?.tipo || 'rochoso',
                cor: ficha.cor,
              }}
              seedSistema={sistema.seed}
              size={200}
            />
            <div className="sw-ficha-id">
              <strong>{ficha.nome}</strong>
              <span>
                {ficha.tipo === 'estrela'
                  ? `estrela classe ${estrela.tipo}`
                  : ficha.ana
                    ? 'planeta anão'
                    : ficha.detalhe?.tipo}{' '}
                · {ficha.tipo === 'estrela' ? `L=${sistema.L} L☉` : `${ficha.au} AU`}
              </span>
              {ficha.tipo === 'estrela' ? (
                <span>
                  {estrela.raioSol} R☉ · {estrela.tempK}K
                </span>
              ) : (
                ficha.detalhe && (
                  <span>
                    {ficha.detalhe.tamanhoRt} R⊕ · Teq {ficha.detalhe.teq}K
                  </span>
                )
              )}
              {ficha.detalhe?.luas?.length > 0 && (
                <span>
                  {ficha.detalhe.luas.length} lua(s):{' '}
                  {ficha.detalhe.luas.map((l) => l.nome.split(' ').pop()).join(', ')}
                </span>
              )}
            </div>
          </div>
          <div className="sw-abas">
            <button
              className={aba === 'geral' ? 'sw-aba ativa' : 'sw-aba'}
              onClick={() => setAba('geral')}
            >
              Geral
            </button>
            <button
              className={aba === 'recursos' ? 'sw-aba ativa' : 'sw-aba'}
              onClick={() => setAba('recursos')}
            >
              Recursos
            </button>
          </div>
          {aba === 'geral' && !ehEstrela && (
            <>
              {ficha.ana && (
                <span className="hab-no">○ INÓSPITO p/ humanos</span>
              )}
              {aval && (
                <>
                  <span
                    className={aval.nivel === 'habitavel' ? 'hab-ok' : 'hab-no'}
                  >
                    {aval.nivel === 'habitavel'
                      ? '● HABITÁVEL p/ humanos'
                      : '○ INÓSPITO p/ humanos'}
                  </span>
                  <ul className="sw-motivos">
                    {aval.motivos.map((m, i) => (
                      <li key={i} className={m.ok ? 'ok' : 'no'}>
                        {m.ok ? '✓' : '✗'} {m.texto}
                      </li>
                    ))}
                    {aval.ressalvas.map((r, i) => (
                      <li key={`r${i}`} className="warn">
                        ! {r}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
          {aba === 'geral' && ehEstrela && (
            <>
              <span className="hab-no">★ FUSÃO ATIVA — sem superfície</span>
              <ul className="sw-motivos">
                <li className="ok">
                  ✓ {estrela.raioSol} R☉ · {estrela.tempK}K · L={sistema.L} L☉
                </li>
                <li className="no">✗ interior em fusão nuclear</li>
                <li>
                  zona habitável: {hzIn}–{hzOut} AU
                </li>
                <li>
                  planetas na zona:{' '}
                  {noHZ.length ? noHZ.map((p) => p.nome).join(', ') : 'nenhum'}
                </li>
              </ul>
              <p className="sw-hint">{DESCR_ESTRELA[estrela.tipo]}</p>
            </>
          )}
          {aba === 'recursos' && recs && (
            <ul className="sw-rec-lista">
              {recs.map((r) => (
                <li key={r.simb} className="sw-rec-linha">
                  <span>
                    {r.simb} · {r.nome}
                  </span>
                  <span className="sw-bar">
                    <span
                      className="sw-bar-fill"
                      style={{
                        width: `${Math.max(2, r.pct)}%`,
                        background: COR_ELEMENTO[r.simb] || '#888',
                      }}
                    />
                  </span>
                  <span>{r.pct}%</span>
                </li>
              ))}
            </ul>
          )}
          <button onClick={() => setSel(null)}>Fechar</button>
        </div>
      )}
      {!ficha && (
        <span className="sw-hint sw-bottom-hint">
          clique no planeta p/ ficha · seed {sistema.seed} · neve ≈{' '}
          {sistema.snow} AU
        </span>
      )}
    </div>
  )
}
