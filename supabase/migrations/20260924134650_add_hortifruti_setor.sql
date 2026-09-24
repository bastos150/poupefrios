/*
# Adicionar setor Hortifruti/Refrigeracao

1. Objetivo
- Cria o setor "Hortifruti (Refrigeracao)" para controle de temperatura e operacional.
- Setor fica ativo e disponivel para todos os modulos.

2. Alteracoes
- Insere nova linha na tabela `setores`.
*/

INSERT INTO setores (nome, descricao, ativo)
VALUES ('Hortifruti (Refrigeracao)', 'Departamento de Hortifruti com Refrigeracao', true)
ON CONFLICT DO NOTHING;
