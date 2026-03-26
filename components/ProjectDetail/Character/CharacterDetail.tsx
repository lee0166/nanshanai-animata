import React from 'react';
import { CharacterAsset } from '../../../types';
import { RedesignedCharacterWorkflow } from './RedesignedCharacterWorkflow';

interface CharacterDetailProps {
  asset: CharacterAsset;
  onUpdate: (updatedAsset: CharacterAsset, silent?: boolean) => void;
  projectId: string;
}

const CharacterDetail: React.FC<CharacterDetailProps> = ({ asset, onUpdate, projectId }) => {
  return (
    <div className="h-full w-full overflow-hidden">
      <RedesignedCharacterWorkflow
        asset={asset}
        onUpdate={onUpdate}
        projectId={projectId}
      />
    </div>
  );
};

export default CharacterDetail;
