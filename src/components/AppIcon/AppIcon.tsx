import React from 'react';
import { publicAsset } from '../../utils/publicAsset';
import './appicon.css';

type Props = {
  title: string;
  icon: string; // public path
  onOpen: () => void;
  selectOnClick?: boolean;
};

export const AppIcon: React.FC<Props> = ({ title, icon, onOpen, selectOnClick }) => {
  return (
    <button className="app-icon" onDoubleClick={onOpen} onClick={selectOnClick ? undefined : onOpen} onKeyDown={e => { if (selectOnClick && e.key === 'Enter') onOpen(); }} title={title}>
      <img src={publicAsset(icon)} alt="" />
      <span>{title}</span>
    </button>
  );
};
