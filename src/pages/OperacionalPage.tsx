import { useCallback, useEffect, useMemo, useState } from 'react';
import { ClipboardList, Filter, Plus, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, Loading } from '@/components/ui/Feedback';
import type { ControleOperacional, Setor } from '@/lib/types';
import { formatDate, nowLocalISO } from '@/lib/utils';

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

  function updateForm(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function saveRecord(event: React.FormEvent) {
    event.preventDefault();
    if (!form.titulo.trim()) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from('controles_operacionais').insert({
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
      user_id: perfil?.id,
    });
    if (insertError) {
      setError('Não foi possível salvar este registro. Confira os dados e tente novamente.');
    } else {
      setForm({ ...emptyForm, data_evento: nowLocalISO().split('T')[0] });
      setShowForm(false);
      await load();
    }
    setSaving(false);
  }

  async function deleteRecord(record: ControleOperacional) {
    if (!confirm(`Excluir o registro “${record.titulo}”?`)) return;
    const { error: deleteError } = await supabase.from('controles_operacionais').delete().eq('id', record.id);
    if (deleteError) setError('Não foi possível excluir este registro.');
    else setRecords((current) => current.filter((item) => item.id !== record.id));
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">CVS 03/2026</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">Controles operacionais</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">Registre e acompanhe os controles exigidos para a operação, com histórico por módulo e rastreabilidade.</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[280px_1fr]">
        <aside className="sp-card max-h-[620px] overflow-y-auto p-2">
          {tabs.map((tab) => (
            <button key={tab.key} onClick={() => { setActiveTab(tab.key); setSearch(''); setShowForm(false); }} className={`w-full rounded-lg px-3 py-3 text-left transition ${activeTab === tab.key ? 'bg-blue-50 text-blue-800 shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
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
              <Button icon={<Plus size={17} />} onClick={() => setShowForm((current) => !current)}>{showForm ? 'Fechar formulário' : 'Novo registro'}</Button>
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
                <div className="flex justify-end gap-2 md:col-span-2"><Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button><Button type="submit" loading={saving}>Salvar registro</Button></div>
              </form>
            )}
          </div>

          <div className="sp-card p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 sm:max-w-sm"><Search size={17} className="absolute left-3 top-3 text-slate-400" /><input className="sp-input pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nos registros" /></div>
              <span className="flex items-center gap-2 text-sm text-slate-500"><Filter size={15} /> {filteredRecords.length} registro(s)</span>
            </div>
            {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            {loading ? <Loading message="Carregando registros..." /> : filteredRecords.length === 0 ? <EmptyState icon={<ClipboardList size={38} />} title="Nenhum registro neste módulo" description="Use “Novo registro” para começar o acompanhamento." /> : (
              <div className="space-y-3">
                {filteredRecords.map((record) => (
                  <article key={record.id} className="rounded-xl border border-slate-200 p-4 transition hover:border-blue-200 hover:shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold text-slate-900">{record.titulo}</h4><Badge variant={record.status === 'conforme' || record.status === 'concluido' ? 'success' : record.status === 'nao_conforme' ? 'danger' : 'warning'}>{record.status.replace(/_/g, ' ')}</Badge></div><p className="mt-1 text-sm text-slate-500">{formatDate(record.data_evento)}{record.responsavel ? ` · ${record.responsavel}` : ''}{record.lote ? ` · Lote ${record.lote}` : ''}</p></div><button onClick={() => void deleteRecord(record)} className="self-end rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600" aria-label="Excluir registro"><Trash2 size={17} /></button></div>
                    {record.descricao && <p className="mt-3 text-sm leading-6 text-slate-700">{record.descricao}</p>}
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">{record.temperatura !== null && <span>Temperatura: {record.temperatura} °C</span>}{record.origem && <span>Origem: {record.origem}</span>}{record.destino && <span>Destino: {record.destino}</span>}{record.validade && <span>Validade: {formatDate(record.validade)}</span>}</div>
                    {record.observacao && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{record.observacao}</p>}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
