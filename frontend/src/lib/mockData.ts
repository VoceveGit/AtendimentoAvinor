import type { Client } from "./types";

const today = new Date().toISOString().slice(0, 10);
const yday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

const GIRLS = [
  { id: 1071, nome: "Poliana" },
  { id: 1072, nome: "Fernanda" },
  { id: 1073, nome: "Karolline" },
];

function rec(
  id: number,
  nome: string,
  cidade: string,
  rota: string,
  tel: string,
  dias: number,
  girl: number,
  nivel: Client["nivel"],
): Client {
  const g = GIRLS[girl % 3];
  const offers = [
    [
      { nome: "Farinha de trigo 1kg", valor: 186 },
      { nome: "Óleo de soja 900ml", valor: 142 },
      { nome: "Açúcar cristal 1kg", valor: 98 },
    ],
    [
      { nome: "Arroz tipo 1 5kg", valor: 240 },
      { nome: "Feijão carioca 1kg", valor: 121 },
      { nome: "Macarrão espaguete", valor: 87 },
    ],
    [
      { nome: "Café torrado 500g", valor: 165 },
      { nome: "Leite integral 1L", valor: 134 },
      { nome: "Biscoito cream cracker", valor: 76 },
    ],
  ];
  return {
    id,
    nome,
    cidade,
    rota_nome: rota,
    telefone: tel,
    dias_sem_contato: dias,
    ultima_compra: daysAgo(dias),
    fat_12m: Math.max(400, 18000 - dias * 55 - (id % 9) * 310),
    fat_total: Math.max(900, 26000 - dias * 40),
    n_compras: 4 + (id % 8),
    nivel,
    origem: "recuperacao",
    assigned_vendedor_id: g.id,
    assigned_vendedor_nome: g.nome,
    vendedor_id: g.id,
    vendedor_nome: g.nome,
    endereco: `${cidade} · ${rota}`,
    produtos_top: offers[id % 3],
  };
}

export const MOCK_RECOVERY: Client[] = [
  rec(9001, "Mercado Preço Bom", "Vitória da Conquista", "VDC LESTE", "(77) 98800-1000", 31, 0, "31_60"),
  rec(9002, "Padaria Trigo Dourado", "Jequié", "JEQUIÉ", "(73) 98801-1007", 33, 1, "31_60"),
  rec(9003, "Hortifruti da Praça", "Poções", "POÇÕES", "(77) 98802-1012", 35, 2, "31_60"),
  rec(9004, "Açougue Boi Forte", "Itapetinga", "ITAPETINGA", "(77) 98803-1020", 38, 0, "31_60"),
  rec(9005, "Mercearia São José", "Brumado", "BRUMADO", "(77) 98804-1033", 41, 1, "31_60"),
  rec(9006, "Empório da Serra", "Anagé", "ANAGÉ", "(77) 98805-1044", 44, 2, "31_60"),
  rec(9007, "Supermercado Lima", "Belo Campo", "BELO CAMPO", "(77) 98806-1055", 48, 0, "31_60"),
  rec(9008, "Casa da Farinha", "Itambé", "ITAPETINGA", "(77) 98807-1066", 52, 1, "31_60"),
  rec(9009, "Bar e Restaurante Sol", "Barra do Choça", "BARRA DO CHOÇA", "(77) 98808-1077", 55, 2, "31_60"),
  rec(9010, "Mercadinho Central", "Planalto", "POÇÕES", "(77) 98809-1088", 58, 0, "31_60"),
  rec(9011, "Mini Mercado Beira Rio", "Vitória da Conquista", "VDC OESTE", "(77) 98700-2000", 61, 1, "61_90"),
  rec(9012, "Rest. do Vale", "Barra do Choça", "BARRA DO CHOÇA", "(77) 98701-2011", 62, 2, "61_90"),
  rec(9013, "Padaria Aurora", "Jaguaquara", "JAGUAQUARA", "(73) 98702-2022", 67, 0, "61_90"),
  rec(9014, "Atacado do Povo", "Poções", "POÇÕES", "(77) 98703-2033", 70, 1, "61_90"),
  rec(9015, "Churrascaria Estrela", "Maracás", "JAGUAQUARA", "(73) 98704-2044", 73, 2, "61_90"),
  rec(9016, "Empório Mineiro", "Itapetinga", "ITAPETINGA", "(77) 98705-2055", 76, 0, "61_90"),
  rec(9017, "Supermercado Rocha", "Jequié", "JEQUIÉ", "(73) 98706-2066", 80, 1, "61_90"),
  rec(9018, "Mercearia da Ponte", "Mirante", "MIRANTE", "(77) 98707-2077", 83, 2, "61_90"),
  rec(9019, "Hortifruti Verde", "Brumado", "BRUMADO", "(77) 98708-2088", 86, 0, "61_90"),
  rec(9020, "Casa do Frango", "Guanambi", "GUANAMBI", "(77) 98709-2099", 89, 1, "61_90"),
  rec(9021, "Cliente Antigo 1", "Vitória da Conquista", "VDC LESTE", "(77) 98600-3000", 95, 2, "90_mais"),
  rec(9022, "Cliente Antigo 2", "Jequié", "JEQUIÉ", "(73) 98601-3003", 100, 0, "90_mais"),
  rec(9023, "Depósito São Pedro", "Iguaí", "IBICUÍ", "(73) 98602-3011", 108, 1, "90_mais"),
  rec(9024, "Mercado Esperança", "Jaguaquara", "JAGUAQUARA", "(73) 98603-3022", 120, 2, "90_mais"),
  rec(9025, "Padaria Nova", "Poções", "POÇÕES", "(77) 98604-3033", 132, 0, "90_mais"),
  rec(9026, "Açougue do Zé", "Itambé", "ITAPETINGA", "(77) 98605-3044", 145, 1, "90_mais"),
  rec(9027, "Empório Tropical", "Ilhéus", "SUL DA BAHIA", "(73) 98606-3055", 160, 2, "90_mais"),
  rec(9028, "Mini Box da Feira", "Brumado", "BRUMADO", "(77) 98607-3066", 180, 0, "90_mais"),
  rec(9029, "Restaurante Sabor", "Belo Campo", "BELO CAMPO", "(77) 98608-3077", 210, 1, "90_mais"),
  rec(9030, "Mercearia do Cruzeiro", "Anagé", "ANAGÉ", "(77) 98609-3088", 240, 2, "90_mais"),
];

export const MOCK_FINALIZED = [
  {
    id: 1,
    cliente_id: 1,
    cliente_nome: "Supermercado Boa Vista",
    dia: today,
    vendedor_nome: "Poliana",
    origem: "carteira",
    situacao: "Da carteira",
    kind: "finalizado",
    codigo_pedido: "78221",
    valor_total: 2340.5,
    itens: [
      { produto: "AV-100", descricao: "Peito frango 1kg", qtd: 20, valor: 480 },
      { produto: "AV-220", descricao: "Coxa com sobrecoxa", qtd: 15, valor: 420 },
      { produto: "AV-305", descricao: "Linguiça defumada", qtd: 10, valor: 310 },
      { produto: "AV-410", descricao: "Ovos cartela 30un", qtd: 12, valor: 216 },
      { produto: "AV-118", descricao: "Peito desossado", qtd: 8, valor: 914.5 },
    ],
    synced: true,
    cidade: "Vitória da Conquista",
    rota_nome: "VDC LESTE",
    data_pedido: today,
    data_emissao: today,
    created_by: "Poliana",
    created_at: `${today}T08:12:00`,
    updated_at: `${today}T08:47:00`,
  },
  {
    id: 2,
    cliente_id: 2,
    cliente_nome: "Padaria São José",
    dia: today,
    vendedor_nome: "Fernanda",
    origem: "carteira",
    situacao: "Da carteira",
    kind: "finalizado",
    codigo_pedido: "78222",
    valor_total: 820,
    itens: [
      { produto: "AV-100", descricao: "Peito frango 1kg", qtd: 8, valor: 192 },
      { produto: "AV-410", descricao: "Ovos cartela 30un", qtd: 20, valor: 360 },
      { produto: "AV-305", descricao: "Linguiça defumada", qtd: 6, valor: 186 },
      { produto: "AV-090", descricao: "Moela congelada", qtd: 4, valor: 82 },
    ],
    synced: true,
    cidade: "Jequié",
    rota_nome: "JEQUIÉ",
    data_pedido: today,
    created_by: "Fernanda",
    created_at: `${today}T08:30:00`,
    updated_at: `${today}T08:58:00`,
  },
  {
    id: 3,
    cliente_id: 3,
    cliente_nome: "Mercearia Castro",
    dia: today,
    vendedor_nome: "Poliana",
    origem: "recuperacao",
    situacao: "Recuperado",
    kind: "finalizado",
    codigo_pedido: "78224",
    valor_total: 1120,
    itens: [],
    synced: false,
    cidade: "Poções",
    rota_nome: "POÇÕES",
    created_by: "Poliana",
    created_at: `${today}T09:05:00`,
    updated_at: `${today}T09:22:00`,
  },
  {
    id: 4,
    cliente_id: 4,
    cliente_nome: "Rest. Fogão a Lenha",
    dia: today,
    vendedor_nome: "Karolline",
    origem: "recuperacao",
    situacao: "Recuperado",
    kind: "finalizado",
    codigo_pedido: "78228",
    valor_total: 1980,
    itens: [
      { produto: "AV-220", descricao: "Coxa com sobrecoxa", qtd: 25, valor: 700 },
      { produto: "AV-305", descricao: "Linguiça defumada", qtd: 18, valor: 558 },
      { produto: "AV-100", descricao: "Peito frango 1kg", qtd: 30, valor: 722 },
    ],
    synced: true,
    cidade: "Itapetinga",
    rota_nome: "ITAPETINGA",
    created_by: "Karolline",
    created_at: `${today}T09:40:00`,
    updated_at: `${today}T10:05:00`,
  },
  {
    id: 5,
    cliente_id: 5,
    cliente_nome: "Hortifruti Verdes Vales",
    dia: today,
    vendedor_nome: "Fernanda",
    origem: "carteira",
    situacao: "Da carteira",
    kind: "finalizado",
    codigo_pedido: "78231",
    valor_total: 450,
    itens: [],
    synced: false,
    cidade: "Barra do Choça",
    rota_nome: "BARRA DO CHOÇA",
    created_by: "Fernanda",
    created_at: `${today}T10:12:00`,
    updated_at: `${today}T10:28:00`,
  },
];

const HEAT: number[][] = [
  [4, 8, 12, 18, 9, 7, 11, 16, 10, 18],
  [3, 6, 18, 8, 15, 13, 9, 18, 16, 18],
  [16, 10, 7, 5, 16, 16, 19, 10, 17, 18],
  [19, 11, 8, 19, 14, 17, 15, 19, 12, 18],
  [13, 14, 16, 13, 8, 12, 9, 15, 11, 18],
  [2, 16, 14, 6, 13, 4, 8, 7, 5, 18],
];

const MOCK_CLIENTES = [
  ["Mercado Preço Bom", "Vitória da Conquista", "VDC LESTE"],
  ["Padaria Aurora", "Jaguaquara", "JAGUAQUARA"],
  ["Mini Mercado Beira Rio", "Vitória da Conquista", "VDC OESTE"],
  ["Rest. do Vale", "Barra do Choça", "BARRA DO CHOÇA"],
  ["Hortifruti da Praça", "Poções", "POÇÕES"],
  ["Açougue Boi Forte", "Itapetinga", "ITAPETINGA"],
  ["Mercearia São José", "Brumado", "BRUMADO"],
  ["Supermercado Lima", "Belo Campo", "BELO CAMPO"],
  ["Casa da Farinha", "Itambé", "ITAPETINGA"],
  ["Empório da Serra", "Anagé", "ANAGÉ"],
];

export const MOCK_MOTIVOS = [
  "Preço alto",
  "Comprou com o concorrente",
  "Sem demanda no momento",
  "Problema de crédito",
  "Mudou de ramo / fechou",
  "Prazo ou entrega",
  "Cliente viajando",
  "Estoque cheio",
];

function isoOnWeekday(di: number, hour: number, minute: number, weekOffset = 0) {
  for (let n = 1 + weekOffset * 7; n <= 28; n++) {
    const d = new Date(Date.now() - n * 86400000);
    const js = d.getDay();
    const ours = js === 0 ? -1 : js - 1;
    if (ours === di) {
      d.setHours(hour, minute, 0, 0);
      return d.toISOString();
    }
  }
  return new Date().toISOString();
}

function buildMockEventos() {
  const out: {
    id: number;
    cliente_nome: string;
    cidade: string;
    rota_nome: string;
    vendedor_id: number;
    vendedor_nome: string;
    kind: "finalizado" | "nao_venda" | "nao_recuperado";
    motivo?: string;
    valor_total?: number;
    origem: "carteira" | "recuperacao";
    created_at: string;
    updated_at: string;
  }[] = [];
  let id = 1;
  HEAT.forEach((row, di) => {
    row.forEach((n, hi) => {
      const count = Math.max(1, Math.round(n / 3));
      for (let k = 0; k < count; k++) {
        const girl = GIRLS[(id + di + hi) % 3];
        const cli = MOCK_CLIENTES[id % MOCK_CLIENTES.length];
        const start = isoOnWeekday(di, 8 + hi, 4 + ((k * 7) % 50), k % 3);
        const mins = 8 + ((id * 5) % 32);
        const end = new Date(new Date(start).getTime() + mins * 60000).toISOString();
        out.push({
          id: id++,
          cliente_nome: `${cli[0]} ${id}`,
          cidade: cli[1],
          rota_nome: cli[2],
          vendedor_id: girl.id,
          vendedor_nome: girl.nome,
          kind: "finalizado",
          valor_total: 180 + ((id * 37) % 900),
          origem: id % 5 === 0 ? "recuperacao" : "carteira",
          created_at: start,
          updated_at: end,
        });
      }
    });
  });
  const lossCounts = [42, 31, 24, 11, 8, 6];
  lossCounts.forEach((n, mi) => {
    for (let i = 0; i < n; i++) {
      const girl = GIRLS[(id + i) % 3];
      const cli = MOCK_CLIENTES[(id + i) % MOCK_CLIENTES.length];
      const di = (mi + i) % 6;
      const hi = (i * 3 + mi) % 10;
      const start = isoOnWeekday(di, 8 + hi, 10 + (i % 40), 1);
      const end = new Date(new Date(start).getTime() + (6 + (i % 18)) * 60000).toISOString();
      out.push({
        id: id++,
        cliente_nome: `${cli[0]} ${String.fromCharCode(65 + (i % 26))}`,
        cidade: cli[1],
        rota_nome: cli[2],
        vendedor_id: girl.id,
        vendedor_nome: girl.nome,
        kind: mi % 4 === 3 ? "nao_recuperado" : "nao_venda",
        motivo: MOCK_MOTIVOS[mi],
        origem: i % 4 === 0 ? "recuperacao" : "carteira",
        created_at: start,
        updated_at: end,
      });
    }
  });
  return out;
}

export const MOCK_EVENTOS = buildMockEventos();

export const MOCK_ANALYTICS = {
  start: daysAgo(29),
  end: today,
  kpis: {
    fluxo_hoje: 41,
    finalizados: 212,
    nao_venda: 18,
    nao_recuperado: 8,
    nao_atendidos_hoje: 11,
    rec_nao_atendidos_hoje: 12,
    conversao: 89.1,
    valor: 19127,
    ticket: 90.22,
    pedidos: 212,
    recuperados: 42,
    recuperado_valor: 4870,
    pool_recuperacao: 30,
    cobertura: 209,
    encerrados: 238,
    cadastros: 11,
  },
  colaboradoras: GIRLS.map((g) => {
    const mine = MOCK_EVENTOS.filter((e) => e.vendedor_id === g.id);
    const fin = mine.filter((e) => e.kind === "finalizado");
    const loss = mine.filter((e) => e.kind === "nao_venda" || e.kind === "nao_recuperado");
    const rec = fin.filter((e) => e.origem === "recuperacao");
    return {
      id: g.id,
      nome: g.nome,
      finalizado: fin.length,
      valor: Math.round(fin.reduce((s, e) => s + (e.valor_total || 0), 0)),
      recuperados: rec.length,
      nao_venda: loss.length,
      conversao: Math.round((fin.length / Math.max(fin.length + loss.length, 1)) * 100),
    };
  }),
  cidades: [
    { cidade: "Vitória da Conquista", finalizado: 112, nao_venda: 6, valor: 9800 },
    { cidade: "Jequié", finalizado: 48, nao_venda: 4, valor: 3900 },
    { cidade: "Barra do Choça", finalizado: 26, nao_venda: 3, valor: 2100 },
    { cidade: "Itambé", finalizado: 18, nao_venda: 2, valor: 1600 },
    { cidade: "Poções", finalizado: 8, nao_venda: 3, valor: 727 },
  ],
  produtos: [
    { nome: "Peito de frango 1kg", qtd: 1248, valor: 29760 },
    { nome: "Coxa com sobrecoxa", qtd: 980, valor: 24580 },
    { nome: "Linguiça defumada", qtd: 720, valor: 22320 },
    { nome: "Ovos cartela 30un", qtd: 540, valor: 10880 },
    { nome: "Peito desossado", qtd: 418, valor: 14350 },
  ],
  produtos_cidade: [
    { cidade: "Vitória da Conquista", nome: "Peito de frango 1kg", qtd: 620, valor: 14800 },
    { cidade: "Jequié", nome: "Coxa com sobrecoxa", qtd: 310, valor: 7800 },
    { cidade: "Poções", nome: "Linguiça defumada", qtd: 90, valor: 2790 },
  ],
  motivos: [
    { cidade: "Vitória da Conquista", motivo: "Comprou com o concorrente", n: 18 },
    { cidade: "Jequié", motivo: "Preço alto", n: 14 },
    { cidade: "Poções", motivo: "Sem demanda no momento", n: 10 },
    { cidade: "Itambé", motivo: "Mudou de ramo / fechou", n: 6 },
    { cidade: "Barra do Choça", motivo: "Problema de crédito", n: 5 },
    { cidade: "Brumado", motivo: "Prazo ou entrega", n: 4 },
  ],
  motivos_nuvem: [
    { motivo: "Comprou com o concorrente", n: 42 },
    { motivo: "Preço alto", n: 31 },
    { motivo: "Sem demanda no momento", n: 24 },
    { motivo: "Mudou de ramo / fechou", n: 11 },
    { motivo: "Problema de crédito", n: 8 },
    { motivo: "Prazo ou entrega", n: 6 },
  ],
  nao_atendidos: [
    { id: 1071, nome: "Poliana", carteira: 1, recuperacao: 10 },
    { id: 1072, nome: "Fernanda", carteira: 5, recuperacao: 10 },
    { id: 1073, nome: "Karolline", carteira: 5, recuperacao: 10 },
  ],
  dias: Array.from({ length: 30 }, (_, i) => {
    const d = daysAgo(29 - i);
    const win = i === 18;
    const loss = i >= 12 && i <= 15;
    return {
      dia: d,
      finalizado: win ? 13 : loss ? 4 : 7 + ((i * 3) % 6),
      nao_venda: loss ? 8 : i === 18 ? 1 : i % 4 === 0 ? 2 : 0,
      valor: win ? 1250 : loss ? 380 : 600 + (i % 7) * 80,
    };
  }),
  pico_finalizacao: daysAgo(11),
  pico_perda: daysAgo(9),
  heatmap: HEAT,
  recuperacao_faixa: { "31_60": 18, "61_90": 14, "90_mais": 10 },
  closes: [],
  eventos: MOCK_EVENTOS,
};

export const MOCK_DAYS = [
  { id: today, label: `Hoje · ${today.slice(8, 10)}/${today.slice(5, 7)}` },
  { id: yday, label: `Ontem · ${yday.slice(8, 10)}/${yday.slice(5, 7)}` },
];
