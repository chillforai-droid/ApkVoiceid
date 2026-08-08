import { supabase } from '../lib/supabase';
import { User } from '@supabase/supabase-js';

export const uploadAvatar = async (file: File, user: User, folder = 'voiceid/avatars') => {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const public_id = user.id;

    const { signature, apiKey } = await fetch('/api/cloudinary-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp, folder, public_id })
    }).then(r => {
        if (!r.ok) throw new Error('Failed to get signature');
        return r.json();
    });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('signature', signature);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('folder', folder);
    formData.append('public_id', public_id);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, {
        method: 'POST',
        body: formData
    });
    
    if (!res.ok) throw new Error('Cloudinary upload failed');
    const data = await res.json();
    if (!data.secure_url) throw new Error('Cloudinary secure_url missing');
    
    return data.secure_url;
};

export const updateProfile = async (userId: string, updates: { display_name?: string, bio?: string, avatar_url?: string }) => {
    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select('*')
        .single();
    
    if (error) throw error;
    return data;
};
