'use client';

import { useState } from 'react';
import Image from 'next/image';
import { CharacterConfig } from '@/game/types';

/** Uses the same atlas as combat, with the original SVG beneath it while loading. */
export function LulaPortrait({ character, animated = false }: {
  character: CharacterConfig;
  animated?: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const atlas = character.animationSprite;
  const columns = character.animationColumns ?? 4;
  const rows = character.animationRows ?? 4;

  return (
    <span role="img" aria-label={character.name} className="relative block h-full w-full">
      {(!ready || failed) && character.sprite && (
        <Image src={character.sprite} alt="" fill unoptimized className="object-contain" />
      )}
      {atlas && !failed && (
        <>
          <Image
            src={atlas} alt="" width={columns * 256} height={rows * 256}
            unoptimized loading="eager" aria-hidden="true" className="hidden"
            onLoad={() => setReady(true)} onError={() => { setFailed(true); setReady(false); }}
          />
          {ready && (
            <span
              aria-hidden="true"
              className={`lula-portrait block h-full w-full ${animated ? 'lula-portrait-animated' : ''}`}
              style={{
                backgroundImage: `url("${atlas}")`,
                backgroundSize: `${columns * 100}% ${rows * 100}%`,
                backgroundPosition: `0% ${3 / (rows - 1) * 100}%`,
              }}
            />
          )}
        </>
      )}
    </span>
  );
}
