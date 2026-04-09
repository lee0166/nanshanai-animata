export interface ViStoryCharacter {
  id: string;
  name_en: string;
  name_cn: string;
  prompt_en: string;
  prompt_cn: string;
  tag: string;
  image_paths: string[];
}

export interface ViStoryShot {
  plot_correspondence_en: string;
  plot_correspondence_cn: string;
  setting_description_en: string;
  setting_description_cn: string;
  characters_appearing_en: string;
  characters_appearing_cn: string;
  static_shot_description_en: string;
  static_shot_description_cn: string;
  shot_perspective_design_en: string;
  shot_perspective_design_cn: string;
}

export interface ViStoryStory {
  story_id: string;
  story_type_en: string;
  story_type_cn: string;
  characters: ViStoryCharacter[];
  shots: ViStoryShot[];
}

export interface ConvertedShot {
  shotNumber: string;
  sceneDescription: string;
  shotType: string;
  cameraAngle: string;
  cameraMovement: string;
  duration: number;
  characters: string[];
  dialogue: string;
  musicSound: string;
  visualDescription: string;
  notes: string;
  qualityScore?: number;
}

export interface Character {
  id: string;
  name: string;
  nameEn?: string;
  type: 'protagonist' | 'supporting' | 'antagonist' | 'guest';
  ageGroup: 'child' | 'teen' | 'young' | 'middle' | 'elder' | 'adult';
  gender: 'male' | 'female' | 'other';
  personality?: string;
  appearance?: string;
  costume?: string;
  notes?: string;
}

export interface Scene {
  id: string;
  sceneNumber: string;
  name: string;
  location: string;
  time: 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'night' | 'midnight' | 'day';
  weather:
    | 'sunny'
    | 'cloudy'
    | 'overcast'
    | 'lightRain'
    | 'heavyRain'
    | 'snow'
    | 'fog'
    | 'windy'
    | 'foggy';
  atmosphere:
    | 'warm'
    | 'tense'
    | 'horror'
    | 'romantic'
    | 'comedy'
    | 'action'
    | 'mystery'
    | 'sad'
    | 'neutral';
  lighting?: string;
  props?: string;
  description?: string;
  notes?: string;
}

export interface Shot {
  id: string;
  shotNumber: string;
  sceneDescription?: string;
  shotType: 'extremeLong' | 'long' | 'full' | 'medium' | 'mediumClose' | 'close' | 'extremeClose';
  cameraAngle: 'eyeLevel' | 'low' | 'high' | 'bird' | 'dutch';
  cameraMovement: 'static' | 'push' | 'pull' | 'pan' | 'tilt' | 'track' | 'zoomIn' | 'zoomOut';
  duration: number;
  characters?: string;
  dialogue?: string;
  musicSound?: string;
  visualDescription?: string;
  notes?: string;
}

export interface Story {
  id: string;
  title: string;
  synopsis: string;
  characters: Character[];
  scenes: Scene[];
  shots: Shot[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AnnotationData {
  stories: Story[];
}

export interface ConvertedStory {
  id: string;
  title: string;
  storyType: string;
  novelText: string;
  shots: ConvertedShot[];
  totalDuration: number;
  source: string;
  metadata: {
    originalStoryId: string;
    characterCount: number;
    shotCount: number;
  };
}
