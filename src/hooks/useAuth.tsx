import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Profile {
  id: string;
  email: string;
  full_name: string;
  department?: string;
  role: 'admin' | 'operator' | 'approver';
  avatar_url?: string;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isOperator: boolean;
  isApprover: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  };

  useEffect(() => {
    console.log('🔐 Initializing auth system...');
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔐 Auth state change:', event, 'User ID:', session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          console.log('✅ User authenticated, fetching profile...');
          // Defer profile fetch to avoid potential deadlock
          setTimeout(async () => {
            try {
              const profileData = await fetchProfile(session.user.id);
              if (profileData) {
                console.log('✅ Profile loaded:', profileData.role);
                setProfile(profileData);
              } else {
                console.warn('⚠️ No profile found for user');
              }
            } catch (error) {
              console.error('❌ Error loading profile:', error);
            } finally {
              setLoading(false);
            }
          }, 0);
        } else {
          console.log('👋 User logged out');
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    console.log('🔍 Checking for existing session...');
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('❌ Error getting session:', error);
        setLoading(false);
        return;
      }

      if (session) {
        console.log('✅ Existing session found:', session.user.id);
      } else {
        console.log('ℹ️ No existing session');
      }

      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(async () => {
          try {
            const profileData = await fetchProfile(session.user.id);
            if (profileData) {
              console.log('✅ Profile restored:', profileData.role);
              setProfile(profileData);
            }
          } catch (error) {
            console.error('❌ Error restoring profile:', error);
          } finally {
            setLoading(false);
          }
        }, 0);
      } else {
        setLoading(false);
      }
    });

    // Health check interval
    const healthCheckInterval = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session && user) {
          console.warn('⚠️ Session expired, logging out...');
          await signOut();
        }
      } catch (error) {
        console.error('❌ Health check failed:', error);
      }
    }, 60000); // Check every minute

    return () => {
      console.log('🔌 Cleaning up auth subscription...');
      subscription.unsubscribe();
      clearInterval(healthCheckInterval);
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName
          }
        }
      });

      if (error) {
        toast.error(error.message);
        return { error };
      }

      toast.success('Conta criada com sucesso! Verifique seu email.');
      return { error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      const errorMessage = 'Erro inesperado ao criar conta';
      toast.error(errorMessage);
      return { error: { message: errorMessage } };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Email ou senha incorretos');
        } else {
          toast.error(error.message);
        }
        return { error };
      }

      toast.success('Login realizado com sucesso!');
      return { error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      const errorMessage = 'Erro inesperado ao fazer login';
      toast.error(errorMessage);
      return { error: { message: errorMessage } };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setProfile(null);
      toast.success('Logout realizado com sucesso!');
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Erro ao fazer logout');
    }
  };

  const isAdmin = profile?.role === 'admin';
  const isOperator = profile?.role === 'operator' || isAdmin;
  const isApprover = profile?.role === 'approver' || isAdmin;

  const value: AuthContextType = {
    user,
    session,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    isAdmin,
    isOperator,
    isApprover,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};