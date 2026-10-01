import { useState } from 'react'
import {
  sugerirNome,
  faixaEtaria,
  avatarPadrao,
} from '../game/sim/personagem.js'
import { NOMES_BANCO } from '../game/sim/cultures.js'

const BASE = import.meta.env.BASE_URL || '/'
const OPCOES_SEXO = [
  { g: 'F', img: `${BASE}retrato-f.png`, rotulo: 'Feminino' },
  { g: 'M', img: `${BASE}retrato-m.png`, rotulo: 'Masculino' },
]

export default function CriacaoPersonagem({ culturas, onConfirm, onVoltar }) {
  const [culturaId, setCulturaId] = useState(culturas[0].id)
  const cultura = culturas.find((c) => c.id === culturaId) || culturas[0]
  const [genero, setGenero] = useState('M')
  const bancoDe = (c, g) => (NOMES_BANCO[c.povo] || { m: [], f: [] })[g] || []
  const [nome, setNome] = useState(() => {
    const b = bancoDe(culturas[0], 'M')
    return b.length
      ? b[Math.floor(Math.random() * b.length)]
      : sugerirNome(culturas[0], 'M')
  })
  const [idade, setIdade] = useState(30)

  const banco = bancoDe(cultura, genero)
  const sortearBanco = (c = cultura, g = genero) => {
    const b = bancoDe(c, g)
    if (b.length) setNome(b[Math.floor(Math.random() * b.length)])
    else setNome(sugerirNome(c, g))
  }

  const trocarCultura = (id) => {
    const c = culturas.find((x) => x.id === Number(id))
    setCulturaId(c.id)
    sortearBanco(c, genero)
  }

  const trocarGenero = (g) => {
    setGenero(g)
    sortearBanco(cultura, g)
  }

  const idadeNum = Number(idade)
  const idadeValida =
    Number.isInteger(idadeNum) && idadeNum >= 18 && idadeNum <= 130
  const idadeSegura = idadeValida ? idadeNum : 30
  const faixa = faixaEtaria(idadeSegura)
  const retrato = `${BASE}retrato-${genero.toLowerCase()}.png`
  const piloto = {
    nome: nome.trim(),
    idade: idadeSegura,
    culturaId: cultura.id,
    genero,
    avatar: avatarPadrao(),
  }

  return (
    <div className="sw-setup sw-criacao">
      <h1>PILOTO</h1>
      <div className="sw-criacao-grade">
        <div className="sw-card sw-previa">
          <img
            src={retrato}
            alt={genero === 'F' ? 'Piloto feminina' : 'Piloto masculino'}
            width={168}
            height={168}
            className="sw-retrato"
          />
          <strong>{piloto.nome || 'Sem nome'}</strong>
          <p className="sw-hint">
            {faixa} ·{' '}
            {genero === 'F' ? 'Feminino' : 'Masculino'} · {cultura.nome}
          </p>
        </div>
        <div className="sw-criacao-form">
          <h3>Identidade</h3>
          <label>
            Nome:{' '}
            <input
              value={nome}
              maxLength={40}
              onChange={(e) => setNome(e.target.value)}
            />
            <button onClick={() => sortearBanco()}>Sortear</button>
          </label>
          {banco.length > 0 && (
            <div className="sw-banco">
              {banco.map((n) => (
                <button
                  key={n}
                  className={n === nome ? 'sw-nome ativo' : 'sw-nome'}
                  onClick={() => setNome(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          <label>
            Cultura:{' '}
            <select
              value={culturaId}
              onChange={(e) => trocarCultura(e.target.value)}
            >
              {culturas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}{c.regiao ? ` · ${c.regiao}` : ''}
                </option>
              ))}
            </select>
          </label>
          <span className="sw-sexo-titulo">Sexo:</span>
          <div className="sw-sexo">
            {OPCOES_SEXO.map((o) => (
              <button
                key={o.g}
                className={
                  genero === o.g ? 'sw-sexo-opcao ativa' : 'sw-sexo-opcao'
                }
                onClick={() => trocarGenero(o.g)}
                aria-label={o.rotulo}
                aria-pressed={genero === o.g}
              >
                <img src={o.img} alt={o.rotulo} width={112} height={112} />
                <span>{o.rotulo}</span>
              </button>
            ))}
          </div>
          <label>
            Idade:{' '}
            <input
              type="number"
              min={18}
              max={130}
              value={idade}
              onChange={(e) => setIdade(Number(e.target.value))}
            />
            {!idadeValida && (
              <span className="hab-no">entre 18 e 130</span>
            )}
          </label>
        </div>
      </div>
      <div className="sw-buttons">
        <button onClick={onVoltar}>Voltar</button>
        <button
          onClick={() => onConfirm(piloto)}
          className="sw-primary"
          disabled={!piloto.nome || !idadeValida}
        >
          Confirmar piloto
        </button>
      </div>
    </div>
  )
}
