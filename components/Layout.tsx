
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';
import { 
  LayoutDashboard, 
  Files, 
  Users, 
  History, 
  LogOut, 
  Menu,
  X,
  User as UserIcon
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export const Layout = ({ children }: { children?: React.ReactNode }) => {
  const { currentUser, logout } = useApp();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const NavItem = ({ to, icon: Icon, label }: { to: string, icon: any, label: string }) => {
    const isActive = location.pathname === to;
    return (
      <Link
        to={to}
        onClick={() => setMobileMenuOpen(false)}
        className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
          isActive 
            ? 'bg-slate-800 text-white shadow-sm' 
            : 'text-slate-300 hover:bg-slate-700 hover:text-white'
        }`}
      >
        <Icon size={18} />
        <span>{label}</span>
      </Link>
    );
  };

  const LogoImage = "https://upload.wikimedia.org/wikipedia/commons/1/1a/Bras%C3%A3o_do_estado_de_S%C3%A3o_Paulo.svg";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Navigation Bar */}
      <header className="bg-primary text-white shadow-md sticky top-0 z-50">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo and Brand */}
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0 flex items-center gap-3">
                <img 
                  src={LogoImage} 
                  alt="Brasão SP" 
                  className="h-10 w-auto"
                />
                <div className="hidden sm:flex flex-col">
                  <h1 className="text-sm font-bold tracking-tight leading-tight">Controle de Processos</h1>
                  <span className="text-xs text-slate-400 font-medium">Assessoria CGOF</span>
                </div>
              </div>
              
              {/* Desktop Navigation */}
              <div className="hidden md:block border-l border-slate-700 pl-6">
                <div className="flex items-baseline space-x-2">
                  <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
                  <NavItem to="/processos" icon={Files} label="Processos" />
                  {currentUser?.role === UserRole.ADMIN && (
                    <>
                      <NavItem to="/usuarios" icon={Users} label="Usuários" />
                      <NavItem to="/logs" icon={History} label="Auditoria" />
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right Side - User Profile & Mobile Toggle */}
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-4">
                <Link 
                  to="/perfil" 
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${location.pathname === '/perfil' ? 'bg-slate-800' : 'hover:bg-slate-800'}`}
                >
                  <div className="text-right mr-2">
                    <p className="text-sm font-medium leading-none">{currentUser?.name}</p>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-tighter">{currentUser?.role}</p>
                  </div>
                  <div className="p-1.5 bg-slate-700 rounded-full text-slate-300">
                    <UserIcon size={16} />
                  </div>
                </Link>
                
                <div className="w-px h-6 bg-slate-700 mx-1"></div>

                <button 
                  onClick={logout}
                  className="p-2 text-slate-300 hover:text-white hover:bg-red-500/20 rounded-full transition-colors"
                  title="Sair"
                >
                  <LogOut size={20} />
                </button>
              </div>

              <div className="-mr-2 flex md:hidden">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="bg-slate-800 inline-flex items-center justify-center p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 focus:outline-none"
                >
                  {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-slate-900 border-t border-slate-700 pb-4 shadow-xl">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
              <NavItem to="/processos" icon={Files} label="Gestão de Processos" />
              <NavItem to="/perfil" icon={UserIcon} label="Meu Perfil / Trocar Senha" />
              {currentUser?.role === UserRole.ADMIN && (
                <>
                  <NavItem to="/usuarios" icon={Users} label="Usuários" />
                  <NavItem to="/logs" icon={History} label="Auditoria" />
                </>
              )}
            </div>
            <div className="pt-4 pb-3 border-t border-slate-700 px-5">
              <div className="flex items-center">
                <div className="flex flex-col">
                  <div className="text-base font-medium leading-none text-white">{currentUser?.name}</div>
                  <div className="text-sm font-medium leading-none text-slate-400 mt-1">{currentUser?.email}</div>
                </div>
                <button 
                  onClick={logout}
                  className="ml-auto bg-slate-800 flex-shrink-0 p-2 rounded-full text-slate-400 hover:text-white focus:outline-none flex items-center gap-2 border border-slate-700"
                >
                  <span className="text-xs font-bold uppercase">Sair</span>
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 p-4 md:p-6">
        <div className="max-w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
