import { useMemo, useState } from 'react'
import { PRECO_BASE } from '../game/sim/economia.js'
import { NOME_ITEM } from './NomesItens.js'

const fmtQ = (v) =>
  v >= 100 ? Math.round(v).toString() : v >= 1 ? v.toFixed(1) : v.toFixed(2)

// Boletim de mercado da galáxia: só leitura, sem ações.
export default function ComercioGalaxia({ eco, nacoes }) {
  const [sub, setSub] = useState('precos')
  const d = useMemo(() => {
    if (!eco) return null
    const sistemas = Object.values(eco.sistemas || {})
    const volPorItem = {}
    let volTotal = 0
    for (const com of Object.values(eco.comercio || {})) {
      volTotal += com.valorVendas || 0
      for (const [it, q] of Object.entries(com.vendas || {}))
        volPorItem[it] = (volPorItem[it] || 0) + q
    }
    const linhas = Object.keys(PRECO_BASE)
      .map((it) => {
        const ps = sistemas.map((s) => s.precos[it]).filter((v) => v > 0)
        const med = ps.length ? ps.reduce((x, y) => x + y, 0) / ps.length : 0
        return { it, med, vol: volPorItem[it] || 0 }
      })
      .sort((a, b) => b.vol - a.vol)
    const top = linhas[0]?.vol > 0 ? linhas[0] : null
    const bal = (nacoes || [])
      .map((na) => {
        const c = eco.comercio?.[na.id]
        return { nome: na.nome, cor: na.cor, v: (c?.valorVendas || 0) - (c?.valorCompras || 0) }
      })
      .filter((b) => b.v !== 0)
      .sort((a, b) => b.v - a.v)
    return { linhas, volTotal, top, sup: bal.slice(0, 3), def: bal.slice(-3).reverse() }
  }, [eco, nacoes])

  if (!d) return <p className="sw-hint">Mercado abre no próximo tick.</p>

  return (
    <div className="sw-eco">
      <div className="sw-abas">
        {[
          ['precos', 'Preços'],
          ['volumes', 'Volumes'],
          ['balancas', 'Balanças'],
        ].map(([id, rot]) => (
          <button
            key={id}
            className={sub === id ? 'sw-aba ativa' : 'sw-aba'}
            onClick={() => setSub(id)}
          >
            {rot}
          </button>
        ))}
      </div>
      {sub === 'precos' && (
        <table className="sw-eco-tab">
          <tbody>
            {d.linhas.map((l) => (
              <tr key={l.it}>
                <td>{NOME_ITEM[l.it] || l.it}</td>
                <td>{l.med.toFixed(1)} cr</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {sub === 'volumes' && (
        <>
          <p>
            Volume <strong>{Math.round(d.volTotal).toLocaleString('pt-BR')} cr</strong>
            {d.top && (
              <>
                {' '}· mais negociado: <strong>{NOME_ITEM[d.top.it]}</strong>
              </>
            )}
          </p>
          <table className="sw-eco-tab">
            <tbody>
              {d.linhas.map((l) => (
                <tr key={l.it}>
                  <td>{NOME_ITEM[l.it] || l.it}</td>
                  <td>vol {fmtQ(l.vol)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {sub === 'balancas' && (
        <>
          {d.sup.length + d.def.length === 0 ? (
            <p className="sw-hint">Sem comércio no tick.</p>
          ) : (
            <ul className="sw-motivos">
              {d.sup.map((b) => (
                <li key={b.nome} className="ok">
                  <span style={{ color: b.cor }}>{b.nome}</span> +
                  {Math.round(b.v).toLocaleString('pt-BR')} cr
                </li>
              ))}
              {d.def.map((b) => (
                <li key={b.nome} className="no">
                  <span style={{ color: b.cor }}>{b.nome}</span> −
                  {Math.round(Math.abs(b.v)).toLocaleString('pt-BR')} cr
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
