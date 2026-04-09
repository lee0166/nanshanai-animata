import { AnnotationData, Story, Character, Scene, Shot } from './types';

export function getAIGeneratedSamples(): AnnotationData {
  return {
    stories: [
      // 故事1：小红帽（完整版）
      createLittleRedRidingHood(),
      // 故事2：雨中邂逅（完整版）
      createRainyEncounter(),
      // 故事3：黑客行动（完整版）
      createHackerOperation(),
      // 用户提供的精品故事1：加班夜的光
      createLateNightLight(),
      // 用户提供的精品故事2：青崖剑影
      createCliffSwordShadow(),
      // 用户提供的精品故事3：老街面包香
      createOldStreetBread(),
      // 用户提供的精品故事4：消失的快递
      createMissingPackage(),
      // 用户提供的精品故事5：星尘快递员
      createStardustCourier(),
    ],
  };
}

function createLittleRedRidingHood(): Story {
  const characters: Character[] = [
    {
      id: 'red_riding_hood',
      name: '小红帽',
      nameEn: 'Little Red Riding Hood',
      type: 'protagonist',
      ageGroup: 'child',
      gender: 'female',
      personality: '天真、善良、勇敢',
      appearance: '约10岁的小女孩，金色长发扎成两条辫子，戴着红色斗篷，里面是白色衬衫和蓝色裙子',
      costume: '红色斗篷、白色衬衫、蓝色裙子、红色小皮鞋',
      notes: '主角，故事的核心人物',
    },
    {
      id: 'wolf',
      name: '大灰狼',
      nameEn: 'The Big Bad Wolf',
      type: 'antagonist',
      ageGroup: 'adult',
      gender: 'male',
      personality: '狡猾、阴险、贪婪',
      appearance: '体型高大的灰狼，灰色毛皮，绿色眼睛，露出尖锐牙齿',
      costume: '通常伪装成外婆时会穿外婆的衣服',
      notes: '反派角色',
    },
    {
      id: 'grandmother',
      name: '外婆',
      nameEn: 'Grandmother',
      type: 'supporting',
      ageGroup: 'elder',
      gender: 'female',
      personality: '慈祥、温和',
      appearance: '白发苍苍的老奶奶，戴着圆框眼镜，穿着碎花围裙',
      costume: '碎花连衣裙、白色围裙、拖鞋',
      notes: '小红帽的外婆',
    },
  ];

  const scenes: Scene[] = [
    {
      id: 'forest_scene_01',
      sceneNumber: 'S001',
      name: '森林小径',
      location: '森林入口的小径上',
      time: 'morning',
      weather: 'sunny',
      atmosphere: 'warm',
      lighting: '清晨的阳光透过树叶洒下斑驳的光影',
      props: '野花、蘑菇、树木',
      description: '一条蜿蜒的小径穿过茂密的森林，阳光透过树冠洒下金色的光芒',
      notes: '',
    },
    {
      id: 'cottage_scene_01',
      sceneNumber: 'S002',
      name: '外婆家',
      location: '森林深处的小木屋',
      time: 'morning',
      weather: 'sunny',
      atmosphere: 'warm',
      lighting: '温暖的阳光透过窗户照进房间',
      props: '木床、桌子、椅子、花瓶',
      description: '温馨的小木屋，墙上挂着外婆的照片',
      notes: '',
    },
  ];

  const shots: Shot[] = [
    {
      id: 'shot_001_01',
      shotNumber: 'S001-01',
      sceneDescription: '小红帽提着篮子走在森林小径上',
      shotType: 'full',
      cameraAngle: 'eyeLevel',
      cameraMovement: 'static',
      duration: 5,
      characters: '小红帽',
      dialogue: '',
      musicSound: '轻快的背景音乐，鸟儿的鸣叫声',
      visualDescription:
        '清晨的森林，阳光透过树叶洒下斑驳的光影。小红帽穿着红色斗篷，提着装满食物的篮子，欢快地走在蜿蜒的小径上。路边开满了野花，蝴蝶在花丛中飞舞。',
      notes: '',
    },
    {
      id: 'shot_001_02',
      shotNumber: 'S001-02',
      sceneDescription: '大灰狼从树后走出来',
      shotType: 'medium',
      cameraAngle: 'eyeLevel',
      cameraMovement: 'pan',
      duration: 4,
      characters: '小红帽、大灰狼',
      dialogue: '[大灰狼]：小姑娘，你要去哪里呀？',
      musicSound: '音乐变得紧张',
      visualDescription:
        '镜头从小红帽的中景，缓缓向右摇动。大灰狼从一棵大树后面走出来。他伪装成友善的样子，但眼神中闪过一丝狡猾。小红帽停下脚步，看着大灰狼。',
      notes: '',
    },
    {
      id: 'shot_001_03',
      shotNumber: 'S001-03',
      sceneDescription: '小红帽和大灰狼对话',
      shotType: 'medium',
      cameraAngle: 'eyeLevel',
      cameraMovement: 'static',
      duration: 6,
      characters: '小红帽、大灰狼',
      dialogue:
        '[小红帽]：我要去外婆家，给她送些吃的。\n[大灰狼]：那你应该摘些鲜花给她，她一定会很高兴的！',
      musicSound: '紧张的音乐持续',
      visualDescription:
        '两人的中景。小红帽天真地笑着，大灰狼在一旁诱骗她。背景是森林的背景，阳光透过树叶。',
      notes: '',
    },
    {
      id: 'shot_002_01',
      shotNumber: 'S002-01',
      sceneDescription: '大灰狼抢先到达外婆家',
      shotType: 'long',
      cameraAngle: 'eyeLevel',
      cameraMovement: 'push',
      duration: 4,
      characters: '大灰狼',
      dialogue: '',
      musicSound: '紧张的音乐渐强',
      visualDescription: '外婆家的远景。镜头缓缓推向小木屋。大灰狼穿着外婆的衣服，躺在床上。',
      notes: '',
    },
    {
      id: 'shot_002_02',
      shotNumber: 'S002-02',
      sceneDescription: '小红帽到达外婆家',
      shotType: 'medium',
      cameraAngle: 'eyeLevel',
      cameraMovement: 'static',
      duration: 5,
      characters: '小红帽',
      dialogue: '[小红帽]：外婆，我来了！',
      musicSound: '音乐暂时缓和',
      visualDescription: '小红帽推开房门，走进房间。她看到外婆躺在床上，感觉有些不对劲。',
      notes: '',
    },
  ];

  return {
    id: 'little_red_riding_hood',
    title: '小红帽与大灰狼',
    synopsis:
      '小红帽提着篮子去森林看望外婆，途中遇到了狡猾的大灰狼。大灰狼诱骗小红帽去摘花，自己抢先到达外婆家...',
    characters,
    scenes,
    shots,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createRainyEncounter(): Story {
  const characters: Character[] = [
    {
      id: 'lina',
      name: '林娜',
      nameEn: 'Lina',
      type: 'protagonist',
      ageGroup: 'young',
      gender: 'female',
      personality: '温柔、敏感、热爱艺术',
      appearance: '20多岁的年轻女性，黑色长直发，戴着黑框眼镜，穿着简单的连衣裙',
      costume: '米色风衣、黑色连衣裙、白色帆布鞋',
      notes: '美术学院的学生',
    },
    {
      id: 'chen',
      name: '陈默',
      nameEn: 'Chen Mo',
      type: 'protagonist',
      ageGroup: 'young',
      gender: 'male',
      personality: '内敛、善良、热爱音乐',
      appearance: '20多岁的年轻男性，短发，穿着简单的T恤和牛仔裤',
      costume: '黑色T恤、牛仔裤、帆布鞋',
      notes: '独立音乐人',
    },
  ];

  const scenes: Scene[] = [
    {
      id: 'cafe_scene_01',
      sceneNumber: 'S001',
      name: '街角咖啡店',
      location: '城市街角的一家小咖啡店',
      time: 'afternoon',
      weather: 'lightRain',
      atmosphere: 'romantic',
      lighting: '柔和的暖黄色灯光',
      props: '咖啡杯、书架、钢琴',
      description: '温馨的咖啡店，墙上挂满了画作',
      notes: '',
    },
  ];

  const shots: Shot[] = [
    {
      id: 'shot_001_01',
      shotNumber: 'S001-01',
      sceneDescription: '林娜坐在咖啡店画画',
      shotType: 'medium',
      cameraAngle: 'eyeLevel',
      cameraMovement: 'static',
      duration: 5,
      characters: '林娜',
      dialogue: '',
      musicSound: '轻柔的钢琴曲背景音乐',
      visualDescription:
        '林娜坐在咖啡店的角落，手里拿着画笔在画板。她的面前放着一杯拿铁咖啡。窗外下着小雨，雨滴打在玻璃上。',
      notes: '',
    },
    {
      id: 'shot_001_02',
      shotNumber: 'S001-02',
      sceneDescription: '陈默走进咖啡店',
      shotType: 'long',
      cameraAngle: 'eyeLevel',
      cameraMovement: 'pan',
      duration: 4,
      characters: '陈默',
      dialogue: '',
      musicSound: '背景音乐继续',
      visualDescription:
        '陈默推开门走进来，雨水打湿了他的头发。他抖了抖身上的雨衣，四处张望找座位。',
      notes: '',
    },
    {
      id: 'shot_001_03',
      shotNumber: 'S001-03',
      sceneDescription: '两人目光交汇',
      shotType: 'close',
      cameraAngle: 'eyeLevel',
      cameraMovement: 'static',
      duration: 6,
      characters: '林娜、陈默',
      dialogue: '',
      musicSound: '音乐渐弱',
      visualDescription:
        '陈默的目光与林娜的目光交汇。两人都愣了一下，然后相视一笑。时间仿佛在这一刻静止了。',
      notes: '',
    },
  ];

  return {
    id: 'rainy_encounter',
    title: '雨中邂逅',
    synopsis:
      '一个下雨天，美术学院的学生林娜在街角的咖啡店画画，遇到了独立音乐人陈默。两人的目光在雨中交汇...',
    characters,
    scenes,
    shots,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createHackerOperation(): Story {
  const characters: Character[] = [
    {
      id: 'zero',
      name: '零',
      nameEn: 'Zero',
      type: 'protagonist',
      ageGroup: 'young',
      gender: 'male',
      personality: '冷静、聪明、果断',
      appearance: '20多岁的男性，短发，眼神锐利',
      costume: '黑色连帽衫、牛仔裤、运动鞋',
      notes: '顶尖黑客',
    },
    {
      id: 'agent_x',
      name: 'X特工',
      nameEn: 'Agent X',
      type: 'antagonist',
      ageGroup: 'middle',
      gender: 'male',
      personality: '冷酷、无情',
      appearance: '40多岁的男性，穿着西装',
      costume: '黑色西装、领带、皮鞋',
      notes: '神秘组织的特工',
    },
  ];

  const scenes: Scene[] = [
    {
      id: 'apartment_scene_01',
      sceneNumber: 'S001',
      name: '零的公寓',
      location: '城市高层公寓',
      time: 'night',
      weather: 'overcast',
      atmosphere: 'tense',
      lighting: '电脑屏幕的蓝光',
      props: '多台显示器、键盘、服务器',
      description: '昏暗的房间，只有电脑屏幕的光芒',
      notes: '',
    },
  ];

  const shots: Shot[] = [
    {
      id: 'shot_001_01',
      shotNumber: 'S001-01',
      sceneDescription: '零在电脑前工作',
      shotType: 'medium',
      cameraAngle: 'eyeLevel',
      cameraMovement: 'static',
      duration: 5,
      characters: '零',
      dialogue: '',
      musicSound: '紧张的电子音乐',
      visualDescription:
        '零坐在多台显示器前，手指在键盘上飞快地敲击。屏幕上显示着复杂的代码和数据流。',
      notes: '',
    },
    {
      id: 'shot_001_02',
      shotNumber: 'S001-02',
      sceneDescription: '发现入侵警报',
      shotType: 'close',
      cameraAngle: 'eyeLevel',
      cameraMovement: 'push',
      duration: 4,
      characters: '零',
      dialogue: '[零]：不好，有人入侵！',
      musicSound: '音乐变得更加紧张',
      visualDescription:
        '零的电脑屏幕特写。警报弹出红色警告，显示有人正在入侵他的系统。零的表情变得严肃。',
      notes: '',
    },
    {
      id: 'shot_001_03',
      shotNumber: 'S001-03',
      sceneDescription: '零开始反击',
      shotType: 'medium',
      cameraAngle: 'eyeLevel',
      cameraMovement: 'static',
      duration: 6,
      characters: '零',
      dialogue: '',
      musicSound: '音乐达到高潮',
      visualDescription:
        '零的双手在键盘上快速操作。屏幕上的代码飞快地滚动。他开始追踪入侵者的位置。',
      notes: '',
    },
  ];

  return {
    id: 'hacker_operation',
    title: '黑客行动',
    synopsis:
      '顶尖黑客零在深夜发现自己的系统被入侵。他必须在神秘组织的X特工找到他之前，找出入侵者的身份...',
    characters,
    scenes,
    shots,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// 用户提供的精品故事1：加班夜的光
function createLateNightLight(): Story {
  const characters: Character[] = [
    {
      id: 'new_programmer',
      name: '新人程序员',
      type: 'protagonist',
      ageGroup: 'young',
      gender: 'male',
      personality: '努力、焦虑、坚持',
      appearance: '20多岁的年轻男性，略显疲惫，眼底有红血丝',
      costume: '简单的T恤和牛仔裤',
      notes: '刚入职的新人',
    },
    {
      id: 'senior',
      name: '前辈',
      type: 'supporting',
      ageGroup: 'middle',
      gender: 'male',
      personality: '温和、体贴、有经验',
      appearance: '40多岁的男性，温和的笑容',
      costume: '简单的工作装',
      notes: '公司的前辈',
    },
  ];

  const scenes: Scene[] = [
    {
      id: 'office_scene_01',
      sceneNumber: 'S001',
      name: '深夜写字楼',
      location: 'CBD的高层写字楼',
      time: 'night',
      weather: 'overcast',
      atmosphere: 'tense',
      lighting: '冷白顶灯、桌面多屏冷光',
      props: '键盘、咖啡杯、便利贴',
      description: '开放式办公区，深夜只有少数窗口亮着灯',
      notes: '',
    },
  ];

  const shots: Shot[] = [
    {
      id: 'late_001',
      shotNumber: 'S001-01',
      sceneDescription: '深夜CBD建筑群',
      shotType: 'extremeLong',
      cameraAngle: 'high',
      cameraMovement: 'zoomOut',
      duration: 4,
      characters: '',
      dialogue: '',
      musicSound: '环境白噪音、极远处车流低频声、高空风声',
      visualDescription:
        '深夜CBD建筑群呈冷蓝色调，整栋写字楼仅少数窗口透出暖黄灯光，主角所在工位为视觉焦点；城市霓虹虚化散景，地面车流轨迹如光带，高空风掠过玻璃幕墙。',
      notes: '',
    },
    {
      id: 'late_002',
      shotNumber: 'S001-02',
      sceneDescription: '开放式办公区',
      shotType: 'full',
      cameraAngle: 'eyeLevel',
      cameraMovement: 'static',
      duration: 3,
      characters: '新人程序员',
      dialogue: '[新人（气声低语）]：再调一次参数…',
      musicSound: '密集清脆键盘声、空调低频嗡鸣、鼠标点击声',
      visualDescription:
        '开放式办公区纵深构图，冷白顶灯只开一半，主角被桌面多屏冷光包裹，身后空间陷入阴影；键盘、咖啡杯、便利贴形成生活化杂乱，人物坐姿紧绷，双肩内扣显焦虑。',
      notes: '',
    },
    {
      id: 'late_003',
      shotNumber: 'S001-03',
      sceneDescription: '电脑屏幕报错',
      shotType: 'close',
      cameraAngle: 'eyeLevel',
      cameraMovement: 'push',
      duration: 3,
      characters: '新人程序员',
      dialogue: '',
      musicSound: '系统报错提示音、渐强的心跳声、电流细微杂音',
      visualDescription:
        '电脑屏幕占据画面主体，红色报错代码高亮闪烁，光标定点跳动；屏幕反光映出主角紧绷的眉眼，指尖悬停在键帽上方微颤，指节泛白。',
      notes: '',
    },
    {
      id: 'late_004',
      shotNumber: 'S001-04',
      sceneDescription: '主角揉眼望向窗外',
      shotType: 'medium',
      cameraAngle: 'eyeLevel',
      cameraMovement: 'pan',
      duration: 4,
      characters: '新人程序员',
      dialogue: '[新人（自语）]：逻辑没问题，是接口兼容问题',
      musicSound: '陶瓷杯碰撞声、窗外风声、纸张摩擦声',
      visualDescription:
        '侧光打亮主角侧脸，眼底红血丝清晰可见；抬手揉眼动作迟缓，拿起冷咖啡时杯壁凝水滑落，转头望向窗外城市夜景，眼神从迷茫涣散逐渐聚焦坚定。',
      notes: '',
    },
    {
      id: 'late_005',
      shotNumber: 'S001-05',
      sceneDescription: '前辈送来热牛奶',
      shotType: 'mediumClose',
      cameraAngle: 'low',
      cameraMovement: 'static',
      duration: 5,
      characters: '新人程序员、前辈',
      dialogue: '[前辈（轻声温和）]：别急，我查过接口文档，你少传了一个字段',
      musicSound: '牛奶杯温热水汽声、开关灯轻微电流声、脚步轻响',
      visualDescription:
        '暖光从门口方向切入形成轮廓光，前辈手持热牛奶站在阴影与光亮交界处，面部柔和；主角头顶顶灯被轻轻点亮，暖光瞬间覆盖冷色桌面，形成强烈视觉冷暖对比。',
      notes: '',
    },
  ];

  return {
    id: 'late_night_light',
    title: '加班夜的光',
    synopsis:
      '深夜写字楼，新人程序员在孤独与焦虑中攻克代码bug，前辈以一盏灯、一杯热牛奶完成无声的职场温柔救赎',
    characters,
    scenes,
    shots,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// 用户提供的精品故事2：青崖剑影
function createCliffSwordShadow(): Story {
  const characters: Character[] = [
    {
      id: 'young_cultivator',
      name: '少年修士',
      type: 'protagonist',
      ageGroup: 'teen',
      gender: 'male',
      personality: '勇敢、坚定、灵动',
      appearance: '白衣少年，眼神锐利',
      costume: '白色道袍',
      notes: '',
    },
    {
      id: 'mystical_fox',
      name: '千年玄狐',
      type: 'antagonist',
      ageGroup: 'elder',
      gender: 'female',
      personality: '神秘、凌厉',
      appearance: '通体雪白毛发，赤红色竖瞳',
      costume: '',
      notes: '',
    },
  ];

  const scenes: Scene[] = [
    {
      id: 'cliff_scene_01',
      sceneNumber: 'S002',
      name: '青崖秘境',
      location: '青崖上古秘境',
      time: 'morning',
      weather: 'foggy',
      atmosphere: 'mystery',
      lighting: '阳光穿透云层形成丁达尔光束',
      props: '青锋剑、青冥玉佩',
      description: '云雾翻涌的青崖秘境，古松绝壁',
      notes: '',
    },
  ];

  const shots: Shot[] = [
    {
      id: 'cliff_001',
      shotNumber: 'S002-01',
      sceneDescription: '少年在林间穿梭',
      shotType: 'extremeLong',
      cameraAngle: 'bird',
      cameraMovement: 'track',
      duration: 3,
      characters: '少年修士',
      dialogue: '',
      musicSound: '狂风呼啸声、枝叶剧烈摩擦声、衣袂破空声',
      visualDescription:
        '青崖秘境云雾翻涌，古松绝壁呈青墨色调，白衣少年在林间高速穿梭，剑气拖出淡蓝流光尾迹；阳光穿透云层形成丁达尔光束，林间光影斑驳，空间纵深感极强。',
      notes: '',
    },
    {
      id: 'cliff_002',
      shotNumber: 'S002-02',
      sceneDescription: '少年站在崖台',
      shotType: 'full',
      cameraAngle: 'eyeLevel',
      cameraMovement: 'static',
      duration: 4,
      characters: '少年修士',
      dialogue: '[少年（沉声）]：此地灵气异常，必有上古奇遇',
      musicSound: '剑鞘金属摩擦声、符文低频震动声、云雾流动声',
      visualDescription:
        '圆形崖台居中构图，地面上古符文呈暗金色纹路；少年持半出鞘青锋剑，站姿稳如松，眼神锐利警惕，周身灵气微漾形成淡青色气场；崖台边缘云雾翻滚，环境神秘压抑。',
      notes: '',
    },
    {
      id: 'cliff_003',
      shotNumber: 'S002-03',
      sceneDescription: '玄狐暴起',
      shotType: 'close',
      cameraAngle: 'low',
      cameraMovement: 'push',
      duration: 3,
      characters: '少年修士、千年玄狐',
      dialogue: '',
      musicSound: '玄狐低沉嘶吼、利爪划破空气锐响、灵气爆鸣声',
      visualDescription:
        '玄狐从符文阴影中暴起，通体雪白毛发根根分明，赤红色竖瞳寒光凛冽，利爪泛着乌金冷光，尖牙外露；镜头聚焦狐爪与少年面部的紧张对峙，空气感紧绷。',
      notes: '',
    },
    {
      id: 'cliff_004',
      shotNumber: 'S002-04',
      sceneDescription: '少年闪避反击',
      shotType: 'medium',
      cameraAngle: 'dutch',
      cameraMovement: 'track',
      duration: 4,
      characters: '少年修士、千年玄狐',
      dialogue: '[少年（暴喝）]：来得好！',
      musicSound: '金属剧烈碰撞脆响、急促呼吸声、剑气破空声',
      visualDescription:
        '少年侧身极限闪避，青锋剑出鞘斩出弧光，与狐爪硬碰碰撞出金色火星；少年借力腾空后空翻，衣袂飞扬，剑尖直指玄狐眉心要害，动作凌厉且极具张力。',
      notes: '',
    },
    {
      id: 'cliff_005',
      shotNumber: 'S002-05',
      sceneDescription: '玄狐化作白光消散',
      shotType: 'extremeClose',
      cameraAngle: 'eyeLevel',
      cameraMovement: 'static',
      duration: 5,
      characters: '少年修士',
      dialogue: '[少年（惊喜）]：这便是秘境核心信物！',
      musicSound: '玉佩高频嗡鸣声、白光消散轻响、灵气共鸣声',
      visualDescription:
        '剑尖轻触玄狐眉心，玄狐化作星点白光消散；崖台中心青冥玉佩缓缓升起，玉质通透泛青光，纹路流转灵光；少年指尖轻触玉佩，光芒顺着指尖蔓延至全身。',
      notes: '',
    },
  ];

  return {
    id: 'cliff_sword_shadow',
    title: '青崖剑影',
    synopsis:
      '少年修士闯入青崖上古秘境，遭遇千年玄狐突袭，以灵动身法与凌厉剑意对决，最终收服秘境信物青冥玉佩',
    characters,
    scenes,
    shots,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// 用户提供的精品故事3：老街面包香
function createOldStreetBread(): Story {
  const characters: Character[] = [
    {
      id: 'grandma',
      name: '奶奶',
      type: 'protagonist',
      ageGroup: 'elder',
      gender: 'female',
      personality: '慈祥、温暖、善良',
      appearance: '白发苍苍，戴老花镜',
      costume: '碎花围裙',
      notes: '老面包店店主',
    },
    {
      id: 'student',
      name: '学生',
      type: 'supporting',
      ageGroup: 'teen',
      gender: 'male',
      personality: '疲惫、惊喜',
      appearance: '背着书包，校服略显凌乱',
      costume: '校服',
      notes: '',
    },
  ];

  const scenes: Scene[] = [
    {
      id: 'street_scene_01',
      sceneNumber: 'S003',
      name: '江南老街',
      location: '江南青石板老街',
      time: 'dawn',
      weather: 'foggy',
      atmosphere: 'warm',
      lighting: '暖色调柔光漫射',
      props: '复古烤箱、木质货架、铜制风铃',
      description: '晨雾笼罩的江南老街',
      notes: '',
    },
  ];

  const shots: Shot[] = [
    {
      id: 'bread_001',
      shotNumber: 'S003-01',
      sceneDescription: '江南晨雾老街',
      shotType: 'extremeLong',
      cameraAngle: 'high',
      cameraMovement: 'pan',
      duration: 4,
      characters: '',
      dialogue: '',
      musicSound: '清晨鸟鸣、远处自行车铃铛、雾中环境混响',
      visualDescription:
        '江南晨雾笼罩青石板老街，暖色调柔光漫射；面包店木质招牌泛旧温润，烟囱飘出淡白炊烟，街巷空寂，露水附着在砖瓦与绿植上，画面充满湿润烟火气。',
      notes: '',
    },
    {
      id: 'bread_002',
      shotNumber: 'S003-02',
      sceneDescription: '奶奶取出烤盘',
      shotType: 'full',
      cameraAngle: 'eyeLevel',
      cameraMovement: 'static',
      duration: 3,
      characters: '奶奶',
      dialogue: '',
      musicSound: '烤箱开门吱呀声、面包滋滋出油声、奶奶轻哼江南小调',
      visualDescription:
        '面包店内暖黄灯光充盈，复古烤箱、木质货架充满年代感；奶奶戴老花镜，身着碎花围裙，双手戴隔热手套取出烤盘，金黄面包冒着热气，表皮酥脆起酥层次分明。',
      notes: '',
    },
    {
      id: 'bread_003',
      shotNumber: 'S003-03',
      sceneDescription: '奶奶夹起面包',
      shotType: 'close',
      cameraAngle: 'eyeLevel',
      cameraMovement: 'push',
      duration: 3,
      characters: '奶奶',
      dialogue: '',
      musicSound: '竹夹轻碰声、玻璃柜滑动声、面包松软回弹声',
      visualDescription:
        '奶奶布满皱纹的手紧握竹制面包夹，动作沉稳有力；阳光透过木格窗形成条状光束，洒在金黄面包表面，麦麸颗粒清晰可见，热气在光线下形成可见雾流。',
      notes: '',
    },
    {
      id: 'bread_004',
      shotNumber: 'S003-04',
      sceneDescription: '学生收到面包',
      shotType: 'medium',
      cameraAngle: 'eyeLevel',
      cameraMovement: 'push',
      duration: 4,
      characters: '奶奶、学生',
      dialogue: '[奶奶（温和笑）]：孩子，刚烤的，趁热吃。\n[学生]：谢谢奶奶！',
      musicSound: '面包传递轻响、书包拉链声、脚步挪动声',
      visualDescription:
        '背着书包的学生垂头站在门口，校服略显凌乱，满脸疲惫困倦；奶奶递上温热红豆面包，学生猛然抬头，眼中疲惫瞬间被惊喜取代，嘴角不自觉上扬。',
      notes: '',
    },
    {
      id: 'bread_005',
      shotNumber: 'S003-05',
      sceneDescription: '奶奶倚靠门框',
      shotType: 'mediumClose',
      cameraAngle: 'low',
      cameraMovement: 'static',
      duration: 5,
      characters: '奶奶',
      dialogue: '',
      musicSound: '清脆风铃声、面包香环境音、远处市井轻响',
      visualDescription:
        '奶奶倚靠木门框，白发被晨光染成金棕色，笑容慈祥；学生奔跑远去的背影渐小，门口铜制风铃随风轻摆，光影在墙面缓慢移动，画面温暖治愈。',
      notes: '',
    },
  ];

  return {
    id: 'old_street_bread',
    title: '老街面包香',
    synopsis: '清晨江南老街，老面包店奶奶用刚出炉的面包温暖路人，用烟火气守护城市里最朴素的温柔',
    characters,
    scenes,
    shots,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// 用户提供的精品故事4：消失的快递
function createMissingPackage(): Story {
  const characters: Character[] = [
    {
      id: 'worker',
      name: '职场人',
      type: 'protagonist',
      ageGroup: 'young',
      gender: 'male',
      personality: '急切、释然',
      appearance: '职场装扮，略显疲惫',
      costume: '职场装',
      notes: '',
    },
    {
      id: 'boss_wang',
      name: '王总',
      type: 'supporting',
      ageGroup: 'middle',
      gender: 'male',
      personality: '体贴、从容',
      appearance: '西装革履',
      costume: '西装',
      notes: '前辈',
    },
  ];

  const scenes: Scene[] = [
    {
      id: 'apartment_scene_02',
      sceneNumber: 'S004',
      name: '公寓楼道',
      location: '公寓楼道',
      time: 'night',
      weather: 'overcast',
      atmosphere: 'tense',
      lighting: '冷色调灯光',
      props: '快递单、分镜方案',
      description: '略显陈旧的公寓楼道',
      notes: '',
    },
  ];

  const shots: Shot[] = [
    {
      id: 'package_001',
      shotNumber: 'S004-01',
      sceneDescription: '主角站在家门口',
      shotType: 'full',
      cameraAngle: 'eyeLevel',
      cameraMovement: 'static',
      duration: 3,
      characters: '职场人',
      dialogue: '[主角（疑惑自语）]：明明显示派送完成，怎么不见了？',
      musicSound: '手机消息提示音、楼道空旷回声、风声',
      visualDescription:
        '公寓楼道冷色调灯光，墙面略显陈旧，主角站在家门口，背包斜挎，眉头紧锁；门口地面空无一物，仅一张快递单被风吹得微动，空间氛围紧张疑惑。',
      notes: '',
    },
    {
      id: 'package_002',
      shotNumber: 'S004-02',
      sceneDescription: '快递单特写',
      shotType: 'close',
      cameraAngle: 'high',
      cameraMovement: 'push',
      duration: 3,
      characters: '',
      dialogue: '',
      musicSound: '手指摩擦纸张声、笔尖印刷质感声',
      visualDescription:
        '快递单微距拍摄，字迹清晰，收件人为主角姓名，寄件人标注项目负责人，备注"项目核心分镜资料，加急"；纸张边缘微卷，留有轻微指纹痕迹。',
      notes: '',
    },
    {
      id: 'package_003',
      shotNumber: 'S004-03',
      sceneDescription: '主角走进邻居家',
      shotType: 'medium',
      cameraAngle: 'eyeLevel',
      cameraMovement: 'pan',
      duration: 4,
      characters: '职场人、王总',
      dialogue: '[主角（急切）]：王总，我的快递……',
      musicSound: '木门轻推声、沙发布料摩擦声、脚步急促声',
      visualDescription:
        '主角快步走向邻居门口，房门虚掩留一道光缝；推门而入，室内暖光与楼道冷光形成对比，前辈坐在沙发上，手持文件抬头看来，神态从容。',
      notes: '',
    },
    {
      id: 'package_004',
      shotNumber: 'S004-04',
      sceneDescription: '前辈递出文件',
      shotType: 'mediumClose',
      cameraAngle: 'eyeLevel',
      cameraMovement: 'static',
      duration: 4,
      characters: '职场人、王总',
      dialogue: '[王总]：怕你被误拿，先帮你收着，特意等你回来。\n[主角]：太感谢您了！',
      musicSound: '纸张翻动声、文件装订轻响、轻声交谈声',
      visualDescription:
        '前辈将装订整齐的分镜优化方案递出，纸张封面标注清晰；主角接过快速翻阅，看到标注内容后眼神从疑惑转为恍然大悟，紧绷的身体瞬间放松。',
      notes: '',
    },
    {
      id: 'package_005',
      shotNumber: 'S004-05',
      sceneDescription: '分镜方案特写',
      shotType: 'extremeClose',
      cameraAngle: 'low',
      cameraMovement: 'zoomOut',
      duration: 5,
      characters: '',
      dialogue: '',
      musicSound: '夜晚环境静音、纸张轻响、月光下静谧氛围音',
      visualDescription:
        '分镜方案上红色修改标注密密麻麻，逻辑清晰；窗外月光透过窗帘形成柔光斑，洒在文件表面，主角指尖轻触标注，嘴角露出释然微笑。',
      notes: '',
    },
  ];

  return {
    id: 'missing_package',
    title: '消失的快递',
    synopsis:
      '职场人归家发现重要项目快递失踪，紧张寻找后发现是前辈代为保管，并留下关键分镜优化指导',
    characters,
    scenes,
    shots,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

// 用户提供的精品故事5：星尘快递员
function createStardustCourier(): Story {
  const characters: Character[] = [
    {
      id: 'courier',
      name: '星际快递员',
      type: 'protagonist',
      ageGroup: 'young',
      gender: 'male',
      personality: '专业、友好、兴奋',
      appearance: '身着星际制服',
      costume: '星际制服',
      notes: '',
    },
  ];

  const scenes: Scene[] = [
    {
      id: 'space_scene_01',
      sceneNumber: 'S005',
      name: '蓝晶星',
      location: '异星蓝晶星',
      time: 'morning',
      weather: 'sunny',
      atmosphere: 'mystery',
      lighting: '星光、晶体反光',
      props: '星尘号飞船、能量晶体、青冥玉佩',
      description: '蓝晶星地表遍布柱状蓝色透明晶体',
      notes: '',
    },
  ];

  const shots: Shot[] = [
    {
      id: 'stardust_001',
      shotNumber: 'S005-01',
      sceneDescription: '星尘号抵达蓝晶星',
      shotType: 'extremeLong',
      cameraAngle: 'bird',
      cameraMovement: 'zoomOut',
      duration: 4,
      characters: '',
      dialogue: '',
      musicSound: '飞船引擎低频轰鸣、星际电波杂音、宇宙环境混响',
      visualDescription:
        '深邃宇宙黑底，星群呈冷暖双色光点，星尘号飞船喷射蓝紫色引擎尾焰；远处蓝晶星通体晶莹，地表晶体反射星光，星云环绕形成梦幻宇宙氛围，空间宏大震撼。',
      notes: '',
    },
    {
      id: 'stardust_002',
      shotNumber: 'S005-02',
      sceneDescription: '飞船降落',
      shotType: 'full',
      cameraAngle: 'eyeLevel',
      cameraMovement: 'static',
      duration: 3,
      characters: '星际快递员',
      dialogue: '[主角（通讯器）]：蓝晶星派送站点，已抵达目标区域。',
      musicSound: '飞船降落气流声、通讯器电流声、晶体碎裂轻响',
      visualDescription:
        '蓝晶星地表遍布柱状蓝色透明晶体，天空呈渐变紫粉色；星尘号平稳降落，起落架压碎细小晶屑；主角身着星际制服，背负抗重力快递箱，走出舱门时地面晶体反光映亮全身。',
      notes: '',
    },
    {
      id: 'stardust_003',
      shotNumber: 'S005-03',
      sceneDescription: '能量晶体特写',
      shotType: 'close',
      cameraAngle: 'eyeLevel',
      cameraMovement: 'push',
      duration: 3,
      characters: '',
      dialogue: '',
      musicSound: '箱盖电磁锁开合声、晶体低频嗡鸣、能量流动声',
      visualDescription:
        '快递箱开启，内部能量晶体呈深海蓝色，内部流光缓慢流转，表面有规则晶格纹路；晶体散发柔和光晕，照亮箱内科技纹路，质感通透且极具未来感。',
      notes: '',
    },
    {
      id: 'stardust_004',
      shotNumber: 'S005-04',
      sceneDescription: '蓝晶生物围拢',
      shotType: 'medium',
      cameraAngle: 'dutch',
      cameraMovement: 'pan',
      duration: 4,
      characters: '星际快递员',
      dialogue: '[主角（轻笑）]：这是你们的能量补给晶体，签收完成。',
      musicSound: '生物轻柔高频叫声、能量共鸣声、轻声笑意',
      visualDescription:
        '半透明凝胶状蓝晶生物成群围拢，身体随呼吸明暗闪烁，触碰快递箱时发出柔和光效；生物形态灵动，与主角形成友好互动，画面充满科幻治愈感。',
      notes: '',
    },
    {
      id: 'stardust_005',
      shotNumber: 'S005-05',
      sceneDescription: '星际地图展开',
      shotType: 'extremeLong',
      cameraAngle: 'high',
      cameraMovement: 'pan',
      duration: 5,
      characters: '星际快递员',
      dialogue: '[主角（兴奋）]：交付完成，下一站，红砂星！',
      musicSound: '全息地图启动嗡鸣、引擎预热声、星际提示音',
      visualDescription:
        '主角立于晶体平台中央，蓝晶生物环绕成圈；天空虚拟星际全息地图展开，蓝晶星标记被点亮亮起金光；主角抬手触碰地图，星域航线缓缓展开，科幻感拉满。',
      notes: '',
    },
  ];

  return {
    id: 'stardust_courier',
    title: '星尘快递员',
    synopsis:
      '星际快递员驾驶星尘号抵达异星蓝晶星，派送能量晶体，与原生蓝晶生物完成交付，解锁星际星域地图',
    characters,
    scenes,
    shots,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
