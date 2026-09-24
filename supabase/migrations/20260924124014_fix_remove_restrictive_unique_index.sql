-- The unique index on ocorrencias(origem_tabela, origem_id, tipo) is too restrictive:
-- a checklist execution can have multiple non-conformity items, each generating
-- a separate occurrence with the same origem_tabela and origem_id.
DROP INDEX IF EXISTS idx_ocorrencia_origem_tipo;
