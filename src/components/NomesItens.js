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

// sabor de cada item p/ a vitrine do mercado
export const DESCR_ITEM = {
  ALI: 'Base alimentar da população — nenhuma colônia cresce com fome.',
  MAN: 'Bens industrializados que sustentam o padrão de vida dos mundos.',
  COMB: 'Combustível: move fretes, usinas e naves. O sangue da economia.',
  ENE: 'Energia distribuída que mantém as construções em operação.',
  LUX: 'Joias e bens suntuários feitos com metais raros de asteroides.',
  PGM: 'Metais do grupo da platina, extraídos de cinturões metálicos (M).',
  Au: 'Ouro de asteroides M — lastro de tesouro e ostentação.',
  Fe: 'Ferro: estrutura, aço e insumo de manufaturados.',
  Si: 'Silício: eletrônica e insumo industrial.',
  H2O: 'Água: sustenta a hidroponia, a vida e o refino.',
  C: 'Carbono: alimentos sintéticos, combustível e reciclagem de biomassa.',
  O: 'Oxigênio: suporte à vida e processos metalúrgicos.',
  H: 'Hidrogênio: volátil coletado de gigantes gasosos.',
  He: 'Hélio: volátil raro de gigantes gasosos.',
  Mg: 'Magnésio: ligas leves e construção.',
  Ni: 'Níquel: ligas, aço inox e cunhagem.',
  Al: 'Alumínio: casco de naves e estruturas.',
  Ca: 'Cálcio: cimento e fertilizantes.',
  S: 'Enxofre: química industrial e propelentes.',
  CH4: 'Metano: volátil para combustível e orgânicos.',
  NH3: 'Amônia: fertilizantes e orgânicos sintéticos.',
  NaCl: 'Sal: conservação de alimentos e química.',
  K: 'Potássio: fertilizantes e agricultura.',
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
