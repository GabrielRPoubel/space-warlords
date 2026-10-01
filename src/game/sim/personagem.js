// Personagem do jogador — Space Warlords
// Nome (livre + sugestão), cultura do mapa, idade 18-130 e avatar em 4 partes.
// Efeitos: flavor + retrato + +10 de rep com nações da mesma cultura.

export const PELES = [
  '#ffd9b3', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a21',
]

export const CABELOS = ['curto', 'longo', 'careca', 'coque']
// ordem: cores distintas primeiro, tons da mesma cor depois
export const CORES_CABELO = [
  '#191919', '#f0f0f0', '#e8c547', '#8e2424', '#4b3621',
  '#3d5a80', '#b5651d', '#7a2e2e', '#d9d9d9',
]
export const CABELO_IDOSO = ['#d9d9d9', '#b0b0b0']

export const OLHOS = ['#3b2f2f', '#4a6fa5', '#3fa34d', '#b8860b', '#808080']

export const ROUPAS = ['uniforme', 'casual', 'manto', 'colete', 'jaqueta', 'armadura']
// ordem: branco, preto, marrom, azul, amarelo, verde, vermelho,
// roxo, rosa, cinza — depois tons da mesma cor
export const CORES_ROUPA = [
  '#f0f0f0', '#21252b', '#7a4a2b', '#2563eb', '#eab308', '#16a34a',
  '#dc2626', '#9333ea', '#ec4899', '#9ca3af', '#7f1d1d', '#ea580c',
  '#a16207', '#0d9488', '#1e3a8a', '#65a30d', '#374151',
]

const INI_RESERVA = ['Al', 'Be', 'Ka', 'Mi', 'Ra', 'Se']
const FIM_RESERVA = { m: ['o', 'an', 'el', 'is'], f: ['a', 'ia', 'el', 'is'] }

// Nome pessoal: inicial + terminação própria de pessoa (nunca sufixo de lugar).
export function sugerirNome(cultura, genero = 'M') {
  const ini = cultura?.sil?.ini?.length ? cultura.sil.ini : INI_RESERVA
  const pool = cultura?.nom?.[genero === 'F' ? 'f' : 'm']?.length
    ? cultura.nom[genero === 'F' ? 'f' : 'm']
    : FIM_RESERVA[genero === 'F' ? 'f' : 'm']
  const pick = (a) => a[Math.floor(Math.random() * a.length)]
  const i = pick(ini)
  let f = pick(pool)
  // evita vogal duplicada na junção (Li+ing=Ling, Para+a=Para)
  const vogal = (c) => 'aeiouãõáéíóúâêôAEIOU'.includes(c)
  if (vogal(i.slice(-1)) && vogal(f[0])) f = f.slice(1)
  // evita consoante duplicada (Demir+rem=Demirem)
  else if (i.slice(-1).toLowerCase() === f[0].toLowerCase()) f = f.slice(1)
  const n = i + f
  return n[0].toUpperCase() + n.slice(1)
}

export function faixaEtaria(idade) {
  if (idade < 40) return 'jovem'
  if (idade <= 80) return 'adulto'
  return 'idoso'
}

export function avatarPadrao() {
  return {
    pele: 1,
    cabelo: 0,
    corCabelo: 1,
    olhos: 0,
    roupa: 0,
    corRoupa: 0,
  }
}

export function validarPiloto(p) {
  if (p == null) return null
  if (typeof p !== 'object') return 'piloto inválido'
  if (typeof p.nome !== 'string' || !p.nome.trim() || p.nome.length > 40)
    return 'nome inválido'
  if (!Number.isInteger(p.idade) || p.idade < 18 || p.idade > 130)
    return 'idade inválida'
  if (typeof p.culturaId !== 'number') return 'cultura inválida'
  if (p.genero !== undefined && p.genero !== 'M' && p.genero !== 'F')
    return 'gênero inválido'
  const a = p.avatar
  if (!a || typeof a !== 'object') return 'avatar inválido'
  const checar = (v, arr) => Number.isInteger(v) && v >= 0 && v < arr.length
  if (
    !checar(a.pele, PELES) ||
    !checar(a.cabelo, CABELOS) ||
    !checar(a.corCabelo, CORES_CABELO) ||
    !checar(a.olhos, OLHOS) ||
    !checar(a.roupa, ROUPAS) ||
    !checar(a.corRoupa, CORES_ROUPA)
  )
    return 'avatar inválido'
  return null
}
