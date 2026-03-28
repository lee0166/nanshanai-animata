export const DefaultStylePrompt = {
  movie: {
    nameEN: 'movie',
    nameCN: '电影质感',
    image: '/styles/movie.png',
    prompt: 'cinematic lighting, movie still, shot on 35mm, realistic, 8k, masterpiece',
  },
  photorealistic: {
    nameEN: 'photorealistic',
    nameCN: '高清实拍',
    image: '/styles/photorealistic.png',
    prompt: 'photorealistic, raw photo, DSLR, sharp focus, high fidelity, 4k texture',
  },
  gothic: {
    nameEN: 'gothic',
    nameCN: '暗黑哥特',
    image: '/styles/gothic.png',
    prompt: 'gothic style, dark atmosphere, gloomy, fog, horror theme, muted colors',
  },
  cyberpunk: {
    nameEN: 'cyberpunk',
    nameCN: '赛博朋克',
    image: '/styles/cyberpunk.png',
    prompt: 'cyberpunk, neon lights, futuristic, rainy street, blue and purple hue',
  },
  anime: {
    nameEN: 'anime',
    nameCN: '日漫风格',
    image: '/styles/anime.png',
    prompt: 'anime style, 2D animation, cel shading, vibrant colors, clean lines',
  },
  shinkai: {
    nameEN: 'shinkai',
    nameCN: '新海诚风',
    image: '/styles/shinkai.png',
    prompt: 'Makoto Shinkai style, beautiful sky, lens flare, detailed background, emotional',
  },
  game: {
    nameEN: 'game',
    nameCN: '游戏原画',
    image: '/styles/game.png',
    prompt: 'game cg, splash art, highly detailed, epic composition, fantasy style',
  },
};

/**
 * 获取默认样式提示词
 * @param style 样式名称
 * @returns
 */
export const getDefaultStylePrompt = (style: string = '') => {
  return style ? DefaultStylePrompt[style]?.prompt || '' : '';
};

/**
 * 角色图提示词
 * @param userPrompt 用户输入的描述
 * @param age 年龄段
 * @param gender 性别
 * @returns
 */
export const getRoleImagePrompt = (userPrompt: string, age: string, gender: string) => {
  let details = '';
  if (age && age !== 'unknown' && age !== '不详' && age !== 'unknown') {
    details += `角色年龄段: ${age}\n    `;
  }
  if (gender && gender !== 'unlimited' && gender !== '不限' && gender !== 'unlimited') {
    details += `性别: ${gender}\n    `;
  }

  return `
    生成一张高质量的人物角色设定图。
    ${details}角色特征: ${userPrompt} 
    画面要求：
    画面风格清晰、锐利，光照均匀，展现出专业的概念设计图效果。
    `;
};

/**
 * 物品图提示词
 * @param userPrompt 用户输入的描述
 * @param itemType 物品类型
 * @returns
 */
export const getItemImagePrompt = (userPrompt: string, itemType: string) => {
  return `
    生成一张高质量的物品设定图，在纯白色的背景上展示。
    物品类型: ${itemType}
    物品特征: ${userPrompt}
    画面要求：
    画面风格清晰、锐利，光照均匀，无阴影干扰，展现出专业的概念设计图效果。
    `;
};

/**
 * 场景图提示词
 * @param userPrompt 用户输入的描述
 * @returns
 */
export const getSceneImagePrompt = (userPrompt: string) => {
  return `
    生成一张高质量的场景设定图。
    场景描述：${userPrompt}
    `;
};

/**
 * 从完整appearance中提取面部专属信息
 * @param scriptDescription JSON字符串格式的appearance
 * @returns 面部专属描述
 */
export const extractFaceDescription = (scriptDescription?: string): string => {
  if (!scriptDescription) return '';

  try {
    const appearance = JSON.parse(scriptDescription);
    const faceParts: string[] = [];

    if (appearance.face) faceParts.push(appearance.face);
    if (appearance.hair) faceParts.push(appearance.hair);

    return faceParts.join('，');
  } catch (e) {
    return '';
  }
};

/**
 * 从完整appearance中提取全身设定图所需信息
 * @param scriptDescription JSON字符串格式的appearance
 * @returns 全身描述（身高、体型、面部、发型、服装）
 */
export const extractFullBodyDescription = (scriptDescription?: string): string => {
  if (!scriptDescription) return '';

  try {
    const appearance = JSON.parse(scriptDescription);
    const bodyParts: string[] = [];

    if (appearance.height) bodyParts.push(appearance.height);
    if (appearance.build) bodyParts.push(appearance.build);
    if (appearance.face) bodyParts.push(appearance.face);
    if (appearance.hair) bodyParts.push(appearance.hair);
    if (appearance.clothing) bodyParts.push(appearance.clothing);

    return bodyParts.join('，');
  } catch (e) {
    return '';
  }
};

/**
 * 阶段1：面部特写图提示词
 * @param userPrompt 用户输入的描述
 * @param age 年龄段
 * @param gender 性别
 * @param scriptDescription 可选的完整appearance JSON
 * @returns
 */
export const getFacePortraitPrompt = (
  userPrompt: string,
  age: string,
  gender: string,
  scriptDescription?: string
) => {
  let details = '';
  if (age && age !== 'unknown' && age !== '不详' && age !== 'unknown') {
    details += `角色年龄段: ${age}\n    `;
  }
  if (gender && gender !== 'unlimited' && gender !== '不限' && gender !== 'unlimited') {
    details += `性别: ${gender}\n    `;
  }

  const faceDescription = extractFaceDescription(scriptDescription);
  const finalPrompt = faceDescription || userPrompt;

  return `
    生成一张高质量的人物面部特写头像。
    ${details}角色特征: ${finalPrompt} 
    画面要求：
    头像特写，focus on face, detailed facial features, clear portrait, professional character design.
    画面风格清晰、锐利，光照均匀。
    `;
};

/**
 * 阶段2：全身设定图提示词（基于面部图）
 * @param userPrompt 用户输入的描述
 * @param age 年龄段
 * @param gender 性别
 * @returns
 */
export const getFullBodyPrompt = (userPrompt: string, age: string, gender: string) => {
  let details = '';
  if (age && age !== 'unknown' && age !== '不详' && age !== 'unknown') {
    details += `角色年龄段: ${age}\n    `;
  }
  if (gender && gender !== 'unlimited' && gender !== '不限' && gender !== 'unlimited') {
    details += `性别: ${gender}\n    `;
  }

  return `
    生成一张高质量的人物全身设定图。
    ${details}角色特征: ${userPrompt} 
    画面要求：
    full body shot, standing pose, character design sheet, professional concept art.
    画面风格清晰、锐利，光照均匀。
    `;
};
