-- Add foto_url column to recebimentos (AcouguePage references it)
ALTER TABLE recebimentos ADD COLUMN IF NOT EXISTS foto_url text;

-- Add delete policy for higienizacoes (owner or admin)
DROP POLICY IF EXISTS "hig_delete" ON higienizacoes;
CREATE POLICY "hig_delete" ON higienizacoes FOR DELETE TO authenticated USING (auth.uid() = user_id OR is_admin());

-- Add delete policy for recebimentos (owner or admin)
DROP POLICY IF EXISTS "receb_delete" ON recebimentos;
CREATE POLICY "receb_delete" ON recebimentos FOR DELETE TO authenticated USING (auth.uid() = user_id OR is_admin());

-- Add delete policy for registros_temperatura (admin only - already exists but with AND false, fix it)
DROP POLICY IF EXISTS "regtemp_delete" ON registros_temperatura;
CREATE POLICY "regtemp_delete" ON registros_temperatura FOR DELETE TO authenticated USING (is_admin());

-- Add delete policy for ocorrencias (owner or admin)
DROP POLICY IF EXISTS "ocorr_delete" ON ocorrencias;
CREATE POLICY "ocorr_delete" ON ocorrencias FOR DELETE TO authenticated USING (auth.uid() = user_id OR is_admin());

-- Add delete policy for alertas (admin only)
DROP POLICY IF EXISTS "alert_delete" ON alertas;
CREATE POLICY "alert_delete" ON alertas FOR DELETE TO authenticated USING (is_admin());

-- Add delete policy for perfis (admin only)
DROP POLICY IF EXISTS "perfis_delete" ON perfis;
CREATE POLICY "perfis_delete" ON perfis FOR DELETE TO authenticated USING (is_admin());

-- Add delete policy for configuracoes (admin only)
DROP POLICY IF EXISTS "config_delete" ON configuracoes;
CREATE POLICY "config_delete" ON configuracoes FOR DELETE TO authenticated USING (is_admin());

-- Add delete policy for produtos (admin only)
DROP POLICY IF EXISTS "prod_delete" ON produtos;
CREATE POLICY "prod_delete" ON produtos FOR DELETE TO authenticated USING (is_admin());

-- Add delete policy for pops (admin only) - already exists
-- Add delete policy for cargos (admin only) - already exists
-- Add delete policy for auditoria (admin only)
DROP POLICY IF EXISTS "aud_delete" ON auditoria;
CREATE POLICY "aud_delete" ON auditoria FOR DELETE TO authenticated USING (is_admin());
