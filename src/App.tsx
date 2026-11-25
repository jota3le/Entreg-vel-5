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

  async function handleAdicionarVenda(e: Form
