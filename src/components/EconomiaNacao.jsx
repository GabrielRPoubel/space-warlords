import { useMemo } from 'react'
import { PRECO_BASE } from '../game/sim/economia.js'
import { NOME_ITEM, fmtPop } from './NomesItens.js'

const fmtQ = (v) =>
  v >= 100 ? Math.round(v).toString() : v >= 1 ? v.toFixed(1) : v.toFixed(2)
const fmtC = (v) =>
  `${v < 0 ? '−' : '+'}${Math.abs(Math.round(v)).toLocaleString('pt-BR')}`

function Tabela({ linhas }) {
  return (
    <table className="sw-eco-tab">
      <tbody>
        {linhas.map(([nome, val]) => (
          <tr key={nome}>
            <td>{nome}</td>
            <td>{val}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function EconomiaNacao({ na, eco, dev }) {
  const d = useMemo(() => {
    if (!eco) return null
    const meus = Object.entries(eco.sistemas || {}).filter(
      ([, s]) => s.dono === na.id,
    )
    let pop = 0
    let subutil = 0
    const faltas = []
    for (const [sid, s] of meus) {
      for (const p of s.planetas) {
        pop += p.pop
        for (const ed of p.edificios) if (ed.util < 0.5) subutil++
      }
      if (s.escassez)
        faltas.push({ sid, itens: (s.falta || []).map((i) => NOME_ITEM[i] || i) })
    }
    const consumo = eco.consumo?.[na.id] || {}
    const cons = Object.entries(consumo)
      .filter(([, v]) => v > 0.01)
      .sort((a, b) => b[1] - a[1])
      .map(([it, v]) => [NOME_ITEM[it] || it, fmtQ(v)])
    const com = eco.comercio?.[na.id] || { vendas: {}, compras: {} }
    const vend = Object.entries(com.vendas || {})
      .filter(([, v]) => v > 0.01)
      .sort((a, b) => b[1] - a[1])
      .map(([it, v]) => [NOME_ITEM[it] || it, fmtQ(v)])
    const balanca = (com.valorVendas || 0) - (com.valorCompras || 0)
    // segredos (dev): tesouro + estoques agregados
    let tesouro = 0
    let estoques = []
    if (dev) {
      tesouro = eco.tesouro?.[na.id] ?? 0
      const tot = {}
      for (const [, s] of meus) {
        for (const it of Object.keys(PRECO_BASE))
          tot[it] = (tot[it] || 0) + (s.estoques[it] || 0)
      }
      estoques = Object.entries(tot)
        .filter(([, v]) => v > 0.01)
        .sort((a, b) => b[1] - a[1])
        .map(([it, v]) => [NOME_ITEM[it] || it, fmtQ(v)])
    }
    // preços locais vs média galáctica
    const precos = []
    let caro = null
    let barato = null
    for (const it of Object.keys(PRECO_BASE)) {
      const locais = meus.map(([, s]) => s.precos[it]).filter((v) => v > 0)
      if (!locais.length) continue
      const med = locais.reduce((x, y) => x + y, 0) / locais.length
      const todos = Object.values(eco.sistemas || {})
        .map((s) => s.precos[it])
        .filter((v) => v > 0)
      const gal = todos.length
        ? todos.reduce((x, y) => x + y, 0) / todos.length
        : 0
      precos.push({
        it,
        min: Math.min(...locais),
        med,
        max: Math.max(...locais),
        gal,
      })
      if (gal > 0) {
        if (!caro || med / gal > caro.med / caro.gal) caro = precos[precos.length - 1]
        if (!barato || med / gal < barato.med / barato.gal) barato = precos[precos.length - 1]
      }
    }
    precos.sort((a, b) => b.med - a.med)
    const interno = eco.interno?.[na.id] || null
    const hub = eco.hub?.[na.id] ?? null
    const admin = eco.admin?.[na.id] || null
    const adminFalta = eco.adminFalta?.[na.id] || 0
    const riqueza = {}
    for (const [, s] of meus)
      for (const p of s.planetas)
        if (p.riqueza) riqueza[p.riqueza] = (riqueza[p.riqueza] || 0) + 1
    let estacoes = 0
    for (const [, s] of meus)
      for (const es of s.estacoes || []) estacoes += es.n || 0
    return {
      meus, pop, subutil, faltas, cons, vend, balanca, precos, caro, barato,
      tesouro, estoques, interno, hub, admin, adminFalta, riqueza, estacoes,
    }
  }, [na, eco, dev])

  if (!d) return <p className="sw-hint">Economia inicia no próximo tick.</p>
  if (!d.meus.length)
    return <p className="sw-hint">Nação sem sistemas povoados.</p>
  const expedicoes = (eco.transito || []).filter((t) => t.na === na.id).length

  return (
    <div className="sw-eco">
      <p>
        População <strong>{fmtPop(d.pop)}</strong> ·{' '}
        {d.meus.length} sistema(s) povoado(s) · balança{' '}
        <strong className={d.balanca >= 0 ? 'hab-ok' : 'hab-no'}>
          {fmtC(d.balanca)} cr
        </strong>
        {dev && (
          <>
            {' '}· tesouro <strong>{Math.round(d.tesouro).toLocaleString('pt-BR')} cr</strong>
          </>
        )}
      </p>
      <p>
        Administração{' '}
        <strong>
          {Math.round(d.admin?.custo ?? 0).toLocaleString('pt-BR')} cr/tick
        </strong>{' '}
        · {d.admin?.n ?? d.meus.length} sistema(s) · {d.estacoes} estação(ões) de mineração
        {d.adminFalta > 0 && (
          <strong className="hab-no">
            {' '}· déficit de {Math.round(d.adminFalta)} cr
          </strong>
        )}
      </p>
      {Object.keys(d.riqueza).length > 0 && (
        <p className="sw-hint">
          Riqueza:{' '}
          {['abundante', 'rico', 'estavel', 'pobre', 'miseravel']
            .filter((n) => d.riqueza[n])
            .map((n) => `${d.riqueza[n]} ${n}`)
            .join(' · ')}
        </p>
      )}
      {dev && d.estoques.length > 0 && (
        <details className="sw-dobravel" open>
          <summary>Estoques (DEV)</summary>
          <Tabela linhas={d.estoques} />
        </details>
      )}
      <details className="sw-dobravel">
        <summary>Consumo por item ({d.cons.length})</summary>
        {d.cons.length ? (
          <Tabela linhas={d.cons} />
        ) : (
          <p className="sw-hint">Sem consumo registrado.</p>
        )}
      </details>
      <details className="sw-dobravel">
        <summary>Vendas externas por item ({d.vend.length})</summary>
        {d.vend.length ? (
          <Tabela linhas={d.vend} />
        ) : (
          <p className="sw-hint">Sem vendas registradas.</p>
        )}
      </details>
      <p className="sw-hint">
        Gateways (frete menor vence):{' '}
        {d.hub != null ? (
          <>
            hub <strong>S{d.hub}</strong>
          </>
        ) : (
          'sem hub'
        )}{' '}
        · capital <strong>S{na.capital}</strong>
        {!d.meus.length && ' (sem sistemas povoados)'} · mercado interno:{' '}
        {d.interno ? (
          <>
            <strong>{fmtQ(d.interno.mov)}</strong> transferido · frete{' '}
            <strong>{fmtQ(d.interno.frete)} cr</strong>
          </>
        ) : (
          'sem transferências no tick'
        )}{' '}
        · externo = nação como entidade única (só créditos)
      </p>
      <details className="sw-dobravel">
        <summary>Preços mín–méd–máx</summary>
        {d.caro && (
          <p className="sw-hint">
            Importar: {NOME_ITEM[d.caro.it]} caro aqui (
            {d.caro.med.toFixed(1)} vs {d.caro.gal.toFixed(1)} galáctico)
          </p>
        )}
        {d.barato && (
          <p className="sw-hint">
            Exportar: {NOME_ITEM[d.barato.it]} barato aqui (
            {d.barato.med.toFixed(1)} vs {d.barato.gal.toFixed(1)} galáctico)
          </p>
        )}
        <Tabela
          linhas={d.precos.map((p) => [
            NOME_ITEM[p.it] || p.it,
            `${p.min.toFixed(1)}–${p.med.toFixed(1)}–${p.max.toFixed(1)}`,
          ])}
        />
      </details>
      <details className="sw-dobravel" open={d.faltas.length > 0 || d.subutil > 0}>
        <summary>
          Alertas ({d.faltas.length + (d.subutil > 0 ? 1 : 0)})
        </summary>
        {expedicoes > 0 && (
          <p className="sw-hint">
            {expedicoes} expedição(ões) colonial(is) a caminho.
          </p>
        )}
        {!d.faltas.length && !d.subutil ? (
          <p className="sw-hint">Nenhum alerta.</p>
        ) : (
          <ul className="sw-motivos">
            {d.faltas.map((f) => (
              <li key={f.sid} className="warn">
                S{f.sid} em escassez: falta {f.itens.join(', ') || 'suprimentos'}
              </li>
            ))}
            {d.subutil > 0 && (
              <li className="warn">
                {d.subutil} edifício(s) subutilizado(s) — sem escoamento (interno + externo)
              </li>
            )}
          </ul>
        )}
      </details>
    </div>
  )
}
