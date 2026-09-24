import { useState, useEffect, useCallback } from 'react';
import {
  History,
  Download,
  Printer,
  Filter,
  RotateCcw,
  Thermometer,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select, Input } from '@/components/ui/Form';
import { Loading, EmptyState } from '@/components/ui/Feedback';
import { formatDateTime, formatDate, formatTime, downloadCSV, printContent, nowLocalISO } from '@/lib/utils';
import type { RegistroTemperatura, Equipamento, Setor, Ocorrencia } from '@/lib/types';

type TipoControle = 'temperatura' | 'recebimento' | 'higienizacao' | 'ocorrencias';

export function HistoricoPage() {
  const [loading, setLoading] = useState(true);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);

  const [filtroTipo, setFiltroTipo] = useState<TipoControle>('temperatura');
  const [filtroSetor, setFiltroSetor] = useState('all');
  const [filtroEquip, setFiltroEquip] = useState('all');
  const [filtroSituacao, setFiltroSituacao] = useState('all');
  const [filtroInicio, setFiltroInicio] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  });
  const [filtroFim, setFiltroFim] = useState(nowLocalISO().split('T')[0]);

  const [registros, setRegistros] = useState<(RegistroTemperatura & { equipamento?: Equipamento; setor?: Setor })[]>([]);
  const [recebimentos, setRecebimentos] = useState<any[]>([]);
  const [higienizacoes, setHigienizacoes] = useState<any[]>([]);
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const start = `${filtroInicio}T00:00:00`;
    const end = `${filtroFim}T23:59:59`;

    const [setoresRes, equipRes] = await Promise.all([
      supabase.from('setores').select('*').order('nome'),
      supabase.from('equipamentos').select('*').eq('ativo', true).order('nome'),
    ]);
    setSetores((setoresRes.data ?? []) as Setor[]);
    setEquipamentos((equipRes.data ?? []) as Equipamento[]);

    if (filtroTipo === 'temperatura') {
      let q = supabase
        .from('registros_temperatura')
        .select('*, equipamento:equipamentos(*), setor:setores(*)')
        .gte('horario', start)
        .lte('horario', end)
        .order('horario', { ascending: false });
      if (filtroSetor !== 'all') q = q.eq('setor_id', filtroSetor);
      if (filtroEquip !== 'all') q = q.eq('equipamento_id', filtroEquip);
      if (filtroSituacao === 'dentro') q = q.eq('dentro_parametro', true);
      if (filtroSituacao === 'fora') q = q.eq('dentro_parametro', false);
      const { data } = await q.limit(500);
      setRegistros((data ?? []) as (RegistroTemperatura & { equipamento?: Equipamento; setor?: Setor })[]);
    } else if (filtroTipo === 'recebimento') {
      let q = supabase
        .from('recebimentos')
        .select('*, fornecedor:fornecedores(*)')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });
      if (filtroSetor !== 'all') q = q.eq('setor_id', filtroSetor);
      const { data } = await q.limit(500);
      setRecebimentos(data ?? []);
    } else if (filtroTipo === 'higienizacao') {
      let q = supabase
        .from('higienizacoes')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });
      if (filtroSetor !== 'all') q = q.eq('setor_id', filtroSetor);
      const { data } = await q.limit(500);
      setHigienizacoes(data ?? []);
    } else if (filtroTipo === 'ocorrencias') {
      let q = supabase
        .from('ocorrencias')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });
      if (filtroSetor !== 'all') q = q.eq('setor_id', filtroSetor);
      const { data } = await q.limit(500);
      setOcorrencias((data ?? []) as Ocorrencia[]);
    }

    setLoading(false);
  }, [filtroTipo, filtroSetor, filtroEquip, filtroSituacao, filtroInicio, filtroFim]);

  useEffect(() => {
    load();
  }, [load]);

  function handleExport() {
    if (filtroTipo === 'temperatura') {
      const headers = ['Data/Hora', 'Setor', 'Equipamento', 'Tipo', 'Valor', 'Situação', 'Observação'];
      const rows = registros.map((r) => [
        formatDateTime(r.horario), r.setor?.nome ?? '-',
        r.equipamento?.nome ?? '-', r.tipo_medicao,
        r.valor, r.dentro_parametro ? 'Dentro' : 'Fora', r.observacao ?? '',
      ]);
      downloadCSV('historico_temperaturas.csv', headers, rows);
    } else if (filtroTipo === 'recebimento') {
      const headers = ['Data/Hora', 'Produto', 'Fornecedor', 'Lote', 'Validade', 'Temp.', 'Embalagem', 'Decisão'];
      const rows = recebimentos.map((r) => [
        formatDateTime(r.created_at), r.produto, r.fornecedor?.nome ?? '-',
        r.lote ?? '', r.validade ?? '', r.temperatura ?? '',
        r.condicao_embalagem ?? '', r.decisao,
      ]);
      downloadCSV('historico_recebimentos.csv', headers, rows);
    } else if (filtroTipo === 'higienizacao') {
      const headers = ['Data/Hora', 'Tipo', 'Alvo', 'Produto Limpeza', 'Responsável', 'Observação'];
      const rows = higienizacoes.map((h) => [
        formatDateTime(h.created_at), h.tipo, h.alvo,
        h.produto_limpeza ?? '', h.responsavel ?? '', h.observacao ?? '',
      ]);
      downloadCSV('historico_higienizacoes.csv', headers, rows);
    } else if (filtroTipo === 'ocorrencias') {
      const headers = ['Data/Hora', 'Tipo', 'Severidade', 'Status', 'Descrição'];
      const rows = ocorrencias.map((o) => [
        formatDateTime(o.created_at), o.tipo, o.severidade,
        o.status, o.descricao,
      ]);
      downloadCSV('historico_ocorrencias.csv', headers, rows);
    }
  }

  function handlePrint() {
    let html = '';
    if (filtroTipo === 'temperatura') {
      const rows = registros
        .map((r) => `<tr><td>${formatDateTime(r.horario)}</td><td>${r.setor?.nome ?? '-'}</td><td>${r.equipamento?.nome ?? '-'}</td><td>${r.valor}°C</td><td><span class="badge ${r.dentro_parametro ? 'badge-ok' : 'badge-nok'}">${r.dentro_parametro ? 'Dentro' : 'Fora'}</span></td></tr>`)
        .join('');
      html = `<h1>Histórico de Temperaturas</h1><div class="meta">Período: ${formatDate(filtroInicio)} a ${formatDate(filtroFim)}</div><table><thead><tr><th>Data/Hora</th><th>Setor</th><th>Equipamento</th><th>Valor</th><th>Situação</th></tr></thead><tbody>${rows}</tbody></table>`;
    } else if (filtroTipo === 'recebimento') {
      const rows = recebimentos
        .map((r) => `<tr><td>${formatDateTime(r.created_at)}</td><td>${r.produto}</td><td>${r.fornecedor?.nome ?? '-'}</td><td>${r.temperatura ?? '-'}°C</td><td><span class="badge ${r.decisao === 'aceito' ? 'badge-ok' : 'badge-nok'}">${r.decisao}</span></td></tr>`)
        .join('');
      html = `<h1>Histórico de Recebimentos</h1><div class="meta">Período: ${formatDate(filtroInicio)} a ${formatDate(filtroFim)}</div><table><thead><tr><th>Data/Hora</th><th>Produto</th><th>Fornecedor</th><th>Temp.</th><th>Decisão</th></tr></thead><tbody>${rows}</tbody></table>`;
    } else if (filtroTipo === 'higienizacao') {
      const rows = higienizacoes
        .map((h) => `<tr><td>${formatDateTime(h.created_at)}</td><td>${h.tipo}</td><td>${h.alvo}</td><td>${h.responsavel ?? '-'}</td></tr>`)
        .join('');
      html = `<h1>Histórico de Higienizações</h1><div class="meta">Período: ${formatDate(filtroInicio)} a ${formatDate(filtroFim)}</div><table><thead><tr><th>Data/Hora</th><th>Tipo</th><th>Alvo</th><th>Responsável</th></tr></thead><tbody>${rows}</tbody></table>`;
    } else if (filtroTipo === 'ocorrencias') {
      const rows = ocorrencias
        .map((o) => `<tr><td>${formatDateTime(o.created_at)}</td><td>${o.tipo.replace('_', ' ')}</td><td>${o.severidade}</td><td>${o.status.replace('_', ' ')}</td><td>${o.descricao}</td></tr>`)
        .join('');
      html = `<h1>Histórico de Ocorrências</h1><div class="meta">Período: ${formatDate(filtroInicio)} a ${formatDate(filtroFim)}</div><table><thead><tr><th>Data/Hora</th><th>Tipo</th><th>Severidade</th><th>Status</th><th>Descrição</th></tr></thead><tbody>${rows}</tbody></table>`;
    }
    printContent('Relatório — SuperPoupe', html);
  }

  // Tendência de temperatura
  const tempTrend = registros.length > 0 ? [...registros].reverse() : [];

  if (loading) return <Loading message="Carregando histórico..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Histórico & Relatórios</h2>
          <p className="text-sm text-slate-500">Pesquise registros e gere relatórios para auditoria</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" icon={<Download size={16} />} onClick={handleExport}>Exportar CSV</Button>
          <Button variant="outline" size="sm" icon={<Printer size={16} />} onClick={handlePrint}>Imprimir / PDF</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="sp-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Filter size={18} className="text-slate-500" />
          <h3 className="font-semibold text-slate-700">Filtros</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Select label="Tipo de controle" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as TipoControle)}>
            <option value="temperatura">Temperatura</option>
            <option value="recebimento">Recebimento</option>
            <option value="higienizacao">Higienização</option>
            <option value="ocorrencias">Ocorrências</option>
          </Select>
          <Select label="Setor" value={filtroSetor} onChange={(e) => setFiltroSetor(e.target.value)}>
            <option value="all">Todos</option>
            {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </Select>
          {filtroTipo === 'temperatura' && (
            <>
              <Select label="Equipamento" value={filtroEquip} onChange={(e) => setFiltroEquip(e.target.value)}>
                <option value="all">Todos</option>
                {equipamentos.map((eq) => <option key={eq.id} value={eq.id}>{eq.nome}</option>)}
              </Select>
              <Select label="Situação" value={filtroSituacao} onChange={(e) => setFiltroSituacao(e.target.value)}>
                <option value="all">Todas</option>
                <option value="dentro">Dentro do parâmetro</option>
                <option value="fora">Fora do parâmetro</option>
              </Select>
            </>
          )}
          <Input label="Data inicial" type="date" value={filtroInicio} onChange={(e) => setFiltroInicio(e.target.value)} />
          <Input label="Data final" type="date" value={filtroFim} onChange={(e) => setFiltroFim(e.target.value)} />
        </div>
        <div className="mt-4">
          <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={() => {
            setFiltroSetor('all'); setFiltroEquip('all'); setFiltroSituacao('all');
          }}>
            Limpar filtros
          </Button>
        </div>
      </div>

      {/* Tendência de temperatura (mini chart) */}
      {filtroTipo === 'temperatura' && tempTrend.length > 0 && (
        <div className="sp-card p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-500" />
            <h3 className="font-semibold text-slate-900">Tendência de Temperatura</h3>
          </div>
          <div className="relative h-40 w-full overflow-x-auto">
            <svg className="h-full" style={{ minWidth: `${Math.max(tempTrend.length * 30, 600)}px` }}>
              {(() => {
                const vals = tempTrend.map((r) => r.valor);
                const min = Math.min(...vals) - 2;
                const max = Math.max(...vals) + 2;
                const range = max - min || 1;
                const h = 140;
                const w = 30;
                const points = vals.map((v, i) => `${i * w + 15},${h - ((v - min) / range) * h}`).join(' ');
                return (
                  <>
                    <polyline points={points} fill="none" stroke="#2563eb" strokeWidth="2" />
                    {tempTrend.map((r, i) => {
                      const y = h - ((r.valor - min) / range) * h;
                      return (
                        <circle
                          key={r.id}
                          cx={i * w + 15}
                          cy={y}
                          r="4"
                          fill={r.dentro_parametro ? '#10b981' : '#ef4444'}
                        >
                          <title>{`${r.equipamento?.nome ?? ''}: ${r.valor}°C — ${formatTime(r.horario)}`}</title>
                        </circle>
                      );
                    })}
                  </>
                );
              })()}
            </svg>
          </div>
          <div className="mt-2 flex gap-4 text-xs">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Dentro</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Fora</span>
          </div>
        </div>
      )}

      {/* Results table */}
      <div className="sp-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Resultados</h3>
          <Badge variant="neutral">
            {filtroTipo === 'temperatura' ? registros.length :
             filtroTipo === 'recebimento' ? recebimentos.length :
             filtroTipo === 'higienizacao' ? higienizacoes.length :
             ocorrencias.length} registros
          </Badge>
        </div>

        {filtroTipo === 'temperatura' && (
          registros.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="sp-table-th">Data/Hora</th>
                    <th className="sp-table-th">Setor</th>
                    <th className="sp-table-th">Equipamento</th>
                    <th className="sp-table-th">Valor</th>
                    <th className="sp-table-th">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {registros.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="sp-table-td whitespace-nowrap">{formatDateTime(r.horario)}</td>
                      <td className="sp-table-td">{r.setor?.nome ?? '-'}</td>
                      <td className="sp-table-td font-medium">{r.equipamento?.nome ?? '-'}</td>
                      <td className="sp-table-td font-bold">{r.valor}°C</td>
                      <td className="sp-table-td">
                        <Badge variant={r.dentro_parametro ? 'success' : 'danger'}>
                          {r.dentro_parametro ? 'Dentro' : 'Fora'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<Thermometer size={40} />} title="Nenhum registro encontrado" />
          )
        )}

        {filtroTipo === 'recebimento' && (
          recebimentos.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="sp-table-th">Data/Hora</th>
                    <th className="sp-table-th">Produto</th>
                    <th className="sp-table-th">Fornecedor</th>
                    <th className="sp-table-th">Temp.</th>
                    <th className="sp-table-th">Decisão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recebimentos.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="sp-table-td whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                      <td className="sp-table-td font-medium">{r.produto}</td>
                      <td className="sp-table-td">{r.fornecedor?.nome ?? '-'}</td>
                      <td className="sp-table-td">{r.temperatura ?? '-'}°C</td>
                      <td className="sp-table-td">
                        <Badge variant={r.decisao === 'aceito' ? 'success' : 'danger'}>{r.decisao}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<History size={40} />} title="Nenhum recebimento encontrado" />
          )
        )}

        {filtroTipo === 'higienizacao' && (
          higienizacoes.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="sp-table-th">Data/Hora</th>
                    <th className="sp-table-th">Tipo</th>
                    <th className="sp-table-th">Alvo</th>
                    <th className="sp-table-th">Responsável</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {higienizacoes.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50">
                      <td className="sp-table-td whitespace-nowrap">{formatDateTime(h.created_at)}</td>
                      <td className="sp-table-td"><Badge variant="info">{h.tipo}</Badge></td>
                      <td className="sp-table-td font-medium">{h.alvo}</td>
                      <td className="sp-table-td">{h.responsavel ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<History size={40} />} title="Nenhuma higienização encontrada" />
          )
        )}

        {filtroTipo === 'ocorrencias' && (
          ocorrencias.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="sp-table-th">Data/Hora</th>
                    <th className="sp-table-th">Tipo</th>
                    <th className="sp-table-th">Severidade</th>
                    <th className="sp-table-th">Status</th>
                    <th className="sp-table-th">Descrição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ocorrencias.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="sp-table-td whitespace-nowrap">{formatDateTime(o.created_at)}</td>
                      <td className="sp-table-td"><Badge variant="info">{o.tipo.replace('_', ' ')}</Badge></td>
                      <td className="sp-table-td">
                        <Badge variant={o.severidade === 'critica' ? 'critical' : o.severidade === 'alta' ? 'danger' : 'warning'}>
                          {o.severidade}
                        </Badge>
                      </td>
                      <td className="sp-table-td">
                        <Badge variant={o.status === 'concluida' ? 'success' : o.status === 'aberta' ? 'danger' : 'warning'}>
                          {o.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="sp-table-td max-w-md truncate">{o.descricao}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<AlertTriangle size={40} />} title="Nenhuma ocorrência encontrada" />
          )
        )}
      </div>

      <div className="rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
        Os registros são mantidos por no mínimo 180 dias conforme configuração do sistema.
        Utilize os filtros para pesquisar por período, setor, equipamento e situação.
      </div>
    </div>
  );
}
