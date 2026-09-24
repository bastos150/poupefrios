import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ClipboardList,
  Download,
  Edit3,
  Eye,
  FileText,
  Filter,
  Paperclip,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, Loading } from '@/components/ui/Feedback';
import { Modal } from '@/components/ui/Modal';
import type { ControleOperacional, Setor } from '@/lib/types';
import { formatDate, formatDateTime, nowLocalISO, printContent } from '@/lib/utils';

type OperationalTab = {
  key: ControleOperacional['categoria'];
  label: string;
  description: string;
};

const tabs: OperationalTab[] = [
  { key: 'saude_funcionarios', label: 'Saúde da equipe', description: 'Exames, aptidão e acompanhamento dos funcionários.' },
  { key: 'higiene_pessoal', label: 'Higiene pessoal', description: 'Uniformes, mãos, máscaras e condutas de higiene.' },
  { key: 'treinamento', label: 'Treinamentos', description: 'Capacitação em boas práticas e reciclagens.' },
  { key: 'fornecedores', label: 'Fornecedores', description: 'Qualificação e avaliação de fornecedores.' },
  { key: 'recebimento', label: 'Recebimento', description: 'Conferência de origem, lote, validade e temperatura.' },
  { key: 'identificacao_rastreabilidade', label: 'Rastreabilidade', description: 'Lotes, origem, destino e recolhimentos.' },
  { key: 'descongelamento', label: 'Descongelamento', description: 'Descongelamento, dessalga e produtos de origem animal.' },
  { key: 'preparo', label: 'Preparo', description: 'Manipulação, cocção e resfriamento.' },
  { key: 'alergenicos', label: 'Alergênicos', description: 'Avisos de alimentos crus, alergênicos e contaminação cruzada.' },
  { key: 'exposicao', label: 'Exposição', description: 'Alimentos expostos, balcões e condições de conservação.' },
  { key: 'rotulagem', label: 'Rotulagem', description: 'Produtos preparados e fracionados.' },
  { key: 'produtos_granel', label: 'A granel', description: 'Comercialização e identificação de produtos a granel.' },
  { key: 'doacoes', label: 'Doações', description: 'Controle de doação e destino dos alimentos.' },
  { key: 'suspeita_surto', label: 'Suspeita de surto', description: 'Amostras, relatos e providências.' },
  { key: 'transporte', label: 'Transporte', description: 'Lacres, veículos, temperatura e identificação na entrega.' },
  { key: 'higienizacao_manutencao', label: 'Instalações', description: 'Higienização, manutenção e condições dos ambientes.' },
  { key: 'agua_residuos_pragas', label: 'Água, resíduos e pragas', description: 'Controles de água, resíduos e prevenção de pragas.' },
  { key: 'documentos_registros', label: 'Documentos e POPs', description: 'Revisão de documentos, registros e procedimentos.' },
  { key: 'recolhimento', label: 'Recolhimento', description: 'Rastreabilidade e recolhimento de alimentos.' },
];

const emptyForm = {
  titulo: '', descricao: '', status: 'registrado', data_evento: nowLocalISO().split('T')[0],
  responsavel: '', lote: '', validade: '', temperatura: '', origem: '', destino: '', observacao: '', setor_id: '',
};

type FormState = typeof emptyForm;

const statusBadge = (status: ControleOperacional['status']) => {
  if (status === 'conforme' || status === 'concluido') return <Badge variant="success">{status.replace(/_/g, ' ')}</Badge>;
  if (status === 'nao_conforme') return <Badge variant="danger">{status.replace(/_/g, ' ')}</Badge>;
  if (status === 'cancelado') return <Badge variant="neutral">{status.replace(/_/g, ' ')}</Badge>;
  return <Badge variant="warning">{status.replace(/_/g, ' ')}</Badge>;
};

const statusLabel: Record<string, string> = {
  registrado: 'Registrado',
  pendente: 'Pendente',
  conforme: 'Conforme',
  nao_conforme: 'Não conforme',
  em_tratamento: 'Em tratamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};

function recordToForm(record: ControleOperacional): FormState {
  return {
    titulo: record.titulo,
    descricao: record.descricao ?? '',
    status: record.status,
    data_evento: record.data_evento,
    responsavel: record.responsavel ?? '',
    lote: record.lote ?? '',
    validade: record.validade ?? '',
    temperatura: record.temperatura !== null ? String(record.temperatura) : '',
    origem: record.origem ?? '',
    destino: record.destino ?? '',
    observacao: record.observacao ?? '',
    setor_id: record.setor_id ?? '',
  };
}

export function OperacionalPage() {
  const { perfil } = useAuth();
  const [activeTab, setActiveTab] = useState<OperationalTab['key']>('saude_funcionarios');
  const [records, setRecords] = useState<ControleOperacional[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingRecord, setViewingRecord] = useState<ControleOperacional | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const active = tabs.find((tab) => tab.key === activeTab) ?? tabs[0];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [recordsResult, sectorsResult] = await Promise.all([
      supabase.from('controles_operacionais').select('*').eq('categoria', activeTab).order('data_evento', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('setores').select('*').eq('ativo', true).order('nome'),
    ]);
    if (recordsResult.error) setError('Não foi possível carregar os registros deste módulo.');
    setRecords((recordsResult.data ?? []) as ControleOperacional[]);
    setSetores((sectorsResult.data ?? []) as Setor[]);
    setLoading(false);
  }, [activeTab]);

  useEffect(() => { void load(); }, [load]);

  const filteredRecords = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('pt-BR');
    if (!normalized) return records;
    return records.filter((record) => [record.titulo, record.descricao, record.responsavel, record.lote, record.observacao]
      .filter(Boolean).some((value) => value?.toLocaleLowerCase('pt-BR').includes(normalized)));
  }, [records, search]);

  const sectorName = useCallback((id: string | null) => setores.find((s) => s.id === id)?.nome ?? null, [setores]);

  function updateForm(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreate() {
    setForm({ ...emptyForm, data_evento: nowLocalISO().split('T')[0] });
    setEditingId(null);
    setPendingFile(null);
    setShowForm(true);
  }

  function openEdit(record: ControleOperacional) {
    setForm(recordToForm(record));
    setEditingId(record.id);
    setPendingFile(null);
    setShowForm(true);
  }

  async function saveRecord(event: React.FormEvent) {
    event.preventDefault();
    if (!form.titulo.trim()) return;
    setSaving(true);
    setError(null);
    const payload = {
      categoria: activeTab,
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      status: form.status,
      data_evento: form.data_evento,
      responsavel: form.responsavel.trim() || null,
      lote: form.lote.trim() || null,
      validade: form.validade || null,
      temperatura: form.temperatura ? Number(form.temperatura) : null,
      origem: form.origem.trim() || null,
      destino: form.destino.trim() || null,
      observacao: form.observacao.trim() || null,
      setor_id: form.setor_id || null,
    };

    let savedId = editingId;
    if (editingId) {
      const { error: updateError } = await supabase.from('controles_operacionais').update(payload).eq('id', editingId);
      if (updateError) {
        setError('Não foi possível atualizar este registro.');
        setSaving(false);
        return;
      }
    } else {
      const { data: inserted, error: insertError } = await supabase.from('controles_operacionais').insert({ ...payload, user_id: perfil?.id }).select('id').maybeSingle();
      if (insertError || !inserted) {
        setError('Não foi possível salvar este registro. Confira os dados e tente novamente.');
        setSaving(false);
        return;
      }
      savedId = inserted.id as string;
    }

    if (pendingFile && savedId) {
      const filePath = `controles/${savedId}/${Date.now()}-${pendingFile.name}`;
      const { error: uploadError } = await supabase.storage.from('evidencias').upload(filePath, pendingFile, { contentType: 'application/pdf' });
      if (uploadError) {
        setError('Registro salvo, mas não foi possível enviar o PDF. Você poderá anexá-lo depois.');
      } else {
        const { error: attachError } = await supabase.from('controles_operacionais').update({ anexo_url: filePath }).eq('id', savedId);
        if (attachError) setError('Registro salvo, mas não foi possível vincular o PDF.');
      }
    }

    setForm({ ...emptyForm, data_evento: nowLocalISO().split('T')[0] });
    setPendingFile(null);
    setShowForm(false);
    setEditingId(null);
    await load();
    setSaving(false);
  }

  async function deleteRecord(record: ControleOperacional) {
    if (!confirm(`Excluir o registro "${record.titulo}"?`)) return;
    if (record.anexo_url) {
      await supabase.storage.from('evidencias').remove([record.anexo_url]);
    }
    const { error: deleteError } = await supabase.from('controles_operacionais').delete().eq('id', record.id);
    if (deleteError) setError('Não foi possível excluir este registro.');
    else setRecords((current) => current.filter((item) => item.id !== record.id));
  }

  async function handleUploadPdf(event: React.ChangeEvent<HTMLInputElement>, record: ControleOperacional) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Apenas arquivos PDF são aceitos.');
      return;
    }
    setUploadingId(record.id);
    setError(null);
    const filePath = `controles/${record.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('evidencias').upload(filePath, file, { contentType: 'application/pdf' });
    if (uploadError) {
      setError('Não foi possível enviar o arquivo.');
      setUploadingId(null);
      return;
    }
    const { error: updateError } = await supabase.from('controles_operacionais').update({ anexo_url: filePath }).eq('id', record.id);
    if (updateError) {
      setError('Arquivo enviado, mas não foi possível vincular ao registro.');
    } else {
      await load();
    }
    setUploadingId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function removeAnexo(record: ControleOperacional) {
    if (!record.anexo_url) return;
    if (!confirm('Remover o arquivo anexado?')) return;
    await supabase.storage.from('evidencias').remove([record.anexo_url]);
    const { error: updateError } = await supabase.from('controles_operacionais').update({ anexo_url: null }).eq('id', record.id);
    if (updateError) {
      setError('Não foi possível remover o anexo.');
    } else {
      await load();
    }
  }

  function getAnexoUrl(record: ControleOperacional): string | null {
    if (!record.anexo_url) return null;
    const { data } = supabase.storage.from('evidencias').getPublicUrl(record.anexo_url);
    return data.publicUrl;
  }

  function printRecord(record: ControleOperacional) {
    const setor = sectorName(record.setor_id);
    const rows: [string, string][] = [
      ['Módulo', active.label],
      ['Título', record.titulo],
      ['Situação', statusLabel[record.status] ?? record.status],
      ['Data', formatDate(record.data_evento)],
      ['Responsável', record.responsavel ?? '-'],
      ['Setor', setor ?? '-'],
      ['Lote', record.lote ?? '-'],
      ['Validade', record.validade ? formatDate(record.validade) : '-'],
      ['Temperatura', record.temperatura !== null ? `${record.temperatura} °C` : '-'],
      ['Origem', record.origem ?? '-'],
      ['Destino', record.destino ?? '-'],
      ['Registrado em', formatDateTime(record.created_at)],
    ];
    const html = `
      <h1>Controle Operacional — ${active.label}</h1>
      <div class="meta">SuperPoupe · CVS 03/2026</div>
      <table>
        ${rows.map(([label, value]) => `<tr><th style="width:160px">${label}</th><td>${value}</td></tr>`).join('')}
      </table>
      ${record.descricao ? `<h2>Descrição</h2><p>${record.descricao}</p>` : ''}
      ${record.observacao ? `<h2>Observações</h2><p>${record.observacao}</p>` : ''}
      ${record.anexo_url ? `<h2>Anexo</h2><p>Arquivo PDF vinculado a este registro.</p>` : ''}
    `;
    printContent(`Controle — ${record.titulo}`, html);
  }

  function printModule() {
    const rows = filteredRecords;
    if (rows.length === 0) return;
    const html = `
      <h1>Controles Operacionais — ${active.label}</h1>
      <div class="meta">${rows.length} registro(s) · ${formatDateTime(new Date().toISOString())}</div>
      <table>
        <thead>
          <tr><th>Título</th><th>Situação</th><th>Data</th><th>Responsável</th><th>Lote</th><th>Temp.</th></tr>
        </thead>
        <tbody>
          ${rows.map((r) => `<tr>
            <td>${r.titulo}</td>
            <td><span class="badge ${r.status === 'conforme' || r.status === 'concluido' ? 'badge-ok' : r.status === 'nao_conforme' ? 'badge-nok' : 'badge-warn'}">${statusLabel[r.status] ?? r.status}</span></td>
            <td>${formatDate(r.data_evento)}</td>
            <td>${r.responsavel ?? '-'}</td>
            <td>${r.lote ?? '-'}</td>
            <td>${r.temperatura !== null ? `${r.temperatura} °C` : '-'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    `;
    printContent(`Controles — ${active.label}`, html);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => { if (uploadingId) { const rec = records.find((r) => r.id === uploadingId); if (rec) void handleUploadPdf(e, rec); } }} />

      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">CVS 03/2026</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">Controles operacionais</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Registre e acompanhe os controles exigidos para a operação, com histórico por módulo e rastreabilidade.</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
        <aside className="sp-card max-h-[620px] overflow-y-auto p-2">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key); setSearch(''); setShowForm(false); setEditingId(null); }} className={`w-full rounded-lg px-3 py-3 text-left transition ${activeTab === tab.key ? 'bg-blue-50 text-blue-800 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
              <span className="block text-sm font-semibold">{tab.label}</span>
              <span className="mt-1 block text-xs leading-4 text-slate-400">{tab.description}</span>
            </button>
          ))}
        </aside>

        <section className="space-y-4">
          <div className="sp-card p-5">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{active.label}</h3>
                <p className="mt-1 text-sm text-slate-500">{active.description}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" icon={<Printer size={16} />} onClick={printModule} disabled={filteredRecords.length === 0}>Imprimir módulo</Button>
                <Button icon={<Plus size={17} />} onClick={openCreate}>{showForm && !editingId ? 'Fechar formulário' : 'Novo registro'}</Button>
              </div>
            </div>

            {showForm && (
              <form onSubmit={saveRecord} className="mt-5 grid gap-4 border-t border-slate-100 pt-5 md:grid-cols-2">
                <Input label="Título do controle *" value={form.titulo} onChange={(event) => updateForm('titulo', event.target.value)} placeholder="Ex.: Exame periódico — João Silva" required />
                <Input label="Data do controle *" type="date" value={form.data_evento} onChange={(event) => updateForm('data_evento', event.target.value)} required />
                <Select label="Situação" value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                  <option value="registrado">Registrado</option>
                  <option value="pendente">Pendente</option>
                  <option value="conforme">Conforme</option>
                  <option value="nao_conforme">Não conforme</option>
                  <option value="em_tratamento">Em tratamento</option>
                  <option value="concluido">Concluído</option>
                  <option value="cancelado">Cancelado</option>
                </Select>
                <Select label="Setor" value={form.setor_id} onChange={(event) => updateForm('setor_id', event.target.value)}>
                  <option value="">Todos / não informado</option>
                  {setores.map((sector) => <option key={sector.id} value={sector.id}>{sector.nome}</option>)}
                </Select>
                <Input label="Responsável" value={form.responsavel} onChange={(event) => updateForm('responsavel', event.target.value)} placeholder="Nome do responsável" />
                <Input label="Temperatura (°C)" type="number" step="0.1" value={form.temperatura} onChange={(event) => updateForm('temperatura', event.target.value)} />
                <Input label="Lote" value={form.lote} onChange={(event) => updateForm('lote', event.target.value)} />
                <Input label="Validade" type="date" value={form.validade} onChange={(event) => updateForm('validade', event.target.value)} />
                <Input label="Origem" value={form.origem} onChange={(event) => updateForm('origem', event.target.value)} placeholder="Fornecedor, veículo ou unidade" />
                <Input label="Destino" value={form.destino} onChange={(event) => updateForm('destino', event.target.value)} placeholder="Setor, cliente ou instituição" />
                <Textarea label="Descrição" value={form.descricao} onChange={(event) => updateForm('descricao', event.target.value)} className="md:col-span-2" placeholder="Descreva o controle, evidência ou providência." />
                <Textarea label="Observações" value={form.observacao} onChange={(event) => updateForm('observacao', event.target.value)} className="md:col-span-2" />
                <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/60 p-4 md:col-span-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Anexar PDF de evidência</p>
                      <p className="mt-1 text-xs text-slate-500">Opcional: laudo, certificado, comprovante ou documento do controle.</p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50">
                      <Paperclip size={16} />
                      {pendingFile ? 'Trocar PDF' : 'Selecionar PDF'}
                      <input type="file" accept="application/pdf" className="hidden" onChange={(event) => setPendingFile(event.target.files?.[0] ?? null)} />
                    </label>
                  </div>
                  {pendingFile && <p className="mt-3 truncate text-xs font-medium text-blue-700">Arquivo selecionado: {pendingFile.name}</p>}
                </div>
                <div className="flex justify-end gap-2 md:col-span-2">
                  <Button type="button" variant="ghost" onClick={() => { setShowForm(false); setEditingId(null); }}>Cancelar</Button>
                  <Button type="submit" loading={saving}>{editingId ? 'Atualizar registro' : 'Salvar registro'}</Button>
                </div>
              </form>
            )}
          </div>

          <div className="sp-card p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 sm:max-w-sm"><Search size={17} className="absolute left-3 top-3 text-slate-400" /><input className="sp-input pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nos registros" /></div>
              <span className="flex items-center gap-2 text-sm text-slate-500"><Filter size={15} /> {filteredRecords.length} registro(s)</span>
            </div>
            {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            {loading ? <Loading message="Carregando registros..." /> : filteredRecords.length === 0 ? <EmptyState icon={<ClipboardList size={38} />} title="Nenhum registro neste módulo" description="Cadastre o primeiro controle. Depois de salvar, os botões Editar, PDF e Imprimir aparecerão no registro." action={<Button icon={<Plus size={16} />} onClick={openCreate}>Criar primeiro registro</Button>} /> : (
              <div className="space-y-3">
                {filteredRecords.map((record) => (
                  <article key={record.id} className="rounded-xl border border-slate-200 p-4 transition hover:border-blue-200 hover:shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-slate-900">{record.titulo}</h4>
                          {statusBadge(record.status)}
                          {record.anexo_url && (
                            <Badge variant="info">
                              <FileText size={12} /> PDF
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {formatDate(record.data_evento)}
                          {record.responsavel ? ` · ${record.responsavel}` : ''}
                          {record.lote ? ` · Lote ${record.lote}` : ''}
                          {sectorName(record.setor_id) ? ` · ${sectorName(record.setor_id)}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewingRecord(record)} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-slate-500 transition hover:bg-blue-50 hover:text-blue-600" aria-label="Visualizar registro" title="Visualizar">
                          <Eye size={15} /> Ver
                        </button>
                        <button onClick={() => openEdit(record)} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-slate-500 transition hover:bg-amber-50 hover:text-amber-600" aria-label="Editar registro" title="Editar">
                          <Edit3 size={15} /> Editar
                        </button>
                        <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-600" aria-label="Anexar PDF" title="Anexar PDF">
                          {uploadingId === record.id ? (
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <><Paperclip size={15} /> PDF</>
                          )}
                          <input type="file" accept="application/pdf" className="hidden" onChange={(e) => void handleUploadPdf(e, record)} disabled={uploadingId === record.id} />
                        </label>
                        <button onClick={() => printRecord(record)} className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Imprimir registro" title="Imprimir">
                          <Printer size={15} /> Imprimir
                        </button>
                        <button onClick={() => void deleteRecord(record)} className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600" aria-label="Excluir registro" title="Excluir">
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </div>
                    {record.descricao && <p className="mt-3 text-sm leading-6 text-slate-700">{record.descricao}</p>}
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
                      {record.temperatura !== null && <span>Temperatura: {record.temperatura} °C</span>}
                      {record.origem && <span>Origem: {record.origem}</span>}
                      {record.destino && <span>Destino: {record.destino}</span>}
                      {record.validade && <span>Validade: {formatDate(record.validade)}</span>}
                    </div>
                    {record.observacao && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{record.observacao}</p>}
                    {record.anexo_url && (
                      <div className="mt-3 flex items-center gap-3 rounded-lg bg-blue-50 px-3 py-2">
                        <FileText size={16} className="text-blue-600" />
                        <a href={getAnexoUrl(record) ?? '#'} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-700 hover:underline">Ver PDF anexado</a>
                        <button onClick={() => void removeAnexo(record)} className="ml-auto rounded p-1 text-slate-400 hover:text-red-600" title="Remover anexo">
                          <X size={15} />
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Modal de visualização detalhada */}
      <Modal open={viewingRecord !== null} onClose={() => setViewingRecord(null)} title={viewingRecord?.titulo ?? ''} size="lg"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setViewingRecord(null)}>Fechar</Button>
            {viewingRecord && <Button variant="outline" icon={<Printer size={16} />} onClick={() => printRecord(viewingRecord)}>Imprimir</Button>}
            {viewingRecord && <Button icon={<Edit3 size={16} />} onClick={() => { if (viewingRecord) { openEdit(viewingRecord); setViewingRecord(null); } }}>Editar</Button>}
          </div>
        }
      >
        {viewingRecord && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {statusBadge(viewingRecord.status)}
              <Badge variant="info">{active.label}</Badge>
              {sectorName(viewingRecord.setor_id) && <Badge variant="neutral">{sectorName(viewingRecord.setor_id)}</Badge>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><span className="sp-label">Data</span><p className="text-sm text-slate-800">{formatDate(viewingRecord.data_evento)}</p></div>
              <div><span className="sp-label">Responsável</span><p className="text-sm text-slate-800">{viewingRecord.responsavel ?? '-'}</p></div>
              <div><span className="sp-label">Lote</span><p className="text-sm text-slate-800">{viewingRecord.lote ?? '-'}</p></div>
              <div><span className="sp-label">Validade</span><p className="text-sm text-slate-800">{viewingRecord.validade ? formatDate(viewingRecord.validade) : '-'}</p></div>
              <div><span className="sp-label">Temperatura</span><p className="text-sm text-slate-800">{viewingRecord.temperatura !== null ? `${viewingRecord.temperatura} °C` : '-'}</p></div>
              <div><span className="sp-label">Origem</span><p className="text-sm text-slate-800">{viewingRecord.origem ?? '-'}</p></div>
              <div><span className="sp-label">Destino</span><p className="text-sm text-slate-800">{viewingRecord.destino ?? '-'}</p></div>
              <div><span className="sp-label">Registrado em</span><p className="text-sm text-slate-800">{formatDateTime(viewingRecord.created_at)}</p></div>
            </div>
            {viewingRecord.descricao && (
              <div><span className="sp-label">Descrição</span><p className="mt-1 text-sm leading-6 text-slate-700">{viewingRecord.descricao}</p></div>
            )}
            {viewingRecord.observacao && (
              <div><span className="sp-label">Observações</span><p className="mt-1 rounded-lg bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">{viewingRecord.observacao}</p></div>
            )}
            {viewingRecord.anexo_url && (
              <div className="flex items-center gap-3 rounded-lg bg-blue-50 px-4 py-3">
                <FileText size={20} className="text-blue-600" />
                <a href={getAnexoUrl(viewingRecord) ?? '#'} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-700 hover:underline">Abrir PDF anexado</a>
                <button onClick={() => void removeAnexo(viewingRecord)} className="ml-auto rounded p-1 text-slate-400 hover:text-red-600" title="Remover anexo">
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
