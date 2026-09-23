import { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Users,
  Refrigerator,
  Building2,
  ShieldAlert,
  Bell,
  Save,
  Plus,
  Trash2,
  Edit2,
  X,
  Check,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Select, Textarea } from '@/components/ui/Form';
import { Loading, EmptyState } from '@/components/ui/Feedback';
import { formatDateTime } from '@/lib/utils';
import type { Setor, Equipamento, Cargo, Configuracao, Perfil } from '@/lib/types';

type Tab = 'geral' | 'setores' | 'equipamentos' | 'usuarios' | 'alertas';

export function ConfigPage() {
  const { perfil, refreshPerfil } = useAuth();
  const [tab, setTab] = useState<Tab>('geral');
  const [loading, setLoading] = useState(true);

  // Configurações
  const [configs, setConfigs] = useState<Configuracao[]>([]);
  const [configForm, setConfigForm] = useState<Record<string, string>>({});
  const [configSaving, setConfigSaving] = useState(false);

  // Setores
  const [setores, setSetores] = useState<Setor[]>([]);
  const [showSetorModal, setShowSetorModal] = useState(false);
  const [setorForm, setSetorForm] = useState({ nome: '', descricao: '' });
  const [setorSubmitting, setSetorSubmitting] = useState(false);

  // Equipamentos
  const [equipamentos, setEquipamentos] = useState<(Equipamento & { setor?: Setor })[]>([]);
  const [showEquipModal, setShowEquipModal] = useState(false);
  const [equipForm, setEquipForm] = useState({
    nome: '', tipo: 'refrigerador', setor_id: '', ponto_medicao: '',
    temp_min: '', temp_max: '', unidade: '°C', frequencia_horas: '4', min_verificacoes_dia: '2',
  });
  const [equipSubmitting, setEquipSubmitting] = useState(false);

  // Usuários
  const [perfis, setPerfis] = useState<(Perfil & { setor?: Setor; cargo?: Cargo })[]>([]);
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userForm, setUserForm] = useState({ perfil_id: '', nome: '', cargo_id: '', setor_id: '', papel: 'funcionario' as 'admin' | 'funcionario', ativo: true });
  const [userSubmitting, setUserSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [configRes, setoresRes, equipRes, perfisRes, cargosRes] = await Promise.all([
      supabase.from('configuracoes').select('*').order('chave'),
      supabase.from('setores').select('*').order('nome'),
      supabase.from('equipamentos').select('*, setor:setores(*)').order('nome'),
      supabase.from('perfis').select('*, setor:setores(*), cargo:cargos(*)').order('nome'),
      supabase.from('cargos').select('*').order('nome'),
    ]);
    setConfigs((configRes.data ?? []) as Configuracao[]);
    setSetores((setoresRes.data ?? []) as Setor[]);
    setEquipamentos((equipRes.data ?? []) as (Equipamento & { setor?: Setor })[]);
    setPerfis((perfisRes.data ?? []) as (Perfil & { setor?: Setor; cargo?: Cargo })[]);
    setCargos((cargosRes.data ?? []) as Cargo[]);

    // Initialize config form
    const configMap: Record<string, string> = {};
    (configRes.data ?? []).forEach((c: any) => {
      configMap[c.chave] = c.valor;
    });
    setConfigForm(configMap);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveConfigs() {
    setConfigSaving(true);
    const updates = Object.entries(configForm).map(([chave, valor]) =>
      supabase.from('configuracoes').update({ valor, updated_at: new Date().toISOString() }).eq('chave', chave)
    );
    await Promise.all(updates);
    setConfigSaving(false);
    await load();
  }

  async function handleSaveSetor(e: React.FormEvent) {
    e.preventDefault();
    if (!setorForm.nome.trim()) return;
    setSetorSubmitting(true);
    await supabase.from('setores').insert({
      nome: setorForm.nome.trim(),
      descricao: setorForm.descricao || null,
      ativo: true,
    });
    setSetorSubmitting(false);
    setShowSetorModal(false);
    setSetorForm({ nome: '', descricao: '' });
    await load();
  }

  async function handleSaveEquip(e: React.FormEvent) {
    e.preventDefault();
    if (!equipForm.nome.trim() || !equipForm.setor_id) return;
    setEquipSubmitting(true);
    await supabase.from('equipamentos').insert({
      nome: equipForm.nome.trim(),
      tipo: equipForm.tipo,
      setor_id: equipForm.setor_id,
      ponto_medicao: equipForm.ponto_medicao || null,
      temp_min: equipForm.temp_min ? Number(equipForm.temp_min) : null,
      temp_max: equipForm.temp_max ? Number(equipForm.temp_max) : null,
      unidade: equipForm.unidade,
      frequencia_horas: Number(equipForm.frequencia_horas) || 4,
      min_verificacoes_dia: Number(equipForm.min_verificacoes_dia) || 2,
      ativo: true,
    });
    setEquipSubmitting(false);
    setShowEquipModal(false);
    setEquipForm({
      nome: '', tipo: 'refrigerador', setor_id: '', ponto_medicao: '',
      temp_min: '', temp_max: '', unidade: '°C', frequencia_horas: '4', min_verificacoes_dia: '2',
    });
    await load();
  }

  async function handleSaveUser(e: React.FormEvent) {
    e.preventDefault();
    if (!userForm.perfil_id || !userForm.nome.trim()) return;
    setUserSubmitting(true);
    await supabase.from('perfis').update({
      nome: userForm.nome.trim(),
      cargo_id: userForm.cargo_id || null,
      setor_id: userForm.setor_id || null,
      papel: userForm.papel,
      ativo: userForm.ativo,
    }).eq('id', userForm.perfil_id);
    setUserSubmitting(false);
    setShowUserModal(false);
    setUserForm({ perfil_id: '', nome: '', cargo_id: '', setor_id: '', papel: 'funcionario', ativo: true });
    await load();
    if (perfil?.id === userForm.perfil_id) await refreshPerfil();
  }

  async function toggleEquipAtivo(eq: Equipamento) {
    await supabase.from('equipamentos').update({ ativo: !eq.ativo }).eq('id', eq.id);
    await load();
  }

  async function deleteEquip(eq: Equipamento) {
    if (!confirm(`Excluir o equipamento "${eq.nome}"? Esta ação não pode ser desfeita.`)) return;
    await supabase.from('equipamentos').delete().eq('id', eq.id);
    await load();
  }

  if (loading) return <Loading message="Carregando configurações..." />;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'geral', label: 'Geral', icon: <Settings size={18} /> },
    { key: 'setores', label: 'Setores', icon: <Building2 size={18} /> },
    { key: 'equipamentos', label: 'Equipamentos', icon: <Refrigerator size={18} /> },
    { key: 'usuarios', label: 'Usuários', icon: <Users size={18} /> },
    { key: 'alertas', label: 'Alertas', icon: <Bell size={18} /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Configurações</h2>
        <p className="text-sm text-slate-500">Área administrativa — gerencie setores, equipamentos, usuários e parâmetros</p>
      </div>

      {/* Aviso responsável técnico */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
        <ShieldAlert size={20} className="mt-0.5 flex-shrink-0 text-amber-600" />
        <p className="text-sm text-amber-800">
          <strong>Atenção:</strong> Os limites de temperatura, frequências e procedimentos configurados aqui
          devem ser revisados e aprovados pelo responsável técnico antes do uso oficial.
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-lg bg-slate-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex flex-shrink-0 items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition ${
              tab === t.key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Geral */}
      {tab === 'geral' && (
        <div className="sp-card p-5">
          <h3 className="mb-4 font-semibold text-slate-900">Parâmetros Gerais</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Input
                label="Prazo de retenção (dias)"
                type="number"
                value={configForm['retencao_dias'] ?? ''}
                onChange={(e) => setConfigForm({ ...configForm, retencao_dias: e.target.value })}
              />
              <p className="mt-1 text-xs text-slate-400">Mínimo 180 dias conforme referência</p>
            </div>
            <Input
              label="Frequência de medição de alimentos expostos (horas)"
              type="number"
              value={configForm['frequencia_alimentos_expostos_horas'] ?? ''}
              onChange={(e) => setConfigForm({ ...configForm, frequencia_alimentos_expostos_horas: e.target.value })}
            />
            <Input
              label="Mínimo de verificações diárias de equipamentos"
              type="number"
              value={configForm['min_verificacoes_diarias'] ?? ''}
              onChange={(e) => setConfigForm({ ...configForm, min_verificacoes_diarias: e.target.value })}
            />
            <Input
              label="Nome do responsável técnico"
              value={configForm['responsavel_tecnico'] ?? ''}
              onChange={(e) => setConfigForm({ ...configForm, responsavel_tecnico: e.target.value })}
              placeholder="Nome do responsável"
            />
          </div>
          <div className="mt-4">
            <Button icon={<Save size={16} />} loading={configSaving} onClick={saveConfigs}>
              Salvar Configurações
            </Button>
          </div>
        </div>
      )}

      {/* Setores */}
      {tab === 'setores' && (
        <div className="sp-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Setores</h3>
            <Button size="sm" icon={<Plus size={16} />} onClick={() => setShowSetorModal(true)}>Novo Setor</Button>
          </div>
          {setores.length > 0 ? (
            <div className="space-y-2">
              {setores.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                  <div>
                    <p className="font-medium text-slate-800">{s.nome}</p>
                    <p className="text-sm text-slate-400">{s.descricao ?? '-'}</p>
                  </div>
                  <Badge variant={s.ativo ? 'success' : 'neutral'}>{s.ativo ? 'Ativo' : 'Inativo'}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Building2 size={40} />} title="Nenhum setor cadastrado" />
          )}
        </div>
      )}

      {/* Equipamentos */}
      {tab === 'equipamentos' && (
        <div className="sp-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Equipamentos e Pontos de Medição</h3>
            <Button size="sm" icon={<Plus size={16} />} onClick={() => setShowEquipModal(true)}>Novo Equipamento</Button>
          </div>
          {equipamentos.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="sp-table-th">Nome</th>
                    <th className="sp-table-th">Setor</th>
                    <th className="sp-table-th">Tipo</th>
                    <th className="sp-table-th">Faixa</th>
                    <th className="sp-table-th">Frequência</th>
                    <th className="sp-table-th">Status</th>
                    <th className="sp-table-th">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {equipamentos.map((eq) => (
                    <tr key={eq.id} className="hover:bg-slate-50">
                      <td className="sp-table-td font-medium">{eq.nome}</td>
                      <td className="sp-table-td">{eq.setor?.nome ?? '-'}</td>
                      <td className="sp-table-td"><Badge variant="info">{eq.tipo.replace('_', ' ')}</Badge></td>
                      <td className="sp-table-td">
                        {eq.temp_min != null && eq.temp_max != null ? `${eq.temp_min}°C a ${eq.temp_max}°C` : '-'}
                      </td>
                      <td className="sp-table-td">{eq.frequencia_horas}h / {eq.min_verificacoes_dia}x dia</td>
                      <td className="sp-table-td">
                        <Badge variant={eq.ativo ? 'success' : 'neutral'}>{eq.ativo ? 'Ativo' : 'Inativo'}</Badge>
                      </td>
                      <td className="sp-table-td">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => toggleEquipAtivo(eq)}>
                            {eq.ativo ? <X size={14} /> : <Check size={14} />}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteEquip(eq)}>
                            <Trash2 size={14} className="text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<Refrigerator size={40} />} title="Nenhum equipamento cadastrado" />
          )}
        </div>
      )}

      {/* Usuários */}
      {tab === 'usuarios' && (
        <div className="sp-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Usuários e Permissões</h3>
          </div>
          {perfis.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200">
                  <tr>
                    <th className="sp-table-th">Nome</th>
                    <th className="sp-table-th">Cargo</th>
                    <th className="sp-table-th">Setor</th>
                    <th className="sp-table-th">Papel</th>
                    <th className="sp-table-th">Status</th>
                    <th className="sp-table-th">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {perfis.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="sp-table-td font-medium">{p.nome}</td>
                      <td className="sp-table-td">{p.cargo?.nome ?? '-'}</td>
                      <td className="sp-table-td">{p.setor?.nome ?? '-'}</td>
                      <td className="sp-table-td">
                        <Badge variant={p.papel === 'admin' ? 'warning' : 'info'}>
                          {p.papel === 'admin' ? 'Administrador' : 'Funcionário'}
                        </Badge>
                      </td>
                      <td className="sp-table-td">
                        <Badge variant={p.ativo ? 'success' : 'neutral'}>{p.ativo ? 'Ativo' : 'Inativo'}</Badge>
                      </td>
                      <td className="sp-table-td">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Edit2 size={14} />}
                          onClick={() => {
                            setUserForm({
                              perfil_id: p.id,
                              nome: p.nome,
                              cargo_id: p.cargo_id ?? '',
                              setor_id: p.setor_id ?? '',
                              papel: p.papel,
                              ativo: p.ativo,
                            });
                            setShowUserModal(true);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState icon={<Users size={40} />} title="Nenhum usuário cadastrado" />
          )}
        </div>
      )}

      {/* Alertas */}
      {tab === 'alertas' && (
        <div className="sp-card p-5">
          <h3 className="mb-4 font-semibold text-slate-900">Configuração de Notificações</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div>
                <p className="font-medium text-slate-800">Notificação por e-mail</p>
                <p className="text-sm text-slate-400">Enviar alertas de temperatura e ocorrências por e-mail</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={configForm['notificacao_email'] === 'true'}
                  onChange={(e) => setConfigForm({ ...configForm, notificacao_email: e.target.checked ? 'true' : 'false' })}
                />
                <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-5" />
              </label>
            </div>
            <Input
              label="E-mail para alertas"
              value={configForm['email_alertas'] ?? ''}
              onChange={(e) => setConfigForm({ ...configForm, email_alertas: e.target.value })}
              placeholder="alertas@superpoupe.com.br"
            />
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <div>
                <p className="font-medium text-slate-800">Notificação por WhatsApp</p>
                <p className="text-sm text-slate-400">Enviar alertas via WhatsApp (requer configuração adicional)</p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={configForm['notificacao_whatsapp'] === 'true'}
                  onChange={(e) => setConfigForm({ ...configForm, notificacao_whatsapp: e.target.checked ? 'true' : 'false' })}
                />
                <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-5" />
              </label>
            </div>
            <Input
              label="Número de WhatsApp para alertas"
              value={configForm['whatsapp_alertas'] ?? ''}
              onChange={(e) => setConfigForm({ ...configForm, whatsapp_alertas: e.target.value })}
              placeholder="+55 11 99999-9999"
            />
            <Button icon={<Save size={16} />} loading={configSaving} onClick={saveConfigs}>
              Salvar
            </Button>
          </div>
        </div>
      )}

      {/* Modals */}
      <Modal
        open={showSetorModal}
        onClose={() => setShowSetorModal(false)}
        title="Novo Setor"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowSetorModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveSetor} loading={setorSubmitting}>Criar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Nome" required value={setorForm.nome} onChange={(e) => setSetorForm({ ...setorForm, nome: e.target.value })} />
          <Textarea label="Descrição" value={setorForm.descricao} onChange={(e) => setSetorForm({ ...setorForm, descricao: e.target.value })} />
        </div>
      </Modal>

      <Modal
        open={showEquipModal}
        onClose={() => setShowEquipModal(false)}
        title="Novo Equipamento"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowEquipModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveEquip} loading={equipSubmitting}>Criar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nome" required value={equipForm.nome} onChange={(e) => setEquipForm({ ...equipForm, nome: e.target.value })} />
            <Select label="Setor" required value={equipForm.setor_id} onChange={(e) => setEquipForm({ ...equipForm, setor_id: e.target.value })}>
              <option value="">Selecione...</option>
              {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Tipo" value={equipForm.tipo} onChange={(e) => setEquipForm({ ...equipForm, tipo: e.target.value })}>
              <option value="refrigerador">Refrigerador</option>
              <option value="freezer">Freezer</option>
              <option value="camara_fria">Câmara Fria</option>
              <option value="balcao_exposicao">Balcão de Exposição</option>
              <option value="expo_produto">Produto Exposto</option>
              <option value="outro">Outro</option>
            </Select>
            <Input label="Ponto de medição" value={equipForm.ponto_medicao} onChange={(e) => setEquipForm({ ...equipForm, ponto_medicao: e.target.value })} placeholder="Ex: Display frontal" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label="Temp. mínima (°C)" type="number" step="0.1" value={equipForm.temp_min} onChange={(e) => setEquipForm({ ...equipForm, temp_min: e.target.value })} />
            <Input label="Temp. máxima (°C)" type="number" step="0.1" value={equipForm.temp_max} onChange={(e) => setEquipForm({ ...equipForm, temp_max: e.target.value })} />
            <Input label="Unidade" value={equipForm.unidade} onChange={(e) => setEquipForm({ ...equipForm, unidade: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Frequência (horas)" type="number" value={equipForm.frequencia_horas} onChange={(e) => setEquipForm({ ...equipForm, frequencia_horas: e.target.value })} />
            <Input label="Mín. verificações/dia" type="number" value={equipForm.min_verificacoes_dia} onChange={(e) => setEquipForm({ ...equipForm, min_verificacoes_dia: e.target.value })} />
          </div>
        </div>
      </Modal>

      <Modal
        open={showUserModal}
        onClose={() => setShowUserModal(false)}
        title="Editar Usuário"
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowUserModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveUser} loading={userSubmitting}>Salvar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Nome" required value={userForm.nome} onChange={(e) => setUserForm({ ...userForm, nome: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Select label="Cargo" value={userForm.cargo_id} onChange={(e) => setUserForm({ ...userForm, cargo_id: e.target.value })}>
              <option value="">Sem cargo</option>
              {cargos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
            <Select label="Setor" value={userForm.setor_id} onChange={(e) => setUserForm({ ...userForm, setor_id: e.target.value })}>
              <option value="">Sem setor</option>
              {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </Select>
          </div>
          <Select label="Papel" value={userForm.papel} onChange={(e) => setUserForm({ ...userForm, papel: e.target.value as 'admin' | 'funcionario' })}>
            <option value="funcionario">Funcionário</option>
            <option value="admin">Administrador</option>
          </Select>
          <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
            <span className="text-sm font-medium text-slate-700">Usuário ativo</span>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={userForm.ativo}
                onChange={(e) => setUserForm({ ...userForm, ativo: e.target.checked })}
              />
              <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-blue-600 peer-checked:after:translate-x-5" />
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}
