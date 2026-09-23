import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck,
  Plus,
  CheckCircle2,
  XCircle,
  MinusCircle,
  FileText,
  AlertTriangle,
  Play,
  Eye,
  Trash2,
  Ban,
  Pencil,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Loading, EmptyState } from '@/components/ui/Feedback';
import { formatDateTime } from '@/lib/utils';
import type {
  ChecklistModelo,
  ChecklistItemModelo,
  ChecklistExecucao,
  ChecklistResposta,
  Pop,
  Setor,
} from '@/lib/types';

type Tab = 'checklists' | 'pops';

export function ChecklistsPage() {
  const { user, perfil } = useAuth();
  const isAdmin = perfil?.papel === 'admin';
  const [tab, setTab] = useState<Tab>('checklists');
  const [loading, setLoading] = useState(true);
  const [setores, setSetores] = useState<Setor[]>([]);

  // Checklists
  const [modelos, setModelos] = useState<(ChecklistModelo & { setor?: Setor })[]>([]);
  const [execucoes, setExecucoes] = useState<(ChecklistExecucao & { checklist_modelo?: ChecklistModelo })[]>([]);
  const [showModeloModal, setShowModeloModal] = useState(false);
  const [showExecModal, setShowExecModal] = useState(false);
  const [showExecucaoModal, setShowExecucaoModal] = useState(false);
  const [modeloForm, setModeloForm] = useState({ nome: '', setor_id: '', categoria: 'limpeza_sanitizacao', frequencia: '' });
  const [itensForm, setItensForm] = useState<string[]>(['']);
  const [execTarget, setExecTarget] = useState<ChecklistModelo | null>(null);
  const [execucaoAtiva, setExecucaoAtiva] = useState<{
    execucao: ChecklistExecucao;
    modelo: ChecklistModelo;
    itens: ChecklistItemModelo[];
    respostas: Record<string, { resposta: string; observacao: string }>;
  } | null>(null);
  const [modeloSubmitting, setModeloSubmitting] = useState(false);
  const [modeloError, setModeloError] = useState<string | null>(null);
  const [execSubmitting, setExecSubmitting] = useState(false);

  // POPs
  const [pops, setPops] = useState<(Pop & { setor?: Setor })[]>([]);
  const [showPopModal, setShowPopModal] = useState(false);
  const [popForm, setPopForm] = useState({ titulo: '', setor_id: '', categoria: 'limpeza_sanitizacao', conteudo: '', versao: 'v1.0' });
  const [popSubmitting, setPopSubmitting] = useState(false);
  const [popError, setPopError] = useState<string | null>(null);
  const [viewPop, setViewPop] = useState<Pop | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [modRes, execRes, setoresRes, popsRes] = await Promise.all([
      supabase.from('checklists_modelos').select('*, setor:setores(*)').eq('ativo', true).order('nome'),
      supabase
        .from('checklist_execucoes')
        .select('*, checklist_modelo:checklists_modelos(*)')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase.from('setores').select('*').order('nome'),
      supabase.from('pops').select('*, setor:setores(*)').eq('ativo', true).order('titulo'),
    ]);
    setModelos((modRes.data ?? []) as (ChecklistModelo & { setor?: Setor })[]);
    setExecucoes((execRes.data ?? []) as (ChecklistExecucao & { checklist_modelo?: ChecklistModelo })[]);
    setSetores((setoresRes.data ?? []) as Setor[]);
    setPops((popsRes.data ?? []) as (Pop & { setor?: Setor })[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmitModelo(e: React.FormEvent) {
    e.preventDefault();
    setModeloError(null);
    if (!modeloForm.nome.trim()) {
      setModeloError('Informe o nome do checklist.');
      return;
    }
    if (itensForm.filter((i) => i.trim()).length === 0) {
      setModeloError('Adicione pelo menos um item ao checklist.');
      return;
    }
    setModeloSubmitting(true);
    const { data: modeloData, error } = await supabase
      .from('checklists_modelos')
      .insert({
        nome: modeloForm.nome.trim(),
        setor_id: modeloForm.setor_id || null,
        categoria: modeloForm.categoria,
        frequencia: modeloForm.frequencia || null,
        ativo: true,
      })
      .select()
      .single();
    if (error) {
      setModeloError(error.message);
      setModeloSubmitting(false);
      return;
    }
    const itens = itensForm.filter((i) => i.trim()).map((desc, idx) => ({
      checklist_modelo_id: (modeloData as ChecklistModelo).id,
      descricao: desc.trim(),
      ordem: idx + 1,
      obrigatorio: true,
    }));
    await supabase.from('checklist_itens_modelo').insert(itens);
    setModeloSubmitting(false);
    setShowModeloModal(false);
    setModeloForm({ nome: '', setor_id: '', categoria: 'limpeza_sanitizacao', frequencia: '' });
    setItensForm(['']);
    await load();
  }

  async function startExecucao(modelo: ChecklistModelo) {
    setExecTarget(modelo);
    setShowExecModal(true);
  }

  async function confirmStartExec() {
    if (!execTarget) return;
    setExecSubmitting(true);
    const { data: execData, error } = await supabase
      .from('checklist_execucoes')
      .insert({
        checklist_modelo_id: execTarget.id,
        setor_id: execTarget.setor_id,
        status: 'em_andamento',
        user_id: user?.id,
      })
      .select()
      .single();
    if (error) {
      setExecSubmitting(false);
      return;
    }
    const { data: itensData } = await supabase
      .from('checklist_itens_modelo')
      .select('*')
      .eq('checklist_modelo_id', execTarget.id)
      .order('ordem');
    setExecucaoAtiva({
      execucao: execData as ChecklistExecucao,
      modelo: execTarget,
      itens: (itensData ?? []) as ChecklistItemModelo[],
      respostas: {},
    });
    setExecSubmitting(false);
    setShowExecModal(false);
    setShowExecucaoModal(true);
  }

  async function saveExecucao(concluir: boolean) {
    if (!execucaoAtiva) return;
    // Save responses
    const respostasInsert = execucaoAtiva.itens.map((item) => {
      const r = execucaoAtiva.respostas[item.id] ?? { resposta: '', observacao: '' };
      return {
        checklist_execucao_id: execucaoAtiva.execucao.id,
        item_modelo_id: item.id,
        resposta: r.resposta || null,
        observacao: r.observacao || null,
        abriu_ocorrencia: false,
      };
    });
    await supabase.from('checklist_respostas').upsert(respostasInsert, { onConflict: 'checklist_execucao_id,item_modelo_id' });

    if (concluir) {
      await supabase
        .from('checklist_execucoes')
        .update({ status: 'concluido', concluido_em: new Date().toISOString() })
        .eq('id', execucaoAtiva.execucao.id);

      // Check for non-conformities and open occurrences
      for (const item of execucaoAtiva.itens) {
        const r = execucaoAtiva.respostas[item.id];
        if (r?.resposta === 'nao_conforme') {
          await supabase.from('ocorrencias').insert({
            setor_id: execucaoAtiva.modelo.setor_id,
            tipo: 'checklist',
            origem_tabela: 'checklist_execucoes',
            origem_id: execucaoAtiva.execucao.id,
            descricao: `Item não conforme no checklist "${execucaoAtiva.modelo.nome}": ${item.descricao}${r.observacao ? ` — ${r.observacao}` : ''}`,
            severidade: 'media',
            status: 'aberta',
            user_id: user?.id,
          });
        }
      }
    }
    setShowExecucaoModal(false);
    setExecucaoAtiva(null);
    await load();
  }

  async function cancelExecucao() {
    if (!execucaoAtiva) return;
    await supabase
      .from('checklist_execucoes')
      .update({ status: 'cancelado' })
      .eq('id', execucaoAtiva.execucao.id);
    setShowExecucaoModal(false);
    setExecucaoAtiva(null);
    await load();
  }

  async function editExecucao(exec: ChecklistExecucao & { checklist_modelo?: ChecklistModelo }) {
    const modelo = exec.checklist_modelo;
    if (!modelo) return;
    const { data: itensData } = await supabase
      .from('checklist_itens_modelo')
      .select('*')
      .eq('checklist_modelo_id', modelo.id)
      .order('ordem');
    const { data: respostasData } = await supabase
      .from('checklist_respostas')
      .select('*')
      .eq('checklist_execucao_id', exec.id);
    const respostasMap: Record<string, { resposta: string; observacao: string }> = {};
    for (const r of (respostasData ?? []) as ChecklistResposta[]) {
      respostasMap[r.item_modelo_id] = {
        resposta: r.resposta ?? '',
        observacao: r.observacao ?? '',
      };
    }
    setExecucaoAtiva({
      execucao: exec,
      modelo,
      itens: (itensData ?? []) as ChecklistItemModelo[],
      respostas: respostasMap,
    });
    setShowExecucaoModal(true);
  }

  async function deleteExecucao(exec: ChecklistExecucao) {
    if (!confirm('Excluir esta execução? Esta ação não pode ser desfeita.')) return;
    await supabase.from('checklist_respostas').delete().eq('checklist_execucao_id', exec.id);
    await supabase.from('checklist_execucoes').delete().eq('id', exec.id);
    await load();
  }

  async function deleteModelo(modelo: ChecklistModelo) {
    if (!confirm(`Excluir o checklist "${modelo.nome}"? Esta ação não pode ser desfeita.`)) return;
    await supabase
      .from('checklists_modelos')
      .update({ ativo: false })
      .eq('id', modelo.id);
    await load();
  }

  async function handleSubmitPop(e: React.FormEvent) {
    e.preventDefault();
    setPopError(null);
    if (!popForm.titulo.trim() || !popForm.conteudo.trim()) {
      setPopError('Preencha título e conteúdo do POP.');
      return;
    }
    setPopSubmitting(true);
    const { error } = await supabase.from('pops').insert({
      titulo: popForm.titulo.trim(),
      setor_id: popForm.setor_id || null,
      categoria: popForm.categoria,
      conteudo: popForm.conteudo.trim(),
      versao: popForm.versao || 'v1.0',
      ativo: true,
    });
    setPopSubmitting(false);
    if (error) {
      setPopError(error.message);
      return;
    }
    setShowPopModal(false);
    setPopForm({ titulo: '', setor_id: '', categoria: 'limpeza_sanitizacao', conteudo: '', versao: 'v1.0' });
    await load();
  }

  if (loading) return <Loading message="Carregando checklists..." />;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'checklists', label: 'Checklists', icon: <ClipboardCheck size={18} /> },
    { key: 'pops', label: 'POPs', icon: <FileText size={18} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Checklists & POPs</h2>
          <p className="text-sm text-slate-500">Procedimentos operacionais padronizados e checklists de verificação</p>
        </div>
        {isAdmin && (
          <Button icon={<Plus size={18} />} onClick={() => tab === 'checklists' ? setShowModeloModal(true) : setShowPopModal(true)}>
            {tab === 'checklists' ? 'Novo Checklist' : 'Novo POP'}
          </Button>
        )}
      </div>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition ${
              tab === t.key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'checklists' && (
        <div className="space-y-6">
          {/* Modelos */}
          <div className="sp-card p-5">
            <h3 className="mb-4 font-semibold text-slate-900">Modelos de Checklist</h3>
            {modelos.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {modelos.map((m) => (
                  <div key={m.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-slate-800">{m.nome}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {m.setor?.nome ?? 'Geral'} • {m.frequencia ?? '-'}
                        </p>
                      </div>
                      <Badge variant="info">{m.categoria?.replace('_', ' ')}</Badge>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1"
                        icon={<Play size={14} />}
                        onClick={() => startExecucao(m)}
                      >
                        Executar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 size={14} />}
                        onClick={() => deleteModelo(m)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={<ClipboardCheck size={40} />} title="Nenhum checklist cadastrado" />
            )}
          </div>

          {/* Execuções recentes */}
          <div className="sp-card p-5">
            <h3 className="mb-4 font-semibold text-slate-900">Execuções Recentes</h3>
            {execucoes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-200">
                    <tr>
                      <th className="sp-table-th">Checklist</th>
                      <th className="sp-table-th">Data/Hora</th>
                      <th className="sp-table-th">Status</th>
                      <th className="sp-table-th text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {execucoes.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50">
                        <td className="sp-table-td font-medium">{e.checklist_modelo?.nome ?? '-'}</td>
                        <td className="sp-table-td">{formatDateTime(e.created_at)}</td>
                        <td className="sp-table-td">
                          <Badge variant={e.status === 'concluido' ? 'success' : e.status === 'em_andamento' ? 'warning' : e.status === 'cancelado' ? 'danger' : 'neutral'}>
                            {e.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="sp-table-td">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => editExecucao(e)}
                              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                              title="Editar"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteExecucao(e)}
                              className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-red-600"
                              title="Excluir"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon={<ClipboardCheck size={40} />} title="Nenhuma execução registrada" />
            )}
          </div>
        </div>
      )}

      {tab === 'pops' && (
        <div className="sp-card p-5">
          <h3 className="mb-4 font-semibold text-slate-900">Procedimentos Operacionais Padronizados</h3>
          {pops.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {pops.map((p) => (
                <div key={p.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{p.titulo}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {p.setor?.nome ?? 'Geral'} • {p.versao}
                      </p>
                    </div>
                    <Badge variant="info">{p.categoria?.replace('_', ' ')}</Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    icon={<Eye size={14} />}
                    onClick={() => setViewPop(p)}
                  >
                    Visualizar
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<FileText size={40} />} title="Nenhum POP cadastrado" />
          )}
        </div>
      )}

      {/* Modelo modal */}
      <Modal
        open={showModeloModal}
        onClose={() => setShowModeloModal(false)}
        title="Novo Modelo de Checklist"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowModeloModal(false)}>Cancelar</Button>
            <Button onClick={handleSubmitModelo} loading={modeloSubmitting} icon={<CheckCircle2 size={18} />}>Criar</Button>
          </>
        }
      >
        <div className="space-y-4">
          {modeloError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={18} />{modeloError}
            </div>
          )}
          <Input label="Nome do checklist" required value={modeloForm.nome} onChange={(e) => setModeloForm({ ...modeloForm, nome: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Setor" value={modeloForm.setor_id} onChange={(e) => setModeloForm({ ...modeloForm, setor_id: e.target.value })}>
              <option value="">Geral</option>
              {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </Select>
            <Select label="Categoria" value={modeloForm.categoria} onChange={(e) => setModeloForm({ ...modeloForm, categoria: e.target.value })}>
              <option value="limpeza_sanitizacao">Limpeza e Sanitização</option>
              <option value="higienizacao_equipamentos">Higienização de Equipamentos</option>
              <option value="manutencao_preventiva">Manutenção Preventiva</option>
              <option value="calibracao">Calibração</option>
              <option value="validade_identificacao">Validade e Identificação</option>
              <option value="outro">Outro</option>
            </Select>
          </div>
          <Input label="Frequência" value={modeloForm.frequencia} onChange={(e) => setModeloForm({ ...modeloForm, frequencia: e.target.value })} placeholder="Ex: Diária, Semanal..." />
          <div>
            <label className="sp-label">Itens do checklist</label>
            <div className="space-y-2">
              {itensForm.map((item, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={item}
                    onChange={(e) => {
                      const newItens = [...itensForm];
                      newItens[idx] = e.target.value;
                      setItensForm(newItens);
                    }}
                    placeholder={`Item ${idx + 1}`}
                  />
                  {itensForm.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setItensForm(itensForm.filter((_, i) => i !== idx))}
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={() => setItensForm([...itensForm, ''])}>
                Adicionar item
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Confirm execução */}
      <Modal
        open={showExecModal}
        onClose={() => setShowExecModal(false)}
        title="Iniciar Checklist"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowExecModal(false)}>Cancelar</Button>
            <Button onClick={confirmStartExec} loading={execSubmitting} icon={<Play size={18} />}>Iniciar</Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          Deseja iniciar a execução do checklist <strong>{execTarget?.nome}</strong>?
        </p>
      </Modal>

      {/* Execução ativa */}
      <Modal
        open={showExecucaoModal}
        onClose={() => { setShowExecucaoModal(false); setExecucaoAtiva(null); }}
        title={execucaoAtiva?.modelo.nome ?? 'Checklist'}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => saveExecucao(false)}>Salvar Parcial</Button>
            <Button variant="danger" onClick={cancelExecucao} icon={<Ban size={18} />}>Cancelar Checklist</Button>
            <Button variant="success" onClick={() => saveExecucao(true)} icon={<CheckCircle2 size={18} />}>Concluir</Button>
          </>
        }
      >
        {execucaoAtiva && (
          <div className="space-y-4">
            {execucaoAtiva.itens.map((item) => {
              const r = execucaoAtiva.respostas[item.id] ?? { resposta: '', observacao: '' };
              return (
                <div key={item.id} className="rounded-lg border border-slate-200 p-4">
                  <p className="mb-3 text-sm font-medium text-slate-800">{item.descricao}</p>
                  <div className="flex gap-2">
                    {[
                      { val: 'conforme', label: 'Conforme', icon: <CheckCircle2 size={16} />, color: 'emerald' },
                      { val: 'nao_conforme', label: 'Não conforme', icon: <XCircle size={16} />, color: 'red' },
                      { val: 'nao_se_aplica', label: 'Não se aplica', icon: <MinusCircle size={16} />, color: 'slate' },
                    ].map((opt) => (
                      <button
                        key={opt.val}
                        onClick={() =>
                          setExecucaoAtiva({
                            ...execucaoAtiva,
                            respostas: {
                              ...execucaoAtiva.respostas,
                              [item.id]: { ...r, resposta: opt.val },
                            },
                          })
                        }
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                          r.resposta === opt.val
                            ? opt.color === 'emerald'
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : opt.color === 'red'
                              ? 'border-red-500 bg-red-50 text-red-700'
                              : 'border-slate-500 bg-slate-100 text-slate-700'
                            : 'border-slate-300 text-slate-500 hover:bg-slate-50'
                        }`}
                      >
                        {opt.icon}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <Input
                    className="mt-3"
                    placeholder="Observação (opcional)"
                    value={r.observacao}
                    onChange={(e) =>
                      setExecucaoAtiva({
                        ...execucaoAtiva,
                        respostas: {
                          ...execucaoAtiva.respostas,
                          [item.id]: { ...r, observacao: e.target.value },
                        },
                      })
                    }
                  />
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* POP modal */}
      <Modal
        open={showPopModal}
        onClose={() => setShowPopModal(false)}
        title="Novo POP"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowPopModal(false)}>Cancelar</Button>
            <Button onClick={handleSubmitPop} loading={popSubmitting} icon={<CheckCircle2 size={18} />}>Criar</Button>
          </>
        }
      >
        <div className="space-y-4">
          {popError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={18} />{popError}
            </div>
          )}
          <Input label="Título" required value={popForm.titulo} onChange={(e) => setPopForm({ ...popForm, titulo: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Setor" value={popForm.setor_id} onChange={(e) => setPopForm({ ...popForm, setor_id: e.target.value })}>
              <option value="">Geral</option>
              {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </Select>
            <Select label="Categoria" value={popForm.categoria} onChange={(e) => setPopForm({ ...popForm, categoria: e.target.value })}>
              <option value="limpeza_sanitizacao">Limpeza e Sanitização</option>
              <option value="higienizacao_equipamentos">Higienização de Equipamentos</option>
              <option value="manutencao_preventiva">Manutenção Preventiva</option>
              <option value="calibracao">Calibração</option>
              <option value="validade_identificacao">Validade e Identificação</option>
              <option value="outro">Outro</option>
            </Select>
          </div>
          <Input label="Versão" value={popForm.versao} onChange={(e) => setPopForm({ ...popForm, versao: e.target.value })} />
          <Textarea label="Conteúdo do POP" required value={popForm.conteudo} onChange={(e) => setPopForm({ ...popForm, conteudo: e.target.value })} className="min-h-[200px]" />
        </div>
      </Modal>

      {/* View POP */}
      <Modal
        open={!!viewPop}
        onClose={() => setViewPop(null)}
        title={viewPop?.titulo ?? 'POP'}
        size="lg"
        footer={<Button variant="ghost" onClick={() => setViewPop(null)}>Fechar</Button>}
      >
        {viewPop && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Badge variant="info">{viewPop.categoria?.replace('_', ' ')}</Badge>
              <Badge variant="neutral">{viewPop.versao}</Badge>
            </div>
            <div className="whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
              {viewPop.conteudo}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
