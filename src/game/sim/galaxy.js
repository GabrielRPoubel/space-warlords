// Gerador procedural da galáxia — Space Warlords
// 2000 estrelas, formas variadas, divisão em 100 quadrantes (média 20/q).

export const TOTAL_STARS = 2000
export const GRID_N = 10 // 10x10 = 100 quadrantes
export const QUADRANT_COUNT = GRID_N * GRID_N

export const SHAPES = ['espiral', 'eliptica', 'anel', 'irregular']

// RNG determinístico (mulberry32)
export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussian(rand) {
  // Box-Muller aproximado com 2 chamadas
  const u = Math.max(rand(), 1e-9)
  const v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function gerarPosicao(shape, rand) {
  // Retorna {x, y} em [-1, 1]
  if (shape === 'espiral') {
    const bracos = 2 + Math.floor(rand() * 2) // 2-3 braços
    const braco = Math.floor(rand() * bracos)
    const t = rand() // 0..1 ao longo do braço
    const anguloBase = (braco / bracos) * Math.PI * 2
    const espiral = t * 3.2
    const angulo = anguloBase + espiral + gaussian(rand) * 0.28 * (1 - t * 0.5)
    const raio = 0.12 + t * 0.85 + gaussian(rand) * 0.06
    return { x: Math.cos(angulo) * raio, y: Math.sin(angulo) * raio * 0.9 }
  }
  if (shape === 'eliptica') {
    return {
      x: gaussian(rand) * 0.42,
      y: gaussian(rand) * 0.26,
    }
  }
  if (shape === 'anel') {
    const angulo = rand() * Math.PI * 2
    const raio = 0.62 + gaussian(rand) * 0.13
    const nucleo = rand() < 0.12 // 12% no núcleo central
    if (nucleo) return { x: gaussian(rand) * 0.12, y: gaussian(rand) * 0.12 }
    return { x: Math.cos(angulo) * raio, y: Math.sin(angulo) * raio }
  }
  // irregular: clusters
  const cx = (rand() * 2 - 1) * 0.6
  const cy = (rand() * 2 - 1) * 0.6
  return { x: cx + gaussian(rand) * 0.22, y: cy + gaussian(rand) * 0.22 }
}

// Classes espectrais (sequência principal OBAFGKM + gigante vermelha).
// Raios em R☉ e temperaturas aproximados da astrofísica real:
//   O: >30000K · B: 10000-30000K · A: 7500-10000K · F: 6000-7500K
//   G: 5200-6000K (Sol = G2V, 1 R☉) · K: 3700-5200K · M: <3700K
// Distribuição comprimida p/ jogo (na Via Láctea ~76% seria M).
// `tamanho` (px) preserva a ordem de grandeza via raiz quadrada do raio:
//   tamanho = 1.2 + 1.5 * sqrt(raioSol)  →  M≈2.0 … O≈5.5, gigante≈8+
const CLASSES = [
  // [limiteAcumulado, classe, cor, raioMin, raioMax, tempMin, tempMax]
  [0.5, 'M', '#ff9e6b', 0.15, 0.65, 2300, 3700],
  [0.68, 'K', '#ffcf9e', 0.65, 0.95, 3700, 5200],
  [0.8, 'G', '#ffedd0', 0.95, 1.15, 5200, 6000],
  [0.88, 'F', '#fff6e8', 1.15, 1.4, 6000, 7500],
  [0.94, 'A', '#dbe7ff', 1.4, 1.8, 7500, 10000],
  [0.985, 'B', '#aec4ff', 1.8, 6.5, 10000, 30000],
  [0.995, 'O', '#9db4ff', 6.5, 10, 30000, 50000],
  [1.0, 'Gigante vermelha', '#ff7a59', 12, 40, 3000, 4500],
]

function tipoEstrela(rand) {
  const r = rand()
  const c = CLASSES.find((cl) => r < cl[0])
  const [, classe, cor, raioMin, raioMax, tempMin, tempMax] = c
  const raioSol = raioMin + rand() * (raioMax - raioMin)
  const tempK = Math.round(tempMin + rand() * (tempMax - tempMin))
  const tamanho = 1.2 + 1.5 * Math.sqrt(raioSol)
  return { tipo: classe, cor, raioSol: +raioSol.toFixed(2), tempK, tamanho }
}

export function quadrantDe(x, y) {
  // x,y em [-1,1] -> qx,qy em 0..9, id 0..99
  const qx = Math.min(GRID_N - 1, Math.max(0, Math.floor(((x + 1) / 2) * GRID_N)))
  const qy = Math.min(GRID_N - 1, Math.max(0, Math.floor(((y + 1) / 2) * GRID_N)))
  return { qx, qy, id: qy * GRID_N + qx }
}

export function gerarGalaxia(seed, shape) {
  const rand = mulberry32(seed)
  const stars = new Array(TOTAL_STARS)
  const contagem = new Array(QUADRANT_COUNT).fill(0)

  for (let i = 0; i < TOTAL_STARS; i++) {
    let { x, y } = gerarPosicao(shape, rand)
    // clamp suave para dentro do mapa
    x = Math.max(-1, Math.min(1, x))
    y = Math.max(-1, Math.min(1, y))
    const q = quadrantDe(x, y)
    const t = tipoEstrela(rand)
    contagem[q.id]++
    stars[i] = { id: i, x, y, qx: q.qx, qy: q.qy, quadrante: q.id, ...t }
  }

  const anomalias = gerarAnomalias(seed, shape)

  return { seed, shape, total: TOTAL_STARS, stars, contagem, anomalias }
}

export function estrelasDoQuadrante(galaxia, qx, qy) {
  const id = qy * GRID_N + qx
  return galaxia.stars.filter((s) => s.quadrante === id)
}

export function anomaliasDoQuadrante(galaxia, qx, qy) {
  if (!galaxia.anomalias) return []
  const id = qy * GRID_N + qx
  return galaxia.anomalias.filter((a) => a.quadrante === id)
}

// ---- Anomalias espaciais ----
// Buraco negro supermassivo fixo no centro + exóticas distribuídas.
// Stream de RNG próprio: não altera o layout das estrelas de saves antigos.
const CORES_NEBULOSA = [
  ['emissão', '#34d399'],
  ['reflexão', '#22d3ee'],
  ['emissão', '#e879f9'],
  ['planetária', '#fb7185'],
]

export const NOME_ANOMALIA = {
  smbh: 'Buraco negro supermassivo',
  'buraco-negro': 'Buraco negro estelar',
  pulsar: 'Pulsar',
  neutron: 'Estrela de nêutrons',
  'ana-branca': 'Anã branca',
  nebulosa: 'Nebulosa',
}

export function gerarAnomalias(seed, shape) {
  const rand = mulberry32((seed ^ 0x9e3779b9) >>> 0)
  const lista = []
  const colocar = (a) => {
    a.x = Math.max(-1, Math.min(1, a.x))
    a.y = Math.max(-1, Math.min(1, a.y))
    const q = quadrantDe(a.x, a.y)
    a.qx = q.qx
    a.qy = q.qy
    a.quadrante = q.id
    lista.push(a)
  }
  const pos = () => {
    const p = gerarPosicao(shape, rand)
    return { x: p.x, y: p.y }
  }

  colocar({
    id: 'NUCLEO',
    kind: 'smbh',
    nome: 'NÚCLEO',
    x: 0,
    y: 0,
    cor: '#fb923c',
    tamanho: 8,
    desc: 'Buraco negro supermassivo · ~4 milhões de massas solares · o coração da galáxia.',
  })

  const nBN = 2 + Math.floor(rand() * 4)
  for (let i = 0; i < nBN; i++)
    colocar({
      id: `BN${i}`,
      kind: 'buraco-negro',
      nome: `BN-${i}`,
      ...pos(),
      cor: '#fb923c',
      tamanho: 5,
      desc: 'Buraco negro estelar · colapso de estrela massiva · disco de acreção incandescente.',
    })

  const nPSR = 6 + Math.floor(rand() * 7)
  for (let i = 0; i < nPSR; i++) {
    const id = `PSR${i}`
    const periodo = +(1.4 + rand() * rand() * 800).toFixed(1)
    colocar({
      id,
      kind: 'pulsar',
      nome: `PSR-${i}`,
      ...pos(),
      cor: '#67e8f9',
      tamanho: 3.5,
      periodo,
      // fase do farol pré-calculada (evita reduce por frame no render)
      fase: [...id].reduce((t, c) => t + c.charCodeAt(0), 0),
      desc: `Pulsar · estrela de nêutrons em rotação · farol de rádio a cada ${periodo}ms.`,
    })
  }

  const nNS = 8 + Math.floor(rand() * 9)
  for (let i = 0; i < nNS; i++)
    colocar({
      id: `NS${i}`,
      kind: 'neutron',
      nome: `NS-${i}`,
      ...pos(),
      cor: '#e8f1ff',
      tamanho: 3,
      desc: 'Estrela de nêutrons · 1.4 massas solares em ~20km · matéria degenerada.',
    })

  const nAN = 30 + Math.floor(rand() * 31)
  for (let i = 0; i < nAN; i++)
    colocar({
      id: `AN${i}`,
      kind: 'ana-branca',
      nome: `AN-${i}`,
      ...pos(),
      cor: '#d4d4d8',
      tamanho: 2.5,
      desc: 'Anã branca · estrela morta · remanescente esfriando lentamente.',
    })

  const nNEB = 5 + Math.floor(rand() * 6)
  for (let i = 0; i < nNEB; i++) {
    const [subtipo, cor] = CORES_NEBULOSA[Math.floor(rand() * CORES_NEBULOSA.length)]
    const manchas = []
    for (let m = 0; m < 4; m++)
      manchas.push({
        dx: (rand() - 0.5) * 1.2,
        dy: (rand() - 0.5) * 1.2,
        r: 0.35 + rand() * 0.4,
        a: 0.1 + rand() * 0.1,
      })
    colocar({
      id: `NEB${i}`,
      kind: 'nebulosa',
      nome: `NEB-${i}`,
      ...pos(),
      cor,
      subtipo,
      raio: 0.06 + rand() * 0.1,
      manchas,
      desc: `Nebulosa de ${subtipo} · berçário estelar de gás e poeira.`,
    })
  }

  return lista
}

export function novaSeed() {
  return Math.floor(Math.random() * 2 ** 31)
}
