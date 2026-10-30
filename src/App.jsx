import { VatPage } from './features/vat/VatPage.jsx';
import { VatAuthority } from './features/vat/VatAuthority.jsx';
import React from 'react';
import { useState, useEffect, useRef } from 'react';
import {
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronRight,
  CircleHelp,
  CreditCard,
  FileCheck2,
  Fingerprint,
  GitBranch,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  Settings2,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { Button, Empty, PageHeading, AccountEmpty } from './components/ui.jsx';
import { api } from './lib/api.js';
import { canonical, template, validateCircuit } from '../shared/circuit.mjs';
import { Auth } from './features/auth/AuthDialog.jsx';
import { Editor } from './features/circuits/CircuitEditor.jsx';
import { CircuitTable } from './features/circuits/CircuitTable.jsx';
import { CircuitCatalog } from './features/circuits/CircuitCatalog.jsx';
import { readyCircuit, publicDefaults } from './features/circuits/catalog-model.js';
import { Generate } from './features/proofs/GenerateProof.jsx';
import { Verify } from './features/proofs/VerifyProof.jsx';
import { Billing } from './features/billing/BillingPage.jsx';
import { Issuers } from './features/issuers/IssuersPage.jsx';
import { IssueAttestation } from './features/issuers/IssueAttestation.jsx';
import { Guide } from './features/guide/GuidePage.jsx';
import { Dashboard } from './features/dashboard/Dashboard.jsx';
import { AdminDashboard } from './features/admin/AdminDashboard.jsx';
import { ProofLibrary } from './features/proofs/ProofLibrary.jsx';
export function App() {
  const [session, setSession] = useState({
      user: null,
      billingMode: 'demo',
      paymentEnvironment: 'demo',
    }),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState(() =>
      location.pathname === '/connexion'
        ? 'login'
        : location.pathname === '/inscription'
          ? 'register'
          : 'home',
    ),
    [auth, setAuth] = useState(null),
    [circuits, setCircuits] = useState([]),
    [proofs, setProofs] = useState([]),
    [toast, setToast] = useState(null),
    [draft, setDraft] = useState(() => ({ ...template('blank'), version: 2 })),
    [selected, setSelected] = useState(null),
    [verifyFile, setVerifyFile] = useState(null),
    [mobile, setMobile] = useState(false),
    [startingTemplate, setStartingTemplate] = useState(null);
  const starting = useRef(false);
  const timer = useRef();
  const notify = (message, error = false) => {
    setToast({ message, error });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 8000);
  };
  async function refresh() {
    const s = await api('/session');
    setSession(s);
    if (s.user) {
      const [c, p] = await Promise.all([api('/circuits'), api('/proofs')]);
      setCircuits(c);
      setProofs(p);
    } else {
      setCircuits([]);
      setProofs([]);
    }
    return s;
  }
  useEffect(() => {
    (async () => {
      try {
        if (new URLSearchParams(location.search).has('billing')) {
          try {
            await api('/billing/sync', {});
          } catch {}
          history.replaceState({}, '', location.pathname);
          setPage('billing');
        }
        await refresh();
      } catch (e) {
        notify(e.message, true);
      } finally {
        setLoading(false);
      }
    })();
    return () => clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    const back = () =>
      setPage(
        location.pathname === '/connexion'
          ? 'login'
          : location.pathname === '/inscription'
            ? 'register'
            : 'home',
      );
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, []);
  const user = session.user,
    nav = (p) => {
      setPage(p);
      const path = p === 'login' ? '/connexion' : p === 'register' ? '/inscription' : '/';
      if (location.pathname !== path) history.pushState({}, '', path);
      setMobile(false);
    };
  const needPaid = () => {
    if (!user) {
      setAuth('register');
      return false;
    }
    if (!user.active) {
      nav('billing');
      notify('Activez votre abonnement pour créer un circuit.');
      return false;
    }
    return true;
  };
  const start = async (kind = 'catalog', engine) => {
    if (!needPaid()) return;
    if (kind === 'catalog') return nav('circuits');
    if (kind === 'vat') return nav('vat');
    if (kind === 'blank') {
      setDraft({ ...template('blank'), version: 2 });
      return nav('editor');
    }
    if (starting.current) return;
    starting.current = true;
    setStartingTemplate(kind);
    try {
      const schema = readyCircuit(kind, engine);
      const existing = circuits.find(
        (c) => canonical(validateCircuit(c.schema)) === canonical(schema),
      );
      setSelected({
        ...existing,
        templateId: kind + '-' + schema.engine,
        schema,
        initialValues: publicDefaults(kind),
      });
      nav('generate');
    } catch (e) {
      notify(e.message, true);
    } finally {
      starting.current = false;
      setStartingTemplate(null);
    }
  };
  const edit = (c) => {
    if (c.schema.vat) {
      if (needPaid()) nav('vat');
      return;
    }
    if (needPaid()) {
      setDraft(structuredClone(c.schema));
      nav('editor');
    }
  };
  const prove = (c) => {
    if (c.schema.vat) {
      if (needPaid()) nav('vat');
      return;
    }
    if (needPaid()) {
      setSelected(c);
      nav('generate');
    }
  };
  const openVerify = (e) => {
    setVerifyFile(e);
    nav('verify');
  };
  const navs = [
    ['home', LayoutDashboard, 'Vue d’ensemble'],
    ['circuits', GitBranch, 'Mes circuits'],
    ['proofs', FileCheck2, 'Mes preuves'],
    ['verify', ShieldCheck, 'Vérifier une preuve'],
  ];
  return (
    <div className="app">
      <aside className={'sidebar ' + (mobile ? 'open' : '')}>
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            nav('home');
          }}
        >
          <span className="brand-icon">
            <Fingerprint size={29} />
          </span>
          clair<span className="brand-dot">.</span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">{user ? user.email[0].toUpperCase() : 'P'}</span>
          <span>
            <strong>Espace personnel</strong>
            <small>{user ? 'Votre atelier de preuves' : 'Découvrez Clair'}</small>
          </span>
          <ChevronRight size={15} />
        </div>
        <div className="nav-label">VOTRE ESPACE</div>
        <nav>
          {navs.map(([id, Icon, label]) => (
            <button
              key={id}
              className={
                'nav-item ' +
                (page === id || (id === 'circuits' && ['editor', 'generate', 'vat'].includes(page))
                  ? 'active'
                  : '')
              }
              onClick={() => nav(id)}
            >
              <Icon size={19} />
              {label}
              {id === 'circuits' && circuits.length > 0 && (
                <span className="nav-count">{circuits.length}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="nav-label second">PARAMÈTRES</div>
        <nav>
          <button
            className={
              'nav-item ' +
              (['issuers', 'attestation', 'vat-authority'].includes(page) ? 'active' : '')
            }
            onClick={() => nav('issuers')}
          >
            <BadgeCheck size={19} />
            Sources de confiance
          </button>
          {user?.admin && (
            <button
              className={'nav-item ' + (page === 'admin' ? 'active' : '')}
              onClick={() => nav('admin')}
            >
              <Users size={19} />
              Administration
            </button>
          )}
          <button
            className={'nav-item ' + (page === 'billing' ? 'active' : '')}
            onClick={() => nav('billing')}
          >
            <CreditCard size={19} />
            Mon abonnement
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card">
            <LockKeyhole size={19} />
            <strong>Vos données restent à vous.</strong>
            <p>Les preuves sont calculées sur votre appareil.</p>
            <button onClick={() => nav('guide')}>
              Comprendre le zero knowledge <ArrowUpRight size={14} />
            </button>
          </div>
          <button className="account" onClick={() => (user ? nav('billing') : nav('login'))}>
            <span className="avatar">
              {user ? user.email[0].toUpperCase() : <Users size={18} />}
            </span>
            <span>
              <strong>{user ? user.email.split('@')[0] : 'Mon compte'}</strong>
              <small>
                {user ? (user.active ? 'Abonnement actif' : 'Sans abonnement') : 'Se connecter'}
              </small>
            </span>
            <Settings2 size={16} />
          </button>
        </div>
      </aside>
      {mobile && (
        <button className="scrim" aria-label="Fermer le menu" onClick={() => setMobile(false)} />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Ouvrir le menu"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>Espace personnel</span>
            <ChevronRight size={14} />
            <strong>
              {
                {
                  home: 'Vue d’ensemble',
                  circuits: 'Mes circuits',
                  editor: 'Éditeur de circuit',
                  generate: 'Générer une preuve',
                  proofs: 'Mes preuves',
                  verify: 'Vérification',
                  billing: 'Abonnement',
                  issuers: 'Sources de confiance',
                  attestation: 'Créer une attestation',
                  vat: 'TVA collectée',
                  'vat-authority': 'Certifier des factures',
                  guide: 'Guide',
                  admin: 'Administration',
                  login: 'Connexion',
                  register: 'Inscription',
                }[page]
              }
            </strong>
          </div>
          <div className="top-actions">
            <span className="local-indicator">
              <span />
              Calcul local
            </span>
            <button
              className="icon-button"
              aria-label="Guide d’utilisation"
              onClick={() => nav('guide')}
            >
              <CircleHelp size={19} />
            </button>
            {user ? (
              <button
                className="icon-button"
                aria-label="Se déconnecter"
                onClick={async () => {
                  try {
                    await api('/auth/logout', {});
                    setSession((s) => ({ ...s, user: null, usage: null }));
                    setCircuits([]);
                    setProofs([]);
                    setSelected(null);
                    setVerifyFile(null);
                    setAuth(null);
                    nav('login');
                  } catch (e) {
                    notify(e.message, true);
                  }
                }}
              >
                <LogOut size={18} />
              </button>
            ) : (
              <Button variant="small secondary" onClick={() => nav('login')}>
                Connexion
              </Button>
            )}
          </div>
        </header>
        <main>
          {loading ? (
            <div className="loading">
              <LoaderCircle className="spin" />
              Chargement…
            </div>
          ) : (
            <>
              {['login', 'register'].includes(page) && (
                <Auth
                  embedded
                  mode={page}
                  setMode={nav}
                  onClose={() => nav('home')}
                  onDone={async () => {
                    const next = await refresh();
                    nav(next.user?.admin ? 'admin' : page === 'register' ? 'billing' : 'home');
                  }}
                />
              )}
              {page === 'admin' && user?.admin && <AdminDashboard />}
              {page === 'home' && (
                <Dashboard
                  {...{ start, nav, circuits, proofs, edit, prove }}
                  usage={session.usage}
                />
              )}
              {page === 'circuits' && (
                <>
                  <PageHeading
                    title="Mes circuits"
                    desc="Un circuit prêt à utiliser ou votre propre règle : choisissez ce que vous souhaitez démontrer."
                    action={
                      <Button variant="secondary" onClick={() => start('blank')}>
                        <Plus size={17} />
                        Circuit personnalisé
                      </Button>
                    }
                  />
                  <CircuitCatalog onChoose={start} pending={startingTemplate} />
                  <div className="section-heading">
                    <div>
                      <h2>Vos circuits enregistrés</h2>
                      <p>Réutilisez un circuit ou ouvrez-le dans l’éditeur pour l’adapter.</p>
                    </div>
                  </div>
                  {!user ? (
                    <AccountEmpty open={() => setAuth('login')} />
                  ) : circuits.length ? (
                    <CircuitTable
                      circuits={circuits}
                      onEdit={edit}
                      onProve={prove}
                      onDelete={async (c) => {
                        await api('/circuits/' + c.id, {}, 'DELETE');
                        await refresh();
                      }}
                    />
                  ) : (
                    <Empty icon={GitBranch} title="Votre atelier est prêt.">
                      Choisissez un circuit ci-dessus pour commencer sans construire de règle.
                    </Empty>
                  )}
                </>
              )}
              {page === 'editor' && (
                <Editor
                  draft={draft}
                  setDraft={setDraft}
                  onSave={async (go) => {
                    const schema = validateCircuit(draft);
                    const result = await api('/circuits', schema);
                    await refresh();
                    notify('Version du circuit enregistrée.');
                    if (go) prove({ ...result, schema });
                    else nav('circuits');
                  }}
                />
              )}
              {page === 'generate' && selected && (
                <Generate
                  key={selected.id ?? selected.templateId}
                  circuit={selected}
                  onPrepare={async () => {
                    if (selected.id) return;
                    const schema = validateCircuit(selected.schema);
                    const existing = circuits.some(
                      (c) => canonical(validateCircuit(c.schema)) === canonical(schema),
                    );
                    if (!existing) {
                      await api('/circuits', schema);
                      await refresh();
                    }
                  }}
                  initialValues={selected.initialValues}
                  onEdit={() => edit(selected)}
                  notify={notify}
                  refresh={refresh}
                  onVerify={openVerify}
                />
              )}
              {page === 'proofs' && (
                <ProofLibrary {...{ user, nav, setAuth, proofs, openVerify, refresh }} />
              )}
              {page === 'verify' && <Verify initial={verifyFile} notify={notify} />}
              {page === 'billing' && (
                <Billing
                  session={session}
                  refresh={refresh}
                  notify={notify}
                  login={() => setAuth('register')}
                />
              )}
              {page === 'issuers' && (
                <Issuers
                  user={user}
                  notify={notify}
                  onCreateAttestation={() => nav('attestation')}
                  onVatAuthority={() => nav('vat-authority')}
                />
              )}
              {page === 'attestation' && (
                <IssueAttestation circuits={circuits} onBack={() => nav('issuers')} />
              )}
              {page === 'vat' && (
                <VatPage
                  notify={notify}
                  refresh={refresh}
                  onVerify={openVerify}
                  onAuthority={() => nav('vat-authority')}
                />
              )}
              {page === 'vat-authority' && <VatAuthority onBack={() => nav('issuers')} />}
              {page === 'guide' && <Guide />}
            </>
          )}
        </main>
        <footer>
          <span>
            clair. <span className="muted">La confiance commence par la confidentialité.</span>
          </span>
          <span className="footer-mode">
            {session.paymentEnvironment === 'demo'
              ? 'Environnement de démonstration'
              : session.paymentEnvironment === 'test'
                ? 'Stripe · Paiements de test'
                : 'Stripe · Paiements réels'}
          </span>
        </footer>
      </div>
      {auth && (
        <Auth
          mode={auth}
          setMode={setAuth}
          onClose={() => setAuth(null)}
          onDone={async () => {
            await refresh();
            setAuth(null);
            nav('billing');
          }}
        />
      )}
      {toast && (
        <div className={'toast ' + (toast.error ? 'error' : '')} role="status">
          {toast.error ? <CircleHelp size={18} /> : <Check size={18} />}
          <span>{toast.message}</span>
          <button
            className="icon-button"
            aria-label="Fermer la notification"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
