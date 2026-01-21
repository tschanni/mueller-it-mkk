import React, { useState } from 'react';
import './calculator.css';

const keys = [
  '7','8','9','/',
  '4','5','6','*',
  '1','2','3','-',
  '0','.','=','+',
  'C'
];

export const Calculator: React.FC = () => {
  const [display, setDisplay] = useState('0');

  const onKey = (k: string) => {
    if (k === 'C') { setDisplay('0'); return; }
    if (k === '=') {
      try {
        // Einfacher Evaluator — keine gefährlichen Eingaben, nur Taschenrechner-Keys
        // eslint-disable-next-line no-eval
        const result = eval(display);
        setDisplay(String(result));
      } catch {
        setDisplay('Error');
      }
      return;
    }
    setDisplay((d) => (d === '0' && /[0-9]/.test(k) ? k : d + k));
  };

  return (
    <div className="calc">
      <div className="display">{display}</div>
      <div className="keys">
        {keys.map(k => (
          <button key={k} onClick={() => onKey(k)}>{k}</button>
        ))}
      </div>
    </div>
  );
};
