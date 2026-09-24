/*
# SuperPoupe — proteção de dados e controles operacionais CVS 03/2026

1. Objetivo
- Corrige permissões que permitiam alterar papéis, respostas de outros usuários e alertas de terceiros.
- Garante que a situação da temperatura seja calculada no banco.
- Evita ocorrências duplicadas em checklists.
- Cria um registro operacional flexível para os novos controles exigidos pelo relatório técnico.

2. Nova tabela
- `controles_operacionais`: registros de saúde e exames, higiene pessoal, treinamentos,
  fornecedores, recebimento, identificação, descongelamento, preparo, alergênicos,
  exposição, rotulagem, produtos a granel, doações, suspeitas de surtos, transporte,
  água, resíduos, pragas, rastreabilidade, recolhimento e documentos.
- `categoria` identifica o módulo; `titulo`, `descricao`, `status`, `data_evento`,
  `responsavel`, `lote`, `validade`, `temperatura`, `origem`, `destino` e `observacao`
  armazenam os dados do controle sem perder histórico.

3. Integridade e segurança
- O papel e o status ativo do perfil não podem ser alterados pelo próprio usuário.
- Alterações administrativas de perfil passam por uma função protegida.
- Respostas de checklist ficam limitadas ao responsável pela execução ou administrador.
- Alertas só podem ser criados/alterados pelo criador ou administrador.
- `dentro_parametro` de temperatura é recalculado no banco usando os limites do equipamento.
- Uma execução de checklist não pode criar a mesma ocorrência duas vezes.
- Todas as tabelas novas têm RLS e políticas separadas de leitura, criação, alteração e exclusão.
*/

CREATE TABLE IF NOT EXISTS controles_operacionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria text NOT NULL CHECK (categoria IN (
    'saude_funcionarios','higiene_pessoal','treinamento','fornecedores','recebimento',
    'temperatura_conservacao','identificacao_rastreabilidade','descongelamento','preparo',
    'alergenicos','exposicao','rotulagem','produtos_granel','doacoes','suspeita_surto',
    'transporte','higienizacao_manutencao','agua_residuos_pragas','documentos_registros',
    'recolhimento'
  )),
  titulo text NOT NULL,
  descricao text,
  status text NOT NULL DEFAULT 'registrado' CHECK (status IN ('registrado','pendente','conforme','nao_conforme','em_tratamento','concluido','cancelado')),
  data_evento date NOT NULL DEFAULT CURRENT_DATE,
  responsavel text,
  lote text,
  validade date,
  temperatura numeric(5,2),
  origem text,
  destino text,
  observacao text,
  setor_id uuid REFERENCES setores(id),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE controles_operacionais ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_controles_operacionais_categoria ON controles_operacionais(categoria);
CREATE INDEX IF NOT EXISTS idx_controles_operacionais_data ON controles_operacionais(data_evento);
CREATE INDEX IF NOT EXISTS idx_controles_operacionais_setor ON controles_operacionais(setor_id);

DROP POLICY IF EXISTS "controles_select" ON controles_operacionais;
CREATE POLICY "controles_select" ON controles_operacionais FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "controles_insert" ON controles_operacionais;
CREATE POLICY "controles_insert" ON controles_operacionais FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "controles_update" ON controles_operacionais;
CREATE POLICY "controles_update" ON controles_operacionais FOR UPDATE TO authenticated USING (auth.uid() = user_id OR is_admin()) WITH CHECK (auth.uid() = user_id OR is_admin());
DROP POLICY IF EXISTS "controles_delete" ON controles_operacionais;
CREATE POLICY "controles_delete" ON controles_operacionais FOR DELETE TO authenticated USING (auth.uid() = user_id OR is_admin());

-- Impede autoelevação de privilégios via alteração do próprio perfil.
REVOKE UPDATE ON perfis FROM authenticated;
GRANT UPDATE (nome, cargo_id, setor_id) ON perfis TO authenticated;
DROP POLICY IF EXISTS "perfis_update" ON perfis;
CREATE POLICY "perfis_update" ON perfis FOR UPDATE TO authenticated
  USING (auth.uid() = id OR is_admin())
  WITH CHECK (auth.uid() = id OR is_admin());

CREATE OR REPLACE FUNCTION admin_update_perfil(
  target_id uuid,
  target_nome text,
  target_cargo_id uuid,
  target_setor_id uuid,
  target_papel text,
  target_ativo boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  UPDATE perfis
  SET nome = target_nome,
      cargo_id = target_cargo_id,
      setor_id = target_setor_id,
      papel = target_papel,
      ativo = target_ativo
  WHERE id = target_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION admin_update_perfil(uuid,text,uuid,uuid,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_update_perfil(uuid,text,uuid,uuid,text,boolean) TO authenticated;

-- Respostas só podem acompanhar a execução do próprio usuário ou de um admin.
DROP POLICY IF EXISTS "chkresp_insert" ON checklist_respostas;
CREATE POLICY "chkresp_insert" ON checklist_respostas FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM checklist_execucoes ce WHERE ce.id = checklist_execucao_id AND (ce.user_id = auth.uid() OR is_admin()))
);
DROP POLICY IF EXISTS "chkresp_update" ON checklist_respostas;
CREATE POLICY "chkresp_update" ON checklist_respostas FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM checklist_execucoes ce WHERE ce.id = checklist_execucao_id AND (ce.user_id = auth.uid() OR is_admin()))
) WITH CHECK (
  EXISTS (SELECT 1 FROM checklist_execucoes ce WHERE ce.id = checklist_execucao_id AND (ce.user_id = auth.uid() OR is_admin()))
);

-- Alertas deixam de ser uma caixa de mensagens manipulável por qualquer usuário.
DROP POLICY IF EXISTS "alert_insert" ON alertas;
CREATE POLICY "alert_insert" ON alertas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR is_admin());
DROP POLICY IF EXISTS "alert_update" ON alertas;
CREATE POLICY "alert_update" ON alertas FOR UPDATE TO authenticated USING (auth.uid() = user_id OR is_admin()) WITH CHECK (auth.uid() = user_id OR is_admin());

-- O banco calcula a conformidade da leitura usando o equipamento relacionado.
CREATE OR REPLACE FUNCTION set_registro_temperatura_conformidade()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  min_temp numeric;
  max_temp numeric;
BEGIN
  IF NEW.equipamento_id IS NULL THEN
    NEW.dentro_parametro := true;
    RETURN NEW;
  END IF;
  SELECT temp_min, temp_max INTO min_temp, max_temp FROM equipamentos WHERE id = NEW.equipamento_id;
  NEW.dentro_parametro := min_temp IS NULL OR max_temp IS NULL OR (NEW.valor >= min_temp AND NEW.valor <= max_temp);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_registro_temperatura_conformidade ON registros_temperatura;
CREATE TRIGGER trg_registro_temperatura_conformidade
BEFORE INSERT OR UPDATE OF valor, equipamento_id ON registros_temperatura
FOR EACH ROW EXECUTE FUNCTION set_registro_temperatura_conformidade();

CREATE UNIQUE INDEX IF NOT EXISTS idx_ocorrencia_origem_tipo
ON ocorrencias (origem_tabela, origem_id, tipo)
WHERE origem_id IS NOT NULL;

-- O próprio usuário só pode ler seu perfil; administradores continuam vendo a equipe.
-- A política já existente continua válida e passa a depender de um papel protegido.
