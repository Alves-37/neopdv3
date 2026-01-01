import { useEffect, useMemo, useState } from 'react'
import { api, API_BASE_URL } from '../services/api'

export default function RelatoriosFinanceiros() {
  const today = useMemo(() => new Date(), [])
  const toYMD = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const [inicio, setInicio] = useState(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), 1)
    return toYMD(d)
  })
  const [fim, setFim] = useState(() => toYMD(today))
  const [usuarios, setUsuarios] = useState([])
  const [usuarioId, setUsuarioId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [vendas, setVendas] = useState([])
  const [custoPorProduto, setCustoPorProduto] = useState({})
  const [nomeProduto, setNomeProduto] = useState({})

  const fmtMT = (v) => {
    try {
      return `MT ${new Intl.NumberFormat('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v||0))}`
    } catch { return `MT ${v}` }
  }

  useEffect(() => {
    let mounted = true
    async function loadUsersProducts() {
      try {
        const [usersData, prodsData] = await Promise.all([
          api.getUsuarios().catch(() => []),
          api.getProdutos('').catch(() => []),
        ])
        const users = Array.isArray(usersData) ? usersData : (usersData?.items || [])
        const prods = Array.isArray(prodsData) ? prodsData : (prodsData?.items || [])
        const map = {}
        const nmap = {}
        for (const p of prods) {
          const key = p.id || p.uuid
          if (!key) continue
          map[key] = Number(p.preco_custo ?? p.custo ?? 0)
          nmap[key] = p.nome || p.descricao || key
        }
        if (mounted) {
          setUsuarios(users)
          setCustoPorProduto(map)
          setNomeProduto(nmap)
        }
      } catch {}
    }
    loadUsersProducts()
    return () => { mounted = false }
  }, [])

  async function buscar() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getVendasPeriodo(inicio, fim, usuarioId || undefined)
      const arr = Array.isArray(data) ? data : (data?.items || [])
      setVendas(arr)
    } catch (e) {
      setError(e.message)
      setVendas([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { buscar() }, [])

  const resumo = useMemo(() => {
    let faturamento = 0
    let custo = 0
    let itensTotal = 0
    for (const v of vendas) {
      for (const it of (v.itens || [])) {
        const pid = it.produto_id || it.produto?.id
        const precoUnit = Number(it.preco_unitario ?? 0)
        const qtd = Number(it.peso_kg && it.peso_kg > 0 ? it.peso_kg : (it.quantidade ?? 0))
        const custoItem = Number(it.preco_custo_unitario ?? 0)
        const custoUnit = (Number.isFinite(custoItem) && custoItem > 0)
          ? custoItem
          : Number(custoPorProduto[pid] ?? 0)
        faturamento += precoUnit * qtd
        custo += custoUnit * qtd
        itensTotal += qtd
      }
    }
    const lucro = faturamento - custo
    const qtdVendas = vendas.length
    const ticketMedio = qtdVendas > 0 ? faturamento / qtdVendas : 0
    return { faturamento, custo, lucro, qtdVendas, ticketMedio, itensTotal }
  }, [vendas, custoPorProduto])

  const topProdutos = useMemo(() => {
    const acc = new Map()
    for (const v of vendas) {
      for (const it of (v.itens || [])) {
        const pid = it.produto_id || it.produto?.id
        if (!pid) continue
        const qtd = Number(it.peso_kg && it.peso_kg > 0 ? it.peso_kg : (it.quantidade ?? 0))
        const receita = Number(it.preco_unitario ?? 0) * qtd
        const cur = acc.get(pid) || { qtd: 0, receita: 0 }
        cur.qtd += qtd
        cur.receita += receita
        acc.set(pid, cur)
      }
    }
    const rows = Array.from(acc.entries()).map(([pid, v]) => ({
      id: pid,
      nome: nomeProduto[pid] || pid,
      qtd: v.qtd,
      receita: v.receita,
    }))
    rows.sort((a, b) => b.qtd - a.qtd)
    return rows.slice(0, 10)
  }, [vendas, nomeProduto])

  const [mostrarTodosTop, setMostrarTodosTop] = useState(false)
  const topVisiveis = useMemo(() => mostrarTodosTop ? topProdutos : topProdutos.slice(0, 5), [topProdutos, mostrarTodosTop])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Relatórios Financeiros</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div>
            <label className="block text-xs text-gray-600">De</label>
            <input type="date" className="input" value={inicio} onChange={e => setInicio(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Até</label>
            <input type="date" className="input" value={fim} onChange={e => setFim(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-600">Vendedor</label>
            <select className="input min-w-[200px]" value={usuarioId} onChange={e => setUsuarioId(e.target.value)}>
              <option value="">Todos</option>
              {usuarios.map(u => (
                <option key={u.id || u.uuid || u.usuario} value={u.id || u.uuid}>{u.nome || u.usuario}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary" onClick={buscar} disabled={loading}>Filtrar</button>
          <button
            type="button"
            className="btn-outline"
            title="Baixar relatório de vendas em PDF"
            onClick={async () => {
              try {
                const base = API_BASE_URL
                const token = localStorage.getItem('access_token')
                const qs = new URLSearchParams()
                if (inicio) qs.set('data_inicio', inicio)
                if (fim) qs.set('data_fim', fim)
                if (usuarioId) qs.set('usuario_id', usuarioId)
                const res = await fetch(`${base}/api/relatorios/vendas?${qs.toString()}`, {
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                })
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'vendas_periodo.pdf'
                document.body.appendChild(a)
                a.click()
                a.remove()
                URL.revokeObjectURL(url)
              } catch (e) {
                alert(e.message || 'Falha ao gerar PDF de vendas')
              }
            }}
          >
            PDF Vendas
          </button>
          <button
            type="button"
            className="btn-outline"
            title="Baixar relatório financeiro em PDF"
            onClick={async () => {
              try {
                const base = API_BASE_URL
                const token = localStorage.getItem('access_token')
                const qs = new URLSearchParams()
                if (inicio) qs.set('data_inicio', inicio)
                if (fim) qs.set('data_fim', fim)
                if (usuarioId) qs.set('usuario_id', usuarioId)
                const res = await fetch(`${base}/api/relatorios/financeiro?${qs.toString()}`, {
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                })
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'relatorio_financeiro.pdf'
                document.body.appendChild(a)
                a.click()
                a.remove()
                URL.revokeObjectURL(url)
              } catch (e) {
                alert(e.message || 'Falha ao gerar PDF financeiro')
              }
            }}
          >
            PDF Financeiro
          </button>
          <button
            type="button"
            className="btn-outline"
            title="Exportar faturas do mês em CSV"
            onClick={async () => {
              try {
                if (!inicio) {
                  alert('Defina uma data inicial para determinar o mês.');
                  return;
                }
                const base = API_BASE_URL
                const token = localStorage.getItem('access_token')
                const d = new Date(inicio)
                const ano = d.getFullYear()
                const mes = d.getMonth() + 1
                const qs = new URLSearchParams({ ano: String(ano), mes: String(mes) })
                const res = await fetch(`${base}/api/relatorios/faturas-mensal?${qs.toString()}`, {
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                })
                if (!res.ok) throw new Error(`HTTP ${res.status}`)
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `faturas_${ano}_${String(mes).padStart(2, '0')}.csv`
                document.body.appendChild(a)
                a.click()
                a.remove()
                URL.revokeObjectURL(url)
              } catch (e) {
                alert(e.message || 'Falha ao exportar faturas (CSV)')
              }
            }}
          >
            CSV Faturas
          </button>
        </div>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card title="Faturamento" value={fmtMT(resumo.faturamento)} color="primary" />
        <Card title="Custo" value={fmtMT(resumo.custo)} color="secondary" />
        <Card title="Lucro" value={fmtMT(resumo.lucro)} color="accent" />
        <Card title="Qtd. Vendas" value={resumo.qtdVendas} color="danger" />
        <Card title="Ticket Médio" value={fmtMT(resumo.ticketMedio)} color="primary" />
        <Card title="Itens Vendidos" value={resumo.itensTotal} color="secondary" />
      </section>

      {/* Top 10 produtos mais vendidos */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Top 10 produtos mais vendidos</h2>
          {topProdutos.length > 5 && (
            <button className="btn-outline text-sm" onClick={() => setMostrarTodosTop(v => !v)}>
              {mostrarTodosTop ? 'Ver menos (5)' : 'Ver todos (10)'}
            </button>
          )}
        </div>
        {topProdutos.length === 0 ? (
          <p className="text-sm text-gray-600">Sem dados para o período selecionado.</p>
        ) : (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {topVisiveis.map((p) => (
              <div key={p.id} className="rounded-lg p-3 shadow-sm border bg-white">
                <div className="font-medium text-sm truncate" title={p.nome}>{p.nome}</div>
                <div className="mt-1 text-xs text-gray-600 flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-primary-100 text-primary-700 border border-primary-200">Qtd: {p.qtd}</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-secondary-100 text-secondary-700 border border-secondary-200">{fmtMT(p.receita)}</span>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  )
}

function Card({ title, value, color = 'primary' }) {
  const colorGrad = {
    primary: 'from-primary-600 via-primary-700 to-primary-900',
    secondary: 'from-secondary-600 via-secondary-700 to-secondary-900',
    accent: 'from-accent-600 via-accent-700 to-accent-900',
    danger: 'from-danger-600 via-danger-700 to-danger-900',
  }
  const grad = colorGrad[color] || colorGrad.primary
  return (
    <div className={`rounded-xl p-4 shadow-card border border-white/10 bg-gradient-to-br ${grad} text-white`}>
      <div className="text-xs text-white/80">{title}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  )
}
