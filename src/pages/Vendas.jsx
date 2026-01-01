import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../services/api'
import Modal from '../components/Modal'

export default function Vendas() {
  const [q, setQ] = useState('')
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [period, setPeriod] = useState('today') // today | month | all
  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [prodMap, setProdMap] = useState({})
  const [usuarios, setUsuarios] = useState([])
  const [usuarioId, setUsuarioId] = useState('') // UUID do vendedor ou '' para todos

  // Utilitário para datas no formato YYYY-MM-DD (local)
  const toYMD = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  // Carregar conforme período selecionado (com polling + foco/visibilidade)
  const loadData = useCallback(async () => {
    let mounted = true
    setLoading(true)
    setError(null)
    try {
      let data
      if (period === 'today') {
        const today = new Date()
        const ymd = toYMD(today)
        data = await api.getVendasPeriodo(ymd, ymd, usuarioId || undefined)
      } else if (period === 'month') {
        const now = new Date()
        const start = new Date(now.getFullYear(), now.getMonth(), 1)
        const data_inicio = toYMD(start)
        const data_fim = toYMD(now)
        data = await api.getVendasPeriodo(data_inicio, data_fim, usuarioId || undefined)
      } else {
        if (usuarioId) {
          // quando há filtro de vendedor, usar um período amplo até hoje
          const data_inicio = '1970-01-01'
          const data_fim = toYMD(new Date())
          data = await api.getVendasPeriodo(data_inicio, data_fim, usuarioId)
        } else {
          data = await api.getVendas()
        }
      }
      const arr = Array.isArray(data) ? data : (data?.items || [])
      if (mounted) setTodos(arr)
    } catch (e) {
      // Fallback: se a busca por período falhar, tentar uma listagem geral para não quebrar a UI
      if (mounted) setError(e.message)
      try {
        let fallback
        if (usuarioId) {
          const data_inicio = '1970-01-01'
          const data_fim = toYMD(new Date())
          fallback = await api.getVendasPeriodo(data_inicio, data_fim, usuarioId)
        } else {
          fallback = await api.getVendas()
        }
        const arr2 = Array.isArray(fallback) ? fallback : (fallback?.items || [])
        if (mounted) setTodos(arr2)
      } catch {
        // mantém erro e lista vazia
      }
    } finally {
      if (mounted) setLoading(false)
    }
    return () => { mounted = false }
  }, [period, usuarioId])

  useEffect(() => {
    let cleanup = loadData()
    const intervalId = setInterval(() => { loadData() }, 20000)
    const onFocus = () => loadData()
    const onVisibility = () => { if (document.visibilityState === 'visible') loadData() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      if (typeof cleanup === 'function') cleanup()
      clearInterval(intervalId)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [loadData])

  // Carregar produtos uma vez para mapear nomes no detalhe (opcional)
  useEffect(() => {
    let mounted = true
    async function loadProducts() {
      try {
        const data = await api.getProdutos('')
        const arr = Array.isArray(data) ? data : (data?.items || [])
        const map = {}
        for (const p of arr) {
          const key = p.id || p.uuid
          if (key) map[key] = p.nome || p.descricao || key
        }
        if (mounted) setProdMap(map)
      } catch { /* silencioso */ }
    }
    loadProducts()
    return () => { mounted = false }
  }, [])

  // Carregar usuários (vendedores) para o filtro
  useEffect(() => {
    let mounted = true
    async function loadUsers() {
      try {
        const data = await api.getUsuarios()
        const arr = Array.isArray(data) ? data : (data?.items || [])
        if (mounted) setUsuarios(arr)
      } catch {}
    }
    loadUsers()
    return () => { mounted = false }
  }, [])

  // Debounce da busca
  const [debouncedQ, setDebouncedQ] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 250)
    return () => clearTimeout(id)
  }, [q])

  const fmtMT = (v) => {
    if (v === null || v === undefined) return '—'
    try {
      const num = new Intl.NumberFormat('pt-MZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v))
      return `MT ${num}`
    } catch { return `${v}` }
  }

  const getDescontoInfo = (venda) => {
    try {
      const raw = (
        venda?.desconto ??
        venda?.desconto_aplicado ??
        venda?.valor_desconto ??
        venda?.desconto_valor ??
        0
      )
      const desconto = Number(raw || 0)
      const perc = Number(venda?.percentual_desconto ?? venda?.desconto_percentual ?? venda?.percentual ?? 0)
      const aplicado = desconto > 0 || perc > 0
      return { aplicado, desconto, perc }
    } catch {
      return { aplicado: false, desconto: 0, perc: 0 }
    }
  }

  const getIvaInfo = (venda) => {
    try {
      const flag = venda?.com_iva ?? venda?.iva_incluso ?? venda?.aplicar_iva ?? venda?.inclui_iva
      if (typeof flag === 'boolean') {
        const totalIva = Number(venda?.total_iva ?? venda?.iva_total ?? venda?.valor_iva ?? 0)
        const taxa = Number(venda?.taxa_iva ?? venda?.iva_percentual ?? 0)
        return { comIva: flag, totalIva, taxa }
      }

      const itens = Array.isArray(venda?.itens) ? venda.itens : []
      let taxa = 0
      let totalIva = 0
      for (const it of itens) {
        const t = Number(it?.taxa_iva ?? it?.iva_percentual ?? it?.iva ?? 0)
        if (t > taxa) taxa = t
        const v = Number(it?.valor_iva ?? it?.iva_valor ?? it?.iva_total ?? 0)
        if (v) totalIva += v
      }
      const totalIvaVenda = Number(venda?.total_iva ?? venda?.iva_total ?? venda?.valor_iva ?? 0)
      if (totalIvaVenda) totalIva = totalIvaVenda
      const comIva = taxa > 0 || totalIva > 0
      return { comIva, totalIva, taxa }
    } catch {
      return { comIva: false, totalIva: 0, taxa: 0 }
    }
  }

  // Calcula total a partir dos itens quando possível (subtotais - desconto)
  const calcTotal = (venda) => {
    try {
      const itens = Array.isArray(venda?.itens) ? venda.itens : []
      if (itens.length === 0) {
        // fallback para campos existentes
        return Number(venda?.total ?? venda?.total_venda ?? 0)
      }
      const soma = itens.reduce((acc, it) => acc + Number(it?.subtotal || 0), 0)
      const desconto = Number(venda?.desconto || 0)
      const total = soma - desconto
      return total >= 0 ? total : 0
    } catch {
      return Number(venda?.total ?? venda?.total_venda ?? 0)
    }
  }

  const fmtData = (d) => {
    try {
      if (!d) return '—'
      let s = typeof d === 'string' ? d : String(d)
      // Se vier ISO sem timezone (ex.: 2025-09-21T01:16:48.123), assumir UTC
      const isISO = /^\d{4}-\d{2}-\d{2}T/.test(s)
      const hasTZ = /Z$|[+-]\d{2}:?\d{2}$/.test(s)
      if (isISO && !hasTZ) s = s + 'Z'

      const dt = new Date(s)
      // Formatar sempre em Africa/Maputo para consistência
      const fmt = new Intl.DateTimeFormat('pt-MZ', {
        dateStyle: 'short',
        timeStyle: 'medium',
        timeZone: 'Africa/Maputo',
      })
      return fmt.format(dt)
    } catch {
      return d || '—'
    }
  }

  const filtrados = useMemo(() => {
    if (!debouncedQ) return todos
    return todos.filter(v => {
      const numero = String(v.numero || v.id || '').toLowerCase()
      const cliente = (v.cliente_nome || v.cliente || '').toLowerCase()
      const usuario = (v.usuario_nome || v.usuario || '').toLowerCase()
      return numero.includes(debouncedQ) || cliente.includes(debouncedQ) || usuario.includes(debouncedQ)
    })
  }, [todos, debouncedQ])

  const Skeleton = () => (
    <div className="card animate-pulse">
      <div className="h-4 w-40 bg-gray-200 rounded" />
      <div className="mt-3 h-5 w-28 bg-gray-200 rounded" />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold mr-2">Vendas</h1>
          <div className="flex items-center gap-2">
            <button
              className={period === 'today' ? 'btn-primary' : 'btn-outline'}
              onClick={() => setPeriod('today')}
            >Hoje</button>
            <button
              className={period === 'month' ? 'btn-primary' : 'btn-outline'}
              onClick={() => setPeriod('month')}
            >Mês</button>
            <button
              className={period === 'all' ? 'btn-primary' : 'btn-outline'}
              onClick={() => setPeriod('all')}
            >Todas</button>
          </div>
        </div>
        <div className="flex-1 min-w-[220px] sm:min-w-[320px] max-w-xl">
          <label htmlFor="buscar" className="sr-only">Buscar</label>
          <div className="relative">
            <input id="buscar" className="input w-full pl-9" placeholder="Buscar por nº, cliente ou usuário" value={q} onChange={e => setQ(e.target.value)} />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
            </span>
          </div>
        </div>
        <div className="min-w-[200px]">
          <label htmlFor="vendedor" className="sr-only">Vendedor</label>
          <select id="vendedor" className="input w-full" value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
            <option value="">Todos os vendedores</option>
            {usuarios.map(u => (
              <option key={u.id || u.uuid || u.usuario} value={u.id || u.uuid}>
                {u.nome || u.usuario}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)}
        </div>
      )}

      {!loading && filtrados.length === 0 && (
        <div className="card text-center py-10">
          <div className="mx-auto h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="h-6 w-6 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v14H3z"/><path d="M3 9h18"/></svg>
          </div>
          <p className="mt-3 text-gray-600">Nenhuma venda encontrada.</p>
        </div>
      )}

      {!loading && filtrados.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map((v) => {
            const total = calcTotal(v)
            const itens = Array.isArray(v.itens) ? v.itens.length : (v.quantidade_itens ?? null)
            const cliente = v.cliente_nome || v.cliente || '—'
            return (
              <div
                key={v.id || v.uuid || JSON.stringify(v)}
                className="card card-hover cursor-pointer"
                onClick={async () => {
                  const id = v.id || v.uuid
                  if (!id) return
                  setDetailOpen(true)
                  setSelected(null)
                  setLoadingDetail(true)
                  try {
                    const full = await api.getVenda(id)
                    setSelected(full)
                  } catch (e) {
                    setSelected({ erro: e.message })
                  } finally {
                    setLoadingDetail(false)
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate" title={`Venda #${v.numero || v.id}`}>Venda #{v.numero || v.id}</h3>
                    <div className="text-xs sm:text-sm text-gray-500">{v.data ? fmtData(v.data) : '—'}</div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{cliente}</span>
                      {itens != null && (
                        <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{itens} itens</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-gray-500">Total</div>
                    <div className="text-lg sm:text-xl font-semibold text-green-600">{fmtMT(total)}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detalhes da venda */}
      <Modal
        open={detailOpen}
        title={selected ? `Venda #${selected.numero || selected.id}` : 'Detalhes da venda'}
        onClose={() => { setDetailOpen(false); setSelected(null) }}
      >
        {loadingDetail && <p className="text-gray-500">Carregando...</p>}
        {!loadingDetail && selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-gray-500">Cliente</div>
                <div className="font-medium">{selected.cliente_nome || selected.cliente || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Vendedor</div>
                <div className="font-medium">{selected.usuario_nome || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Data</div>
                <div className="font-medium">{selected.created_at ? fmtData(selected.created_at) : '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Forma de pagamento</div>
                <div className="font-medium">{selected.forma_pagamento || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Desconto</div>
                {(() => {
                  const d = getDescontoInfo(selected)
                  if (!d.aplicado) return <div className="font-medium">Sem desconto</div>
                  const parts = []
                  if (d.desconto > 0) parts.push(fmtMT(d.desconto))
                  if (d.perc > 0) parts.push(`${Number(d.perc).toFixed(2)}%`)
                  return <div className="font-medium">{parts.join(' • ') || 'Aplicado'}</div>
                })()}
              </div>
              <div>
                <div className="text-xs text-gray-500">IVA</div>
                {(() => {
                  const i = getIvaInfo(selected)
                  if (!i.comIva) return <div className="font-medium">Sem IVA</div>
                  const parts = []
                  if (i.taxa > 0) parts.push(`${Number(i.taxa).toFixed(2)}%`)
                  if (i.totalIva > 0) parts.push(fmtMT(i.totalIva))
                  return <div className="font-medium">Com IVA{parts.length ? ` (${parts.join(' • ')})` : ''}</div>
                })()}
              </div>
            </div>

            <div>
              <div className="text-sm font-semibold mb-2">Itens</div>
              {(!selected.itens || selected.itens.length === 0) ? (
                <div className="text-sm text-gray-500">Nenhum item.</div>
              ) : (
                <div className="divide-y border rounded-md">
                  {selected.itens.map((it, idx) => {
                    const pid = it.produto_id
                    const nome = prodMap[pid] || pid
                    const qtd = it.quantidade
                    const peso = it.peso_kg
                    return (
                      <div key={it.id || `${pid}-${idx}`} className="p-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate" title={String(nome)}>{nome}</div>
                          <div className="text-xs text-gray-500">{qtd ? `${qtd} un` : ''}{(qtd && peso) ? ' • ' : ''}{peso ? `${peso} kg` : ''}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs text-gray-500">Unit</div>
                          <div className="font-semibold">{fmtMT(it.preco_unitario)}</div>
                          <div className="text-xs text-gray-500 mt-1">Subtotal</div>
                          <div className="font-semibold text-green-600">{fmtMT(it.subtotal)}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <div className="text-sm text-gray-600">Total</div>
              <div className="text-lg font-semibold text-green-600">{fmtMT(calcTotal(selected))}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
