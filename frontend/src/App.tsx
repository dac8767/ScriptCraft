import { useEffect } from 'react';
import { Routes, Route } from 'react-router';
import ScreenplayEditor from './components/ScreenplayEditor';
import TreatmentEditor from './components/TreatmentEditor';
import SettingsPage from './components/SettingsPage';
import Toast from './components/Toast';
import ConfirmDialogHost from './components/ConfirmDialog';
import DemoBanner from './components/DemoBanner';
import AuthGate from './components/AuthGate';
import AuthBootstrap from './components/AuthBootstrap';
import StorageFallbackDialog from './components/StorageFallbackDialog';
import HoverTooltip from './components/HoverTooltip';
import SaveErrorDialog from './components/SaveErrorDialog';
import OneDriveWarningDialog from './components/OneDriveWarningDialog';
import VerifyEmailRoute from './components/VerifyEmailRoute';
import ResetPasswordRoute from './components/ResetPasswordRoute';
import OAuthCallback from './components/OAuthCallback';
import { FeedbackFrameHost } from './components/FeedbackTool';
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
        <Route path="/verify" element={<VerifyEmailRoute />} />
        <Route path="/reset-password" element={<ResetPasswordRoute />} />
        <Route path="/oauth-callback" element={<OAuthCallback />} />
        <Route path="/project/:projectId/edit/:scriptId" element={<ScreenplayEditor />} />
        <Route path="/project/:projectId/treatment/:scriptId" element={<TreatmentEditor />} />
        <Route path="/project/:projectId/history/:scriptId/:commitHash" element={<ScreenplayEditor />} />
        <Route path="/settings" element={<SettingsPage />} />
        {pluginRoutes.map((r) => (
          <Route key={r.path} path={r.path} element={<r.component />} />
        ))}
      </Routes>
      <Toast />
      <HoverTooltip />
      <ConfirmDialogHost />
      <AuthGate />
      <AuthBootstrap />
      <StorageFallbackDialog />
      <SaveErrorDialog />
      <OneDriveWarningDialog />
      {/* v4.35: the ONE preloaded Feedback iframe — lives for the app's whole
          run so the form is already loaded when the Feedback window (which
          only publishes a rect for it to fill) opens. Outside the Routes so
          navigation can't unmount it. */}
      <FeedbackFrameHost />
    </>
  );
}

export default App;
