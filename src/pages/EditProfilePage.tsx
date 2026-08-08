import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Loader2, Camera, X, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function EditProfilePage() {
  const { user, profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  const saveProfile = async () => {
    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName, bio })
      .eq('id', user?.id);
    
    if (!error) {
        updateProfile();
        navigate(`/dashboard/profile/${user?.id}`);
    } else {
        setMessage('Failed to update profile.');
    }
    setLoading(false);
  };

  const uploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
        // Get signature from our API
        const timestamp = Math.round(new Date().getTime() / 1000);
        const folder = 'voiceid/avatars';
        const public_id = user?.id;

        const response = await fetch('/api/cloudinary-sign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ timestamp, folder, public_id })
        });

        if (!response.ok) {
            let errorText = "No response text";
            try {
                errorText = await response.text();
                console.error("Failed to get signature, status:", response.status, "text:", errorText);
            } catch (e) {
                console.error("Failed to read response text");
            }
            throw new Error(`Failed to get signature: Status ${response.status}. ${errorText}`);
        }
        
        const { signature, apiKey } = await response.json();

        // Upload to Cloudinary
        const formData = new FormData();
        formData.append('file', file);
        formData.append('signature', signature);
        formData.append('api_key', apiKey);
        formData.append('timestamp', timestamp.toString());
        formData.append('folder', folder);
        formData.append('public_id', public_id || '');

        const res = await fetch(`https://api.cloudinary.com/v1_1/${import.meta.env.VITE_CLOUDINARY_CLOUD_NAME}/image/upload`, {
            method: 'POST',
            body: formData
        });
        
        if (!res.ok) {
            const errorData = await res.json();
            console.error("Cloudinary upload failed:", errorData);
            throw new Error('Cloudinary upload failed');
        }
        
        const data = await res.json();
        if (!data.secure_url) throw new Error('Cloudinary secure_url missing');

        // Update profile
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
        if (authError || !authUser) {
            console.error("Auth error:", authError);
            throw new Error('Not authenticated');
        }
        
        
        // Query the profile BEFORE update to verify ID
        const { data: currentProfile, error: profileError } = await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .eq("id", authUser.id)
            .single();

        
        const avatarUrl = data.secure_url;

        const { data: savedProfile, error: saveError } = await supabase
          .from('profiles')
          .update({
            avatar_url: avatarUrl
          })
          .eq('id', authUser.id)
          .select("id, username, avatar_url")
          .single();


        if (saveError) {
          console.error("AVATAR DB UPDATE ERROR:", saveError);
          throw saveError;
        }

        // Verify persistence by refetching
        const { data: verification, error: verificationError } = await supabase
          .from("profiles")
          .select("id, avatar_url")
          .eq("id", authUser.id)
          .single();


        if (verification?.avatar_url !== avatarUrl) {
            console.error("Avatar URL persistence mismatch!");
            throw new Error('Failed to persist avatar to profile.');
        }

        await updateProfile();
        setMessage('Avatar updated!');
    } catch (e) {
        console.error("Upload error:", e);
        setMessage('Failed to upload avatar.');
    }
    setUploading(false);
  };

  return (
    <div className="max-w-xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Edit Profile</h1>
      <div className="p-6 bg-white border border-gray-100 rounded-2xl space-y-4">
        <label className="block text-sm font-medium text-gray-700">Avatar</label>
        <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-gray-100 border overflow-hidden">
                {profile?.avatar_url && <img key={profile.avatar_url} src={profile.avatar_url} alt="Profile photo preview" decoding="async" className="w-full h-full object-cover" />}
            </div>
            <label className="px-4 py-2 bg-blue-50 text-blue-600 rounded-full cursor-pointer hover:bg-blue-100 flex items-center gap-2">
                {uploading ? <Loader2 className="animate-spin" size={16}/> : <Camera size={16}/>} Change Photo
                <input type="file" className="hidden" accept="image/*" onChange={uploadAvatar} />
            </label>
        </div>
      </div>
      <div className="p-6 bg-white border border-gray-100 rounded-2xl space-y-4">
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full p-3 border rounded-full" placeholder="Display Name" />
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="w-full p-3 border rounded-2xl" placeholder="Bio" rows={3} />
        <button onClick={saveProfile} disabled={loading} className="w-full px-6 py-3 bg-blue-600 text-white rounded-full flex items-center justify-center gap-2">
            {loading ? <Loader2 className="animate-spin" size={16}/> : <Check size={16}/>} Save Changes
        </button>
      </div>
      {message && <p className="text-center text-sm">{message}</p>}
    </div>
  );
}
