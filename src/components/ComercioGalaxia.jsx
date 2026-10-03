import { useEffect, useMemo, useRef, useState } from 'react'
import { ECO_STATS, FUEL_DIST, PRECO_BASE } from '../game/sim/economia.js'
import { DESCR_ITEM, NOME_ITEM } from './NomesItens.js'
import ItemIcone from './ItemIcone.jsx'

// Mercado galáctico: vitrine visual p/ o jogador comercializar — preços,
// tendências, oportunidades com frete real e mapa de calor de preços.

const ORDEM = [
  'ALI', 'MAN', 'COMB', 'ENE', 'LUX', 'PGM', 'Au',
  'Fe', 'Si', 'H2O', 'C', 'O', 'Ni', 'Mg', 'Al', 'S', 'Ca', 'K', 'NaCl',
  'CH4', 'NH3', 'H', 'He',
].filter((it) => PRECO_BASE[it] != null)

const mm = (v) => Math.round(v).toLocaleString('pt-BR')
const q = (v) => (v >= 1000 ? mm(v) : v >= 10 ? Math.round(v).toString() : v.toFixed(1))

function corPreco(t) {
  const a = [47, 224, 138]
  const b = [255, 212, 71]
  const c = [255, 77, 94]
  const mix = (x, y, k) => [
    Math.round(x[0] + (y[0] - x[0]) * k),
    Math.round(x[1] + (y[1] - x[1]) * k),
    Math.round(x[2] + (y[2] - x[2]) * k),
  ]
  const v = t < 0.5 ? mix(a, b, t * 2) : mix(b, c, (t - 0.5) * 2)
  return `rgb(${v[0]},${v[1]},${v[2]})`
}

export default function ComercioGalaxia({ eco, nacoes, stars, dono, meu }) {
  const [sel, setSel] = useState('ALI')
  const mapaRef = useRef(null)

  const d = useMemo(() => {
    if (!eco) return null
    const porId = new Map((stars || []).map((s) => [s.id, s]))
    const sistemas = []
    const itens = {}
    for (const it of ORDEM) itens[it] = { it, prod: 0, uso: 0, estoque: 0, ps: [] }
    const volExt = {}
    for (const c of Object.values(eco.comercio || {})) {
      for (const [it, v] of Object.entries(c.vendas || {}))
        volExt[it] = (volExt[it] || 0) + v
      for (const [it, v] of Object.entries(c.compras || {}))
        volExt[it] = (volExt[it] || 0) + v
    }
    for (const [sidStr, s] of Object.entries(eco.sistemas || {})) {
      const sid = Number(sidStr)
      const st = porId.get(sid)
      const info = { sid, s, x: st?.x ?? 0, y: st?.y ?? 0, na: dono?.[sid] ?? null }
      sistemas.push(info)
      for (const it of ORDEM) {
        const o = itens[it]
        o.prod += s.prod?.[it] || 0
        o.uso += s.uso?.[it] || 0
        o.estoque += s.estoques?.[it] || 0
        const p = s.precos?.[it]
        if (p > 0)
          o.ps.push({
            sid,
            p,
            estoque: s.estoques?.[it] || 0,
            uso: s.uso?.[it] || 0,
            na: info.na,
            x: info.x,
            y: info.y,
          })
      }
    }
    const itensArr = ORDEM.map((it) => {
      const o = itens[it]
      const ps = o.ps
      const med = ps.length ? ps.reduce((a, b) => a + b.p, 0) / ps.length : 0
      const base = PRECO_BASE[it] || 1
      o.ext = volExt[it] || 0
      o.med = med
      o.min = ps.length ? Math.min(...ps.map((p) => p.p)) : 0
      o.max = ps.length ? Math.max(...ps.map((p) => p.p)) : 0
      o.delta = med > 0 ? (med / base - 1) * 100 : 0
      o.atividade = o.prod + o.uso
      return o
    })
    const combMed =
      itensArr.find((i) => i.it === 'COMB')?.med || PRECO_BASE.COMB
    // rotas lucrativas: comprar onde há estoque, vender onde paga mais,
    // descontando o frete real (distância × FUEL_DIST × COMB)
    const oportunidades = []
    for (const o of itensArr) {
      const vend = o.ps
        .filter((p) => p.estoque > 0.5)
        .sort((a, b) => a.p - b.p)
        .slice(0, 6)
      const compr = [...o.ps].sort((a, b) => b.p - a.p).slice(0, 6)
      let best = null
      for (const v of vend)
        for (const c of compr) {
          if (v.sid === c.sid) continue
          const dist = Math.hypot(v.x - c.x, v.y - c.y)
          const net = c.p - v.p - dist * FUEL_DIST * combMed
          if (!best || net > best.net) best = { buy: v, sell: c, dist, net }
        }
      if (best && best.net > 0.5)
        oportunidades.push({ item: o.it, ...best, med: o.med })
    }
    oportunidades.sort((a, b) => b.net - a.net)
    return { sistemas, itens, itensArr, oportunidades, combMed }
  }, [eco, stars, dono])

  // mapa de calor: estrelas da galáxia + preço do item selecionado
  useEffect(() => {
    const cv = mapaRef.current
    if (!cv || !d) return
    const ctx = cv.getContext('2d')
    const w = cv.width
    const h = cv.height
    ctx.fillStyle = '#0b0b10'
    ctx.fillRect(0, 0, w, h)
    for (const st of stars || []) {
      ctx.fillStyle = 'rgba(255,255,255,0.07)'
      ctx.fillRect(Math.round(((st.x + 1) / 2) * (w - 4)) + 2, Math.round(((st.y + 1) / 2) * (h - 4)) + 2, 1, 1)
    }
    const o = d.itens[sel]
    if (!o || !o.ps.length) return
    const min = o.min
    const max = o.max
    for (const p of o.ps) {
      const t = max > min ? (p.p - min) / (max - min) : 0.5
      const x = Math.round(((p.x + 1) / 2) * (w - 6)) + 3
      const y = Math.round(((p.y + 1) / 2) * (h - 6)) + 3
      ctx.fillStyle = corPreco(t)
      ctx.fillRect(x - 1, y - 1, 3, 3)
      if (p.na === meu) {
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'
        ctx.strokeRect(x - 3.5, y - 3.5, 7, 7)
      }
    }
    const compra = [...o.ps].filter((p) => p.estoque > 0.5).sort((a, b) => a.p - b.p)[0]
    const venda = [...o.ps].sort((a, b) => b.p - a.p)[0]
    const marca = (p, cor, rot) => {
      if (!p) return
      const x = ((p.x + 1) / 2) * (w - 6) + 3
      const y = ((p.y + 1) / 2) * (h - 6) + 3
      ctx.strokeStyle = cor
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(x, y, 6, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = cor
      ctx.font = 'bold 9px monospace'
      ctx.fillText(rot, x + 8, y + 3)
    }
    if (compra && venda && compra.sid !== venda.sid) {
      ctx.setLineDash([3, 4])
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'
      ctx.beginPath()
      ctx.moveTo(((compra.x + 1) / 2) * (w - 6) + 3, ((compra.y + 1) / 2) * (h - 6) + 3)
      ctx.lineTo(((venda.x + 1) / 2) * (w - 6) + 3, ((venda.y + 1) / 2) * (h - 6) + 3)
      ctx.stroke()
      ctx.setLineDash([])
    }
    marca(compra, '#2fe08a', 'B')
    marca(venda, '#ff4d5e', 'V')
  }, [d, sel, stars, meu])

  if (!d) return <p className="sw-hint">Mercado abre no próximo tick.</p>

  const o = d.itens[sel]
  const nomeNa = (id) => nacoes?.find((n) => n.id === id)
  const nomeSis = (sid) => `S${sid}`
  const topAtivo = [...d.itensArr].sort((a, b) => b.atividade - a.atividade)[0]
  const compra = o
    ? [...o.ps].filter((p) => p.estoque > 0.5).sort((a, b) => a.p - b.p)
    : []
  const venda = o ? [...o.ps].sort((a, b) => b.p - a.p) : []
  const melhorPar = d.oportunidades.find((x) => x.item === sel)

  return (
    <div className="sw-mk">
      <div className="sw-mk-resumo">
        <div className="sw-mk-stat">
          <b>{mm(ECO_STATS.volume)} cr</b>
          <span>volume do dia</span>
        </div>
        <div className="sw-mk-stat">
          <b>{ECO_STATS.rotas}</b>
          <span>rotas ativas</span>
        </div>
        <div className="sw-mk-stat">
          <b>{q(ECO_STATS.frete || 0)}</b>
          <span>combustível em frete</span>
        </div>
        <div className="sw-mk-stat">
          <b>{topAtivo ? NOME_ITEM[topAtivo.it] : '—'}</b>
          <span>mais movimentado</span>
        </div>
      </div>

      {d.oportunidades.length > 0 && (
        <>
          <div className="sw-mk-h">Rotas lucrativas do dia</div>
          <div className="sw-mk-ops">
            {d.oportunidades.slice(0, 3).map((op) => {
              const naB = nomeNa(op.buy.na)
              const naV = nomeNa(op.sell.na)
              return (
                <button
                  key={op.item}
                  className="sw-mk-op"
                  onClick={() => setSel(op.item)}
                  title="clique para abrir o item"
                >
                  <ItemIcone item={op.item} size={30} />
                  <span>
                    <strong>{NOME_ITEM[op.item]}</strong>
                    <br />
                    <span className="rota">
                      <span style={{ color: naB?.cor }}>{nomeSis(op.buy.sid)}</span>
                      {' → '}
                      <span style={{ color: naV?.cor }}>{nomeSis(op.sell.sid)}</span>
                      {' · '}
                      {op.dist.toFixed(2)} ua
                    </span>
                  </span>
                  <span className="lucro">
                    +{op.net.toFixed(1)}
                    <br />
                    <span className="rota">cr/un</span>
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}

      <div className="sw-mk-h">Vitrine do mercado</div>
      <div className="sw-mk-grid">
        {d.itensArr.map((x) => (
          <button
            key={x.it}
            className={sel === x.it ? 'sw-mk-card ativa' : 'sw-mk-card'}
            onClick={() => setSel(x.it)}
          >
            <ItemIcone item={x.it} size={26} />
            <span className="nome">{NOME_ITEM[x.it] || x.it}</span>
            <span className="preco">
              {x.med > 0 ? `${q(x.med)} cr` : '—'}
            </span>
            <span
              className={
                x.delta > 10
                  ? 'sw-mk-delta caro'
                  : x.delta < -10
                    ? 'sw-mk-delta barato'
                    : 'sw-mk-delta neutro'
              }
            >
              {x.delta >= 0 ? '▲' : '▼'} {Math.abs(x.delta).toFixed(0)}% vs base
            </span>
            <span className="sw-mk-barra">
              <i
                style={{
                  width: `${Math.min(
                    100,
                    (x.atividade / Math.max(1, topAtivo.atividade)) * 100,
                  )}%`,
                }}
              />
            </span>
          </button>
        ))}
      </div>

      {o && (
        <div className="sw-mk-det">
          <div className="sw-mk-col">
            <div className="sw-mk-det-top">
              <ItemIcone item={sel} size={40} />
              <div>
                <strong>{NOME_ITEM[sel] || sel}</strong>
                <div className="desc">{DESCR_ITEM[sel] || 'Recurso bruto.'}</div>
              </div>
            </div>
            <div className="sw-mk-det-stats">
              <span>
                produz <b>{q(o.prod)}</b>/tick
              </span>
              <span>
                consome <b>{q(o.uso)}</b>/tick
              </span>
              <span>
                estoque <b>{q(o.estoque)}</b>
              </span>
              <span>
                negociado hoje <b>{q(o.ext)}</b>
              </span>
            </div>
            <div className="sw-mk-range">
              <span
                className="fill"
                style={{
                  left: '0%',
                  right: '0%',
                }}
              />
              <span
                className="marca"
                style={{
                  left: `${o.max > o.min ? ((PRECO_BASE[sel] - o.min) / (o.max - o.min)) * 100 : 50}%`,
                  background: '#ffffff',
                }}
                title={`base ${PRECO_BASE[sel]} cr`}
              />
              <span
                className="marca"
                style={{
                  left: `${o.max > o.min ? ((o.med - o.min) / (o.max - o.min)) * 100 : 50}%`,
                  background: '#fb923c',
                }}
                title={`média ${o.med.toFixed(1)} cr`}
              />
            </div>
            <div className="sw-hint">
              mínimo {q(o.min)} · média {q(o.med)} · máximo {q(o.max)} cr —
              marcador branco = preço base, laranja = média
            </div>
            {melhorPar && (
              <div className="sw-mk-par">
                Comprar em <strong>{nomeSis(melhorPar.buy.sid)}</strong> (
                {melhorPar.buy.p.toFixed(1)} cr) e vender em{' '}
                <strong>{nomeSis(melhorPar.sell.sid)}</strong> (
                {melhorPar.sell.p.toFixed(1)} cr):{' '}
                <strong className="lucro-txt">
                  +{melhorPar.net.toFixed(1)} cr/un
                </strong>{' '}
                já com o frete
              </div>
            )}
            {compra.length > 0 && (
              <>
                <div className="sw-mk-h">Onde comprar</div>
                <div className="sw-mk-lista">
                  {compra.slice(0, 4).map((p) => {
                    const na = nomeNa(p.na)
                    return (
                      <div key={p.sid} className="sw-mk-linha">
                        <span
                          className="sw-mk-dot"
                          style={{ background: na?.cor || '#666' }}
                        />
                        <span>{nomeSis(p.sid)}</span>
                        <span className="sw-hint">{na?.nome}</span>
                        <span className="p">
                          {p.p.toFixed(1)} cr · {q(p.estoque)} disp
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
            {venda.length > 0 && (
              <>
                <div className="sw-mk-h">Onde vender</div>
                <div className="sw-mk-lista">
                  {venda.slice(0, 4).map((p) => {
                    const na = nomeNa(p.na)
                    return (
                      <div key={p.sid} className="sw-mk-linha">
                        <span
                          className="sw-mk-dot"
                          style={{ background: na?.cor || '#666' }}
                        />
                        <span>{nomeSis(p.sid)}</span>
                        <span className="sw-hint">{na?.nome}</span>
                        <span className="p">{p.p.toFixed(1)} cr</span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
          <div className="sw-mk-col sw-mk-col-mapa">
            <div className="sw-mk-h">Mapa de preços</div>
            <canvas
              ref={mapaRef}
              width={340}
              height={220}
              className="sw-mk-mapa"
            />
            <div className="sw-hint">
              verde = barato p/ comprar · vermelho = caro p/ vender ·{' '}
              <span style={{ color: '#2fe08a' }}>B</span> melhor compra ·{' '}
              <span style={{ color: '#ff4d5e' }}>V</span> melhor venda ·{' '}
              contorno branco = sua nação
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
