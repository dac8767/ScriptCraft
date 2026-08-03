// v4.24: the Character tool's image overlays, extracted from CharacterProfiles
// (component split step 5): the "Select Image" asset picker and the
// click-to-enlarge lightbox. Purely presentational — the open/closed state
// (imagePickerFor, imagePickerFilter, lightboxImage) stays in the parent, which
// renders these only while open; associate/close land back there as callbacks.
import type { Asset } from '../stores/assetStore';
import { AssetImage } from './CharacterAssetMedia';
import { Modal } from './Modal';

interface CharacterImagePickerDialogProps {
  /** Character the image is being picked for (the parent's imagePickerFor). */
  forName: string;
  filter: string;
  setFilter: (v: string) => void;
  imageAssets: Asset[];
  /** Asset ids already associated to this character — marked "Linked". */
  linkedImageIds: string[];
  projectId: string;
  onAssociate: (assetId: string) => void;
  onClose: () => void;
}

export function CharacterImagePickerDialog({
  forName, filter, setFilter, imageAssets, linkedImageIds, projectId,
  onAssociate, onClose,
}: CharacterImagePickerDialogProps) {
  return (
    <Modal onClose={onClose} boxClassName="char-image-picker-dialog">
        <div className="dialog-header">
          Select Image for {forName}
          <button className="char-profiles-close" onClick={onClose}>&times;</button>
        </div>
        <div className="char-image-picker-search">
          <input
            type="text"
            placeholder="Filter by name..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="char-profiles-search-input"
            autoFocus
          />
        </div>
        <div className="char-image-picker-grid">
          {imageAssets.length === 0 ? (
            <div className="char-profiles-empty">No image assets in this project. Upload images via the Asset Manager or the Upload button on a character.</div>
          ) : (
            imageAssets
              .filter((a) => !filter || a.original_name.toLowerCase().includes(filter.toLowerCase()))
              .map((asset) => {
                const alreadyLinked = linkedImageIds.includes(asset.id);
                return (
                  <div
                    key={asset.id}
                    className={`char-image-picker-item${alreadyLinked ? ' linked' : ''}`}
                    onClick={() => !alreadyLinked && onAssociate(asset.id)}
                    title={alreadyLinked ? 'Already associated' : `Associate ${asset.original_name}`}
                  >
                    {projectId && <AssetImage projectId={projectId} assetId={asset.id} alt={asset.original_name} />}
                    <span className="char-image-picker-name">{asset.original_name}</span>
                    {alreadyLinked && <span className="char-image-picker-linked">Linked</span>}
                  </div>
                );
              })
          )}
        </div>
    </Modal>
  );
}
