import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";

const client = generateClient<Schema>();

interface Usuario {
  nome: string;
  email: string;
  senha: string;
}

const USUARIOS_INICIAIS: Usuario[] = [
  { nome: "Administrador", email: "admin@vendascloud.com", senha: "123456" },
];

type FiltroStatus = "Todos" | "Pago" | "Pendente" | "Cancelado";
type Ordenacao = "recentes" | "maior" | "menor";

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function carregarUsuarios(): Usuario[] {
  try {
    const salvo = localStorage.getItem("vendascloud_usuarios");
    if (salvo) return JSON.parse(salvo);
  } catch {
    // ignora erro de leitura
  }
  return USUARIOS_INICIAIS;
}

export default function App() {
  const [usuarios, setUsuarios] = useState<Usuario[]>(carregarUsuarios);
  const [usuarioLogado, setUsuarioLogado] = useState<Usuario | null>(() => {
    try {
      const salvo = localStorage.getItem("vendascloud_sessao");
      return salvo ? JSON.parse(salvo) : null;
    } catch {
      return null;
    }
  });

  const [modoAuth, setModoAuth] = useState<"login" | "cadastro">("login");
  const [nomeInput, setNomeInput] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [senhaInput, setSenhaInput] = useState("");
  const [erroAuth, setErroAuth] = useState("");

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

  // Carrega apenas as vendas do usuário logado
  useEffect(() => {
    if (!usuarioLogado) {
      setVendas([]);
      return;
    }
    const emailAtual = usuarioLogado.email.toLowerCase();
    const sub = client.models.Venda.observeQuery().subscribe({
      next: (data) => {
        const minhasVendas = data.items.filter(
          (v) => v.usuarioEmail?.toLowerCase() === emailAtual
        );
        setVendas(minhasVendas);
      },
    });
    return () => sub.unsubscribe();
  }, [usuarioLogado]);

  // Carrega a meta mensal salva para este usuário
  useEffect(() => {
    if (!usuarioLogado) return;
    const metaSalva = localStorage.getItem(`vendascloud_meta_${usuarioLogado.email.toLowerCase()}`);
    setMetaMensal(metaSalva ? Number(metaSalva) : 15000);
  }, [usuarioLogado]);

  function handleLogin(e: FormEvent) {
    e.preventDefault();
    const encontrado = usuarios.find(
      (u) =>
        u.email.toLowerCase() === emailInput.trim().toLowerCase() &&
        u.senha === senhaInput
    );

    if (encontrado) {
      localStorage.setItem("vendascloud_sessao", JSON.stringify(encontrado));
      setUsuarioLogado(encontrado);
      setErroAuth("");
      setSenhaInput("");
    } else {
      setErroAuth("E-mail ou senha incorretos.");
    }
  }

  function handleCadastro(e: FormEvent) {
    e.preventDefault();
    const emailLimpo = emailInput.trim().toLowerCase();
    const nomeLimpo = nomeInput.trim();

    if (!nomeLimpo || !emailLimpo || senhaInput.length < 4) {
      setErroAuth("Preencha todos os campos (senha com no mínimo 4 caracteres).");
      return;
    }

    const jaExiste = usuarios.some((u) => u.email.toLowerCase() === emailLimpo);
    if (jaExiste) {
      setErroAuth("Este e-mail já está cadastrado. Faça login.");
      return;
    }

    const novoUsuario: Usuario = {
      nome: nomeLimpo,
      email: emailLimpo,
      senha: senhaInput,
    };

    const listaAtualizada = [...usuarios, novoUsuario];
    setUsuarios(listaAtualizada);
    localStorage.setItem("vendascloud_usuarios", JSON.stringify(listaAtualizada));
    localStorage.setItem("vendascloud_sessao", JSON.stringify(novoUsuario));
    setUsuarioLogado(novoUsuario);
    setErroAuth("");
    setNomeInput("");
    setEmailInput("");
    setSenhaInput("");
  }

  function handleLogout() {
    localStorage.removeItem("vendascloud_sessao");
    setUsuarioLogado(null);
    setVendas([]);
    setEmailInput("");
    setSenhaInput("");
    setErroAuth("");
  }

  function mostrarToast(mensagem: string) {
    setToast(mensagem);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleAdicionarVenda(e: FormEvent) {
    e.preventDefault();
    if (!usuarioLogado) return;

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
        usuarioEmail: usuarioLogado.email.toLowerCase(),
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
    if (!usuarioLogado) return;
    setSalvando(true);
    const emailAtual = usuarioLogado.email.toLowerCase();
    const exemplos = [
      { cliente: "Tech Solutions Ltda", produto: "Plano Cloud Enterprise", valor: 4200, status: "Pago", usuarioEmail: emailAtual },
      { cliente: "Marina Costa", produto: "Consultoria Arquitetura AWS", valor: 1850, status: "Pago", usuarioEmail: emailAtual },
      { cliente: "Grupo Horizonte", produto: "Licença Anual SaaS", valor: 3100, status: "Pendente", usuarioEmail: emailAtual },
      { cliente: "Lucas Mendes", produto: "Implantação E-commerce", valor: 2400, status: "Pago", usuarioEmail: emailAtual },
      { cliente: "Studio Criativo", produto: "Manutenção Mensal", valor: 650, status: "Cancelado", usuarioEmail: emailAtual },
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
    if (!usuarioLogado) return;
    const valorMeta = Number(novaMetaInput.replace(",", "."));
    if (!Number.isNaN(valorMeta) && valorMeta > 0) {
      setMetaMensal(valorMeta);
      localStorage.setItem(
        `vendascloud_meta_${usuarioLogado.email.toLowerCase()}`,
        String(valorMeta)
      );
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

  if (!usuarioLogado) {
    return (
      <div
        className="app-shell"
        style={{ display: "grid", placeItems: "center", padding: "24px" }}
      >
        <div className="bg-glow bg-glow-1" />
        <div className="bg-glow bg-glow-2" />

        <div
          className="glass-card fade-in"
          style={{ width: "100%", maxWidth: "420px", position: "relative", zIndex: 1 }}
        >
          <div className="brand" style={{ marginBottom: "20px" }}>
            <div className="brand-icon">V</div>
            <div>
              <h1>VendasCloud Pro</h1>
              <p className="muted">
                {modoAuth === "login"
                  ? "Entre com sua conta para acessar"
                  : "Crie sua conta gratuita na hora"}
              </p>
            </div>
          </div>

          <div
            className="filter-tabs"
            style={{ marginBottom: "20px", display: "grid", gridTemplateColumns: "1fr 1fr" }}
          >
            <button
              type="button"
              className={`tab-btn ${modoAuth === "login" ? "active" : ""}`}
              onClick={() => {
                setModoAuth("login");
                setErroAuth("");
              }}
            >
              Entrar
            </button>
            <button
              type="button"
              className={`tab-btn ${modoAuth === "cadastro" ? "active" : ""}`}
              onClick={() => {
                setModoAuth("cadastro");
                setErroAuth("");
              }}
            >
              Criar Conta
            </button>
          </div>

          <form
            onSubmit={modoAuth === "login" ? handleLogin : handleCadastro}
            className="modal-form"
          >
            {modoAuth === "cadastro" && (
              <label>
                <span>Seu Nome</span>
                <input
                  type="text"
                  className="input-dark"
                  placeholder="Ex: João Lucas"
                  value={nomeInput}
                  onChange={(e) => {
                    setNomeInput(e.target.value);
                    setErroAuth("");
                  }}
                  required
                />
              </label>
            )}

            <label>
              <span>E-mail</span>
              <input
                type="email"
                className="input-dark"
                placeholder="seu@email.com"
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  setErroAuth("");
                }}
                required
              />
            </label>

            <label>
              <span>Senha</span>
              <input
                type="password"
                className="input-dark"
                placeholder={
                  modoAuth === "cadastro"
                    ? "Crie uma senha (mín. 4 caracteres)"
                    : "Digite sua senha"
                }
                value={senhaInput}
                onChange={(e) => {
                  setSenhaInput(e.target.value);
                  setErroAuth("");
                }}
                required
              />
            </label>

            {erroAuth && (
              <div
                style={{
                  background: "rgba(244, 63, 94, 0.14)",
                  border: "1px solid rgba(244, 63, 94, 0.35)",
                  color: "#fb7185",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  fontSize: "0.84rem",
                }}
              >
                {erroAuth}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              style={{ marginTop: "6px", width: "100%" }}
            >
              {modoAuth === "login" ? "Entrar no Painel" : "Criar Conta e Entrar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

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
                <span>Olá, {usuarioLogado.nome} • AWS Amplify em tempo real</span>
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
            <button
              type="button"
              className="btn-ghost"
              onClick={handleLogout}
              style={{ color: "#fb7185", borderColor: "rgba(244, 63, 94, 0.3)" }}
            >
              Sair
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
