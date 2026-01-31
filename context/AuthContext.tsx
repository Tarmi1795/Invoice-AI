
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, getUserProfile } from '../services/supabaseClient';
import { UserProfile } from '../types';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  hasModuleAccess: (moduleId: string) => boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setLoading(false);
    });

    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
          fetchProfile(session.user.id);
      } else {
          setProfile(null);
          setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
      try {
          const data = await getUserProfile(userId);
          setProfile(data);
      } catch (e) {
          console.error("Failed to load profile", e);
      } finally {
          setLoading(false);
      }
  };

  const refreshProfile = async () => {
      if (user) await fetchProfile(user.id);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setSession(null);
  };

  const hasModuleAccess = (moduleId: string) => {
      if (!profile) return false;
      if (profile.role === 'admin') return true;
      return profile.allowed_modules.includes(moduleId);
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, isAdmin, hasModuleAccess, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
