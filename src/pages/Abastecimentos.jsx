import { useEffect, useMemo, useRef, useState } from 'react'
import api from '../services/api'
import Modal from '../components/Modal'

export default function Abastecimentos() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [pagina, setPagina] = useState(1)
  const [limite, setLimite] = useState(20)
  const [hasNext, setHasNext] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [showFilters, setShowFilters] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  const [dataInicial, setDataInicial] = useState('')
  const [dataFinal, setDataFinal] = useState('')
  const [produtoId, setProdutoId] = useState('')
  const [produtoQuery, setProdutoQuery] = useState('')
  const [produtoSugestoes, setProdutoSugestoes] = useState([])
  const [showSugestoes, setShowSugestoes] = useState(false)
  const [usuarioId, setUsuarioId] = useState('')
  const [ordenacao, setOrdenacao] = useState('created_at_desc')

  const [usuarios, setUsuarios] = useState([])

  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [novoFornecedor, setNovoFornecedor] = useState('Fornecedor Padrão')
  const [novoBusca, setNovoBusca] = useState('')
  const [novoCodigo, setNovoCodigo] = useState('')
  const [novoCategoriaId, setNovoCategoriaId] = useState('')
  const [categorias, setCategorias] = useState([])
  const [novoProdutosAll, setNovoProdutosAll] = useState([])
  const [novoProdutos, setNovoProdutos] = useState([])
  const [novoProdutoId, setNovoProdutoId] = useState('')
  const [novoProdutoObj, setNovoProdutoObj] = useState(null)
  const [novoDescricao, setNovoDescricao] = useState('')
  const [novoPrecoCusto, setNovoPrecoCusto] = useState('')
  const [novoPrecoVenda, setNovoPrecoVenda] = useState('')
  const [novoQtd, setNovoQtd] = useState('')
  const [novoCusto, setNovoCusto] = useState('')

  // Evita que o useEffect de filtros limpe seleção quando os campos são atualizados
  // automaticamente ao selecionar um produto.
  const selectingProdutoRef = useRef(false)

  const getLoggedUsuarioId = () => {
    try {
      const raw = localStorage.getItem('user')
      if (!raw) return undefined
      const u = JSON.parse(raw)
      const v = u?.id || u?.uuid || u?.usuario_id
      if (!v) return undefined
      return String(v)
    } catch (e) {
      return undefined
    }
  }

  function handleNovoProdutoSelect(p) {
    selectingProdutoRef.current = true
    setNovoProdutoId(p?.id || '')
    setNovoProdutoObj(p || null)

    setNovoDescricao(p?.descricao ?? '')
    setNovoPrecoCusto(String(p?.preco_custo ?? p?.custo ?? ''))
    setNovoPrecoVenda(String(p?.preco_venda ?? p?.preco ?? ''))
    setNovoCodigo(p?.codigo ?? '')
    setNovoCategoriaId(p?.categoria_id != null ? String(p.categoria_id) : '')

    try {
      const custo = Number(p?.preco_custo ?? p?.custo ?? '')
      if (Number.isFinite(custo)) {
        setNovoCusto(String(custo))
      }
    } catch (e) {
      // ignore
    }

    // Soltar a trava no próximo tick.
    setTimeout(() => {
      selectingProdutoRef.current = false
    }, 0)
  }

  function clearNovoProduto() {
    setNovoProdutoId('')
    setNovoProdutoObj(null)
    setNovoDescricao('')
    setNovoPrecoCusto('')
    setNovoPrecoVenda('')
  }

  // Carregar categorias (para filtro no modal de criação)
  useEffect(() => {
    let mounted = true
    async function loadCats() {
      try {
        const data = await api.getCategorias()
        const arr = Array.isArray(data) ? data : (data?.items || [])
        if (mounted) setCategorias(arr)
      } catch (e) {
        if (mounted) setCategorias([])
      }
    }
    loadCats()
    return () => { mounted = false }
  }, [])

  // Carregar todos os produtos ao abrir o modal (para permitir busca por 1 letra via filtro local)
  useEffect(() => {
    if (!createOpen) return
    let active = true
    ;(async () => {
      try {
        const result = await api.getProdutos('')
        if (!active) return
        const arr = Array.isArray(result) ? result : (result?.items || [])
        setNovoProdutosAll(arr)
      } catch (e) {
        if (!active) return
        setNovoProdutosAll([])
      }
    })()
    return () => { active = false }
  }, [createOpen])

  // Buscar produtos para o modal (filtros: busca/código/categoria) - filtro local
  useEffect(() => {
    const handle = setTimeout(() => {
      const termo = (novoBusca || '').trim().toLowerCase()
      const codigo = (novoCodigo || '').trim().toLowerCase()
      const cat = String(novoCategoriaId || '')

      const base = Array.isArray(novoProdutosAll) ? novoProdutosAll : []
      let arr = base

      if (termo) {
        arr = arr.filter(p => {
          const nome = String(p?.nome || p?.descricao || '').toLowerCase()
          const cod = String(p?.codigo || '').toLowerCase()
          return nome.includes(termo) || cod.includes(termo)
        })
      }
      if (codigo) {
        arr = arr.filter(p => String(p?.codigo || '').toLowerCase().includes(codigo))
      }
      if (cat) {
        arr = arr.filter(p => String(p?.categoria_id ?? '') === cat)
      }
      setNovoProdutos(arr.slice(0, 80))
    }, 200)

    return () => clearTimeout(handle)
  }, [novoBusca, novoCodigo, novoCategoriaId])

  async function buscarProdutosModalAgora() {
    const termo = (novoBusca || '').trim().toLowerCase()
    const codigo = (novoCodigo || '').trim().toLowerCase()
    const cat = String(novoCategoriaId || '')

    const base = Array.isArray(novoProdutosAll) ? novoProdutosAll : []
    let arr = base

    if (termo) {
      arr = arr.filter(p => {
        const nome = String(p?.nome || p?.descricao || '').toLowerCase()
        const cod = String(p?.codigo || '').toLowerCase()
        return nome.includes(termo) || cod.includes(termo)
      })
    }
    if (codigo) {
      arr = arr.filter(p => String(p?.codigo || '').toLowerCase().includes(codigo))
    }
    if (cat) {
      arr = arr.filter(p => String(p?.categoria_id ?? '') === cat)
    }
    setNovoProdutos(arr.slice(0, 80))
  }

  // Ao alterar filtros, limpar seleção atual (igual ao fluxo do PDV3)
  useEffect(() => {
    if (selectingProdutoRef.current) return
    clearNovoProduto()
    setNovoCusto('')
    setNovoQtd('')
  }, [novoBusca, novoCodigo, novoCategoriaId])

  // Verificar tamanho da tela
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const params = useMemo(() => ({
    data_inicial: dataInicial || undefined,
    data_final: dataFinal || undefined,
    usuario_id: usuarioId || undefined,
    produto_id: produtoId || undefined,
    pagina,
    limite,
    ordenacao,
  }), [dataInicial, dataFinal, usuarioId, produtoId, pagina, limite, ordenacao])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await api.getAbastecimentosHistorico(params)
      setItems(res?.items || [])
      setHasNext(!!res?.has_next)
    } catch (e) {
      setError(e?.message || 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [params])

  // Carregar usuários (para filtro e para registrar abastecimento com usuário associado)
  useEffect(() => {
    let mounted = true
    async function loadUsers() {
      try {
        const data = await api.getUsuarios()
        const arr = Array.isArray(data) ? data : (data?.items || [])
        if (mounted) setUsuarios(arr)
      } catch (e) {
        if (mounted) setUsuarios([])
      }
    }
    loadUsers()
    return () => { mounted = false }
  }, [])

  // Autocomplete de produtos (debounce simples)
  useEffect(() => {
    let active = true
    const q = (produtoQuery || '').trim()
    if (!q) {
      setProdutoSugestoes([])
      return
    }
    const handle = setTimeout(async () => {
      try {
        const result = await api.getProdutos(q)
        if (!active) return
        setProdutoSugestoes(Array.isArray(result) ? result.slice(0, 10) : [])
      } catch (e) {
        if (!active) return
        setProdutoSugestoes([])
      }
    }, 300)
    return () => {
      active = false
      clearTimeout(handle)
    }
  }, [produtoQuery])

  function handleProdutoSelect(p) {
    setProdutoId(p?.id || '')
    setProdutoQuery(p?.nome ? `${p.nome}${p.codigo ? ` (${p.codigo})` : ''}` : '')
    setShowSugestoes(false)
  }

  function clearProduto() {
    setProdutoId('')
    setProdutoQuery('')
    setProdutoSugestoes([])
  }

  function exportCSV() {
    const headers = [
      'Data', 'Produto', 'Código', 'Quantidade', 'Custo Unitário', 'Total Custo', 'Usuário', 'Observação'
    ]
    const rows = items.map(r => [
      r.created_at ? new Date(r.created_at).toLocaleString() : '',
      r.produto_nome || '',
      r.codigo || '',
      String(r.quantidade ?? ''),
      String(r.custo_unitario ?? ''),
      String(r.total_custo ?? ''),
      r.usuario_nome || '',
      (r.observacao || '').replaceAll('\n', ' ').replaceAll('"', '""'),
    ])
    const csv = [headers.join(','), ...rows.map(row => row.map(cell => {
      const needsQuote = /[",\n]/.test(cell)
      const val = String(cell).replaceAll('"', '""')
      return needsQuote ? `"${val}"` : val
    }).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `abastecimentos_${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function exportPDF() {
    // Gera uma visualização imprimível; o usuário pode "Salvar como PDF"
    const w = window.open('', '_blank')
    if (!w) return
    const style = `
      <style>
        body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; padding: 16px; }
        h1 { font-size: 18px; margin: 0 0 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        th { background: #f5f5f5; }
        td.num { text-align: right; }
      </style>
    `
    const header = `<h1>Histórico de Abastecimentos</h1>`
    const tableHead = `
      <thead>
        <tr>
          <th>Data</th>
          <th>Produto</th>
          <th>Código</th>
          <th>Quantidade</th>
          <th>Custo Unit.</th>
          <th>Total Custo</th>
          <th>Usuário</th>
          <th>Obs.</th>
        </tr>
      </thead>
    `
    const tableBody = `
      <tbody>
        ${items.map(r => `
          <tr>
            <td>${r.created_at ? new Date(r.created_at).toLocaleString() : ''}</td>
            <td>${r.produto_nome || ''}</td>
            <td>${r.codigo || ''}</td>
            <td class="num">${Number(r.quantidade || 0).toLocaleString()}</td>
            <td class="num">${Number(r.custo_unitario || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td class="num">${Number(r.total_custo || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td>${r.usuario_nome || ''}</td>
            <td>${(r.observacao || '').replaceAll('<','&lt;').replaceAll('>','&gt;')}</td>
          </tr>
        `).join('')}
      </tbody>
    `
    const html = `<!doctype html><html><head><meta charset="utf-8">${style}</head><body>${header}<table>${tableHead}${tableBody}</table></body></html>`
    w.document.open()
    w.document.write(html)
    w.document.close()
    w.focus()
    // Aguarda um tick antes de imprimir
    setTimeout(() => { w.print(); w.close(); }, 300)
  }

  function handleSubmit(e) {
    e.preventDefault()
    setPagina(1)
    load()
  }

  // Formatar valor monetário
  const formatCurrency = (value) => {
    return Number(value || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  // Formatar data
  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleString('pt-BR')
  }

  const getUsuarioNome = (obj) => {
    return (obj && (obj.usuario_nome || obj.usuario?.nome || obj.usuario)) || '-'
  }

  return (
    <div className="p-2 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
        <h1 className="text-xl font-semibold">Histórico de Abastecimentos</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="px-5 py-3 text-base font-semibold text-white bg-primary-600 rounded-md hover:bg-primary-700 w-full sm:w-auto"
            title="Registrar abastecimento"
          >
            Novo abastecimento
          </button>
          <button 
            type="button" 
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-3 text-base text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 w-full sm:w-auto"
            aria-label="Filtros"
          >
            {showFilters ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </button>
          <div className="hidden md:flex items-center gap-2">
            <button 
              type="button" 
              onClick={exportCSV}
              className="px-3 py-2 text-sm text-green-600 bg-green-100 rounded-md hover:bg-green-200"
              title="Exportar CSV"
            >
              Exportar CSV
            </button>
            <button 
              type="button" 
              onClick={exportPDF}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Imprimir
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Criar abastecimento */}
      <Modal
        open={createOpen}
        title="Novo abastecimento"
        onClose={() => { if (!creating) setCreateOpen(false) }}
        actions={(
          <>
            <button
              type="button"
              className="btn-outline"
              onClick={() => { if (!creating) setCreateOpen(false) }}
              disabled={creating}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={creating}
              onClick={async () => {
                setError('')
                const quantidade = Number(String(novoQtd || '').replace(',', '.'))
                const custo_unitario = Number(String(novoCusto || '').replace(',', '.'))
                if (!novoProdutoId) { alert('Selecione um produto'); return }
                if (!Number.isFinite(quantidade) || quantidade <= 0) { alert('Quantidade inválida'); return }
                if (!Number.isFinite(custo_unitario) || custo_unitario < 0) { alert('Custo unitário inválido'); return }

                try {
                  setCreating(true)
                  const item = {
                    produto_id: novoProdutoId,
                    usuario_id: getLoggedUsuarioId(),
                    quantidade,
                    custo_unitario,
                  }
                  const resp = await api.createAbastecimentosBulk([item])
                  if (!resp || resp.inserted < 1) {
                    const reason = (resp?.conflicts && resp.conflicts[0] && (resp.conflicts[0].reason || resp.conflicts[0].message))
                    throw new Error(reason || 'Falha ao registrar abastecimento')
                  }
                  clearNovoProduto()
                  setNovoFornecedor('Fornecedor Padrão')
                  setNovoBusca('')
                  setNovoCodigo('')
                  setNovoCategoriaId('')
                  setNovoProdutos([])
                  setNovoQtd('')
                  setNovoCusto('')
                  setCreateOpen(false)
                  await load()
                } catch (ex) {
                  alert(ex?.message || 'Erro ao registrar abastecimento')
                } finally {
                  setCreating(false)
                }
              }}
            >
              {creating ? 'Salvando...' : 'Registrar'}
            </button>
          </>
        )}
      >
        <div className="space-y-4">
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500">Fornecedor</div>
                <input
                  className="input w-full mt-1"
                  value={novoFornecedor}
                  onChange={(e) => setNovoFornecedor(e.target.value)}
                  placeholder="Fornecedor"
                />
              </div>
              <div>
                <div className="text-xs text-gray-500">Buscar</div>
                <input
                  className="input w-full mt-1"
                  value={novoBusca}
                  onChange={(e) => setNovoBusca(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      buscarProdutosModalAgora()
                    }
                  }}
                  placeholder="Buscar produto"
                />
              </div>
              <div>
                <div className="text-xs text-gray-500">Código</div>
                <input
                  className="input w-full mt-1"
                  value={novoCodigo}
                  onChange={(e) => setNovoCodigo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      buscarProdutosModalAgora()
                    }
                  }}
                  placeholder="Código"
                />
              </div>
              <div>
                <div className="text-xs text-gray-500">Categoria</div>
                <select
                  className="input w-full mt-1"
                  value={novoCategoriaId}
                  onChange={(e) => setNovoCategoriaId(e.target.value)}
                >
                  <option value="">Todas</option>
                  {categorias.map((c) => (
                    <option key={c.id || c.nome} value={String(c.id)}>
                      {c.nome || c.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <div className="text-xs text-gray-500">Produto</div>
                <select
                  className="input w-full mt-1"
                  value={novoProdutoId}
                  onChange={(e) => {
                    const id = e.target.value
                    setNovoProdutoId(id)
                    const p = novoProdutos.find(x => String(x.id || x.uuid) === String(id))
                    if (p) handleNovoProdutoSelect(p)
                  }}
                >
                  <option value="">Selecione um produto</option>
                  {novoProdutos.map((p) => (
                    <option key={p.id || p.uuid || p.codigo} value={String(p.id || p.uuid)}>
                      {(p.nome || p.descricao || 'Produto')}{p.codigo ? ` (${p.codigo})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500">Descrição do produto</div>
            <textarea
              className="input w-full mt-1"
              rows={2}
              value={novoDescricao}
              readOnly
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-gray-500">Preço custo</div>
              <input className="input w-full mt-1" value={novoPrecoCusto} readOnly />
            </div>
            <div>
              <div className="text-xs text-gray-500">Preço venda</div>
              <input className="input w-full mt-1" value={novoPrecoVenda} readOnly />
            </div>
            <div>
              <div className="text-xs text-gray-500">Custo unitário (editar)</div>
              <input
                className="input w-full mt-1"
                value={novoCusto}
                onChange={(e) => setNovoCusto(e.target.value)}
                inputMode="decimal"
              />
            </div>
          </div>

          <div>
            <div className="text-xs text-gray-500">Quantidade</div>
            <input
              className="input w-full mt-1"
              value={novoQtd}
              onChange={(e) => setNovoQtd(e.target.value)}
              inputMode="decimal"
              placeholder="Digite a quantidade"
            />
          </div>

        </div>
      </Modal>

      {/* Filtros - Mobile (colapsável) */}
      <div className={`mb-4 ${!showFilters && 'hidden'} md:block`}>
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data inicial</label>
              <input 
                type="date" 
                value={dataInicial} 
                onChange={e => setDataInicial(e.target.value)} 
                className="w-full p-2 border rounded-md" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data final</label>
              <input 
                type="date" 
                value={dataFinal} 
                onChange={e => setDataFinal(e.target.value)} 
                className="w-full p-2 border rounded-md" 
              />
            </div>
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Produto</label>
              <div className="relative">
                <div className="flex items-center">
                  <input
                    type="text"
                    placeholder="Pesquisar..."
                    value={produtoQuery}
                    onChange={e => { 
                      setProdutoQuery(e.target.value); 
                      setShowSugestoes(true) 
                    }}
                    onFocus={() => setShowSugestoes(true)}
                    className="w-full p-2 border rounded-l-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  {produtoQuery && (
                    <button 
                      type="button" 
                      onClick={clearProduto}
                      className="p-2 bg-gray-100 border border-l-0 rounded-r-md text-gray-500 hover:bg-gray-200"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                {showSugestoes && produtoSugestoes.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
                    {produtoSugestoes.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm flex flex-col"
                        onClick={() => handleProdutoSelect(p)}
                      >
                        <span className="font-medium">{p.nome}</span>
                        {p.codigo && <span className="text-xs text-gray-500">Código: {p.codigo}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ordenação</label>
              <select 
                value={ordenacao} 
                onChange={e => setOrdenacao(e.target.value)} 
                className="w-full p-2 border rounded-md"
              >
                <option value="created_at_desc">Mais recentes</option>
                <option value="created_at_asc">Mais antigos</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4 flex justify-end gap-2">
            <button 
              type="button" 
              onClick={() => { 
                setDataInicial(''); 
                setDataFinal(''); 
                setProdutoId(''); 
                setProdutoQuery('');
                setUsuarioId(''); 
                setPagina(1); 
              }} 
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50"
            >
              Limpar
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md shadow-sm hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-60"
            >
              {loading ? 'Aplicando...' : 'Aplicar Filtros'}
            </button>
          </div>
        </form>
      </div>

      {/* Contador de resultados */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">
          {loading ? 'Carregando...' : `${items.length} ${items.length === 1 ? 'registro' : 'registros'}`}
        </div>
        <div className="hidden md:flex items-center gap-2">
          <span className="text-sm text-gray-600">Itens por página:</span>
          <select 
            value={limite} 
            onChange={e => { setLimite(Number(e.target.value)); setPagina(1) }} 
            className="text-sm border rounded p-1"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Mensagem de erro */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {/* Tabela (desktop) */}
      <div className="hidden md:block overflow-auto border rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produto</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantidade</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Custo Unit.</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Usuário</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(item.created_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-gray-900">{item.produto_nome || '-'}</div>
                  {item.codigo && <div className="text-xs text-gray-500">{item.codigo}</div>}
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-900">
                  {Number(item.quantidade || 0).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-sm text-gray-900">
                  MT {formatCurrency(item.custo_unitario)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                  MT {formatCurrency(item.total_custo)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">
                  {getUsuarioNome(item)}
                </td>
                <td className="px-4 py-3 text-right text-sm font-medium">
                  <button
                    onClick={() => setSelectedItem(item)}
                    className="px-2 py-1 text-sm text-blue-600 bg-blue-100 rounded hover:bg-blue-200"
                    title="Ver detalhes"
                  >
                    Detalhes
                  </button>
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan="7" className="px-4 py-8 text-center text-sm text-gray-500">
                  Nenhum registro encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Cards (mobile) */}
      <div className="md:hidden space-y-3">
        {items.map((item) => (
          <div key={item.id} className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
            <div className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{item.produto_nome || 'Sem nome'}</h3>
                  {item.codigo && <p className="text-xs text-gray-500">{item.codigo}</p>}
                </div>
                <button
                  onClick={() => setSelectedItem(item)}
                  className="text-primary-600 hover:text-primary-800"
                  title="Ver detalhes"
                >
                  <span>Detalhes</span>
                </button>
              </div>
              
              <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-gray-500">Data</p>
                  <p>{formatDate(item.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Quantidade</p>
                  <p>{Number(item.quantidade || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Custo Unit.</p>
                  <p>MT {formatCurrency(item.custo_unitario)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="font-medium">MT {formatCurrency(item.total_custo)}</p>
                </div>
              </div>

              {(item.usuario_nome || item.usuario?.nome || item.usuario) && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500">Usuário</p>
                  <p className="text-sm">{getUsuarioNome(item)}</p>
                </div>
              )}

              {item.observacao && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500">Observação</p>
                  <p className="text-sm text-gray-900 line-clamp-2">{item.observacao}</p>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {!loading && items.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nenhum registro encontrado
          </div>
        )}
      </div>

      {/* Paginação */}
      <div className="mt-4 flex items-center justify-between">
        <button 
          onClick={() => setPagina(p => Math.max(1, p - 1))} 
          disabled={pagina === 1 || loading} 
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Anterior
        </button>
        <span className="text-sm text-gray-700">
          Página {pagina}
        </span>
        <button 
          onClick={() => setPagina(p => (hasNext ? p + 1 : p))} 
          disabled={!hasNext || loading} 
          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Próxima
        </button>
      </div>
      {/* Modal de Detalhes */}
      <Modal open={!!selectedItem} title="Detalhes do Abastecimento" onClose={() => setSelectedItem(null)}>
        <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
          <div className="sm:flex sm:items-start">
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
              <div className="flex justify-between items-start">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Detalhes do Abastecimento
                </h3>
                <button
                  type="button"
                  className="px-3 py-1 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                  onClick={() => setSelectedItem(null)}
                >
                  Fechar
                </button>
              </div>
              
              {selectedItem && (
                <div className="mt-4 space-y-4">
                  <div className="border-t border-gray-200 pt-4">
                    <h4 className="font-medium text-gray-900">Informações do Produto</h4>
                    <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                      <div>
                            <dt className="text-sm font-medium text-gray-500">Produto</dt>
                            <dd className="mt-1 text-sm text-gray-900">{selectedItem.produto_nome || '-'}</dd>
                          </div>
                          {selectedItem.codigo && (
                            <div>
                              <dt className="text-sm font-medium text-gray-500">Código</dt>
                              <dd className="mt-1 text-sm text-gray-900">{selectedItem.codigo}</dd>
                            </div>
                          )}
                          <div>
                            <dt className="text-sm font-medium text-gray-500">Quantidade</dt>
                            <dd className="mt-1 text-sm text-gray-900">{Number(selectedItem.quantidade || 0).toLocaleString()}</dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">Custo Unitário</dt>
                            <dd className="mt-1 text-sm text-gray-900">MT {formatCurrency(selectedItem.custo_unitario)}</dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">Total</dt>
                            <dd className="mt-1 text-sm font-semibold text-gray-900">MT {formatCurrency(selectedItem.total_custo)}</dd>
                          </div>
                        </dl>
                      </div>
                      
                      <div className="border-t border-gray-200 pt-4">
                        <h4 className="font-medium text-gray-900">Informações Adicionais</h4>
                        <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2">
                          <div>
                            <dt className="text-sm font-medium text-gray-500">Data</dt>
                            <dd className="mt-1 text-sm text-gray-900">{formatDate(selectedItem.created_at)}</dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-gray-500">Usuário</dt>
                            <dd className="mt-1 text-sm text-gray-900">{getUsuarioNome(selectedItem)}</dd>
                          </div>
                          {selectedItem.observacao && (
                            <div>
                              <dt className="text-sm font-medium text-gray-500">Observação</dt>
                              <dd className="mt-1 text-sm text-gray-900 whitespace-pre-line">{selectedItem.observacao}</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={() => setSelectedItem(null)}
              >
                Fechar
              </button>
              <button
                type="button"
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={() => {
                  exportPDF([selectedItem]);
                  setSelectedItem(null);
                }}
              >
                Imprimir
              </button>
            </div>
          </Modal>
        </div>
      )
    }
