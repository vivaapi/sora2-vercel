import React, { useState, useEffect } from 'react';
import { ApiSettings } from '../types';
import { X, Settings, Key, Globe } from 'lucide-react';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ApiSettings;
  onSave: (settings: ApiSettings) => void;
}

const SettingsDialog: React.FC<SettingsDialogProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [localSettings, setLocalSettings] = useState<ApiSettings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="dark:bg-slate-900 bg-white border dark:border-slate-700 border-slate-200 w-full max-w-md rounded-2xl p-6 shadow-2xl transition-colors">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold dark:text-white text-slate-800 flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-500" />
            系统设置
          </h2>
          <button onClick={onClose} className="dark:text-slate-400 text-slate-500 hover:dark:text-white hover:text-slate-900 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="block text-sm font-medium dark:text-slate-300 text-slate-700">
              API 地址 (Base URL)
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-slate-500 text-slate-400" />
              <input
                type="text"
                value={localSettings.baseUrl}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, baseUrl: e.target.value }))}
                className="w-full dark:bg-slate-800 bg-slate-50 border dark:border-slate-700 border-slate-300 rounded-lg py-2.5 pl-10 pr-4 dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:placeholder-slate-500 placeholder-slate-400"
                placeholder="https://www.vivaapi.cn"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium dark:text-slate-300 text-slate-700">
              API 令牌 (Token)
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 dark:text-slate-500 text-slate-400" />
              <input
                type="password"
                value={localSettings.apiKey}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                className="w-full dark:bg-slate-800 bg-slate-50 border dark:border-slate-700 border-slate-300 rounded-lg py-2.5 pl-10 pr-4 dark:text-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:placeholder-slate-500 placeholder-slate-400"
                placeholder="sk-..."
              />
            </div>
            <div className="text-sm font-medium dark:text-slate-500 text-slate-500 flex flex-col gap-1 mt-1">
               <div className="flex flex-wrap items-center gap-2">
                   <a 
                     href={localSettings.baseUrl || "https://www.vivaapi.cn"} 
                     target="_blank" 
                     rel="noreferrer" 
                     className="text-brand-500 hover:text-brand-600 hover:underline cursor-pointer flex items-center gap-1"
                   >
                     点击获取API令牌
                   </a>
                   <span className="text-amber-500 text-xs">请创建分组为“限时特价→default→逆向“的API令牌</span>
               </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <button
            onClick={handleSave}
            className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-brand-500/20"
          >
            保存配置
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsDialog;