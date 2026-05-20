import { create } from 'zustand';
import { UserProfile } from '../types';
import { supabase } from '../lib/supabase';

interface ProfileState {
  profile: UserProfile | null;
  loading: boolean;
  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  loading: false,

  fetchProfile: async (userId) => {
    set({ loading: true });
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    set({ profile: data as UserProfile | null, loading: false });
  },

  updateProfile: async (updates) => {
    const profile = get().profile;
    if (!profile) return;
    const { data } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', profile.id)
      .select()
      .single();
    if (data) set({ profile: data as UserProfile });
  },
}));
