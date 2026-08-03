/**
 * useCollaboration — everything about a shared session: who is in it, the Yjs
 * document and its provider, joining by token, and tearing it all down
 * (v5.89, lifted verbatim out of ScreenplayEditor).
 *
 * This was 326 references threaded through a 4,600-line component. It closes
 * over almost nothing from the editor — only what to call the document, which
 * arrives as a parameter — so it moves as a unit, and the component gets the
 * same names back by destructuring. The render tree is untouched.
 *
 * Things in here that look defensive and are load-bearing:
 *  - `collabDocNameRef` exists because React StrictMode mounts twice, and a
 *    second provider on the same document duplicates every keystroke.
 *  - `collabExitingRef` guards the teardown against the provider's own
 *    disconnect handler firing while we are already tearing down.
 *  - the provider is destroyed BEFORE the Y.Doc: the reverse order leaves the
 *    provider writing into a destroyed doc.
 */
import React, { useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useProjectStore } from '../stores/projectStore';
import { randomCollabColor } from '../components/screenplayEditorConstants';
import type { useEditor } from '@tiptap/react';
import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { useFormattingTemplateStore } from '../stores/formattingTemplateStore';
import { api } from '../services/api';
import { projectApi } from '../services/projectApi';
import { scriptApi } from '../services/scriptApi';
import { getCollabWsUrl } from '../config';
import { showToast } from '../components/Toast';
import { useSettingsStore } from '../stores/settingsStore';
import { startCollabSync, stopCollabSync } from '../services/collabSync';
import { stripSaveExtras } from '../utils/screenplaySaveContent';

export interface UseCollaborationArgs {
  /** Renaming the browser/window title when a shared script is opened. */
  setDocumentTitle: (title: string) => void;
  /** Remount the editor. Entering or leaving a session swaps the document
   *  the editor is bound to, and TipTap cannot re-bind one in place. */
  setEditorKey: (fn: (k: number) => number) => void;
  /** What to seed a shared document with when it turns out to be empty —
   *  the first person in brings the script; everyone after joins to it. */
  collabInitialContent: React.MutableRefObject<Record<string, unknown> | null>;
}

export function useCollaboration(
  { setDocumentTitle, setEditorKey, collabInitialContent }: UseCollaborationArgs,
) {
  const navigate = useNavigate();
  const { setCurrentProject, setCurrentScriptId } = useProjectStore();

  // ── Collaboration state ──
  const [collabMode, setCollabMode] = useState(false);
  const [collabUserName, setCollabUserName] = useState('Owner');
  const [isCollabHost, setIsCollabHost] = useState(false);
  const [collabRole, setCollabRole] = useState<'editor' | 'viewer'>('editor');
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [collabLoginOpen, setCollabLoginOpen] = useState(false);
  const [joinCollabOpen, setJoinCollabOpen] = useState(false);
  const [collabUsers, setCollabUsers] = useState<{ name: string; color: string }[]>([]);
  const collabColor = useMemo(() => randomCollabColor(), []);
  const [collabConnectionState, setCollabConnectionState] = useState<'connecting' | 'connected' | 'synced' | 'disconnected'>('connecting');
  // ── Collaboration activity log ──
  const [collabActivityLog, setCollabActivityLog] = useState<{ time: Date; message: string }[]>([]);
  const [collabActivityOpen, setCollabActivityOpen] = useState(false);
  const addCollabActivity = useCallback((message: string) => {
    setCollabActivityLog((prev) => [...prev.slice(-49), { time: new Date(), message }]);
  }, []);


  // Yjs document & provider — stable across renders while collab is active
  const ydocRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<HocuspocusProvider | null>(null);
  // Editor ref for onSynced callback to seed content when Yjs doc is empty
  const collabEditorRef = useRef<ReturnType<typeof useEditor>>(null);
  // Track current collab document name to prevent duplicate setup (React StrictMode)
  const collabDocNameRef = useRef<string | null>(null);

  // Cleanup collab provider
  const destroyCollab = useCallback(() => {
    stopCollabSync();
    collabDocNameRef.current = null;
    if (providerRef.current) {
      providerRef.current.destroy();
      providerRef.current = null;
    }
    if (ydocRef.current) {
      ydocRef.current.destroy();
      ydocRef.current = null;
    }
    setCollabUsers([]);
  }, []);

  // Guard to prevent duplicate collab-exit handling (awareness fires multiple
  // times, and onAuthenticationFailed may also fire after session-ended).
  const collabExitingRef = useRef(false);

  // Called when host broadcasts session-ended — guest auto-disconnects
  const handleSessionEnded = useCallback(() => {
    if (collabExitingRef.current) return;
    collabExitingRef.current = true;
    showToast('The host has ended the collaboration session', 'info');
    destroyCollab();
    setCollabMode(false);
    setIsCollabHost(false);
    setCollabRole('editor');
    // Clear project context so sample content can't overwrite the real file on save
    setCurrentProject(null);
    setCurrentScriptId(null);
    setDocumentTitle('Untitled Script');
    setEditorKey((k) => k + 1);
    navigate('/');
  }, [destroyCollab, navigate, setCurrentProject, setCurrentScriptId, setDocumentTitle]);

  const handleSessionEndedRef = useRef(handleSessionEnded);
  handleSessionEndedRef.current = handleSessionEnded;

  // Ref for document-switch handler (defined after setupCollab to avoid circular dependency)
  const handleDocumentSwitchRef = useRef<(projectId: string, scriptId: string, token: string) => void>(() => {});

  const setupCollab = useCallback((docName: string, inviteToken: string, _userName: string, isHost = false, overrideWsUrl?: string) => {
    // Skip if already setting up the same document (prevents React StrictMode
    // double-invoke from destroying a provider that's still connecting)
    if (collabDocNameRef.current === docName && providerRef.current) {
      return;
    }
    destroyCollab();
    collabDocNameRef.current = docName;
    collabExitingRef.current = false;
    setCollabConnectionState('connecting');
    setCollabActivityLog([]);
    addCollabActivity('Starting collaboration session');
    const ydoc = new Y.Doc();

    // Build compound token: "jwt:<access>|invite:<invite>" when auth is available and valid
    const { collabAuth, clearCollabAuth } = useSettingsStore.getState();
    let token = inviteToken;
    if (collabAuth.accessToken) {
      // Check JWT expiry client-side to avoid sending expired tokens
      try {
        const payload = JSON.parse(atob(collabAuth.accessToken.split('.')[1]));
        if (payload.exp && payload.exp * 1000 > Date.now()) {
          token = `jwt:${collabAuth.accessToken}|invite:${inviteToken}`;
        } else {
          // JWT expired — clear it so we don't keep sending it
          clearCollabAuth();
        }
      } catch {
        // Malformed JWT — just use invite token
        clearCollabAuth();
      }
    }

    // Use the collab server URL extracted from the invite link if provided,
    // otherwise fall back to the local setting.
    const wsUrl = overrideWsUrl || getCollabWsUrl();
    console.log(`[Collab] setupCollab: docName="${docName}", wsUrl="${wsUrl}", isHost=${isHost}, tokenPrefix="${inviteToken.slice(0, 8)}..."`);

    const provider = new HocuspocusProvider({
      url: wsUrl,
      name: docName,
      document: ydoc,
      token,
      onConnect: () => {
        console.log(`[Collab] Connected to room "${docName}" (${isHost ? 'host' : 'guest'})`);
        setCollabConnectionState('connected');
        addCollabActivity('Connected to collaboration server');
      },
      onClose: ({ event }) => {
        console.log(`[Collab] Connection closed for "${docName}": code=${event.code}`);
        setCollabConnectionState('disconnected');
        addCollabActivity(`Connection lost (code ${event.code})`);
      },
      onSynced: ({ state }) => {
        console.log(`[Collab] Synced for "${docName}": state=${state}, isHost=${isHost}`);
        if (state) {
          setCollabConnectionState('synced');
          addCollabActivity('Document synced');
        }
        // After initial sync, if the Yjs doc is empty (fresh room) and we have
        // content to seed, force-set it via the editor.
        if (state && isHost && providerRef.current === provider) {
          const fragment = ydoc.getXmlFragment('default');
          if (fragment.length === 0 && collabInitialContent.current) {
            console.log('[Collab] Yjs doc empty after sync — seeding from initial content');
            const ed = collabEditorRef.current;
            if (ed && !ed.isDestroyed) {
              ed.commands.setContent(collabInitialContent.current);
            }
          }
        }
      },
      onAuthenticationFailed: ({ reason }) => {
        // Ignore auth failures from a stale provider (e.g. old provider fires
        // after host switched documents and a new provider replaced it)
        if (providerRef.current !== provider) return;
        // Skip if session-ended already handled the exit
        if (collabExitingRef.current) {
          provider.disconnect();
          return;
        }
        collabExitingRef.current = true;

        console.error(`[Collab] Auth FAILED for "${docName}": ${reason}`);
        const isSessionEnded = reason?.includes('expired') || reason?.includes('Invalid');
        showToast(
          isSessionEnded
            ? 'The collaboration session has ended'
            : `Unable to join collaboration: ${reason}`,
          isSessionEnded ? 'info' : 'error',
        );
        // Prevent reconnection loop — disconnect provider immediately, then clean up
        provider.disconnect();
        setTimeout(() => {
          destroyCollab();
          setCollabMode(false);
          setCollabRole('editor');
          if (!isHost) {
            // Clear project context so sample content can't overwrite the real file
            setCurrentProject(null);
            setCurrentScriptId(null);
            setDocumentTitle('Untitled Script');
          }
          setEditorKey((k) => k + 1);
          if (!isHost) navigate('/');
        }, 0);
      },
      onAwarenessUpdate: ({ states }) => {
        // Ignore events from a stale provider after doc switch
        if (providerRef.current !== provider) return;

        const users: { name: string; color: string }[] = [];
        let sessionEnded = false;
        let switchProjectId = '';
        let switchScriptId = '';
        let switchToken = '';
        states.forEach((state: Record<string, unknown>) => {
          const user = state.user as { name: string; color: string; sessionEnded?: boolean; documentSwitch?: { projectId: string; scriptId: string; token: string } } | undefined;
          if (user?.sessionEnded) sessionEnded = true;
          if (user?.documentSwitch) {
            switchProjectId = user.documentSwitch.projectId;
            switchScriptId = user.documentSwitch.scriptId;
            switchToken = user.documentSwitch.token;
          }
          if (user?.name) users.push(user);
        });
        // Detect user join/leave for activity log
        setCollabUsers((prev) => {
          const prevNames = new Set(prev.map((u) => u.name));
          const newNames = new Set(users.map((u) => u.name));
          for (const u of users) {
            if (!prevNames.has(u.name)) addCollabActivity(`${u.name} joined the session`);
          }
          for (const u of prev) {
            if (!newNames.has(u.name)) addCollabActivity(`${u.name} left the session`);
          }
          return users;
        });
        // Only guests react to sessionEnded / documentSwitch — the host
        // handles these itself via handleStopCollab / switchCollabDocument.
        // Without this guard the host processes its OWN awareness broadcast,
        // causing a second setupCollab that fights with the first.
        if (isHost) return;
        if (sessionEnded) {
          handleSessionEndedRef.current();
        }
        if (switchProjectId && switchScriptId && switchToken) {
          handleDocumentSwitchRef.current(switchProjectId, switchScriptId, switchToken);
        }
      },
    });
    ydocRef.current = ydoc;
    providerRef.current = provider;

    // Start syncing metadata (characters, notes, tags, beats) via Yjs
    startCollabSync(ydoc, isHost);
  }, [destroyCollab]);

  // Called when host broadcasts document-switch — guest auto-follows
  const handleDocumentSwitch = useCallback(async (projectId: string, scriptId: string, sharedToken: string) => {
    try {
      // Validate the shared token to get the session_nonce for the room name
      const session = await api.validateCollabSession(sharedToken);
      const nonce = session.session_nonce || '';

      const project = await projectApi.getProject(projectId);
      const scriptResp = await scriptApi.getScript(projectId, scriptId);

      const content = scriptResp.content as Record<string, unknown> | null;
      if (content && typeof content === 'object' && 'type' in content && content.type === 'doc') {
        collabInitialContent.current = stripSaveExtras(content as Record<string, unknown>);
      } else if (content && typeof content === 'object' && Object.keys(content).length > 0) {
        collabInitialContent.current = content;
      }

      // Restore per-document template
      const tplId = (content as any)?._templateId;
      useFormattingTemplateStore.getState().setActiveTemplateId(typeof tplId === 'string' ? tplId : null);

      const docName = `${projectId}/${scriptId}${nonce ? `/${nonce}` : ''}`;
      setupCollab(docName, sharedToken, collabUserName);

      setCurrentProject(project);
      setCurrentScriptId(scriptId);
      setDocumentTitle(scriptResp.meta.title);
      setEditorKey((k) => k + 1);
      showToast(`Host switched to: ${scriptResp.meta.title}`, 'info');
    } catch {
      showToast('Failed to follow host to new document', 'error');
    }
  }, [setupCollab, collabUserName, setCurrentProject, setCurrentScriptId, setDocumentTitle]);

  /* Late-bound ON PURPOSE: the provider's onMessage can fire a document
     switch before this callback exists, so the ref is the indirection that
     lets the machinery above reach the handler defined below it. */
  handleDocumentSwitchRef.current = handleDocumentSwitch;

  return {
    collabMode, setCollabMode,
    collabUserName, setCollabUserName,
    isCollabHost, setIsCollabHost,
    collabRole, setCollabRole,
    shareDialogOpen, setShareDialogOpen,
    collabLoginOpen, setCollabLoginOpen,
    joinCollabOpen, setJoinCollabOpen,
    collabUsers,
    collabColor,
    collabConnectionState,
    collabActivityLog,
    collabActivityOpen, setCollabActivityOpen,
    ydocRef, providerRef, collabEditorRef, collabDocNameRef,
    destroyCollab, setupCollab,
  };
}
