import React, { useState } from 'react';
import { publicAsset } from '../utils/publicAsset';
import { profileImageURL } from './profileImageURL';
export { profileImageURL } from './profileImageURL';
export function ProfileImage({ image, name, size = 32 }: { image?: string | null; name: string; size?: number }) {
  const url = profileImageURL(image);
  const [failed, setFailed] = useState<string | null>(null);
  return <img className="profile-image" src={url && failed !== url ? url : publicAsset('/retro-user.svg')}
    width={size} height={size} alt={'Profilbild von ' + name} referrerPolicy="no-referrer"
    onError={() => { if (url && failed !== url) setFailed(url); }} />;
}
