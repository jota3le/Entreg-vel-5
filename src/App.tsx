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
  const qtdPendente = vendas.filter((v
