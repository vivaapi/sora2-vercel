export interface ApiSettings {
  baseUrl: string;
  apiKey: string;
}

export enum VideoModel {
  SORA_2 = 'sora-2',
  SORA_2_PRO = 'sora-2-pro',
  SORA_2_CHARACTERS = 'sora-2-characters',
}

export enum OptimizationModel {
  GPT_5 = 'gpt-5',
}

export type VideoSize = 'small' | 'large';
export type VideoOrientation = 'portrait' | 'landscape';
export type VideoDuration = 10 | 15 | 25;

export interface VideoTask {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  prompt: string;
  model: VideoModel;
  orientation?: VideoOrientation;
  createdAt: number;
  completedAt?: number;
  videoUrl?: string;
  thumbnailUrl?: string;
  progress?: number;
  failureReason?: string;
}

export interface CreateVideoRequest {
  model: string;
  prompt: string;
  images: string[];
  orientation: VideoOrientation;
  duration: VideoDuration;
  size: VideoSize;
  character_url?: string;
  character_timestamps?: string;
}

export interface CreateVideoResponse {
  id: string;
  object?: string;
  model?: string;
  status: string;
  progress?: number;
  created_at?: number;
  seconds?: string;
  size?: string;
}

export interface QueryVideoResponse {
  id: string;
  status: string;
  video_url?: string | null;
  status_update_time?: number;
  detail?: {
    status: string;
    failure_reason?: string;
    progress_pct?: number;
    video_url?: string;
    thumbnail_url?: string;
  };
}

export interface CreateCharacterRequest {
  url: string;
  timestamps: string;
}

export interface CreateCharacterResponse {
  id: string;
  username: string;
  permalink: string;
  profile_picture_url: string;
  profile_desc?: string;
}

// Helper to pass state between components
export interface CreatePanelState extends Partial<VideoTask> {
  characterUrl?: string;
  autoGenerate?: boolean;
}