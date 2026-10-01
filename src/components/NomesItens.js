// Nomes de exibição dos itens comercializáveis (sem componente: sem warning).
export const NOME_ITEM = {
  H: 'Hidrogênio', He: 'Hélio', H2O: 'Água', Fe: 'Ferro', Si: 'Silício',
  O: 'Oxigênio', Mg: 'Magnésio', Ni: 'Níquel', Al: 'Alumínio', Ca: 'Cálcio',
  S: 'Enxofre', CH4: 'Metano', NH3: 'Amônia', NaCl: 'Sal', K: 'Potássio',
  C: 'Carbono', COMB: 'Combustível', ALI: 'Alimentos', MAN: 'Manufaturados',
}

// 1 unidade de pop = 1 milhão de pessoas
export function fmtPop(v) {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)} tri`
  if (v >= 1000) return `${(v / 1000).toFixed(1)} bi`
  return `${Math.round(v)} M`
}
