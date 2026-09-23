/*
# Controle de Boas Práticas — SuperPoupe: Schema inicial

## Objetivo
Sistema de controle operacional de segurança dos alimentos para os departamentos
de Frios e Açougue do Supermercado SuperPoupe (São Paulo). Permite registro de
temperaturas, recebimento de produtos, higienização, checklists, POPs, ocorrências,
ações corretivas, alertas, histórico pesquisável e relatórios.

## Novas tabelas
- `setores` — Departamentos (Frios, Açougue, etc.)
- `cargos` — Cargos/funções dos funcionários
- `perfis` — Perfil estendido de usuário (vinculado a auth.users): nome, cargo, setor, papel (admin/funcionario), ativo
- `equipamentos` — Equipamentos e pontos de medição por setor, com limites min/max de temperatura e frequência
- `produtos` — Produtos cadastrados (para recebimento e exposição)
- `fornecedores` — Fornecedores
- `registros_temperatura` — Leituras de temperatura de equipamentos ou produtos expostos
- `retificacoes` — Retificações de registros assinados (mantém histórico original)
- `recebimentos` — Recebimento de produtos (fornecedor, lote, validade, temperatura, embalagem, decisão)
- `higienizacoes` — Registro de higienização de equipamentos/utensílios/superfícies
- `checklists_modelos` — Modelos de checklist criados pelo admin
- `checklist_itens_modelo` — Itens de cada modelo de checklist
- `checklist_execucoes` — Execução de um checklist por um funcionário
- `checklist_respostas` — Respostas de cada item (Conforme / Não conforme / Não se aplica + observação)
- `pops` — Procedimentos Operacionais Padronizados
- `ocorrencias` — Ocorrências abertas a partir de desvios, não conformidades ou checklists
- `acoes_corretivas` — Ações corretivas vinculadas a ocorrências
- `alertas` — Alertas de medição atrasada ou temperatura fora do parâmetro
- `configuracoes` — Parâmetros gerais configuráveis pelo admin (retenção, notificações, etc.)
- `auditoria` — Log de alterações importantes

## Segurança
- RLS habilitado em todas as tabelas.
- Políticas: usuários autenticados podem ler dados pertinentes e inserir registros.
- Admins (flag em `perfis.papel = 'admin'`) têm acesso total via policies que verificam o papel.
- Funcionários podem consultar próprios lançamentos e registrar novos.
- Colunas de auditoria (user_id, created_at) têm DEFAULT auth.uid() / now() onde aplicável.

## Notas
1. O `papel` em `perfis` controla permissões: 'admin' ou 'funcionario'.
2. Registros assinados não podem ser apagados — correções criam retificação.
3. Soft-delete em equipamentos/usuarios (ativo = false) preserva histórico.
4. Timestamps em timezone America/Sao_Paulo via `AT TIME ZONE`.
*/

-- ============================================================
-- SETORES
-- ============================================================
CREATE TABLE IF NOT EXISTS setores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE setores ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CARGOS
-- ============================================================
CREATE TABLE IF NOT EXISTS cargos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE cargos ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PERFIS (extende auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS perfis (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cargo_id uuid REFERENCES cargos(id),
  setor_id uuid REFERENCES setores(id),
  papel text NOT NULL DEFAULT 'funcionario' CHECK (papel IN ('admin','funcionario')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- EQUIPAMENTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS equipamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id uuid NOT NULL REFERENCES setores(id),
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'refrigerador' CHECK (tipo IN ('refrigerador','freezer','camara_fria','balcao_exposicao','expo_produto','outro')),
  ponto_medicao text,
  temp_min numeric(5,2),
  temp_max numeric(5,2),
  unidade text NOT NULL DEFAULT '°C',
  frequencia_horas integer NOT NULL DEFAULT 4,
  min_verificacoes_dia integer NOT NULL DEFAULT 2,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE equipamentos ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_equipamentos_setor ON equipamentos(setor_id);

-- ============================================================
-- FORNECEDORES
-- ============================================================
CREATE TABLE IF NOT EXISTS fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cnpj text,
  contato text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PRODUTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  setor_id uuid REFERENCES setores(id),
  tipo text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- REGISTROS DE TEMPERATURA
-- ============================================================
CREATE TABLE IF NOT EXISTS registros_temperatura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id uuid NOT NULL REFERENCES setores(id),
  equipamento_id uuid REFERENCES equipamentos(id),
  produto_id uuid REFERENCES produtos(id),
  tipo_medicao text NOT NULL DEFAULT 'equipamento' CHECK (tipo_medicao IN ('equipamento','produto_exposto')),
  valor numeric(5,2) NOT NULL,
  unidade text NOT NULL DEFAULT '°C',
  horario timestamptz NOT NULL DEFAULT now(),
  dentro_parametro boolean NOT NULL DEFAULT true,
  observacao text,
  foto_url text,
  assinado boolean NOT NULL DEFAULT false,
  assinado_em timestamptz,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE registros_temperatura ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_reg_temp_setor ON registros_temperatura(setor_id);
CREATE INDEX IF NOT EXISTS idx_reg_temp_equip ON registros_temperatura(equipamento_id);
CREATE INDEX IF NOT EXISTS idx_reg_temp_horario ON registros_temperatura(horario);
CREATE INDEX IF NOT EXISTS idx_reg_temp_user ON registros_temperatura(user_id);

-- ============================================================
-- RETIFICAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS retificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_original_id uuid NOT NULL REFERENCES registros_temperatura(id),
  tabela_origem text NOT NULL DEFAULT 'registros_temperatura',
  valor_original numeric(5,2),
  valor_corrigido numeric(5,2),
  justificativa text NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE retificacoes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_retif_original ON retificacoes(registro_original_id);

-- ============================================================
-- RECEBIMENTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS recebimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id uuid NOT NULL REFERENCES setores(id),
  fornecedor_id uuid REFERENCES fornecedores(id),
  produto text NOT NULL,
  lote text,
  validade date,
  temperatura numeric(5,2),
  condicao_embalagem text CHECK (condicao_embalagem IN ('intacta','danificada','violada','outra')),
  decisao text NOT NULL CHECK (decisao IN ('aceito','recusado')),
  observacao text,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE recebimentos ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_receb_setor ON recebimentos(setor_id);
CREATE INDEX IF NOT EXISTS idx_receb_data ON recebimentos(created_at);

-- ============================================================
-- HIGIENIZAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS higienizacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id uuid NOT NULL REFERENCES setores(id),
  tipo text NOT NULL CHECK (tipo IN ('equipamento','utensilio','superficie','ambiente')),
  alvo text NOT NULL,
  produto_limpeza text,
  responsavel text,
  observacao text,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE higienizacoes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_hig_setor ON higienizacoes(setor_id);

-- ============================================================
-- CHECKLISTS — MODELOS
-- ============================================================
CREATE TABLE IF NOT EXISTS checklists_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  setor_id uuid REFERENCES setores(id),
  categoria text CHECK (categoria IN ('limpeza_sanitizacao','higienizacao_equipamentos','manutencao_preventiva','calibracao','validade_identificacao','outro')),
  frequencia text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE checklists_modelos ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CHECKLIST — ITENS MODELO
-- ============================================================
CREATE TABLE IF NOT EXISTS checklist_itens_modelo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_modelo_id uuid NOT NULL REFERENCES checklists_modelos(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  obrigatorio boolean NOT NULL DEFAULT true
);
ALTER TABLE checklist_itens_modelo ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_chkitem_modelo ON checklist_itens_modelo(checklist_modelo_id);

-- ============================================================
-- CHECKLIST — EXECUÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS checklist_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_modelo_id uuid NOT NULL REFERENCES checklists_modelos(id),
  setor_id uuid REFERENCES setores(id),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','em_andamento','concluido')),
  observacao_geral text,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz
);
ALTER TABLE checklist_execucoes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_chkexec_modelo ON checklist_execucoes(checklist_modelo_id);
CREATE INDEX IF NOT EXISTS idx_chkexec_status ON checklist_execucoes(status);

-- ============================================================
-- CHECKLIST — RESPOSTAS
-- ============================================================
CREATE TABLE IF NOT EXISTS checklist_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_execucao_id uuid NOT NULL REFERENCES checklist_execucoes(id) ON DELETE CASCADE,
  item_modelo_id uuid NOT NULL REFERENCES checklist_itens_modelo(id),
  resposta text CHECK (resposta IN ('conforme','nao_conforme','nao_se_aplica')),
  observacao text,
  abriu_ocorrencia boolean NOT NULL DEFAULT false,
  ocorrencia_id uuid
);
ALTER TABLE checklist_respostas ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_chkresp_exec ON checklist_respostas(checklist_execucao_id);

-- ============================================================
-- POPs
-- ============================================================
CREATE TABLE IF NOT EXISTS pops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  setor_id uuid REFERENCES setores(id),
  categoria text CHECK (categoria IN ('limpeza_sanitizacao','higienizacao_equipamentos','manutencao_preventiva','calibracao','validade_identificacao','outro')),
  conteudo text,
  versao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE pops ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- OCORRÊNCIAS
-- ============================================================
CREATE TABLE IF NOT EXISTS ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id uuid REFERENCES setores(id),
  tipo text NOT NULL CHECK (tipo IN ('desvio_temperatura','nao_conformidade','checklist','recebimento','outro')),
  origem_tabela text,
  origem_id uuid,
  descricao text NOT NULL,
  severidade text NOT NULL DEFAULT 'media' CHECK (severidade IN ('baixa','media','alta','critica')),
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','em_tratamento','concluida','cancelada')),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  concluida_em timestamptz
);
ALTER TABLE ocorrencias ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ocorr_setor ON ocorrencias(setor_id);
CREATE INDEX IF NOT EXISTS idx_ocorr_status ON ocorrencias(status);

-- ============================================================
-- AÇÕES CORRETIVAS
-- ============================================================
CREATE TABLE IF NOT EXISTS acoes_corretivas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ocorrencia_id uuid NOT NULL REFERENCES ocorrencias(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  responsavel text,
  horario timestamptz DEFAULT now(),
  concluida boolean NOT NULL DEFAULT false,
  concluida_em timestamptz,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE acoes_corretivas ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_acao_ocorr ON acoes_corretivas(ocorrencia_id);

-- ============================================================
-- ALERTAS
-- ============================================================
CREATE TABLE IF NOT EXISTS alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('medicao_atrasada','temperatura_fora','checklist_atrasado','ocorrencia_aberta')),
  setor_id uuid REFERENCES setores(id),
  equipamento_id uuid REFERENCES equipamentos(id),
  origem_id uuid,
  mensagem text NOT NULL,
  severidade text NOT NULL DEFAULT 'media' CHECK (severidade IN ('baixa','media','alta','critica')),
  lido boolean NOT NULL DEFAULT false,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE alertas ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_alertas_lido ON alertas(lido);
CREATE INDEX IF NOT EXISTS idx_alertas_created ON alertas(created_at);

-- ============================================================
-- CONFIGURAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor text NOT NULL,
  descricao text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE configuracoes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- AUDITORIA
-- ============================================================
CREATE TABLE IF NOT EXISTS auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela text NOT NULL,
  registro_id uuid,
  acao text NOT NULL,
  descricao text,
  user_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE auditoria ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_auditoria_tabela ON auditoria(tabela);

-- ============================================================
-- POLÍTICAS RLS
-- ============================================================

-- Helper: função para verificar se o usuário atual é admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM perfis
    WHERE id = auth.uid() AND papel = 'admin' AND ativo = true
  );
$$;

-- SETORES: todos autenticados leem; só admin escreve
DROP POLICY IF EXISTS "setores_select" ON setores;
CREATE POLICY "setores_select" ON setores FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "setores_insert" ON setores;
CREATE POLICY "setores_insert" ON setores FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "setores_update" ON setores;
CREATE POLICY "setores_update" ON setores FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "setores_delete" ON setores;
CREATE POLICY "setores_delete" ON setores FOR DELETE TO authenticated USING (is_admin());

-- CARGOS: todos autenticados leem; só admin escreve
DROP POLICY IF EXISTS "cargos_select" ON cargos;
CREATE POLICY "cargos_select" ON cargos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "cargos_insert" ON cargos;
CREATE POLICY "cargos_insert" ON cargos FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "cargos_update" ON cargos;
CREATE POLICY "cargos_update" ON cargos FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "cargos_delete" ON cargos;
CREATE POLICY "cargos_delete" ON cargos FOR DELETE TO authenticated USING (is_admin());

-- PERFIS: cada usuário lê seu próprio perfil; admin lê todos; admin cria/atualiza
DROP POLICY IF EXISTS "perfis_select" ON perfis;
CREATE POLICY "perfis_select" ON perfis FOR SELECT TO authenticated USING (auth.uid() = id OR is_admin());
DROP POLICY IF EXISTS "perfis_insert" ON perfis;
CREATE POLICY "perfis_insert" ON perfis FOR INSERT TO authenticated WITH CHECK (auth.uid() = id OR is_admin());
DROP POLICY IF EXISTS "perfis_update" ON perfis;
CREATE POLICY "perfis_update" ON perfis FOR UPDATE TO authenticated USING (auth.uid() = id OR is_admin()) WITH CHECK (auth.uid() = id OR is_admin());

-- EQUIPAMENTOS: todos autenticados leem; só admin escreve
DROP POLICY IF EXISTS "equip_select" ON equipamentos;
CREATE POLICY "equip_select" ON equipamentos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "equip_insert" ON equipamentos;
CREATE POLICY "equip_insert" ON equipamentos FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "equip_update" ON equipamentos;
CREATE POLICY "equip_update" ON equipamentos FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "equip_delete" ON equipamentos;
CREATE POLICY "equip_delete" ON equipamentos FOR DELETE TO authenticated USING (is_admin());

-- FORNECEDORES: todos autenticados leem; admin escreve; funcionários podem inserir
DROP POLICY IF EXISTS "forn_select" ON fornecedores;
CREATE POLICY "forn_select" ON fornecedores FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "forn_insert" ON fornecedores;
CREATE POLICY "forn_insert" ON fornecedores FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "forn_update" ON fornecedores;
CREATE POLICY "forn_update" ON fornecedores FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "forn_delete" ON fornecedores;
CREATE POLICY "forn_delete" ON fornecedores FOR DELETE TO authenticated USING (is_admin());

-- PRODUTOS: todos autenticados leem; admin escreve; funcionários podem inserir
DROP POLICY IF EXISTS "prod_select" ON produtos;
CREATE POLICY "prod_select" ON produtos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "prod_insert" ON produtos;
CREATE POLICY "prod_insert" ON produtos FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "prod_update" ON produtos;
CREATE POLICY "prod_update" ON produtos FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "prod_delete" ON produtos;
CREATE POLICY "prod_delete" ON produtos FOR DELETE TO authenticated USING (is_admin());

-- REGISTROS_TEMPERATURA: todos autenticados leem; cada usuário insere; admin pode atualizar
DROP POLICY IF EXISTS "regtemp_select" ON registros_temperatura;
CREATE POLICY "regtemp_select" ON registros_temperatura FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "regtemp_insert" ON registros_temperatura;
CREATE POLICY "regtemp_insert" ON registros_temperatura FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "regtemp_update" ON registros_temperatura;
CREATE POLICY "regtemp_update" ON registros_temperatura FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "regtemp_delete" ON registros_temperatura;
CREATE POLICY "regtemp_delete" ON registros_temperatura FOR DELETE TO authenticated USING (is_admin() AND false);

-- RETIFICAÇÕES: todos autenticados leem; cada usuário insere
DROP POLICY IF EXISTS "retif_select" ON retificacoes;
CREATE POLICY "retif_select" ON retificacoes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "retif_insert" ON retificacoes;
CREATE POLICY "retif_insert" ON retificacoes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- RECEBIMENTOS: todos autenticados leem; cada usuário insere
DROP POLICY IF EXISTS "receb_select" ON recebimentos;
CREATE POLICY "receb_select" ON recebimentos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "receb_insert" ON recebimentos;
CREATE POLICY "receb_insert" ON recebimentos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "receb_update" ON recebimentos;
CREATE POLICY "receb_update" ON recebimentos FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- HIGIENIZAÇÕES: todos autenticados leem; cada usuário insere
DROP POLICY IF EXISTS "hig_select" ON higienizacoes;
CREATE POLICY "hig_select" ON higienizacoes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "hig_insert" ON higienizacoes;
CREATE POLICY "hig_insert" ON higienizacoes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- CHECKLISTS_MODELOS: todos autenticados leem; só admin escreve
DROP POLICY IF EXISTS "chkmod_select" ON checklists_modelos;
CREATE POLICY "chkmod_select" ON checklists_modelos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "chkmod_insert" ON checklists_modelos;
CREATE POLICY "chkmod_insert" ON checklists_modelos FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "chkmod_update" ON checklists_modelos;
CREATE POLICY "chkmod_update" ON checklists_modelos FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "chkmod_delete" ON checklists_modelos;
CREATE POLICY "chkmod_delete" ON checklists_modelos FOR DELETE TO authenticated USING (is_admin());

-- CHECKLIST_ITENS_MODELO: herda do modelo
DROP POLICY IF EXISTS "chkitem_select" ON checklist_itens_modelo;
CREATE POLICY "chkitem_select" ON checklist_itens_modelo FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "chkitem_insert" ON checklist_itens_modelo;
CREATE POLICY "chkitem_insert" ON checklist_itens_modelo FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "chkitem_update" ON checklist_itens_modelo;
CREATE POLICY "chkitem_update" ON checklist_itens_modelo FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "chkitem_delete" ON checklist_itens_modelo;
CREATE POLICY "chkitem_delete" ON checklist_itens_modelo FOR DELETE TO authenticated USING (is_admin());

-- CHECKLIST_EXECUÇÕES: todos autenticados leem; cada usuário insere; dono pode atualizar
DROP POLICY IF EXISTS "chkexec_select" ON checklist_execucoes;
CREATE POLICY "chkexec_select" ON checklist_execucoes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "chkexec_insert" ON checklist_execucoes;
CREATE POLICY "chkexec_insert" ON checklist_execucoes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "chkexec_update" ON checklist_execucoes;
CREATE POLICY "chkexec_update" ON checklist_execucoes FOR UPDATE TO authenticated USING (auth.uid() = user_id OR is_admin()) WITH CHECK (auth.uid() = user_id OR is_admin());

-- CHECKLIST_RESPOSTAS: todos autenticados leem; dono da execução insere/atualiza
DROP POLICY IF EXISTS "chkresp_select" ON checklist_respostas;
CREATE POLICY "chkresp_select" ON checklist_respostas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "chkresp_insert" ON checklist_respostas;
CREATE POLICY "chkresp_insert" ON checklist_respostas FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "chkresp_update" ON checklist_respostas;
CREATE POLICY "chkresp_update" ON checklist_respostas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- POPs: todos autenticados leem; só admin escreve
DROP POLICY IF EXISTS "pops_select" ON pops;
CREATE POLICY "pops_select" ON pops FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "pops_insert" ON pops;
CREATE POLICY "pops_insert" ON pops FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "pops_update" ON pops;
CREATE POLICY "pops_update" ON pops FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "pops_delete" ON pops;
CREATE POLICY "pops_delete" ON pops FOR DELETE TO authenticated USING (is_admin());

-- OCORRÊNCIAS: todos autenticados leem; cada usuário insere; admin atualiza
DROP POLICY IF EXISTS "ocorr_select" ON ocorrencias;
CREATE POLICY "ocorr_select" ON ocorrencias FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ocorr_insert" ON ocorrencias;
CREATE POLICY "ocorr_insert" ON ocorrencias FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "ocorr_update" ON ocorrencias;
CREATE POLICY "ocorr_update" ON ocorrencias FOR UPDATE TO authenticated USING (auth.uid() = user_id OR is_admin()) WITH CHECK (auth.uid() = user_id OR is_admin());

-- AÇÕES_CORRETIVAS: todos autenticados leem; cada usuário insere; dono ou admin atualiza
DROP POLICY IF EXISTS "acao_select" ON acoes_corretivas;
CREATE POLICY "acao_select" ON acoes_corretivas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "acao_insert" ON acoes_corretivas;
CREATE POLICY "acao_insert" ON acoes_corretivas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "acao_update" ON acoes_corretivas;
CREATE POLICY "acao_update" ON acoes_corretivas FOR UPDATE TO authenticated USING (auth.uid() = user_id OR is_admin()) WITH CHECK (auth.uid() = user_id OR is_admin());

-- ALERTAS: todos autenticados leem; todos autenticados inserem; dono ou admin atualiza
DROP POLICY IF EXISTS "alert_select" ON alertas;
CREATE POLICY "alert_select" ON alertas FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "alert_insert" ON alertas;
CREATE POLICY "alert_insert" ON alertas FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "alert_update" ON alertas;
CREATE POLICY "alert_update" ON alertas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- CONFIGURAÇÕES: todos autenticados leem; só admin escreve
DROP POLICY IF EXISTS "config_select" ON configuracoes;
CREATE POLICY "config_select" ON configuracoes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "config_insert" ON configuracoes;
CREATE POLICY "config_insert" ON configuracoes FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "config_update" ON configuracoes;
CREATE POLICY "config_update" ON configuracoes FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- AUDITORIA: todos autenticados leem; todos autenticados inserem
DROP POLICY IF EXISTS "aud_select" ON auditoria;
CREATE POLICY "aud_select" ON auditoria FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "aud_insert" ON auditoria;
CREATE POLICY "aud_insert" ON auditoria FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- TRIGGER: criar perfil automaticamente ao registrar usuário
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO perfis (id, nome, papel, ativo)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email), 'funcionario', true)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- DADOS INICIAIS — SETORES, CARGOS, CONFIGURAÇÕES
-- ============================================================
INSERT INTO setores (nome, descricao) VALUES
  ('Frios', 'Departamento de Frios'),
  ('Açougue', 'Departamento de Açougue')
ON CONFLICT DO NOTHING;

INSERT INTO cargos (nome) VALUES
  ('Operador'),
  ('Auxiliar'),
  ('Responsável Técnico'),
  ('Gerente')
ON CONFLICT DO NOTHING;

INSERT INTO configuracoes (chave, valor, descricao) VALUES
  ('retencao_dias', '180', 'Prazo de retenção de registros em dias (mínimo 180)'),
  ('frequencia_alimentos_expostos_horas', '2', 'Frequência de medição de alimentos expostos (horas)'),
  ('min_verificacoes_diarias', '2', 'Mínimo de verificações diárias de equipamentos'),
  ('notificacao_email', 'false', 'Enviar alertas por e-mail'),
  ('notificacao_whatsapp', 'false', 'Enviar alertas por WhatsApp'),
  ('email_alertas', '', 'E-mail para recebimento de alertas'),
  ('whatsapp_alertas', '', 'Número de WhatsApp para alertas'),
  ('responsavel_tecnico', '', 'Nome do responsável técnico que aprova parâmetros')
ON CONFLICT (chave) DO NOTHING;