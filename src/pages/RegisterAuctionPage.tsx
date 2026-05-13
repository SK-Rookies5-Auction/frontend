import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, X, Plus, Calendar, Coins, Package, Loader2, AlertCircle } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { auctionApi } from '../api/auction';
import type { Category, CategoryType } from '../api/types';
import { useToast } from '../components/common/Toast';
import { formatPrice, sanitizeNumeric } from '../utils/format';
import { toAuctionCategoryCode } from '../utils/category';
import { getRenderableImageUrl } from '../utils/image';

interface FormErrors {
  title?: string;
  description?: string;
  category?: string;
  startPrice?: string;
  endTime?: string;
  images?: string;
}

interface UploadedImage {
  url: string;
  imageKey: string;
  previewUrl: string;
  objectPreviewUrl?: string;
}

export function RegisterAuctionPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectPreviewUrlsRef = useRef<Set<string>>(new Set());
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CategoryType | ''>('');
  const [startPrice, setStartPrice] = useState('');
  const [endTime, setEndTime] = useState('');
  const [images, setPictures] = useState<UploadedImage[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    auctionApi.getCategories().then(res => {
      if (res.success) setCategories(res.data);
    });
  }, []);

  useEffect(() => {
    return () => {
      objectPreviewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      objectPreviewUrlsRef.current.clear();
    };
  }, []);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!title.trim()) newErrors.title = 'Please enter an auction title';
    if (!description.trim()) newErrors.description = 'Please provide a detailed description';
    if (!category) newErrors.category = 'Please select a category';
    if (!startPrice) newErrors.startPrice = 'Please set a starting price';
    if (!endTime) newErrors.endTime = 'Please set an end date and time';
    if (images.length === 0) newErrors.images = 'Please add at least one product image';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleImageAdd = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (e.g., 10MB)
    if (file.size > 10 * 1024 * 1024) {
      showToast('File size should be less than 10MB', 'error');
      return;
    }

    setIsUploading(true);
    try {
      const res = await auctionApi.uploadImage(file);
      if (res.success) {
        const imageUrl = res.data.imageUrl || res.data.image_url;
        const imageKey = res.data.imageKey || res.data.image_key;
        const localPreviewUrl = URL.createObjectURL(file);
        const uploadedPreviewUrl = getRenderableImageUrl(
          res.data.presignedUrl,
          res.data.presigned_url,
          imageUrl
        );
        const previewUrl = uploadedPreviewUrl || localPreviewUrl;

        if (!imageUrl || !imageKey || !previewUrl) {
          showToast('Image upload response is missing required data', 'error');
          URL.revokeObjectURL(localPreviewUrl);
          return;
        }

        const newImage = {
          url: imageUrl,
          imageKey,
          previewUrl,
          objectPreviewUrl: uploadedPreviewUrl ? undefined : localPreviewUrl,
        };
        if (uploadedPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
        else objectPreviewUrlsRef.current.add(localPreviewUrl);
        setPictures([...images, newImage]);
        showToast('Image uploaded successfully', 'success');
      }
    } catch (err) {
      console.error('Image upload failed:', err);
      showToast('Failed to upload image', 'error');
    } finally {
      setIsUploading(false);
      // Reset input value to allow selecting the same file again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    const imageToRemove = images[index];
    if (imageToRemove?.objectPreviewUrl) {
      URL.revokeObjectURL(imageToRemove.objectPreviewUrl);
      objectPreviewUrlsRef.current.delete(imageToRemove.objectPreviewUrl);
    }
    setPictures(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      showToast('Please check the highlighted fields', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const res = await auctionApi.createAuction({
        title,
        description,
        category: toAuctionCategoryCode(category) as CategoryType,
        startPrice: parseInt(startPrice.replace(/,/g, '')),
        endTime: endTime, // .toISOString() 제거 (백엔드 KST 기준에 맞춤)
        pictures: images.map(({ url, imageKey }, index) => ({
          url,
          imageKey,
          isMain: index === 0,
          sortOrder: index + 1,
        }))
      });

      if (res.success) {
        showToast('Auction registered successfully!', 'success');
        navigate('/');
      }
    } catch {
      showToast('Failed to register auction', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="bg-[#0d1b2e] border border-[#1e3a5f] rounded-2xl overflow-hidden shadow-2xl">
          <div className="p-8 border-b border-[#1e3a5f]">
            <h1 className="text-3xl font-bold text-white mb-2">Register New Auction</h1>
            <p className="text-gray-400">Share your item with the community and start the bidding!</p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="p-8 space-y-8">
            {/* Image Upload Simulation */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-300">Product Pictures (Max 5)</label>
                {errors.images && (
                  <span className="text-red-400 text-xs flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.images}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-4">
                {images.map((img, idx) => (
                  <div 
                    key={idx} 
                    className={`relative w-24 h-24 rounded-lg overflow-hidden border-2 transition-all ${
                      idx === 0 ? 'border-blue-500 ring-2 ring-blue-500/50' : 'border-[#1e3a5f]'
                    }`}
                  >
                    <img src={img.previewUrl} className="w-full h-full object-cover" alt="Preview" />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage(idx);
                      }}
                      className="absolute top-1 right-1 bg-black/50 p-1 rounded-full text-white hover:bg-red-500 transition-colors z-10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {idx === 0 && (
                      <div className="absolute bottom-0 left-0 right-0 bg-blue-600 text-[10px] text-white text-center py-0.5 font-bold">
                        MAIN
                      </div>
                    )}
                  </div>
                ))}

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/*"
                  className="hidden"
                />

                {images.length < 5 && (
                  <button
                    type="button"
                    onClick={handleImageAdd}
                    disabled={isUploading}
                    className={`w-24 h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center transition-all bg-[#0a1628] ${
                      errors.images ? 'border-red-500/50 text-red-400' : 'border-[#1e3a5f] text-gray-500 hover:border-blue-500 hover:text-blue-400'
                    }`}
                  >
                    {isUploading ? (
                      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                    ) : (
                      <>
                        <Camera className="w-8 h-8 mb-1" />
                        <span className="text-[10px] font-medium text-center px-1 leading-tight">Add Photo</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Title */}
              <div className="col-span-2 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-gray-300">Auction Title</label>
                  {errors.title && (
                    <span className="text-red-400 text-xs flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.title}
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (errors.title) setErrors({ ...errors, title: undefined });
                  }}
                  placeholder="e.g., iPhone 15 Pro Max - Like New"
                  className={`w-full px-4 py-3 bg-[#0a1628] border rounded-xl text-white placeholder-gray-600 focus:outline-none transition-all ${
                    errors.title ? 'border-red-500/50 focus:border-red-500' : 'border-[#1e3a5f] focus:border-blue-500'
                  }`}
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-gray-300">Category</label>
                  {errors.category && (
                    <span className="text-red-400 text-xs flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.category}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Package className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${errors.category ? 'text-red-400' : 'text-gray-500'}`} />
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value as CategoryType);
                      if (errors.category) setErrors({ ...errors, category: undefined });
                    }}
                    className={`w-full pl-12 pr-4 py-3 bg-[#0a1628] border rounded-xl text-white appearance-none focus:outline-none transition-all ${
                      errors.category ? 'border-red-500/50 focus:border-red-500' : 'border-[#1e3a5f] focus:border-blue-500'
                    }`}
                  >
                    <option value="" disabled>Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={toAuctionCategoryCode(cat.code || cat.name)}>{cat.name}</option>
                    ))}
                  </select>
                  <Plus className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none rotate-45" />
                </div>
              </div>

              {/* Start Price */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-gray-300">Starting Price (KRW)</label>
                  {errors.startPrice && (
                    <span className="text-red-400 text-xs flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.startPrice}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Coins className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${errors.startPrice ? 'text-red-400' : 'text-gray-500'}`} />
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    value={formatPrice(startPrice)}
                    onChange={(e) => {
                      setStartPrice(sanitizeNumeric(e.target.value));
                      if (errors.startPrice) setErrors({ ...errors, startPrice: undefined });
                    }}
                    placeholder="e.g., 500,000"
                    className={`w-full pl-12 pr-4 py-3 bg-[#0a1628] border rounded-xl text-white placeholder-gray-600 focus:outline-none transition-all ${
                      errors.startPrice ? 'border-red-500/50 focus:border-red-500' : 'border-[#1e3a5f] focus:border-blue-500'
                    }`}
                  />
                </div>
              </div>

              {/* End Time */}
              <div className="col-span-2 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-gray-300">Auction End Date & Time</label>
                  {errors.endTime && (
                    <span className="text-red-400 text-xs flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.endTime}
                    </span>
                  )}
                </div>
                <div 
                  className="relative cursor-pointer group"
                  onClick={(e) => {
                    const input = e.currentTarget.querySelector('input');
                    if (input) {
                      try {
                        input.showPicker();
                      } catch {
                        input.focus();
                      }
                    }
                  }}
                >
                  <Calendar className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${errors.endTime ? 'text-red-400' : 'text-gray-500 group-hover:text-blue-400'}`} />
                  <input
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => {
                      setEndTime(e.target.value);
                      if (errors.endTime) setErrors({ ...errors, endTime: undefined });
                    }}
                    className={`w-full pl-12 pr-4 py-3 bg-[#0a1628] border rounded-xl text-white focus:outline-none transition-all [color-scheme:dark] cursor-pointer ${
                      errors.endTime ? 'border-red-500/50 focus:border-red-500' : 'border-[#1e3a5f] focus:border-blue-500'
                    }`}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="col-span-2 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-gray-300">Detailed Description</label>
                  {errors.description && (
                    <span className="text-red-400 text-xs flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errors.description}
                    </span>
                  )}
                </div>
                <textarea
                  rows={6}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    if (errors.description) setErrors({ ...errors, description: undefined });
                  }}
                  placeholder="Describe your item, including condition, usage period, and any flaws..."
                  className={`w-full px-4 py-3 bg-[#0a1628] border rounded-xl text-white placeholder-gray-600 focus:outline-none transition-all ${
                    errors.description ? 'border-red-500/50 focus:border-red-500' : 'border-[#1e3a5f] focus:border-blue-500'
                  }`}
                ></textarea>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-5 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-xl shadow-blue-500/10 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <span>Register Auction</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
