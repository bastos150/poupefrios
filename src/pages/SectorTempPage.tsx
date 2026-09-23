import { useState, useEffect, useCallback } from 'react';
import {
  Thermometer,
  Plus,
  Camera,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Wrench,
  History,
  Filter,
  RotateCcw,
  Clock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Loading, EmptyState } from '@/components/ui/Feedback';
import { PhotoCapture } from '@/components/PhotoCapture';
import { formatDateTime, formatTime, downloadCSV, printContent } from '@/lib/utils';
import type { Equipamento, RegistroTemperatura, Ocorrencia, AcaoCorretiva, Setor } from '@/lib/types';

interface SectorTempPageProps {
  setorNome: string;
  setorId: string;
}

export function SectorTempPage({ setorNome, setorId }: SectorTempPageProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [registros, setRegistros] = useState<(RegistroTemperatura & { equipamento?: Equipamento })[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showAcaoModal, setShowAcaoModal] = useState(false);
  const [registroDesvio, setRegistroDesvio] = useState<RegistroTemperatura | null>(null);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [acoes, setAcoes] = useState<AcaoCorretiva[]>([]);
  const [filtroEquip, setFiltroEquip] = useState('all');
  const [filtroSituacao, setFiltroSituacao] = useState('all');
  const [fotoViewer, setFotoViewer] = useState<string | null>(null);

  // Form state
  const [formEquip, setFormEquip] = useState('');
  const [formValor, setFormValor] = useState('');
  const [formTipo, setFormTipo] = useState<'equipamento' | 'produto_exposto'>('equipamento');
  const [formObs, setFormObs] = useState('');
  const [formFoto, setFormFoto] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Ação corretiva form
  const [acaoDesc, setAcaoDesc] = useState('');
  const [acaoResp, setAcaoResp] = useState('');
  const [acaoSubmitting, setAcaoSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = `${today}T00:00:00`;
    const endOfDay = `${today}T23:59:59`;

    const [eqResult, regResult, ocorrResult] = await Promise.all([
      supabase.from('equipamentos').select('*').eq('setor_id', setorId).eq('ativo', true).order('nome'),
      supabase
        .from('registros_temperatura')
        .select('*, equipamento:equipamentos(*)')
        .eq('setor_id', setorId)
        .gte('horario', startOfDay)
        .lte('horario', endOfDay)
        .order('horario', { ascending: false }),
      supabase
        .from('ocorrencias')
        .select('*')
        .eq('setor_id', setorId)
        .in('status', ['aberta', 'em_tratamento'])
        .order('created_at', { ascending: false }),
    ]);

    setEquipamentos((eqResult.data ?? []) as Equipamento[]);
    setRegistros((regResult.data ?? []) as (RegistroTemperatura & { equipamento?: Equipamento })[]);
    setOcorrencias((ocorrResult.data ?? []) as Ocorrencia[]);

    // Load actions for open occurrences
    if ((ocorrResult.data ?? []).length > 0) {
      const ocorrIds = (ocorrResult.data ?? []).map((o) => o.id);
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

  async function handleSubmitRegistro(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!formEquip) {
      setFormError('Selecione o equipamento ou produto.');
      return;
    }
    if (!formValor || isNaN(Number(formValor))) {
      setFormError('Informe um valor de temperatura válido.');
      return;
    }

    setSubmitting(true);
    const equip = equipamentos.find((eq) => eq.id === formEquip);
    const valor = Number(formValor);
    const dentro =
      equip && equip.temp_min !== null && equip.temp_max !== null
        ? valor >= equip.temp_min && valor <= equip.temp_max
        : true;

    const { data, error } = await supabase
      .from('registros_temperatura')
      .insert({
        setor_id: setorId,
        equipamento_id: formTipo === 'equipamento' ? formEquip : null,
        produto_id: formTipo === 'produto_exposto' ? formEquip : null,
        tipo_medicao: formTipo,
        valor,
        unidade: equip?.unidade ?? '°C',
        horario: new Date().toISOString(),
        dentro_parametro: dentro,
        observacao: formObs || null,
        foto_url: formFoto || null,
        user_id: user?.id,
      })
      .select()
      .single();

    setSubmitting(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    // If outside parameter, open an occurrence and create alert
    if (!dentro && data) {
      const { data: ocorrData } = await supabase
        .from('ocorrencias')
        .insert({
          setor_id: setorId,
          tipo: 'desvio_temperatura',
          origem_tabela: 'registros_temperatura',
          origem_id: data.id,
          descricao: `Temperatura fora do parâmetro: ${equip?.nome ?? 'Equipamento'} — ${valor}°C (faixa: ${equip?.temp_min}°C a ${equip?.temp_max}°C)`,
          severidade: 'alta',
          status: 'aberta',
          user_id: user?.id,
        })
        .select()
        .single();

      await supabase.from('alertas').insert({
        tipo: 'temperatura_fora',
        setor_id: setorId,
        equipamento_id: equip?.id,
        origem_id: data.id,
        mensagem: `${equip?.nome ?? 'Equipamento'}: leitura ${valor}°C fora da faixa (${equip?.temp_min}°C a ${equip?.temp_max}°C)`,
        severidade: 'alta',
        lido: false,
      });

      if (ocorrData) {
        setRegistroDesvio(data as RegistroTemperatura);
        setShowModal(false);
        resetForm();
        setShowAcaoModal(true);
        await load();
        return;
      }
    }

    setShowModal(false);
    resetForm();
    await load();
  }

  function resetForm() {
    setFormEquip('');
    setFormValor('');
    setFormTipo('equipamento');
    setFormObs('');
    setFormFoto('');
    setFormError(null);
  }

  async function handleSubmitAcao(e: React.FormEvent) {
    e.preventDefault();
    if (!acaoDesc.trim() || !registroDesvio) return;
    setAcaoSubmitting(true);

    // Find the occurrence linked to this registro
    const { data: ocorr } = await supabase
      .from('ocorrencias')
      .select('*')
      .eq('origem_id', registroDesvio.id)
      .maybeSingle();

    if (ocorr) {
      await supabase.from('acoes_corretivas').insert({
        ocorrencia_id: ocorr.id,
        descricao: acaoDesc.trim(),
        responsavel: acaoResp.trim() || null,
        horario: new Date().toISOString(),
        user_id: user?.id,
      });

      await supabase
        .from('ocorrencias')
        .update({ status: 'em_tratamento' })
        .eq('id', ocorr.id);
    }

    setAcaoSubmitting(false);
    setShowAcaoModal(false);
    setAcaoDesc('');
    setAcaoResp('');
    setRegistroDesvio(null);
    await load();
  }

  function handleExportCSV() {
    const headers = ['Horário', 'Equipamento/Produto', 'Tipo', 'Valor', 'Unidade', 'Situação', 'Observação', 'Usuário'];
    const rows = registros.map((r) => [
      formatDateTime(r.horario),
      r.equipamento?.nome ?? '-',
      r.tipo_medicao === 'equipamento' ? 'Equipamento' : 'Produto Exposto',
      r.valor,
      r.unidade,
      r.dentro_parametro ? 'Dentro' : 'Fora',
      r.observacao ?? '',
      r.user_id,
    ]);
    downloadCSV(`registros_temperatura_${setorNome}_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  }

  function handlePrint() {
    const rows = registros
      .map(
        (r) =>
          `<tr><td>${formatTime(r.horario)}</td><td>${r.equipamento?.nome ?? '-'}</td><td>${r.valor}°C</td><td><span class="badge ${r.dentro_parametro ? 'badge-ok' : 'badge-nok'}">${r.dentro_parametro ? 'Dentro' : 'Fora'}</span></td><td>${r.observacao ?? ''}</td></tr>`
      )
      .join('');
    printContent(
      `Registros de Temperatura — ${setorNome}`,
      `<h1>Registros de Temperatura — ${setorNome}</h1><div class="meta">Data: ${formatDateTime(new Date().toISOString())}</div><table><thead><tr><th>Horário</th><th>Equipamento</th><th>Valor</th><th>Situação</th><th>Observação</th></tr></thead><tbody>${rows}</tbody></table>`
    );
  }

  const filteredRegistros = registros.filter((r) => {
    if (filtroEquip !== 'all' && r.equipamento_id !== filtroEquip) return false;
    if (filtroSituacao === 'dentro' && !r.dentro_parametro) return false;
    if (filtroSituacao === 'fora' && r.dentro_parametro) return false;
    return true;
  });

  if (loading) return <Loading message={`Carregando ${setorNome}...`} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{setorNome}</h2>
          <p className="text-sm text-slate-500">Registro de temperaturas e controle operacional</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" icon={<History size={16} />} onClick={handleExportCSV}>
            Exportar CSV
          </Button>
          <Button variant="outline" size="sm" icon={<History size={16} />} onClick={handlePrint}>
            Imprimir
          </Button>
          <Button size="md" icon={<Plus size={18} />} onClick={() => setShowModal(true)}>
            Nova Leitura
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="sp-card p-4">
          <div className="flex items-center gap-2">
            <Thermometer size={18} className="text-blue-500" />
            <span className="text-sm text-slate-600">Leituras hoje</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">{registros.length}</p>
        </div>
        <div className="sp-card p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-500" />
            <span className="text-sm text-slate-600">Dentro do parâmetro</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {registros.filter((r) => r.dentro_parametro).length}
          </p>
        </div>
        <div className="sp-card p-4">
          <div className="flex items-center gap-2">
            <XCircle size={18} className="text-red-500" />
            <span className="text-sm text-slate-600">Fora do parâmetro</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-red-600">
            {registros.filter((r) => !r.dentro_parametro).length}
          </p>
        </div>
        <div className="sp-card p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-orange-500" />
            <span className="text-sm text-slate-600">Ocorrências abertas</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-orange-600">{ocorrencias.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="sp-card p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-56">
            <Select label="Equipamento" value={filtroEquip} onChange={(e) => setFiltroEquip(e.target.value)}>
              <option value="all">Todos</option>
              {equipamentos.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.nome}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-44">
            <Select label="Situação" value={filtroSituacao} onChange={(e) => setFiltroSituacao(e.target.value)}>
              <option value="all">Todas</option>
              <option value="dentro">Dentro do parâmetro</option>
              <option value="fora">Fora do parâmetro</option>
            </Select>
          </div>
          <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={() => { setFiltroEquip('all'); setFiltroSituacao('all'); }}>
            Limpar
          </Button>
        </div>
      </div>

      {/* Registros table */}
      <div className="sp-card p-5">
        <h3 className="mb-4 font-semibold text-slate-900">Registros de Hoje</h3>
        {filteredRegistros.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="sp-table-th">Horário</th>
                  <th className="sp-table-th">Equipamento/Produto</th>
                  <th className="sp-table-th">Tipo</th>
                  <th className="sp-table-th">Valor</th>
                  <th className="sp-table-th">Parâmetro</th>
                  <th className="sp-table-th">Situação</th>
                  <th className="sp-table-th">Foto</th>
                  <th className="sp-table-th">Observação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRegistros.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="sp-table-td whitespace-nowrap">{formatTime(r.horario)}</td>
                    <td className="sp-table-td font-medium">{r.equipamento?.nome ?? '-'}</td>
                    <td className="sp-table-td">
                      {r.tipo_medicao === 'equipamento' ? 'Equipamento' : 'Produto Exposto'}
                    </td>
                    <td className="sp-table-td font-bold">{r.valor}°C</td>
                    <td className="sp-table-td text-xs text-slate-500">
                      {r.equipamento?.temp_min != null && r.equipamento?.temp_max != null
                        ? `${r.equipamento.temp_min}°C a ${r.equipamento.temp_max}°C`
                        : '-'}
                    </td>
                    <td className="sp-table-td">
                      {r.dentro_parametro ? (
                        <Badge variant="success">Dentro</Badge>
                      ) : (
                        <Badge variant="danger">Fora</Badge>
                      )}
                    </td>
                    <td className="sp-table-td">
                      {r.foto_url ? (
                        <button onClick={() => setFotoViewer(r.foto_url)} className="rounded-lg overflow-hidden border border-slate-200 hover:border-blue-400 transition">
                          <img src={r.foto_url} alt="Evidência" className="h-12 w-12 object-cover" />
                        </button>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="sp-table-td max-w-xs truncate">{r.observacao ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Thermometer size={40} />}
            title="Nenhum registro encontrado"
            description="Clique em 'Nova Leitura' para registrar a temperatura."
          />
        )}
      </div>

      {/* Ocorrências and actions */}
      {ocorrencias.length > 0 && (
        <div className="sp-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Wrench size={20} className="text-orange-500" />
            <h3 className="font-semibold text-slate-900">Ocorrências e Ações Corretivas</h3>
          </div>
          <div className="space-y-3">
            {ocorrencias.map((oc) => {
              const acoesOc = acoes.filter((a) => a.ocorrencia_id === oc.id);
              return (
                <div key={oc.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{oc.descricao}</p>
                      <p className="mt-1 text-xs text-slate-400">{formatDateTime(oc.created_at)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="info">{oc.tipo.replace('_', ' ')}</Badge>
                      <Badge
                        variant={
                          oc.severidade === 'critica'
                            ? 'critical'
                            : oc.severidade === 'alta'
                            ? 'danger'
                            : 'warning'
                        }
                      >
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
                          {a.concluida ? (
                            <CheckCircle2 size={14} className="text-emerald-500" />
                          ) : (
                            <Clock size={14} className="text-amber-500" />
                          )}
                          <span className="text-slate-700">{a.descricao}</span>
                          {a.responsavel && (
                            <span className="text-xs text-slate-400">— {a.responsavel}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* New reading modal */}
      <Modal
        open={showModal}
        onClose={() => { setShowModal(false); resetForm(); }}
        title="Nova Leitura de Temperatura"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setShowModal(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitRegistro} loading={submitting} icon={<CheckCircle2 size={18} />}>
              Salvar Registro
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              <AlertTriangle size={18} />
              {formError}
            </div>
          )}
          <div>
            <label className="sp-label">Tipo de medição <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setFormTipo('equipamento'); setFormEquip(''); }}
                className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition ${
                  formTipo === 'equipamento'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Equipamento
              </button>
              <button
                type="button"
                onClick={() => { setFormTipo('produto_exposto'); setFormEquip(''); }}
                className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition ${
                  formTipo === 'produto_exposto'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Produto Exposto
              </button>
            </div>
          </div>
          <Select
            label={formTipo === 'equipamento' ? 'Equipamento' : 'Produto/Ponto de medição'}
            required
            value={formEquip}
            onChange={(e) => setFormEquip(e.target.value)}
          >
            <option value="">Selecione...</option>
            {equipamentos
              .filter((eq) => (formTipo === 'equipamento' ? eq.tipo !== 'expo_produto' : eq.tipo === 'expo_produto' || eq.tipo === 'balcao_exposicao'))
              .map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.nome} {eq.temp_min != null && eq.temp_max != null ? `(${eq.temp_min}°C a ${eq.temp_max}°C)` : ''}
                </option>
              ))}
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Temperatura"
              required
              type="number"
              step="0.1"
              placeholder="Ex: 4.5"
              value={formValor}
              onChange={(e) => setFormValor(e.target.value)}
            />
            <div>
              <label className="sp-label">Unidade</label>
              <input className="sp-input bg-slate-100" value="°C" disabled />
            </div>
          </div>
          <Textarea
            label="Observação"
            value={formObs}
            onChange={(e) => setFormObs(e.target.value)}
            placeholder="Observações sobre a leitura..."
          />
          <PhotoCapture
            photoUrl={formFoto || null}
            onPhotoUploaded={(url) => setFormFoto(url)}
            onClear={() => setFormFoto('')}
          />
          {formEquip && (
            <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
              {(() => {
                const eq = equipamentos.find((e) => e.id === formEquip);
                if (eq && eq.temp_min !== null && eq.temp_max !== null) {
                  return `Faixa aceitável: ${eq.temp_min}°C a ${eq.temp_max}°C`;
                }
                return 'Sem limites cadastrados — verificação manual.';
              })()}
            </div>
          )}
        </div>
      </Modal>

      {/* Foto viewer modal */}
      <Modal
        open={!!fotoViewer}
        onClose={() => setFotoViewer(null)}
        title="Foto da Evidência"
        size="lg"
        footer={<Button variant="ghost" onClick={() => setFotoViewer(null)}>Fechar</Button>}
      >
        {fotoViewer && (
          <div className="flex justify-center">
            <img src={fotoViewer} alt="Evidência" className="max-h-[60vh] rounded-lg" />
          </div>
        )}
      </Modal>

      {/* Ação corretiva modal */}
      <Modal
        open={showAcaoModal}
        onClose={() => setShowAcaoModal(false)}
        title="Registrar Ação Corretiva"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAcaoModal(false)}>
              Depois
            </Button>
            <Button variant="warning" onClick={handleSubmitAcao} loading={acaoSubmitting} icon={<Wrench size={18} />}>
              Salvar Ação
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-red-50 px-4 py-3">
            <AlertTriangle size={20} className="text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-800">Temperatura fora do parâmetro detectada!</p>
              <p className="text-xs text-red-600">
                {registroDesvio && `${registroDesvio.valor}°C`}
              </p>
            </div>
          </div>
          <Textarea
            label="Ação corretiva realizada"
            required
            value={acaoDesc}
            onChange={(e) => setAcaoDesc(e.target.value)}
            placeholder="Descreva a ação tomada..."
          />
          <Input
            label="Responsável"
            value={acaoResp}
            onChange={(e) => setAcaoResp(e.target.value)}
            placeholder="Nome do responsável"
          />
        </div>
      </Modal>
    </div>
  );
}
