import { useEffect, useState, type FormEvent } from "react";
import type { Schema } from "../amplify/data/resource";
import { generateClient } from "aws-amplify/data";
import { Authenticator } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";

const client = generateClient<Schema>();

interface DashboardProps {
  userEmail?: string;
  onSignOut: () => void;
}

function formatarMoeda(valor: number): string {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function Dashboard({ userEmail, onSignOut }: DashboardProps) {
  const [vendas, setVendas] = useState<Array<Schema["Venda"]["type"]>>([]);
  const [cliente, setCliente] = useState("");
  const [produto, setProduto] = useState("");
  const [valor, setValor] = useState("");
  const [status, setStatus] = useState("Pago");
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const sub = client.models.Venda.observeQuery().subscribe({
      next: (data) => setVendas([...data.items]),
    });
    return () => sub.unsubscribe();
  }, []);

  async function handleAdicionarVenda(e: FormEvent) {
    e.preventDefault();
    const valorNumerico = Number(valor.replace(",", "."));
    if (!cliente.trim() || !produto.trim() || Number.isNaN(valorNumerico) || valorNumerico <= 0) {
      alert("Preencha cliente, produto e um valor válido.");
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
    } finally {
      setSalvando(false);
    }
  }

  async function handleAlternarStatus(venda: Schema["Venda"]["type"]) {
    const novoStatus = venda.status === "Pago" ? "Pendente" : "Pago";
    await client.models.Venda.update({
      id: venda.id,
      status: novoStatus,
    });
  }

  async function handleExcluir(id: string) {
    await client.models.Venda.delete({ id });
  }

  const vendasFiltradas = vendas.filter(
    (v) =>
      v.cliente.toLowerCase().includes(busca.toLowerCase()) ||
      v.produto.toLowerCase().includes(busca.toLowerCase())
  );

  const faturamentoPago = vendas
    .filter((v) => v.status === "Pago")
    .reduce((acc, v) => acc + v.valor, 0);

  const totalVendas = vendas.length;
  const ticketMedio = totalVendas > 0 ? vendas.reduce((acc, v) => acc + v.valor, 0) / totalVendas : 0;
  const pendentes = vendas.filter((v) => v.status === "Pendente").length;

  return (
    <div className="dashboard-container">
      <header className="topbar">
        <div>
          <h1>Painel de Vendas</h1>
          <p className="subtitle">Gestão em nuvem com AWS Amplify</p>
        </div>
        <div className="user-area">
          <span className="user-badge">{userEmail || "Usuário conectado"}</span>
          <button type="button" className="btn-logout" onClick={onSignOut}>
            Sair
          </button>
        </div>
      </header>

      <section className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Faturamento (Pago)</span>
          <strong className="kpi-value green">{formatarMoeda(faturamentoPago)}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Total de Vendas</span>
          <strong className="kpi-value">{totalVendas}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Ticket Médio</span>
          <strong className="kpi-value">{formatarMoeda(ticketMedio)}</strong>
        </div>
        <div className="kpi-card">
          <span className="kpi-label">Vendas Pendentes</span>
          <strong className="kpi-value amber">{pendentes}</strong>
        </div>
      </section>

      <section className="panel-card">
        <h2>Nova Venda</h2>
        <form className="sales-form" onSubmit={handleAdicionarVenda}>
          <input
            type="text"
            placeholder="Nome do cliente"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Produto ou serviço"
            value={produto}
            onChange={(e) => setProduto(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Valor (ex: 150.00)"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            required
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="Pago">Pago</option>
            <option value="Pendente">Pendente</option>
            <option value="Cancelado">Cancelado</option>
          </select>
          <button type="submit" className="btn-primary" disabled={salvando}>
            {salvando ? "Salvando..." : "+ Registrar Venda"}
          </button>
        </form>
      </section>

      <section className="panel-card">
        <div className="table-header">
          <h2>Histórico de Vendas</h2>
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por cliente ou produto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {vendasFiltradas.length === 0 ? (
          <p className="empty-state">Nenhuma venda registrada ainda.</p>
        ) : (
          <div className="table-wrapper">
            <table className="sales-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Produto</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {vendasFiltradas.map((venda) => (
                  <tr key={venda.id}>
                    <td>{venda.cliente}</td>
                    <td>{venda.produto}</td>
                    <td>{formatarMoeda(venda.valor)}</td>
                    <td>
                      <span className={`status-pill ${venda.status.toLowerCase()}`}>
                        {venda.status}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button
                        type="button"
                        className="btn-small"
                        onClick={() => handleAlternarStatus(venda)}
                      >
                        {venda.status === "Pago" ? "Marcar Pendente" : "Marcar Pago"}
                      </button>
                      <button
                        type="button"
                        className="btn-small danger"
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
    </div>
  );
}

export default function App() {
  return (
    <div className="auth-wrapper">
      <Authenticator>
        {({ signOut, user }) => (
          <Dashboard
            userEmail={user?.signInDetails?.loginId}
            onSignOut={() => signOut?.()}
          />
        )}
      </Authenticator>
    </div>
  );
}
