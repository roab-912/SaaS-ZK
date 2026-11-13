import { Faq } from './features/guide/FaqPage.jsx';
import { AccountPage } from './features/account/AccountPage.jsx';
import { ThemeControl } from './components/ThemeControl.jsx';
import { SearchField } from './components/SearchField.jsx';
import { matchesSearch } from './lib/search.js';
import { VatPage } from './features/vat/VatPage.jsx';
import { VatAuthority } from './features/vat/VatAuthority.jsx';
import React, { lazy, Suspense } from 'react';
import { billingPath } from './features/billing/billing-model.js';
const PaymentPage = lazy(() => import('./features/billing/PaymentPage.jsx'));
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
const pageTitles = {
  home: 'Vue d’ensemble',
  account: 'Mon espace',
  circuits: 'Mes circuits',
  editor: 'Éditeur de circuit',
  generate: 'Générer une preuve',
  proofs: 'Mes preuves',
  verify: 'Vérifier une preuve',
  billing: 'Abonnement',
  payment: 'Facturation',
  issuers: 'Sources de confiance',
  attestation: 'Créer une attestation',
  vat: 'TVA collectée',
  'vat-authority': 'Certifier des factures',
  guide: 'Comprendre',
  faq: 'FAQ',
  admin: 'Administration',
  login: 'Connexion',
  register: 'Inscription',
};
function pathForPage(page) {
  const path = {
    home: '/',
    login: '/connexion',
    register: '/inscription',
    account: '/espace-personnel',
    guide: '/comprendre',
    faq: '/faq',
  }[page];
  // Drafts and private inputs stay in memory; a reload returns to the circuit library.
  return (
    path ??
    '/?view=' + encodeURIComponent(['editor', 'generate'].includes(page) ? 'circuits' : page)
  );
}
function pageForLocation() {
  if (location.pathname.startsWith('/abonnement/')) return 'payment';
  if (location.pathname === '/faq') return 'faq';
  if (location.pathname === '/comprendre') return 'guide';
  if (location.pathname === '/espace-personnel') return 'account';
  if (location.pathname === '/connexion') return 'login';
  if (location.pathname === '/inscription') return 'register';
  const view = new URLSearchParams(location.search).get('view');
  return [
    'home',
    'account',
    'billing',
    'circuits',
    'proofs',
    'verify',
    'issuers',
    'guide',
    'faq',
    'admin',
    'vat',
    'attestation',
    'vat-authority',
  ].includes(view)
    ? view
    : 'home';
}
export function App() {
  const [session, setSession] = useState({
      user: null,
      billingMode: 'demo',
      paymentEnvironment: 'demo',
    }),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(''),
    [page, setPage] = useState(pageForLocation),
    [auth, setAuth] = useState(null),
    [circuits, setCircuits] = useState([]),
    [proofs, setProofs] = useState([]),
    [toast, setToast] = useState(null),
    [draft, setDraft] = useState(() => ({ ...template('blank'), version: 2 })),
    [selected, setSelected] = useState(null),
    [verifyFile, setVerifyFile] = useState(null),
    [mobile, setMobile] = useState(false),
    [startingTemplate, setStartingTemplate] = useState(null),
    [circuitQuery, setCircuitQuery] = useState('');
  const starting = useRef(false);
  const timer = useRef();
  const notify = (message, error = false) => {
    setToast({ message, error });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 8000);
  };
  async function refresh() {
    const s = await api('/session');
    if (s.user) {
      const [c, p] = await Promise.all([api('/circuits'), api('/proofs')]);
      setCircuits(c);
      setProofs(p);
    } else {
      setCircuits([]);
      setProofs([]);
    }
    setSession(s);
    return s;
  }
  async function retryLoad() {
    setLoading(true);
    setLoadError('');
    try {
      await refresh();
    } catch (e) {
      setLoadError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    (async () => {
      try {
        if (new URLSearchParams(location.search).has('billing')) {
          try {
            await api('/billing/sync', {});
          } catch {}
          history.replaceState({}, '', pathForPage('billing'));
          setPage('billing');
        }
        await refresh();
      } catch (e) {
        setLoadError(e.message);
      } finally {
        setLoading(false);
      }
    })();
    return () => clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    const back = () => {
      setPage(pageForLocation());
      setMobile(false);
    };
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, []);
  useEffect(() => {
    document.title = `${pageTitles[page] || 'Votre espace'} · Clair`;
    if (loading) return;
    document.querySelector('.main-shell')?.scrollIntoView?.({ block: 'start' });
    if (['login', 'register'].includes(page)) return;
    const heading = document.querySelector('main h1');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, [page, loading]);
  useEffect(() => {
    if (!mobile && !auth) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobile, auth]);
  useEffect(() => {
    if (!mobile) return;
    const sidebar = document.getElementById('main-navigation'),
      toggle = document.querySelector('.mobile-menu');
    const trap = (e) => {
      if (e.key !== 'Tab') return;
      const links = [...sidebar.querySelectorAll('button:not(:disabled),a[href]')].filter(
        (el) => el.getClientRects().length,
      );
      const first = links[0],
        last = links.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    sidebar.querySelector('.mobile-close')?.focus();
    sidebar.addEventListener('keydown', trap);
    return () => {
      sidebar.removeEventListener('keydown', trap);
      toggle?.focus();
    };
  }, [mobile]);
  const user = session.user,
    nav = (p) => {
      const path = pathForPage(p);
      if (location.pathname.startsWith('/abonnement/')) {
        location.assign(path);
        return;
      }
      setPage(p);
      if (location.pathname + location.search !== path || page !== p)
        history.pushState({}, '', path);
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
  const visibleCircuits = circuits.filter((c) =>
    matchesSearch(
      circuitQuery,
      c.schema.name,
      c.schema.vat ? 'TVA collectée' : '',
      c.schema.description,
      c.hash,
      c.id,
    ),
  );
  const navs = [
    ['home', LayoutDashboard, 'Vue d’ensemble'],
    ['circuits', GitBranch, 'Mes circuits'],
    ['proofs', FileCheck2, 'Mes preuves'],
    ['verify', ShieldCheck, 'Vérifier une preuve'],
  ];
  return (
    <div className="app">
      <a
        className="skip-link"
        href="#main-content"
        onClick={() => document.getElementById('main-content')?.focus()}
      >
        Aller au contenu principal
      </a>
      <aside
        inert={!!auth}
        role={mobile ? 'dialog' : undefined}
        aria-modal={mobile ? true : undefined}
        aria-label="Navigation principale"
        id="main-navigation"
        className={'sidebar ' + (mobile ? 'open' : '')}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setMobile(false);
            document.querySelector('.mobile-menu')?.focus();
          }
        }}
      >
        {mobile && (
          <button
            className="icon-button mobile-close"
            aria-label="Fermer le menu"
            onClick={() => {
              setMobile(false);
              document.querySelector('.mobile-menu')?.focus();
            }}
          >
            <X size={20} />
          </button>
        )}
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
        <button
          type="button"
          className="workspace"
          aria-label="Ouvrir mon espace personnel"
          aria-current={page === 'account' ? 'page' : undefined}
          onClick={() => nav('account')}
        >
          <span className="workspace-avatar">{user ? user.email[0].toUpperCase() : 'P'}</span>
          <span>
            <strong>Espace personnel</strong>
            <small>{user ? 'Votre atelier de preuves' : 'Découvrez Clair'}</small>
          </span>
          <ChevronRight size={15} />
        </button>
        <div className="nav-label">VOTRE ESPACE</div>
        <nav>
          {navs.map(([id, Icon, label]) => (
            <button
              key={id}
              aria-current={page === id ? 'page' : undefined}
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
            aria-current={page === 'issuers' ? 'page' : undefined}
          >
            <BadgeCheck size={19} />
            Sources de confiance
          </button>
          {user?.admin && (
            <button
              className={'nav-item ' + (page === 'admin' ? 'active' : '')}
              onClick={() => nav('admin')}
              aria-current={page === 'admin' ? 'page' : undefined}
            >
              <Users size={19} />
              Administration
            </button>
          )}
          <button
            className={'nav-item ' + (page === 'billing' ? 'active' : '')}
            onClick={() => nav('billing')}
            aria-current={page === 'billing' ? 'page' : undefined}
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
          <button className="account" onClick={() => (user ? nav('account') : nav('login'))}>
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
        <button
          className="scrim"
          aria-label="Fermer le menu en cliquant à l’extérieur"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell" inert={mobile || !!auth}>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-expanded={mobile}
              aria-controls="main-navigation"
              aria-label="Ouvrir le menu"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <a
              className="breadcrumb-workspace"
              href="/espace-personnel"
              onClick={(e) => {
                e.preventDefault();
                nav('account');
              }}
            >
              Espace personnel
            </a>
            <ChevronRight size={14} />
            <strong>{pageTitles[page]}</strong>
          </div>
          <div className="top-actions">
            <ThemeControl />
            <span className="local-indicator">
              <span />
              Calcul local
            </span>
            <button
              className="icon-button"
              aria-label="FAQ"
              title="Questions fréquentes"
              onClick={() => nav('faq')}
            >
              <CircleHelp size={19} />
            </button>
            {user ? (
              <button
                className="icon-button"
                aria-label="Se déconnecter"
                title="Se déconnecter"
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
            ) : !['login', 'register'].includes(page) ? (
              <Button variant="small secondary" onClick={() => nav('login')}>
                Connexion
              </Button>
            ) : null}
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <p className="print-fallback">
            Pour imprimer un rapport public, ouvrez une preuve et lancez sa vérification.
          </p>
          {loading ? (
            <div className="loading" role="status">
              <LoaderCircle className="spin" />
              Chargement…
            </div>
          ) : loadError ? (
            <div role="alert">
              <Empty
                icon={CircleHelp}
                title="Votre espace n’a pas pu être chargé"
                action={<Button onClick={retryLoad}>Réessayer</Button>}
              >
                {loadError}
              </Empty>
            </div>
          ) : (
            <>
              {['login', 'register'].includes(page) && (
                <Auth
                  key={page}
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
              {page === 'admin' && !user?.admin && (
                <Empty
                  icon={LockKeyhole}
                  title="Accès réservé aux administrateurs"
                  action={
                    <Button onClick={() => nav(user ? 'account' : 'login')}>
                      {user ? 'Revenir à mon espace' : 'Se connecter'}
                    </Button>
                  }
                >
                  Connectez-vous avec un compte administrateur pour consulter cette page.
                </Empty>
              )}
              {page === 'account' && (
                <AccountPage
                  session={session}
                  circuits={circuits}
                  proofs={proofs}
                  onNavigate={nav}
                />
              )}
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
                  <SearchField
                    label="Rechercher un circuit"
                    value={circuitQuery}
                    onChange={setCircuitQuery}
                    placeholder="Modèle, nom, description ou empreinte…"
                  />
                  <CircuitCatalog
                    onChoose={start}
                    pending={startingTemplate}
                    query={circuitQuery}
                  />
                  <div className="section-heading">
                    <div>
                      <h2>Vos circuits enregistrés</h2>
                      <p>Réutilisez un circuit ou ouvrez-le dans l’éditeur pour l’adapter.</p>
                    </div>
                  </div>
                  {!user ? (
                    <AccountEmpty open={() => setAuth('login')} />
                  ) : circuits.length ? (
                    visibleCircuits.length ? (
                      <CircuitTable
                        circuits={visibleCircuits}
                        onEdit={edit}
                        onProve={prove}
                        onDelete={async (c) => {
                          await api('/circuits/' + c.id, {}, 'DELETE');
                          await refresh();
                        }}
                        notify={notify}
                      />
                    ) : (
                      <Empty title="Aucun circuit enregistré ne correspond à cette recherche.">
                        Essayez un autre nom ou une partie de l’empreinte.
                      </Empty>
                    )
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
                <ProofLibrary {...{ user, nav, setAuth, proofs, openVerify, refresh, notify }} />
              )}
              {page === 'verify' && <Verify initial={verifyFile} notify={notify} />}
              {page === 'billing' && (
                <Billing
                  session={session}
                  refresh={refresh}
                  notify={notify}
                  login={() => setAuth('register')}
                  onOpen={(action, plan) => location.assign(billingPath(action, plan))}
                />
              )}
              {page === 'payment' && (
                <Suspense
                  fallback={<p role="status">Chargement de votre espace de facturation…</p>}
                >
                  <PaymentPage
                    session={session}
                    refresh={refresh}
                    login={() => nav('login')}
                    onExit={() => location.assign('/?billing=return')}
                  />
                </Suspense>
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
                  onManageSources={() => nav('issuers')}
                />
              )}
              {page === 'vat-authority' && (
                <VatAuthority
                  onBack={() => nav('issuers')}
                  onManageSources={() => nav('issuers')}
                />
              )}
              {page === 'guide' && <Guide onNavigate={nav} />}
              {page === 'faq' && <Faq onNavigate={nav} />}
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
          key={auth}
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
        <div
          className={'toast ' + (toast.error ? 'error' : '')}
          role={toast.error ? 'alert' : 'status'}
        >
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
