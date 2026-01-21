import React from 'react';
import './appicon.css';

type Props = {
  title: string;
  icon: string; // public path
  onOpen: () => void;
};

export const AppIcon: React.FC<Props> = ({ title, icon, onOpen }) => {
  return (
    <button className="app-icon" onDoubleClick={onOpen} onClick={onOpen} title={title}>
      <img src={icon} alt="icon" />
      <span>{title}</span>
    </button>
  );
};
