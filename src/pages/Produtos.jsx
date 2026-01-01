import { useEffect, useMemo, useState } from 'react'
import { api, API_BASE_URL } from '../services/api'
import Modal from '../components/Modal'
import ProductForm from '../components/ProductForm'
import ConfirmDialog from '../components/ConfirmDialog'

export default function Produtos() {
  const [q, setQ] = useState('')
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmProduct, setConfirmProduct] = useState(null)
  const [lowOnly, setLowOnly] = useState(false)

  async function load(search) {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getProdutos(search)
      const arr = Array.isArray(data) ? data : (data?.items || [])
      setTodos(arr)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load('') }, [])

  // Atualização em "tempo real" simples: polling e refresh ao voltar o foco
  useEffect(() => {
    const intervalId = setInterval(() => {
      // Recarrega mantendo o termo atual da busca
      load(q)
    }, 15000) // 15s

    const onFocus = () => load(q)
    const onVisibility = () => { if (document.visibilityState === 'visible') load(q) }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(intervalId)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [q])

  // Debounce da busca (client-side)
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

  const isBaixo = (p) => {
    const estoque = Number(p.estoque ?? 0)
    const min = Number(p.estoque_minimo ?? 0)
    return min > 0 ? (estoque <= min) : (estoque <= 5)
  }

  const filtrados = useMemo(() => {
    let base = todos
    if (debouncedQ) {
      base = base.filter(p => {
        const nome = (p.nome || '').toLowerCase()
        const codigo = (p.codigo || '').toLowerCase()
        const categoria = String(p.categoria_id || '').toLowerCase()
        const unidade = (p.unidade_medida || '').toLowerCase()
        const taxaIva = String(p.taxa_iva ?? '').toLowerCase()
        return (
          nome.includes(debouncedQ) ||
          codigo.includes(debouncedQ) ||
          categoria.includes(debouncedQ) ||
          unidade.includes(debouncedQ) ||
          taxaIva.includes(debouncedQ)
        )
      })
    }
    if (lowOnly) {
      base = base.filter(isBaixo)
    }
    return base
  }, [todos, debouncedQ, lowOnly])

  const SkeletonCard = () => (
    <div className="card animate-pulse">
      <div className="h-4 w-32 bg-gray-200 rounded" />
      <div className="mt-3 h-6 w-24 bg-gray-200 rounded" />
      <div className="mt-3 h-4 w-16 bg-gray-200 rounded" />
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Header + busca (mobile-first) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">Produtos</h1>
          <button
            className="btn-primary"
            onClick={() => { setEditing(null); setModalOpen(true) }}
          >
            Novo produto
          </button>
          <button
            type="button"
            className="btn-outline"
            title="Gerar relatório PDF de todos os produtos"
            onClick={async () => {
              try {
                const token = localStorage.getItem('access_token')
                const res = await fetch(`${API_BASE_URL}/api/relatorios/produtos`, {
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                })
                if (!res.ok) {
                  throw new Error(`HTTP ${res.status}`)
                }
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'produtos.pdf'
                document.body.appendChild(a)
                a.click()
                a.remove()
                URL.revokeObjectURL(url)
              } catch (e) {
                alert(e.message || 'Falha ao gerar PDF de produtos')
              }
            }}
          >
            PDF (todos)
          </button>
          <button
            type="button"
            className="btn-outline"
            title="Gerar relatório PDF de produtos com baixo estoque"
            onClick={async () => {
              try {
                const token = localStorage.getItem('access_token')
                const res = await fetch(`${API_BASE_URL}/api/relatorios/produtos?baixo_estoque=true`, {
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                })
                if (!res.ok) {
                  throw new Error(`HTTP ${res.status}`)
                }
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = 'produtos_baixo_estoque.pdf'
                document.body.appendChild(a)
                a.click()
                a.remove()
                URL.revokeObjectURL(url)
              } catch (e) {
                alert(e.message || 'Falha ao gerar PDF de produtos com baixo estoque')
              }
            }}
          >
            PDF (baixo estoque)
          </button>
        </div>
        <div className="flex-1 min-w-[220px] sm:min-w-[320px] max-w-xl">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <label className="sr-only" htmlFor="buscar">Buscar</label>
              <input id="buscar" className="input w-full pl-9" placeholder="Buscar por nome, código, categoria ou unidade" value={q} onChange={e => setQ(e.target.value)} />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
              </span>
            </div>
            {/* Switch baixo estoque */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Baixo estoque</span>
              <button
                type="button"
                aria-pressed={lowOnly}
                onClick={() => setLowOnly(v => !v)}
                className={`w-10 h-6 rounded-full transition-colors ${lowOnly ? 'bg-red-500' : 'bg-gray-300'}`}
                title="Mostrar apenas produtos com baixo estoque"
              >
                <span className={`block w-5 h-5 bg-white rounded-full shadow transform transition-transform ${lowOnly ? 'translate-x-4' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {/* Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Estado vazio */}
      {!loading && filtrados.length === 0 && (
        <div className="card text-center py-10">
          <div className="mx-auto h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="h-6 w-6 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="14" rx="2"/><path d="M3 13a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4"/></svg>
          </div>
          <p className="mt-3 text-gray-600">Nenhum produto encontrado.</p>
        </div>
      )}

      {/* Lista de produtos */}
      {!loading && filtrados.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map((p) => {
            const estoque = Number(p.estoque ?? 0)
            const min = Number(p.estoque_minimo ?? 0)
            const baixo = isBaixo(p)
            const margem = (p.preco_venda && p.preco_custo) ? ((p.preco_venda - p.preco_custo) / (p.preco_venda || 1) * 100) : null
            return (
              <div key={p.id || p.uuid || p.codigo} className="card card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate" title={p.nome}>{p.nome}</h3>
                    <div className="text-xs sm:text-sm text-gray-500">Código: {p.codigo}</div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full ${baixo ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>Estoque: {estoque}{min ? `/${min}` : ''}</span>
                      {typeof p.venda_por_peso !== 'undefined' && (
                        <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                          {p.venda_por_peso ? 'Peso' : (p.unidade_medida || 'un')}
                        </span>
                      )}
                      {typeof p.taxa_iva !== 'undefined' && p.taxa_iva !== null && (
                        <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                          IVA: {Number(p.taxa_iva || 0).toFixed(1)}%
                        </span>
                      )}
                      {p.categoria_id != null && (
                        <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Cat: {p.categoria_id}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-gray-500">Preço</div>
                    <div className="text-lg sm:text-xl font-semibold text-green-600">{fmtMT(p.preco_venda || p.preco || 0)}</div>
                    {margem !== null && (
                      <div className="text-[11px] text-purple-600 mt-0.5">Margem: {margem.toFixed(1)}%</div>
                    )}
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button
                        className="inline-flex items-center justify-center p-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                        title="Editar"
                        onClick={() => { setEditing(p); setModalOpen(true) }}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>
                      </button>
                      <button
                        className="inline-flex items-center justify-center p-2 rounded-md border border-red-300 text-red-700 hover:bg-red-50"
                        title="Excluir"
                        onClick={() => { setConfirmProduct(p); setConfirmOpen(true) }}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
                      </button>
                    </div>
                  </div>
                </div>
                {p.descricao && (
                  <p className="mt-3 text-sm text-gray-600 line-clamp-2">{p.descricao}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal CRUD */}
      <Modal
        open={modalOpen}
        title={editing ? 'Editar produto' : 'Novo produto'}
        onClose={() => { if (!submitting) { setModalOpen(false); setEditing(null) } }}
      >
        <ProductForm
          initial={editing}
          submitting={submitting}
          onCancel={() => { if (!submitting) { setModalOpen(false); setEditing(null) } }}
          onSubmit={async (payload) => {
            try {
              setSubmitting(true)
              if (editing) {
                const id = editing.id || editing.uuid
                await api.updateProduto(id, payload)
              } else {
                await api.createProduto(payload)
              }
              await load('')
              setModalOpen(false)
              setEditing(null)
            } catch (e) {
              alert(e.message || 'Falha ao salvar produto')
            } finally {
              setSubmitting(false)
            }
          }}
        />
      </Modal>

      {/* Confirmar exclusão de produto */}
      <ConfirmDialog
        open={confirmOpen}
        title="Confirmar exclusão"
        message={confirmProduct ? (
          <>
            Tem certeza que deseja excluir o produto <b>{confirmProduct.nome}</b>?<br/>
            Esta ação não pode ser desfeita.
          </>
        ) : 'Tem certeza?'}
        confirmText="Excluir"
        cancelText="Cancelar"
        danger
        loading={submitting}
        onCancel={() => { if (!submitting) { setConfirmOpen(false); setConfirmProduct(null) } }}
        onConfirm={async () => {
          if (!confirmProduct) return
          const id = confirmProduct.id || confirmProduct.uuid
          if (!id) { alert('ID do produto não encontrado.'); return }
          try {
            setSubmitting(true)
            await api.deleteProduto(id)
            await load('')
            setConfirmOpen(false)
            setConfirmProduct(null)
          } catch (e) {
            alert(e.message || 'Falha ao remover produto')
          } finally {
            setSubmitting(false)
          }
        }}
      />
    </div>
  )
}
