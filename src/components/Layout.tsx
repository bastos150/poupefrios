import { ReactNode, useState } from 'react';
import {
  LayoutDashboard,
  Snowflake,
  Beef,
  Croissant,
  ClipboardCheck,
  History,
  Settings,
  LogOut,
  Menu,
  X,
  AlertTriangle,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Badge } from '@/components/ui/Badge';

export type PageKey =
  | 'dashboard'
  | 'frios'
  | 'acougue'
  | 'padaria'
  | 'checklists'
  | 'historico'
  | 'config';

interface NavItem {
  key: PageKey;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { key: 'dashboard', label: 'Painel Inicial', icon: <LayoutDashboard size={20} /> },
  { key: 'frios', label: 'Frios', icon: <Snowflake size={20} /> },
  { key: 'acougue', label: 'Açougue', icon: <Beef size={20} /> },
  { key: 'padaria', label: 'Padaria', icon: <Croissant size={20} /> },
  { key: 'checklists', label: 'Checklists & POPs', icon: <ClipboardCheck size={20} /> },
  { key: 'historico', label: 'Histórico & Relatórios', icon: <History size={20} /> },
  { key: 'config', label: 'Configurações', icon: <Settings size={20} />, adminOnly: true },
];

interface LayoutProps {
  current: PageKey;
  onNavigate: (page: PageKey) => void;
  children: ReactNode;
  alertCount?: number;
}

export function Layout({ current, onNavigate, children, alertCount = 0 }: LayoutProps) {
  const { perfil, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = perfil?.papel === 'admin';

  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  const sidebar = (
    <div className="flex h-full flex-col bg-blue-800 text-white">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-blue-700">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-400 text-blue-900">
          <ShieldCheck size={24} />
        </div>
        <div>
          <h1 className="text-base font-bold leading-tight">SuperPoupe</h1>
          <p className="text-xs text-blue-200">Boas Práticas</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => (
          <button
            key={item.key}
            onClick={() => {
              onNavigate(item.key);
              setMobileOpen(false);
            }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              current === item.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-blue-100 hover:bg-blue-700 hover:text-white'
            }`}
          >
            {item.icon}
            <span className="flex-1 text-left">{item.label}</span>
            {item.key === 'dashboard' && alertCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-bold text-white">
                {alertCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="border-t border-blue-700 px-3 py-3">
        <div className="mb-2 px-3 py-2">
          <p className="text-sm font-medium text-white">{perfil?.nome ?? 'Usuário'}</p>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={isAdmin ? 'warning' : 'info'}>
              {isAdmin ? 'Administrador' : 'Funcionário'}
            </Badge>
          </div>
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-blue-100 transition hover:bg-blue-700 hover:text-white"
        >
          <LogOut size={20} />
          Sair
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <div className="hidden w-64 flex-shrink-0 lg:block">{sidebar}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-64 animate-slide-in">{sidebar}</div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} className="text-amber-500" />
              <span className="text-sm text-slate-500">
                {new Date().toLocaleDateString('pt-BR', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="neutral">São Paulo, SP</Badge>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
