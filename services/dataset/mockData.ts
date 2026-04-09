import { ViStoryStory } from './types';

export function getMockViStoryData(): ViStoryStory[] {
  return [
    {
      story_id: '01',
      story_type_en: 'fairy_tale',
      story_type_cn: '童话',
      characters: [
        {
          id: 'alice',
          name_en: 'Alice',
          name_cn: '爱丽丝',
          prompt_en: 'A young girl with blonde hair, blue eyes, wearing a blue dress',
          prompt_cn: '一个金发碧眼的年轻女孩，穿着蓝色连衣裙',
          tag: 'realistic',
          image_paths: ['image/alice/00.jpg'],
        },
      ],
      shots: [
        {
          plot_correspondence_en: 'Alice is sitting by the riverbank.',
          plot_correspondence_cn: '爱丽丝坐在河边。',
          setting_description_en: 'A peaceful riverbank on a sunny afternoon.',
          setting_description_cn: '一个阳光明媚的下午，宁静的河边。',
          characters_appearing_en: 'Alice',
          characters_appearing_cn: '爱丽丝',
          static_shot_description_en: 'Alice is sitting on the grass.',
          static_shot_description_cn: '爱丽丝坐在草地上。',
          shot_perspective_design_en: 'Medium shot.',
          shot_perspective_design_cn: '中景。',
        },
      ],
    },
    {
      story_id: '02',
      story_type_en: 'action',
      story_type_cn: '动作',
      characters: [
        {
          id: 'detective',
          name_en: 'Detective Chen',
          name_cn: '陈侦探',
          prompt_en: 'A male detective in his 40s.',
          prompt_cn: '一位40多岁的男侦探。',
          tag: 'realistic',
          image_paths: ['image/detective/00.jpg'],
        },
      ],
      shots: [
        {
          plot_correspondence_en: 'Detective Chen stakes out a warehouse.',
          plot_correspondence_cn: '陈侦探监视仓库。',
          setting_description_en: 'Rainy night, abandoned warehouse.',
          setting_description_cn: '雨夜，废弃仓库。',
          characters_appearing_en: 'Detective Chen',
          characters_appearing_cn: '陈侦探',
          static_shot_description_en: 'Detective Chen sits in his car.',
          static_shot_description_cn: '陈侦探坐在车里。',
          shot_perspective_design_en: 'Medium shot.',
          shot_perspective_design_cn: '中景。',
        },
      ],
    },
    {
      story_id: '03',
      story_type_en: 'romance',
      story_type_cn: '爱情',
      characters: [
        {
          id: 'sarah',
          name_en: 'Sarah',
          name_cn: '莎拉',
          prompt_en: 'A young woman artist.',
          prompt_cn: '一位年轻女性艺术家。',
          tag: 'realistic',
          image_paths: ['image/sarah/00.jpg'],
        },
      ],
      shots: [
        {
          plot_correspondence_en: 'Sarah sits in a coffee shop.',
          plot_correspondence_cn: '莎拉坐在咖啡店里。',
          setting_description_en: 'Cozy coffee shop.',
          setting_description_cn: '舒适的咖啡店。',
          characters_appearing_en: 'Sarah',
          characters_appearing_cn: '莎拉',
          static_shot_description_en: 'Sarah is sketching.',
          static_shot_description_cn: '莎拉在素描。',
          shot_perspective_design_en: 'Medium shot.',
          shot_perspective_design_cn: '中景。',
        },
      ],
    },
    {
      story_id: '04',
      story_type_en: 'horror',
      story_type_cn: '恐怖',
      characters: [
        {
          id: 'emma',
          name_en: 'Emma',
          name_cn: '艾玛',
          prompt_en: 'A young woman.',
          prompt_cn: '一位年轻女子。',
          tag: 'realistic',
          image_paths: ['image/emma/00.jpg'],
        },
      ],
      shots: [
        {
          plot_correspondence_en: 'Emma arrives at an old house.',
          plot_correspondence_cn: '艾玛到达老房子。',
          setting_description_en: 'Old Victorian house.',
          setting_description_cn: '维多利亚式老房子。',
          characters_appearing_en: 'Emma',
          characters_appearing_cn: '艾玛',
          static_shot_description_en: 'Emma pulls up to the house.',
          static_shot_description_cn: '艾玛开车到达房子。',
          shot_perspective_design_en: 'Full shot.',
          shot_perspective_design_cn: '全景。',
        },
      ],
    },
    {
      story_id: '05',
      story_type_en: 'comedy',
      story_type_cn: '喜剧',
      characters: [
        {
          id: 'max',
          name_en: 'Max',
          name_cn: '马克斯',
          prompt_en: 'A clumsy young man.',
          prompt_cn: '一个笨拙的年轻人。',
          tag: 'realistic',
          image_paths: ['image/max/00.jpg'],
        },
      ],
      shots: [
        {
          plot_correspondence_en: 'Max tries to cook dinner.',
          plot_correspondence_cn: '马克斯试图做晚餐。',
          setting_description_en: 'Messy kitchen.',
          setting_description_cn: '凌乱的厨房。',
          characters_appearing_en: 'Max',
          characters_appearing_cn: '马克斯',
          static_shot_description_en: 'Max is in the kitchen.',
          static_shot_description_cn: '马克斯在厨房里。',
          shot_perspective_design_en: 'Medium shot.',
          shot_perspective_design_cn: '中景。',
        },
      ],
    },
  ];
}
