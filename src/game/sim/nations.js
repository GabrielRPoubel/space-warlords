// Geração procedural de nações espaciais — Space Warlords
// 9-15 nações por galáxia, tipos sorteados, capitais em G/K,
// territórios em aglomerado, nomes por cultura, rivalidades com motivo.
// Stream de RNG próprio: não altera estrelas/anomalias de saves antigos.

import { mulberry32 } from './galaxy.js'
import { hashStr } from './system.js'
import { gerarCulturas } from './cultures.js'

export const TIPOS = [
  'imperio',
  'federacao',
  'republica',
  'juntaComercial',
  'juntaMilitar',
  'teocracia',
  'anarquista',
  'pirata',
  'tecnocracia',
]

export const TITULO = {
  imperio: 'Império',
  federacao: 'Federação',
  republica: 'República',
  juntaComercial: 'Consórcio',
  juntaMilitar: 'Junta',
  teocracia: 'Sínodo',
  anarquista: 'Comuna',
  pirata: '',
  tecnocracia: 'Coletivo',
}

// paleta ordenada p/ maximizar distância perceptual entre vizinhas
export const PALETA = [
  '#ff4d5e', '#2fd6c8', '#ffd23c', '#9a6bff', '#8ee63f',
  '#ff6bd8', '#4aa8ff', '#ff6b9d', '#2fe08a', '#c86bff',
  '#6a7cff', '#d29a6b', '#b8b83c', '#9fb3c8', '#f0f0f0',
]

const TECNO_LETRAS = ['TX', 'NX', 'QV', 'ZK', 'PR', 'WL']

const GANGUES = ['Ratos', 'Cães', 'Abutres', 'Chacais', 'Hienas', 'Lobos']

// 10 glifos 7x7 por tipo ('#' = pixel). Sorteados 1 por nação, sem repetir
// o par (tipo, variante) na galáxia.
export const SIMBOLOS = {
  imperio: [
    ['#.....#', '##...##', '##.#.##', '#######', '#######', '.#####.', '.......'],
    ['#.#.#.#', '#######', '#######', '.#####.', '.#####.', '.......', '.......'],
    ['...#...', '#.....#', '##.#.##', '#######', '#######', '.#####.', '.......'],
    ['...#...', '..###..', '..###..', '.#####.', '.#####.', '#######', '.......'],
    ['...#...', '...#...', '...#...', '...#...', '.#####.', '...#...', '.#####.'],
    ['.#####.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],
    ['#..#..#', '.#...#.', '..###..', '#######', '..###..', '.#...#.', '#..#..#'],
    ['#.....#', '#.....#', '#.###.#', '#.###.#', '#######', '#######', '.......'],
    ['#######', '#.....#', '#.###.#', '#.###.#', '#.....#', '.......', '.......'],
    ['.#...#.', '.##.##.', '..###..', '.#####.', '..###..', '.##.##.', '.#...#.'],
  ],
  federacao: [
    ['...#...', '...#...', '...#...', '#######', '...#...', '...#...', '...#...'],
    ['#.....#', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#...#.', '#.....#'],
    ['...#...', '.#.#.#.', '#######', '#######', '#######', '.#.#.#.', '...#...'],
    ['.#####.', '##...##', '#.....#', '#.....#', '##...##', '.#####.', '.......'],
    ['.#####.', '##.#.##', '#..#..#', '#.....#', '##...##', '.#####.', '.......'],
    ['.......', '.##.##.', '.##.##.', '.......', '.##.##.', '.##.##.', '.......'],
    ['.#####.', '.......', '#..#..#', '...#...', '#..#..#', '.......', '.#####.'],
    ['.......', '#######', '.......', '#######', '.......', '#######', '.......'],
    ['...#...', '..###..', '.#####.', '##...##', '.......', '.......', '.......'],
    ['.#####.', '#......', '.#####.', '......#', '.#####.', '.......', '.......'],
  ],
  republica: [
    ['.#####.', '..###..', '..###..', '..###..', '..###..', '.#####.', '.......'],
    ['#######', '...#...', '..#.#..', '.#...#.', '.#...#.', '.......', '.......'],
    ['.#####.', '##...##', '##...##', '##...##', '##...##', '.......', '.......'],
    ['.#####.', '#.....#', '#.....#', '#.....#', '#.....#', '.#####.', '.......'],
    ['...#...', '..###..', '.#####.', '#######', '.......', '.......', '.......'],
    ['..####.', '..#....', '..#....', '..#....', '..#....', '.#####.', '.......'],
    ['.#.....', '.##....', '.###...', '.####..', '.#####.', '.......', '.......'],
    ['.#####.', '.#####.', '.#####.', '.......', '...#...', '..###..', '.#####.'],
    ['.##.##.', '.##.##.', '.##.##.', '.##.##.', '.##.##.', '#######', '.......'],
    ['.#####.', '#.....#', '#.....#', '#.....#', '#.....#', '.#####.', '...#...'],
  ],
  juntaComercial: [
    ['.#####.', '#######', '#######', '#######', '#######', '.#####.', '.......'],
    ['.#####.', '#######', '###.###', '#######', '#######', '.#####.', '.......'],
    ['...#...', '..###..', '.#####.', '#######', '.#####.', '..###..', '...#...'],
    ['.#####.', '#######', '.#####.', '..###..', '..###..', '...#...', '.......'],
    ['.......', '.##.##.', '.##.##.', '.......', '#######', '#######', '.......'],
    ['...#...', '...#...', '#######', '...#...', '..#.#..', '.#...#.', '#.....#'],
    ['...#...', '...#...', '.#####.', '.#.#.#.', '.#.#.#.', '.......', '.......'],
    ['##.....', '#####..', '##.....', '.....##', '..#####', '.....##', '.......'],
    ['#######', '#.....#', '#..#..#', '#.....#', '#.....#', '#######', '.......'],
    ['.#.#.#.', '.......', '.#.#.#.', '.......', '.#.#.#.', '.......', '.......'],
  ],
  juntaMilitar: [
    ['...#...', '..###..', '.#####.', '##...##', '.......', '.......', '.......'],
    ['...#...', '..###..', '.#####.', '...#...', '..###..', '.#####.', '.......'],
    ['.#####.', '#######', '#######', '#######', '.#####.', '..###..', '...#...'],
    ['...#...', '...#...', '...#...', '...#...', '.#####.', '...#...', '.#####.'],
    ['..###..', '..#.#..', '##...##', '.......', '##...##', '..#.#..', '..###..'],
    ['#######', '.......', '#######', '.......', '#######', '.......', '.......'],
    ['..###..', '..###..', '.#####.', '.#####.', '..###..', '...#...', '..###..'],
    ['#.#.#.#', '#.#.#.#', '#######', '.......', '.......', '.......', '.......'],
    ['...#...', '..###..', '..###..', '..###..', '..###..', '..###..', '.#####.'],
    ['.#####.', '#.....#', '#..#..#', '#.....#', '.#####.', '.......', '.......'],
  ],
  teocracia: [
    ['.......', '.#####.', '#######', '###.###', '#######', '.#####.', '.......'],
    ['.#####.', '##...##', '.......', '.......', '.......', '.......', '.......'],
    ['...#...', '..##...', '..###..', '.#####.', '.#####.', '.#####.', '.......'],
    ['.#####.', '##.....', '#......', '#......', '##.....', '.#####.', '.......'],
    ['...#...', '..###..', '.#####.', '.#####.', '.#####.', '..###..', '...#...'],
    ['..###..', '.#...#.', '..###..', '...#...', '...#...', '...#...', '.......'],
    ['.#####.', '.#####.', '..###..', '...#...', '...#...', '.#####.', '.......'],
    ['...#...', '..###..', '..###..', '.#####.', '.#####.', '.#####.', '.......'],
    ['##...##', '###.###', '#######', '...#...', '.......', '.......', '.......'],
    ['...#...', '..###..', '.#####.', '#######', '.......', '.......', '.......'],
  ],
  anarquista: [
    ['#.....#', '.#...#.', '..#.#..', '...#...', '..#.#..', '.#...#.', '#.....#'],
    ['.#####.', '##.....', '.......', '.......', '.....##', '.#####.', '.......'],
    ['....###', '...##..', '..##...', '.......', '...##..', '..##...', '....###'],
    ['##.....', '.##....', '..##...', '...##..', '....##.', '.....##', '.......'],
    ['#......', '....#..', '.......', '..#....', '......#', '.#.....', '...#...'],
    ['####...', '...#...', '...##..', '...#...', '...###.', '...#...', '####...'],
    ['.#####.', '......#', '.#####.', '#......', '.#####.', '.......', '.......'],
    ['.##.##.', '.##.##.', '.......', '.##.##.', '.##.##.', '.......', '.......'],
    ['...#...', '...#...', '...#...', '.......', '..###..', '.#####.', '##...##'],
    ['...#...', '.......', '.#.#.#.', '...#...', '.#.#.#.', '.......', '...#...'],
  ],
  pirata: [
    ['.#####.', '#######', '##.#.##', '#######', '.#####.', '..#.#..', '.......'],
    ['#######', '#######', '##.#.##', '#######', '..###..', '.......', '.......'],
    ['##...##', '.##.##.', '..###..', '..###..', '.##.##.', '##...##', '.......'],
    ['....###', '...##..', '..##...', '.##....', '.#####.', '...#...', '.......'],
    ['...####', '...#...', '...#...', '...#...', '...#...', '....##.', '.......'],
    ['....##.', '...##..', '..###..', '.#####.', '.#####.', '.#####.', '.......'],
    ['.......', '#######', '.#.#.#.', '#######', '.#.#.#.', '.......', '.......'],
    ['.#.#.#.', '..###..', '.#####.', '...#...', '.#####.', '..###..', '.#.#.#.'],
    ['.#####.', '#######', '##.####', '#######', '.#####.', '.......', '.......'],
    ['.#####.', '##.#.##', '#######', '..###..', '.##.##.', '##...##', '.......'],
  ],
  tecnocracia: [
    ['.#####.', '#.....#', '#..#..#', '#.....#', '#.....#', '.#####.', '.......'],
    ['.#####.', '##...##', '##...##', '##...##', '##...##', '.#####.', '.......'],
    ['..###..', '.#...#.', '#..#..#', '.#...#.', '..###..', '.......', '.......'],
    ['.#..#..', '.......', '..#..#.', '.......', '.#..#..', '.......', '.......'],
    ['.#...#.', '...#...', '.#####.', '...#...', '.#...#.', '.......', '.......'],
    ['...#...', '...#...', '...#...', '.#####.', '...#...', '...#...', '.#####.'],
    ['#######', '#.#.#.#', '#######', '.#####.', '.......', '.......', '.......'],
    ['#.....#', '.#...#.', '...#...', '.......', '...#...', '.#...#.', '#.....#'],
    ['.......', '.#####.', '.#...#.', '.#.#.#.', '.#...#.', '.#####.', '.......'],
    ['#......', '#.###..', '#.#....', '#.#####', '#......', '.......', '.......'],
  ],
}

const MOTIVOS = [
  'disputa de fronteira',
  'embargo comercial',
  'roubo de tecnologia',
  'incidente em nebulosa',
  'batalha antiga por rota de salto',
  'assassinato de emissário',
  'competição por cinturão mineral',
  'divergência ideológica profunda',
]

function nomeNacao(tipo, cultura, rand) {
  if (tipo === 'pirata') {
    const g = GANGUES[Math.floor(rand() * GANGUES.length)]
    return `${g} de ${nomeBase(cultura.sil, rand)}`
  }
  if (tipo === 'tecnocracia') {
    return `Coletivo ${TECNO_LETRAS[Math.floor(rand() * TECNO_LETRAS.length)]}-${1 + Math.floor(rand() * 90)}`
  }
  return `${TITULO[tipo]} ${nomeBase(cultura.sil, rand)}`
}

function nomeBase(sil, rand) {
  const { ini, meio } = sil
  let n = ini[Math.floor(rand() * ini.length)]
  if (rand() < 0.6) n += meio[Math.floor(rand() * meio.length)]
  const fins = ['', ' Prime', ' Nova', ' Livre']
  if (rand() < 0.25) n += fins[1 + Math.floor(rand() * (fins.length - 1))]
  return n
}

// ponto em polígono (ray casting; borda conta como dentro)
export function pontoEmPoligono(x, y, poli) {
  let dentro = false
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const xi = poli[i].x
    const yi = poli[i].y
    const xj = poli[j].x
    const yj = poli[j].y
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
      dentro = !dentro
  }
  return dentro
}

const orient = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

// só cruzamento próprio (tocar na borda é permitido: fronteira clara)
function cruzamentoProprio(p1, p2, p3, p4) {
  const d1 = orient(p3, p4, p1)
  const d2 = orient(p3, p4, p2)
  const d3 = orient(p1, p2, p3)
  const d4 = orient(p1, p2, p4)
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  )
}

export function fronteirasCruzam(h1, h2) {
  for (let i = 0; i < h1.length; i++)
    for (let j = 0; j < h2.length; j++) {
      if (
        cruzamentoProprio(
          h1[i],
          h1[(i + 1) % h1.length],
          h2[j],
          h2[(j + 1) % h2.length],
        )
      )
        return true
    }
  return false
}

// fronteira concreta: convex hull (Andrew) dos sistemas + respiro.
// <3 pontos distintos → octógono ao redor do centroide.
export function fronteiraDe(pts) {
  const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length
  const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length
  const cross = (o, a, b) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const ord = [...pts].sort((a, b) => a.x - b.x || a.y - b.y)
  let casco
  if (ord.length < 3) {
    let r = 0.035
    if (ord.length === 2)
      r = Math.max(0.035, Math.hypot(ord[1].x - ord[0].x, ord[1].y - ord[0].y) / 2 + 0.02)
    casco = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2
      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }
    })
  } else {
    const inf = []
    for (const p of ord) {
      while (inf.length >= 2 && cross(inf[inf.length - 2], inf[inf.length - 1], p) <= 0)
        inf.pop()
      inf.push(p)
    }
    const sup = []
    for (let i = ord.length - 1; i >= 0; i--) {
      const p = ord[i]
      while (sup.length >= 2 && cross(sup[sup.length - 2], sup[sup.length - 1], p) <= 0)
        sup.pop()
      sup.push(p)
    }
    inf.pop()
    sup.pop()
    casco = [...inf, ...sup]
    if (casco.length < 3) {
      // colineares: octógono cobrindo a extensão
      const span = Math.max(
        0.02,
        ...ord.map((p) => Math.hypot(p.x - cx, p.y - cy)),
      )
      casco = Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2
        return { x: cx + Math.cos(a) * (span + 0.02), y: cy + Math.sin(a) * (span + 0.02) }
      })
    }
  }
  // respiro: empurra cada vértice 0.015 p/ fora do centroide
  return casco.map((p) => {
    const dx = p.x - cx
    const dy = p.y - cy
    const d = Math.hypot(dx, dy) || 1
    return { x: +(p.x + (dx / d) * 0.015).toFixed(4), y: +(p.y + (dy / d) * 0.015).toFixed(4) }
  })
}

export function gerarNacoes(seed, stars) {
  const rand = mulberry32((seed ^ 0x51ab3f29) >>> 0)
  const n = 9 + Math.floor(rand() * 7) // 9-15
  const reivindicadas = new Set()
  const nacoes = []
  // 1 cultura por nação, sem repetir na galáxia (84 opções)
  let baralho = gerarCulturas(seed)
  for (let i = baralho.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[baralho[i], baralho[j]] = [baralho[j], baralho[i]]
  }
  // garante ≥1 cultura de cada região: 1º de cada região vai p/ frente
  // (partição estável, sem consumir RNG: não altera o stream)
  {
    const vistas = new Set()
    const frente = []
    const resto = []
    for (const c of baralho) {
      if (!vistas.has(c.regiao)) {
        vistas.add(c.regiao)
        frente.push(c)
      } else resto.push(c)
    }
    baralho = frente.concat(resto)
  }
  const nomesUsados = new Map()
  const simbolosUsados = {}
  const ROM = ['', '', ' II', ' III', ' IV', ' V', ' VI']
  const nomeUnico = (base) => {
    const k = (nomesUsados.get(base) || 0) + 1
    nomesUsados.set(base, k)
    return k === 1 ? base : base + (ROM[k] || ` ${k}`)
  }

  // capitais candidatas: G/K embaralhadas
  const candidatas = stars.filter((s) => s.tipo === 'G' || s.tipo === 'K')
  const reserva = stars.filter((s) => s.tipo !== 'G' && s.tipo !== 'K')
  for (let i = candidatas.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[candidatas[i], candidatas[j]] = [candidatas[j], candidatas[i]]
  }

  const porId = new Map(stars.map((s) => [s.id, s]))
  const fronteiras = [] // cascos finalizados (fronteiras invioláveis)
  const dentroDeFronteira = (x, y) =>
    fronteiras.some((f) => pontoEmPoligono(x, y, f))

  let ci = 0
  const proximaCapital = () => {
    const livreFora = (s) => {
      if (reivindicadas.has(s.id) || dentroDeFronteira(s.x, s.y)) return false
      // octógono da capital (caso pirata de 1 estrela) também não invade
      const h = fronteiraDe([s])
      if (fronteiras.some((f) => fronteirasCruzam(h, f))) return false
      for (const id of reivindicadas) {
        const e = porId.get(id)
        if (pontoEmPoligono(e.x, e.y, h)) return false
      }
      return true
    }
    while (ci < candidatas.length) {
      const s = candidatas[ci++]
      if (livreFora(s)) return s
    }
    return reserva.find(livreFora) || null
  }

  for (let i = 0; i < n; i++) {
    const tipo = TIPOS[Math.floor(rand() * TIPOS.length)]
    // símbolo único: sorteia variante livre do tipo (10 opções)
    if (!simbolosUsados[tipo]) simbolosUsados[tipo] = new Set()
    let simbolo = Math.floor(rand() * 10)
    let tentS = 0
    while (simbolosUsados[tipo].has(simbolo) && tentS++ < 30)
      simbolo = Math.floor(rand() * 10)
    simbolosUsados[tipo].add(simbolo)
    // 2-60 sistemas: potência 2.2 enviesa p/ pequenas, com gigantes raras
    const tamanho =
      tipo === 'pirata' ? 1 : 2 + Math.floor(rand() ** 2.2 * 59)
    const capital = proximaCapital()
    if (!capital) break
    reivindicadas.add(capital.id)
    const sistemas = [capital.id]
    if (tamanho > 1) {
      // aglomerado: as livres mais próximas da capital, sem invadir
      // fronteiras alheias (nem conter estrelas de outras nações).
      // A capital e as já reivindicadas pela PRÓPRIA nação não contam.
      const proprias = new Set(sistemas)
      const estrangeiras = [...reivindicadas]
        .filter((id) => !proprias.has(id))
        .map((id) => porId.get(id))
      const candidatas = stars
        .filter((s) => !reivindicadas.has(s.id))
        .map((s) => ({
          s,
          d: (s.x - capital.x) ** 2 + (s.y - capital.y) ** 2,
        }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 400)
      for (const { s } of candidatas) {
        if (sistemas.length >= tamanho) break
        if (dentroDeFronteira(s.x, s.y)) continue
        const pts = [...sistemas.map((id) => porId.get(id)), s]
        const h = fronteiraDe(pts)
        if (fronteiras.some((f) => fronteirasCruzam(h, f))) continue
        if (estrangeiras.some((e) => pontoEmPoligono(e.x, e.y, h))) continue
        reivindicadas.add(s.id)
        sistemas.push(s.id)
      }
    }
    // centro + raio de influência (círculo difuso)
    const pts = sistemas.map((id) => stars[id])
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length
    const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length
    const raio =
      Math.max(...pts.map((p) => Math.hypot(p.x - cx, p.y - cy))) + 0.03
    nacoes.push({
      id: i,
      nome: nomeUnico(nomeNacao(tipo, baralho[i], rand)),
      tipo,
      simbolo,
      cultura: {
        id: baralho[i].id,
        nome: baralho[i].nome,
        povo: baralho[i].povo,
        regiao: baralho[i].regiao,
        sil: baralho[i].sil,
        nom: baralho[i].nom,
      },
      cor: PALETA[i % PALETA.length],
      capital: capital.id,
      sistemas,
      centro: { x: cx, y: cy },
      raio,
      fronteira: fronteiraDe(pts),
      relacoes: [],
    })
    fronteiras.push(nacoes[nacoes.length - 1].fronteira)
  }

// rivalidades (1-2) + aliança (0-1), espelhadas, sem par repetido
  const pares = new Set()
  const parKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`)
  for (let i = 0; i < nacoes.length; i++) {
    const rivais = 1 + Math.floor(rand() * 2)
    let tent = 0
    let colocados = 0
    while (colocados < rivais && tent++ < 30) {
      const j = Math.floor(rand() * nacoes.length)
      if (j === i || pares.has(parKey(i, j))) continue
      pares.add(parKey(i, j))
      const motivo = MOTIVOS[Math.floor(rand() * MOTIVOS.length)]
      nacoes[i].relacoes.push({ com: j, tipo: 'rival', motivo })
      nacoes[j].relacoes.push({ com: i, tipo: 'rival', motivo })
      colocados++
    }
    if (rand() < 0.5) {
      tent = 0
      while (tent++ < 30) {
        const j = Math.floor(rand() * nacoes.length)
        if (j === i || pares.has(parKey(i, j))) continue
        pares.add(parKey(i, j))
        const motivo =
          rand() < 0.5 ? 'acordo comercial' : 'pacto de defesa mútua'
        nacoes[i].relacoes.push({ com: j, tipo: 'aliado', motivo })
        nacoes[j].relacoes.push({ com: i, tipo: 'aliado', motivo })
        break
      }
    }
  }

  const donoPorEstrela = {}
  nacoes.forEach((na, idx) => {
    for (const id of na.sistemas) donoPorEstrela[id] = idx
  })

  return { nacoes, dono: donoPorEstrela, semente: (seed ^ 0x51ab3f29) >>> 0, hash: hashStr(nacoes.map((x) => x.nome).join('|')) }
}

// ---- Perfis de evolução (expansão, agressão, diplomacia, indústria 0-10) ----
export const PERFIS = {
  imperio: { exp: 8, agr: 7, dip: 3, ind: 6 },
  federacao: { exp: 5, agr: 2, dip: 9, ind: 6 },
  republica: { exp: 5, agr: 3, dip: 7, ind: 6 },
  juntaComercial: { exp: 4, agr: 1, dip: 8, ind: 9 },
  juntaMilitar: { exp: 6, agr: 8, dip: 2, ind: 5 },
  teocracia: { exp: 5, agr: 4, dip: 5, ind: 4 },
  anarquista: { exp: 3, agr: 5, dip: 4, ind: 3 },
  pirata: { exp: 0, agr: 9, dip: 0, ind: 2 },
  tecnocracia: { exp: 4, agr: 3, dip: 6, ind: 9 },
}

const EVENTOS_IND = {
  imperio: ['desfile naval na capital', 'novo estaleiro orbital', 'recrutamento em massa'],
  federacao: ['cúpula diplomática', 'nova rota comercial', 'festival da unidade'],
  republica: ['eleições tensas', 'reforma agrária orbital', 'novo censo estelar'],
  juntaComercial: ['recorde de lucros', 'nova bolsa de minérios', 'fusão de guildas'],
  juntaMilitar: ['exercício de bloqueio', 'nova doutrina de assalto', 'parada de encouraçados'],
  teocracia: ['peregrinação em massa', 'novo templo orbital', 'profecia anunciada'],
  anarquista: ['assembleia geral', 'mutirão de reparos', 'rádio livre no ar'],
  pirata: ['saque ousado', 'novo esconderijo', 'motim contido'],
  tecnocracia: ['avanço em dobra', 'nova IA de bordo', 'experimento arriscado'],
}

// estado dinâmico inicial (territórios = gerados; reputação zerada)
export function inicialDin(base) {
  const territorios = {}
  base.nacoes.forEach((na) => {
    territorios[na.id] = [...na.sistemas]
  })
  return { tick: 0, v: 2, rep: {}, territorios, guerras: {}, eventos: {} }
}

// aplica o estado dinâmico sobre a base estática (nomes/cores/relações intactos)
export function aplicarDinamica(base, stars, din) {
  const porId = new Map(stars.map((s) => [s.id, s]))
  const nacoes = base.nacoes.map((na) => {
    const sistemas = din?.territorios?.[na.id] ?? na.sistemas
    const pts = sistemas.map((id) => porId.get(id)).filter(Boolean)
    const cx = pts.reduce((a, p) => a + p.x, 0) / Math.max(1, pts.length)
    const cy = pts.reduce((a, p) => a + p.y, 0) / Math.max(1, pts.length)
    const raio =
      Math.max(0.01, ...pts.map((p) => Math.hypot(p.x - cx, p.y - cy))) + 0.03
    return {
      ...na,
      sistemas,
      centro: { x: cx, y: cy },
      raio,
      fronteira: pts.length ? fronteiraDe(pts) : na.fronteira,
      rep: din?.rep?.[na.id] ?? 0,
      guerras: din?.guerras?.[na.id] ?? [],
      eventos: din?.eventos?.[na.id] ?? [],
    }
  })
  const dono = {}
  nacoes.forEach((na, idx) => {
    for (const id of na.sistemas) dono[id] = idx
  })
  const cap = {}
  nacoes.forEach((na) => {
    cap[na.capital] = na
  })
  return { ...base, nacoes, dono, cap }
}

// 1 tick de evolução: puro em (seed, tick, estado) → determinístico.
// Capitais são invioláveis; fronteiras seguem invioláveis entre si.
export function evoluirNacoes(seed, stars, base, din) {
  const tick = din.tick + 1
  const porId = new Map(stars.map((s) => [s.id, s]))
  const territorios = {}
  for (const na of base.nacoes)
    territorios[na.id] = [...(din.territorios?.[na.id] ?? na.sistemas)]
  const guerras = {}
  for (const na of base.nacoes)
    guerras[na.id] = [...(din.guerras?.[na.id] ?? [])]
  const eventos = {}
  for (const na of base.nacoes)
    eventos[na.id] = [...(din.eventos?.[na.id] ?? [])]
  const rep = { ...(din.rep || {}) }
  const log = (id, texto) => {
    eventos[id].push({ tick, texto })
    if (eventos[id].length > 5) eventos[id].shift()
  }
  const donoDe = (starId) => {
    for (const na of base.nacoes)
      if (territorios[na.id].includes(starId)) return na.id
    return null
  }
  const hulls = {}
  const syncHull = (id) =>
    (hulls[id] = fronteiraDe(territorios[id].map((sid) => porId.get(sid))))
  base.nacoes.forEach((na) => syncHull(na.id))
  const hullAlheioContem = (x, y, exceto) =>
    base.nacoes.some(
      (o) => o.id !== exceto && pontoEmPoligono(x, y, hulls[o.id]),
    )
  const cruzaCasco = (h, exceto) =>
    base.nacoes.some((o) => o.id !== exceto && fronteirasCruzam(h, hulls[o.id]))
  const envolveEstrangeira = (h, exceto) => {
    for (const o of base.nacoes) {
      if (o.id === exceto) continue
      for (const sid of territorios[o.id]) {
        const e = porId.get(sid)
        if (pontoEmPoligono(e.x, e.y, h)) return true
      }
    }
    return false
  }

  // reputação decai 1 a cada 5 ticks em direção a 0 (esquecimento)
  if (tick % 5 === 0) {
    for (const k of Object.keys(rep)) {
      if (rep[k] > 0) rep[k]--
      else if (rep[k] < 0) rep[k]++
      if (rep[k] === 0) delete rep[k]
    }
  }

  for (const na of base.nacoes) {
    const P = PERFIS[na.tipo]
    const r = mulberry32(hashStr(`${seed}:${tick}:${na.id}`))
    const meus = territorios[na.id]

    // expansão: coloniza 1 estrela livre vizinha
    if (P.exp > 0 && meus.length < 80 && r() < (P.exp / 10) * 0.35) {
      const cap = porId.get(na.capital)
      const cand = stars
        .filter((s) => donoDe(s.id) == null)
        .map((s) => ({ s, d: (s.x - cap.x) ** 2 + (s.y - cap.y) ** 2 }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 200)
      for (const { s } of cand) {
        if (hullAlheioContem(s.x, s.y, na.id)) continue
        const h = fronteiraDe([...meus.map((id) => porId.get(id)), s])
        if (cruzaCasco(h, na.id) || envolveEstrangeira(h, na.id)) continue
        meus.push(s.id)
        syncHull(na.id)
        log(na.id, `colonizou S${s.id}`)
        break
      }
    }

    // guerra: rouba 1 sistema não-capital do rival mais fraco em guerra/não
    if (P.agr > 0 && r() < (P.agr / 10) * 0.22) {
      const alvos = base.nacoes
        .filter((o) => o.id !== na.id && territorios[o.id].length > 1)
        .sort((a, b) => territorios[a.id].length - territorios[b.id].length)
      const alvo = alvos[0]
      if (alvo) {
        const capA = porId.get(na.capital)
        const vit = territorios[alvo.id]
          .filter((id) => id !== alvo.capital)
          .map((id) => porId.get(id))
          .sort(
            (a, b) =>
              (a.x - capA.x) ** 2 + (a.y - capA.y) ** 2 - ((b.x - capA.x) ** 2 + (b.y - capA.y) ** 2),
          )[0]
        if (vit) {
          const h = fronteiraDe([...meus.map((id) => porId.get(id)), vit])
          if (!cruzaCasco(h, na.id) && !envolveEstrangeira(h, na.id)) {
            territorios[alvo.id] = territorios[alvo.id].filter(
              (id) => id !== vit.id,
            )
            meus.push(vit.id)
            syncHull(na.id)
            syncHull(alvo.id)
            if (!guerras[na.id].includes(alvo.id)) guerras[na.id].push(alvo.id)
            if (!guerras[alvo.id].includes(na.id)) guerras[alvo.id].push(na.id)
            log(na.id, `tomou S${vit.id} de ${alvo.nome}`)
            log(alvo.id, `perdeu S${vit.id} para ${na.nome}`)
          }
        }
      }
    }

    // diplomacia: encerra 1 guerra
    if (guerras[na.id].length && r() < (P.dip / 10) * 0.4) {
      const g = guerras[na.id][0]
      guerras[na.id] = guerras[na.id].filter((x) => x !== g)
      guerras[g] = (guerras[g] || []).filter((x) => x !== na.id)
      const outro = base.nacoes.find((o) => o.id === g)
      log(na.id, `paz com ${outro ? outro.nome : '?'}`)
      if (outro) log(g, `paz com ${na.nome}`)
    }

    // indústria: evento interno de sabor
    if (r() < (P.ind / 10) * 0.3) {
      const tab = EVENTOS_IND[na.tipo] || EVENTOS_IND.republica
      log(na.id, tab[Math.floor(r() * tab.length)])
    }
  }

  // preserva o resto do din (eco, v): só estes campos evoluem aqui
  return { ...din, tick, rep, territorios, guerras, eventos }
}
