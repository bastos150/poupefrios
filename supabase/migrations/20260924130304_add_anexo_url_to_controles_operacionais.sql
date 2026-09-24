/*
# Adicionar coluna anexo_url em controles_operacionais

1. Objetivo
- Permite anexar arquivos PDF (comprovantes, laudos, certificados) aos registros operacionais.
- A coluna armazena a URL pública do arquivo no storage do Supabase.

2. Alterações
- `controles_operacionais`: adiciona `anexo_url` (text, nullable) — caminho/URL do PDF no bucket de storage.

3. Segurança
- Nenhuma mudança nas políticas RLS existentes — a coluna nova é coberta pelas políticas já criadas (select para todos autenticados, insert/update/delete para dono ou admin).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'controles_operacionais' AND column_name = 'anexo_url'
  ) THEN
    ALTER TABLE controles_operacionais ADD COLUMN anexo_url text;
  END IF;
END $$;
