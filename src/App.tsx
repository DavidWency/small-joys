import React, { useState, useEffect, useMemo, Component, ReactNode, useRef } from 'react';
import { supabase } from './supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Plus, X, Send, Info, Image as ImageIcon, MapPin, Loader2 } from 'lucide-react';

// --- Types ---
interface Joy {
  id: string;
  content: string;
  created_at: string;
  color?: string;
  photo_url?: string;
  country?: string;
}

// --- Components ---

const COLORS = [
  'bg-rose-50', 'bg-amber-50', 'bg-emerald-50', 'bg-sky-50', 'bg-violet-50', 'bg-stone-50'
];

interface JoyCardProps {
  joy: Joy;
}

const JoyCard = ({ joy }: JoyCardProps) => {
  const randomColor = useMemo(() => COLORS[Math.floor(Math.random() * COLORS.length)], []);
  
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

  return (
    <div
      className={`${randomColor} p-6 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col justify-between min-h-[160px] h-full`}
    >
      <div>
        {joy.photo_url && (
          <img 
            src={joy.photo_url} 
            alt="Shared joy" 
            className="w-full h-48 object-cover rounded-xl mb-4"
            referrerPolicy="no-referrer"
          />
        )}
        <p className="text-stone-800 text-lg font-serif leading-relaxed">
          {joy.content}
        </p>
      </div>
      <div className="mt-4 flex justify-between items-end text-[10px] uppercase tracking-widest text-stone-400 font-mono">
        <div className="flex flex-col gap-1">
          {joy.country && (
            <span className="flex items-center gap-1 italic lowercase">
              <MapPin size={10} /> {joy.country}
            </span>
          )}
          <span>{formatDate(joy.created_at)}</span>
        </div>
        <Heart size={12} className="text-rose-300 fill-rose-300" />
      </div>
    </div>
  );
};

const SmallJoysWall = () => {
  const [joys, setJoys] = useState<Joy[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newJoy, setNewJoy] = useState('');
  const [country, setCountry] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConnectionOk, setIsConnectionOk] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchJoys = async () => {
      try {
        const { data, error } = await supabase
          .from('joys')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setJoys(data || []);
      } catch (error) {
        console.error('Error fetching joys:', error);
        setIsConnectionOk(false);
      }
    };

    fetchJoys();

    // 订阅实时更新
    const channel = supabase
      .channel('realtime joys')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'joys' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setJoys(prev => [payload.new as Joy, ...prev]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJoy.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      let photoUrl = '';
      
      // 图片上传
      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('joys')
          .upload(fileName, selectedImage);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('joys')
          .getPublicUrl(fileName);
        
        photoUrl = publicUrl;
      }
      
      const { error } = await supabase
        .from('joys')
        .insert({
          content: newJoy.trim(),
          country: country.trim() || null,
          photo_url: photoUrl || null,
        });
      
      if (error) throw error;
      
      setNewJoy('');
      setCountry('');
      setSelectedImage(null);
      setImagePreview(null);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Error submitting joy:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 selection:bg-rose-100">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 py-12 md:py-20 text-center">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl md:text-7xl font-serif italic mb-6 tracking-tight"
        >
          Small Joys
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-stone-500 text-lg md:text-xl max-w-2xl mx-auto font-light leading-relaxed"
        >
          A wall of small things people are grateful for. Anonymous. No likes. No accounts. Just small human moments, shared with the world.
        </motion.p>
      </header>

      {/* Connection Warning */}
      {!isConnectionOk && (
        <div className="max-w-xl mx-auto mb-8 px-4">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-amber-800 text-sm">
            <Info size={18} className="shrink-0 mt-0.5" />
            <p>It looks like you're offline or the database connection is restricted. Please check your connection.</p>
          </div>
        </div>
      )}

      {/* Wall Grid */}
      <main className="max-w-6xl mx-auto px-6 pb-32">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {joys.map((joy) => (
              <motion.div
                key={joy.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
              >
                <JoyCard joy={joy} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        
        {joys.length === 0 && (
          <div className="text-center py-20 text-stone-400 italic font-serif">
            The wall is quiet. Be the first to share a joy.
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-8 right-8 bg-stone-900 text-white p-4 rounded-full shadow-2xl hover:bg-stone-800 transition-colors z-40 flex items-center gap-2 px-6"
      >
        <Plus size={24} />
        <span className="font-medium">Share a joy</span>
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-[#FDFBF7] w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-10">
                <div className="mb-6">
                  <h2 className="text-3xl font-serif text-[#4A3728] mb-2">Share a small joy</h2>
                  <p className="text-[#8B735B] text-sm font-sans">
                    Anonymous. No account needed. Just something that made your day.
                  </p>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="relative">
                    <textarea
                      autoFocus
                      value={newJoy}
                      onChange={(e) => setNewJoy(e.target.value)}
                      placeholder="Today..."
                      className="w-full h-44 p-6 bg-transparent border border-[#E8E1D5] rounded-2xl focus:ring-1 focus:ring-[#C4B5A5] focus:border-[#C4B5A5] outline-none transition-all resize-none text-lg font-serif placeholder:text-[#C4B5A5] text-[#4A3728]"
                      maxLength={280}
                    />
                    <span className="absolute bottom-4 right-4 text-xs text-[#C4B5A5] font-sans">
                      {newJoy.length}/280
                    </span>
                  </div>

                  {/* Add Photo */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="group cursor-pointer border-2 border-dashed border-[#E8E1D5] rounded-2xl p-4 flex items-center gap-3 text-[#8B735B] hover:border-[#C4B5A5] hover:bg-[#F9F6F1] transition-all"
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImageChange} 
                      className="hidden" 
                      accept="image/*"
                    />
                    {imagePreview ? (
                      <div className="relative w-full h-20">
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedImage(null); setImagePreview(null); }}
                          className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <ImageIcon size={20} className="text-[#C4B5A5]" />
                        <span className="text-sm">Add a photo <span className="opacity-60">(optional)</span></span>
                      </>
                    )}
                  </div>

                  {/* Country */}
                  <div className="relative">
                    <input
                      type="text"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Your country (optional)"
                      className="w-full p-4 bg-transparent border border-[#E8E1D5] rounded-2xl focus:ring-1 focus:ring-[#C4B5A5] focus:border-[#C4B5A5] outline-none transition-all text-sm placeholder:text-[#C4B5A5] text-[#4A3728]"
                    />
                  </div>

                  <div className="pt-4 flex justify-end items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-8 py-3 rounded-full border border-[#E8E1D5] text-[#8B735B] hover:bg-[#F9F6F1] transition-all text-sm font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!newJoy.trim() || isSubmitting}
                      className="bg-[#B0A498] text-white px-8 py-3 rounded-full hover:bg-[#9A8E82] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-sm font-medium min-w-[160px] justify-center"
                    >
                      {isSubmitting ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        'Post to the wall'
                      )}
                    </button>
                  </div>
                  
                  <p className="text-center text-[10px] text-[#C4B5A5] mt-4 italic">
                    Posts may take a few seconds to appear.
                  </p>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-12 text-center border-t border-stone-200 text-stone-400 text-sm font-light">
        <p>© {new Date().getFullYear()} Small Joys Wall. Built with love.</p>
      </footer>
    </div>
  );
};

export default function App() {
  return <SmallJoysWall />;
}
