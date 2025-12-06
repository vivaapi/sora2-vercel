import React, { useState, useEffect } from 'react';
import { ApiSettings, VideoTask, VideoModel, VideoOrientation, CreatePanelState, CreateCharacterResponse } from './types';
import SettingsDialog from './components/SettingsDialog';
import CreatePanel from './components/CreatePanel';
import GalleryPanel from './components/GalleryPanel';
import { Settings2, Bot, Sun, Moon, FileText, Sparkles, PlaySquare } from 'lucide-react';

const App: React.FC = () => {
  // Persistence: Settings
  const [settings, setSettings] = useState<ApiSettings>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('viva_settings');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Error parsing saved settings:', e);
        }
      }
    }
    return {
      baseUrl: 'https://www.vivaapi.cn',
      apiKey: '',
    };
  });
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Persistence: Tasks
  const [tasks, setTasks] = useState<VideoTask[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('viva_tasks');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Error parsing saved tasks:', e);
        }
      }
    }
    return [];
  });
  
  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  
  // Mobile Tab State
  const [activeMobileTab, setActiveMobileTab] = useState<'create' | 'gallery'>('create');
  
  // State to pre-fill CreatePanel (Regenerate or Create Character flow)
  const [createPanelState, setCreatePanelState] = useState<CreatePanelState | undefined>(undefined);
  
  // Persistence: Saved Characters
  const [savedCharacters, setSavedCharacters] = useState<CreateCharacterResponse[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('viva_characters');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Error parsing saved characters:', e);
        }
      }
    }
    return [];
  });

  // Apply theme class to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Save Settings to LocalStorage
  useEffect(() => {
    localStorage.setItem('viva_settings', JSON.stringify(settings));
  }, [settings]);

  // Save Tasks to LocalStorage
  useEffect(() => {
    localStorage.setItem('viva_tasks', JSON.stringify(tasks));
  }, [tasks]);

  // Save Characters to LocalStorage
  useEffect(() => {
    localStorage.setItem('viva_characters', JSON.stringify(savedCharacters));
  }, [savedCharacters]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleTasksCreated = (newIds: string[], prompt: string, model: VideoModel, orientation: VideoOrientation) => {
    const newTasks: VideoTask[] = newIds.map(id => ({
      id,
      status: 'pending',
      prompt,
      model,
      orientation,
      createdAt: Date.now()
    }));
    setTasks(prev => [...newTasks, ...prev]);
    setCreatePanelState(undefined);
    // Switch to gallery view on mobile after creation
    if (window.innerWidth < 768) {
      setActiveMobileTab('gallery');
    }
  };

  const handleUpdateTask = (updatedTask: VideoTask) => {
    setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
  };

  const handleRegenerate = (task: VideoTask) => {
    setCreatePanelState({
      prompt: task.prompt,
      model: task.model,
      // Reset character url if regenerating a normal video
      characterUrl: '',
      autoGenerate: true // Trigger auto generation
    });
    // Switch to create view on mobile
    setActiveMobileTab('create');
  };

  const handleCreateCharacter = (task: VideoTask) => {
    setCreatePanelState({
      characterUrl: task.videoUrl || '',
      // Automatically switch to Character model
      model: VideoModel.SORA_2_CHARACTERS,
      autoGenerate: false
    });
    setActiveMobileTab('create');
  };

  const handleDeleteTasks = (ids: string[]) => {
    setTasks(prev => prev.filter(t => !ids.includes(t.id)));
  };
  
  const handleSaveCharacter = (char: CreateCharacterResponse) => {
     setSavedCharacters(prev => {
         // Avoid duplicates if any
         if (prev.some(c => c.id === char.id)) return prev;
         return [char, ...prev];
     });
  };

  return (
    <div className={`flex flex-col md:flex-row h-screen font-sans selection:bg-brand-500/30 transition-colors duration-300 overflow-hidden ${
      theme === 'dark' ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-800'
    }`}>
      
      {/* Sidebar Area (Left - Create Panel) */}
      <div className={`
        w-full md:w-[420px] lg:w-[480px] xl:w-[500px] 
        flex-shrink-0 border-r backdrop-blur flex-col transition-colors duration-300
        ${theme === 'dark' ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white/50'}
        ${activeMobileTab === 'create' ? 'flex h-full' : 'hidden md:flex h-full'}
      `}>
        <div className={`p-4 md:p-6 border-b flex justify-between items-start transition-colors duration-300 flex-shrink-0 ${
          theme === 'dark' ? 'border-slate-800' : 'border-slate-200'
        }`}>
          <div className="flex flex-col gap-0.5">
             <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-600 to-indigo-700 flex items-center justify-center font-bold text-white shadow-lg shadow-brand-500/20">
                  <Bot className="w-5 h-5" />
                </div>
                <span className={`font-bold text-lg md:text-xl tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>ViVa AI视频生成平台</span>
             </div>
             <span className="text-[10px] md:text-xs text-brand-500 font-medium tracking-wide ml-10">用AI创造无限可能</span>
          </div>
          <div className="flex gap-1 md:gap-2">
            <a
              href="https://ai.feishu.cn/wiki/Xy1Zwf23YifxDHkXQ9xcTfQCn6g?from=from_copylink"
              target="_blank"
              rel="noopener noreferrer"
              className={`p-2 rounded-lg transition-colors flex items-center justify-center ${
                theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="文档"
            >
              <FileText className="w-5 h-5" />
            </a>
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-colors ${
                theme === 'dark' ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-lg transition-colors text-red-500 hover:text-red-600"
            >
              <Settings2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        <CreatePanel 
          settings={settings} 
          onTasksCreated={handleTasksCreated} 
          onOpenSettings={() => setIsSettingsOpen(true)}
          initialState={createPanelState}
          savedCharacters={savedCharacters}
          onSaveCharacter={handleSaveCharacter}
        />
      </div>

      {/* Main Content Area (Right - Gallery Panel) */}
      <div className={`
        flex-1 flex-col overflow-hidden bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-opacity-20
        ${theme === 'dark' ? '' : 'bg-slate-100'}
        ${activeMobileTab === 'gallery' ? 'flex h-full' : 'hidden md:flex h-full'}
      `}>
         {/* Top Bar */}
         <div className={`h-14 md:h-16 border-b flex items-center px-4 md:px-6 justify-between transition-colors duration-300 flex-shrink-0 ${
           theme === 'dark' ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white/50'
         }`}>
            <div className={`text-xs md:text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'} flex items-center gap-2 truncate pr-2`}>
               <span className="truncate">温馨提示：本应用仅供娱乐，请勿生成违法内容</span>
            </div>
            {!settings.apiKey && (
              <div className="flex-shrink-0 text-[10px] md:text-xs text-amber-500 bg-amber-500/10 px-2 md:px-3 py-1 rounded-full flex items-center gap-2 border border-amber-500/20">
                 <span className="hidden sm:inline">未配置 API 令牌</span>
                 <span className="sm:hidden">未配置Token</span>
                 <button onClick={() => setIsSettingsOpen(true)} className="underline hover:text-amber-600">去配置</button>
              </div>
            )}
         </div>

         <GalleryPanel 
           tasks={tasks}
           settings={settings}
           onUpdateTask={handleUpdateTask}
           onRegenerate={handleRegenerate}
           onCreateCharacter={handleCreateCharacter}
           onDeleteTasks={handleDeleteTasks}
         />
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/90 dark:bg-slate-950/90 backdrop-blur-lg border-t dark:border-slate-800 border-slate-200 z-50 flex items-center justify-around pb-safe safe-area-bottom">
        <button 
          onClick={() => setActiveMobileTab('create')}
          className={`flex flex-col items-center justify-center gap-1 w-full h-full ${
             activeMobileTab === 'create' ? 'text-brand-500' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <Sparkles className={`w-6 h-6 ${activeMobileTab === 'create' ? 'fill-current' : ''}`} />
          <span className="text-[10px] font-medium">创作</span>
        </button>
        <div className="w-px h-8 bg-slate-200 dark:bg-slate-800"></div>
        <button 
          onClick={() => setActiveMobileTab('gallery')}
          className={`relative flex flex-col items-center justify-center gap-1 w-full h-full ${
             activeMobileTab === 'gallery' ? 'text-brand-500' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <PlaySquare className={`w-6 h-6 ${activeMobileTab === 'gallery' ? 'fill-current' : ''}`} />
          <span className="text-[10px] font-medium">作品库</span>
          {tasks.some(t => t.status === 'processing' || t.status === 'pending') && (
            <span className="absolute top-3 right-12 w-2 h-2 bg-brand-500 rounded-full animate-pulse" />
          )}
        </button>
      </div>

      <SettingsDialog 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={settings} 
        onSave={setSettings} 
      />
    </div>
  );
};

export default App;