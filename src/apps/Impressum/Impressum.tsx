import React from 'react';
import './impressum.css';

export const Impressum: React.FC = () => {
  return (
    <div className="impressum-page">
      <h1>Impressum</h1>
      
      <h2>Dies ist eine Demo-Seite. Alle Inhalte sind fiktiv und dienen nur zu Demonstrationszwecken. Die Mueller IT MKK ist keine angemeldete Firma und bietet keinerlei Dienstleistungen an.</h2> <br />

      <section>
        <h2>Kontakt</h2>
        <p>
          Yannik Müller
        </p>
        <p>
          E-Mail: yannik@mueller-it-mkk.de<br />
        </p>
      </section>

      <section>
        <h2>Haftungsausschluss</h2>
        <h3>Haftung für Inhalte</h3>
        <p>
          Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, 
          Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.
        </p>
        
        <h3>Haftung für Links</h3>
        <p>
          Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir 
          keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine 
          Gewähr übernehmen.
        </p>
      </section>
    </div>
  );
};
