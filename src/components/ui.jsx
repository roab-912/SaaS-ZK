import React, { useEffect, useRef } from 'react';
import { FolderOpen, Users } from 'lucide-react';
export function Badge({ children, tone = '' }) {
  return <span className={'badge ' + tone}>{children}</span>;
}
export function Button({ children, variant = '', ...props }) {
  return (
    <button className={'button ' + variant} {...props}>
      {children}
    </button>
  );
}
export function Empty({ icon: Icon = FolderOpen, title, children, action }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon size={27} />
      </span>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function PageHeading({ title, desc, action }) {
  const heading = useRef();
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">VOTRE ATELIER DE CONFIANCE</div>
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
        <p>{desc}</p>
      </div>
      {action}
    </div>
  );
}
export function Stat({ icon: Icon, label, value, sub, special }) {
  return (
    <div className="stat">
      <div>
        <span>{label}</span>
        <strong className={special ? 'text-green' : ''}>{value}</strong>
        <small>{sub}</small>
      </div>
      <span className="stat-icon">
        <Icon size={21} />
      </span>
    </div>
  );
}
export function AccountEmpty({ open }) {
  return (
    <Empty
      icon={Users}
      title="Retrouvez votre espace personnel"
      action={<Button onClick={open}>Se connecter</Button>}
    >
      Connectez-vous pour accéder à vos circuits et preuves.
    </Empty>
  );
}
