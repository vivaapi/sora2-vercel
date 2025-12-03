import React, { useEffect, useState } from 'react';
import { VideoTask, ApiSettings } from '../types';
import { queryVideoTask } from '../services/apiService';
import { CheckCircle2, XCircle, Play, RefreshCw, UserPlus, Clock, Trash2, CheckSquare, Square, Maximize2 } from 'lucide-react';

interface GalleryPanelProps {
  tasks: VideoTask[];
  settings: ApiSettings;
  onUpdateTask: (task: VideoTask) => void;
  onRegenerate: (task: VideoTask) => void;
  onCreateCharacter: (task: VideoTask) => void;
  onDeleteTasks: (taskIds: string[]) => void;
}

const GalleryPanel: React.FC<GalleryPanelProps> = ({ tasks, settings, onUpdateTask, onRegenerate, onCreateCharacter, onDeleteTasks }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [previewTask, setPreviewTask] = useState<VideoTask | null>(null);

  // Polling Effect
  useEffect(() => {
    const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'processing');
    
    if (pendingTasks.length === 0) return;

    const intervalId = setInterval(async () => {
      for (const task of pendingTasks) {
        try {
          const res = await queryVideoTask(task.id, settings);
          
          let updatedStatus = task.status;
          
          // Check top-level status or nested detail status
          const resStatus = res.status || res.detail?.status;
          const resFailureReason = res.detail?.failure_reason;
          const resProgress = res.detail?.progress_pct;
          const resVideoUrl = res.video_url || res.detail?.video_url;
          const resThumbnailUrl = res.detail?.thumbnail_url;
          
          if (resStatus === 'completed') {
            updatedStatus = 'completed';
          } else if (resStatus === 'failed') {
            updatedStatus = 'failed';
          } else if (resStatus === 'processing') {
            updatedStatus = 'processing';
          }

          if (
            updatedStatus !== task.status || 
            resVideoUrl !== task.videoUrl || 
            resProgress !== task.progress
          ) {
            onUpdateTask({
              ...task,
              status: updatedStatus,
              videoUrl: resVideoUrl || undefined,
              thumbnailUrl: resThumbnailUrl || undefined,
              progress: resProgress,
              failureReason: resFailureReason,
              completedAt: (updatedStatus === 'completed' || updatedStatus === 'failed') && !task.completedAt
                ? (res.status_update_time || Date.now()) 
                : task.completedAt
            });
          }
        } catch (e) {
          console.error(`Failed to poll task ${task.id}`, e);
        }
      }
    }, 4000);

    return () => clearInterval(intervalId);
  }, [tasks, settings, onUpdateTask]);

  const handleToggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
    if (newSelected.size > 0 && !isSelectionMode) {
      setIsSelectionMode(true);
    } else if (newSelected.size === 0) {
      setIsSelectionMode(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === tasks.length) {
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    } else {
      setSelectedIds(new Set(tasks.map(t => t.id)));
      setIsSelectionMode(true);
    }
  };

  const handleDeleteSelected = () => {
    onDeleteTasks(Array.from(selectedIds));
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const handleDeleteSingle = (id: string) => {
    onDeleteTasks([id]);
    if (selectedIds.has(id)) {
      const newSelected = new Set(selectedIds);
      newSelected.delete(id);
      setSelectedIds(newSelected);
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center dark:text-slate-500 text-slate-400 p-8 text-center">
        <div className="w-16 h-16 md:w-20 md:h-20 dark:bg-slate-800 bg-slate-200 rounded-full flex items-center justify-center mb-4">
          <Play className="w-6 h-6 md:w-8 md:h-8 opacity-50" />
        </div>
        <h3 className="text-lg md:text-xl font-medium dark:text-slate-300 text-slate-600 mb-2">暂无作品</h3>
        <p className="max-w-xs text-xs md:text-sm dark:text-slate-300 text-slate-600">请在{window.innerWidth < 768 ? '创作' : '左侧'}面板创建您的第一个视频。</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* Lightbox Overlay */}
      {previewTask && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPreviewTask(null)}
        >
          <button 
            className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors p-2 z-[101]"
            onClick={() => setPreviewTask(null)}
          >
            <XCircle className="w-8 h-8 md:w-10 md:h-10" />
          </button>
          
          <div 
            className="w-full h-full p-4 md:p-10 flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
             {previewTask.videoUrl ? (
               <video 
                 src={previewTask.videoUrl} 
                 poster={previewTask.thumbnailUrl}
                 controls 
                 autoPlay
                 className="max-w-full max-h-full object-contain shadow-2xl rounded-lg outline-none"
               />
             ) : (
               <div className="text-white">视频链接无效</div>
             )}
          </div>
        </div>
      )}

      {/* Selection Toolbar */}
      {tasks.length > 0 && (
         <div className="px-4 md:px-6 py-3 md:py-4 flex items-center justify-between shrink-0">
            <h2 className="text-lg md:text-xl font-bold dark:text-white text-slate-800 flex items-center gap-2 md:gap-3">
              作品库 ({tasks.length})
              {selectedIds.size > 0 && (
                <span className="text-xs md:text-sm font-normal text-brand-500 bg-brand-500/10 px-2 py-0.5 rounded-full">
                  已选 {selectedIds.size}
                </span>
              )}
            </h2>

            <div className="flex items-center gap-2 md:gap-3">
               <button 
                  onClick={handleSelectAll}
                  className="flex items-center justify-center px-3 py-1.5 md:px-4 md:py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs md:text-sm font-bold rounded-full transition-all shadow-md shadow-brand-500/20"
               >
                 {selectedIds.size === tasks.length ? '取消' : '全选'}
               </button>
               
               {selectedIds.size > 0 && (
                 <button 
                    onClick={handleDeleteSelected}
                    className="flex items-center gap-1.5 px-2 md:px-3 py-1 md:py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-[10px] md:text-xs font-semibold transition-colors"
                 >
                    <Trash2 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                    删除
                 </button>
               )}
            </div>
         </div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 pt-0 pb-24 md:pb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
          {tasks.map((task) => (
            <VideoCard 
              key={task.id} 
              task={task} 
              isSelected={selectedIds.has(task.id)}
              onToggleSelect={() => handleToggleSelect(task.id)}
              onRegenerate={() => onRegenerate(task)}
              onCreateCharacter={() => onCreateCharacter(task)}
              onDelete={() => handleDeleteSingle(task.id)}
              onPreview={() => setPreviewTask(task)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

interface VideoCardProps {
  task: VideoTask;
  isSelected: boolean;
  onToggleSelect: () => void;
  onRegenerate: () => void;
  onCreateCharacter: () => void;
  onDelete: () => void;
  onPreview: () => void;
}

const VideoCard: React.FC<VideoCardProps> = ({ task, isSelected, onToggleSelect, onRegenerate, onCreateCharacter, onDelete, onPreview }) => {
  const generationDuration = task.completedAt && task.createdAt 
    ? Math.max(0, Math.floor((task.completedAt - task.createdAt) / 1000)) 
    : null;

  // Determine aspect ratio class based on orientation
  const isLandscape = task.orientation === 'landscape';
  const aspectRatioClass = isLandscape ? 'aspect-video' : 'aspect-[9/16]';

  return (
    <div className={`relative dark:bg-slate-800 bg-white rounded-xl overflow-hidden border shadow-xl flex flex-col transition-all w-full group/card ${
        isSelected 
        ? 'border-brand-500 ring-1 ring-brand-500' 
        : 'dark:border-slate-700 border-slate-200 hover:border-brand-500/50'
    } ${isLandscape ? 'col-span-1 md:col-span-2 xl:col-span-1' : ''}`}>
      
      {/* Selection Checkbox - Keep on top level */}
      <button 
        onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
        className={`absolute top-3 left-3 z-30 w-6 h-6 rounded-md flex items-center justify-center transition-all ${
           isSelected 
           ? 'bg-brand-500 text-white shadow-lg' 
           : 'bg-black/30 text-white/50 backdrop-blur-sm opacity-100 md:opacity-0 md:group-hover/card:opacity-100 hover:bg-black/50'
        }`}
      >
         {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
      </button>

      <div className={`relative ${aspectRatioClass} dark:bg-slate-900 bg-slate-100 group overflow-hidden`} onClick={onPreview}>
        {/* Buttons Overlay on Video Area */}
        <div className="absolute top-3 right-3 z-30 flex gap-2">
           {task.status === 'completed' && (
            <button 
              onClick={(e) => { e.stopPropagation(); onPreview(); }}
              className="w-7 h-7 rounded-md bg-black/40 hover:bg-brand-500 text-white backdrop-blur-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 hidden md:flex items-center justify-center transition-all shadow-lg"
              title="放大预览"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
           )}
           <button 
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-7 h-7 rounded-md bg-black/40 hover:bg-red-500 text-white backdrop-blur-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 flex items-center justify-center transition-all shadow-lg"
            title="删除"
          >
             <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {task.status === 'completed' && task.videoUrl ? (
          <video 
            src={task.videoUrl} 
            poster={task.thumbnailUrl}
            controls 
            className="w-full h-full object-cover"
            loop
            playsInline
            preload="metadata"
            style={{ transform: 'translateZ(0)', backfaceVisibility: 'hidden' }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
            {task.status === 'failed' ? (
              <XCircle className="w-10 h-10 text-red-500 mb-2" />
            ) : (
              <>
                <div className="relative w-12 h-12 mb-3">
                   <div className="absolute inset-0 rounded-full border-4 dark:border-slate-700 border-slate-200"></div>
                   <div className="absolute inset-0 rounded-full border-4 border-brand-500 border-t-transparent animate-spin"></div>
                </div>
                <div className="text-sm font-medium text-brand-500 animate-pulse">
                  {task.status === 'processing' ? `生成中 ${(task.progress || 0).toFixed(0)}%` : '视频生成中...'}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="p-3 md:p-4 flex flex-col flex-1">
        <div className="flex justify-between items-center mb-3">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide border ${
            task.status === 'completed' ? 'bg-green-500/10 text-green-500 border-green-500/30' :
            task.status === 'failed' ? 'bg-red-500/10 text-red-500 border-red-500/30' :
            'bg-brand-500/10 text-brand-500 border-brand-500/30'
          }`}>
            {task.model}
          </span>
          
          {generationDuration !== null && (
             <span className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-1 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded">
                <Clock className="w-3 h-3" />
                耗时 {generationDuration}秒
             </span>
          )}
        </div>
        
        {task.status === 'failed' && (
           <p className="text-xs text-red-400 mb-3 flex-1">错误: {task.failureReason || '未知错误'}</p>
        )}
        
        {task.status !== 'failed' && <div className="flex-1"></div>}

        {task.status === 'completed' && task.videoUrl && (
          <div className="flex gap-2 mt-3">
            <button 
              onClick={(e) => { e.stopPropagation(); onRegenerate(); }}
              className="flex-1 py-1.5 md:py-2 px-3 dark:bg-slate-700 bg-slate-100 hover:dark:bg-slate-600 hover:bg-slate-200 dark:text-white text-slate-800 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3 h-3" />
              重新生成
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onCreateCharacter(); }}
              className="flex-1 py-1.5 md:py-2 px-3 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/20 text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <UserPlus className="w-3 h-3" />
              创建角色
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GalleryPanel;