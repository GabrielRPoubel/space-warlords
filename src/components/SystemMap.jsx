import { useEffect, useRef, useState } from 'react'
import PlanetArt from './PlanetArt.jsx'
import {
  COR_ELEMENTO,
  DESCR_ESTRELA,
  avaliarHabitabilidade,
  gerarRecursos,
} from '../game/sim/system.js'
import { desenhar } from '../game/render/systemCanvas.js'
import {
  Q_MIN_CIVIL,
  capacidadeExploracao,
  nomeEdificio,
  qualidadeVida,
} from '../game/sim/economia.js'
import {
  CLASSE_RIQUEZA,
  NOME_COLONIA,
  NOME_RIQUEZA,
  SIMBOLO_COLONIA,
  fmtPop,
} from './NomesItens.js'

// Mapa do sistema: estrela ao centro, órbitas em escala logarítmica,
// planetas clicáveis com ficha. Navegação igual à galáxia:
// WASD/setas com inércia, +/- e scroll = zoom suave.
const ACCEL = 1400 // px/s²
const MAXV = 620 // px/s
const ATRITO = 3.2
const ZOOM_SUAV = 7
const ESC_MIN = 0.4
const ESC_MAX = 3

export default function SystemMap({ sistema, estrela, onVoltar, ecoSistema, dono }) {
  const canvasRef = useRef(null)
  const [sel, setSel] = useState(null)
  const [zoomUi, setZoomUi] = useState(1)
  const colRef = useRef(null)

  // planetas colonizados → anel na cor da nação + pontos (via ref)
  colRef.current =
    ecoSistema && dono
      ? Object.fromEntries(
          ecoSistema.planetas.map((p) => [
            p.nome,
            {
              cor: dono.cor,
              civ: p.edificios.filter((e) => e.tipo !== 'militar').length,
              mil: p.edificios.filter((e) => e.tipo === 'militar').length,
            },
          ]),
        )
      : null

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
      }
      if (canvasRef.current) {
        corposRef.current = desenhar(
          canvasRef.current,
          sistema,
          estrela,
          selRef.current?.nome,
          nv,
          colRef.current,
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
  const ecoPlaneta =
    !ehEstrela && ecoSistema && ficha?.nome
      ? ecoSistema.planetas.find((p) => p.nome === ficha.nome)
      : null
  // mundo civil: q a 1% do ideal, ainda não colonizado
  const qVista =
    ficha?.detalhe && !ficha.ana && !ecoPlaneta
      ? qualidadeVida(ficha.detalhe)
      : null
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
          {sistema.planetas.length} planetas · zoom {zoomUi.toFixed(1)}x
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
              {ecoPlaneta && (
                <>
                  <span>
                    {ecoPlaneta.pop < ecoPlaneta.pop0 * 0.9 ? '◌' : '●'}{' '}
                    {SIMBOLO_COLONIA[ecoPlaneta.col] || ''}{' '}
                    {NOME_COLONIA[ecoPlaneta.col] || 'COLÔNIA'} — pop{' '}
                    {fmtPop(ecoPlaneta.pop)}
                    {ecoPlaneta.col === 'exploracao'
                      ? ` (cap ${fmtPop(capacidadeExploracao(ecoPlaneta))})`
                      : ''}
                    {dono?.nome ? ` · ${dono.nome}` : ''}
                  </span>
                  {ecoPlaneta.riqueza && (
                    <span className={CLASSE_RIQUEZA[ecoPlaneta.riqueza] || ''}>
                      {NOME_RIQUEZA[ecoPlaneta.riqueza] || ecoPlaneta.riqueza}
                      {ecoPlaneta.riqueza === 'miseravel' ||
                      ecoPlaneta.riqueza === 'pobre'
                        ? ' · demandas básicas não atendidas'
                        : ''}
                    </span>
                  )}
                </>
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
            {ecoPlaneta && (
              <button
                className={aba === 'construcoes' ? 'sw-aba ativa' : 'sw-aba'}
                onClick={() => setAba('construcoes')}
              >
                Construções
              </button>
            )}
          </div>
          {aba === 'geral' && !ehEstrela && (
            <>
              {ficha.ana && (
                <span className="hab-no">○ INÓSPITO p/ humanos</span>
              )}
              {qVista != null && qVista >= Q_MIN_CIVIL && (
                <span className="hab-ok">
                  ◎ MUNDO CIVIL — elegível p/ colônia civil
                </span>
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
              {sistema.cinturoes?.length > 0 && (
                <ul className="sw-motivos">
                  {sistema.cinturoes.map((c, i) => {
                    const es = ecoSistema?.estacoes?.find((e) => e.b === i)
                    const nomeTipo =
                      c.tipo === 'M'
                        ? 'metálico (Fe-Ni, platinoides, ouro)'
                        : c.tipo === 'S'
                          ? 'silicáceo (metais + traços de Au/PGM)'
                          : 'carbonáceo (água, carbono, amônia)'
                    return (
                      <li key={i} className="ok">
                        ◌ {c.nome} · {nomeTipo} ·{' '}
                        {es
                          ? `${es.n}/${es.slots} estação(ões) de mineração`
                          : `${c.slots} estação(ões) possíveis`}
                      </li>
                    )
                  })}
                </ul>
              )}
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
          {aba === 'construcoes' && ecoPlaneta && (
            <>
              {ecoPlaneta.col === 'exploracao' && (
                <p className="sw-hint">
                  ⛏ posto de exploração · pop {fmtPop(ecoPlaneta.pop)} / cap{' '}
                  {fmtPop(capacidadeExploracao(ecoPlaneta))}
                </p>
              )}
              {ecoPlaneta.col === 'civil' && (
                <p className="sw-hint">
                  ● mundo civil · crescimento livre com básicos atendidos
                </p>
              )}
              {ecoPlaneta.obra && (
                <p className="sw-hint">
                  ◌ {nomeEdificio(ecoPlaneta.obra.ed)} em construção ·
                  pronta em {ecoPlaneta.obra.ticks}d
                </p>
              )}
              <p className="sw-hint">Militares</p>
              {ecoPlaneta.edificios.filter((e) => e.tipo === 'militar').length ? (
                <ul className="sw-motivos">
                  {ecoPlaneta.edificios
                    .filter((e) => e.tipo === 'militar')
                    .map((e, i) => (
                      <li key={i} className="warn">
                        ◆ {e.nome} · operacional
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="sw-hint">Nenhuma defesa instalada.</p>
              )}
              <p className="sw-hint">Civis</p>
              {ecoPlaneta.edificios.filter((e) => e.tipo !== 'militar').length ? (
                <ul className="sw-motivos">
                  {ecoPlaneta.edificios
                    .filter((e) => e.tipo !== 'militar')
                    .map((e, i) => (
                      <li key={i} className="ok">
                        {nomeEdificio(e)} · {Math.round(e.util * 100)}%
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="sw-hint">Sem construções civis.</p>
              )}
            </>
          )}
          <button onClick={() => setSel(null)}>Fechar</button>
        </div>
      )}
      {!ficha && (
        <span className="sw-hint sw-bottom-hint">
          clique no planeta p/ ficha · neve ≈ {sistema.snow} AU
        </span>
      )}
    </div>
  )
}
