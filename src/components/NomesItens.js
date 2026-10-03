// Nomes de exibição dos itens comercializáveis (sem componente: sem warning).
export const NOME_ITEM = {
  H: 'Hidrogênio', He: 'Hélio', H2O: 'Água', Fe: 'Ferro', Si: 'Silício',
  O: 'Oxigênio', Mg: 'Magnésio', Ni: 'Níquel', Al: 'Alumínio', Ca: 'Cálcio',
  S: 'Enxofre', CH4: 'Metano', NH3: 'Amônia', NaCl: 'Sal', K: 'Potássio',
  C: 'Carbono', COMB: 'Combustível', ALI: 'Alimentos', MAN: 'Manufaturados',
  ENE: 'Energia', PGM: 'Platinoides', Au: 'Ouro', LUX: 'Bens de luxo',
}

// índices de riqueza (planetas) — a comida manda: sem comida, jamais
// passa de pobre/miserável por mais luxo que haja
export const NOME_RIQUEZA = {
  miseravel: '● miserável',
  pobre: '● pobre',
  estavel: '● estável',
  rico: '◈ rico',
  abundante: '★ abundante',
}
export const CLASSE_RIQUEZA = {
  miseravel: 'hab-no',
  pobre: 'hab-no',
  estavel: 'warn',
  rico: 'ok',
  abundante: 'hab-ok',
}

// tipos de colônia: selo + nome de exibição
export const SIMBOLO_COLONIA = { exploracao: '⛏', fortaleza: '◆', civil: '●' }
export const NOME_COLONIA = { exploracao: 'EXPLORAÇÃO', fortaleza: 'FORTALEZA', civil: 'CIVIL' }

// 1 unidade de pop = 1 milhão de pessoas
export function fmtPop(v) {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)} tri`
  if (v >= 1000) return `${(v / 1000).toFixed(1)} bi`
  return `${Math.round(v)} M`
}
