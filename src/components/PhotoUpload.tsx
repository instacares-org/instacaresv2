"use client";

import { useState, useRef } from 'react';
import OptimizedImage from './OptimizedImage';
import { 
  PhotoIcon, 
  PlusIcon, 
  TrashIcon, 
  PencilIcon,
  XMarkIcon 
} from '@heroicons/react/24/outline';

interface Photo {
  id: string;
  url: string;
  caption: string;
  isProfile: boolean;
  sortOrder: number;
}

interface PhotoUploadProps {
  photos: Photo[];
  onPhotosChange: (photos: Photo[]) => void;
}

// Image compression utility
const compressImage = (file: File, quality: number = 0.8): Promise<File> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Calculate optimal dimensions (max 1200px on either side)
      const maxSize = 1200;
      let { width, height } = img;
      
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else {
          width = (width * maxSize) / height;
          height = maxSize;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file); // Fallback to original
          }
        },
        'image/jpeg',
        quality
      );
    };
    
    img.src = URL.createObjectURL(file);
  });
};

export default function PhotoUpload({ photos, onPhotosChange }: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB - reduced for better performance
      alert('File size must be less than 5MB');
      return;
    }

    // Client-side image compression before upload
    const compressedFile = await compressImage(file);

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('photo', compressedFile);
      formData.append('caption', 'New daycare photo');
      formData.append('isProfile', 'false');

      const response = await fetch('/api/caregivers/photos', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload photo');
      }

      const result = await response.json();
      if (result.success) {
        // Add new photo to the list
        onPhotosChange([...photos, result.photo]);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload photo');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) {
      return;
    }

    try {
      const response = await fetch(`/api/caregivers/photos?id=${photoId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete photo');
      }

      // Remove photo from the list
      onPhotosChange(photos.filter(p => p.id !== photoId));
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete photo');
    }
  };

  const handleEditPhoto = (photo: Photo) => {
    setEditingPhoto(photo);
    setEditCaption(photo.caption);
  };

  const handleSaveEdit = async () => {
    if (!editingPhoto) return;

    try {
      const formData = new FormData();
      formData.append('caption', editCaption);
      formData.append('isProfile', editingPhoto.isProfile.toString());

      const response = await fetch(`/api/caregivers/photos/${editingPhoto.id}`, {
        method: 'PATCH',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to update photo');
      }

      const result = await response.json();
      if (result.success) {
        // Update photo in the list
        onPhotosChange(photos.map(p => 
          p.id === editingPhoto.id 
            ? { ...p, caption: editCaption }
            : p
        ));
        setEditingPhoto(null);
        setEditCaption('');
      }
    } catch (error) {
      console.error('Update error:', error);
      alert('Failed to update photo');
    }
  };

  const handleSetAsProfile = async (photoId: string) => {
    try {
      const formData = new FormData();
      formData.append('isProfile', 'true');

      const response = await fetch(`/api/caregivers/photos/${photoId}`, {
        method: 'PATCH',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to set as profile photo');
      }

      // Update photos - unset all others and set this one
      onPhotosChange(photos.map(p => ({
        ...p,
        isProfile: p.id === photoId
      })));
    } catch (error) {
      console.error('Profile photo error:', error);
      alert('Failed to set as profile photo');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Daycare Photos
          </h3>
          <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
            Showcase your daycare space to build trust with parents
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 
                     disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center"
          >
            {uploading ? (
              <>
                <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                Uploading...
              </>
            ) : (
              <>
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Photo
              </>
            )}
          </button>
        </div>
      </div>

      {/* Photos Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {photos.map((photo) => (
          <div key={photo.id} className="relative group">
            <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
              <OptimizedImage
                src={photo.url}
                alt={photo.caption || (photo.isProfile ? 'Profile photo' : 'Portfolio photo')}
                width={400}
                height={400}
                className="w-full h-full"
                priority={photo.isProfile} // Prioritize profile photos
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
              
              {photo.isProfile && (
                <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">
                  Profile Photo
                </div>
              )}
            </div>
            
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {photo.caption}
              </p>
            </div>
            
            {/* Hover Controls */}
            <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex flex-col space-y-1">
                <button
                  onClick={() => handleEditPhoto(photo)}
                  className="bg-white p-1.5 rounded-full shadow-sm hover:bg-gray-50 transition"
                  title="Edit caption"
                >
                  <PencilIcon className="h-3 w-3 text-gray-600" />
                </button>
                
                {!photo.isProfile && (
                  <button
                    onClick={() => handleSetAsProfile(photo.id)}
                    className="bg-white p-1.5 rounded-full shadow-sm hover:bg-gray-50 transition"
                    title="Set as profile photo"
                  >
                    <PhotoIcon className="h-3 w-3 text-blue-600" />
                  </button>
                )}
                
                <button
                  onClick={() => handleDeletePhoto(photo.id)}
                  className="bg-white p-1.5 rounded-full shadow-sm hover:bg-gray-50 transition"
                  title="Delete photo"
                >
                  <TrashIcon className="h-3 w-3 text-red-600" />
                </button>
              </div>
            </div>
          </div>
        ))}
        
        {/* Add Photo Placeholder */}
        {photos.length === 0 && (
          <div 
            className="aspect-square border-2 border-dashed border-gray-300 dark:border-gray-600 
                     rounded-lg flex flex-col items-center justify-center hover:border-green-400 
                     dark:hover:border-green-500 transition cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <PhotoIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm text-center">
              Click to add your first photo
            </p>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                Edit Photo
              </h4>
              <button
                onClick={() => {
                  setEditingPhoto(null);
                  setEditCaption('');
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Caption
                </label>
                <input
                  type="text"
                  value={editCaption}
                  onChange={(e) => setEditCaption(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 
                           rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent
                           dark:bg-gray-700 dark:text-white"
                  placeholder="Enter photo caption..."
                />
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setEditingPhoto(null);
                    setEditCaption('');
                  }}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 
                           dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}