export const DefaultStylePrompt = {
    'movie':{
        'nameEN':'movie',
        'nameCN':'电影质感',
        'image':'/styles/movie.png',
        'prompt':'cinematic lighting, movie still, shot on 35mm, realistic, 8k, masterpiece'
    },
    'photorealistic':{
        'nameEN':'photorealistic',
        'nameCN':'高清实拍',
        'image':'/styles/photorealistic.png',
        'prompt':'photorealistic, raw photo, DSLR, sharp focus, high fidelity, 4k texture'
    },
    'gothic':{
        'nameEN':'gothic',
        'nameCN':'暗黑哥特',
        'image':'/styles/gothic.png',
        'prompt':'gothic style, dark atmosphere, gloomy, fog, horror theme, muted colors'
    },
    'cyberpunk':{
        'nameEN':'cyberpunk',
        'nameCN':'赛博朋克',
        'image':'/styles/cyberpunk.png',
        'prompt':'cyberpunk, neon lights, futuristic, rainy street, blue and purple hue'
    },
    'anime':{
        'nameEN':'anime',
        'nameCN':'日漫风格',
        'image':'/styles/anime.png',
        'prompt':'anime style, 2D animation, cel shading, vibrant colors, clean lines'
    },
    'shinkai':{
        'nameEN':'shinkai',
        'nameCN':'新海诚风',
        'image':'/styles/shinkai.png',
        'prompt':'Makoto Shinkai style, beautiful sky, lens flare, detailed background, emotional'
    },
    'game':{
        'nameEN':'game',
        'nameCN':'游戏原画',
        'image':'/styles/game.png',
        'prompt':'game cg, splash art, highly detailed, epic composition, fantasy style'
    },
}

/**
 * 获取默认样式提示词
 * @param style 样式名称
 * @returns 
 */
export const getDefaultStylePrompt = (style: string = '') => {
    return style ? (DefaultStylePrompt[style]?.prompt || '') : '';
}

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
    生成一张高质量的人物角色设定图，在纯白色的背景上并排展示同一个角色的全身三视图，分别包含：正面视图、侧面视图和背面视图。
    ${details}角色特征: ${userPrompt} 
    画面要求：
    人物保持自然站立的姿势，三个角度的服装细节和身体比例必须保持严格一致。画面风格清晰、锐利，光照均匀，无阴影干扰，展现出专业的概念设计图效果。
    `;
}

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
}

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
}