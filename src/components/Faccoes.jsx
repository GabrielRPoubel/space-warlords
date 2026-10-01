import { useEffect, useRef } from 'react'
import { SIMBOLOS, TITULO } from '../game/sim/nations.js'

// guerra | aliado | rival | neutro | voce (relação com a nação do jogador)
function statusFaccao(na, origemId) {
  if (na.id === origemId) return 'voce'
  if ((na.guerras || []).includes(origemId)) return 'guerra'
  const rel = (na.relacoes || []).find((r) => r.com === origemId)
  if (rel) return rel.tipo
  return 'neutro'
}

const ROTULO = {
  voce: 'VOCÊ',
  guerra: 'EM GUERRA',
  aliado: 'ALIADO',
  rival: 'RIVAL',
  neutro: 'NEUTRO',
}

const PESO = { voce: 0, guerra: 1, aliado: 2, rival: 3, neutro: 4 }

function SimboloMini({ tipo, variante, cor }) {
  const ref = useRef(null)
  useEffect(() => {
    const ctx = ref.current.getContext('2d')
    ctx.clearRect(0, 0, 28, 28)
    const mapa = (SIMBOLOS[tipo] || SIMBOLOS.imperio)[variante % 10]
    ctx.fillStyle = cor
    mapa.forEach((linha, yy) => {
      ;[...linha].forEach((ch, xx) => {
        if (ch === '#') ctx.fillRect(xx * 4, yy * 4, 4, 4)
      })
    })
  }, [tipo, variante, cor])
  return <canvas ref={ref} width={28} height={28} className="sw-simbolo" />
}

export default function Faccoes({ nacoes, origemId, onSelect }) {
  const linhas = nacoes
    .map((na) => ({ na, st: statusFaccao(na, origemId) }))
    .sort(
      (a, b) =>
        PESO[a.st] - PESO[b.st] || a.na.nome.localeCompare(b.na.nome),
    )
  return (
    <ul className="sw-faccoes">
      {linhas.map(({ na, st }) => (
        <li key={na.id}>
          <button
            className="sw-faccao"
            onClick={() => onSelect(na)}
            title={`${na.nome} — ver ficha`}
          >
            <SimboloMini tipo={na.tipo} variante={na.simbolo} cor={na.cor} />
            <span className="sw-faccao-nome">
              <strong style={{ color: na.cor }}>{na.nome}</strong>
              <span className="sw-hint">
                {TITULO[na.tipo] ? `${TITULO[na.tipo]} · ` : ''}
                {na.sistemas.length} sistema(s) · rep{' '}
                {na.rep > 0 ? `+${na.rep}` : na.rep}
              </span>
            </span>
            <span className={`sw-pill sw-pill-${st}`}>{ROTULO[st]}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}
