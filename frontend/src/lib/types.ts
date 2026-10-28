export type Role = "adm" | "colaborador";

export type Status = {
  id: string;
  label: string;
  color: string;
  order?: number;
  is_system?: boolean;
  is_default?: boolean;
  requires_motivo?: boolean;
};

export type Client = {
  id: number;
  nome: string;
  razao_social?: string;
  endereco: string;
  bairro?: string;
  cidade?: string;
  telefone?: string;
  rota_id?: string | null;
  rota_nome?: string | null;
  enviar_cards?: string | null;
  saida_carga?: string | null;
  ultima_compra?: string | null;
  dias_sem_contato?: number | null;
  fat_12m?: number;
  fat_total?: number;
  n_compras?: number;
  ticket_medio?: number;
  fat_medio_mes?: number;
  produtos_top?: { sku?: string | null; nome: string; valor: number }[];
  streak?: number;
  alto_valor?: boolean;
  status_id?: string | null;
  status?: Status | null;
  data_atendimento?: string | null;
  recontato?: boolean;
  em_recuperacao?: boolean;
  critico?: boolean;
  extra_hoje?: boolean;
  agendado_hoje?: boolean;
  nivel?: "15_30" | "31_60" | "61_90" | "90_mais";
  vendedor_id?: number | null;
  vendedor_nome?: string;
  cpf?: string;
  origem?: "carteira" | "recuperacao";
  assigned_vendedor_id?: number | null;
  assigned_vendedor_nome?: string;
  close_kind?: string;
};

export type Colaboradora = {
  id: number;
  nome: string;
  login: string;
};

export type RouteCard = {
  id: string;
  nome: string;
  enviar_cards?: string;
  saida_carga?: string;
  cidades?: string[];
  clientes?: number;
  biweekly?: boolean;
};
