/**
 * ProjectManagerTool (v0.52) — the original OpenDraft project experience,
 * embedded as a dockable tool: ProjectList's card grid (pin, color,
 * drag-reorder, rename, guarded delete, Local/Cloud, sort, New Project),
 * clicking a card drills into ProjectView's script level. Route navigation
 * is replaced by in-tool state; opening a script still loads the editor.
 */
import { useState } from 'react';
import ProjectList from './ProjectList';
import ProjectView from './ProjectView';

export default function ProjectManagerTool() {
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  return (
    <div className="fs-sticky-tool fs-projects-tool fs-pm-embedded">
      {openProjectId ? (
        <ProjectView
          embedded
          projectIdProp={openProjectId}
          onBack={() => setOpenProjectId(null)}
        />
      ) : (
        <ProjectList embedded onOpenProject={setOpenProjectId} />
      )}
    </div>
  );
}
