import React from 'react';
import { useState, useEffect } from 'react';
import { BadgeCheck } from 'lucide-react';
import { Badge, Button, Empty, PageHeading } from '../../components/ui.jsx';
import { api } from '../../lib/api.js';
export function Issuers({ user, notify }) {
  const [issuers, setIssuers] = useState([]),
    [name, setName] = useState(''),
    [id, setId] = useState(''),
    [jwk, setJwk] = useState(''),
    [approved, setApproved] = useState(true);
  const refresh = () => api('/issuers').then(setIssuers);
  useEffect(() => {
    refresh().catch((e) => notify(e.message, true));
  }, []);
  return (
    <>
      <PageHeading
        title="Sources de confiance"
        desc="Un registre réservé aux émetteurs approuvés par l’administrateur."
      />
      <div className="notice spaced">
        <BadgeCheck size={20} />
        <div>
          <strong>Les preuves du MVP utilisent des données déclarées.</strong>
          <p>
            Le registre prépare les futurs modules de certification. L’import d’attestations signées
            et leur vérification dans le circuit ne sont pas encore activés.
          </p>
        </div>
      </div>
      <section className="panel">
        {issuers.length ? (
          issuers.map((i) => (
            <div className="issuer-row" key={i.id}>
              <BadgeCheck />
              <div>
                <strong>{i.name}</strong>
                <small>{i.id}</small>
              </div>
              <Badge>Approuvé · Connecteur à intégrer</Badge>
            </div>
          ))
        ) : (
          <Empty icon={BadgeCheck} title="Aucun Émetteur approuvé">
            Les futures sources seront ajoutées ici après validation de leurs clés et de leur
            connecteur.
          </Empty>
        )}
      </section>
      {user?.admin && (
        <section className="panel form-panel issuer-form">
          <h2>Administrer le registre</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api('/issuers', { id, name, jwk: JSON.parse(jwk), approved });
                await refresh();
                notify('Registre mis à jour.');
              } catch (e) {
                notify(e.message, true);
              }
            }}
          >
            <label>
              Identifiant
              <input required value={id} onChange={(e) => setId(e.target.value)} />
            </label>
            <label>
              Nom
              <input required value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Clé publique P-256 (JWK)
              <textarea
                required
                value={jwk}
                onChange={(e) => setJwk(e.target.value)}
                placeholder='{"kty":"EC","crv":"P-256","x":"?","y":"?"}'
              />
            </label>
            <label>
              Statut
              <select
                value={String(approved)}
                onChange={(e) => setApproved(e.target.value === 'true')}
              >
                <option value="true">Approuvé</option>
                <option value="false">Révoqué</option>
              </select>
            </label>
            <Button>Enregistrer</Button>
          </form>
        </section>
      )}
    </>
  );
}
