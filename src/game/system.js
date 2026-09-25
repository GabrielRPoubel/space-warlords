// Geração procedural de sistema planetário — Space Warlords
// Determinística por (seed da galáxia + id da estrela).
// Segue tendências reais: O/B/A dispersam o disco cedo (poucos planetas,
// gigantes longe); G/K têm rochosos dentro + gasosos fora da linha da neve;
// M têm sistemas compactos de rochosos (TRAPPIST-1); gigantes vermelhas
// engoliram os internos e restam sobreviventes + detritos.

import { mulberry32 } from './galaxy.js'

// Composição química por tipo de corpo, inspirada em proporções reais
// (Terra total, Júpiter, Ceres/Plutão, basaltos, água do mar).
// [símbolo, nome, min%, max%] — o gerador sorteia dentro do range e
// normaliza para somar 100%. Determinístico por (seed + nome).
const TABELA_RECURSOS = {
  rochoso: [
    ['Fe', 'Ferro', 28, 35], ['O', 'Oxigênio', 28, 33],
    ['Si', 'Silício', 13, 17], ['Mg', 'Magnésio', 11, 15],
    ['Ni', 'Níquel', 1, 3], ['Al', 'Alumínio', 1, 2.5],
    ['Ca', 'Cálcio', 0.8, 2], ['S', 'Enxofre', 0.5, 2],
  ],
  lava: [
    ['Si', 'Silício', 20, 26], ['O', 'Oxigênio', 20, 26],
    ['Mg', 'Magnésio', 15, 22], ['Fe', 'Ferro', 15, 22],
    ['Ca', 'Cálcio', 2, 5], ['Al', 'Alumínio', 2, 5],
    ['S', 'Enxofre', 2, 6], ['Ni', 'Níquel', 1, 3],
  ],
  desertico: [
    ['O', 'Oxigênio', 30, 38], ['Si', 'Silício', 22, 28],
    ['Fe', 'Ferro', 12, 20], ['Al', 'Alumínio', 5, 9],
    ['Mg', 'Magnésio', 3, 7], ['Ca', 'Cálcio', 2, 5],
    ['K', 'Potássio', 1, 3],
  ],
  oceanico: [
    ['H2O', 'Água', 55, 70], ['Si', 'Silício', 8, 14],
    ['Fe', 'Ferro', 5, 10], ['Mg', 'Magnésio', 3, 7],
    ['NaCl', 'Sal', 2, 5], ['Ca', 'Cálcio', 1, 3],
    ['Al', 'Alumínio', 1, 2.5],
  ],
  gasoso: [
    ['H', 'Hidrogênio', 69, 74], ['He', 'Hélio', 23, 27],
    ['CH4', 'Metano', 0.5, 2.5], ['NH3', 'Amônia', 0.2, 1.2],
    ['H2O', 'Água', 0.2, 1],
  ],
  gelado: [
    ['H2O', 'Água', 50, 65], ['CH4', 'Metano', 5, 15],
    ['NH3', 'Amônia', 3, 10], ['Si', 'Silício', 5, 12],
    ['Fe', 'Ferro', 3, 8], ['Mg', 'Magnésio', 2, 6],
  ],
  ana: [
    ['H2O', 'Água', 20, 35], ['Si', 'Silício', 18, 26],
    ['Fe', 'Ferro', 12, 20], ['O', 'Oxigênio', 10, 18],
    ['Mg', 'Magnésio', 6, 12], ['C', 'Carbono', 1, 4],
    ['Ni', 'Níquel', 0.5, 2],
  ],
  estrela: [
    ['H', 'Hidrogênio', 70, 74], ['He', 'Hélio', 24, 28],
    ['O', 'Oxigênio', 0.5, 1.2], ['C', 'Carbono', 0.2, 0.6],
    ['Fe', 'Ferro', 0.1, 0.3],
  ],
}

export const DESCR_ESTRELA = {
  O: 'Supermassiva e curta: vive poucos milhões de anos e esteriliza tudo por perto.',
  B: 'Quente e massiva: UV brutal, planetas só longe e poucos.',
  A: 'Branca e quente: vida curta, cinturões frequentes.',
  F: 'Amarelo-branca estável: bons sistemas mistos.',
  G: 'Como o Sol: o padrão-ouro p/ buscar vida.',
  K: 'Laranja, estável e duradoura: excelente aposta p/ vida.',
  M: 'Fria e onipresente, mas com flares violentos frequentes.',
  'Gigante vermelha': 'Morrendo em expansão: já engoliu os planetas internos.',
}

export const COR_ELEMENTO = {
  Fe: '#d98a5b', O: '#7db8ff', Si: '#c9c9c9', Mg: '#9fe08a',
  Ni: '#8a9ba8', Al: '#d7d7d7', Ca: '#e8e0c8', S: '#e8d44d',
  H: '#f2f2f2', He: '#c9b8ff', CH4: '#7de0c9', NH3: '#8ad4f0',
  H2O: '#4aa3ff', NaCl: '#ffffff', K: '#c9a0e8', C: '#6b6b6b',
}

export function gerarRecursos(planeta, seedSistema) {
  const tab = TABELA_RECURSOS[planeta.tipo] || TABELA_RECURSOS.rochoso
  const rand = mulberry32((seedSistema ^ hashStr(planeta.nome + ':rec')) >>> 0)
  const vals = tab.map(([simb, nome, min, max]) => ({
    simb,
    nome,
    v: min + rand() * (max - min),
  }))
  const soma = vals.reduce((a, b) => a + b.v, 0)
  return vals
    .map((e) => ({ simb: e.simb, nome: e.nome, pct: +((e.v / soma) * 100).toFixed(1) }))
    .sort((a, b) => b.pct - a.pct)
}

function hashSeed(a, b) {
  let h = (a ^ Math.imul(b, 2654435761)) >>> 0
  h = Math.imul(h ^ (h >>> 15), 2246822519)
  h ^= h >>> 13
  return h >>> 0
}

// planetas [min,max] · cinturao = prob. de cinturão na linha da neve
// anas = [min,max] planetas anões · luasGas = [min,max] luas em gigantes
const CONFIG = {
  O: { min: 1, max: 2, cinturao: 0.2, anas: [0, 1], luasGas: [2, 6], gasSempre: true },
  B: { min: 1, max: 3, cinturao: 0.25, anas: [0, 1], luasGas: [2, 5], gasSempre: true },
  A: { min: 2, max: 4, cinturao: 0.35, anas: [0, 1], luasGas: [1, 5] },
  F: { min: 3, max: 5, cinturao: 0.45, anas: [0, 2], luasGas: [1, 4] },
  G: { min: 4, max: 8, cinturao: 0.7, anas: [1, 3], luasGas: [1, 4] },
  K: { min: 3, max: 6, cinturao: 0.5, anas: [0, 2], luasGas: [1, 3] },
  M: { min: 4, max: 7, cinturao: 0.25, anas: [0, 1], luasGas: [0, 2], compacto: true, gasRaro: 0.15 },
  'Gigante vermelha': { min: 0, max: 2, detritos: 0.85, anas: [0, 2], luasGas: [0, 2], sobrevivente: true },
}

export const COR_PLANETA = {
  lava: '#ff5a3c',
  desertico: '#d9a05b',
  rochoso: '#9a8f7f',
  oceanico: '#4aa3ff',
  gasoso: '#d8b98a',
  gelado: '#bfe3ff',
}

const ROMANOS = ['I', 'II', 'III', 'IV', 'V', 'VI']

export function hashStr(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// Seed do sistema: (seed da galáxia + id da estrela). Mesma seed =
// mesma configuração sempre, em qualquer visita.
export function sementeSistema(seedGalaxia, estrelaId) {
  return hashSeed(seedGalaxia, estrelaId + 1)
}

export function gerarSistema(seedGalaxia, estrela) {
  const sysSeed = sementeSistema(seedGalaxia, estrela.id)
  const rand = mulberry32(sysSeed)

  // Luminosidade em L☉: L = R²(T/5778)⁴ · linha da neve ≈ 2.7·√L AU
  const L = estrela.raioSol ** 2 * (estrela.tempK / 5778) ** 4
  const snow = 2.7 * Math.sqrt(L)
  const cfg = CONFIG[estrela.tipo] || CONFIG.G
  const compacto = !!cfg.compacto

  const n = cfg.min + Math.floor(rand() * (cfg.max - cfg.min + 1))
  const planetas = []
  let au = Math.max(
    0.02,
    (compacto ? 0.03 : 0.25) * Math.sqrt(L) * (1 + rand() * 0.3),
  )
  let gasColocado = false

  for (let i = 0; i < n; i++) {
    const letra = String.fromCharCode(98 + i)
    const nome = `S${estrela.id} ${letra}`
    const teq = Math.round((278 * L ** 0.25) / Math.sqrt(au))
    let tipo
    if (cfg.sobrevivente) {
      tipo = rand() < 0.6 ? 'gasoso' : 'gelado'
    } else if (au < snow * 0.6) {
      tipo = teq > 800 ? 'lava' : teq > 400 ? 'desertico' : 'rochoso'
    } else if (au <= snow * 1.4) {
      tipo =
        rand() < 0.3 && teq > 200 && teq < 400 ? 'oceanico' : 'rochoso'
    } else if (cfg.gasSempre) {
      tipo = 'gasoso'
      gasColocado = true
    } else if (cfg.gasRaro && (gasColocado || rand() > cfg.gasRaro)) {
      tipo = 'gelado'
    } else {
      tipo = rand() < 0.7 ? 'gasoso' : 'gelado'
      if (tipo === 'gasoso') gasColocado = true
    }

    let tamanhoRt
    if (tipo === 'gasoso') tamanhoRt = compacto ? 2 + rand() * 2 : 5 + rand() * 8
    else if (tipo === 'gelado') tamanhoRt = 1.5 + rand() * 2.5
    else tamanhoRt = compacto ? 0.4 + rand() * 1.0 : 0.5 + rand() * 1.5

    const luas = []
    if (tipo === 'gasoso') {
      const [lmin, lmax] = cfg.luasGas
      const nl = lmin + Math.floor(rand() * (lmax - lmin + 1))
      for (let m = 0; m < nl; m++)
        luas.push({
          nome: `${nome} ${ROMANOS[m]}`,
          rt: +(0.05 + rand() * 0.25).toFixed(2),
        })
    } else if (rand() < 0.3) {
      luas.push({ nome: `${nome} I`, rt: +(0.1 + rand() * 0.2).toFixed(2) })
    }

    planetas.push({
      nome,
      tipo,
      au: +au.toFixed(3),
      teq,
      tamanhoRt: +tamanhoRt.toFixed(2),
      cor: COR_PLANETA[tipo],
      angulo: rand() * Math.PI * 2,
      luas,
    })
    au *= 1.45 + rand() * 0.7
  }

  const cinturoes = []
  if (cfg.detritos) {
    if (rand() < cfg.detritos)
      cinturoes.push({
        nome: 'campo de detritos',
        au: +(snow * 1.2).toFixed(2),
        denso: true,
      })
  } else if (rand() < cfg.cinturao) {
    cinturoes.push({
      nome: 'cinturão principal',
      au: +snow.toFixed(2),
      denso: false,
    })
  }

  const [amin, amax] = cfg.anas
  const nAnas = amin + Math.floor(rand() * (amax - amin + 1))
  const base = planetas.length ? planetas[planetas.length - 1].au : snow
  const anas = []
  for (let i = 0; i < nAnas; i++)
    anas.push({
      nome: `S${estrela.id} DP-${i + 1}`,
      au: +(base * (1.5 + rand() * 0.8)).toFixed(2),
    })

  return {
    estrelaId: estrela.id,
    nome: `S${estrela.id}`,
    seed: sysSeed,
    L: +L.toFixed(2),
    snow: +snow.toFixed(2),
    planetas,
    cinturoes,
    anas,
  }
}

// Habitabilidade humana realista: quase tudo é inóspito.
// Critérios: superfície sólida, Teq 180–330K, água líquida (oceânico),
// gravidade 0.4–1.6g. Anãs e gigantes reprovam de saída.
export function avaliarHabitabilidade(planeta, estrela) {
  const motivos = []
  let ok = true
  const reprova = (texto) => {
    ok = false
    motivos.push({ ok: false, texto })
  }
  const aprova = (texto) => motivos.push({ ok: true, texto })

  if (planeta.tipo === 'gasoso') reprova('sem superfície sólida')
  else if (planeta.tipo === 'ana') reprova('pequeno demais p/ reter atmosfera')
  else aprova('superfície sólida')

  const teq = planeta.teq ?? 0
  if (teq < 180) reprova(`frio extremo (${teq}K): água congelada`)
  else if (teq > 330) reprova(`calor extremo (${teq}K): água evapora`)
  else aprova(`temperatura permite água líquida (${teq}K)`)

  if (planeta.tipo === 'oceanico') aprova('oceanos de água líquida')
  else if (planeta.tipo === 'lava') reprova('superfície em fusão')
  else if (planeta.tipo !== 'gasoso' && planeta.tipo !== 'ana')
    reprova('sem água líquida confirmada')

  const g = planeta.tamanhoRt ?? 1
  if (planeta.tipo !== 'gasoso' && planeta.tipo !== 'ana') {
    if (g < 0.4) reprova(`gravidade baixa (~${g}g): atmosfera escapa`)
    else if (g > 1.6) reprova(`gravidade esmagadora (~${g}g)`)
    else aprova(`gravidade tolerável (~${g}g)`)
  }

  const ressalvas = []
  if (estrela.tipo === 'M') ressalvas.push('flares frequentes da anã')
  if (['O', 'B', 'A'].includes(estrela.tipo))
    ressalvas.push('radiação UV intensa da estrela')
  if (estrela.tipo === 'Gigante vermelha')
    ressalvas.push('estrela instável em expansão')

  return { nivel: ok ? 'habitavel' : 'inospito', motivos, ressalvas }
}
