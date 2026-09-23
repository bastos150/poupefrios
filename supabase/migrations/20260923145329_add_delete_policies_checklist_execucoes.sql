
-- Allow users to delete their own checklist executions
CREATE POLICY "chkexec_delete"
  ON checklist_execucoes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR is_admin());

-- Allow users to delete checklist responses (for their own executions)
CREATE POLICY "chkresp_delete"
  ON checklist_respostas
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM checklist_execucoes ce
      WHERE ce.id = checklist_respostas.checklist_execucao_id
      AND (ce.user_id = auth.uid() OR is_admin())
    )
  );
