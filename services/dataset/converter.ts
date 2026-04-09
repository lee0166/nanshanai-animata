export function convertStory(viStoryStory) {
  const shots = [];
  let totalDuration = 0;
  const viShots = viStoryStory.shots || [];

  viShots.forEach(function (viShot, i) {
    const duration = 4;
    totalDuration += duration;

    const shot = {
      shotNumber: String(i + 1).padStart(2, '0'),
      sceneDescription: viShot.setting_description_cn || viShot.setting_description_en || '',
      shotType: '中景',
      cameraAngle: '平视',
      cameraMovement: '固定',
      duration: duration,
      characters: [],
      dialogue: '',
      musicSound: '',
      visualDescription:
        viShot.static_shot_description_cn || viShot.static_shot_description_en || '',
      notes: viShot.shot_perspective_design_cn || viShot.shot_perspective_design_en || '',
      qualityScore: 85,
    };

    shots.push(shot);
  });

  return {
    id: 'vistorybench-' + viStoryStory.story_id,
    title: 'ViStoryBench-' + viStoryStory.story_id,
    storyType: viStoryStory.story_type_cn || viStoryStory.story_type_en || '',
    novelText: '',
    shots: shots,
    totalDuration: totalDuration,
    source: 'ViStoryBench',
    metadata: {
      originalStoryId: viStoryStory.story_id,
      characterCount: (viStoryStory.characters || []).length,
      shotCount: viShots.length,
    },
  };
}
