import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Layout, type PageKey } from '@/components/Layout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SectorTempPage } from '@/pages/SectorTempPage';
import { AcouguePage } from '@/pages/AcouguePage';
import { ChecklistsPage } from '@/pages/ChecklistsPage';
import { HistoricoPage } from '@/pages/HistoricoPage';
import { ConfigPage } from '@/pages/ConfigPage';
import { OperacionalPage } from '@/pages/OperacionalPage';
import { Loading } from '@/components/ui/Feedback';
import type { Setor } from '@/lib/types';

function AppContent() {
  const { session, loading, perfil } = useAuth();
  const [page, setPage] = useState<PageKey>('dashboard');
  const [setores, setSetores] = useState<Setor[]>([]);
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    if (session) {
      supabase.from('setores').select('*').order('nome').then(({ data }) => {
        setSetores((data ?? []) as Setor[]);
      });
      // Count unread alerts
      supabase.from('alertas').select('id', { count: 'exact', head: true }).eq('lido', false).then(({ count }) => {
        setAlertCount(count ?? 0);
      });
    }
  }, [session]);

  // Guard admin-only pages — must run before any conditional return
  useEffect(() => {
    if (page === 'config' && perfil?.papel !== 'admin') {
      setPage('dashboard');
    }
  }, [page, perfil]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loading message="Carregando..." />
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  const friosSetor = setores.find((s) => s.nome === 'Frios');
  const acougueSetor = setores.find((s) => s.nome === 'Açougue');
  const padariaSetor = setores.find((s) => s.nome === 'Padaria');

  function renderPage() {
    switch (page) {
      case 'dashboard':
        return <DashboardPage />;
      case 'frios':
        return friosSetor ? (
          <SectorTempPage setorNome="Frios" setorId={friosSetor.id} />
        ) : (
          <Loading message="Carregando setores..." />
        );
      case 'acougue':
        return acougueSetor ? <AcouguePage setorId={acougueSetor.id} /> : <Loading message="Carregando..." />;
      case 'padaria':
        return padariaSetor ? (
          <SectorTempPage setorNome="Padaria" setorId={padariaSetor.id} />
        ) : (
          <Loading message="Carregando setores..." />
        );
      case 'checklists':
        return <ChecklistsPage />;
      case 'operacional':
        return <OperacionalPage />;
      case 'historico':
        return <HistoricoPage />;
      case 'config':
        return <ConfigPage />;
      default:
        return <DashboardPage />;
    }
  }

  return (
    <Layout current={page} onNavigate={setPage} alertCount={alertCount}>
      {renderPage()}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
