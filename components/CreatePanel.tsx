import React, { useState, useEffect, useRef } from 'react';
import { ApiSettings, VideoModel, VideoSize, VideoDuration, VideoOrientation, CreateVideoRequest, VideoTask, CreateCharacterResponse, CreatePanelState, CreateCharacterRequest } from '../types';
import { optimizePrompt, createVideoTask, createCharacter } from '../services/apiService';
import { Wand2, Image as ImageIcon, Video, Loader2, Sparkles, AlertCircle, Upload, LinkIcon, UserCircle, Coins, X, Type, Clock, Copy, Check, ExternalLink, Plus, Layers, Trash2, Edit3, Eye, FileVideo } from 'lucide-react';

interface CreatePanelProps {
  settings: ApiSettings;
  onTasksCreated: (taskIds: string[], prompt: string, model: VideoModel, orientation: VideoOrientation) => void;
  onOpenSettings: () => void;
  initialState?: CreatePanelState;
  savedCharacters: CreateCharacterResponse[];
  onSaveCharacter: (char: CreateCharacterResponse) => void;
}

type GenerationMode = 'text' | 'image';

interface StoryboardSegment {
  id: string;
  duration: number;
  description: string;
}

const CreatePanel: React.FC<CreatePanelProps> = ({ settings, onTasksCreated, onOpenSettings, initialState, savedCharacters, onSaveCharacter }) => {
  const [mode, setMode] = useState<GenerationMode>('text');
  
  const [model, setModel] = useState<VideoModel>(VideoModel.SORA_2);
  const [prompt, setPrompt] = useState('');
  
  // Storyboard Mode State
  const [isStoryboardMode, setIsStoryboardMode] = useState(false);
  const [storyboardView, setStoryboardView] = useState<'edit' | 'preview'>('edit');
  const [storyboardSegments, setStoryboardSegments] = useState<StoryboardSegment[]>([
    { id: '1', duration: 5, description: '' }
  ]);
  const [previewPrompt, setPreviewPrompt] = useState('');
  
  // Image input handling
  const [imageUrl, setImageUrl] = useState('');
  const [imageInput, setImageInput] = useState('');

  // Character Creation Inputs
  const [characterUrl, setCharacterUrl] = useState('');
  
  // Timestamp state for dropdowns
  const [startTime, setStartTime] = useState<number>(1);
  const [endTime, setEndTime] = useState<number>(3);

  const [duration, setDuration] = useState<VideoDuration>(10);
  const [size, setSize] = useState<VideoSize>('small');
  const [orientation, setOrientation] = useState<VideoOrientation>('portrait');
  const [batchCount, setBatchCount] = useState<number>(1);
  
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [createdCharacter, setCreatedCharacter] = useState<CreateCharacterResponse | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Auto-generation Ref to prevent double firing or stale closure issues
  const autoGenTriggered = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate total duration of storyboards
  const totalSegmentDuration = storyboardSegments.reduce((sum, seg) => sum + (Number(seg.duration) || 0), 0);

  useEffect(() => {
    if (initialState) {
      if (initialState.prompt) setPrompt(initialState.prompt);
      if (initialState.model) setModel(initialState.model);
      if (initialState.characterUrl) setCharacterUrl(initialState.characterUrl);
      
      // Handle Auto Generation for Regenerate button
      if (initialState.autoGenerate && !autoGenTriggered.current) {
        autoGenTriggered.current = true;
        // Small timeout to allow state to settle
        setTimeout(() => {
          handleGenerate(undefined, true);
        }, 100);
      } else {
         // Reset trigger if not auto-generating (manual entry)
         autoGenTriggered.current = false;
      }
    }
  }, [initialState]);

  useEffect(() => {
    // Model constraints logic
    if (model === VideoModel.SORA_2 || model === VideoModel.SORA_2_CHARACTERS) {
      if (duration === 25) setDuration(15);
      setSize('small');
    } else if (model === VideoModel.SORA_2_PRO) {
      if (duration === 10) setDuration(15);
      
      if (duration === 25) {
        setSize('small');
      } else if (duration === 15) {
        setSize('large');
      }
    }
  }, [model, duration]);

  // Reset storyboard view when mode toggles
  useEffect(() => {
     if (!isStoryboardMode) setStoryboardView('edit');
  }, [isStoryboardMode]);

  // Bug fix: When duration changes, clamp storyboard segments to fit new duration
  useEffect(() => {
    if (isStoryboardMode) {
      setStoryboardSegments(prevSegments => {
        let accumulatedTime = 0;
        const newSegments: StoryboardSegment[] = [];
        
        for (const seg of prevSegments) {
          // If we are already full, stop adding segments
          if (accumulatedTime >= duration) break;
          
          let segDuration = seg.duration;
          
          // If adding this segment exceeds duration, trim it
          if (accumulatedTime + segDuration > duration) {
            segDuration = duration - accumulatedTime;
          }
          
          // Only add valid segments
          if (segDuration > 0) {
            newSegments.push({ ...seg, duration: segDuration });
            accumulatedTime += segDuration;
          }
        }
        
        // If somehow we ended up empty (shouldn't happen with valid logic but safe fallback)
        if (newSegments.length === 0) {
           return [{ id: Date.now().toString(), duration: duration, description: '' }];
        }
        
        return newSegments;
      });
    }
  }, [duration, isStoryboardMode]);

  useEffect(() => {
     // Clear previous character results when switching models or inputs
     if (model !== VideoModel.SORA_2_CHARACTERS) {
       setCreatedCharacter(null);
     }
  }, [model, characterUrl, startTime, endTime]);

  // Update endTime when startTime changes to maintain valid range
  useEffect(() => {
     if (endTime <= startTime || endTime > startTime + 3) {
         setEndTime(startTime + 1);
     }
  }, [startTime]);

  const handleOptimize = async () => {
    if (!settings.apiKey) return onOpenSettings();
    
    setIsOptimizing(true);
    setError(null);

    try {
      if (isStoryboardMode) {
        if (storyboardView === 'preview') {
            // Optimize the full script in the preview box
            if (!previewPrompt.trim()) {
                setIsOptimizing(false);
                return;
            }
            const optimizedScript = await optimizePrompt(previewPrompt, settings, 'script');
            setPreviewPrompt(optimizedScript);
        } else {
             // Fallback for edit mode (though button is usually hidden)
             // Collect all descriptions
            const descriptions = storyboardSegments.map(s => s.description).join('|||');
            if (!descriptions.trim()) {
              setIsOptimizing(false);
              return;
            }
            const optimizedResult = await optimizePrompt(descriptions, settings, 'segments');
            const optimizedParts = optimizedResult.split('|||');
            
            // Update segments with optimized descriptions
            setStoryboardSegments(prev => prev.map((seg, idx) => ({
              ...seg,
              description: optimizedParts[idx]?.trim() || seg.description
            })));
        }
      } else {
        if (!prompt.trim()) {
          setIsOptimizing(false);
          return;
        }
        const optimized = await optimizePrompt(prompt, settings, 'text');
        setPrompt(optimized);
      }
    } catch (err: any) {
      setError(err.message || '优化失败');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleCopyUsername = () => {
    if (createdCharacter) {
      navigator.clipboard.writeText(`@${createdCharacter.username}`);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleUseCharacter = (char: CreateCharacterResponse) => {
     // Switch to video generation mode
     if (model === VideoModel.SORA_2_CHARACTERS) {
         setModel(VideoModel.SORA_2);
     }
     
     if (isStoryboardMode) {
        if (storyboardView === 'preview') {
            setPreviewPrompt(prev => prev + ` @${char.username} `);
        } else {
            // Append to last segment description
            const lastIdx = storyboardSegments.length - 1;
            updateSegment(storyboardSegments[lastIdx].id, 'description', storyboardSegments[lastIdx].description + ` @${char.username} `);
        }
     } else {
        // Append to prompt
        setPrompt((prev) => {
            const suffix = ` @${char.username} `;
            if (!prev.includes(suffix.trim())) {
                return prev + suffix;
            }
            return prev;
        });
     }
  };

  // Storyboard helpers
  const addSegment = () => {
    // Check if adding a segment would exceed duration
    if (totalSegmentDuration >= duration) {
       setError("分镜总时长已达到视频总时长，无法添加更多分镜");
       return;
    }
    
    // Default to remaining time or 1s
    const remaining = Math.max(1, duration - totalSegmentDuration);
    const nextDuration = Math.min(5, remaining);

    setStoryboardSegments([...storyboardSegments, { id: Math.random().toString(36).substring(2, 9), duration: nextDuration, description: '' }]);
  };

  const removeSegment = (id: string) => {
    if (storyboardSegments.length > 1) {
      setStoryboardSegments(storyboardSegments.filter(s => s.id !== id));
    }
  };

  const updateSegment = (id: string, field: keyof StoryboardSegment, value: any) => {
    if (field === 'duration') {
       // Validate duration limit
       const numVal = Math.max(0, parseInt(value) || 0);
       const otherSegmentsTotal = storyboardSegments.filter(s => s.id !== id).reduce((sum, s) => sum + s.duration, 0);
       const maxAllowed = duration - otherSegmentsTotal;
       
       // Clamp value to max allowed
       const finalVal = Math.min(numVal, maxAllowed);
       
       setStoryboardSegments(storyboardSegments.map(s => s.id === id ? { ...s, duration: finalVal } : s));
    } else {
       setStoryboardSegments(storyboardSegments.map(s => s.id === id ? { ...s, [field]: value } : s));
    }
  };
  
  const handlePreviewAndOptimize = () => {
      if (totalSegmentDuration !== duration) {
          setError(`分镜总时长 (${totalSegmentDuration}s) 必须等于视频总时长 (${duration}s)`);
          return;
      }
      if (storyboardSegments.some(s => !s.description.trim())) {
          setError("请完善所有分镜的场景描述");
          return;
      }
      
      // Construct the initial script for preview
      let currentTime = 0;
      const scriptParts = storyboardSegments.map(seg => {
         const start = currentTime;
         const end = currentTime + seg.duration;
         const part = `[${start}s-${end}s] ${seg.description}`;
         currentTime = end;
         return part;
      });
      setPreviewPrompt(scriptParts.join('\n\n'));

      setError(null);
      setStoryboardView('preview');
  };

  const handleGenerate = async (e?: React.MouseEvent, isAuto = false) => {
    if (!settings.apiKey) return onOpenSettings();

    // Prevent double submission if auto-generated
    if (isGenerating) return;

    // Use current state values, or fallback if this is an auto-run and state hasn't painted yet
    const currentModel = model;
    let currentPrompt = prompt || (isAuto && initialState?.prompt ? initialState.prompt : '');
    
    // Specific validation for Character Creation
    if (currentModel === VideoModel.SORA_2_CHARACTERS) {
       // Support creating from URL
       if (!characterUrl) {
         setError("请输入角色视频 URL");
         return;
       }
    } else {
      // Validation for Video Generation
      if (isStoryboardMode) {
          if (storyboardView === 'preview') {
               // Use the edited/optimized script from the preview box
               if (!previewPrompt.trim()) {
                   setError("分镜内容不能为空");
                   return;
               }
               currentPrompt = previewPrompt.replace(/\n\n/g, '; ').replace(/\n/g, ' ');
          } else {
              // Fallback if generated from Edit view (should be blocked by UI flow but good for safety)
              if (totalSegmentDuration !== duration) {
                  setError(`分镜总时长 (${totalSegmentDuration}s) 必须等于视频总时长 (${duration}s)`);
                  return;
              }
              if (storyboardSegments.some(s => !s.description.trim())) {
                  setError("请完善所有分镜的场景描述");
                  return;
              }
              // Construct prompt from segments
              let currentTime = 0;
              const promptParts = storyboardSegments.map(seg => {
                 const start = currentTime;
                 const end = currentTime + seg.duration;
                 const part = `[${start}s-${end}s]: ${seg.description}`;
                 currentTime = end;
                 return part;
              });
              currentPrompt = promptParts.join('; ');
          }
      } else {
          if (!currentPrompt.trim()) {
            setError("请输入提示词");
            return;
          }
      }

      if (mode === 'image' && !imageUrl) {
        setError("请上传参考图片");
        return;
      }
    }

    setIsGenerating(true);
    setError(null);
    setCreatedCharacter(null);

    try {
      if (currentModel === VideoModel.SORA_2_CHARACTERS) {
        // Handle Character Creation
        const cleanTimestamps = `${startTime},${endTime}`;
        
        const payload: CreateCharacterRequest = {
            url: characterUrl.trim(),
            timestamps: cleanTimestamps
        };
        
        const response = await createCharacter(payload, settings);
        
        setCreatedCharacter(response);
        onSaveCharacter(response); // Add to global list
      } else {
        // Handle Video Generation
        const taskIds: string[] = [];
        const request: CreateVideoRequest = {
          model: currentModel,
          prompt: currentPrompt.trim(),
          images: mode === 'image' && imageUrl ? [imageUrl] : [],
          orientation,
          duration,
          size,
        };

        // Sequential execution for batch processing to ensure character consistency tags (@username) are processed correctly by backend
        // Parallel execution (Promise.all) often fails to carry context for all tasks simultaneously
        for (let i = 0; i < batchCount; i++) {
            const res = await createVideoTask(request, settings);
            taskIds.push(res.id);
            // Add a small delay between requests to avoid rate limits or context race conditions
            if (i < batchCount - 1) {
                await new Promise(resolve => setTimeout(resolve, 800));
            }
        }

        onTasksCreated(taskIds, currentPrompt, currentModel, orientation);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || (currentModel === VideoModel.SORA_2_CHARACTERS ? "创建角色失败" : "生成视频失败"));
    } finally {
      setIsGenerating(false);
      // Reset trigger
      autoGenTriggered.current = false;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError("请上传图片文件");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setImageUrl(result);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImageUrl('');
    setImageInput('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 overflow-y-auto custom-scrollbar pb-24 md:pb-6">
      <h1 className="text-xl md:text-2xl font-bold dark:text-white text-slate-800 mb-4 md:mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="text-brand-500 w-5 h-5 md:w-6 md:h-6" />
          创建视频
        </div>
        <div className="flex items-center gap-2">
           <a 
             href="https://p.vivaapi.cn" 
             target="_blank" 
             rel="noreferrer"
             className="text-sm md:text-base font-bold bg-brand-500/10 text-brand-500 hover:bg-brand-500/20 px-3 py-1.5 md:px-4 md:py-2 rounded-full flex items-center gap-1.5 transition-colors"
           >
             <ImageIcon className="w-4 h-4 md:w-5 md:h-5" />
             创建图片
           </a>
           <a 
             href="https://m.vivaapi.cn" 
             target="_blank" 
             rel="noreferrer"
             className="text-sm md:text-base font-bold bg-brand-500/10 text-brand-500 hover:bg-brand-500/20 px-3 py-1.5 md:px-4 md:py-2 rounded-full flex items-center gap-1.5 transition-colors"
           >
             <Layers className="w-4 h-4 md:w-5 md:h-5" />
             分镜大师
           </a>
        </div>
      </h1>

      {/* Tabs - Enhanced Styling */}
      <div className="flex bg-slate-200/50 dark:bg-slate-900/50 p-1 rounded-xl md:rounded-2xl mb-4 md:mb-6 border dark:border-slate-800 border-slate-200">
        <button
          onClick={() => setMode('text')}
          className={`flex-1 py-2 md:py-3 text-sm md:text-base font-bold rounded-lg md:rounded-xl flex items-center justify-center gap-2 transition-all duration-200 ${
            mode === 'text'
              ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-md shadow-brand-500/10 ring-1 ring-slate-200 dark:ring-slate-700 scale-[1.02]'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800/50'
          }`}
        >
          <Type className={`w-3.5 h-3.5 md:w-4 md:h-4 ${mode === 'text' ? 'text-brand-500' : ''}`} />
          文生视频
        </button>
        <button
          onClick={() => setMode('image')}
          className={`flex-1 py-2 md:py-3 text-sm md:text-base font-bold rounded-lg md:rounded-xl flex items-center justify-center gap-2 transition-all duration-200 ${
            mode === 'image'
              ? 'bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 shadow-md shadow-brand-500/10 ring-1 ring-slate-200 dark:ring-slate-700 scale-[1.02]'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800/50'
          }`}
        >
          <ImageIcon className={`w-3.5 h-3.5 md:w-4 md:h-4 ${mode === 'image' ? 'text-brand-500' : ''}`} />
          图生视频
        </button>
      </div>

      <div className="space-y-6 md:space-y-8">
        
        {/* Model Selection */}
        <div className="space-y-2 md:space-y-3">
          <label className="text-xs md:text-sm font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider">模型选择</label>
          <div className="grid grid-cols-1 gap-3 md:gap-4">
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <button
                onClick={() => setModel(VideoModel.SORA_2)}
                className={`p-3 md:p-4 rounded-xl border-2 text-left transition-all ${
                  model === VideoModel.SORA_2
                    ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/10'
                    : 'dark:border-slate-700 border-slate-200 dark:bg-slate-800 bg-white hover:border-slate-400 dark:hover:border-slate-600'
                }`}
              >
                <div className="font-bold text-sm md:text-base dark:text-white text-slate-900 mb-1">Sora 2</div>
                <div className="text-[10px] md:text-xs dark:text-slate-400 text-slate-500">快速，高效</div>
              </button>
              <button
                onClick={() => setModel(VideoModel.SORA_2_PRO)}
                className={`p-3 md:p-4 rounded-xl border-2 text-left transition-all ${
                  model === VideoModel.SORA_2_PRO
                    ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/10'
                    : 'dark:border-slate-700 border-slate-200 dark:bg-slate-800 bg-white hover:border-slate-400 dark:hover:border-slate-600'
                }`}
              >
                <div className="font-bold text-sm md:text-base dark:text-white text-slate-900 mb-1">Sora 2 Pro</div>
                <div className="text-[10px] md:text-xs dark:text-slate-400 text-slate-500">慢速，高清</div>
              </button>
            </div>
            
            <button
              onClick={() => setModel(VideoModel.SORA_2_CHARACTERS)}
              className={`p-3 md:p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between group ${
                model === VideoModel.SORA_2_CHARACTERS
                  ? 'border-brand-500 bg-brand-500/10 shadow-lg shadow-brand-500/10'
                  : 'dark:border-slate-700 border-slate-200 dark:bg-slate-800 bg-white hover:border-slate-400 dark:hover:border-slate-600'
              }`}
            >
              <div>
                <div className="font-bold text-sm md:text-base dark:text-white text-slate-900 mb-1 flex items-center gap-2">
                  <UserCircle className="w-4 h-4 text-brand-500" />
                  创建角色
                  <span className="text-amber-500 text-xs md:text-sm font-normal">因CORS问题，暂无法创建</span>
                </div>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                 model === VideoModel.SORA_2_CHARACTERS ? 'border-brand-500' : 'border-slate-400'
              }`}>
                {model === VideoModel.SORA_2_CHARACTERS && <div className="w-2 h-2 rounded-full bg-brand-500" />}
              </div>
            </button>
          </div>
        </div>

        {/* Content based on Mode */}
        {mode === 'image' && model !== VideoModel.SORA_2_CHARACTERS && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <label className="text-xs md:text-sm font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <ImageIcon className="w-4 h-4" /> 
              上传参考图片 <span className="text-red-500">*</span>
            </label>
            
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !imageUrl && fileInputRef.current?.click()}
              className={`relative group border-2 border-dashed rounded-xl p-4 md:p-6 transition-all flex flex-col items-center justify-center text-center gap-2 ${
                isDragging 
                  ? 'border-brand-500 bg-brand-500/10' 
                  : 'dark:border-slate-700 border-slate-300 dark:bg-slate-800 bg-slate-50'
              } ${!imageUrl ? 'cursor-pointer hover:dark:border-slate-600 hover:border-slate-400 hover:dark:bg-slate-700/50 hover:bg-slate-100' : ''}`}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={(e) => e.target.files && e.target.files[0] && handleFileSelect(e.target.files[0])}
              />
              
              {imageUrl ? (
                <div className="relative w-full h-32 md:h-40 rounded-lg overflow-hidden group/image">
                  <img src={imageUrl} alt="Reference" className="w-full h-full object-contain bg-black/20" />
                  <button 
                    onClick={handleRemoveImage}
                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-100 md:opacity-0 md:group-hover/image:opacity-100 transition-opacity hover:bg-red-600 shadow-lg"
                    title="删除图片"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full dark:bg-slate-700 bg-slate-200 flex items-center justify-center dark:text-slate-400 text-slate-500 group-hover:dark:text-white group-hover:text-slate-700 transition-colors">
                    <Upload className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div className="text-sm dark:text-slate-300 text-slate-600">
                    <span className="text-brand-500 font-medium">点击上传</span> <span className="hidden md:inline">或拖拽图片到此处</span>
                  </div>
                  <div className="text-xs dark:text-slate-500 text-slate-400">JPG, PNG</div>
                </>
              )}
            </div>
            
            {/* Warning Message */}
            <div className="flex items-start gap-2 text-amber-500 text-xs md:text-sm px-1 md:px-2">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>请勿上传真人图片，否则会生成失败。</span>
            </div>

            {!imageUrl && (
              <div className="flex items-center gap-2 px-1">
                  <LinkIcon className="w-3 h-3 dark:text-slate-600 text-slate-400" />
                  <input 
                    type="text"
                    value={imageInput}
                    placeholder="粘贴图片链接并回车..."
                    className="bg-transparent border-none text-xs md:text-sm dark:text-slate-400 text-slate-500 dark:placeholder-slate-600 placeholder-slate-400 focus:outline-none w-full"
                    onChange={(e) => setImageInput(e.target.value)}
                    onBlur={() => imageInput && setImageUrl(imageInput)}
                    onKeyDown={(e) => {
                       if (e.key === 'Enter' && imageInput) {
                           setImageUrl(imageInput);
                       }
                    }}
                  />
                  {imageInput && (
                    <button 
                       onClick={() => setImageInput('')} 
                       className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                       <X className="w-3 h-3" />
                    </button>
                  )}
              </div>
            )}
          </div>
        )}

        {/* Prompt Input - Only show if NOT Character Creation */}
        {model !== VideoModel.SORA_2_CHARACTERS && (
          <div className="space-y-3">
            <div className="flex justify-between items-center flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs md:text-sm font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider">
                  {mode === 'image' ? '提示词 (可选)' : '提示词'}
                </label>
                
                {/* Pricing Tooltip */}
                <div className="relative group">
                  <button className="p-1 rounded-full dark:hover:bg-slate-700 hover:bg-slate-200 text-slate-400 dark:text-slate-500 hover:text-brand-500 transition-colors">
                    <Coins className="w-3.5 h-3.5" />
                  </button>
                  <div className="absolute left-0 bottom-full mb-2 w-max p-4 dark:bg-slate-900 bg-white border dark:border-slate-700 border-slate-200 rounded-lg shadow-xl text-sm dark:text-slate-300 text-slate-600 hidden group-hover:block z-20">
                    <div className="font-semibold dark:text-white text-slate-900 mb-2 pb-1 border-b dark:border-slate-800 border-slate-100">价格说明</div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-4">
                        <span>sora-2</span>
                        <span className="text-brand-500 font-mono">0.084-0.196元/次</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span>sora-2-pro</span>
                        <span className="text-brand-500 font-mono">2.52-3.52元/次</span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                          <span>创建角色</span>
                          <span className="text-brand-500 font-mono">约0.007元/次</span>
                        </div>
                      <div className="flex items-center justify-between gap-4">
                        <span>AI 优化</span>
                        <span className="text-brand-500 font-mono">约0.008元/次</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                {/* Storyboard Mode Toggle */}
                <button 
                  onClick={() => setIsStoryboardMode(!isStoryboardMode)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs md:text-sm font-bold rounded-full transition-all text-brand-500 border border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20"
                >
                  <Layers size={14} />
                  {isStoryboardMode ? '分镜模式' : '切换分镜模式'}
                </button>

                {!isStoryboardMode && (
                  <button
                    onClick={handleOptimize}
                    disabled={isOptimizing || !prompt}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs md:text-sm text-brand-500 border border-brand-500 font-bold rounded-full hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isOptimizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    AI 优化
                  </button>
                )}
              </div>
            </div>
            
            {/* Prompt Area or Storyboard Area */}
            {isStoryboardMode ? (
               <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 p-3 md:p-4 rounded-xl border dark:border-slate-700 border-slate-200">
                  {storyboardView === 'edit' ? (
                     <>
                        <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 mb-2">
                           <span>场景列表 (总时长需等于 {duration}s)</span>
                           <span className={`${totalSegmentDuration === duration ? 'text-green-500' : 'text-amber-500'}`}>
                              当前: {totalSegmentDuration}s / 目标: {duration}s
                           </span>
                        </div>
                        {storyboardSegments.map((seg, idx) => (
                          <div key={seg.id} className="flex gap-2 md:gap-3 items-start animate-in slide-in-from-left-2 fade-in duration-300">
                             <div className="w-16 md:w-20 shrink-0 space-y-1">
                                <input 
                                  type="number" 
                                  min="1"
                                  value={seg.duration} 
                                  onChange={(e) => updateSegment(seg.id, 'duration', e.target.value)} 
                                  className="w-full text-center dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-200 rounded-lg py-2 px-1 text-xs md:text-sm dark:text-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                />
                                <div className="text-[10px] text-center text-slate-400">时长(s)</div>
                             </div>
                             <div className="flex-1">
                                <textarea 
                                  value={seg.description} 
                                  onChange={(e) => updateSegment(seg.id, 'description', e.target.value)} 
                                  className="w-full h-[72px] dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-200 rounded-lg py-2 px-3 text-xs md:text-sm dark:text-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:placeholder-slate-500 placeholder-slate-400 resize-none" 
                                  placeholder={`分镜 ${idx + 1} 场景描述...`} 
                                />
                             </div>
                             <button 
                               onClick={() => removeSegment(seg.id)} 
                               disabled={storyboardSegments.length === 1}
                               className={`mt-2 p-1.5 rounded-md transition-colors ${
                                  storyboardSegments.length === 1 
                                  ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' 
                                  : 'text-slate-400 hover:text-red-500 hover:bg-red-500/10'
                               }`}
                             >
                               <Trash2 size={16}/>
                             </button>
                          </div>
                        ))}
                        
                        <div className="pt-2 border-t dark:border-slate-700 border-slate-200 mt-2 flex justify-between items-center">
                           <button 
                             onClick={addSegment} 
                             className="flex items-center gap-1 text-xs md:text-sm text-brand-500 font-medium hover:text-brand-400 transition-colors"
                           >
                             <Plus size={16}/> 添加分镜
                           </button>

                           <button 
                             onClick={handlePreviewAndOptimize} 
                             className="flex items-center gap-1 text-xs md:text-sm text-green-600 dark:text-green-400 font-medium hover:text-green-500 transition-colors bg-green-500/10 px-3 py-1.5 rounded-full"
                           >
                             <Eye size={16}/> 预览并优化
                           </button>
                        </div>
                     </>
                  ) : (
                    // Preview Mode
                    <div className="animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-2">
                           <span className="text-xs font-medium text-slate-500">
                              全部分镜脚本 (可编辑)
                           </span>
                           <button 
                              onClick={() => setStoryboardView('edit')}
                              className="text-xs flex items-center gap-1 text-brand-500 hover:text-brand-400"
                           >
                              <Edit3 size={12}/> 返回修改
                           </button>
                        </div>
                        
                        <div className="relative group">
                            <textarea
                                value={previewPrompt}
                                onChange={(e) => setPreviewPrompt(e.target.value)}
                                className="w-full h-64 dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-200 rounded-lg p-3 text-xs md:text-sm dark:text-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none custom-scrollbar leading-relaxed"
                            />
                            
                            <div className="absolute bottom-3 right-3">
                                 <button
                                    onClick={handleOptimize}
                                    disabled={isOptimizing}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-full shadow-lg transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none"
                                  >
                                    {isOptimizing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                                    AI 优化
                                  </button>
                            </div>
                        </div>
                        <p className="text-xs md:text-sm text-slate-400 mt-2 text-center">
                           * 为确保生成质量，请仔细检查生成内容
                        </p>
                    </div>
                  )}
               </div>
            ) : (
              <div className="relative">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={mode === 'text' ? "请描述您想要的生成的视频内容" : "请描述图片中的动态效果(可选)"}
                  className={`w-full dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-200 rounded-xl p-3 md:p-4 text-xs md:text-sm dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:placeholder-slate-500 placeholder-slate-400 resize-none ${mode === 'image' ? 'h-24' : 'h-24'}`}
                />
                <div className="text-xs md:text-sm text-amber-500 mt-2 px-1">
                  如需生成角色一致人物，请在Sora2官网创建后，在提示词窗口输入：@角色名
                </div>
              </div>
            )}
            
            {/* Quick Character Insert */}
            {savedCharacters.length > 0 && (
               <div className="flex flex-wrap gap-2 animate-in fade-in duration-300">
                  <div className="text-xs text-slate-500 dark:text-slate-400 py-1">可用角色:</div>
                  {savedCharacters.map((char) => (
                      <button
                        key={char.id}
                        onClick={() => handleUseCharacter(char)}
                        className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-brand-100 dark:hover:bg-brand-900/30 border border-slate-200 dark:border-slate-700 hover:border-brand-300 dark:hover:border-brand-700 rounded-md text-xs transition-all text-slate-700 dark:text-slate-300"
                        title="点击添加到提示词"
                      >
                         <div className="w-4 h-4 rounded-full bg-slate-300 overflow-hidden">
                            {char.profile_picture_url ? (
                               <img src={char.profile_picture_url} className="w-full h-full object-cover" />
                            ) : <UserCircle className="w-full h-full" />}
                         </div>
                         <span>@{char.username}</span>
                         <Plus className="w-3 h-3 text-brand-500" />
                      </button>
                  ))}
               </div>
            )}
          </div>
        )}

        {/* Character Creation Inputs - ONLY for Character Model */}
        {model === VideoModel.SORA_2_CHARACTERS && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
             <label className="text-xs md:text-sm font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <UserCircle className="w-4 h-4" /> 
              角色源视频信息
            </label>
            <div className="space-y-4 dark:bg-slate-800/50 bg-slate-50 border dark:border-slate-700 border-slate-200 p-4 rounded-xl">
              
              <div className="space-y-2">
                 <label className="text-xs md:text-sm font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider">视频来源 <span className="text-red-500">*</span></label>
                 
                 <input
                    type="text"
                    value={characterUrl}
                    onChange={(e) => setCharacterUrl(e.target.value)}
                    placeholder="输入包含角色的视频 URL..."
                    className="w-full dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-200 rounded-lg py-2 px-4 text-xs md:text-sm dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:placeholder-slate-500 placeholder-slate-400"
                  />
              </div>

              <div className="space-y-2">
                  <div className="flex justify-between">
                     <label className="text-xs md:text-sm font-semibold dark:text-slate-400 text-slate-500">出现时间 (秒)</label>
                  </div>
                  <div className="relative flex items-center gap-3">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-slate-500 text-slate-400" />
                      
                      {/* Start Time Dropdown */}
                      <select
                        value={startTime}
                        onChange={(e) => setStartTime(parseInt(e.target.value))}
                        className="flex-1 dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-200 rounded-lg py-2 pl-10 pr-4 text-xs md:text-sm dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      >
                         {/* 0-7 seconds range */}
                         {Array.from({ length: 8 }, (_, i) => (
                           <option key={i} value={i}>{i}s</option>
                         ))}
                      </select>

                      <span className="text-slate-400">-</span>

                      {/* End Time Dropdown */}
                      <select
                        value={endTime}
                        onChange={(e) => setEndTime(parseInt(e.target.value))}
                        className="flex-1 dark:bg-slate-800 bg-white border dark:border-slate-700 border-slate-200 rounded-lg py-2 px-4 text-xs md:text-sm dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                      >
                         {[startTime + 1, startTime + 2, startTime + 3].map((t) => (
                           <option key={t} value={t}>{t}s</option>
                         ))}
                      </select>
                   </div>
                   <p className="text-xs text-amber-500 mt-1">
                     * 截取长度为1-3秒，开始时间范围 0-7s
                   </p>
              </div>
            </div>
            
            {/* Display Saved Characters in Creator Mode too for reference */}
            {savedCharacters.length > 0 && (
              <div className="mt-4">
                 <label className="text-xs font-medium dark:text-slate-400 text-slate-500 uppercase tracking-wider mb-2 block">已创建角色</label>
                 <div className="grid grid-cols-1 gap-2">
                    {savedCharacters.map((char) => (
                        <div key={char.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                           <div className="w-10 h-10 rounded-md bg-slate-200 overflow-hidden flex-shrink-0">
                               <img src={char.profile_picture_url} className="w-full h-full object-cover" alt={char.username}/>
                           </div>
                           <div className="flex-1 min-w-0">
                               <div className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">@{char.username}</div>
                           </div>
                           <button 
                             onClick={() => handleUseCharacter(char)}
                             className="text-xs text-brand-500 hover:underline flex-shrink-0"
                           >
                             使用
                           </button>
                        </div>
                    ))}
                 </div>
              </div>
            )}
          </div>
        )}

        {/* Parameters Grid - Hide for Character Creation */}
        {model !== VideoModel.SORA_2_CHARACTERS && (
          <div className="grid grid-cols-2 gap-4 md:gap-6">
            {/* Duration */}
            <div className="space-y-2">
              <label className="text-xs md:text-sm font-semibold dark:text-slate-400 text-slate-500">时长 (秒)</label>
              <div className="flex gap-2 dark:bg-slate-800 bg-slate-100 p-1 rounded-lg">
                {[10, 15, 25].map((d) => {
                  const isDisabled = 
                    (model === VideoModel.SORA_2 && d === 25) || 
                    (model === VideoModel.SORA_2_PRO && d === 10);
                  return (
                    <button
                      key={d}
                      onClick={() => setDuration(d as VideoDuration)}
                      disabled={isDisabled}
                      className={`flex-1 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-colors ${
                        duration === d
                          ? 'dark:bg-slate-700 bg-white dark:text-white text-slate-900 shadow-sm'
                          : 'dark:text-slate-500 text-slate-400 hover:dark:text-slate-300 hover:text-slate-600'
                      } ${isDisabled ? 'opacity-20 cursor-not-allowed' : ''}`}
                    >
                      {d}s
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Size */}
            <div className="space-y-2">
              <label className="text-xs md:text-sm font-semibold dark:text-slate-400 text-slate-500">画质</label>
              <div className="flex gap-2 dark:bg-slate-800 bg-slate-100 p-1 rounded-lg">
                {['small', 'large'].map((s) => {
                  const isDisabled = 
                    (model === VideoModel.SORA_2 && s === 'large') || 
                    (model === VideoModel.SORA_2_PRO && duration === 25 && s === 'large') ||
                    (model === VideoModel.SORA_2_PRO && duration === 15 && s === 'small');

                  return (
                    <button
                      key={s}
                      onClick={() => setSize(s as VideoSize)}
                      disabled={isDisabled}
                      className={`flex-1 py-1.5 md:py-2 rounded-md text-xs md:text-sm font-medium transition-colors capitalize ${
                        size === s
                          ? 'dark:bg-slate-700 bg-white dark:text-white text-slate-900 shadow-sm'
                          : 'dark:text-slate-500 text-slate-400 hover:dark:text-slate-300 hover:text-slate-600'
                      } ${isDisabled ? 'opacity-20 cursor-not-allowed' : ''}`}
                    >
                      {s === 'small' ? '标清' : '高清'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Orientation */}
            <div className="space-y-2">
              <label className="text-xs md:text-sm font-semibold dark:text-slate-400 text-slate-500">比例</label>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as VideoOrientation)}
                className="w-full dark:bg-slate-800 bg-white dark:text-white text-slate-900 text-xs md:text-sm rounded-lg p-2.5 border dark:border-slate-700 border-slate-200 focus:outline-none focus:border-brand-500"
              >
                <option value="portrait">竖屏 (9:16)</option>
                <option value="landscape">横屏 (16:9)</option>
              </select>
            </div>

            {/* Batch Count */}
            <div className="space-y-2">
              <label className="text-xs md:text-sm font-semibold dark:text-slate-400 text-slate-500">生成数量 (1-10)</label>
              <input 
                type="number"
                min="1"
                max="10"
                value={batchCount}
                onChange={(e) => setBatchCount(Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                className="hidden md:block w-full dark:bg-slate-800 bg-white dark:text-white text-slate-900 text-xs md:text-sm rounded-lg p-2.5 border dark:border-slate-700 border-slate-200 focus:outline-none focus:border-brand-500"
              />
              <div className="md:hidden w-full dark:bg-slate-800/50 bg-slate-100 text-slate-400 dark:text-slate-500 text-xs rounded-lg p-2.5 border dark:border-slate-700 border-slate-200 cursor-not-allowed">
                1 (手机端不可选)
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg flex items-center gap-2 text-red-400 text-xs md:text-sm animate-in fade-in duration-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Character Created Success State */}
        {createdCharacter && (
           <div className="p-4 bg-brand-500/10 border border-brand-500/30 rounded-xl animate-in fade-in slide-in-from-bottom-2">
              <h3 className="text-sm font-bold dark:text-white text-slate-900 mb-3 flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" /> 
                角色创建成功!
              </h3>
              
              <div className="flex gap-4">
                 <div className="w-16 h-16 rounded-lg bg-slate-200 dark:bg-slate-700 flex-shrink-0 overflow-hidden">
                    <img src={createdCharacter.profile_picture_url} alt="Character" className="w-full h-full object-cover" />
                 </div>
                 <div className="flex-1 space-y-2 min-w-0">
                    <div className="text-xs text-slate-500">角色名 (Username)</div>
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded p-1.5 border dark:border-slate-700 border-slate-200">
                       <code className="text-xs font-mono dark:text-brand-300 text-brand-600 flex-1 truncate">@{createdCharacter.username}</code>
                       <button onClick={handleCopyUsername} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors">
                          {isCopied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-slate-400" />}
                       </button>
                    </div>
                    
                    {createdCharacter.profile_desc && (
                      <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                        {createdCharacter.profile_desc}
                      </div>
                    )}
                    
                    <div className="flex gap-2 mt-2">
                      <a href={createdCharacter.permalink} target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1 text-slate-500 hover:text-brand-500 transition-colors">
                         <ExternalLink className="w-3 h-3" /> 查看主页
                      </a>
                      <button onClick={() => handleUseCharacter(createdCharacter)} className="text-xs text-brand-500 hover:text-brand-400 font-medium ml-auto">
                         使用此角色去生成 &rarr;
                      </button>
                    </div>
                 </div>
              </div>
           </div>
        )}

        {/* Action Button */}
        {(!createdCharacter || model !== VideoModel.SORA_2_CHARACTERS) && (
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full group relative overflow-hidden bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400 hover:from-brand-500 hover:to-brand-300 text-white font-bold py-3 md:py-4 rounded-xl transition-all shadow-lg shadow-brand-500/25 disabled:opacity-70 disabled:cursor-not-allowed mb-safe"
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" />
                  {model === VideoModel.SORA_2_CHARACTERS ? '创建中...' : '生成中...'}
                </>
              ) : (
                <>
                  <Video className="w-4 h-4 md:w-5 md:h-5" />
                  {model === VideoModel.SORA_2_CHARACTERS ? '立即创建角色' : '立即生成'} {batchCount > 1 && model !== VideoModel.SORA_2_CHARACTERS ? `(${batchCount})` : ''}
                </>
              )}
            </span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
          </button>
        )}
      </div>
    </div>
  );
};

export default CreatePanel;