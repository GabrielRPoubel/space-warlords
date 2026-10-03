import { useMemo, useState } from 'react'
import { ECO_STATS, PRECO_BASE } from '../game/sim/economia.js'
import { NOME_ITEM, fmtPop } from './NomesItens.js'

// Painel de desenvolvimento: raio-X completo da economia galáctica —
// tesouros, administração, riqueza, fluxos por item, sistemas e mercados.
const mm = (v) => Math.round(v).toLocaleString('pt-BR')
const q = (v, d = 0) => (v >= 1000 ? mm(v) : v.toFixed(d))

const CORES_RIQ = ['abundante', 'rico', 'estavel', 'pobre', 'miseravel']
const SIGLA_RIQ = { abundante: 'A', rico: 'R', estavel: 'E', pobre: 'P', miseravel: 'M' }

export default function DevPanel({ tick, data, dip, eco, onAvancar }) {
  const [aba, setAba] = useState('geral')
  const [filtro, setFiltro] = useState('')
  const [ordem, setOrdem] = useState('pop')
  const [det, setDet] = useState(null)

  const d = useMemo(() => {
    if (!eco) return null
    const sistemas = []
    const itens = {}
    for (const it of Object.keys(PRECO_BASE))
      itens[it] = { prod: 0, uso: 0, estoque: 0, precos: [] }
    const riqueza = {}
    let popTotal = 0
    let planetas = 0
    let escassez = 0
    let apagao = 0
    let brownout = 0
    let est = 0
    let estSlots = 0
    let falta = { ALI: 0, MAN: 0, ENE: 0 }
    for (const [sidStr, s] of Object.entries(eco.sistemas)) {
      const sid = Number(sidStr)
      let pop = 0
      const riq = {}
      for (const p of s.planetas) {
        pop += p.pop
        planetas++
        const n = p.riqueza || '?'
        riq[n] = (riq[n] || 0) + 1
        riqueza[n] = (riqueza[n] || 0) + 1
      }
      let estS = 0
      let slotsS = 0
      for (const es of s.estacoes || []) {
        estS += es.n || 0
        slotsS += es.slots || 0
      }
      const fEne = s.fEne ?? 1
      if (fEne < 0.001) apagao++
      else if (fEne < 0.999) brownout++
      if (s.escassez) escassez++
      for (const it of s.falta || []) if (falta[it] != null) falta[it]++
      est += estS
      estSlots += slotsS
      popTotal += pop
      for (const [it, v] of Object.entries(s.prod || {}))
        if (itens[it]) itens[it].prod += v
      for (const [it, v] of Object.entries(s.uso || {}))
        if (itens[it]) itens[it].uso += v
      for (const [it, v] of Object.entries(s.estoques || {}))
        if (itens[it]) itens[it].estoque += v
      sistemas.push({
        sid,
        dono: s.dono,
        pop,
        fEne,
        esc: s.escassez,
        falta: (s.falta || []).join(','),
        est: estS,
        estSlots: slotsS,
        riq,
        planetas: s.planetas.length,
      })
    }
    for (const s of Object.values(eco.sistemas))
      for (const it of Object.keys(PRECO_BASE)) {
        const v = s.precos?.[it]
        if (v > 0) itens[it].precos.push(v)
      }
    const linhasItens = Object.entries(itens)
      .map(([it, v]) => {
        const ps = v.precos
        const med = ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : 0
        return {
          it,
          prod: v.prod,
          uso: v.uso,
          estoque: v.estoque,
          min: ps.length ? Math.min(...ps) : 0,
          med,
          max: ps.length ? Math.max(...ps) : 0,
        }
      })
      .sort((a, b) => b.prod + b.uso - (a.prod + a.uso))
    const nacoes = (dip?.nacoes || []).map((na) => {
      let pop = 0
      let sis = 0
      let estN = 0
      const riq = {}
      for (const s of Object.values(eco.sistemas)) {
        if (s.dono !== na.id) continue
        sis++
        for (const p of s.planetas) {
          pop += p.pop
          const n = p.riqueza || '?'
          riq[n] = (riq[n] || 0) + 1
        }
        for (const es of s.estacoes || []) estN += es.n || 0
      }
      const c = eco.comercio?.[na.id]
      const int = eco.interno?.[na.id]
      return {
        id: na.id,
        nome: na.nome,
        cor: na.cor,
        tipo: na.tipo,
        tesouro: eco.tesouro?.[na.id] ?? 0,
        admin: eco.admin?.[na.id]?.custo ?? 0,
        adminFalta: eco.adminFalta?.[na.id] ?? 0,
        terr: (dip?.territorios?.[na.id] || []).length,
        pop,
        sis,
        est: estN,
        riq,
        bal: (c?.valorVendas || 0) - (c?.valorCompras || 0),
        vendas: c?.vendas || {},
        valorVendas: c?.valorVendas || 0,
        valorCompras: c?.valorCompras || 0,
        compras: c?.compras || {},
        interno: int?.mov ?? 0,
        frete: int?.frete ?? 0,
        hub: eco.hub?.[na.id] ?? null,
      }
    })
    sistemas.sort((a, b) => b.pop - a.pop)
    return {
      sistemas, linhasItens, nacoes, riqueza, falta,
      popTotal, planetas, escassez, apagao, brownout, est, estSlots,
    }
  }, [eco, dip])

  if (!d) return <p className="sw-hint">Economia ainda não inicializada.</p>

  const sistemasFiltrados = d.sistemas
    .filter((s) => {
      if (!filtro) return true
      const f = filtro.toLowerCase()
      const na = dip?.nacoes?.[s.dono]
      return (
        String(s.sid).includes(f) ||
        (na?.nome || '').toLowerCase().includes(f)
      )
    })
    .sort((a, b) => {
      if (ordem === 'fEne') return a.fEne - b.fEne || a.sid - b.sid
      if (ordem === 'esc') return (b.esc ? 1 : 0) - (a.esc ? 1 : 0) || b.pop - a.pop
      if (ordem === 'est') return b.est - a.est || b.pop - a.pop
      return b.pop - a.pop || a.sid - b.sid
    })
  const mostrados = sistemasFiltrados.slice(0, 150)

  return (
    <div className="sw-eco">
      <p>
        TICK {tick ?? 0} · {data || ''} · rotas {ECO_STATS.rotas} · vol{' '}
        {mm(ECO_STATS.volume)} cr · frete {q(ECO_STATS.frete || 0)} · fundações{' '}
        {ECO_STATS.fundacoes}
      </p>
      <div className="sw-buttons">
        <button onClick={() => onAvancar(10)} title="Simula 10 ticks">+10 dias</button>
        <button onClick={() => onAvancar(50)} title="Simula 50 ticks">+50 dias</button>
      </div>
      <div className="sw-abas">
        {[
          ['geral', 'Geral'],
          ['nacoes', 'Nações'],
          ['sistemas', `Sistemas (${d.sistemas.length})`],
          ['mercados', 'Mercados'],
        ].map(([id, rot]) => (
          <button
            key={id}
            className={aba === id ? 'sw-aba ativa' : 'sw-aba'}
            onClick={() => setAba(id)}
          >
            {rot}
          </button>
        ))}
      </div>

      {aba === 'geral' && (
        <>
          <p className="sw-hint">
            planetas {d.planetas} · pop {fmtPop(d.popTotal)} · escassez{' '}
            {d.escassez} (ALI {d.falta.ALI} · MAN {d.falta.MAN} · ENE {d.falta.ENE}) ·
            apagão {d.apagao} · brownout {d.brownout} · estações {d.est}/{d.estSlots}
          </p>
          <p className="sw-hint">
            riqueza:{' '}
            {CORES_RIQ.map((n) => `${SIGLA_RIQ[n]} ${d.riqueza[n] || 0}`).join(' · ')}
          </p>
          <div style={{ maxHeight: '40vh', overflowY: 'auto' }}>
            <table className="sw-eco-tab">
              <tbody>
                <tr>
                  <td>item</td>
                  <td>prod</td>
                  <td>uso</td>
                  <td>estoque</td>
                  <td>preço mín–méd–máx</td>
                </tr>
                {d.linhasItens.map((l) => (
                  <tr key={l.it}>
                    <td>{NOME_ITEM[l.it] || l.it}</td>
                    <td>{q(l.prod, 2)}</td>
                    <td>{q(l.uso, 2)}</td>
                    <td>{q(l.estoque, 1)}</td>
                    <td>
                      {l.min.toFixed(1)}–{l.med.toFixed(1)}–{l.max.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {aba === 'nacoes' && (
        <div style={{ overflowX: 'auto', fontSize: 11 }}>
          <table className="sw-eco-tab">
            <tbody>
              <tr>
                <td>nação</td>
                <td>tesouro</td>
                <td>admin</td>
                <td>déficit</td>
                <td>pop</td>
                <td>sis/terr</td>
                <td>est</td>
                <td>A·R·E·P·M</td>
                <td>bal</td>
                <td>int mov</td>
                <td>frete</td>
                <td>hub</td>
              </tr>
              {d.nacoes.map((l) => (
                <tr key={l.id}>
                  <td title={l.tipo}>
                    <span style={{ color: l.cor }}>{l.nome}</span>
                  </td>
                  <td>{mm(l.tesouro)}</td>
                  <td>{mm(l.admin)}</td>
                  <td className={l.adminFalta > 0 ? 'no' : ''}>
                    {l.adminFalta > 0 ? mm(l.adminFalta) : '—'}
                  </td>
                  <td>{fmtPop(l.pop)}</td>
                  <td>
                    {l.sis}/{l.terr}
                  </td>
                  <td>{l.est}</td>
                  <td>
                    {CORES_RIQ.map((n) => l.riq[n] || 0).join('·')}
                  </td>
                  <td className={l.bal >= 0 ? 'ok' : 'no'}>
                    {l.bal >= 0 ? '+' : '−'}
                    {mm(Math.abs(l.bal))}
                  </td>
                  <td>{q(l.interno, 0)}</td>
                  <td>{mm(l.frete)}</td>
                  <td>{l.hub != null ? `S${l.hub}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {aba === 'sistemas' && (
        <>
          <p>
            <input
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              placeholder="filtrar por S### ou nação"
              style={{ width: '60%' }}
            />
            {' '}
            <select value={ordem} onChange={(e) => setOrdem(e.target.value)}>
              <option value="pop">pop ↓</option>
              <option value="fEne">energia (pior 1º)</option>
              <option value="esc">escassez 1º</option>
              <option value="est">estações ↓</option>
            </select>
          </p>
          <div style={{ maxHeight: '45vh', overflowY: 'auto', fontSize: 11 }}>
            <table className="sw-eco-tab">
              <tbody>
                <tr>
                  <td>sis</td>
                  <td>nação</td>
                  <td>pops</td>
                  <td>fEne</td>
                  <td>falta</td>
                  <td>est</td>
                  <td>A·R·E·P·M</td>
                  <td>plan</td>
                </tr>
                {mostrados.map((s) => {
                  const na = dip?.nacoes?.[s.dono]
                  const sis = eco.sistemas[s.sid]
                  return [
                    <tr
                      key={s.sid}
                      onClick={() => setDet(det === s.sid ? null : s.sid)}
                      style={{ cursor: 'pointer' }}
                      title="clique p/ detalhes"
                    >
                      <td>{det === s.sid ? '▾' : '▸'} S{s.sid}</td>
                      <td style={{ color: na?.cor }}>{na?.nome || '—'}</td>
                      <td>{fmtPop(s.pop)}</td>
                      <td className={s.fEne < 0.999 ? 'no' : 'ok'}>
                        {s.fEne.toFixed(2)}
                      </td>
                      <td className={s.esc ? 'no' : 'ok'}>{s.falta || '—'}</td>
                      <td>
                        {s.est}/{s.estSlots}
                      </td>
                      <td>
                        {CORES_RIQ.map((n) => s.riq[n] || 0).join('·')}
                      </td>
                      <td>{s.planetas}</td>
                    </tr>,
                    det === s.sid && (
                      <tr key={`d${s.sid}`}>
                        <td colSpan={8} style={{ textAlign: 'left' }}>
                          {sis.planetas.map((p, i) => (
                            <div key={i}>
                              {p.nome} [{p.tipo} · {p.col} · q {p.q} · pop{' '}
                              {fmtPop(p.pop)}/{fmtPop(p.pop0)}
                              {p.up ? ` · UP ${p.up.fracao}` : ''}
                              {p.riqueza ? ` · ${p.riqueza}` : ''}
                              {p.obra ? ` · obra ${p.obra.ed.tipo}(${p.obra.ticks}d)` : ''}]{' '}
                              arm:{' '}
                              {Object.entries(p.armazem || {})
                                .filter(([, v]) => v > 0.01)
                                .map(([it, v]) => `${it} ${q(v, 1)}`)
                                .join(' ') || '—'}
                              {' | ed: '}
                              {p.edificios
                                .map((e) => `${e.tipo}${e.el || ''}:${e.util.toFixed(1)}`)
                                .join(' ')}
                              {p.plano?.length ? ` | plano: ${p.plano.map((e) => e.tipo).join(',')}` : ''}
                            </div>
                          ))}
                          {(sis.estacoes || []).length > 0 && (
                            <div>
                              cinturões:{' '}
                              {sis.estacoes
                                .map((e) => `${e.tipo} ${e.n}/${e.slots}`)
                                .join(' · ')}
                            </div>
                          )}
                        </td>
                      </tr>
                    ),
                  ]
                })}
              </tbody>
            </table>
          </div>
          {sistemasFiltrados.length > 150 && (
            <p className="sw-hint">
              mostrando 150 de {sistemasFiltrados.length} (use o filtro)
            </p>
          )}
        </>
      )}

      {aba === 'mercados' && (
        <>
          <p className="sw-hint">
            interno = transferências entre sistemas da mesma nação · externo =
            negócio entre nações via hubs · frete queimado no tick{' '}
            {q(ECO_STATS.frete || 0)}
          </p>
          <div style={{ overflowX: 'auto', fontSize: 11 }}>
            <table className="sw-eco-tab">
              <tbody>
                <tr>
                  <td>nação</td>
                  <td>vendas ext</td>
                  <td>compras ext</td>
                  <td>itens vendidos</td>
                  <td>itens comprados</td>
                  <td>int mov</td>
                  <td>frete int</td>
                </tr>
                {d.nacoes.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <span style={{ color: l.cor }}>{l.nome}</span>
                    </td>
                    <td className="ok">+{mm(l.valorVendas)}</td>
                    <td className="no">−{mm(l.valorCompras)}</td>
                    <td>
                      {Object.entries(l.vendas)
                        .map(([it, v]) => `${it} ${q(v, 2)}`)
                        .join(' ') || '—'}
                    </td>
                    <td>
                      {Object.entries(l.compras)
                        .map(([it, v]) => `${it} ${q(v, 2)}`)
                        .join(' ') || '—'}
                    </td>
                    <td>{q(l.interno, 0)}</td>
                    <td>{mm(l.frete)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
