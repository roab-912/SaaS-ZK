import React from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Braces,
  Check,
  FileCheck2,
  Fingerprint,
  GitBranch,
  ListFilter,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Badge, Button, Stat } from '../../components/ui.jsx';
import { CircuitTable } from '../circuits/CircuitTable.jsx';
export function Dashboard({ start, nav, circuits, proofs, edit, prove }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">LA CONFIANCE, SANS COMPROMIS</div>
          <h1>Prouvez l’essentiel. Gardez le reste privé.</h1>
          <p>Transformez vos conditions en preuves, sans exposer vos données.</p>
        </div>
        <Button onClick={() => start()}>
          <Plus size={18} />
          Créer un circuit
        </Button>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <Badge tone="light">
            <Sparkles size={13} /> LE ZERO KNOWLEDGE, SIMPLEMENT
          </Badge>
          <h2>
            Une preuve en dit assez.
            <br />
            Pas besoin de tout révéler.
          </h2>
          <p>Définissez une règle, générez une preuve et partagez uniquement ce qui compte.</p>
          <button className="text-link" onClick={() => nav('guide')}>
            Découvrir le fonctionnement <ArrowRight size={17} />
          </button>
        </div>
        <div className="hero-diagram" aria-hidden="true">
          <div className="mini-node node-input">
            <span className="mini-icon">
              <LockKeyhole size={19} />
            </span>
            <div>
              <small>DONNÉES PRIVÉES</small>
              <strong>•••• ••••</strong>
            </div>
          </div>
          <div className="connector one" />
          <div className="diagram-core">
            <Fingerprint size={37} />
          </div>
          <div className="connector two" />
          <div className="mini-node node-proof">
            <span className="mini-icon green">
              <Check size={21} />
            </span>
            <div>
              <small>PREUVE PARTAGÉE</small>
              <strong>Condition satisfaite</strong>
            </div>
          </div>
          <div className="diagram-caption">
            <LockKeyhole size={12} /> Vos données restent sur votre appareil
          </div>
        </div>
      </section>
      <section className="stats">
        <Stat
          icon={GitBranch}
          label="Circuits créés"
          value={circuits.length}
          sub="Vos règles de confiance"
        />
        <Stat
          icon={FileCheck2}
          label="Preuves enregistrées"
          value={proofs.length}
          sub="Disponibles dans votre espace"
        />
        <Stat
          icon={ShieldCheck}
          label="Confidentialité"
          value="100 % local"
          sub="Pour le calcul de vos preuves"
          special
        />
      </section>
      <section>
        <div className="section-heading">
          <div>
            <h2>Partez d’une idée simple</h2>
            <p>Un modèle pour démarrer. Votre logique pour aller plus loin.</p>
          </div>
          <span className="muted small-text">3 modèles à personnaliser</span>
        </div>
        <div className="templates">
          {[
            [
              'age',
              Fingerprint,
              'Condition de majorité',
              'Démontrez une condition sur votre date de naissance.',
              'Identité · Dates',
              'sage',
            ],
            [
              'income',
              Braces,
              'Capacité financière',
              'Prouvez un seuil de revenus, sans dévoiler leur montant.',
              'Finance · Calculs',
              'sand',
            ],
            [
              'list',
              ListFilter,
              'Zone éligible',
              'Prouvez qu’une valeur appartient à une liste autorisée.',
              'Éligibilité · Listes',
              'lavender',
            ],
          ].map(([id, Icon, title, desc, tag, color]) => (
            <button className="template-card" key={id} onClick={() => start(id)}>
              <div className="template-top">
                <span className={'template-icon ' + color}>
                  <Icon size={22} />
                </span>
                <ArrowUpRight size={18} />
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
              <div className="template-footer">
                {tag}
                <ArrowRight size={15} />
              </div>
            </button>
          ))}
        </div>
      </section>
      <section className="recent">
        <div className="section-heading">
          <div>
            <h2>Vos derniers circuits</h2>
            <p>Retrouvez vos règles et générez de nouvelles preuves.</p>
          </div>
          <button className="text-link dark" onClick={() => nav('circuits')}>
            Tout voir <ArrowRight size={15} />
          </button>
        </div>
        {circuits.length ? (
          <CircuitTable circuits={circuits.slice(0, 3)} onEdit={edit} onProve={prove} />
        ) : (
          <div className="inline-empty">
            <span className="empty-icon">
              <GitBranch size={24} />
            </span>
            <div>
              <h3>Votre première preuve commence par une règle.</h3>
              <p>Choisissez un modèle ou créez votre propre circuit.</p>
            </div>
            <Button variant="secondary" onClick={() => start()}>
              Créer mon premier circuit <ArrowRight size={15} />
            </Button>
          </div>
        )}
      </section>
      <div className="bottom-note">
        <LockKeyhole size={14} />
        Aucune donnée privée de vos preuves n’est envoyée à notre serveur.
      </div>
    </>
  );
}
