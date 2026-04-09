export const DefaultStylePrompt = {
  movie: {
    nameEN: 'movie',
    nameCN: '电影质感',
    image: '/styles/movie.png',
    prompt: 'cinematic lighting, movie still, shot on 35mm, realistic, 8k, masterpiece, 电影质感，电影镜头，35mm胶片拍摄，真实感，8k分辨率，杰作',
  },
  photorealistic: {
    nameEN: 'photorealistic',
    nameCN: '高清实拍',
    image: '/styles/photorealistic.png',
    prompt: 'photorealistic, raw photo, DSLR, sharp focus, high fidelity, 4k texture, 高清实拍，原始照片，单反相机，锐利对焦，高保真，4k纹理',
  },
  gothic: {
    nameEN: 'gothic',
    nameCN: '暗黑哥特',
    image: '/styles/gothic.png',
    prompt: 'gothic style, dark atmosphere, gloomy, fog, horror theme, muted colors, 哥特风格，暗黑氛围，阴郁，雾气，恐怖主题， muted色调',
  },
  cyberpunk: {
    nameEN: 'cyberpunk',
    nameCN: '赛博朋克',
    image: '/styles/cyberpunk.png',
    prompt: 'cyberpunk, neon lights, futuristic, rainy street, blue and purple hue, 赛博朋克，霓虹灯，未来主义，雨夜街道，蓝紫色调',
  },
  anime: {
    nameEN: 'anime',
    nameCN: '日漫风格',
    image: '/styles/anime.png',
    prompt: 'anime style, 2D animation, cel shading, vibrant colors, clean lines, 日漫风格，2D动画，赛璐璐上色，鲜艳色彩，清晰线条',
  },
  shinkai: {
    nameEN: 'shinkai',
    nameCN: '新海诚风',
    image: '/styles/shinkai.png',
    prompt: 'Makoto Shinkai style, beautiful sky, lens flare, detailed background, emotional, 新海诚风格，美丽天空，镜头光晕，精细背景，情感丰富',
  },
  game: {
    nameEN: 'game',
    nameCN: '游戏原画',
    image: '/styles/game.png',
    prompt: 'game cg, splash art, highly detailed, epic composition, fantasy style, 游戏CG，宣传图，高度精细，史诗构图，幻想风格',
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
 * 根据宽高比获取构图提示词
 * @param aspectRatio 宽高比
 * @param language 语言
 * @returns 构图提示词
 */
const getCompositionPrompt = (aspectRatio: string, language: 'en' | 'zh' = 'zh') => {
  const [w, h] = aspectRatio.split(':').map(Number);
  const ratio = w / h;

  if (language === 'en') {
    if (ratio < 0.8) {
      return `
        head and shoulders portrait,
        front view, facing camera directly,
        rule of thirds composition,
        eyes positioned along upper third line,
        adequate headroom and space around face,
        face centered with 15-20% margin on all sides,
        ears fully visible,
        natural facial proportions
      `;
    } else if (ratio > 1.2) {
      return `
        bust portrait,
        front view, facing camera directly,
        rule of thirds composition,
        eyes positioned along upper third line,
        adequate space around face,
        natural facial proportions
      `;
    } else {
      return `
        close-up portrait,
        front view, facing camera directly,
        centered composition,
        face occupies 60-70% of frame,
        adequate margin around face,
        ears visible,
        natural proportions
      `;
    }
  } else {
    if (ratio < 0.8) {
      return `
        头像肩像，
        正面视角，面向镜头，
        三分法构图，
        眼睛位于上三分线位置，
        面部周围留有足够的边距，
        面部居中，四周保留15-20%的边距，
        耳朵完全可见，
        自然的面部比例
      `;
    } else if (ratio > 1.2) {
      return `
        胸像，
        正面视角，面向镜头，
        三分法构图，
        眼睛位于上三分线位置，
        面部周围留有足够的边距，
        自然的面部比例
      `;
    } else {
      return `
        特写肖像，
        正面视角，面向镜头，
        居中构图，
        面部占据画面的60-70%，
        面部周围留有足够的边距，
        耳朵可见，
        自然的比例
      `;
    }
  }
};

/**
 * 阶段1：面部特写图提示词
 * @param userPrompt 用户输入的描述
 * @param age 年龄段
 * @param gender 性别
 * @param scriptDescription 可选的完整appearance JSON
 * @param aspectRatio 宽高比
 * @param language 语言
 * @returns
 */
export const getFacePortraitPrompt = (
  userPrompt: string,
  age: string,
  gender: string,
  scriptDescription?: string,
  aspectRatio: string = '1:1',
  language: 'en' | 'zh' = 'zh'
) => {
  let details = '';
  if (age && age !== 'unknown' && age !== '不详' && age !== 'unknown') {
    details += language === 'en' ? `Age group: ${age}\n    ` : `角色年龄段: ${age}\n    `;
  }
  if (gender && gender !== 'unlimited' && gender !== '不限' && gender !== 'unlimited') {
    details += language === 'en' ? `Gender: ${gender}\n    ` : `性别: ${gender}\n    `;
  }

  const faceDescription = extractFaceDescription(scriptDescription);
  const finalPrompt = faceDescription || userPrompt;
  const compositionPrompt = getCompositionPrompt(aspectRatio, language);

  if (language === 'en') {
    return `
      Generate a high-quality character face portrait.
      ${details}Character features: ${finalPrompt}
      Image requirements:
      ${compositionPrompt}
      focus on face, detailed facial features, clear portrait, professional character design.
      Image style is clear, sharp, with even lighting.
    `;
  } else {
    return `
      生成一张高质量的人物面部特写头像。
      ${details}角色特征: ${finalPrompt} 
      画面要求：
      ${compositionPrompt}
      focus on face, detailed facial features, clear portrait, professional character design.
      画面风格清晰、锐利，光照均匀。
    `;
  }
};

/**
 * 阶段2：全身设定图提示词（基于面部图）
 * @param userPrompt 用户输入的描述
 * @param age 年龄段
 * @param gender 性别
 * @param language 语言
 * @returns
 */
export const getFullBodyPrompt = (
  userPrompt: string,
  age: string,
  gender: string,
  language: 'en' | 'zh' = 'zh'
) => {
  let details = '';
  if (age && age !== 'unknown' && age !== '不详' && age !== 'unknown') {
    details += language === 'en' ? `Age group: ${age}\n    ` : `角色年龄段: ${age}\n    `;
  }
  if (gender && gender !== 'unlimited' && gender !== '不限' && gender !== 'unlimited') {
    details += language === 'en' ? `Gender: ${gender}\n    ` : `性别: ${gender}\n    `;
  }

  if (language === 'en') {
    return `
      Generate a high-quality full-body character design sheet.
      ${details}Character features: ${userPrompt}
      Image requirements:
      full body shot, standing pose, character design sheet, professional concept art,
      CORRECT HUMAN PROPORTIONS,
      7.5-8 head tall, balanced head-to-body ratio,
      natural anatomy, realistic proportions,
      entire body visible from head to feet,
      no distortion, well-proportioned limbs,
      use reference image for facial features and likeness only,
      maintain correct full-body proportions,
      do not exaggerate head size.
      Image style is clear, sharp, with even lighting.
    `;
  } else {
    return `
      生成一张高质量的人物全身设定图。
      ${details}角色特征: ${userPrompt} 
      画面要求：
      full body shot, standing pose, character design sheet, professional concept art,
      正确的人体比例，
      7.5-8头身，平衡的头身比例，
      自然的解剖结构，真实的比例，
      从头到脚全身可见，
      无变形，四肢比例协调，
      仅使用参考图的面部特征和相似度，
      保持正确的全身比例，
      不要夸大头部尺寸。
      画面风格清晰、锐利，光照均匀。
    `;
  }
};
