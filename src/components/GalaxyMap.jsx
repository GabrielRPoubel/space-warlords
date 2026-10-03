import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  GRID_N,
  SHAPES,
  gerarGalaxia,
  mulberry32,
  novaSeed,
  quadrantDe,
} from '../game/sim/galaxy.js'
import { gerarSistema } from '../game/sim/system.js'
import { evoluirEconomia, prepararEco } from '../game/sim/economia.js'
import {
  gerarNacoes,
  TITULO,
  inicialDin,
  aplicarDinamica,
  evoluirNacoes,
  pontoEmPoligono,
} from '../game/sim/nations.js'
import { NOME_ANOMALIA } from '../game/sim/galaxy.js'
import {
  viewportMundo,
  desenharEspaco,
  desenharMinimapa,
} from '../game/render/galaxyCanvas.js'
import SystemMap from './SystemMap.jsx'
import CriacaoPersonagem from './CriacaoPersonagem.jsx'
import Faccoes from './Faccoes.jsx'
import EconomiaNacao from './EconomiaNacao.jsx'
import ComercioGalaxia from './ComercioGalaxia.jsx'
import DevPanel from './DevPanel.jsx'
import {
  IconePersonagem,
  IconeFrota,
  IconeComercio,
  IconeNavegacao,
  IconeComunicacoes,
  IconeNave,
} from './Icones.jsx'

const ICONES_MENU = {
  personagem: <IconePersonagem />,
  frota: <IconeFrota />,
  comercio: <IconeComercio />,
  navegacao: <IconeNavegacao />,
  comunicacoes: <IconeComunicacoes />,
  nave: <IconeNave />,
}
import { gerarCulturas } from '../game/sim/cultures.js'
import { validarPiloto, faixaEtaria } from '../game/sim/personagem.js'

const ZOOM_INICIAL = 4
const ZOOM_MIN = 0.08 // zoom total: galáxia inteira visível
const ZOOM_MAX = 14
const ZOOM_SUAV = 7
const ACCEL = 0.42
const MAXV = 0.12
const ATRITO = 3.0

function centroQuadrante(qx, qy) {
  const x0 = (qx / GRID_N) * 2 - 1
  const x1 = ((qx + 1) / GRID_N) * 2 - 1
  const y0 = (qy / GRID_N) * 2 - 1
  const y1 = ((qy + 1) / GRID_N) * 2 - 1
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }
}

// calendário da campanha: tick 0 = 12 out 5012, 1 tick = 1 dia
const MESES = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

export function dataDoTick(tick) {
  let d = 12
  let m = 9
  let a = 5012
  let rest = Math.max(0, tick)
  const bissexto = (x) => x % 4 === 0 && (x % 100 !== 0 || x % 400 === 0)
  const dim = (mm, aa) =>
    [31, bissexto(aa) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mm]
  while (rest > 0) {
    const sobra = dim(m, a) - d
    if (rest <= sobra) {
      d += rest
      rest = 0
    } else {
      rest -= sobra + 1
      d = 1
      m++
      if (m > 11) {
        m = 0
        a++
      }
    }
  }
  return `${String(d).padStart(2, '0')} ${MESES[m]} ${a}`
}

export default function GalaxyMap() {
  const [save, setSave] = useState(null)
  const [tela, setTela] = useState('titulo')
  const [tmpSeed, setTmpSeed] = useState(() => novaSeed())
  const [tmpShape, setTmpShape] = useState('espiral')

  const seed = save?.seed ?? tmpSeed
  const shape = save?.shape ?? tmpShape
  const [qx, setQx] = useState(() => save?.qx ?? 5)
  const [qy, setQy] = useState(() => save?.qy ?? 5)
  const [cam, setCam] = useState(() => {
    if (save?.camX !== undefined) return { x: save.camX, y: save.camY }
    return centroQuadrante(save?.qx ?? 5, save?.qy ?? 5)
  })
  const [, setVel] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(() => save?.zoom ?? ZOOM_INICIAL)
  const [selId, setSelId] = useState(null)
  const [selAnom, setSelAnom] = useState(null)
  const [piloto, setPiloto] = useState(null)
  const [criacao, setCriacao] = useState(null)
  const [selNacao, setSelNacao] = useState(null)
  const [abaNacao, setAbaNacao] = useState('economia')
  const [menuJogador, setMenuJogador] = useState(null)
  const [verDev, setVerDev] = useState(false)
  const [devMode, setDevMode] = useState(() => {
    try {
      return localStorage.getItem('sw-dev') === '1'
    } catch {
      return false
    }
  })
  const alternarDev = () => {
    setDevMode((v) => {
      try {
        localStorage.setItem('sw-dev', v ? '0' : '1')
      } catch {
        /* sem storage */
      }
      return !v
    })
  }
  const [pausado, setPausado] = useState(false)
  const pausadoRef = useRef(false)
  pausadoRef.current = pausado
  const [verFaccoes, setVerFaccoes] = useState(false)
  const [sistema, setSistema] = useState(null)

  const mainRef = useRef(null)
  const miniRef = useRef(null)
  const fileRef = useRef(null)
  const [erroArquivo, setErroArquivo] = useState(null)
  const camRef = useRef(cam)
  camRef.current = cam
  const velRef = useRef({ x: 0, y: 0 })
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const zoomAlvo = useRef(zoom)
  const qRef = useRef({ qx, qy })
  qRef.current = { qx, qy }
  const teclas = useRef(new Set())
  const sistemaRef = useRef(null)
  sistemaRef.current = sistema
  const selRef = useRef(null)
  selRef.current = selId
  const selAnomRef = useRef(null)
  selAnomRef.current = selAnom
  const selNacaoRef = useRef(null)
  selNacaoRef.current = selNacao
  const faccoesRef = useRef(false)
  faccoesRef.current = verFaccoes
  const menuJogadorRef = useRef(null)
  menuJogadorRef.current = menuJogador
  const verDevRef = useRef(false)
  verDevRef.current = verDev
  const dipRef = useRef(null)

  const galaxia = useMemo(() => gerarGalaxia(seed, shape), [seed, shape])
  const base = useMemo(() => gerarNacoes(seed, galaxia.stars), [seed, galaxia])
  const culturasMapa = useMemo(() => gerarCulturas(seed), [seed])
  const [din, setDin] = useState(() =>
    save?.dinNacoes?.v === 2 ? save.dinNacoes : inicialDin(base),
  )
  const [intro, setIntro] = useState(null)
  const galRef = useRef(galaxia)
  galRef.current = galaxia

  const dip = useMemo(() => {
    const d = aplicarDinamica(base, galaxia.stars, din)
    const cap = {}
    d.nacoes.forEach((na) => {
      cap[na.capital] = na
    })
    return { ...d, cap }
  }, [base, galaxia, din])
  dipRef.current = dip

  const estrelaSel =
    selId != null ? galaxia.stars.find((s) => s.id === selId) : null
  const sistemaPrev = useMemo(
    () => (estrelaSel ? gerarSistema(seed, estrelaSel) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed, selId],
  )

  const introPrev = useMemo(() => {
    if (!intro) return null
    const g = gerarGalaxia(intro.seed, intro.shape)
    const b = gerarNacoes(intro.seed, g.stars)
    return { host: b.nacoes.find((na) => na.id === intro.hostId) }
  }, [intro])

  const aplicarZoom = useCallback((fator) => {
    zoomAlvo.current = Math.min(
      ZOOM_MAX,
      Math.max(ZOOM_MIN, zoomAlvo.current * fator),
    )
  }, [])

  const voltarGalaxia = useCallback(() => {
    const e = sistemaRef.current?.estrela
    if (e) {
      const q = quadrantDe(e.x, e.y)
      setQx(q.qx)
      setQy(q.qy)
      camRef.current = { x: e.x, y: e.y }
      setCam({ x: e.x, y: e.y })
      velRef.current = { x: 0, y: 0 }
      setVel({ x: 0, y: 0 })
    }
    setSistema(null)
  }, [])

  // restaura sistema aberto (reload com sistema no save)
  useEffect(() => {
    if (save?.sistemaId != null && !sistemaRef.current) {
      const e = galaxia.stars.find((s) => s.id === save.sistemaId)
      if (e) setSistema({ estrela: e, dados: gerarSistema(seed, e) })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save, galaxia])

  useEffect(() => {
    const ajustar = () => {
      if (mainRef.current) {
        mainRef.current.width = window.innerWidth
        mainRef.current.height = window.innerHeight
      }
    }
    ajustar()
    window.addEventListener('resize', ajustar)
    return () => window.removeEventListener('resize', ajustar)
  }, [!!save, !!sistema])

  useEffect(() => {
    if (!save) return
    const canvas = mainRef.current
    if (!canvas) return
    const fn = (e) => {
      e.preventDefault()
      aplicarZoom(Math.exp(-e.deltaY * 0.0015))
    }
    canvas.addEventListener('wheel', fn, { passive: false })
    return () => canvas.removeEventListener('wheel', fn)
  }, [save, aplicarZoom, sistema])

  useEffect(() => {
    if (!save) return
    let raf = 0
    let ultimo = performance.now()
    let frame = 0
    const passo = (agora) => {
      try {
        const dt = Math.min(0.05, (agora - ultimo) / 1000)
        ultimo = agora
      if (!sistemaRef.current) {
        frame++

        const zt = zoomAlvo.current
        let zc = zoomRef.current
        // interpolação em log: suave de 0.1x a 14x
        if (Math.abs(Math.log(zt / zc)) > 0.002) {
          zc = Math.exp(
            Math.log(zc) +
              (Math.log(zt) - Math.log(zc)) * (1 - Math.exp(-ZOOM_SUAV * dt)),
          )
          if (Math.abs(Math.log(zt / zc)) <= 0.002) zc = zt
          zoomRef.current = zc
        }

        const t = teclas.current
        let ix = 0
        let iy = 0
        if (t.has('w') || t.has('arrowup')) iy -= 1
        if (t.has('s') || t.has('arrowdown')) iy += 1
        if (t.has('a') || t.has('arrowleft')) ix -= 1
        if (t.has('d') || t.has('arrowright')) ix += 1
        if (ix !== 0 && iy !== 0) {
          ix /= Math.SQRT2
          iy /= Math.SQRT2
        }

        // velocidade acompanha o zoom: de longe o voo é proporcionalmente rápido
        const fV = Math.min(12, Math.max(1, 4 / zc))
        const acc = ACCEL * fV
        const max = MAXV * fV
        let v = { ...velRef.current }
        v.x += ix * acc * dt
        v.y += iy * acc * dt
        const damp = Math.exp(-ATRITO * dt)
        v.x *= damp
        v.y *= damp
        const sp = Math.hypot(v.x, v.y)
        if (sp > max) {
          v.x = (v.x / sp) * max
          v.y = (v.y / sp) * max
        }
        if (ix === 0 && iy === 0 && sp < 0.002) {
          v.x = 0
          v.y = 0
        }

        const canvas = mainRef.current
        const { vw, vh } = viewportMundo(canvas, zc)
      let nx = camRef.current.x + v.x * dt
      let ny = camRef.current.y + v.y * dt
      // zoom total: viewport maior que a galáxia → centraliza
      nx = vw >= 2 ? 0 : Math.min(1 - vw / 2, Math.max(-1 + vw / 2, nx))
      ny = vh >= 2 ? 0 : Math.min(1 - vh / 2, Math.max(-1 + vh / 2, ny))
        if (nx !== camRef.current.x + v.x * dt) v.x = 0
        if (ny !== camRef.current.y + v.y * dt) v.y = 0

      velRef.current = v
      camRef.current = { x: nx, y: ny }
        if (frame % 6 === 0) {
          setCam(camRef.current)
          setVel({ ...v })
          setZoom(zc)
          const q = quadrantDe(nx, ny)
          if (q.qx !== qRef.current.qx || q.qy !== qRef.current.qy) {
            setQx(q.qx)
            setQy(q.qy)
          }
        }

        if (canvas) {
          const qc = quadrantDe(nx, ny)
          desenharEspaco(
            canvas,
            galRef.current.stars,
            camRef.current,
            qc.qx,
            qc.qy,
            zc,
            agora,
            galRef.current.anomalias || [],
            dipRef.current,
            ZOOM_MIN,
          )
        }
      }
      } catch (err) {
        // nunca deixa o loop morrer em silêncio: loga e segue no próx. frame
        console.error('[space-warlords] frame pulado:', err)
      }
      raf = requestAnimationFrame(passo)
    }
    raf = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(raf)
  }, [save, galaxia])

  useEffect(() => {
    if (!save || !miniRef.current || sistema) return
    const main = mainRef.current
    const aspect = main && main.width > 0 ? main.height / main.width : 9 / 16
    desenharMinimapa(miniRef.current, galaxia, qx, qy, cam, zoom, aspect, dip.nacoes)
  }, [save, galaxia, qx, qy, cam, zoom, sistema, dip])

  // ficha da nação acompanha a evolução (tick atualiza o objeto)
  useEffect(() => {
    if (selNacao) {
      const viva = dip.nacoes.find((n) => n.id === selNacao.id)
      if (viva && viva !== selNacao) setSelNacao(viva)
    }
  }, [dip, selNacao])

  // tick = 1 dia de simulação, a cada 5s reais (pausável)
  useEffect(() => {
    if (!save) return
    const id = setInterval(() => {
      if (pausadoRef.current) return
      setDin((prev) => {
        const d1 = evoluirNacoes(seed, galaxia.stars, base, prev)
        return evoluirEconomia(seed, base, galaxia.stars, d1)
      })
    }, 5000)
    return () => clearInterval(id)
  }, [save, seed, galaxia, base])

  // (sem autosave: a campanha vive em arquivo, via Salvar/Carregar)

  useEffect(() => {
    if (!save) return
    const down = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase()
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return
      const k = e.key.toLowerCase()
      if (sistemaRef.current) return // SystemMap cuida do Esc
      // Esc fecha confirmação/ficha; o resto (WASD/zoom) continua livre
      if (
        k === 'escape' &&
        (selRef.current != null ||
          selAnomRef.current != null ||
          selNacaoRef.current != null ||
          faccoesRef.current ||
          menuJogadorRef.current != null ||
          verDevRef.current)
      ) {
        e.preventDefault()
        setSelId(null)
        setSelAnom(null)
        setSelNacao(null)
        setVerFaccoes(false)
        setMenuJogador(null)
        setVerDev(false)
        return
      }
      if (
        ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)
      ) {
        e.preventDefault()
        teclas.current.add(k)
        return
      }
      if (k === '+' || k === '=' || k === 'add') {
        e.preventDefault()
        aplicarZoom(1.15)
      } else if (k === '-' || k === '_' || k === 'subtract') {
        e.preventDefault()
        aplicarZoom(1 / 1.15)
      }
    }
    const up = (e) => teclas.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [save, aplicarZoom])

  const irParaQuadrante = useCallback((nx, ny) => {
    setQx(nx)
    setQy(ny)
    const c = centroQuadrante(nx, ny)
    camRef.current = c
    velRef.current = { x: 0, y: 0 }
    setVel({ x: 0, y: 0 })
    setCam(c)
  }, [])

  const clicarMinimapa = (e) => {
    const rect = miniRef.current.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * GRID_N
    const py = ((e.clientY - rect.top) / rect.height) * GRID_N
    irParaQuadrante(
      Math.min(GRID_N - 1, Math.max(0, Math.floor(px))),
      Math.min(GRID_N - 1, Math.max(0, Math.floor(py))),
    )
  }

  // clique: estrela → confirmação · anomalia → ficha (tolerância de 26px)
  const clicarEstrela = (e) => {
    const canvas = mainRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const z = zoomRef.current
    const { vw, vh } = viewportMundo(canvas, z)
    const c = camRef.current
    const wx = c.x - vw / 2 + ((e.clientX - rect.left) / rect.width) * vw
    const wy = c.y - vh / 2 + ((e.clientY - rect.top) / rect.height) * vh
    const tolX = (26 / rect.width) * vw
    const tolY = (26 / rect.height) * vh
    let melhor = null
    let melhorD = Infinity
    for (const s of galRef.current.stars) {
      const d = Math.hypot((s.x - wx) / tolX, (s.y - wy) / tolY)
      if (d < 1 && d < melhorD) {
        melhorD = d
        melhor = s
      }
    }
    let anom = null
    let anomD = Infinity
    for (const a of galRef.current.anomalias || []) {
      let d
      if (a.kind === 'nebulosa') {
        d = Math.hypot(a.x - wx, a.y - wy) / a.raio
      } else {
        d = Math.hypot((a.x - wx) / tolX, (a.y - wy) / tolY)
      }
      if (d < 1 && d < anomD) {
        anomD = d
        anom = a
      }
    }
    // prioriza o mais próximo do clique
    if (anom && (!melhor || anomD <= melhorD)) {
      setSelId(null)
      setSelNacao(null)
      setSelAnom(anom)
    } else if (melhor) {
      setSelAnom(null)
      // capital → ficha da nação; comum → entrada no sistema
      if (dipRef.current.cap[melhor.id]) {
        setSelId(null)
        setSelNacao(dipRef.current.cap[melhor.id])
        setAbaNacao('economia')
      } else {
        setSelNacao(null)
        setSelId(melhor.id)
      }
    } else {
      setSelAnom(null)
      setSelNacao(null)
      setSelId(null)
    }
  }

  const entrarSistema = () => {
    if (!estrelaSel || !sistemaPrev) return
    setSistema({ estrela: estrelaSel, dados: sistemaPrev })
    setSelId(null)
  }

  const entrarNaCapital = () => {
    if (!selNacao) return
    const e = galaxia.stars[selNacao.capital]
    if (!e) return
    setSistema({ estrela: e, dados: gerarSistema(seed, e) })
    setSelNacao(null)
  }

  const iniciar = () => {
    // escolhe a nação de origem (não-pirata) e abre a criação de piloto
    const g = gerarGalaxia(tmpSeed, tmpShape)
    const b = gerarNacoes(tmpSeed, g.stars)
    const r = mulberry32((tmpSeed ^ 0x1f3a) >>> 0)
    const candidatas = b.nacoes.filter((na) => na.tipo !== 'pirata')
    const host = candidatas[Math.floor(r() * candidatas.length)]
    const vistas = new Map()
    for (const na of b.nacoes)
      if (!vistas.has(na.cultura.id)) vistas.set(na.cultura.id, na.cultura)
    setCriacao({
      seed: tmpSeed,
      shape: tmpShape,
      hostId: host.id,
      culturas: [...vistas.values()],
    })
    setTela('criacao')
  }

  const confirmarCriacao = (p) => {
    if (!criacao) return
    setIntro({ ...criacao, piloto: p })
  }

  const confirmarComeco = () => {
    if (!intro) return
    const g = gerarGalaxia(intro.seed, intro.shape)
    const b = gerarNacoes(intro.seed, g.stars)
    const host = b.nacoes.find((na) => na.id === intro.hostId)
    const cap = g.stars[host.capital]
    const q = quadrantDe(cap.x, cap.y)
    const d0 = inicialDin(b)
    d0.rep[host.id] = 8
    // mesma cultura do piloto: +10 (acumula com o abrigo)
    if (intro.piloto) {
      for (const na of b.nacoes) {
        if (na.cultura.id === intro.piloto.culturaId) {
          d0.rep[na.id] = (d0.rep[na.id] || 0) + 10
        }
      }
    }
    const novo = {
      seed: intro.seed,
      shape: intro.shape,
      qx: q.qx,
      qy: q.qy,
      origem: host.id,
    }
    setQx(q.qx)
    setQy(q.qy)
    camRef.current = { x: cap.x, y: cap.y }
    velRef.current = { x: 0, y: 0 }
    setVel({ x: 0, y: 0 })
    zoomRef.current = ZOOM_INICIAL
    zoomAlvo.current = ZOOM_INICIAL
    setZoom(ZOOM_INICIAL)
    setCam({ x: cap.x, y: cap.y })
    // economia já nasce desenvolvida (60 ticks virtuais, territórios intactos)
    setDin(prepararEco(intro.seed, b, g.stars, d0, 60))
    setIntro(null)
    setCriacao(null)
    setPiloto(intro.piloto || null)
    setSave(novo)
    setTela('jogo')
  }

  const validarSave = (s) => {
    if (!s || typeof s !== 'object') return 'arquivo vazio ou ilegível'
    if (s.jogo !== 'space-warlords') return 'não é um save de Space Warlords'
    if (typeof s.seed !== 'number' || !SHAPES.includes(s.shape))
      return 'galáxia inválida'
    if (
      ![s.qx, s.qy].every(
        (v) => Number.isInteger(v) && v >= 0 && v < GRID_N,
      )
    )
      return 'posição inválida'
    if (!s.cam || typeof s.cam.x !== 'number' || typeof s.cam.y !== 'number')
      return 'câmera inválida'
    if (typeof s.zoom !== 'number') return 'zoom inválido'
    if (s.dinNacoes && s.dinNacoes.v !== 2) return 'versão incompatível'
    if (s.piloto !== undefined && s.piloto !== null) {
      const e = validarPiloto(s.piloto)
      if (e) return e
    }
    return null
  }

  const entrarNoSave = (s) => {
    const d0 = s.dinNacoes?.v === 2 ? s.dinNacoes : null
    setQx(s.qx)
    setQy(s.qy)
    camRef.current = { x: s.cam.x, y: s.cam.y }
    velRef.current = { x: 0, y: 0 }
    setZoom(s.zoom)
    zoomRef.current = s.zoom
    zoomAlvo.current = s.zoom
    setCam({ x: s.cam.x, y: s.cam.y })
    if (d0) {
      setDin(d0)
    } else {
      const g0 = gerarGalaxia(s.seed, s.shape)
      setDin(inicialDin(gerarNacoes(s.seed, g0.stars)))
    }
    setSistema(null)
    setSelId(null)
    setSelAnom(null)
    setSelNacao(null)
    setIntro(null)
    setErroArquivo(null)
    setPiloto(s.piloto ?? null)
    setSave({
      seed: s.seed,
      shape: s.shape,
      qx: s.qx,
      qy: s.qy,
      origem: s.origem ?? null,
      sistemaId: s.sistemaId ?? null,
    })
    setTela('jogo')
  }

  const carregarDoArquivo = (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const s = JSON.parse(reader.result)
        const erro = validarSave(s)
        if (erro) {
          setErroArquivo(`Save inválido: ${erro}.`)
          return
        }
        entrarNoSave(s)
      } catch {
        setErroArquivo('Não deu p/ ler esse arquivo.')
      }
    }
    reader.readAsText(f)
  }

  const exportarSave = () => {
    if (!save) return
    const dados = {
      jogo: 'space-warlords',
      v: 1,
      seed,
      shape,
      qx,
      qy,
      cam,
      zoom,
      sistemaId: sistema?.estrela.id ?? null,
      dinNacoes: din,
      origem: save.origem ?? null,
      piloto,
    }
    const blob = new Blob([JSON.stringify(dados)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `space-warlords-T${din.tick}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  }

  const avancarDias = (n) => {
    setDin((prev) => {
      let d = prev
      for (let k = 0; k < n; k++) {
        const d1 = evoluirNacoes(seed, galaxia.stars, base, d)
        d = evoluirEconomia(seed, base, galaxia.stars, d1)
      }
      return d
    })
  }

  const voltarMenu = () => {
    if (
      !window.confirm(
        'Voltar ao menu? O progresso desde o último arquivo salvo será perdido.',
      )
    )
      return
    setSave(null)
    setSistema(null)
    setSelId(null)
    setSelAnom(null)
    setSelNacao(null)
    setVerFaccoes(false)
    setMenuJogador(null)
    setVerDev(false)
    setIntro(null)
    setErroArquivo(null)
    setPiloto(null)
    setCriacao(null)
    setTmpSeed(novaSeed())
    setTela('titulo')
  }

  if (!save) {
    if (tela === 'titulo') {
      return (
        <div className="sw-setup">
          <h1 className="sw-logo">SPACE WARLORDS</h1>
          <p className="sw-hint">Uma galáxia viva te espera, warlord.</p>
          <div className="sw-buttons">
            <button
              onClick={() => setTela('setup')}
              className="sw-primary sw-play"
            >
              Novo save
            </button>
            <button onClick={() => fileRef.current?.click()}>
              Carregar save
            </button>
            <button
              onClick={alternarDev}
              title="Modo desenvolvedor: revela informações secretas"
              className={devMode ? 'sw-primary' : ''}
            >
              DEV {devMode ? 'ON' : 'OFF'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={carregarDoArquivo}
            />
          </div>
          {erroArquivo && <p className="hab-no">{erroArquivo}</p>}
        </div>
      )
    }
    if (intro && introPrev) {
      return (
        <div className="sw-setup">
          <h1>FUGA</h1>
          <p>
            Alarmes. Sua nave cargueira é abordada por piratas e você foge na
            cápsula com nada além da roupa do corpo.
          </p>
          <p>
            A cápsula cai no sistema S{introPrev.host.capital}, capital de{' '}
            <strong style={{ color: introPrev.host.cor }}>
              {introPrev.host.nome}
            </strong>
            . Eles te recolhem — e observam seus próximos passos.
          </p>
          <div className="sw-buttons">
            <button onClick={() => setIntro(null)}>Voltar</button>
            <button onClick={confirmarComeco} className="sw-primary">
              Começar sem nada
            </button>
          </div>
        </div>
      )
    }
    if (tela === 'criacao' && criacao) {
      return (
        <CriacaoPersonagem
          culturas={criacao.culturas}
          onConfirm={confirmarCriacao}
          onVoltar={() => {
            setCriacao(null)
            setTela('setup')
          }}
        />
      )
    }
    return (
      <div className="sw-setup">
        <h1>SPACE WARLORDS</h1>
        <p>Nova campanha</p>
        <label>
          Galáxia:{' '}
          <select
            value={tmpShape}
            onChange={(e) => setTmpShape(e.target.value)}
          >
            {SHAPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <div className="sw-buttons">
          <button onClick={iniciar} className="sw-primary">
            Iniciar campanha
          </button>
        </div>
      </div>
    )
  }

  if (sistema) {
    const naDona =
      dip.dono[sistema.estrela.id] != null
        ? dip.nacoes[dip.dono[sistema.estrela.id]]
        : null
    return (
      <SystemMap
        sistema={sistema.dados}
        estrela={sistema.estrela}
        onVoltar={voltarGalaxia}
        ecoSistema={din.eco?.sistemas?.[sistema.estrela.id]}
        dono={naDona ? { cor: naDona.cor, nome: naDona.nome } : null}
      />
    )
  }

  const local = dip.nacoes.find((na) =>
    pontoEmPoligono(cam.x, cam.y, na.fronteira),
  )
  const fmtC = (v) => `${v < 0 ? '-' : '+'}${Math.abs(v).toFixed(3)}`

  return (
    <div className="sw-full">
      <canvas
        ref={mainRef}
        className="sw-canvas-full"
        onClick={clicarEstrela}
      />
      <div className="sw-hud-top">
        <strong>SPACE WARLORDS</strong>
        <span className="sw-navbox">
          NAV Q{qy * GRID_N + qx} [{qx},{qy}] · X{fmtC(cam.x)} Y{fmtC(cam.y)} ·{' '}
          {local ? local.nome : 'ESPAÇO NEUTRO'} · Z{zoom.toFixed(1)}
        </span>
        <span className="sw-hint">WASD voa · scroll = zoom total</span>
        <button
          onClick={() => setPausado((v) => !v)}
          title={pausado ? 'Retomar a simulação' : 'Congelar a simulação'}
        >
          {pausado ? 'Continuar' : 'Pausar'}
        </button>
        <button onClick={() => setVerFaccoes((v) => !v)} title="Lista de facções">
          Facções
        </button>
        {devMode && (
          <button onClick={() => setVerDev((v) => !v)} title="Painel de desenvolvimento">
            DEV
          </button>
        )}
        <button onClick={exportarSave} title="Baixa o arquivo da campanha">
          Salvar
        </button>
        <button onClick={voltarMenu} title="Volta ao título">
          Menu
        </button>
      </div>
      <div className="sw-lateral">
        {[
          ['personagem', 'Personagem'],
          ['frota', 'Frota'],
          ['comercio', 'Comércio'],
          ['navegacao', 'Navegação'],
          ['comunicacoes', 'Comunicações'],
          ['nave', 'Nave'],
        ].map(([id, rot]) => (
          <button
            key={id}
            className={menuJogador === id ? 'sw-lat ativa' : 'sw-lat'}
            onClick={() => setMenuJogador(menuJogador === id ? null : id)}
            title={rot}
            aria-label={rot}
          >
            {ICONES_MENU[id]}
          </button>
        ))}
      </div>
      {menuJogador && (
        <div className="sw-painel-jogador">
          <h2>
            {{
              personagem: 'PERSONAGEM',
              frota: 'FROTA',
              comercio: 'COMÉRCIO',
              navegacao: 'NAVEGAÇÃO',
              comunicacoes: 'COMUNICAÇÕES',
              nave: 'NAVE',
            }[menuJogador]}
          </h2>
          {menuJogador === 'personagem' ? (
            piloto ? (
              <>
                <p>
                  <strong>{piloto.nome}</strong>
                </p>
                <p className="sw-hint">
                  {piloto.idade} anos · {faixaEtaria(piloto.idade)} ·{' '}
                  {piloto.genero === 'F' ? 'Feminino' : 'Masculino'}
                </p>
                <p className="sw-hint">
                  Cultura:{' '}
                  {culturasMapa.find((c) => c.id === piloto.culturaId)?.nome ||
                    'sem cultura'}
                </p>
              </>
            ) : (
              <p className="sw-hint">Sem piloto nesta campanha.</p>
            )
          ) : menuJogador === 'comercio' ? (
            <ComercioGalaxia eco={din.eco} nacoes={dip.nacoes} />
          ) : (
            <p className="sw-hint">Em breve.</p>
          )}
          <button onClick={() => setMenuJogador(null)}>Fechar (Esc)</button>
        </div>
      )}
      <div className="sw-mini-wrap">
        <span className="sw-navbox" title="Data da campanha (1 tick = 1 dia)">
          D{din.tick} · {dataDoTick(din.tick)}
        </span>
        <canvas
          ref={miniRef}
          width={180}
          height={180}
          className="sw-mini"
          onClick={clicarMinimapa}
          title="Mapa da galáxia — clique p/ viajar"
        />
        <span className="sw-hint">T{din.tick}</span>
      </div>
      {verFaccoes && (
        <div className="sw-modal">
          <div className="sw-panel" onClick={(e) => e.stopPropagation()}>
            <h2>FACÇÕES</h2>
            <p className="sw-hint">
              Relação com{' '}
              {dip.nacoes[save?.origem]?.nome || 'sua nação de origem'}
            </p>
            <Faccoes
              nacoes={dip.nacoes}
              origemId={save?.origem}
              onSelect={(na) => {
                setSelNacao(na)
                setAbaNacao('economia')
                setVerFaccoes(false)
              }}
            />
            <div className="sw-buttons">
              <button onClick={() => setVerFaccoes(false)}>Fechar (Esc)</button>
            </div>
          </div>
        </div>
      )}
      {verDev && devMode && (
        <div className="sw-modal">
          <div className="sw-panel" onClick={(e) => e.stopPropagation()}>
            <h2>DEV · ECONOMIA GALÁCTICA</h2>
            <DevPanel
              tick={din.tick}
              data={dataDoTick(din.tick)}
              dip={dip}
              eco={din.eco}
              onAvancar={avancarDias}
            />
            <div className="sw-buttons">
              <button onClick={() => setVerDev(false)}>Fechar (Esc)</button>
            </div>
          </div>
        </div>
      )}
      {estrelaSel && sistemaPrev && (
        <div className="sw-modal">
          <div className="sw-panel" onClick={(e) => e.stopPropagation()}>
            <h2>SISTEMA S{estrelaSel.id}</h2>
            <p>
              Estrela {estrelaSel.tipo} · {estrelaSel.raioSol} R☉ ·{' '}
              {estrelaSel.tempK}K · L={sistemaPrev.L} L☉
            </p>
            {dip.dono[estrelaSel.id] != null && (
              <p>
                ★ {dip.nacoes[dip.dono[estrelaSel.id]].nome}
                {dip.nacoes[dip.dono[estrelaSel.id]].capital === estrelaSel.id
                  ? ' · capital'
                  : ''}
              </p>
            )}
            <p>
              {sistemaPrev.planetas.length} planeta(s) ·{' '}
              {sistemaPrev.cinturoes.length} cinturão(ões) ·{' '}
              {sistemaPrev.anas.length} planeta(s) anão(s)
            </p>
            <p className="sw-hint">linha da neve ≈ {sistemaPrev.snow} AU</p>
            <div className="sw-buttons">
              <button className="sw-primary" onClick={entrarSistema}>
                Entrar no sistema
              </button>
              <button onClick={() => setSelId(null)}>Cancelar (Esc)</button>
            </div>
          </div>
        </div>
      )}
      {selAnom && (
        <div className="sw-modal">
          <div className="sw-panel" onClick={(e) => e.stopPropagation()}>
            <h2>{selAnom.nome}</h2>
            <p>
              {NOME_ANOMALIA[selAnom.kind]}
              {selAnom.kind === 'nebulosa' &&
                ` de ${selAnom.subtipo} · ~${Math.round(selAnom.raio * 4000)} anos-luz`}
              {selAnom.periodo != null && ` · período ${selAnom.periodo}ms`}
            </p>
            <p>{selAnom.desc}</p>
            <div className="sw-buttons">
              <button onClick={() => setSelAnom(null)}>Fechar (Esc)</button>
            </div>
          </div>
        </div>
      )}
      {selNacao && (
        <div className="sw-modal">
          <div className="sw-panel" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ color: selNacao.cor }}>{selNacao.nome}</h2>
            <p className="sw-hint">Cultura: {selNacao.cultura?.nome}</p>
            <p>
              {TITULO[selNacao.tipo] ? `${TITULO[selNacao.tipo]} · ` : ''}
              {selNacao.tipo} · capital S{selNacao.capital} ·{' '}
              {selNacao.sistemas.length} sistema(s)
            </p>
            <div className="sw-abas">
              {[
                ['diplomacia', 'Diplomacia'],
                ['economia', 'Economia'],
                ['militar', 'Militar'],
                ['estatisticas', 'Estatísticas'],
              ].map(([id, rot]) => (
                <button
                  key={id}
                  className={abaNacao === id ? 'sw-aba ativa' : 'sw-aba'}
                  onClick={() => setAbaNacao(id)}
                >
                  {rot}
                </button>
              ))}
            </div>
            {abaNacao === 'diplomacia' && (
              <>
                <p>
                  Reputação:{' '}
                  <span
                    className={
                      selNacao.rep >= 50
                        ? 'hab-ok'
                        : selNacao.rep <= -50
                          ? 'hab-no'
                          : ''
                    }
                  >
                    {selNacao.rep > 0 ? `+${selNacao.rep}` : selNacao.rep}
                  </span>
                  {selNacao.guerras?.length > 0 && (
                    <>
                      {' '}
                      · em guerra com{' '}
                      {selNacao.guerras
                        .map((gid) => dip.nacoes[gid]?.nome)
                        .filter(Boolean)
                        .join(', ')}
                    </>
                  )}
                </p>
                {selNacao.eventos?.length > 0 && (
                  <ul className="sw-motivos">
                    {selNacao.eventos.slice(-3).map((e, i) => (
                      <li key={i} className="warn">
                        T{e.tick}: {e.texto}
                      </li>
                    ))}
                  </ul>
                )}
                <ul className="sw-motivos">
                  {selNacao.relacoes.map((r, i) => (
                    <li key={i} className={r.tipo === 'aliado' ? 'ok' : 'no'}>
                      {r.tipo === 'aliado' ? '◆ aliado' : '✗ rival'}:{' '}
                      {dip.nacoes[r.com]?.nome} · {r.motivo}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {abaNacao === 'economia' && (
              <EconomiaNacao na={selNacao} eco={din.eco} dev={devMode} />
            )}
            {(abaNacao === 'militar' || abaNacao === 'estatisticas') && (
              <p className="sw-hint">Em breve.</p>
            )}
            <div className="sw-buttons">
              <button className="sw-primary" onClick={entrarNaCapital}>
                Entrar no sistema da capital
              </button>
              <button onClick={() => setSelNacao(null)}>Fechar (Esc)</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
