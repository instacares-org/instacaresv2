"use client";

import { useState, useRef } from 'react';
import { UserCircleIcon, CameraIcon } from '@heroicons/react/24/outline';
import { addCSRFHeader } from '@/lib/csrf';

export default function AvatarUploader({ 
  currentAvatar, 
  onAvatarChange 
}: {
  currentAvatar?: string;
  onAvatarChange: (avatarUrl: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentAvatar);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    setPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await fetch('/api/profile/upload-avatar', {
        method: 'POST',
        headers: addCSRFHeader(),
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();
      if (result.success) {
        onAvatarChange(result.avatarUrl);
      }
    } catch (error) {
      alert('Failed to upload avatar');
      setPreview(currentAvatar);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative group">
        {preview ? (
          <img
            src={preview}
            alt="Avatar"
            className="w-32 h-32 rounded-full object-cover border-4 border-gray-200 dark:border-gray-700"
          />
        ) : (
          <UserCircleIcon className="w-32 h-32 text-gray-400" />
        )}
        
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
            <div className="animate-spin h-8 w-8 border-4 border-white border-t-transparent rounded-full" />
          </div>
        )}

        <button
          onClick={() => fileInputRef.current?.click()}
          className="absolute bottom-0 right-0 bg-rose-600 text-white p-2 rounded-full hover:bg-rose-700 transition shadow-lg"
          disabled={uploading}
        >
          <CameraIcon className="h-5 w-5" />
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 text-center">
        {uploading ? 'Uploading...' : 'Click camera icon to upload'}
      </p>
    </div>
  );
}
