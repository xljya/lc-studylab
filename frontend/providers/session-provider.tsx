"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Session, AgentMode } from '@/lib/types';
import {
  getCurrentSession,
  createSession,
  updateSession,
  deleteSession,
  getSessions,
  setCurrentSession,
} from '@/lib/session';

interface SessionContextType {
  currentSession: Session | null;
  sessions: Session[];
  createNewSession: (mode: AgentMode, title?: string) => Session;
  switchSession: (sessionId: string) => void;
  updateCurrentSession: (updates: Partial<Session>) => void;
  deleteSessionById: (sessionId: string) => void;
  refreshSessions: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [currentSession, setCurrentSessionState] = useState<Session | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);

  const refreshSessions = useCallback(() => {
    const allSessions = getSessions();
    setSessions(allSessions);
    
    const current = getCurrentSession();
    setCurrentSessionState(current);
  }, []);

  // 初始化：加载会话列表和当前会话
  useEffect(() => {
    const timer = window.setTimeout(() => {
      refreshSessions();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refreshSessions]);

  const createNewSession = (mode: AgentMode, title?: string): Session => {
    const session = createSession(mode, title);
    refreshSessions();
    return session;
  };

  const switchSession = (sessionId: string) => {
    setCurrentSession(sessionId);
    refreshSessions();
  };

  const updateCurrentSession = (updates: Partial<Session>) => {
    if (currentSession) {
      updateSession(currentSession.id, updates);
      refreshSessions();
    }
  };

  const deleteSessionById = (sessionId: string) => {
    deleteSession(sessionId);
    refreshSessions();
  };

  return (
    <SessionContext.Provider
      value={{
        currentSession,
        sessions,
        createNewSession,
        switchSession,
        updateCurrentSession,
        deleteSessionById,
        refreshSessions,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
