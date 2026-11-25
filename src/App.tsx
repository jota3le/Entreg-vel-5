import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";

const client = generateClient<Schema>();

type FiltroStatus = "Todos" | "Pago" | "Pendente" | "Cancelado";
type Ordenacao = "recentes" | "maior" | "menor";

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function App() {
  const [vendas, setVendas] = useState<Array<Schema["Venda"]["type"]>>([]);
  const [cliente, setCliente] = useState("");
  const [produto, setProduto] = useState("");
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState("Pago");

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("Todos");
  const [ordenacao, setOrdenacao] = useState<Ordenacao>("recentes");
  const [metaMensal, setMetaMensal] = useState(15000);
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [novaMetaInput, setNovaMetaInput] = useState("15000");

  const [salvando, setSalvando] = useState(false);
  const [modalAberto, setModalAberto] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const sub = client.models.Venda.observeQuery().subscribe({
      next: (data) => setVendas([...data.items]),
    });
    return () => sub.unsubscribe();
  }, []);

  function mostrarToast(mensagem: string) {
    setToast(mensagem);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleAdicionarVenda(e: FormEvent) {
    e.preventDefault();
    const valorNumerico = Number(valor.replace(",", "."));
    if (!cliente.trim() || !produto.trim() || Number.isNaN(valorNumerico) || valorNumerico <= 0) {
      mostrarToast("Preencha cliente, produto e um valor válido.");
      return;
    }

    setSalvando(true);
    try {
      await client.models.Venda.create({
        cliente: cliente.trim(),
        produto: produto.trim(),
        valor: valorNumerico,
        status,
      });
      setCliente("");
      setProduto("");
      setValor("");
      setStatus("Pago");
      setModalAberto(false);
      mostrarToast("Venda registrada na nuvem com sucesso!");
    } finally {
      setSalvando(false);
    }
  }

  async function handleGerarDemo() {
    setSalvando(true);
    const exemplos = [
      { cliente: "Tech Solutions Ltda", produto: "Plano Cloud Enterprise", valor: 4200, status: "Pago" },
      { cliente: "Marina Costa", produto: "Consultoria Arquitetura AWS", valor: 1850, status: "Pago" },
      { cliente: "Grupo Horizonte", produto: "Licença Anual SaaS", valor: 3100, status: "Pendente" },
      { cliente: "Lucas Mendes", produto: "Implantação E-commerce", valor: 2400, status: "Pago" },
      { cliente: "Studio Criativo", produto: "Manutenção Mensal", valor: 650, status: "Cancelado" },
    ];
    try {
      for (const item of exemplos) {
        await client.models.Venda.create(item);
      }
      mostrarToast("5 vendas de demonstração adicionadas!");
    } finally {
      setSalvando(false);
    }
  }

  async function handleAlternarStatus(venda: Schema["Venda"]["type"]) {
    const proximo =
      venda.status === "Pago" ? "Pendente" : venda.status === "Pendente" ? "Cancelado" : "Pago";
    await client.models.Venda.update({ id: venda.id, status: proximo });
    mostrarToast(`Status alterado para ${proximo}.`);
  }

  async function handleExcluir(id: string) {
    await client.models.Venda.delete({ id });
    mostrarToast("Venda removida.");
  }

  function handleExportarCSV() {
    if (vendas.length === 0) {
      mostrarToast("Nenhuma venda para exportar.");
      return;
    }
    const cabecalho = "Cliente,Produto,Valor,Status\n";
    const linhas = vendas
      .map((v) => `"${v.cliente}","${v.produto}",${v.valor.toFixed(2)},"${v.status}"`)
      .join("\n");
    const blob = new Blob([cabecalho + linhas], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "relatorio-vendas-aws.csv";
    link.click();
    URL.revokeObjectURL(url);
    mostrarToast("Relatório CSV exportado!");
  }

  function handleSalvarMeta(e: FormEvent) {
    e.preventDefault();
    const valorMeta = Number(novaMetaInput.replace(",", "."));
    if (!Number.isNaN(valorMeta) && valorMeta > 0) {
      setMetaMensal(valorMeta);
      setEditandoMeta(false);
      mostrarToast("Meta mensal atualizada!");
    }
  }

  const vendasFiltradas = useMemo(() => {
    const filtradas = vendas.filter((v) => {
      const bateBusca =
        v.cliente.toLowerCase().includes(busca.toLowerCase()) ||
        v.produto.toLowerCase().includes(busca.toLowerCase());
      const bateStatus = filtroStatus === "Todos" || v.status === filtroStatus;
      return bateBusca && bateStatus;
    });

    if (ordenacao === "maior") return [...filtradas].sort((a, b) => b.valor - a.valor);
    if (ordenacao === "menor") return [...filtradas].sort((a, b) => a.valor - b.valor);
    return filtradas;
  }, [vendas, busca, filtroStatus, ordenacao]);

  const faturamentoPago = vendas
    .filter((v) => v.status === "Pago")
    .reduce((acc, v) => acc + v.valor, 0);

  const valorPendente = vendas
    .filter((v) => v.status === "Pendente")
    .reduce((acc, v) => acc + v.valor, 0);

  const totalVendas = vendas.length;
  const ticketMedio =
    totalVendas > 0 ? vendas.reduce((acc, v) => acc + v.valor, 0) / totalVendas : 0;

  const percentualMeta = Math.min(100, Math.round((faturamentoPago / metaMensal) * 100));

  const qtdPago = vendas.filter((v) => v.status === "Pago").length;
  const qtdPendente = vendas.filter((v) => v.status === "Pendente").length;
  const qtdCancelado = vendas.filter((v) => v.status === "Cancelado").length;
  const taxaConversao = totalVendas > 0 ? Math.round((qtdPago / totalVendas) * 100) : 0;

  return (
    <div className="app-shell">
      <div className="bg-glow bg-glow-1" />
      <div className="bg-glow bg-glow-2" />

      {toast && <div className="toast">{toast}</div>}

      <main className="dashboard-container">
        <header className="topbar fade-in">
          <div className="brand">
            <div className="brand-icon">V</div>
            <div>
              <h1>VendasCloud Pro</h1>
              <div className="live-status">
                <span className="pulse-dot" />
                <span>AWS Amplify • Sincronizado em tempo real</span>
              </div>
            </div>
          </div>

          <div className="header-actions">
            <button
              type="button"
              className="btn-ghost"
              onClick={handleGerarDemo}
              disabled={salvando}
            >
              ⚡ Dados Demo
            </button>
            <button type="button" className="btn-ghost" onClick={handleExportarCSV}>
              ⬇ Exportar CSV
            </button>
            <button type="button" className="btn-primary" onClick={() => setModalAberto(true)}>
              + Nova Venda
            </button>
          </div>
        </header>

        <section className="kpi-grid">
          <article className="kpi-card fade-in" style={{ animationDelay: "0.05s" }}>
            <span className="kpi-label">Faturamento Confirmado</span>
            <strong className="kpi-value emerald">{formatarMoeda(faturamentoPago)}</strong>
            <span className="kpi-sub">{qtdPago} vendas pagas</span>
          </article>

          <article className="kpi-card fade-in" style={{ animationDelay: "0.1s" }}>
            <span className="kpi-label">A Receber (Pendente)</span>
            <strong className="kpi-value amber">{formatarMoeda(valorPendente)}</strong>
            <span className="kpi-sub">{qtdPendente} aguardando pagamento</span>
          </article>

          <article className="kpi-card fade-in" style={{ animationDelay: "0.15s" }}>
            <span className="kpi-label">Ticket Médio</span>
            <strong className="kpi-value sky">{formatarMoeda(ticketMedio)}</strong>
            <span className="kpi-sub">{totalVendas} registros no total</span>
          </article>

          <article className="kpi-card fade-in" style={{ animationDelay: "0.2s" }}>
            <span className="kpi-label">Taxa de Conversão</span>
            <strong className="kpi-value violet">{taxaConversao}%</strong>
            <span className="kpi-sub">{qtdCancelado} canceladas</span>
          </article>
        </section>

        <section className="analytics-grid fade-in" style={{ animationDelay: "0.25s" }}>
          <div className="glass-card">
            <div className="card-header-row">
              <div>
                <h2>Meta Mensal de Faturamento</h2>
                <p className="muted">
                  {formatarMoeda(faturamentoPago)} de {formatarMoeda(metaMensal)}
                </p>
              </div>
              {!editandoMeta ? (
                <button
                  type="button"
                  className="btn-mini"
                  onClick={() => {
                    setNovaMetaInput(String(metaMensal));
                    setEditandoMeta(true);
                  }}
                >
                  Editar Meta
                </button>
              ) : (
                <form className="meta-form" onSubmit={handleSalvarMeta}>
                  <input
                    type="number"
                    value={novaMetaInput}
                    onChange={(e) => setNovaMetaInput(e.target.value)}
                    min="1"
                  />
                  <button type="submit" className="btn-mini primary">
                    OK
                  </button>
                </form>
              )}
            </div>

            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${percentualMeta}%` }} />
            </div>
            <div className="progress-footer">
              <span>Progresso atual</span>
              <strong>{percentualMeta}% concluído</strong>
            </div>
          </div>

          <div className="glass-card">
            <h2>Distribuição por Status</h2>
            <p className="muted">Proporção das vendas registradas no DynamoDB</p>
            <div className="status-bars">
              <div className="bar-item">
                <div className="bar-label">
                  <span>Pagas</span>
                  <strong>{qtdPago}</strong>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill emerald-bg"
                    style={{ width: `${totalVendas ? (qtdPago / totalVendas) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="bar-item">
                <div className="bar-label">
                  <span>Pendentes</span>
                  <strong>{qtdPendente}</strong>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill amber-bg"
                    style={{ width: `${totalVendas ? (qtdPendente / totalVendas) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className="bar-item">
                <div className="bar-label">
                  <span>Canceladas</span>
                  <strong>{qtdCancelado}</strong>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill rose-bg"
                    style={{ width: `${totalVendas ? (qtdCancelado / totalVendas) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="glass-card fade-in" style={{ animationDelay: "0.3s" }}>
          <div className="toolbar">
            <div className="filter-tabs">
              {(["Todos", "Pago", "Pendente", "Cancelado"] as FiltroStatus[]).map((aba) => (
                <button
                  key={aba}
                  type="button"
                  className={`tab-btn ${filtroStatus === aba ? "active" : ""}`}
                  onClick={() => setFiltroStatus(aba)}
                >
                  {aba}
                </button>
              ))}
            </div>

            <div className="toolbar-controls">
              <input
                type="text"
                className="input-dark"
                placeholder="Buscar cliente ou produto..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
              <select
                className="input-dark"
                value={ordenacao}
                onChange={(e) => setOrdenacao(e.target.value as Ordenacao)}
              >
                <option value="recentes">Mais recentes</option>
                <option value="maior">Maior valor</option>
                <option value="menor">Menor valor</option>
              </select>
            </div>
          </div>

          {vendasFiltradas.length === 0 ? (
            <div className="empty-state">
              <p>Nenhuma venda encontrada.</p>
              <span>Clique em "+ Nova Venda" ou em "⚡ Dados Demo" para preencher o painel.</span>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Produto / Serviço</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {vendasFiltradas.map((venda) => (
                    <tr key={venda.id} className="table-row">
                      <td className="font-medium">{venda.cliente}</td>
                      <td className="muted-cell">{venda.produto}</td>
                      <td className="value-cell">{formatarMoeda(venda.valor)}</td>
                      <td>
                        <span className={`pill ${venda.status.toLowerCase()}`}>{venda.status}</span>
                      </td>
                      <td className="actions-cell">
                        <button
                          type="button"
                          className="btn-mini"
                          onClick={() => handleAlternarStatus(venda)}
                        >
                          Alterar Status
                        </button>
                        <button
                          type="button"
                          className="btn-mini danger"
                          onClick={() => handleExcluir(venda.id)}
                        >
                          Excluir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {modalAberto && (
        <div className="modal-overlay" onClick={() => setModalAberto(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Registrar Nova Venda</h2>
              <button type="button" className="close-btn" onClick={() => setModalAberto(false)}>
                ✕
              </button>
            </div>
            <form className="modal-form" onSubmit={handleAdicionarVenda}>
              <label>
                <span>Cliente</span>
                <input
                  type="text"
                  className="input-dark"
                  placeholder="Ex: Empresa Alpha"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  required
                />
              </label>
              <label>
                <span>Produto ou Serviço</span>
                <input
                  type="text"
                  className="input-dark"
                  placeholder="Ex: Consultoria Cloud"
                  value={produto}
                  onChange={(e) => setProduto(e.target.value)}
                  required
                />
              </label>
              <div className="form-row">
                <label>
                  <span>Valor (R$)</span>
                  <input
                    type="text"
                    className="input-dark"
                    placeholder="1250.00"
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    required
                  />
                </label>
                <label>
                  <span>Status</span>
                  <select
                    className="input-dark"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    <option value="Pago">Pago</option>
                    <option value="Pendente">Pendente</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </label>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setModalAberto(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={salvando}>
                  {salvando ? "Salvando..." : "Confirmar Venda"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
