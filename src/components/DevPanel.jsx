import { ECO_STATS } from '../game/sim/economia.js'
import { NOME_ITEM, fmtPop } from './NomesItens.js'

// Painel geral de desenvolvimento: tudo à mostra (tesouros inclusos).
export default function DevPanel({ tick, dip, eco, onAvancar }) {
  const tes = eco?.tesouro || {}
  const linhas = (dip?.nacoes || []).map((na) => {
    const c = eco?.comercio?.[na.id]
    let pop = 0
    let pov = 0
    for (const s of Object.values(eco?.sistemas || {})) {
      if (s.dono !== na.id) continue
      pov++
      for (const p of s.planetas) pop += p.pop
    }
    return {
      id: na.id,
      nome: na.nome,
      cor: na.cor,
      tesouro: tes[na.id] ?? 0,
      balanca: (c?.valorVendas || 0) - (c?.valorCompras || 0),
      pop,
      pov,
    }
  })
  const prodTop = Object.entries(ECO_STATS.prod || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  return (
    <div className="sw-eco">
      <p>
        TICK {tick ?? 0} · rotas {ECO_STATS.rotas} · vol{' '}
        {Math.round(ECO_STATS.volume).toLocaleString('pt-BR')} cr · fundações{' '}
        {ECO_STATS.fundacoes}
      </p>
      {prodTop.length > 0 && (
        <p className="sw-hint">
          prod: {prodTop.map(([it, v]) => `${NOME_ITEM[it] || it} ${Math.round(v)}`).join(' · ')}
        </p>
      )}
      <div className="sw-buttons">
        <button onClick={() => onAvancar(10)} title="Simula 10 ticks de uma vez">
          Avançar 10 dias
        </button>
      </div>
      <table className="sw-eco-tab">
        <tbody>
          {linhas.map((l) => (
            <tr key={l.id}>
              <td>
                <span style={{ color: l.cor }}>{l.nome}</span>
              </td>
              <td>tes {Math.round(l.tesouro).toLocaleString('pt-BR')}</td>
              <td>bal {l.balanca >= 0 ? '+' : '−'}{Math.round(Math.abs(l.balanca)).toLocaleString('pt-BR')}</td>
              <td>pop {fmtPop(l.pop)}</td>
              <td>sis {l.pov}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
