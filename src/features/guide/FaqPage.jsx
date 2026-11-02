import React, { useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  CircleHelp,
  Fingerprint,
  LayoutGrid,
  LockKeyhole,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { Button, PageHeading } from '../../components/ui.jsx';
import { SearchField } from '../../components/SearchField.jsx';
import { matchesSearch } from '../../lib/search.js';
import { displayDate } from '../../lib/format.js';
export const FAQ_UPDATED_ON = '2026-11-02';
const categories = [
  { id: 'all', label: 'Toutes les questions', icon: LayoutGrid },
  { id: 'privacy', label: 'Confidentialité', icon: LockKeyhole },
  { id: 'proofs', label: 'Preuves et vérification', icon: ShieldCheck },
  { id: 'usage', label: 'Compte et attestations', icon: Fingerprint },
];
export function Faq({ onNavigate }) {
  const [query, setQuery] = useState(''),
    [category, setCategory] = useState('all');
  const visible = questions.filter(
    (q) =>
      (category === 'all' || q.category === category) && matchesSearch(query, q.title, q.answer),
  );
  const current = categories.find((c) => c.id === category);
  return (
    <>
      <PageHeading
        title="Questions fréquentes"
        desc="L’essentiel pour avancer en confiance, de votre premier circuit à la vérification."
      />
      <section className="faq-search-panel" aria-label="Trouver une réponse">
        <div className="faq-search-intro">
          <span className="faq-search-icon">
            <CircleHelp size={26} aria-hidden="true" />
          </span>
          <div>
            <h2>Comment peut-on vous aider ?</h2>
            <p>Un mot-clé, un thème : trouvez votre réponse.</p>
          </div>
        </div>
        <SearchField
          label="Rechercher une réponse"
          placeholder="Données privées, attestation, abonnement…"
          value={query}
          onChange={setQuery}
        />
      </section>
      <div className="faq-layout">
        <aside className="faq-sidebar" aria-label="Explorer la FAQ">
          <nav className="panel faq-categories" aria-label="Thèmes de la FAQ">
            <h2>Explorer par thème</h2>
            {categories.map((c) => {
              const Icon = c.icon,
                count =
                  c.id === 'all'
                    ? questions.length
                    : questions.filter((q) => q.category === c.id).length;
              return (
                <button
                  type="button"
                  key={c.id}
                  className={'faq-category' + (c.id === category ? ' active' : '')}
                  aria-label={c.label}
                  aria-pressed={c.id === category}
                  aria-controls="faq-answers"
                  onClick={() => setCategory(c.id)}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span>{c.label}</span>
                  <span className="faq-category-count" aria-hidden="true">
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>
        <section className="faq-answers" id="faq-answers" aria-labelledby="faq-answers-title">
          <div className="faq-list-heading">
            <h2 id="faq-answers-title">{current.label}</h2>
            <p role="status" aria-live="polite">
              {visible.length} réponse{visible.length === 1 ? '' : 's'}
            </p>
          </div>
          {visible.length ? (
            <div className="faq-question-list">
              {visible.map((q) => {
                const Icon = categories.find((c) => c.id === q.category).icon;
                return (
                  <details className="faq-question" key={q.title}>
                    <summary>
                      <span className="faq-topic-icon">
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <h3>{q.title}</h3>
                      <span className="faq-question-toggle">
                        <Plus size={18} aria-hidden="true" />
                      </span>
                    </summary>
                    <div className="faq-answer">
                      <p>{q.answer}</p>
                    </div>
                  </details>
                );
              })}
            </div>
          ) : (
            <div className="panel faq-no-results">
              <CircleHelp size={28} aria-hidden="true" />
              <h3>Aucune réponse pour cette recherche.</h3>
              <p>Essayez un autre mot-clé ou revenez à toutes les questions.</p>
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery('');
                  setCategory('all');
                }}
              >
                Réinitialiser les filtres
              </Button>
            </div>
          )}
          <p className="faq-updated">
            FAQ mise à jour le <time dateTime={FAQ_UPDATED_ON}>{displayDate(FAQ_UPDATED_ON)}</time>.
          </p>
        </section>
        {onNavigate && (
          <section className="faq-guide-card">
            <span className="faq-guide-icon">
              <BookOpen size={23} aria-hidden="true" />
            </span>
            <span className="faq-card-kicker">POUR ALLER PLUS LOIN</span>
            <h2>Le zero knowledge, simplement.</h2>
            <p>Découvrez le fonctionnement de Clair avec un schéma et un exemple concret.</p>
            <Button variant="secondary" onClick={() => onNavigate('guide')}>
              Comprendre le zero knowledge
              <ArrowUpRight size={15} aria-hidden="true" />
            </Button>
          </section>
        )}
      </div>
    </>
  );
}

const questions = [
  {
    category: 'usage',
    title: 'Faut-il une clé privée pour utiliser une attestation ?',
    answer:
      'Non. Importez le fichier reçu de la source ; les valeurs attendues sont remplies automatiquement. La clé privée est réservée à la personne autorisée à signer pour cette source.',
  },
  {
    category: 'proofs',
    title: 'Et dans six mois ?',
    answer:
      'La preuve garde les dates et les valeurs publiques utilisées à sa création. Vérifiez qu’elles correspondent toujours à votre demande. Une attestation peut expirer et une source peut être retirée du registre.',
  },
  {
    category: 'privacy',
    title: 'Qu’est-ce qui quitte mon appareil ?',
    answer:
      'La règle publique est envoyée au serveur pour préparer le calcul. Les valeurs privées et les factures restent sur votre appareil. Si vous archivez une preuve, seul son fichier public est enregistré. Les noms, descriptions et valeurs fixes d’un circuit ne doivent pas contenir de secrets.',
  },
  {
    category: 'privacy',
    title: 'Que voit le destinataire ?',
    answer:
      'Il voit la règle, son résultat, les informations marquées publiques et les sources signataires éventuelles. Les valeurs privées restent cachées. Pour la TVA, il voit notamment l’entreprise, la période, le nombre de factures et les totaux.',
  },
  {
    category: 'proofs',
    title: 'Une preuve valide peut-elle donner un résultat faux ?',
    answer:
      'Oui. Une preuve valide peut confirmer que la règle donne faux. Le destinataire doit contrôler la validité, le résultat et le circuit attendu.',
  },
  {
    category: 'usage',
    title: 'Faut-il payer pour vérifier une preuve ?',
    answer:
      'Non. La vérification reste accessible sans compte ni abonnement. L’abonnement concerne la création et l’espace personnel.',
  },
  {
    category: 'proofs',
    title: 'Comment fonctionne le vérificateur hors ligne ?',
    answer:
      'Il utilise les clés approuvées à la date de son téléchargement. Les révocations ultérieures restent inconnues ; téléchargez une nouvelle version pour actualiser le registre.',
  },
  {
    category: 'usage',
    title: 'Comment changer l’apparence de Clair ?',
    answer:
      'Le sélecteur Apparence, en haut de la page, propose Clair, Sombre ou Appareil. Seule cette préférence est conservée dans ce navigateur ; les données des formulaires et les recherches ne sont pas mémorisées par cette fonction.',
  },
];
