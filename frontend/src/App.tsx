import { useEffect } from 'react';
import { Routes, Route } from 'react-router';
import ScreenplayEditor from './components/ScreenplayEditor';
import TreatmentEditor from './components/TreatmentEditor';
import Toast from './components/Toast';
import ConfirmDialogHost from './components/ConfirmDialog';
import DemoBanner from './components/DemoBanner';
import StorageFallbackDialog from './components/StorageFallbackDialog';
import HoverTooltip from './components/HoverTooltip';
import SaveErrorDialog from './components/SaveErrorDialog';
import OneDriveWarningDialog from './components/OneDriveWarningDialog';
import OAuthCallback from './components/OAuthCallback';
import { pluginRegistry } from './plugins/registry';
import { installHelperTextDom } from './utils/helperText';
import './styles/screenplay.css';
import './styles/avScript.css';

function App() {
  const pluginRoutes = pluginRegistry.getRoutes();
  // v6.20: Derek's Helper Text overrides — one applier swaps title/placeholder
  // attributes app-wide (incl. TipTap node views and portals); HoverTooltip
  // reads the same attributes, so custom tooltips pick the overrides up too.
  useEffect(() => installHelperTextDom(), []);

  return (
    <>
      <DemoBanner />
      <Routes>
        <Route path="/" element={<ScreenplayEditor />} />
        {/* /oauth-callback stays: it is the landing page for the Google
            Drive / OneDrive save-location connect popups (oauthPkce). */}
        <Route path="/oauth-callback" element={<OAuthCallback />} />
        <Route path="/project/:projectId/edit/:scriptId" element={<ScreenplayEditor />} />
        <Route path="/project/:projectId/treatment/:scriptId" element={<TreatmentEditor />} />
        <Route path="/project/:projectId/history/:scriptId/:commitHash" element={<ScreenplayEditor />} />
        {pluginRoutes.map((r) => (
          <Route key={r.path} path={r.path} element={<r.component />} />
        ))}
      </Routes>
      <Toast />
      <HoverTooltip />
      <ConfirmDialogHost />
      <StorageFallbackDialog />
      <SaveErrorDialog />
      <OneDriveWarningDialog />
      {/* (v6.84: the preloaded Airtable Feedback iframe is gone — Feedback is
          a native form now, services/feedbackBackend.) */}
    </>
  );
}

export default App;
