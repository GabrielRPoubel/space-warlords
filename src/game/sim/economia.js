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
const C_PROD = 14
// biomassa: população recicla carbono (C) — fecha o ciclo do alimento
const BIO_CARBONO = 0.001
const FUEL_EXT = 0.3
const FUEL_SINT = 0.5
const FUEL_DIST = 2.0
const TAXA_LOG = 0.05
const BONUS_MESMA_NACAO = 1.2

export const COMB = 'COMB'
export const ALI = 'ALI'
export const MAN = 'MAN'

export const PRECO_BASE = {
  H: 2, He: 3, H2O: 4, Fe: 6, Si: 5, O: 2, Mg: 3, Ni: 12,
  Al: 8, Ca: 2, S: 3, CH4: 4, NH3: 4, NaCl: 3, K: 6, C: 5,
  [COMB]: 6, [ALI]: 12, [MAN]: 25,
}

const ITENS = Object.keys(PRECO_BASE)

export const ECO_STATS = { rotas: 0, volume: 0, fundacoes: 0, prod: {} }
// imposto por pop/tick p/ o tesouro (a economia precisa de fonte de moeda)
const TAXA_POP = 0.02
// prazo de obra em ticks por tipo de edifício
const TEMPO_OBRA = { extrator: 3, COMB: 3, ALI: 5, MAN: 5, militar: 4 }

// governos expansionistas: bônus ×3 na fundação de colônias
const EXPANSIONISTAS = new Set(['imperio', 'juntaMilitar'])
const CHANCE_BASE_COLONIA = 0.1
const CUSTO_REC_COLONIA = { [MAN]: 50, [ALI]: 100, [COMB]: 100 }
const custoTesouroColonia = (q) => Math.round(800 + 2000 * (1 - q))

export const NOME_SINTESE = {
  [COMB]: 'Coletor de voláteis',
  [ALI]: 'Fazenda hidropônica',
  [MAN]: 'Fábrica',
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
// orgânicos p/ alimentos: C, CH4 ou NH3 (o que houver)
const ORG = ['C', 'CH4', 'NH3']
const RECEITAS = {
  [ALI]: { H2O: 2, ORG: 1 },
  [MAN]: { Fe: 2, Si: 1 },
}
// cada lote rende várias unidades (agricultura/indústria multiplicam insumos)
const RENDIMENTO = { [ALI]: 4, [MAN]: 3 }

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
  // hidroponia: toda colônia cultiva alimentos (importa insumos se preciso)
  eds.push({ tipo: ALI })
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
  return { dono: null, planetas, candidatos, estoques, precos, uso, escassez: false, falta: [] }
}

function necessidadeInicial(s) {
  let pop = 0
  for (const p of s.planetas) pop += p.pop
  return { [ALI]: pop * CONS_ALI * 3, [MAN]: pop * CONS_MAN * 3, [COMB]: 20 }
}

function montarSistema(seed, estrela, na, completo = true) {
  const sp = sistemaPovoado(seed, estrela, completo)
  if (!sp) return null
  sp.dono = na.id
  aplicarDefesas(sp, na, estrela.id)
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

function produzir(s) {
  const entra = (it, v, p) => {
    if (v > 0) {
      p.armazem[it] = (p.armazem[it] || 0) + v
      ECO_STATS.prod[it] = (ECO_STATS.prod[it] || 0) + v
    }
  }
  for (const p of s.planetas) {
    for (const ed of p.edificios) {
      if (ed.tipo === 'militar') continue // defesa: sem produção
      if (ed.tipo === 'extrator') {
        const taxa = C_PROD * (p.reservas[ed.el] || 0) ** 0.7 * ed.util
        const gf = retirarDe(s, COMB, taxa * FUEL_EXT)
        const f = taxa > 0 ? gf / (taxa * FUEL_EXT || 1) : 1
        const out = taxa * f
        s.uso[COMB] += gf
        entra(ed.el, out, p)
      } else if (ed.tipo === COMB) {
        let vol = 0
        for (const el of VOLATEIS) vol += p.reservas[el] || 0
        entra(COMB, C_PROD * vol ** 0.7 * ed.util, p)
      } else {
        // síntese de bens a partir do estoque local (ORG = C/CH4/NH3)
        const rec = RECEITAS[ed.tipo]
        const orgDisp =
          ed.tipo === ALI
            ? ORG.reduce((a, el) => a + (s.estoques[el] || 0), 0)
            : Infinity
        let lotes = Infinity
        for (const [el, qtd] of Object.entries(rec)) {
          if (el === 'ORG') lotes = Math.min(lotes, orgDisp / qtd)
          else lotes = Math.min(lotes, (s.estoques[el] || 0) / qtd)
        }
        lotes = Math.min(lotes, s.estoques[COMB] / FUEL_SINT || 0)
        lotes = Math.max(0, lotes) * ed.util
        if (lotes > 0 && isFinite(lotes)) {
          // confirma retirando de verdade (escala se faltar insumo)
          let f = 1
          for (const [el, qtd] of Object.entries(rec)) {
            if (el === 'ORG') {
              let resto = lotes * qtd
              let tirado = 0
              for (const o of ORG) {
                const g = retirarDe(s, o, resto)
                tirado += g
                s.uso[o] += g
                resto -= g
                if (resto <= 0) break
              }
              f = Math.min(f, tirado / (lotes * qtd || 1))
            } else {
              const g = retirarDe(s, el, lotes * qtd)
              s.uso[el] += g
              f = Math.min(f, g / (lotes * qtd || 1))
            }
          }
          const gf = retirarDe(s, COMB, lotes * FUEL_SINT)
          s.uso[COMB] += gf
          f = Math.min(f, gf / (lotes * FUEL_SINT || 1))
          entra(ed.tipo, lotes * f * (RENDIMENTO[ed.tipo] || 1), p)
        }
      }
    }
    sincronizar(s)
  }
}

function consumir(s) {
  let pop = 0
  for (const p of s.planetas) pop += p.pop
  const needAli = pop * CONS_ALI
  const needMan = pop * CONS_MAN
  const gotAli = retirarDe(s, ALI, needAli)
  const gotMan = retirarDe(s, MAN, needMan)
  const fAli = needAli > 0 ? gotAli / needAli : 1
  const fMan = needMan > 0 ? gotMan / needMan : 1
  s.uso[ALI] += gotAli
  s.uso[MAN] += gotMan
  for (const p of s.planetas) {
    p.armazem.C = (p.armazem.C || 0) + p.pop * BIO_CARBONO
    const r = taxaCrescimento(fAli, fMan, p.pop, p.pop0)
    p.pop = Math.max(1, Math.min(p.pop0 * 2, p.pop * (1 + r)))
  }
  const ok = fAli >= 1 && fMan >= 1
  s.escassez = !ok
  s.falta = []
  if (fAli < 1) s.falta.push(ALI)
  if (fMan < 1) s.falta.push(MAN)
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
      pop0: cand.pop0, pop: Math.max(1, Math.round(cand.pop0 * 0.1)),
      reservas: cand.reservas, armazem: {},
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
  return ed.tipo === 'extrator' ? ed.el : ed.tipo
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
    const civis = p.edificios.filter((e) => e.tipo !== 'militar').length
    const alvo = Math.min(civis + p.plano.length, 1 + Math.floor(p.pop / p.pop0 / 0.25))
    if (civis >= alvo) continue
    const ed = escolherPlano(p, s, precosGal)
    if (ed) {
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

// necessidade estrutural (biológica p/ bens de consumo, fluxo p/ o resto)
function reqDe(s, it) {
  if (it === ALI) return popDe(s) * CONS_ALI
  if (it === MAN) return popDe(s) * CONS_MAN
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

function excedente(s, it) {
  return Math.max(0, s.estoques[it] - reqDe(s, it) * 2)
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
  ECO_STATS.rotas = 0
  ECO_STATS.volume = 0
  ECO_STATS.fundacoes = 0
  ECO_STATS.prod = {}
  const tick = din.tick
  garantirSistemas(seed, stars, base, din, eco)
  const porNa = new Map(base.nacoes.map((na) => [na.id, na]))
  if (!eco.transito) eco.transito = []
  concluirTransito(eco)
  fundarColonias(seed, base, stars, din, eco, tick)
  for (const s of Object.values(eco.sistemas)) sincronizar(s)
  const porId = new Map(stars.map((e) => [e.id, e]))
  const emGuerra = {}
  for (const na of base.nacoes)
    emGuerra[na.id] = (din.guerras?.[na.id]?.length || 0) > 0

  const ids = Object.keys(eco.sistemas).map(Number).sort((x, y) => x - y)
  // uso é fluxo do tick atual: zera antes de produzir/consumir
  for (const sid of ids) {
    const s = eco.sistemas[sid]
    for (const it of ITENS) s.uso[it] = 0
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

  // matriz de distâncias (1 passe) + melhor margem de exportação p/ util
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
  const melhorExp = new Float64Array(N * NI).fill(-Infinity)

  // 5: comércio entre sistemas (melhor rota por déficit, com bônus interno)
  for (let k = 0; k < NI; k++) {
    const it = ITENS[k]
    const def = new Float64Array(N)
    const sur = new Float64Array(N)
    let anyDef = false
    let anySur = false
    for (let i = 0; i < N; i++) {
      const s = eco.sistemas[ids[i]]
      def[i] = necessidade(s, it)
      sur[i] = excedente(s, it)
      if (def[i] > 0) anyDef = true
      if (sur[i] > 0) anySur = true
    }
    if (!anyDef || !anySur) continue
    for (let d = 0; d < N; d++) {
      if (def[d] <= 0) continue
      const dest = eco.sistemas[ids[d]]
      const dNa = dest.dono
      const pD = dest.precos[it]
      const taxaD = TAXA_LOG * pD
      let bOid = -1
      let bEff = 0
      let bFrete = 0
      for (let o = 0; o < N; o++) {
        if (o === d || sur[o] <= 0) continue
        const orig = eco.sistemas[ids[o]]
        const fuelO = Math.max(0.1, orig.precos[COMB])
        const margem = pD - orig.precos[it] - distM[d * N + o] * FUEL_DIST * fuelO - taxaD
        if (margem > melhorExp[o * NI + k]) melhorExp[o * NI + k] = margem
        if (margem <= 0) continue
        const eff = margem * (orig.dono === dNa ? BONUS_MESMA_NACAO : 1)
        if (eff > bEff) {
          bEff = eff
          bOid = o
          bFrete = distM[d * N + o] * FUEL_DIST * fuelO
        }
      }
      if (bOid < 0) continue
      const orig = eco.sistemas[ids[bOid]]
      const oNa = orig.dono
      let qtd = Math.min(def[d], sur[bOid])
      const tesD = eco.tesouro[dNa] ?? 0
      const custoUn = pD + bFrete
      if (tesD < custoUn * qtd) qtd = tesD / custoUn
      if (!(qtd > 0.001)) continue
      // retira de verdade (nunca negativo); ajusta pelo que saiu
      const g1 = retirarDe(orig, it, qtd)
      if (!(g1 > 0.001)) continue
      const fuelNeed = g1 * distM[d * N + bOid] * FUEL_DIST
      const gf = retirarDe(orig, COMB, fuelNeed)
      const f = fuelNeed > 0 ? gf / fuelNeed : 1
      const qtdEf = g1 * f
      if (!(qtdEf > 0.001)) {
        guardarEm(orig, it, g1)
        guardarEm(orig, COMB, gf)
        continue
      }
      if (g1 > qtdEf) guardarEm(orig, it, g1 - qtdEf)
      const fuelUsado = qtdEf * distM[d * N + bOid] * FUEL_DIST
      if (gf > fuelUsado) guardarEm(orig, COMB, gf - fuelUsado)
      guardarEm(dest, it, qtdEf)
      sur[bOid] -= qtdEf
      const valor = qtdEf * pD
      eco.tesouro[dNa] = tesD - valor - qtdEf * bFrete
      eco.tesouro[oNa] = (eco.tesouro[oNa] ?? 0) + valor * (1 - TAXA_LOG)
      const cd = (eco.comercio[dNa] ??= { vendas: {}, compras: {}, valorVendas: 0, valorCompras: 0 })
      const co = (eco.comercio[oNa] ??= { vendas: {}, compras: {}, valorVendas: 0, valorCompras: 0 })
      co.vendas[it] = (co.vendas[it] || 0) + qtdEf
      cd.compras[it] = (cd.compras[it] || 0) + qtdEf
      co.valorVendas += valor * (1 - TAXA_LOG)
      cd.valorCompras += valor + qtdEf * bFrete
      ECO_STATS.rotas++
      ECO_STATS.volume += valor
    }
  }

  // 6: utilização (margem na melhor rota; sem rota lucrativa → reduz)
  for (let i = 0; i < N; i++) {
    const s = eco.sistemas[ids[i]]
    for (const p of s.planetas) {
      for (const ed of p.edificios) {
        if (ed.tipo === 'militar') continue
        const out = ed.tipo === 'extrator' ? ed.el : ed.tipo
        let m = melhorExp[i * NI + idxItem[out]]
        // consumo local também sustenta produção
        if ((s.uso[out] || 0) > 0 && m < 0.01) m = 0.01
        ed.util = m > 0 ? Math.min(1, ed.util + 0.2) : Math.max(0.1, ed.util / 2)
      }
    }
  }

  // consumo por nação (fluxo do tick, p/ a aba Economia) + imposto
  eco.consumo = {}
  for (const sid of ids) {
    const s = eco.sistemas[sid]
    const c = (eco.consumo[s.dono] ??= {})
    for (const it of ITENS) c[it] = (c[it] || 0) + (s.uso[it] || 0)
    eco.tesouro[s.dono] = (eco.tesouro[s.dono] ?? 0) + popDe(s) * TAXA_POP
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
