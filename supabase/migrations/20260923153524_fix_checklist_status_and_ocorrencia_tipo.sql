-- Fix 1: Allow 'cancelado' status in checklist_execucoes
ALTER TABLE checklist_execucoes DROP CONSTRAINT IF EXISTS checklist_execucoes_status_check;
ALTER TABLE checklist_execucoes ADD CONSTRAINT checklist_execucoes_status_check
  CHECK (status IN ('pendente','em_andamento','concluido','cancelado'));

-- Fix 2: Allow 'nao_conformidade' as occurrence type in ocorrencias
ALTER TABLE ocorrencias DROP CONSTRAINT IF EXISTS ocorrencias_tipo_check;
ALTER TABLE ocorrencias ADD CONSTRAINT ocorrencias_tipo_check
  CHECK (tipo IN ('desvio_temperatura','nao_conformidade','checklist','recebimento','outro'));

-- Fix 3: Add Padaria setor if not exists
INSERT INTO setores (nome, descricao)
VALUES ('Padaria', 'Departamento de Padaria')
ON CONFLICT DO NOTHING;

-- Fix 4: Add delete policy for fornecedores (admin only)
DROP POLICY IF EXISTS "forn_delete" ON fornecedores;
CREATE POLICY "forn_delete" ON fornecedores FOR DELETE TO authenticated USING (is_admin());

-- Fix 5: Add delete policy for setores (admin only) - already exists, just confirm
-- Fix 6: Add delete policy for equipamentos - already exists via equip_delete

-- Fix 7: Allow funcionarios to insert checklist_respostas (already has WITH CHECK true)
-- Fix 8: Allow checklist_respostas update with proper check (already exists)

-- Fix 9: Add delete policy for checklist_itens_modelo (cascade should handle it, but ensure)
-- Already exists via chkitem_delete
