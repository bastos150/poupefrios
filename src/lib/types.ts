export type Papel = 'admin' | 'funcionario';

export interface Perfil {
  id: string;
  nome: string;
  cargo_id: string | null;
  setor_id: string | null;
  papel: Papel;
  ativo: boolean;
  created_at: string;
}

export interface Setor {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

export interface Cargo {
  id: string;
  nome: string;
  descricao: string | null;
}

export interface Equipamento {
  id: string;
  setor_id: string;
  nome: string;
  tipo: string;
  ponto_medicao: string | null;
  temp_min: number | null;
  temp_max: number | null;
  unidade: string;
  frequencia_horas: number;
  min_verificacoes_dia: number;
  ativo: boolean;
}

export interface Fornecedor {
  id: string;
  nome: string;
  cnpj: string | null;
  contato: string | null;
  ativo: boolean;
}

export interface Produto {
  id: string;
  nome: string;
  setor_id: string | null;
  tipo: string | null;
  ativo: boolean;
}

export interface RegistroTemperatura {
  id: string;
  setor_id: string;
  equipamento_id: string | null;
  produto_id: string | null;
  tipo_medicao: 'equipamento' | 'produto_exposto';
  valor: number;
  unidade: string;
  horario: string;
  dentro_parametro: boolean;
  observacao: string | null;
  foto_url: string | null;
  assinado: boolean;
  assinado_em: string | null;
  user_id: string;
  created_at: string;
}

export interface Retificacao {
  id: string;
  registro_original_id: string;
  tabela_origem: string;
  valor_original: number | null;
  valor_corrigido: number | null;
  justificativa: string;
  user_id: string;
  created_at: string;
}

export interface Recebimento {
  id: string;
  setor_id: string;
  fornecedor_id: string | null;
  produto: string;
  lote: string | null;
  validade: string | null;
  temperatura: number | null;
  condicao_embalagem: 'intacta' | 'danificada' | 'violada' | 'outra' | null;
  decisao: 'aceito' | 'recusado';
  observacao: string | null;
  user_id: string;
  created_at: string;
}

export interface Higienizacao {
  id: string;
  setor_id: string;
  tipo: 'equipamento' | 'utensilio' | 'superficie' | 'ambiente';
  alvo: string;
  produto_limpeza: string | null;
  responsavel: string | null;
  observacao: string | null;
  user_id: string;
  created_at: string;
}

export interface ChecklistModelo {
  id: string;
  nome: string;
  setor_id: string | null;
  categoria: string | null;
  frequencia: string | null;
  ativo: boolean;
}

export interface ChecklistItemModelo {
  id: string;
  checklist_modelo_id: string;
  descricao: string;
  ordem: number;
  obrigatorio: boolean;
}

export interface ChecklistExecucao {
  id: string;
  checklist_modelo_id: string;
  setor_id: string | null;
  status: 'pendente' | 'em_andamento' | 'concluido' | 'cancelado';
  observacao_geral: string | null;
  user_id: string;
  created_at: string;
  concluido_em: string | null;
}

export interface ChecklistResposta {
  id: string;
  checklist_execucao_id: string;
  item_modelo_id: string;
  resposta: 'conforme' | 'nao_conforme' | 'nao_se_aplica' | null;
  observacao: string | null;
  abriu_ocorrencia: boolean;
  ocorrencia_id: string | null;
}

export interface Pop {
  id: string;
  titulo: string;
  setor_id: string | null;
  categoria: string | null;
  conteudo: string | null;
  versao: string | null;
  ativo: boolean;
}

export interface Ocorrencia {
  id: string;
  setor_id: string | null;
  tipo: string;
  origem_tabela: string | null;
  origem_id: string | null;
  descricao: string;
  severidade: 'baixa' | 'media' | 'alta' | 'critica';
  status: 'aberta' | 'em_tratamento' | 'concluida' | 'cancelada';
  user_id: string;
  created_at: string;
  concluida_em: string | null;
}

export interface AcaoCorretiva {
  id: string;
  ocorrencia_id: string;
  descricao: string;
  responsavel: string | null;
  horario: string;
  concluida: boolean;
  concluida_em: string | null;
  user_id: string;
  created_at: string;
}

export interface Alerta {
  id: string;
  tipo: 'medicao_atrasada' | 'temperatura_fora' | 'checklist_atrasado' | 'ocorrencia_aberta';
  setor_id: string | null;
  equipamento_id: string | null;
  origem_id: string | null;
  mensagem: string;
  severidade: 'baixa' | 'media' | 'alta' | 'critica';
  lido: boolean;
  user_id: string | null;
  created_at: string;
}

export interface Configuracao {
  id: string;
  chave: string;
  valor: string;
  descricao: string | null;
}

export type ControleCategoria =
  | 'saude_funcionarios'
  | 'higiene_pessoal'
  | 'treinamento'
  | 'fornecedores'
  | 'recebimento'
  | 'temperatura_conservacao'
  | 'identificacao_rastreabilidade'
  | 'descongelamento'
  | 'preparo'
  | 'alergenicos'
  | 'exposicao'
  | 'rotulagem'
  | 'produtos_granel'
  | 'doacoes'
  | 'suspeita_surto'
  | 'transporte'
  | 'higienizacao_manutencao'
  | 'agua_residuos_pragas'
  | 'documentos_registros'
  | 'recolhimento';

export interface ControleOperacional {
  id: string;
  categoria: ControleCategoria;
  titulo: string;
  descricao: string | null;
  status: 'registrado' | 'pendente' | 'conforme' | 'nao_conforme' | 'em_tratamento' | 'concluido' | 'cancelado';
  data_evento: string;
  responsavel: string | null;
  lote: string | null;
  validade: string | null;
  temperatura: number | null;
  origem: string | null;
  destino: string | null;
  observacao: string | null;
  setor_id: string | null;
  user_id: string;
  created_at: string;
}
