import { create } from 'zustand';
import { UserProfile } from '../types';
import { supabase } from '../lib/supabase';

interface ProfileState {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<{ error?: string }>;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  loading: false,
  error: null,

  fetchProfile: async (userId) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      set({ loading: false, error: error.message });
      return;
    }
    set({ profile: data as UserProfile | null, loading: false });
  },

  updateProfile: async (updates) => {
    const profile = get().profile;
    if (!profile) return { error: 'No profile loaded' };

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile.id)
      .select()
      .single();

    if (error) return { error: error.message };
    if (data) set({ profile: data as UserProfile });
    return {};
  },
}));
