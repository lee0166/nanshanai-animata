import { AnnotationData, Story, Character, Scene, Shot } from '../types';

export interface DatasetConverter {
  name: string;
  version: string;
  convert(rawData: any): Promise<AnnotationData>;
  canConvert(rawData: any): boolean;
}

export abstract class BaseConverter implements DatasetConverter {
  abstract name: string;
  abstract version: string;

  abstract convert(rawData: any): Promise<AnnotationData>;
  abstract canConvert(rawData: any): boolean;

  protected generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  protected createStory(
    title: string,
    synopsis: string,
    characters: Character[] = [],
    scenes: Scene[] = [],
    shots: Shot[] = []
  ): Story {
    return {
      id: this.generateId(),
      title,
      synopsis,
      characters,
      scenes,
      shots,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  protected createCharacter(
    name: string,
    type: Character['type'] = 'supporting',
    ageGroup: Character['ageGroup'] = 'young',
    gender: Character['gender'] = 'other',
    options: Partial<Omit<Character, 'id' | 'name' | 'type' | 'ageGroup' | 'gender'>> = {}
  ): Character {
    return {
      id: this.generateId(),
      name,
      type,
      ageGroup,
      gender,
      ...options,
    };
  }

  protected createScene(
    sceneNumber: string,
    name: string,
    location: string,
    time: Scene['time'] = 'morning',
    weather: Scene['weather'] = 'sunny',
    atmosphere: Scene['atmosphere'] = 'warm',
    options: Partial<
      Omit<Scene, 'id' | 'sceneNumber' | 'name' | 'location' | 'time' | 'weather' | 'atmosphere'>
    > = {}
  ): Scene {
    return {
      id: this.generateId(),
      sceneNumber,
      name,
      location,
      time,
      weather,
      atmosphere,
      ...options,
    };
  }

  protected createShot(
    shotNumber: string,
    shotType: Shot['shotType'] = 'medium',
    cameraAngle: Shot['cameraAngle'] = 'eyeLevel',
    cameraMovement: Shot['cameraMovement'] = 'static',
    duration: number = 4,
    options: Partial<
      Omit<Shot, 'id' | 'shotNumber' | 'shotType' | 'cameraAngle' | 'cameraMovement' | 'duration'>
    > = {}
  ): Shot {
    return {
      id: this.generateId(),
      shotNumber,
      shotType,
      cameraAngle,
      cameraMovement,
      duration,
      ...options,
    };
  }
}
