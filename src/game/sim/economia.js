// Economia das nações — Space Warlords
// Planetas povoados (sistema com dono + Teq tolerável) produzem elementos
// via edifícios, sintetizam bens, consomem e comercializam entre sistemas.
// Armas/Luxo: fora do escopo por enquanto.
// Determinístico: nada de Math.random; ruído via hash(seed:eco:tick:...).
import {
  gerarSistema,
  gerarRecursos,
  sementeSistema,
  hashStr,
  MIX_CINTURAO,
} from './system.js'
import { PERFIS } from './nations.js'

export const DENSIDADE = {
  rochoso: 1, lava: 1, desertico: 0.85, oceanico: 0.9,
  gelado: 0.55, ana: 0.7, gasoso: 0.15,
}

const EXCLUIDOS = new Set(['gasoso', 'ana', 'lava'])
const TEQ_MIN = 153
const TEQ_MAX = 379
const TEQ_IDEAL = 255

const K_POP = 1000
const CONS_ALI = 0.0003
const CONS_MAN = 0.001
// bens de luxo: consumo pequeno (pop 70 mil → ~1,4/tick por nação) —
// luxo é raro e define os poucos mundos ricos/abundantes
const CONS_LUX = 0.00002
const C_PROD = 14
// biomassa: população recicla carbono (C) — fecha o ciclo do alimento
const BIO_CARBONO = 0.001
// mineração na rede elétrica (já paga upkeep): só 0.1 de COMB de apoio
const FUEL_EXT = 0.1
const FUEL_SINT = 0.5
export const FUEL_DIST = 2.0
// mercado externo: a nação compra a gal×(1+spread) e vende a gal×(1-spread)
// (tarifa dos hubs; sem armazém nacional: produtos ficam nos sistemas)
const SPREAD_EXT = 0.1
// construir o hub comercial custa 500 cr (se o tesouro alcançar; senão sai
// de graça — subsídio de fronteira). Sem hub, a capital gateway sozinha.
const HUB_CUSTO = 500

export const COMB = 'COMB'
export const ALI = 'ALI'
export const MAN = 'MAN'
export const ENE = 'ENE'
export const PGM = 'PGM'
export const AU = 'Au'
export const LUX = 'LUX'

export const PRECO_BASE = {
  H: 2, He: 3, H2O: 4, Fe: 6, Si: 5, O: 2, Mg: 3, Ni: 12,
  Al: 8, Ca: 2, S: 3, CH4: 4, NH3: 4, NaCl: 3, K: 6, C: 5,
  [COMB]: 6, [ALI]: 12, [MAN]: 25, [ENE]: 3,
  [PGM]: 90, [AU]: 60, [LUX]: 150,
}

const ITENS = Object.keys(PRECO_BASE)

export const ECO_STATS = { rotas: 0, volume: 0, fundacoes: 0, prod: {} }
// imposto por pop/tick p/ o tesouro (a economia precisa de fonte de moeda;
// modulado pela riqueza do planeta — ver W_TAX)
const TAXA_POP = 0.025
// prazo de obra em ticks por tipo de edifício
const TEMPO_OBRA = { extrator: 3, COMB: 3, ALI: 5, MAN: 5, REF: 4, ENE: 5, militar: 4, [LUX]: 6 }

// ---- administração: manter sistemas custa dinheiro e sobe com o
// tamanho do território (BASE×n + K×n²) — expansão cega dói ----
const ADMIN_BASE = 3.5
const ADMIN_K = 0.06

// ---- índices de riqueza (por planeta) ----
// a comida manda: sem alimentos, nunca passa de pobre/miserável, por
// mais luxo que haja. Luxo e energia só coroam quem já tem o básico.
export const NIVEIS_RIQUEZA = ['miseravel', 'pobre', 'estavel', 'rico', 'abundante']
const W_TAX = { miseravel: 0.6, pobre: 0.85, estavel: 1, rico: 1.25, abundante: 1.5 }
const W_CRESC = { miseravel: -0.004, pobre: -0.001, estavel: 0, rico: 0.002, abundante: 0.004 }
export function nivelRiqueza(fAli, fMan, fLux, fEne) {
  if (fAli < 0.5) return 'miseravel'
  if (fAli < 0.99 || fMan < 0.99) return 'pobre'
  if (fLux >= 0.99 && fEne >= 0.99) return 'abundante'
  if (fLux > 0.01) return 'rico'
  return 'estavel'
}

// estações de mineração nos cinturões: custo fixo por estação
const STATION_CUSTO = 400

// governos expansionistas: bônus ×3 na fundação de colônias
const EXPANSIONISTAS = new Set(['imperio', 'juntaMilitar'])
const CHANCE_BASE_COLONIA = 0.1
const CUSTO_REC_COLONIA = { [MAN]: 50, [ALI]: 100, [COMB]: 100 }
const custoTesouroColonia = (q) => Math.round(800 + 2000 * (1 - q))

// ---- tipos de colônia ----
// exploracao: posto de trabalho, pop limitada pela capacidade produtiva
// fortaleza: mecânica própria fica p/ depois (provisório: regras antigas)
// civil: só em mundo quase ideal (q a 1% do ideal); crescimento livre
// enquanto houver básicos (ALI/MAN), sem teto de pop0
export const COL_EXPLORACAO = 'exploracao'
export const COL_FORTALEZA = 'fortaleza'
export const COL_CIVIL = 'civil'
export const Q_MIN_CIVIL = 0.99
export function tipoColoniaPorQ(q) {
  return q >= Q_MIN_CIVIL ? COL_CIVIL : COL_EXPLORACAO
}
// capacidade da exploração: base 100 + 150 por extrator + 400 por síntese
export function capacidadeExploracao(p) {
  let ext = 0
  let sint = 0
  for (const e of p.edificios || []) {
    if (e.tipo === 'extrator') ext++
    else if (e.tipo !== 'militar') sint++
  }
  return 100 + 150 * ext + 400 * sint
}
// capital sempre tem colônia civil: o melhor planeta é idealizado (q=1)
function garantirCivilCapital(sp) {
  let best = null
  for (const p of sp.planetas) if (!best || p.q > best.q) best = p
  if (!best) return
  best.q = 1
  const dens = DENSIDADE[best.tipo] ?? 1
  best.pop0 = Math.max(1, Math.round(K_POP * best.rt * best.rt * dens))
  best.col = COL_CIVIL
}

export const NOME_SINTESE = {
  [COMB]: 'Coletor de voláteis',
  [ALI]: 'Fazenda hidropônica',
  [MAN]: 'Fábrica',
  REF: 'Refinaria',
  ENE: 'Usina',
  [LUX]: 'Ateliê de luxo',
}
// custo de mão de obra (UPs) por edifício; militar não produz (0)
export const CUSTO_UP = {
  extrator: 100, [COMB]: 150, [ALI]: 200, REF: 300, [ENE]: 400, [MAN]: 800,
  [LUX]: 500,
}
// upkeep de energia por edifício/tick (usina não consome o que gera)
export const UPKEEP_ENE = {
  extrator: 1, [COMB]: 2, [ALI]: 3, REF: 4, [MAN]: 6, [ENE]: 0, militar: 1,
  [LUX]: 8,
}

export function nomeEdificio(ed) {
  if (ed.tipo === 'extrator') return EDIFICIO_POR_ELEMENTO[ed.el] || ed.el
  if (ed.tipo === 'militar') return ed.nome
  return NOME_SINTESE[ed.tipo] || ed.tipo
}

export const EDIFICIO_POR_ELEMENTO = {  Fe: 'Siderúrgica', O: 'Planta de oxigênio', Si: 'Mina de silício',
  Mg: 'Extratora de magnésio', Ni: 'Mina de níquel', Al: 'Fundição de alumínio',
  Ca: 'Pedreira de cálcio', S: 'Mina de enxofre', H: 'Coletor de hidrogênio',
  He: 'Coletor de hélio', CH4: 'Poço de metano', NH3: 'Planta de amônia',
  H2O: 'Estação de captação', NaCl: 'Salina', K: 'Mina de potássio',
  C: 'Mina de carbono',
}

const VOLATEIS = new Set(['H', 'He', 'CH4', 'NH3', 'H2O'])
const RECEITAS = {
  [ALI]: { H2O: 2, C: 1 },
  [MAN]: { Fe: 2, Si: 1 },
  REF: { C: 4 },
  [ENE]: { COMB: 2 },
  [LUX]: { [PGM]: 1, [AU]: 1 },
}
// cada lote rende várias unidades (agricultura/indústria multiplicam insumos)
const RENDIMENTO = { [ALI]: 4, [MAN]: 3, REF: 3, [ENE]: 300, [LUX]: 4 }
// síntese que queima COMB como calor de processo (hidroponia roda na
// rede elétrica — já paga upkeep — refinaria e usina usam o próprio
// insumo como energia; sem taxa extra)
const QUEIMA_COMB = new Set([MAN])

function det01(chave) {
  return (hashStr(chave) % 10000) / 10000
}

// qualidade de vida 1 (ideal) → 0.15 (limite); null = inabitável
export function qualidadeVida(planeta) {
  if (EXCLUIDOS.has(planeta.tipo)) return null
  const teq = planeta.teq ?? 0
  if (teq < TEQ_MIN || teq > TEQ_MAX) return null
  const d = Math.min(1, Math.abs(teq - TEQ_IDEAL) / (TEQ_IDEAL - TEQ_MIN))
  return +(1 - 0.85 * d).toFixed(3)
}

export function popInicial(planeta, q) {
  const rt = planeta.tamanhoRt ?? 1
  const dens = DENSIDADE[planeta.tipo] ?? 1
  return Math.max(1, Math.round(K_POP * rt * rt * dens * q))
}

function reservaElem(pct, rt, dens) {
  return (pct / 100) * rt * rt * rt * dens
}

function pctDe(recs, simb) {
  const r = recs.find((e) => e.simb === simb)
  return r ? r.pct : 0
}

// edifícios iniciais pela predisposição do planeta (top elementos)
function edificiosIniciais(recs) {
  const eds = []
  const top = [...recs].sort((a, b) => b.pct - a.pct).slice(0, 3)
  for (const e of top) {
    if (e.pct >= 1 && EDIFICIO_POR_ELEMENTO[e.simb])
      eds.push({ tipo: 'extrator', el: e.simb })
  }
  if (recs.some((e) => VOLATEIS.has(e.simb) && e.pct >= 0.5))
    eds.push({ tipo: COMB })
  // usina: energia p/ tudo (vem cedo no plano das colônias novas)
  eds.push({ tipo: ENE })
  // hidroponia: toda colônia cultiva alimentos (importa insumos se preciso)
  eds.push({ tipo: ALI })
  // refinaria: C → COMB (biomassa garante um fio em todo planeta)
  eds.push({ tipo: 'REF' })
  if (pctDe(recs, 'Fe') >= 2 && pctDe(recs, 'Si') >= 2)
    eds.push({ tipo: MAN })
  return eds
}

// defesas militares: idempotente (só adiciona o que falta), efeito em
// combate fica p/ depois. Regras por pop ATUAL: Bateria aos 2000, Hangar
// (nação agressiva) e Estaleiro (capital) no mais populoso.
function aplicarDefesas(sp, na, estrelaId) {
  if (!sp.planetas.length) return
  const agr = PERFIS[na.tipo]?.agr ?? 5
  let maior = sp.planetas[0]
  for (const p of sp.planetas) if (p.pop > maior.pop) maior = p
  const tem = (p, nome) => p.edificios.some((e) => e.nome === nome)
  for (const p of sp.planetas) {
    if (p.pop >= 2000 && !tem(p, 'Bateria orbital'))
      p.edificios.push({ tipo: 'militar', nome: 'Bateria orbital', util: 1 })
    if (p === maior) {
      if (agr >= 6 && !tem(p, 'Hangar de caças'))
        p.edificios.push({ tipo: 'militar', nome: 'Hangar de caças', util: 1 })
      if (estrelaId === na.capital && !tem(p, 'Estaleiro orbital'))
        p.edificios.push({ tipo: 'militar', nome: 'Estaleiro orbital', util: 1 })
    }
  }
}

function sistemaPovoado(seed, estrela, completo = true) {
  const sys = gerarSistema(seed, estrela)
  const todos = []
  const sysSeed = sementeSistema(seed, estrela.id)
  for (let i = 0; i < sys.planetas.length; i++) {
    const p = sys.planetas[i]
    const q = qualidadeVida(p)
    if (q == null) continue
    const recs = gerarRecursos(p, sysSeed)
    const dens = DENSIDADE[p.tipo] ?? 1
    const rt = p.tamanhoRt ?? 1
    const reservas = {}
    for (const e of recs) reservas[e.simb] = +reservaElem(e.pct, rt, dens).toFixed(3)
    const pop0 = popInicial(p, q)
    todos.push({
      nome: p.nome, tipo: p.tipo, rt, q, pop0,
      col: tipoColoniaPorQ(q),
      pop: pop0, reservas, armazem: {},
      edificios: edificiosIniciais(recs).map((e) => ({ ...e, util: 1 })),
      plano: [],
    })
  }
  if (!todos.length) return null
  // assentamento novo: só o melhor planeta nasce povoado, resto é candidato
  let planetas = todos
  let candidatos = []
  if (!completo && todos.length > 1) {
    let bi = 0
    for (let i = 1; i < todos.length; i++) if (todos[i].q > todos[bi].q) bi = i
    planetas = [todos[bi]]
    candidatos = todos
      .filter((_, i) => i !== bi)
      .map((t) => ({
        nome: t.nome, tipo: t.tipo, rt: t.rt, q: t.q, pop0: t.pop0,
        reservas: t.reservas,
      }))
    const eds = planetas[0].edificios
    planetas[0].edificios = eds.slice(0, 1)
    planetas[0].plano = eds.slice(1)
    planetas[0].pop = Math.max(1, Math.round(planetas[0].pop0 * 0.1))
  }
  const estoques = {}
  const precos = {}
  const uso = {}
  for (const it of ITENS) {
    estoques[it] = 0
    precos[it] = PRECO_BASE[it]
    uso[it] = 0
  }
  // estações de mineração nos cinturões: cinturões já desenvolvidos
  // nascem minerados; colônias novas constroem aos poucos
  const estacoes = (sys.cinturoes || []).map((b, i) => ({
    b: i,
    nome: b.nome,
    tipo: b.tipo,
    slots: b.slots,
    n: completo ? b.slots : 0,
  }))
  return {
    dono: null, planetas, candidatos, estoques, precos, uso, prod: {},
    estacoes, escassez: false, falta: [],
  }
}

function necessidadeInicial(s) {
  let pop = 0
  for (const p of s.planetas) pop += p.pop
  return { [ALI]: pop * CONS_ALI * 3, [MAN]: pop * CONS_MAN * 3, [COMB]: 20, [ENE]: 50 }
}

function montarSistema(seed, estrela, na, completo = true) {
  const sp = sistemaPovoado(seed, estrela, completo)
  if (!sp) return null
  sp.dono = na.id
  if (estrela.id === na.capital) garantirCivilCapital(sp)
  aplicarDefesas(sp, na, estrela.id)
  garantirAtelie(sp)
  // buffers iniciais no primeiro planeta (esparso: só o não-zero)
  const nec = necessidadeInicial(sp)
  for (const it of ITENS) {
    let v = 0
    if (nec[it]) v = nec[it]
    else if (sp.planetas.some((p) => p.reservas[it] > 0)) v = 5
    if (v > 0) guardarEm(sp, it, v)
  }
  sincronizar(sp)
  return sp
}

export function inicializarEco(seed, base, stars, din) {
  const eco = { sistemas: {}, tesouro: {} }
  const porId = new Map(stars.map((e) => [e.id, e]))
  for (const na of base.nacoes) {
    eco.tesouro[na.id] = 1000 * Math.max(1, (din.territorios?.[na.id] ?? na.sistemas).length)
    for (const sid of din.territorios?.[na.id] ?? na.sistemas) {
      if (eco.sistemas[sid]) continue
      // territórios iniciais já nascem desenvolvidos
      const sp = montarSistema(seed, porId.get(sid), na, true)
      if (sp) eco.sistemas[sid] = sp
    }
  }
  return eco
}

function donoPorEstrela(din) {
  const mapa = {}
  for (const [naId, ids] of Object.entries(din.territorios || {}))
    for (const id of ids) mapa[id] = Number(naId)
  return mapa
}

function garantirSistemas(seed, stars, base, din, eco) {
  const porId = new Map(stars.map((e) => [e.id, e]))
  const dono = donoPorEstrela(din)
  const porNa = new Map(base.nacoes.map((na) => [na.id, na]))
  for (const [sidStr, naId] of Object.entries(dono)) {
    const sid = Number(sidStr)
    const cur = eco.sistemas[sid]
    if (cur) {
      cur.dono = naId
      continue
    }
    const na = porNa.get(naId)
    if (!na) continue
    // assentamentos em jogo: 1 planeta + candidatos a colonizar
    const sp = montarSistema(seed, porId.get(sid), na, false)
    if (sp) eco.sistemas[sid] = sp
  }
  for (const na of base.nacoes) {
    if (eco.tesouro[na.id] == null) eco.tesouro[na.id] = 1000
  }
  return dono
}

export function produzir(s) {
  const entra = (it, v, p) => {
    if (v > 0) {
      p.armazem[it] = (p.armazem[it] || 0) + v
      s.prod[it] = (s.prod[it] || 0) + v
      ECO_STATS.prod[it] = (ECO_STATS.prod[it] || 0) + v
    }
  }
  // cadeia energética em regime próprio: refinaria, coletor e usina
  // operam só com mão de obra (são elas que FAZEM a energia — sem
  // debuff circular). O resto sofre o debuff da cobertura (fEne).
  const sintetizar = (p, ed, disp) => {
    // síntese a partir do estoque local (fábricas, refinaria, usina)
    const rec = RECEITAS[ed.tipo]
    let lotes = Infinity
    for (const [el, qtd] of Object.entries(rec))
      lotes = Math.min(lotes, (s.estoques[el] || 0) / qtd)
    // usina segue a carga com buffer de 6× o upkeep (segura brechas
    // de COMB sem binge: produz o que a rede precisa + reserva)
    if (ed.tipo === ENE)
      lotes = Math.min(
        lotes,
        Math.max(0, upkeepENE(s) * 6 - (s.estoques[ENE] || 0)) /
          (RENDIMENTO[ENE] || 1),
      )
    // refinaria só usa o C além da reserva alimentar (2 ticks de comida):
    // comida primeiro, combustível com a sobra — sem isso a fazenda
    // come o C todo e o combustível nunca nasce
    if (ed.tipo === 'REF')
      lotes = Math.min(
        lotes,
        Math.max(0, (s.estoques.C || 0) - (popDe(s) * CONS_ALI * 2) / 4) / 4,
      )
    if (QUEIMA_COMB.has(ed.tipo))
      lotes = Math.min(lotes, s.estoques[COMB] / FUEL_SINT || 0)
    lotes = Math.max(0, lotes) * ed.util * disp
    if (lotes > 0 && isFinite(lotes)) {
      // confirma retirando de verdade (escala se faltar insumo)
      let f = 1
      for (const [el, qtd] of Object.entries(rec)) {
        const g = retirarDe(s, el, lotes * qtd)
        s.uso[el] += g
        f = Math.min(f, g / (lotes * qtd || 1))
      }
      if (QUEIMA_COMB.has(ed.tipo)) {
        const gf = retirarDe(s, COMB, lotes * FUEL_SINT)
        s.uso[COMB] += gf
        f = Math.min(f, gf / (lotes * FUEL_SINT || 1))
      }
          entra(saidaDe(ed), lotes * f * (RENDIMENTO[ed.tipo] || 1), p)
          // hidroponia recicla 75% da água (transpiração condensada):
          // sem isso, a conta de água não fecha em escala galáctica
          if (ed.tipo === ALI) guardarEm(s, 'H2O', lotes * f * 1.5)
        }
      }
  const coletar = (p, ed, disp) => {
    let vol = 0
    for (const el of VOLATEIS) vol += p.reservas[el] || 0
    entra(COMB, C_PROD * vol ** 0.7 * ed.util * disp, p)
  }
  // mão de obra por planeta: 100 mil hab = 1 UP; a fração limita
  const fracDe = new Map()
  for (const p of s.planetas) {
    let demUP = 0
    for (const ed of p.edificios) demUP += CUSTO_UP[ed.tipo] ?? 0
    const ofUP = Math.floor(p.pop * 10)
    const fracUP = demUP > 0 ? Math.min(1, ofUP / demUP) : 1
    p.up = { oferta: ofUP, demanda: demUP, fracao: +fracUP.toFixed(3) }
    fracDe.set(p, fracUP)
  }
  // passes em ordem de mérito (quem vem antes bebe primeiro), todos
  // em regime próprio (só mão de obra — lavoura, química e poço não
  // param no escuro): comida (ALI fica com o C) → combustível (REF
  // com a sobra + coletor do poço) → energia (usina queima o fresco).
  for (const p of s.planetas) {
    const disp = fracDe.get(p)
    for (const ed of p.edificios) if (ed.tipo === ALI) sintetizar(p, ed, disp)
  }
  // subordem rígida (estoque é do sistema, mas o tick é sequencial):
  // refinaria faz → coletor soma → usina queima o fresco
  for (const p of s.planetas) {
    const disp = fracDe.get(p)
    for (const ed of p.edificios)
      if (ed.tipo === 'REF') sintetizar(p, ed, disp)
  }
  for (const p of s.planetas) {
    const disp = fracDe.get(p)
    for (const ed of p.edificios)
      if (ed.tipo === COMB) coletar(p, ed, disp)
  }
  // publica o COMB fresco ANTES da usina: ela lê o cache, e sem
  // isso vê 0 enquanto o extrator bebe o físico no mesmo tick
  sincronizar(s)
  for (const p of s.planetas) {
    const disp = fracDe.get(p)
    for (const ed of p.edificios)
      if (ed.tipo === ENE) sintetizar(p, ed, disp)
  }
  // energia: cobertura do estoque pós-cadeia; escassez = debuff da
  // indústria pesada (extratores e fábricas). Debuff, não apagão:
  // operação manual a 25%.
  const needEne = upkeepENE(s)
  const gotEne = retirarDe(s, ENE, needEne)
  s.uso[ENE] += gotEne
  const fEne = needEne > 0 ? gotEne / needEne : 1
  s.fEne = fEne
  // estações de mineração: extraem o mix real do cinturão (C/S/M),
  // operando com COMB (0,15/estação) e o debuff de energia
  const dispEst = Math.max(0.25, fEne)
  for (const es of s.estacoes || []) {
    if (!(es.n > 0)) continue
    const mix = MIX_CINTURAO[es.tipo]
    if (!mix) continue
    const need = 0.15 * es.n
    const gf = retirarDe(s, COMB, need)
    const f = need > 0 ? gf / need : 1
    s.uso[COMB] += gf
    for (const [el, q] of Object.entries(mix))
      entra(el, q * es.n * dispEst * f, s.planetas[0])
  }
  // passe INDÚSTRIA (com o debuff): extratores, fábricas e ateliês
  for (const p of s.planetas) {
    const disp = Math.max(0.25, fEne) * fracDe.get(p)
    for (const ed of p.edificios) {
      if (ed.tipo === 'militar') continue // defesa: sem produção
      if (ed.tipo !== 'extrator' && ed.tipo !== MAN && ed.tipo !== LUX) continue
      if (ed.tipo === 'extrator') {
        const taxa = C_PROD * (p.reservas[ed.el] || 0) ** 0.7 * ed.util * disp
        const gf = retirarDe(s, COMB, taxa * FUEL_EXT)
        const f = taxa > 0 ? gf / (taxa * FUEL_EXT || 1) : 1
        const out = taxa * f
        s.uso[COMB] += gf
        entra(ed.el, out, p)
      } else {
        sintetizar(p, ed, disp)
      }
    }
    sincronizar(s)
  }
}

// consumo: o sistema é um mercado só — a satisfação vale para todos
// os planetas (sem viés de ordem de saque). O índice de riqueza é
// atribuído por planeta, herdando a comida primeiro: sem ALI nunca
// passa de pobre/miserável, por mais luxo que haja.
function consumir(s) {
  let pop = 0
  for (const p of s.planetas) pop += p.pop
  const needAli = pop * CONS_ALI
  const needMan = pop * CONS_MAN
  const needLux = pop * CONS_LUX
  const gotAli = retirarDe(s, ALI, needAli)
  const gotMan = retirarDe(s, MAN, needMan)
  const gotLux = retirarDe(s, LUX, needLux)
  const fAli = needAli > 0 ? gotAli / needAli : 1
  const fMan = needMan > 0 ? gotMan / needMan : 1
  const fLux = needLux > 0 ? gotLux / needLux : 1
  s.uso[ALI] += gotAli
  s.uso[MAN] += gotMan
  s.uso[LUX] += gotLux
  for (const p of s.planetas) {
    p.riqueza = nivelRiqueza(fAli, fMan, fLux, s.fEne ?? 1)
    p.armazem.C = (p.armazem.C || 0) + p.pop * BIO_CARBONO
    s.prod.C = (s.prod.C || 0) + p.pop * BIO_CARBONO
    const r =
      taxaCrescimentoColonia(fAli, fMan, p) + (W_CRESC[p.riqueza] || 0) / PERIODO_TAXA
    if (p.col === COL_CIVIL) p.pop = Math.max(1, p.pop * (1 + r))
    else if (p.col === COL_EXPLORACAO) {
      const cap = Math.max(1, Math.min(p.pop0 * 2, capacidadeExploracao(p)))
      p.pop = Math.max(1, Math.min(cap, p.pop * (1 + r)))
    } else p.pop = Math.max(1, Math.min(p.pop0 * 2, p.pop * (1 + r)))
  }
  const ok = fAli >= 1 && fMan >= 1 && (s.fEne ?? 1) >= 1
  s.escassez = !ok
  s.falta = []
  if (fAli < 1) s.falta.push(ALI)
  if (fMan < 1) s.falta.push(MAN)
  if ((s.fEne ?? 1) < 1) s.falta.push(ENE)
}

// variação por planeta a partir da fartura (f = 0 fome severa,
// f = 1 fartura): banda de -0.8% a +1.2% ao longo de 180 ticks.
// Colônia abaixo da pop original e sem fome cresce por imigração (+8%/180t).
const PERIODO_TAXA = 180
export function taxaCrescimento(fAli, fMan, pop, pop0) {
  const f = Math.min(1, Math.max(0, Math.min(fAli, fMan)))
  if (pop < pop0 && f >= 0.5) return 0.08 / PERIODO_TAXA
  return (-0.8 + 2.0 * f) / 100 / PERIODO_TAXA
}
// crescimento por tipo de colônia:
// - civil: livre enquanto houver básicos (f>=0.5), sem teto de pop0
// - exploração: teto da capacidade produtiva; superlotação declina
// - fortaleza: provisório (regras antigas até a mecânica própria)
export function taxaCrescimentoColonia(fAli, fMan, p) {
  const f = Math.min(1, Math.max(0, Math.min(fAli, fMan)))
  if (p.col === COL_CIVIL) {
    if (f >= 0.5) return 0.08 / PERIODO_TAXA
    return (-0.8 + 2.0 * f) / 100 / PERIODO_TAXA
  }
  if (p.col === COL_EXPLORACAO) {
    const cap = Math.max(1, Math.min(p.pop0 * 2, capacidadeExploracao(p)))
    if (p.pop >= cap) return -0.8 / 100 / PERIODO_TAXA
    return taxaCrescimento(fAli, fMan, p.pop, p.pop0)
  }
  return taxaCrescimento(fAli, fMan, p.pop, p.pop0)
}

function atualizarPrecos(s, emGuerra, tick) {
  for (const it of ITENS) {
    const u = s.uso[it] || 0
    const cover = s.estoques[it] / Math.max(0.5, u)
    let mult = Math.min(4, Math.max(0.25, cover ** -0.5))
    mult *= 1 + (det01(`p:${tick}:${it}`) - 0.5) * 0.1
    if (it === ALI && emGuerra) mult *= 1.2
    s.precos[it] = Math.max(0.1, +(PRECO_BASE[it] * mult).toFixed(2))
  }
}

// pct (0-100) de volta a partir das reservas absolutas (mesma escala)
function recsDe(reservas) {
  const tot = Object.values(reservas).reduce((a, b) => a + b, 0) || 1
  return Object.entries(reservas).map(([simb, v]) => ({ simb, pct: (v / tot) * 100 }))
}

// 1 fundação por nação/tick: melhor candidato, custo alto em tesouro +
// recursos dos estoques, chance ×3 p/ governos expansionistas.
// Paga na largada; a colônia chega em 2 + dist×5 ticks (capital→destino).
function fundarColonias(seed, base, stars, din, eco, tick) {
  const porId = new Map(stars.map((e) => [e.id, e]))
  for (const na of base.nacoes) {
    let best = null
    for (const [sidStr, s] of Object.entries(eco.sistemas)) {
      if (s.dono !== na.id || !s.candidatos?.length) continue
      for (const c of s.candidatos) {
        if (!best || c.q > best.c.q) best = { sid: Number(sidStr), s, c }
      }
    }
    if (!best) continue
    if (eco.transito.some((t) => t.sid === best.sid && t.nome === best.c.nome))
      continue
    const chance = CHANCE_BASE_COLONIA * (EXPANSIONISTAS.has(na.tipo) ? 3 : 1)
    if (det01(`col:${seed}:${tick}:${na.id}`) >= chance) continue
    const custoT = custoTesouroColonia(best.c.q)
    if ((eco.tesouro[na.id] ?? 0) < custoT) continue
    const tem = {}
    for (const s of Object.values(eco.sistemas)) {
      if (s.dono !== na.id) continue
      for (const el of Object.keys(CUSTO_REC_COLONIA))
        tem[el] = (tem[el] || 0) + (s.estoques[el] || 0)
    }
    if (Object.entries(CUSTO_REC_COLONIA).some(([el, qtd]) => (tem[el] || 0) < qtd))
      continue
    for (const el of Object.keys(CUSTO_REC_COLONIA)) {
      let resto = CUSTO_REC_COLONIA[el]
      const fontes = Object.entries(eco.sistemas)
        .filter(([, s]) => s.dono === na.id && (s.estoques[el] || 0) > 0)
        .sort((a, b) => b[1].estoques[el] - a[1].estoques[el] || Number(a[0]) - Number(b[0]))
      for (const [, s] of fontes) {
        resto -= retirarDe(s, el, resto)
        if (resto <= 0) break
      }
    }
    eco.tesouro[na.id] -= custoT
    const cap = porId.get(na.capital)
    const dst = porId.get(best.sid)
    const dist = cap && dst ? Math.hypot(cap.x - dst.x, cap.y - dst.y) : 0.5
    eco.transito.push({
      na: na.id,
      sid: best.sid,
      nome: best.c.nome,
      cand: best.c,
      ticks: 2 + Math.round(dist * 5),
    })
  }
}

// chegadas: candidato vira planeta com 10% da pop + 1º edifício
function concluirTransito(eco) {
  for (const t of eco.transito) t.ticks--
  const prontas = eco.transito.filter((t) => t.ticks <= 0)
  eco.transito = eco.transito.filter((t) => t.ticks > 0)
  for (const t of prontas) {
    const s = eco.sistemas[t.sid]
    if (!s) continue
    const idx = (s.candidatos || []).findIndex((c) => c.nome === t.nome)
    if (idx < 0) continue
    const [cand] = s.candidatos.splice(idx, 1)
    const eds = edificiosIniciais(recsDe(cand.reservas)).map((e) => ({ ...e, util: 1 }))
    const [prim, ...restoPlano] = eds.length
      ? eds
      : [{ tipo: 'extrator', el: 'Fe', util: 1 }]
    s.planetas.push({
      nome: cand.nome, tipo: cand.tipo, rt: cand.rt, q: cand.q,
      col: tipoColoniaPorQ(cand.q),
      pop0: cand.pop0, pop: Math.max(1, Math.round(cand.pop0 * 0.1)),
      reservas: cand.reservas, armazem: { [ENE]: 60, [COMB]: 10 },
      edificios: [prim], plano: restoPlano,
    })
    ECO_STATS.fundacoes++
  }
}

// próxima defesa faltante pelas regras (Bateria/Hangar/Estaleiro)
function proximaDefesa(p, maior, na, estrelaId) {
  const tem = (nome) => p.edificios.some((e) => e.nome === nome)
  if (p.pop >= 2000 && !tem('Bateria orbital'))
    return { tipo: 'militar', nome: 'Bateria orbital' }
  if (p === maior) {
    const agr = PERFIS[na.tipo]?.agr ?? 5
    if (agr >= 6 && !tem('Hangar de caças'))
      return { tipo: 'militar', nome: 'Hangar de caças' }
    if (estrelaId === na.capital && !tem('Estaleiro orbital'))
      return { tipo: 'militar', nome: 'Estaleiro orbital' }
  }
  return null
}

function saidaDe(ed) {
  if (ed.tipo === 'extrator') return ed.el
  if (ed.tipo === 'REF') return COMB
  return ed.tipo
}
// upkeep total de energia do sistema (toda construção alimentada,
// inclusive estações de mineração nos cinturões)
function upkeepENE(s) {
  let t = 0
  for (const p of s.planetas)
    for (const ed of p.edificios) t += UPKEEP_ENE[ed.tipo] ?? 0
  for (const es of s.estacoes || []) t += 2 * (es.n || 0)
  return t
}

// escolhe do plano: maior déficit local primeiro; tudo atendido → maior preço
function escolherPlano(p, s, precosGal) {
  let best = null
  let bestNeed = 0
  let bestVal = -1
  for (const ed of p.plano) {
    const out = saidaDe(ed)
    const need = necessidade(s, out)
    const val = precosGal[out] || 0
    if (need > 0 && (need > bestNeed || (need === bestNeed && val > bestVal))) {
      best = ed
      bestNeed = need
      bestVal = val
    } else if (bestNeed <= 0 && need <= 0 && val > bestVal) {
      best = ed
      bestVal = val
    }
  }
  return best
}

// 1 obra por planeta por vez: avança a atual; livre → militar, senão civil
// (marco de 25% da pop) pela prioridade demanda/valor
function gerirObras(s, na, estrelaId, precosGal) {
  let maior = s.planetas[0]
  for (const p of s.planetas) if (p.pop > maior.pop) maior = p
  for (const p of s.planetas) {
    if (p.obra) {
      p.obra.ticks--
      if (p.obra.ticks <= 0) {
        p.edificios.push({ ...p.obra.ed, util: 1 })
        p.obra = null
      } else continue
    }
    if (p.obra) continue
    const mil = proximaDefesa(p, maior, na, estrelaId)
    if (mil) {
      p.obra = { ed: mil, ticks: TEMPO_OBRA.militar }
      continue
    }
    if (!p.plano?.length) continue
    // ateliê de luxo fura a fila (vida curta: só entra no plano de
    // sistemas com cinturão M ativo — é a joia da fronteira)
    const atelie = p.plano.find((e) => e.tipo === LUX)
    if (atelie) {
      let temM = false
      for (const es of s.estacoes || []) if (es.tipo === 'M' && es.n > 0) temM = true
      if (temM) {
        p.plano = p.plano.filter((e) => e !== atelie)
        p.obra = { ed: atelie, ticks: TEMPO_OBRA[LUX] }
        continue
      }
    }
    const ed = escolherPlano(p, s, precosGal)
    if (!ed) continue
    // usina + refinaria são infraestrutura vital (independência
    // energética): furam a fila do marco populacional
    if (ed.tipo !== ENE && ed.tipo !== 'REF') {
      const civis = p.edificios.filter((e) => e.tipo !== 'militar').length
      const alvo = Math.min(civis + p.plano.length, 1 + Math.floor(p.pop / p.pop0 / 0.25))
      if (civis >= alvo) continue
    }
    {
      p.plano = p.plano.filter((e) => e !== ed)
      p.obra = { ed, ticks: TEMPO_OBRA[ed.tipo] ?? 4 }
    }
  }
}

function popDe(s) {
  let pop = 0
  for (const p of s.planetas) pop += p.pop
  return pop
}

// insumos latentes: sistema no escuro tem uso ~0 e o mercado o
// esvazia (exporta a semente do recomeço). A necessidade ancora no
// potencial: comida (C p/ 2× a comida), combustível (C p/ refinar o
// COMB das usinas ociosas), indústria (2 lotes de Fe/Si por fábrica).
function combWantDe(s) {
  let w = s.uso[COMB] || 0
  for (const p of s.planetas)
    for (const ed of p.edificios) if (ed.tipo === ENE) w += 2
  return w
}
// necessidade estrutural: biológica p/ consumo, água p/ cultivar a
// comida da população (2 H2O p/ 4 ALI), upkeep p/ energia, COMB p/
// queimar (fluxo + 2 por usina ociosa), C/Fe/Si/PGM/Au latentes
// (insumo dos ateliês), LUX p/ o padrão de vida, fluxo p/ o resto
function reqDe(s, it) {
  if (it === ALI) return popDe(s) * CONS_ALI
  if (it === MAN) return popDe(s) * CONS_MAN
  if (it === 'H2O') return popDe(s) * CONS_ALI
  if (it === ENE) return upkeepENE(s)
  if (it === COMB) return combWantDe(s)
  if (it === 'C') return popDe(s) * CONS_ALI * 0.5 + combWantDe(s) * (4 / 3)
  if (it === 'Fe' || it === 'Si') {
    let w = s.uso[it] || 0
    for (const p of s.planetas)
      for (const ed of p.edificios)
        if (ed.tipo === MAN) w += it === 'Fe' ? 4 : 2
    return w
  }
  if (it === PGM || it === AU) {
    let w = s.uso[it] || 0
    for (const p of s.planetas)
      for (const ed of p.edificios)
        if (ed.tipo === LUX) w += it === PGM ? 1 : 1
    return w
  }
  if (it === LUX) return popDe(s) * CONS_LUX
  return s.uso[it] || 0
}

// ---- armazém por planeta (fonte da verdade; nunca negativo) ----
// Toda mutação passa por guardar/retirar. s.estoques é só cache agregado
// p/ preços e rotas, recalculado por sincronizar().
function guardarEm(s, it, qtd, planeta = null) {
  if (!(qtd > 0)) return
  const p = planeta || s.planetas[0]
  if (!p) return
  p.armazem[it] = (p.armazem[it] || 0) + qtd
}

function retirarDe(s, it, qtd, planeta = null) {
  if (!(qtd > 0)) return 0
  if (planeta) {
    const d = Math.min(qtd, planeta.armazem[it] || 0)
    planeta.armazem[it] = (planeta.armazem[it] || 0) - d
    return d
  }
  let resto = qtd
  let tirado = 0
  for (const p of s.planetas) {
    if (resto <= 0) break
    const d = Math.min(resto, p.armazem[it] || 0)
    p.armazem[it] = (p.armazem[it] || 0) - d
    resto -= d
    tirado += d
  }
  return tirado
}

function sincronizar(s) {
  for (const it of ITENS) {
    let t = 0
    for (const p of s.planetas) t += p.armazem[it] || 0
    s.estoques[it] = t
  }
}

function necessidade(s, it) {
  return Math.max(0, reqDe(s, it) * 2 - s.estoques[it])
}

// hub comercial: 1 por nação — o sistema próprio mais próximo de uma
// capital estrangeira (vitrine p/ o mercado externo). Reelegido se
// perdido/conquistado; a construção custa HUB_CUSTO.
function garantirHubs(eco, base, stars) {
  if (!eco.hub) eco.hub = {}
  const porId = new Map(stars.map((e) => [e.id, e]))
  for (const na of base.nacoes) {
    const cur = eco.hub[na.id]
    if (cur != null && eco.sistemas[cur]?.dono === na.id) continue
    let best = -1
    let bestD = Infinity
    for (const [sidStr, s] of Object.entries(eco.sistemas)) {
      if (s.dono !== na.id) continue
      const sid = Number(sidStr)
      const e = porId.get(sid)
      if (!e) continue
      for (const na2 of base.nacoes) {
        if (na2.id === na.id) continue
        const c = porId.get(na2.capital)
        if (!c) continue
        const d = Math.hypot(e.x - c.x, e.y - c.y)
        if (d < bestD) {
          bestD = d
          best = sid
        }
      }
    }
    if (best >= 0) {
      eco.hub[na.id] = best
      if ((eco.tesouro[na.id] ?? 0) >= HUB_CUSTO) eco.tesouro[na.id] -= HUB_CUSTO
    }
  }
}

// gateways nacionais p/ o mercado externo: hub comercial + capital.
// Cada sistema usa o mais próximo (frete menor; empate: hub).
export function gatewaysDe(eco, naId, hubSid, capSid) {
  const gs = []
  for (const sid of [hubSid, capSid]) {
    if (sid == null) continue
    if (gs.includes(sid)) continue
    const s = eco.sistemas[sid]
    if (!s || s.dono !== naId) continue
    gs.push(sid)
  }
  return gs
}

// coleta p/ os gateways vendedores: cada superávit próprio vai ao
// gateway mais próximo (gateway entra com o próprio excedente, sem
// frete). Frete em créditos do tesouro do vendedor + COMB físico das
// origens. Retorna { colhido, noGw, mov, frete } (noGw: sid→qtd;
// mov/frete p/ a estatística do interno).
export function coletarParaHub(eco, distM, posDe, N, escoado, NI, k, naId, gws, it, qtd) {
  const noGw = {}
  for (const sid of gws) noGw[sid] = 0
  if (!gws.length) return { colhido: 0, noGw, mov: 0, frete: 0 }
  const pos = gws.map((sid) => posDe.get(sid))
  const maisProx = (oi) => {
    let bi = 0
    let bd = distM[pos[0] * N + oi]
    for (let i = 1; i < pos.length; i++) {
      const d = distM[pos[i] * N + oi]
      if (d < bd) {
        bd = d
        bi = i
      }
    }
    return bi
  }
  let resto = qtd
  let colhido = 0
  let mov = 0
  let frete = 0
  // excedente dos próprios gateways (sem frete)
  for (let i = 0; i < gws.length && resto > 0.001; i++) {
    const gw = eco.sistemas[gws[i]]
    const u = excedente(gw, it)
    if (!(u > 0.001)) continue
    const r = retirarDe(gw, it, Math.min(resto, u))
    if (r > 0.001) {
      resto -= r
      colhido += r
      noGw[gws[i]] += r
      escoado[pos[i] * NI + k] += r
    }
  }
  if (!(resto > 0.001)) return { colhido, noGw, mov, frete }
  const orgs = []
  for (const [sidStr, s] of Object.entries(eco.sistemas)) {
    if (s.dono !== naId) continue
    const sid = Number(sidStr)
    if (gws.includes(sid)) continue
    const u = excedente(s, it)
    if (u > 0.001) orgs.push([posDe.get(sid), s, u])
  }
  // mais próximos do gateway mais próximo primeiro (estável e determinístico)
  const distGw = (oi) => distM[pos[maisProx(oi)] * N + oi]
  orgs.sort((a, b) => distGw(a[0]) - distGw(b[0]) || a[0] - b[0])
  for (const [oi, orig, u] of orgs) {
    if (!(resto > 0.001)) break
    const gi = maisProx(oi)
    const gw = eco.sistemas[gws[gi]]
    const dist = distM[pos[gi] * N + oi]
    const fU = dist * FUEL_DIST * Math.max(0.1, orig.precos[COMB])
    let q = Math.min(resto, u)
    const tes = eco.tesouro[naId] ?? 0
    if (fU > 0 && tes < fU * q) q = tes / fU
    if (!(q > 0.001)) continue
    const g1 = retirarDe(orig, it, q)
    if (!(g1 > 0.001)) continue
    const fuelNeed = g1 * dist * FUEL_DIST
    const gf = retirarDe(orig, COMB, fuelNeed)
    const f = fuelNeed > 0 ? gf / fuelNeed : 1
    const qEf = g1 * f
    if (!(qEf > 0.001)) {
      guardarEm(orig, it, g1)
      guardarEm(orig, COMB, gf)
      continue
    }
    if (g1 > qEf) guardarEm(orig, it, g1 - qEf)
    const fuelUsado = qEf * dist * FUEL_DIST
    if (gf > fuelUsado) guardarEm(orig, COMB, gf - fuelUsado)
    ECO_STATS.frete += fuelUsado
    guardarEm(gw, it, qEf)
    resto -= qEf
    colhido += qEf
    noGw[gws[gi]] += qEf
    escoado[oi * NI + k] += qEf
    const custoFrete = qEf * fU
    eco.tesouro[naId] = (eco.tesouro[naId] ?? 0) - custoFrete
    mov += qEf
    frete += custoFrete
    ECO_STATS.rotas++
    ECO_STATS.volume += qEf * gw.precos[it]
  }
  return { colhido, noGw, mov, frete }
}

function excedente(s, it) {
  return Math.max(0, s.estoques[it] - reqDe(s, it) * 2)
}

// cinturão M ativo → garante um ateliê de luxo no plano do planeta
// mais populoso (1 por sistema; PGM/Au sem comprador viram joia)
function garantirAtelie(s) {
  let temM = false
  for (const es of s.estacoes || []) if (es.tipo === 'M' && es.n > 0) temM = true
  if (!temM) return
  for (const p of s.planetas) {
    if (p.edificios.some((e) => e.tipo === LUX)) return
    if (p.obra?.ed?.tipo === LUX) return
    if (p.plano?.some((e) => e.tipo === LUX)) return
  }
  let maior = s.planetas[0]
  for (const p of s.planetas) if (p.pop > maior.pop) maior = p
  maior.plano = maior.plano || []
  maior.plano.push({ tipo: LUX })
}

export function evoluirEconomia(seed, base, stars, din) {
  const eco = din.eco ?? inicializarEco(seed, base, stars, din)
  // migração de saves antigos (estoque em sistema → armazém por planeta)
  if (eco && !eco.arm) {
    for (const s of Object.values(eco.sistemas)) {
      for (const p of s.planetas) {
        p.armazem = p.armazem || {}
        if (!p.plano) p.plano = []
      }
      if (!s.candidatos) s.candidatos = []
      const first = s.planetas[0]
      if (first)
        for (const [it, v] of Object.entries(s.estoques || {}))
          if (v > 0) first.armazem[it] = v
      sincronizar(s)
    }
    eco.arm = 1
  }
  // migração era da energia: usina + refinaria entram no plano de obras
  // (construir, não instantâneo — o apagão dos saves antigos se resolve
  // importando ENE, cuja necessidade já é o upkeep)
  if (eco && !eco.en) {
    for (const s of Object.values(eco.sistemas)) {
      for (const p of s.planetas) {
        p.plano = p.plano || []
        const tem = (t) =>
          p.edificios.some((e) => e.tipo === t) ||
          p.plano.some((e) => e.tipo === t)
        if (!tem('ENE')) p.plano.push({ tipo: 'ENE' })
        if (!tem('REF')) p.plano.push({ tipo: 'REF' })
      }
    }
    eco.en = 1
  }
  // migração p/ colônias tipadas (saves de antes do tipo `col`)
  if (eco && !eco.col) {
    const porNa = new Map(base.nacoes.map((na) => [na.id, na]))
    for (const [sidStr, s] of Object.entries(eco.sistemas)) {
      for (const p of s.planetas)
        if (!p.col) p.col = tipoColoniaPorQ(p.q ?? 0)
      const na = porNa.get(s.dono)
      if (na && Number(sidStr) === na.capital) garantirCivilCapital(s)
    }
    eco.col = 1
  }
  // migração das estações de mineração: cinturões dos saves antigos
  // ganham tipo/extensão (determinístico pelo seed) já minerados
  if (eco && !eco.ast) {
    const porIdA = new Map(stars.map((e) => [e.id, e]))
    for (const [sidStr, s] of Object.entries(eco.sistemas)) {
      if (s.estacoes) continue
      const sys = gerarSistema(seed, porIdA.get(Number(sidStr)))
      s.estacoes = (sys?.cinturoes || []).map((b, i) => ({
        b: i,
        nome: b.nome,
        tipo: b.tipo,
        slots: b.slots,
        n: b.slots,
      }))
      garantirAtelie(s)
    }
    eco.ast = 1
  }
  ECO_STATS.rotas = 0
  ECO_STATS.volume = 0
  ECO_STATS.fundacoes = 0
  ECO_STATS.prod = {}
  ECO_STATS.frete = 0
  const tick = din.tick
  garantirSistemas(seed, stars, base, din, eco)
  garantirHubs(eco, base, stars)
  const porNa = new Map(base.nacoes.map((na) => [na.id, na]))
  if (!eco.transito) eco.transito = []
  concluirTransito(eco)
  fundarColonias(seed, base, stars, din, eco, tick)
  // estações de mineração: 1 por sistema/tick enquanto couber no
  // tesouro; cinturão M abre um ateliê de luxo no plano do planeta
  for (const s of Object.values(eco.sistemas)) {
    let construiu = false
    const na = porNa.get(s.dono)
    if (!na) continue
    for (const es of s.estacoes || []) {
      if (construiu) break
      if (!(es.n < es.slots)) continue
      const tes = eco.tesouro[na.id] ?? 0
      if (tes < STATION_CUSTO) break
      eco.tesouro[na.id] = tes - STATION_CUSTO
      es.n++
      construiu = true
      if (es.tipo === 'M') garantirAtelie(s)
    }
  }
  for (const s of Object.values(eco.sistemas)) sincronizar(s)
  const porId = new Map(stars.map((e) => [e.id, e]))
  const emGuerra = {}
  for (const na of base.nacoes)
    emGuerra[na.id] = (din.guerras?.[na.id]?.length || 0) > 0

  const ids = Object.keys(eco.sistemas).map(Number).sort((x, y) => x - y)
  // uso/prod são fluxos do tick atual: zera antes de produzir/consumir
  for (const sid of ids) {
    const s = eco.sistemas[sid]
    if (!s.prod) s.prod = {}
    for (const it of ITENS) {
      s.uso[it] = 0
      s.prod[it] = 0
    }
  }
  eco.comercio = {}
  // 1-4: produzir, consumir, preços
  for (const sid of ids) {
    const s = eco.sistemas[sid]
    produzir(s)
    consumir(s)
    sincronizar(s)
    atualizarPrecos(s, emGuerra[s.dono], tick)
  }
  // preço médio galáctico p/ prioridade de obra (valor quando sem déficit)
  const precosGal = {}
  for (const it of ITENS) {
    let soma = 0
    let n = 0
    for (const sid of ids) {
      const v = eco.sistemas[sid].precos[it]
      if (v > 0) {
        soma += v
        n++
      }
    }
    precosGal[it] = n ? soma / n : 0
  }
  // 5: gerir obras (defesas + civis por demanda/valor, 1 por vez, com prazo)
  for (const sid of ids) {
    const s = eco.sistemas[sid]
    const na = porNa.get(s.dono)
    if (na) gerirObras(s, na, sid, precosGal)
  }

  // matriz de distâncias (1 passe) p/ o frete interno
  const N = ids.length
  const NI = ITENS.length
  const idxItem = {}
  ITENS.forEach((it, i) => {
    idxItem[it] = i
  })
  const posX = new Float64Array(N)
  const posY = new Float64Array(N)
  for (let i = 0; i < N; i++) {
    const e = porId.get(ids[i])
    posX[i] = e ? e.x : 0
    posY[i] = e ? e.y : 0
  }
  const distM = new Float64Array(N * N)
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++)
      distM[i * N + j] = i === j ? 0 : Math.hypot(posX[i] - posX[j], posY[i] - posY[j])
  // escoado[i,k]: quanto do item saiu do sistema (interno + externo) —
  // sustenta a utilização dos edifícios
  const escoado = new Float64Array(N * NI)
  const posDe = new Map(ids.map((sid, i) => [sid, i]))

  // 6: mercado interno — cada nação realoca entre SEUS sistemas p/
  // atender demandas (déficit bebe do superávit próprio de menor frete).
  // Sem imposto (mesmo caixa); o frete sai do tesouro em créditos +
  // COMB físico da origem. O lucro aparece como compra externa evitada.
  eco.interno = {}
  for (const na of base.nacoes) {
    const idx = []
    for (let i = 0; i < N; i++)
      if (eco.sistemas[ids[i]].dono === na.id) idx.push(i)
    if (idx.length < 2) continue
    let mov = 0
    let frete = 0
    for (let k = 0; k < NI; k++) {
      const it = ITENS[k]
      const def = new Map()
      const sur = new Map()
      for (const i of idx) {
        const s = eco.sistemas[ids[i]]
        const d = necessidade(s, it)
        const u = excedente(s, it)
        if (d > 0.001) def.set(i, d)
        if (u > 0.001) sur.set(i, u)
      }
      if (!def.size || !sur.size) continue
      for (const [d] of def) {
        let resto = def.get(d)
        const dest = eco.sistemas[ids[d]]
        while (resto > 0.001 && sur.size) {
          // origem mais barata (frete; desempate: menor id)
          let bO = -1
          let bF = Infinity
          for (const o of sur.keys()) {
            if (o === d) continue
            const fU =
              distM[d * N + o] *
              FUEL_DIST *
              Math.max(0.1, eco.sistemas[ids[o]].precos[COMB])
            if (fU < bF) {
              bF = fU
              bO = o
            }
          }
          if (bO < 0) break
          const orig = eco.sistemas[ids[bO]]
          let qtd = Math.min(resto, sur.get(bO))
          // frete cabe no tesouro?
          const tes = eco.tesouro[na.id] ?? 0
          if (bF > 0 && tes < bF * qtd) qtd = tes / bF
          if (!(qtd > 0.001)) {
            sur.delete(bO)
            continue
          }
          // retira de verdade (nunca negativo); ajusta pelo que saiu
          const g1 = retirarDe(orig, it, qtd)
          if (!(g1 > 0.001)) {
            sur.delete(bO)
            continue
          }
          const fuelNeed = g1 * distM[d * N + bO] * FUEL_DIST
          const gf = retirarDe(orig, COMB, fuelNeed)
          const f = fuelNeed > 0 ? gf / fuelNeed : 1
          const qtdEf = g1 * f
          if (!(qtdEf > 0.001)) {
            guardarEm(orig, it, g1)
            guardarEm(orig, COMB, gf)
            sur.delete(bO)
            continue
          }
          if (g1 > qtdEf) guardarEm(orig, it, g1 - qtdEf)
          const fuelUsado = qtdEf * distM[d * N + bO] * FUEL_DIST
          if (gf > fuelUsado) guardarEm(orig, COMB, gf - fuelUsado)
          ECO_STATS.frete += fuelUsado
          guardarEm(dest, it, qtdEf)
          const disp = sur.get(bO) - qtdEf
          if (disp > 0.001) sur.set(bO, disp)
          else sur.delete(bO)
          resto -= qtdEf
          escoado[bO * NI + k] += qtdEf
          const custoFrete = qtdEf * bF
          eco.tesouro[na.id] = (eco.tesouro[na.id] ?? 0) - custoFrete
          mov += qtdEf
          frete += custoFrete
          ECO_STATS.rotas++
          ECO_STATS.volume += qtdEf * dest.precos[it]
        }
      }
    }
    if (mov > 0.001) eco.interno[na.id] = { mov, frete }
  }
  // interno mexeu nos armazéns: recalcula o agregado p/ o externo
  for (const sid of ids) sincronizar(eco.sistemas[sid])

  // 7: mercado externo bilateral via hubs — a nação como entidade única
  // (só créditos; sem armazém nacional). O comprador escolhe quem tem o
  // menor frete hub-a-hub entre os superavitários. Pernas, todas com
  // combustível pela distância: (a) coleta interna até o hub vendedor
  // (frete do vendedor); (b) hub→hub (COMB do hub vendedor, frete em
  // créditos do comprador); (c) deficitários compram do hub nacional
  // (no interno seguinte). Preço galáctico ± spread (tarifa dos hubs).
  eco.comercio = {}
  // superávit/déficit líquidos por nação (pós-interno; 1 passe).
  // A coleta usa o excedente ao vivo, então a defasagem entre
  // negócios só subestima — nunca vende o que não há.
  const surN = {}
  const defN = {}
  for (const na of base.nacoes) {
    surN[na.id] = new Float64Array(NI)
    defN[na.id] = new Float64Array(NI)
  }
  for (const sid of ids) {
    const s = eco.sistemas[sid]
    const a = surN[s.dono]
    const b = defN[s.dono]
    if (!a) continue
    for (let k = 0; k < NI; k++) {
      const it = ITENS[k]
      a[k] += excedente(s, it)
      b[k] += necessidade(s, it)
    }
  }
  const fuelRefExt = Math.max(0.1, precosGal[COMB] || 1)
  for (const nb of base.nacoes) {
    // gateways do comprador: hub + capital (o que tiver dono válido)
    const gwsB = gatewaysDe(eco, nb.id, eco.hub[nb.id], nb.capital)
    if (!gwsB.length) continue
    const c = (eco.comercio[nb.id] ??= {
      vendas: {},
      compras: {},
      valorVendas: 0,
      valorCompras: 0,
    })
    for (let k = 0; k < NI; k++) {
      const it = ITENS[k]
      const gal = precosGal[it] || 0
      if (!(gal > 0)) continue
      // déficit líquido do comprador (pós-interno)
      const totDef = defN[nb.id][k]
      if (!(totDef > 0.001)) continue
      const pc = gal * (1 + SPREAD_EXT)
      const pv = gal * (1 - SPREAD_EXT)
      // vendedores superavitários por menor frete gateway-a-gateway
      // (melhor par entre os gateways dos dois lados)
      const cands = []
      for (const ns of base.nacoes) {
        if (ns.id === nb.id) continue
        const gwsS = gatewaysDe(eco, ns.id, eco.hub[ns.id], ns.capital)
        if (!gwsS.length) continue
        const totSur = surN[ns.id][k]
        if (!(totSur > 0.001)) continue
        let freteUn = Infinity
        for (const a of gwsB)
          for (const b of gwsS)
            freteUn = Math.min(
              freteUn,
              distM[posDe.get(a) * N + posDe.get(b)] * FUEL_DIST * fuelRefExt,
            )
        cands.push({ ns, gwsS, totSur, freteUn })
      }
      cands.sort((a, b) => a.freteUn - b.freteUn || a.ns.id - b.ns.id)
      let resto = totDef
      for (const cd of cands) {
        if (!(resto > 0.001)) break
        // cabe no tesouro do comprador? (preço + melhor frete estimado)
        const tesB = eco.tesouro[nb.id] ?? 0
        const qtd = Math.min(resto, cd.totSur, tesB / (pc + cd.freteUn))
        if (!(qtd > 0.001)) continue
        // (a) coleta até os gateways vendedores (cada sistema ao mais próximo)
        const col = coletarParaHub(
          eco, distM, posDe, N, escoado, NI, k, cd.ns.id, cd.gwsS, it, qtd,
        )
        const ei = (eco.interno[cd.ns.id] ??= { mov: 0, frete: 0 })
        ei.mov += col.mov
        ei.frete += col.frete
        if (!(col.colhido > 0.001)) continue
        // (b) embarque por gateway: cada gateway com carga voa ao
        // gateway comprador mais próximo (COMB do gateway limita)
        for (const depSid of cd.gwsS) {
          const emDep = col.noGw[depSid] || 0
          if (!(emDep > 0.001)) continue
          const posD = posDe.get(depSid)
          let arrSid = gwsB[0]
          let arrD = distM[posDe.get(arrSid) * N + posD]
          for (let i = 1; i < gwsB.length; i++) {
            const d = distM[posDe.get(gwsB[i]) * N + posD]
            if (d < arrD) {
              arrD = d
              arrSid = gwsB[i]
            }
          }
          const fretePair = arrD * FUEL_DIST * fuelRefExt
          const depSis = eco.sistemas[depSid]
          const fuelNeed = emDep * arrD * FUEL_DIST
          // COMB do gateway primeiro; faltando, o vendedor reabastece o
          // gateway com o pool nacional (senão o tanque zerado — o
          // estado normal numa galáxia faminta — matava o comércio)
          let gf = retirarDe(depSis, COMB, fuelNeed)
          if (gf < fuelNeed - 1e-6) {
            for (const sidS of ids) {
              if (gf >= fuelNeed - 1e-6) break
              const sS = eco.sistemas[sidS]
              if (sS === depSis || sS.dono !== cd.ns.id) continue
              gf += retirarDe(sS, COMB, fuelNeed - gf)
            }
          }
          const fr = fuelNeed > 0 ? gf / fuelNeed : 1
          let qtdEf = emDep * fr
          // cabe no tesouro (vivo) do comprador? o resto fica no gateway
          const tesB2 = eco.tesouro[nb.id] ?? 0
          if ((pc + fretePair) * qtdEf > tesB2)
            qtdEf = tesB2 / (pc + fretePair)
          if (!(qtdEf > 0.001)) continue
          const custoFrete = qtdEf * fretePair
          ECO_STATS.frete += qtdEf * arrD * FUEL_DIST
          eco.tesouro[nb.id] = tesB2 - qtdEf * pc - custoFrete
          eco.tesouro[cd.ns.id] =
            (eco.tesouro[cd.ns.id] ?? 0) + qtdEf * pv
          guardarEm(eco.sistemas[arrSid], it, qtdEf)
          resto -= qtdEf
          const cv = eco.comercio[cd.ns.id] ??= {
            vendas: {},
            compras: {},
            valorVendas: 0,
            valorCompras: 0,
          }
          cv.vendas[it] = (cv.vendas[it] || 0) + qtdEf
          cv.valorVendas += qtdEf * pv
          c.compras[it] = (c.compras[it] || 0) + qtdEf
          c.valorCompras += qtdEf * pc + custoFrete
          ECO_STATS.rotas++
          ECO_STATS.volume += qtdEf * pc + custoFrete
        }
      }
    }
  }

  // 8: utilização (escoou, consumido ou NECESSITADO localmente;
  // necessidade não atendida também sustenta — é o sinal de demanda
  // que tira sistemas do escuro. Sem nenhum deles → reduz.
  for (let i = 0; i < N; i++) {
    const s = eco.sistemas[ids[i]]
    for (const p of s.planetas) {
      for (const ed of p.edificios) {
        if (ed.tipo === 'militar') continue
        const out = saidaDe(ed)
        let m = escoado[i * NI + idxItem[out]] > 0.001 ? 0.01 : -1
        // consumo local também sustenta produção
        if ((s.uso[out] || 0) > 0 && m < 0.01) m = 0.01
        // necessidade local não atendida idem (demanda reprimida)
        if (m < 0.01 && necessidade(s, out) > 0.001) m = 0.01
        ed.util = m > 0 ? Math.min(1, ed.util + 0.2) : Math.max(0.1, ed.util / 2)
      }
    }
  }

  // consumo por nação (fluxo do tick, p/ a aba Economia) + imposto
  // (imposto por planeta: a riqueza multiplica a arrecadação — mundo
  // miserável rende metade, abundante rende 1,5×)
  eco.consumo = {}
  for (const sid of ids) {
    const s = eco.sistemas[sid]
    const c = (eco.consumo[s.dono] ??= {})
    for (const it of ITENS) c[it] = (c[it] || 0) + (s.uso[it] || 0)
    let imposto = 0
    for (const p of s.planetas)
      imposto += p.pop * TAXA_POP * (W_TAX[p.riqueza] ?? 1)
    eco.tesouro[s.dono] = (eco.tesouro[s.dono] ?? 0) + imposto
  }

  // 9: administração — manter o território custa (BASE×n + K×n²)/tick.
  // Sai depois do imposto; o que não couber no tesouro fica registrado
  // (a nação vive no limite e o dinheiro some do comércio, do frete e
  // das fundações — a expansão cega sufoca sozinha).
  eco.admin = {}
  eco.adminFalta = {}
  for (const na of base.nacoes) {
    const n = (din.territorios?.[na.id] ?? na.sistemas).length
    const custo = (ADMIN_BASE + ADMIN_K * n) * n
    eco.admin[na.id] = { n, custo: +custo.toFixed(2) }
    const tes = eco.tesouro[na.id] ?? 0
    const pago = Math.min(tes, custo)
    eco.tesouro[na.id] = tes - pago
    if (pago < custo - 0.01)
      eco.adminFalta[na.id] = +(custo - pago).toFixed(2)
  }

  return { ...din, eco }
}

// amadurece a economia antes do D0: n ticks virtuais (tick negativo p/
// não colidir com os streams dos ticks reais). Territórios intactos.
export function prepararEco(seed, base, stars, din, n = 60) {
  let d = din
  for (let k = 1; k <= n; k++)
    d = evoluirEconomia(seed, base, stars, { ...d, tick: k - n - 1 })
  return { ...d, tick: 0 }
}
