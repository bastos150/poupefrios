import { useState, useEffect, useCallback } from 'react';
import {
  Thermometer,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ClipboardCheck,
  Wrench,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Form';
import { Loading, EmptyState } from '@/components/ui/Feedback';
import { formatDateTime, formatTime } from '@/lib/utils';
import type { RegistroTemperatura, Ocorrencia, Alerta, ChecklistExecucao, Equipamento, Setor } from '@/lib/types';

interface DashboardData {
  tempPendentes: number;
  tempConcluidas: number;
  equipFora: Equipamento[];
  checklistsPendentes: ChecklistExecucao[];
  alertas: Alerta[];
  ocorrenciasAbertas: Ocorrencia[];
  registrosHoje: (RegistroTemperatura & { equipamento?: Equipamento })[];
}

export function DashboardPage() {
  const { perfil } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [filtroSetor, setFiltroSetor] = useState<string>('all');
  const [filtroData, setFiltroData] = useState<string>(new Date().toISOString().split('T')[0]);

  const load = useCallback(async () => {
    setLoading(true);
    const today = filtroData;
    const startOfDay = `${today}T00:00:00`;
    const endOfDay = `${today}T23:59:59`;

    let setorFilter = filtroSetor === 'all' ? {} : { setor_id: filtroSetor };

    const [
      tempResult,
      equipResult,
      chkResult,
      alertResult,
      ocorrResult,
      setoresResult,
      equipamentosResult,
    ] = await Promise.all([
      supabase
        .from('registros_temperatura')
        .select('*, equipamento:equipamentos(*)')
        .gte('horario', startOfDay)
        .lte('horario', endOfDay)
        .match(setorFilter)
        .order('horario', { ascending: false }),
      supabase.from('equipamentos').select('*').eq('ativo', true).match(setorFilter),
      supabase
        .from('checklist_execucoes')
        .select('*, checklist_modelo:checklists_modelos(*)')
        .in('status', ['pendente', 'em_andamento'])
        .order('created_at', { ascending: false }),
      supabase
        .from('alertas')
        .select('*')
        .eq('lido', false)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('ocorrencias')
        .select('*')
        .in('status', ['aberta', 'em_tratamento'])
        .order('created_at', { ascending: false })
        .limit(20),
      supabase.from('setores').select('*').order('nome'),
      supabase.from('equipamentos').select('*').eq('ativo', true).order('nome'),
    ]);

    const registros = (tempResult.data ?? []) as (RegistroTemperatura & { equipamento?: Equipamento })[];
    const equipamentosData = (equipResult.data ?? []) as Equipamento[];
    const checklists = (chkResult.data ?? []) as ChecklistExecucao[];
    const alertas = (alertResult.data ?? []) as Alerta[];
    const ocorrencias = (ocorrResult.data ?? []) as Ocorrencia[];

    // Equipamentos com leitura fora do parâmetro
    const equipFora = equipamentosData.filter((eq) => {
      const regsForEquip = registros.filter((r) => r.equipamento_id === eq.id);
      if (regsForEquip.length === 0) return false;
      return regsForEquip.some((r) => !r.dentro_parametro);
    });

    // Equipamentos sem registro hoje (pendentes)
    const equipComReg = new Set(registros.map((r) => r.equipamento_id));
    const equipPendentes = equipamentosData.filter((eq) => !equipComReg.has(eq.id));

    setData({
      tempPendentes: equipPendentes.length,
      tempConcluidas: registros.length,
      equipFora,
      checklistsPendentes: checklists,
      alertas,
      ocorrenciasAbertas: ocorrencias,
      registrosHoje: registros,
    });
    setSetores((setoresResult.data ?? []) as Setor[]);
    setEquipamentos(equipamentosData);
    setLoading(false);
  }, [filtroSetor, filtroData]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loading message="Carregando painel..." />;

  const stats = [
    {
      label: 'Registros de Temperatura Hoje',
      value: data?.tempConcluidas ?? 0,
      sub: `${data?.tempPendentes ?? 0} equipamentos pendentes`,
      icon: <Thermometer size={24} />,
      color: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Equipamentos Fora do Parâmetro',
      value: data?.equipFora.length ?? 0,
      sub: 'Requerem ação corretiva',
      icon: <AlertTriangle size={24} />,
      color: 'bg-red-50 text-red-700',
    },
    {
      label: 'Checklists Pendentes',
      value: data?.checklistsPendentes.length ?? 0,
      sub: 'Aguardando execução',
      icon: <ClipboardCheck size={24} />,
      color: 'bg-amber-50 text-amber-700',
    },
    {
      label: 'Ocorrências Abertas',
      value: data?.ocorrenciasAbertas.length ?? 0,
      sub: 'Em tratamento ou abertas',
      icon: <Wrench size={24} />,
      color: 'bg-orange-50 text-orange-700',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Painel Inicial</h2>
          <p className="text-sm text-slate-500">Visão geral dos controles operacionais do dia</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Select
              label="Data"
              value={filtroData}
              onChange={(e) => setFiltroData(e.target.value)}
            >
              {[0, 1, 2, 3, 4].map((offset) => {
                const d = new Date();
                d.setDate(d.getDate() - offset);
                const iso = d.toISOString().split('T')[0];
                return (
                  <option key={iso} value={iso}>
                    {d.toLocaleDateString('pt-BR')}
                  </option>
                );
              })}
            </Select>
          </div>
          <div className="w-44">
            <Select label="Setor" value={filtroSetor} onChange={(e) => setFiltroSetor(e.target.value)}>
              <option value="all">Todos os setores</option>
              {setores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </Select>
          </div>
          <Button variant="outline" icon={<RefreshCw size={16} />} onClick={load}>
            Atualizar
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat, i) => (
          <div key={i} className="sp-card p-5">
            <div className="flex items-center justify-between">
              <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.color}`}>
                {stat.icon}
              </div>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{stat.value}</p>
            <p className="text-sm font-medium text-slate-600">{stat.label}</p>
            <p className="mt-1 text-xs text-slate-400">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Alerts */}
      {data && data.alertas.length > 0 && (
        <div className="sp-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-500" />
            <h3 className="font-semibold text-slate-900">Alertas Ativos</h3>
            <Badge variant="danger">{data.alertas.length}</Badge>
          </div>
          <div className="space-y-2">
            {data.alertas.map((alerta) => (
              <div
                key={alerta.id}
                className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <div
                  className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                    alerta.severidade === 'critica' || alerta.severidade === 'alta'
                      ? 'bg-red-100 text-red-600'
                      : 'bg-amber-100 text-amber-600'
                  }`}
                >
                  <AlertTriangle size={16} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-slate-800">{alerta.mensagem}</p>
                  <p className="text-xs text-slate-400">{formatDateTime(alerta.created_at)}</p>
                </div>
                <Badge
                  variant={
                    alerta.severidade === 'critica'
                      ? 'critical'
                      : alerta.severidade === 'alta'
                      ? 'danger'
                      : 'warning'
                  }
                >
                  {alerta.severidade}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Equipamentos fora do parâmetro */}
        <div className="sp-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <XCircle size={20} className="text-red-500" />
            <h3 className="font-semibold text-slate-900">Equipamentos Fora do Parâmetro</h3>
          </div>
          {data && data.equipFora.length > 0 ? (
            <div className="space-y-2">
              {data.equipFora.map((eq) => {
                const regsFora = data.registrosHoje.filter(
                  (r) => r.equipamento_id === eq.id && !r.dentro_parametro
                );
                return (
                  <div key={eq.id} className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-800">{eq.nome}</p>
                      <Badge variant="danger">Fora</Badge>
                    </div>
                    {regsFora.map((r) => (
                      <div key={r.id} className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                        <Clock size={12} />
                        {formatTime(r.horario)} — {r.valor}°C
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<CheckCircle2 size={40} />}
              title="Todos os equipamentos dentro do parâmetro"
            />
          )}
        </div>

        {/* Ocorrências abertas */}
        <div className="sp-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <Wrench size={20} className="text-orange-500" />
            <h3 className="font-semibold text-slate-900">Ocorrências Abertas</h3>
          </div>
          {data && data.ocorrenciasAbertas.length > 0 ? (
            <div className="space-y-2">
              {data.ocorrenciasAbertas.map((oc) => (
                <div key={oc.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-800">{oc.descricao}</p>
                    <Badge
                      variant={
                        oc.severidade === 'critica'
                          ? 'critical'
                          : oc.severidade === 'alta'
                          ? 'danger'
                          : oc.severidade === 'media'
                          ? 'warning'
                          : 'neutral'
                      }
                    >
                      {oc.severidade}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-slate-400">
                    <Badge variant="info">{oc.tipo.replace('_', ' ')}</Badge>
                    <span>{formatDateTime(oc.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<CheckCircle2 size={40} />} title="Nenhuma ocorrência aberta" />
          )}
        </div>
      </div>

      {/* Registros de hoje */}
      <div className="sp-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Thermometer size={20} className="text-blue-500" />
          <h3 className="font-semibold text-slate-900">Registros de Temperatura do Dia</h3>
          <Badge variant="info">{data?.registrosHoje.length ?? 0}</Badge>
        </div>
        {data && data.registrosHoje.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200">
                <tr>
                  <th className="sp-table-th">Horário</th>
                  <th className="sp-table-th">Equipamento/Produto</th>
                  <th className="sp-table-th">Valor</th>
                  <th className="sp-table-th">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.registrosHoje.slice(0, 10).map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="sp-table-td">{formatTime(r.horario)}</td>
                    <td className="sp-table-td">{r.equipamento?.nome ?? '-'}</td>
                    <td className="sp-table-td font-semibold">
                      {r.valor}°C
                    </td>
                    <td className="sp-table-td">
                      {r.dentro_parametro ? (
                        <Badge variant="success">Dentro</Badge>
                      ) : (
                        <Badge variant="danger">Fora</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<Thermometer size={40} />}
            title="Nenhum registro de temperatura hoje"
            description="Os registros aparecerão aqui assim que a equipe fizer as leituras."
          />
        )}
      </div>
    </div>
  );
}
