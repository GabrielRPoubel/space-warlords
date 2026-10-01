// Culturas procedurais — Space Warlords
// 28 povos × 3 culturas = 84, geradas por fonemas de cada povo.
// Stream próprio: determinístico por seed. Nomes únicos na galáxia.
import { mulberry32 } from './galaxy.js'

// [povo, sílabas iniciais, sílabas médias (lugares), terminações pessoais {m, f}]
const POVOS = [
  ['romano', ['Val', 'Mor', 'Drak', 'Aqu', 'Bel', 'Cas', 'Dor', 'Fab'], ['ia', 'us', 'ana', 'or'], { m: ['us', 'ius', 'o', 'ian'], f: ['ia', 'ina', 'a', 'ella'] }],
  ['persa', ['Dar', 'Xer', 'Cyr', 'Par', 'Art', 'Bah', 'Ros', 'Mit'], ['es', 'ia', 'an', 'dar'], { m: ['ius', 'eh', 'ash', 'am'], f: ['a', 'ana', 'ita', 'ar'] }],
  ['assírio', ['Ash', 'Nin', 'Shar', 'Bel', 'Tuk', 'Eri', 'Kal', 'Zab'], ['ur', 'il', 'ak', 'at'], { m: ['ur', 'gon', 'ti', 'il'], f: ['am', 'ia', 'tar', 'tu'] }],
  ['otomano', ['Meh', 'Sul', 'Osm', 'Bay', 'Mur', 'Sel', 'Ibr', 'Or'], ['et', 'an', 'ek', 'uda'], { m: ['et', 'man', 'im', 'em'], f: ['em', 'am', 'mah', 'e'] }],
  ['japonês', ['Aka', 'Hana', 'Kawa', 'Mori', 'Sora', 'Taka', 'Yama', 'Ren'], ['shi', 'ro', 'ko', 'mi'], { m: ['ji', 'shi', 'to', 'ro'], f: ['mi', 'ki', 'ra', 'ko'] }],
  ['chinês', ['Chen', 'Li', 'Wei', 'Zhang', 'Ming', 'Tao', 'Jin', 'Han'], ['long', 'feng', 'shan', 'guo'], { m: ['ei', 'en', 'ao', 'in'], f: ['an', 'ei', 'ing', 'i'] }],
  ['coreano', ['Kim', 'Han', 'Park', 'Seo', 'Min', 'Jae', 'Tae', 'Yun'], ['guk', 'san', 'ho', 'ra'], { m: ['jun', 'hyun', 'min', 'ho'], f: ['eon', 'oo', 'na', 'yeon'] }],
  ['congolês', ['Kaba', 'Luba', 'Mbu', 'Nza', 'Tumba', 'Kasa', 'Boma', 'Lual'], ['la', 'ba', 'ka', 'ndi'], { m: ['go', 'yi', 'ni', 'ba'], f: ['sa', 'ji', 'ni', 'la'] }],
  ['brasileiro', ['Tupa', 'Iara', 'Para', 'Sabi', 'Ara', 'Mani', 'Jure', 'Pit'], ['na', 'ra', 'ma', 'ba'], { m: ['ra', 'a', 'aj', 'i'], f: ['ra', 'ema', 'ci', 'ana'] }],
  ['argentino', ['Pam', 'Gau', 'Plat', 'And', 'Tan', 'Roj', 'Mend', 'Cor'], ['ero', 'ino', 'ada', 'eso'], { m: ['eo', 'ago', 'go', 'el'], f: ['tina', 'cia', 'ela', 'ina'] }],
  ['mexicano', ['Az', 'May', 'Zap', 'Tol', 'Mex', 'Yuc', 'Nava', 'Tula'], ['teca', 'lan', 'pan', 'cal'], { m: ['go', 'lio', 'auh', 'el'], f: ['na', 'el', 'da', 'ia'] }],
  ['americano', ['Lib', 'Wash', 'Frank', 'Jeff', 'Col', 'Ken', 'Tex', 'Dak'], ['ton', 'ville', 'burg', 'dale'], { m: ['ack', 'att', 'son', 'en'], f: ['lia', 'per', 'lyn', 'ia'] }],
  ['inglês', ['Bri', 'Lond', 'Kent', 'York', 'Thorn', 'Ash', 'Stan', 'Mer'], ['ford', 'ham', 'ton', 'bury'], { m: ['ur', 'ry', 'ard', 'in'], f: ['nor', 'ice', 'se', 'ia'] }],
  ['sueco', ['Sve', 'Norr', 'Berg', 'Lund', 'Dahl', 'Sten', 'Bjor', 'Vik'], ['holm', 'stad', 'berg', 'mark'], { m: ['sten', 'son', 'en', 'ar'], f: ['rid', 'eya', 'grid', 'hild'] }],
  ['alemão', ['Ber', 'Ham', 'Fried', 'Wil', 'Karl', 'Stein', 'Brand', 'Wolf'], ['burg', 'dorf', 'heim', 'stadt'], { m: ['rich', 'tto', 'aus', 'lf'], f: ['ta', 'na', 'da', 'e'] }],
  ['russo', ['Mos', 'Nov', 'Vlad', 'Petro', 'Kaz', 'Smol', 'Tver', 'Rus'], ['grad', 'sk', 'ov', 'in'], { m: ['van', 'tri', 'gei', 'eg'], f: ['sha', 'ga', 'ya', 'a'] }],
  ['francês', ['Bel', 'Clair', 'Mont', 'Val', 'Bour', 'Champ', 'Lou', 'Mar'], ['eaux', 'ville', 'mont', 'gne'], { m: ['go', 'uis', 'my', 'el'], f: ['ille', 'oe', 'non', 'elle'] }],
  ['espanhol', ['Mad', 'Barc', 'Sev', 'Gran', 'Cor', 'Sant', 'Zar', 'Al'], ['ona', 'illa', 'ada', 'edo'], { m: ['blo', 'ego', 'rco', 'an'], f: ['men', 'fia', 'cia', 'ia'] }],
  ['grego', ['Ath', 'Spar', 'Cor', 'Del', 'The', 'Myk', 'Oly', 'Aeg'], ['os', 'ia', 'on', 'ae'], { m: ['kos', 'lex', 'tas', 'os'], f: ['ni', 'hne', 'lia', 'a'] }],
  ['turco', ['Ana', 'Kara', 'Deniz', 'Efe', 'Bar', 'Ay', 'Demir', 'Kaya'], ['lar', 'stan', 'li', 'cek'], { m: ['re', 'rem', 'rt', 'an'], f: ['lif', 'nep', 'lin', 'e'] }],
  ['israelense', ['Yeru', 'Tel', 'Haif', 'Beer', 'Galil', 'Negev', 'Akko', 'Jaff'], ['im', 'ya', 'el', 'ot'], { m: ['am', 'tan', 'ni', 'el'], f: ['el', 'hal', 'lia', 'a'] }],
  ['egípcio', ['Khe', 'Nil', 'Theb', 'Mem', 'Lux', 'Asw', 'Giz', 'Sok'], ['et', 'is', 'amon', 'ra'], { m: ['mun', 'af', 'am', 'es'], f: ['fer', 'rit', 'khes', 'a'] }],
  ['indiano', ['Bha', 'Raj', 'Del', 'Mum', 'Gan', 'Krish', 'Taj', 'Var'], ['pur', 'abad', 'garh', 'stan'], { m: ['jun', 'kram', 'jan', 'esh'], f: ['ya', 'ra', 'vya', 'ita'] }],
  ['indonésio', ['Jav', 'Sum', 'Bal', 'Bor', 'Sul', 'Mal', 'Pap', 'Ban'], ['arta', 'esi', 'aya', 'ung'], { m: ['gus', 'di', 'ya', 'an'], f: ['wi', 'ri', 'tri', 'a'] }],
  ['tailandês', ['Siam', 'Bang', 'Chao', 'Sukh', 'Ayut', 'Krab', 'Surat', 'Nakh'], ['buri', 'thani', 'rat', 'kok'], { m: ['chai', 'ran', 'lek', 'ak'], f: ['li', 'ara', 'ri', 'wan'] }],
  ['iraniano', ['Teh', 'Esf', 'Shir', 'Mash', 'Qom', 'Kar', 'Yazd', 'Ar'], ['ran', 'abad', 'an', 'esh'], { m: ['an', 'man', 'bak', 'ush'], f: ['rin', 'rya', 'lou', 'a'] }],
  ['libanês', ['Bei', 'Tyr', 'Sid', 'Byb', 'Baal', 'Ced', 'Zah', 'Jun'], ['rut', 'on', 'ek', 'iye'], { m: ['rim', 'ad', 'ias', 'im'], f: ['yla', 'our', 'na', 'ia'] }],
  ['saudita', ['Riy', 'Jed', 'Mek', 'Med', 'Najd', 'Hij', 'Taif', 'Damm'], ['ah', 'iya', 'an', 'oud'], { m: ['sal', 'lid', 'tan', 'ad'], f: ['ra', 'eem', 'ma', 'ia'] }],
]

export const REGIOES = [
  'Europa',
  'Oriente Médio',
  'África',
  'Ásia',
  'América Latina',
  'América do Norte',
]

// ancestralidade de cada povo p/ garantir cobertura regional na geração
export const REGIAO_POR_POVO = {
  romano: 'Europa', grego: 'Europa', inglês: 'Europa', francês: 'Europa',
  espanhol: 'Europa', alemão: 'Europa', sueco: 'Europa', russo: 'Europa',
  persa: 'Oriente Médio', assírio: 'Oriente Médio', otomano: 'Oriente Médio',
  turco: 'Oriente Médio', israelense: 'Oriente Médio', libanês: 'Oriente Médio',
  saudita: 'Oriente Médio', iraniano: 'Oriente Médio',
  'congolês': 'África', 'egípcio': 'África',
  'japonês': 'Ásia', 'chinês': 'Ásia', coreano: 'Ásia', indiano: 'Ásia',
  'indonésio': 'Ásia', 'tailandês': 'Ásia',
  brasileiro: 'América Latina', argentino: 'América Latina', mexicano: 'América Latina',
  americano: 'América do Norte',
}

function embaralhar(arr, rand) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const SUFIXOS = ['ia', 'ar', 'on']

// banco de nomes prontos por povo e gênero p/ recomendar na criação
export const NOMES_BANCO = {
  romano: { m: ['Valerius', 'Cassius', 'Marcellus'], f: ['Drusilla', 'Livia', 'Octavia'] },
  persa: { m: ['Darius', 'Kaveh', 'Arash'], f: ['Roxana', 'Mandana', 'Anahita'] },
  assírio: { m: ['Ashur', 'Tukulti', 'Sargon'], f: ['Shamiram', 'Naqia', 'Ishtar'] },
  otomano: { m: ['Mehmet', 'Suleyman', 'Ibrahim'], f: ['Hurrem', 'Kosem', 'Mihrimah'] },
  japonês: { m: ['Renji', 'Takeshi', 'Haruto'], f: ['Akemi', 'Yuki', 'Sakura'] },
  chinês: { m: ['Wei', 'Chen', 'Tao'], f: ['Lan', 'Mei', 'Jing'] },
  coreano: { m: ['Minjun', 'Taehyun', 'Donghyun'], f: ['Seoyeon', 'Jisoo', 'Hana'] },
  congolês: { m: ['Kabongo', 'Mbuyi', 'Tumaini'], f: ['Lukasa', 'Nzuji', 'Amani'] },
  brasileiro: { m: ['Ubira', 'Cauã', 'Tupã'], f: ['Iara', 'Moema', 'Araci'] },
  argentino: { m: ['Mateo', 'Santiago', 'Thiago'], f: ['Valentina', 'Lucia', 'Martina'] },
  mexicano: { m: ['Diego', 'Emilio', 'Cuauh'], f: ['Ximena', 'Itzel', 'Frida'] },
  americano: { m: ['Jack', 'Wyatt', 'Mason'], f: ['Amelia', 'Harper', 'Evelyn'] },
  inglês: { m: ['Arthur', 'Henry', 'Edward'], f: ['Eleanor', 'Alice', 'Rose'] },
  sueco: { m: ['Bjorn', 'Lars', 'Sven'], f: ['Astrid', 'Freya', 'Ingrid'] },
  alemão: { m: ['Friedrich', 'Otto', 'Klaus'], f: ['Greta', 'Lena', 'Ada'] },
  russo: { m: ['Ivan', 'Dmitri', 'Sergei'], f: ['Natasha', 'Olga', 'Anya'] },
  francês: { m: ['Hugo', 'Louis', 'Remy'], f: ['Camille', 'Chloe', 'Manon'] },
  espanhol: { m: ['Pablo', 'Diego', 'Marco'], f: ['Carmen', 'Sofia', 'Lucia'] },
  grego: { m: ['Nikos', 'Alex', 'Kostas'], f: ['Eleni', 'Daphne', 'Thalia'] },
  turco: { m: ['Emre', 'Kerem', 'Mert'], f: ['Elif', 'Zeynep', 'Aylin'] },
  israelense: { m: ['Noam', 'Eitan', 'Yoni'], f: ['Yael', 'Michal', 'Talia'] },
  egípcio: { m: ['Amun', 'Khaf', 'Ram'], f: ['Nefer', 'Merit', 'Ankhes'] },
  indiano: { m: ['Arjun', 'Vikram', 'Rajan'], f: ['Priya', 'Meera', 'Divya'] },
  indonésio: { m: ['Agus', 'Budi', 'Jaya'], f: ['Dewi', 'Sari', 'Putri'] },
  tailandês: { m: ['Somchai', 'Niran', 'Lek'], f: ['Mali', 'Achara', 'Siri'] },
  iraniano: { m: ['Kian', 'Arman', 'Babak'], f: ['Shirin', 'Darya', 'Nilou'] },
  libanês: { m: ['Karim', 'Jad', 'Elias'], f: ['Layla', 'Nour', 'Rana'] },
  saudita: { m: ['Faisal', 'Khalid', 'Sultan'], f: ['Nora', 'Reem', 'Lama'] },
}

export function gerarCulturas(seed) {
  const rand = mulberry32((seed ^ 0xc017ab) >>> 0)
  const culturas = []
  const nomes = new Set()
  let id = 0
  for (const [povo, ini, meio, nom] of POVOS) {
    for (let k = 0; k < 3; k++) {
      // nome = sílaba + sufixo do slot (sem empilhar o meio junto)
      let nome = ini[Math.floor(rand() * ini.length)] + SUFIXOS[k]
      nome = nome[0].toUpperCase() + nome.slice(1)
      let t = 0
      while (nomes.has(nome) && t++ < 20)
        nome = `${nome.split(' ')[0]}${t + 1}`
      nomes.add(nome)
      // subconjunto embaralhado de sílabas: cada cultura soa diferente
      const poolIni = embaralhar(ini, rand).slice(0, 6)
      const poolMeio = embaralhar(meio, rand).slice(0, 3)
      const poolNomM = embaralhar(nom.m, rand).slice(0, 3)
      const poolNomF = embaralhar(nom.f, rand).slice(0, 3)
      culturas.push({ id: id++, povo, nome, regiao: REGIAO_POR_POVO[povo], sil: { ini: poolIni, meio: poolMeio }, nom: { m: poolNomM, f: poolNomF } })
    }
  }
  return culturas
}
