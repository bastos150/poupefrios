/*
# Adicionar equipamentos do Hortifruti (Refrigeracao)

1. Objetivo
- Cria equipamentos padrao para o setor de Hortifruti com Refrigeracao:
  - Camara fria de hortifruti (2 a 10 °C)
  - Balcao de exposicao de hortifruti (2 a 10 °C)
- Permite registro de temperatura e controle operacional no novo setor.

2. Alteracoes
- Insere duas linhas na tabela `equipamentos` vinculadas ao setor de Hortifruti.
*/

DO $$
DECLARE
  v_setor_id uuid;
BEGIN
  SELECT id INTO v_setor_id FROM setores WHERE nome = 'Hortifruti (Refrigeracao)' LIMIT 1;
  IF v_setor_id IS NOT NULL THEN
    INSERT INTO equipamentos (setor_id, nome, tipo, ponto_medicao, temp_min, temp_max, unidade, frequencia_horas, min_verificacoes_dia, ativo)
    VALUES
      (v_setor_id, 'Camara Fria de Hortifruti', 'camara_fria', 'Interno', 2, 10, '°C', 4, 3, true),
      (v_setor_id, 'Balcao de Exposicao de Hortifruti', 'balcao_exposicao', 'Interno', 2, 10, '°C', 4, 3, true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
