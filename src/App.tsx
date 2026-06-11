import React, { useState } from 'react';
import { QuinielaProvider, useQuiniela } from './context/QuinielaContext';
import { Header } from './components/Header';
import { PartidosTab } from './components/PartidosTab';
import { QuinielaLeaderboard } from './components/QuinielaLeaderboard';
import { ChatTab } from './components/ChatTab';
import { AlertsTab } from './components/AlertsTab';
import { AdminPanel } from './components/AdminPanel';
import { AuthModal } from './components/AuthModal';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, ShieldAlert, Sparkles, Footprints, Flame } from 'lucide-react';

function QuinielaDashboard() {
  const { user, loading, isAdminUser } = useQuiniela();
  const [activeTab, setActiveTab] = useState('partidos');

  // Loading Splash Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden" id="app-loader">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.07)_0,transparent_60%)] pointer-events-none" />
        
        {/* Animated Trophy Container */}
        <motion.div 
          animate={{ scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
          className="bg-emerald-500 text-slate-950 p-4.5 rounded-3xl shadow-2xl shadow-emerald-500/20 mb-5 relative z-10"
        >
          <Trophy className="w-10 h-10" />
        </motion.div>

        <h3 className="text-white text-base font-black tracking-widest uppercase font-mono">Cargando Quiniela...</h3>
        <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-widest">Preparando Césped Oficial 🏟️</p>
        
        {/* Loading Bar */}
        <div className="w-40 h-1 bg-slate-900 rounded-full mt-6 overflow-hidden relative border border-slate-800">
          <motion.div 
            initial={{ left: '-100%' }}
            animate={{ left: '100%' }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            className="absolute top-0 bottom-0 w-1/2 bg-emerald-500"
          />
        </div>
      </div>
    );
  }

  // Verification: Unregistered / Onboarding view
  if (!user) {
    return <AuthModal />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-emerald-500 selection:text-slate-950">
      
      {/* Dynamic Header navbar */}
      <Header activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Tab Board Workspace */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="focus:outline-none"
          >
            {activeTab === 'partidos' && <PartidosTab />}
            {activeTab === 'tabla' && <QuinielaLeaderboard />}
            {activeTab === 'chat' && <ChatTab />}
            {activeTab === 'alertas' && <AlertsTab />}
            {activeTab === 'admin' && isAdminUser && <AdminPanel />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Clean Aesthetic Footer */}
      <footer className="h-14 sm:h-12 bg-slate-1000 px-4 sm:px-8 py-3 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-550 border-t border-slate-900/70 flex-shrink-0 gap-2">
        <p className="font-semibold uppercase tracking-wider font-mono">© 2026 MUNDIAL DE FÚTBOL - MODO ADMINISTRADOR ACTIVO</p>
        <div className="flex gap-4 items-center">
          <span className="text-slate-500 font-mono">Sincronizado vía <span className="text-emerald-400">Firebase Nube</span></span>
          <span className="flex items-center gap-1.5 font-mono uppercase text-[9px] font-bold text-slate-400"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span> Sistema en Línea</span>
        </div>
      </footer>

    </div>
  );
}

export default function App() {
  return (
    <QuinielaProvider>
      <QuinielaDashboard />
    </QuinielaProvider>
  );
}
