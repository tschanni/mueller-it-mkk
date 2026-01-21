import React, { useState } from 'react';
import './company.css';
import logo from './mueller-it-mkk-logo.png';

export const CompanyPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'about' | 'services' | 'contact'>('about');

  return (
    <div className="company-page layout">
      {/* Linke Spalte: Logo + Tabs */}
      <aside className="sidebar">
        <div className="logo-wrap">
          <img src={logo} alt="Firmenlogo" className="logo" />
          <div className="logo-title">Müller IT MKK</div>
        </div>
        <nav className="tabbar" aria-label="Navigation">
          <button
            className={`tab ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
          >
            Über Uns
          </button>
          <button
            className={`tab ${activeTab === 'services' ? 'active' : ''}`}
            onClick={() => setActiveTab('services')}
          >
            Leistungen
          </button>
          <button
            className={`tab ${activeTab === 'contact' ? 'active' : ''}`}
            onClick={() => setActiveTab('contact')}
          >
            Kontakt
          </button>
        </nav>
      </aside>

      {/* Rechte Spalte: Inhalt */}
      <main className="content" role="main">
        {activeTab === 'about' && (
          <section>
            <h4>Über uns</h4>
            <p>
              Willkommen bei der <strong>Müller IT MKK GbR</strong>.
            </p>
            <p>
              Wir möchten Ihnen gerne IT-Dienstleistungen anbieten, die nicht nach begleichen der Rechnung verschwinden, sondern auf langfristige Zusammenarbeit setzen. <br />
              Gerne stehen wir Ihnen bei allen Fragen rund um Ihre IT zur Verfügung.
              Dabei spielt es keine Rolle ob Sie Probleme mit ihrem vorhandenen System haben oder eine komplett neue Infrastruktur aufbauen möchten.
            </p>
              Die <strong>Müller IT MKK GbR</strong> steht Ihnen als verlässlicher Partner zur Seite.
          </section>
        )}

        {activeTab === 'services' && (
          <section>
            <h4>Leistungen</h4>
              <h2><strong>IT-Infrastruktur</strong></h2>
              <p>Wir planen und implementieren Ihre IT-Infrastruktur nach ihren Anforderungen. Gerne richten wir Ihnen das System nach Ihren Wünschen ein.</p>
              <h2><strong>Support &amp; Wartung</strong></h2>
              <p>Wir bieten umfassenden Support und Wartung für Ihre IT-Systeme, damit Sie sich auf Ihr Kerngeschäft konzentrieren können. <br /> Dabei spielt es keine Rolle, ob Sie Probleme mit Ihrem vorhandenen System haben oder eine komplett neue Infrastruktur aufbauen möchten. <br /> Ob defekter Drucker, Serverprobleme oder Netzwerkstörungen – wir sind für Sie da.</p>
              <h2><strong>Hausautomatisierung</strong></h2>
              <p>Wir integrieren moderne Hausautomatisierungslösungen, um Ihren Wohnkomfort zu erhöhen und Energieeffizienz zu steigern. Dabei greifen wir auf bewährte Technologien und individuelle Lösungen zurück. Dabei können Sie sich in unserem Bürogebäude selbst von den Möglichkeiten überzeugen.</p>
              <h2><strong>Beratung</strong></h2>
              <p>Sie wissen nicht, wo Sie anfangen sollen? Wir helfen Ihnen gerne bei der Planung und Umsetzung Ihrer IT-Projekte.</p>
          </section>
        )}

        {activeTab === 'contact' && (
          <section>
            <h4>Kontakt</h4>
            <p>E-Mail: yannik@mueller-it-mkk.de</p>
            <p>Telefon: +49 (0) 000 000000</p>
          </section>
        )}
      </main>
    </div>
  );
};
