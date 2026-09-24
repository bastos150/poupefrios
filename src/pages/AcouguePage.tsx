import { useState, useEffect, useCallback } from 'react';
import {
  Truck,
  SprayCan,
  AlertTriangle,
  Plus,
  CheckCircle2,
  XCircle,
  Wrench,
  Download,
  Printer,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Loading, EmptyState } from '@/components/ui/Feedback';
import { PhotoCapture } from '@/components/PhotoCapture';
import { formatDateTime, formatTime, formatDate, downloadCSV, printContent, nowLocalISO } from '@/lib/utils';
import type { Recebimento, Higienizacao, Fornecedor, Ocorrencia, AcaoCorretiva } from '@/lib/types';

interface AcouguePageProps {
  setorId: string;
}

type Tab = 'temperaturas' | 'recebimento' | 'higienizacao' | 'ocorrencias';

export function AcouguePage({ setorId }: AcouguePageProps) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('recebimento');
  const [loading, setLoading] = useState(true);

  // Recebimento
  const [recebimentos, setRecebimentos] = useState<Recebimento[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [showRecebModal, setShowRecebModal] = useState(false);
  const [recebForm, setRecebForm] = useState({
    fornecedor_id: '',
    produto: '',
    lote: '',
    validade: '',
    temperatura: '',
    condicao_embalagem: 'intacta' as 'intacta' | 'danificada' | 'violada' | 'outra',
    decisao: 'aceito' as 'aceito' | 'recusado',
    observacao: '',
    foto_url: '',
  });
  const [recebError, setRecebError] = useState<string | null>(null);
  const [recebSubmitting, setRecebSubmitting] = useState(false);

  // Higienização
  const [higienizacoes, setHigienizacoes] = useState<Higienizacao[]>([]);
  const [showHigModal, setShowHigModal] = useState(false);
  const [higForm, setHigForm] = useState({
    tipo: 'equipamento' as 'equipamento' | 'utensilio' | 'superficie' | 'ambiente',
    alvo: '',
    produto_limpeza: '',
    responsavel: '',
    observacao: '',
  });
  const [higError, setHigError] = useState<string | null>(null);
  const [higSubmitting, setHigSubmitting] = useState(false);

  // Ocorrências
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [acoes, setAcoes] = useState<AcaoCorretiva[]>([]);
  const [showOcorrModal, setShowOcorrModal] = useState(false);
  const [ocorrForm, setOcorrForm] = useState({
    tipo: 'nao_conformidade' as string,
    descricao: '',
    severidade: 'media' as 'baixa' | 'media' | 'alta' | 'critica',
  });
  const [ocorrError, setOcorrError] = useState<string | null>(null);
  const [ocorrSubmitting, setOcorrSubmitting] = useState(false);
  const [showAcaoModal, setShowAcaoModal] = useState(false);
  const [acaoTarget, setAcaoTarget] = useState<string | null>(null);
  const [acaoForm, setAcaoForm] = useState({ descricao: '', responsavel: '' });
  const [acaoSubmitting, setAcaoSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const today = nowLocalISO().split('T')[0];
    const startOfDay = `${today}T00:00:00`;
    const endOfDay = `${today}T23:59:59`;

    const [recebRes, fornRes, higRes, ocorrRes] = await Promise.all([
      supabase
        .from('recebimentos')
        .select('*, fornecedor:fornecedores(*)')
        .eq('setor_id', setorId)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .order('created_at', { ascending: false }),
      supabase.from('fornecedores').select('*').eq('ativo', true).order('nome'),
      supabase
        .from('higienizacoes')
        .select('*')
        .eq('setor_id', setorId)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay)
        .order('created_at', { ascending: false }),
      supabase
        .from('ocorrencias')
        .select('*')
        .eq('setor_id', setorId)
        .in('status', ['aberta', 'em_tratamento'])
        .order('created_at', { ascending: false }),
    ]);

    setRecebimentos((recebRes.data ?? []) as unknown as Recebimento[]);
    setFornecedores((fornRes.data ?? []) as Fornecedor[]);
    setHigienizacoes((higRes.data ?? []) as Higienizacao[]);
    setOcorrencias((ocorrRes.data ?? []) as Ocorrencia[]);

    if ((ocorrRes.data ?? []).length > 0) {
      const ocorrIds = (ocorrRes.data ?? []).map((o) => (o as Ocorrencia).id);
      const { data: acaoData } = await supabase
        .from('acoes_corretivas')
        .select('*')
        .in('ocorrencia_id', ocorrIds)
        .order('created_at', { ascending: false });
      setAcoes((acaoData ?? []) as AcaoCorretiva[]);
    } else {
      setAcoes([]);
    }

    setLoading(false);
  }, [setorId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmitReceb(e: React.FormEvent) {
    e.preventDefault();
    setRecebError(null);
    if (!recebForm.produto.trim()) {
      setRecebError('Informe o produto.');
      return;
    }
    if (!recebForm.temperatura || isNaN(Number(recebForm.temperatura))) {
      setRecebError('Informe a temperatura do produto.');
      return;
    }
    setRecebSubmitting(true);
    const { error } = await supabase.from('recebimentos').insert({
      setor_id: setorId,
      fornecedor_id: recebForm.fornecedor_id || null,
      produto: recebForm.produto.trim(),
      lote: recebForm.lote || null,
      validade: recebForm.validade || null,
      temperatura: Number(recebForm.temperatura),
      condicao_embalagem: recebForm.condicao_embalagem,
      decisao: recebForm.decisao,
      observacao: recebForm.observacao || null,
      foto_url: recebForm.foto_url || null,
      user_id: user?.id,
    });
    setRecebSubmitting(false);
    if (error) {
      setRecebError(error.message);
      return;
    }
    // If recusado, open occurrence
    if (recebForm.decisao === 'recusado') {
      await supabase.from('ocorrencias').insert({
        setor_id: setorId,
        tipo: 'recebimento',
        descricao: `Recebimento recusado: ${recebForm.produto} — ${recebForm.observacao || 'Sem observação'}`,
        severidade: 'alta',
        status: 'aberta',
        user_id: user?.id,
      });
    }
    setShowRecebModal(false);
    setRecebForm({
      fornecedor_id: '', produto: '', lote: '', validade: '', temperatura: '',
      condicao_embalagem: 'intacta', decisao: 'aceito', observacao: '', foto_url: '',
    });
    await load();
  }

  async function handleSubmitHig(e: React.FormEvent) {
    e.preventDefault();
    setHigError(null);
    if (!higForm.alvo.trim()) {
      setHigError('Informe o que foi higienizado.');
      return;
    }
    setHigSubmitting(true);
    const { error } = await supabase.from('higienizacoes').insert({
      setor_id: setorId,
      tipo: higForm.tipo,
      alvo: higForm.alvo.trim(),
      produto_limpeza: higForm.produto_limpeza || null,
      responsavel: higForm.responsavel || null,
      observacao: higForm.observacao || null,
      user_id: user?.id,
    });
    setHigSubmitting(false);
    if (error) {
      setHigError(error.message);
      return;
    }
    setShowHigModal(false);
    setHigForm({ tipo: 'equipamento', alvo: '', produto_limpeza: '', responsavel: '', observacao: '' });
    await load();
  }

  async function handleSubmitOcorr(e: React.FormEvent) {
    e.preventDefault();
    setOcorrError(null);
    if (!ocorrForm.descricao.trim()) {
      setOcorrError('Descreva a ocorrência.');
      return;
    }
    setOcorrSubmitting(true);
    const { error } = await supabase.from('ocorrencias').insert({
      setor_id: setorId,
      tipo: ocorrForm.tipo,
      descricao: ocorrForm.descricao.trim(),
      severidade: ocorrForm.severidade,
      status: 'aberta',
      user_id: user?.id,
    });
    setOcorrSubmitting(false);
    if (error) {
      setOcorrError(error.message);
      return;
    }
    setShowOcorrModal(false);
    setOcorrForm({ tipo: 'nao_conformidade', descricao: '', severidade: 'media' });
    await load();
  }

  async function handleSubmitAcao(e: React.FormEvent) {
    e.preventDefault();
    if (!acaoForm.descricao.trim() || !acaoTarget) return;
    setAcaoSubmitting(true);
    await supabase.from('acoes_corretivas').insert({
      ocorrencia_id: acaoTarget,
      descricao: acaoForm.descricao.trim(),
      responsavel: acaoForm.responsavel || null,
      horario: new Date().toISOString(),
      user_id: user?.id,
    });
    await supabase.from('ocorrencias').update({ status: 'em_tratamento' }).eq('id', acaoTarget);
    setAcaoSubmitting(false);
    setShowAcaoModal(false);
    setAcaoForm({ descricao: '', responsavel: '' });
    setAcaoTarget(null);
    await load();
  }

  async function concluirOcorr(ocorrId: string) {
    await supabase
      .from('ocorrencias')
      .update({ status: 'concluida', concluida_em: new Date().toISOString() })
      .eq('id', ocorrId);
    await load();
  }

  function exportRecebCSV() {
    const headers = ['Data/Hora', 'Produto', 'Fornecedor', 'Lote', 'Validade', 'Temperatura', 'Embalagem', 'Decisão', 'Observação'];
    const rows = recebimentos.map((r) => [
      formatDateTime(r.created_at), r.produto,
      fornecedores.find((f) => f.id === r.fornecedor_id)?.nome ?? '-',
      r.lote ?? '', r.validade ?? '', r.temperatura ?? '',
      r.condicao_embalagem ?? '', r.decisao, r.observacao ?? '',
    ]);
    downloadCSV(`recebimentos_acougue_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  }

  function printReceb() {
    const rows = recebimentos
      .map((r) => `<tr><td>${formatTime(r.created_at)}</td><td>${r.produto}</td><td>${fornecedores.find((f) => f.id === r.fornecedor_id)?.nome ?? '-'}</td><td>${r.temperatura ?? '-'}°C</td><td>${r.condicao_embalagem ?? '-'}</td><td><span class="badge ${r.decisao === 'aceito' ? 'badge-ok' : 'badge-nok'}">${r.decisao}</span></td></tr>`)
      .join('');
    printContent('Recebimentos — Açougue', `<h1>Recebimento de Produtos — Açougue</h1><div class="meta">${formatDateTime(new Date().toISOString())}</div><table><thead><tr><th>Hora</th><th>Produto</th><th>Fornecedor</th><th>Temp</th><th>Embalagem</th><th>Decisão</th></tr></thead><tbody>${rows}</tbody></table>`);
  }

  if (loading) return <Loading message="Carregando Açougue..." />;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'recebimento', label: 'Recebimento', icon: <Truck size={18} /> },
    { key: 'higienizacao', label: 'Higienização', icon: <SprayCan size={18} /> },
    { key: 'ocorrencias', label: 'Ocorrências', icon: <AlertTriangle size={18} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Açougue</h2>
          <p className="text-sm text-slate-500">Recebimento, higienização e controle de não conformidades</p>
        </div>
      </div>

      {/* Tabs */}
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

      {/* Recebimento tab */}
      {tab === 'recebimento' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Recebimento de Produtos — Hoje</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" icon={<Download size={16} />} onClick={exportRecebCSV}>CSV</Button>
              <Button variant="outline" size="sm" icon={<Printer size={16} />} onClick={printReceb}>Imprimir</Button>
              <Button size="sm" icon={<Plus size={16} />} onClick={() => setShowRecebModal(true)}>Novo Recebimento</Button>
            </div>
          </div>
          {recebimentos.length > 0 ? (
            <div className="sp-card overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="sp-table-th">Hora</th>
                    <th className="sp-table-th">Produto</th>
                    <th className="sp-table-th">Fornecedor</th>
                    <th className="sp-table-th">Lote</th>
                    <th className="sp-table-th">Validade</th>
                    <th className="sp-table-th">Temp.</th>
                    <th className="sp-table-th">Embalagem</th>
                    <th className="sp-table-th">Decisão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recebimentos.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="sp-table-td whitespace-nowrap">{formatTime(r.created_at)}</td>
                      <td className="sp-table-td font-medium">{r.produto}</td>
                      <td className="sp-table-td">{fornecedores.find((f) => f.id === r.fornecedor_id)?.nome ?? '-'}</td>
                      <td className="sp-table-td">{r.lote ?? '-'}</td>
                      <td className="sp-table-td">{r.validade ? formatDate(r.validade) : '-'}</td>
                      <td className="sp-table-td font-semibold">{r.temperatura != null ? `${r.temperatura}°C` : '-'}</td>
                      <td className="sp-table-td">
                        <Badge variant={r.condicao_embalagem === 'intacta' ? 'success' : 'warning'}>
                          {r.condicao_embalagem ?? '-'}
                        </Badge>
                      </td>
                      <td className="sp-table-td">
                        <Badge variant={r.decisao === 'aceito' ? 'success' : 'danger'}>
                          {r.decisao === 'aceito' ? 'Aceito' : 'Recusado'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="sp-card">
              <EmptyState icon={<Truck size={40} />} title="Nenhum recebimento hoje" description="Registre o recebimento de produtos." />
            </div>
          )}
        </div>
      )}

      {/* Higienização tab */}
      {tab === 'higienizacao' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Higienização — Hoje</h3>
            <Button size="sm" icon={<Plus size={16} />} onClick={() => setShowHigModal(true)}>
              Nova Higienização
            </Button>
          </div>
          {higienizacoes.length > 0 ? (
            <div className="sp-card overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="sp-table-th">Hora</th>
                    <th className="sp-table-th">Tipo</th>
                    <th className="sp-table-th">Alvo</th>
                    <th className="sp-table-th">Produto de Limpeza</th>
                    <th className="sp-table-th">Responsável</th>
                    <th className="sp-table-th">Observação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {higienizacoes.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="sp-table-td whitespace-nowrap">{formatTime(h.created_at)}</td>
                      <td className="sp-table-td"><Badge variant="info">{h.tipo}</Badge></td>
                      <td className="sp-table-td font-medium">{h.alvo}</td>
                      <td className="sp-table-td">{h.produto_limpeza ?? '-'}</td>
                      <td className="sp-table-td">{h.responsavel ?? '-'}</td>
                      <td className="sp-table-td max-w-xs truncate">{h.observacao ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="sp-card">
              <EmptyState icon={<SprayCan size={40} />} title="Nenhuma higienização registrada hoje" />
            </div>
          )}
        </div>
      )}

      {/* Ocorrências tab */}
      {tab === 'ocorrencias' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Ocorrências e Não Conformidades</h3>
            <Button size="sm" icon={<Plus size={16} />} onClick={() => setShowOcorrModal(true)}>
              Nova Ocorrência
            </Button>
          </div>
          {ocorrencias.length > 0 ? (
            <div className="space-y-3">
              {ocorrencias.map((oc) => {
                const acoesOc = acoes.filter((a) => a.ocorrencia_id === oc.id);
                return (
                  <div key={oc.id} className="sp-card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-800">{oc.descricao}</p>
                        <p className="mt-1 text-xs text-slate-400">{formatDateTime(oc.created_at)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="info">{oc.tipo.replace('_', ' ')}</Badge>
                        <Badge variant={oc.severidade === 'critica' ? 'critical' : oc.severidade === 'alta' ? 'danger' : 'warning'}>
                          {oc.severidade}
                        </Badge>
                        <Badge variant={oc.status === 'aberta' ? 'danger' : 'warning'}>
                          {oc.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                    {acoesOc.length > 0 && (
                      <div className="mt-3 space-y-1.5 border-t border-slate-200 pt-3">
                        {acoesOc.map((a) => (
                          <div key={a.id} className="flex items-center gap-2 text-sm">
                            {a.concluida ? <CheckCircle2 size={14} className="text-emerald-500" /> : <XCircle size={14} className="text-amber-500" />}
                            <span className="text-slate-700">{a.descricao}</span>
                            {a.responsavel && <span className="text-xs text-slate-400">— {a.responsavel}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<Wrench size={14} />}
                        onClick={() => { setAcaoTarget(oc.id); setShowAcaoModal(true); }}
                      >
                        Ação Corretiva
                      </Button>
                      <Button
                        variant="success"
                        size="sm"
                        icon={<CheckCircle2 size={14} />}
                        onClick={() => concluirOcorr(oc.id)}
                      >
                        Concluir
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="sp-card">
              <EmptyState icon={<AlertTriangle size={40} />} title="Nenhuma ocorrência aberta" />
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <Modal
        open={showRecebModal}
        onClose={() => setShowRecebModal(false)}
        title="Novo Recebimento de Produto"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowRecebModal(false)}>Cancelar</Button>
            <Button onClick={handleSubmitReceb} loading={recebSubmitting} icon={<CheckCircle2 size={18} />}>Salvar</Button>
          </>
        }
      >
        <div className="space-y-4">
          {recebError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={18} />{recebError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Select label="Fornecedor" value={recebForm.fornecedor_id} onChange={(e) => setRecebForm({ ...recebForm, fornecedor_id: e.target.value })}>
              <option value="">Selecione...</option>
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </Select>
            <Input label="Produto" required value={recebForm.produto} onChange={(e) => setRecebForm({ ...recebForm, produto: e.target.value })} placeholder="Ex: Carne Bovina" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Lote" value={recebForm.lote} onChange={(e) => setRecebForm({ ...recebForm, lote: e.target.value })} />
            <Input label="Validade" type="date" value={recebForm.validade} onChange={(e) => setRecebForm({ ...recebForm, validade: e.target.value })} />
            <Input label="Temperatura (°C)" required type="number" step="0.1" value={recebForm.temperatura} onChange={(e) => setRecebForm({ ...recebForm, temperatura: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Condição da Embalagem" value={recebForm.condicao_embalagem} onChange={(e) => setRecebForm({ ...recebForm, condicao_embalagem: e.target.value as 'intacta' | 'danificada' | 'violada' | 'outra' })}>
              <option value="intacta">Intacta</option>
              <option value="danificada">Danificada</option>
              <option value="violada">Violada</option>
              <option value="outra">Outra</option>
            </Select>
            <Select label="Decisão" required value={recebForm.decisao} onChange={(e) => setRecebForm({ ...recebForm, decisao: e.target.value as Recebimento['decisao'] })}>
              <option value="aceito">Aceito</option>
              <option value="recusado">Recusado</option>
            </Select>
          </div>
          <Textarea label="Observação" value={recebForm.observacao} onChange={(e) => setRecebForm({ ...recebForm, observacao: e.target.value })} />
          <PhotoCapture
            photoUrl={recebForm.foto_url || null}
            onPhotoUploaded={(url) => setRecebForm({ ...recebForm, foto_url: url })}
            onClear={() => setRecebForm({ ...recebForm, foto_url: '' })}
          />
        </div>
      </Modal>

      <Modal
        open={showHigModal}
        onClose={() => setShowHigModal(false)}
        title="Nova Higienização"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowHigModal(false)}>Cancelar</Button>
            <Button onClick={handleSubmitHig} loading={higSubmitting} icon={<CheckCircle2 size={18} />}>Salvar</Button>
          </>
        }
      >
        <div className="space-y-4">
          {higError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={18} />{higError}
            </div>
          )}
          <Select label="Tipo" required value={higForm.tipo} onChange={(e) => setHigForm({ ...higForm, tipo: e.target.value as Higienizacao['tipo'] })}>
            <option value="equipamento">Equipamento</option>
            <option value="utensilio">Utensílio</option>
            <option value="superficie">Superfície</option>
            <option value="ambiente">Ambiente</option>
          </Select>
          <Input label="O que foi higienizado" required value={higForm.alvo} onChange={(e) => setHigForm({ ...higForm, alvo: e.target.value })} placeholder="Ex: Balcão de corte, Facas..." />
          <Input label="Produto de limpeza utilizado" value={higForm.produto_limpeza} onChange={(e) => setHigForm({ ...higForm, produto_limpeza: e.target.value })} />
          <Input label="Responsável" value={higForm.responsavel} onChange={(e) => setHigForm({ ...higForm, responsavel: e.target.value })} />
          <Textarea label="Observação" value={higForm.observacao} onChange={(e) => setHigForm({ ...higForm, observacao: e.target.value })} />
        </div>
      </Modal>

      <Modal
        open={showOcorrModal}
        onClose={() => setShowOcorrModal(false)}
        title="Nova Ocorrência / Não Conformidade"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowOcorrModal(false)}>Cancelar</Button>
            <Button variant="warning" onClick={handleSubmitOcorr} loading={ocorrSubmitting} icon={<AlertTriangle size={18} />}>Registrar</Button>
          </>
        }
      >
        <div className="space-y-4">
          {ocorrError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={18} />{ocorrError}
            </div>
          )}
          <Select label="Tipo" required value={ocorrForm.tipo} onChange={(e) => setOcorrForm({ ...ocorrForm, tipo: e.target.value })}>
            <option value="nao_conformidade">Não Conformidade</option>
            <option value="desvio_temperatura">Desvio de Temperatura</option>
            <option value="recebimento">Recebimento</option>
            <option value="checklist">Checklist</option>
            <option value="outro">Outro</option>
          </Select>
          <Textarea label="Descrição" required value={ocorrForm.descricao} onChange={(e) => setOcorrForm({ ...ocorrForm, descricao: e.target.value })} placeholder="Descreva a ocorrência..." />
          <Select label="Severidade" value={ocorrForm.severidade} onChange={(e) => setOcorrForm({ ...ocorrForm, severidade: e.target.value as Ocorrencia['severidade'] })}>
            <option value="baixa">Baixa</option>
            <option value="media">Média</option>
            <option value="alta">Alta</option>
            <option value="critica">Crítica</option>
          </Select>
        </div>
      </Modal>

      <Modal
        open={showAcaoModal}
        onClose={() => setShowAcaoModal(false)}
        title="Registrar Ação Corretiva"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAcaoModal(false)}>Cancelar</Button>
            <Button variant="warning" onClick={handleSubmitAcao} loading={acaoSubmitting} icon={<Wrench size={18} />}>Salvar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Textarea label="Ação corretiva realizada" required value={acaoForm.descricao} onChange={(e) => setAcaoForm({ ...acaoForm, descricao: e.target.value })} />
          <Input label="Responsável" value={acaoForm.responsavel} onChange={(e) => setAcaoForm({ ...acaoForm, responsavel: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
