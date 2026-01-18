import { ModelConfig, ModelParameter } from "../types";

/**
 * Common parameters for all image models
 */
const COMMON_IMAGE_PARAMS: ModelParameter[] = [
  {
    name: "guidanceScale",
    label: "Guidance Scale",
    type: "number",
    defaultValue: 3.5,
    min: 1,
    max: 20,
    step: 0.1,
  },
  {
    name: "seed",
    label: "Seed",
    type: "number",
    defaultValue: -1,
    description: "Random seed (-1 for random)",
  },
];

const COMMON_VOLC_VIDEO_PARAMS: ModelParameter[] = [
  {
    name: "resolution",
    label: "Resolution",
    type: "select",
    options: [
      { label: "480p", value: "480p" },
      { label: "720p", value: "720p" },
      { label: "1080p", value: "1080p" },
    ],
    defaultValue: "720p",
  },
  {
    name: "seed",
    label: "Seed",
    type: "number",
    defaultValue: -1,
    description: "Random seed (-1 for random)",
  },
  {
    name: "watermark",
    label: "Watermark",
    type: "boolean",
    defaultValue: false,
  },
  // {
  //   name: "returnLastFrame",
  //   label: "Return Last Frame",
  //   type: "boolean",
  //   defaultValue: false,
  // },
  {
    name: "cameraFixed",
    label: "Camera Fixed",
    type: "boolean",
    defaultValue: false,
  },
];

const COMMON_VIDU_PARAMS: ModelParameter[] = [
  {
    name: "bgm",
    label: "Background Music",
    type: "boolean",
    defaultValue: false,
    hiddenCondition: {
        // Vidu: BGM NOT supported in Img2Video (Start Frame Only)
        // Img2Video is "first_last_frame" AND hasEndImage=false
        generationType: ["first_last_frame"],
        hasEndImage: false,
    },
  },
  {
    name: "seed",
    label: "Seed",
    type: "number",
    defaultValue: 0,
    description: "Random seed (0 for random)",
  },
  {
    name: "watermark",
    label: "Watermark",
    type: "boolean",
    defaultValue: false,
  },
  {
    name: "offPeak",
    label: "Off Peak",
    type: "boolean",
    defaultValue: false,
  },
];

const VIDU_MOVEMENT_PARAM: ModelParameter = {
  name: "movementAmplitude",
  label: "Movement Amplitude",
  type: "select",
  options: [
    { label: "Auto", value: "auto" },
    { label: "Small", value: "small" },
    { label: "Medium", value: "medium" },
    { label: "Large", value: "large" },
  ],
  defaultValue: "auto",
};

const VIDU_AUDIO_PARAMS: ModelParameter[] = [
  {
    name: "generateAudio",
    label: "Generate Audio",
    type: "boolean",
    defaultValue: false,
    description: "Generate video with sound",
    visibilityCondition: {
      // Vidu: Audio supported in Text-to-Video, Multi-Ref, and Start-Frame-Only (Img2Video)
      // NOT supported in Start-End Frame mode (hasEndImage=true)
      hasEndImage: false, 
    },
  },
];

const VIDU_REC_PARAMS: ModelParameter[] = [
  // {
  //   name: "isRec",
  //   label: "Recommend Prompt",
  //   type: "boolean",
  //   defaultValue: false,
  //   description: "Use AI recommended prompt",
  // },
];

const VIDU_STYLE_PARAMS: ModelParameter[] = [
  // {
  //   name: "style",
  //   label: "Style",
  //   type: "select",
  //   options: [
  //     { label: "General", value: "general" },
  //     { label: "Anime", value: "anime" },
  //   ],
  //   defaultValue: "general",
  // },
];

const VOLC_IMAGE_ASPECT_RATIOS = [
  { label: "1:1", value: "1:1" },
  { label: "4:3", value: "4:3" },
  { label: "3:4", value: "3:4" },
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
  { label: "3:2", value: "3:2" },
  { label: "2:3", value: "2:3" },
  { label: "21:9", value: "21:9" },
];

/**
 * Default Model Configurations
 * This is the single source of truth for all models in the system.
 *
 * Naming Convention:
 * - id: Internal unique identifier (e.g., 'provider-type-name-version')
 * - modelId: The actual model ID string sent to the API provider
 */
export const DEFAULT_MODELS: ModelConfig[] = [
  // --- Image Models (Volcengine) ---
  {
    id: "volc-img-seedream-4.5",
    name: "Doubao Seedream 4.5",
    provider: "volcengine",
    modelId: "doubao-seedream-4-5-251128",
    type: "image",
    capabilities: {
      supportsReferenceImage: true,
      maxReferenceImages: 10,
      maxBatchSize: 4,
      supportedResolutions: ["2K", "4K"],
      defaultResolution: "2K",
      minPixels: 3686400,
      maxPixels: 16777216,
      minAspectRatio: 0.0625,
      maxAspectRatio: 16,
    },
    providerOptions: { volcengine: { strategy: "seedream-4" } },
    parameters: [
      ...COMMON_IMAGE_PARAMS,
      {
        name: "resolution",
        label: "Resolution",
        type: "select",
        options: [
          { label: "2K", value: "2K" },
          { label: "4K", value: "4K" },
        ],
        defaultValue: "2K",
      },
      {
        name: "aspectRatio",
        label: "Ratio",
        type: "select",
        options: VOLC_IMAGE_ASPECT_RATIOS,
        defaultValue: "16:9",
      },
      {
        name: "watermark",
        label: "Watermark",
        type: "boolean",
        defaultValue: false,
      },
    ],
  },
  {
    id: "volc-img-seedream-4.0",
    name: "Doubao Seedream 4.0",
    provider: "volcengine",
    modelId: "doubao-seedream-4-0-250828",
    type: "image",
    capabilities: {
      supportsReferenceImage: true,
      maxReferenceImages: 10,
      supportedResolutions: ["1K", "2K", "4K"],
      defaultResolution: "2K",
      minPixels: 921600,
      maxPixels: 16777216,
      minAspectRatio: 0.0625,
      maxAspectRatio: 16,
    },
    providerOptions: { volcengine: { strategy: "seedream-4" } },
    parameters: [
      ...COMMON_IMAGE_PARAMS,
      {
        name: "resolution",
        label: "Resolution",
        type: "select",
        options: [
          { label: "1K", value: "1K" },
          { label: "2K", value: "2K" },
          { label: "4K", value: "4K" },
        ],
        defaultValue: "2K",
      },
      {
        name: "aspectRatio",
        label: "Ratio",
        type: "select",
        options: VOLC_IMAGE_ASPECT_RATIOS,
        defaultValue: "16:9",
      },
      {
        name: "watermark",
        label: "Watermark",
        type: "boolean",
        defaultValue: false,
      },
    ],
  },
  {
    id: "volc-img-seedream-3.0-t2i",
    name: "Doubao Seedream 3.0 T2I",
    provider: "volcengine",
    modelId: "doubao-seedream-3-0-t2i-250415",
    type: "image",
    capabilities: {
      supportsReferenceImage: false,
      maxBatchSize: 1,
      appendCountToPrompt: false,
      supportedResolutions: ["1K"],
      defaultResolution: "1K",
      minPixels: 262144,
      maxPixels: 4194304,
    },
    providerOptions: {
      volcengine: { strategy: "seedream-3", disableSequential: true },
    },
    parameters: [
      ...COMMON_IMAGE_PARAMS,
      {
        name: "resolution",
        label: "Resolution",
        type: "select",
        options: [{ label: "1K", value: "1K" }],
        defaultValue: "1K",
      },
      {
        name: "aspectRatio",
        label: "Ratio",
        type: "select",
        options: VOLC_IMAGE_ASPECT_RATIOS,
        defaultValue: "16:9",
      },
      {
        name: "watermark",
        label: "Watermark",
        type: "boolean",
        defaultValue: true,
      },
      {
        name: "responseFormat",
        label: "Format",
        type: "select",
        options: [
          { label: "Base64", value: "b64_json" },
          { label: "URL", value: "url" },
        ],
        defaultValue: "b64_json",
      },
    ],
  },

  // --- Image Models (Vidu) ---
  {
    id: "vidu-img-q2",
    name: "Vidu Q2 (Image)",
    provider: "vidu",
    modelId: "viduq2",
    type: "image",
    capabilities: {
      supportsReferenceImage: true,
      maxReferenceImages: 7,
      requiresImageInput: false, // Text-to-Image supported
      supportedResolutions: ["1080p", "2K", "4K"],
      defaultResolution: "1080p",
    },
    parameters: [
      ...COMMON_IMAGE_PARAMS,
      {
        name: "resolution",
        label: "Resolution",
        type: "select",
        options: [
          { label: "1080p (1K)", value: "1080p" },
          { label: "2K", value: "2K" },
          { label: "4K", value: "4K" },
        ],
        defaultValue: "1080p",
      },
      {
        name: "aspectRatio",
        label: "Ratio",
        type: "select",
        options: [
          { label: "Auto", value: "auto" },
          { label: "16:9", value: "16:9" },
          { label: "9:16", value: "9:16" },
          { label: "1:1", value: "1:1" },
          { label: "4:3", value: "4:3" },
          { label: "3:4", value: "3:4" },
          { label: "21:9", value: "21:9" },
          { label: "2:3", value: "2:3" },
          { label: "3:2", value: "3:2" },
        ],
        defaultValue: "16:9",
      },
    ],
  },
  {
    id: "vidu-img-q1",
    name: "Vidu Q1 (Image)",
    provider: "vidu",
    modelId: "viduq1",
    type: "image",
    capabilities: {
      supportsReferenceImage: true,
      maxReferenceImages: 7,
      requiresImageInput: true, // Reference-to-Image only
      supportedResolutions: ["1080p"],
      defaultResolution: "1080p",
    },
    parameters: [
      ...COMMON_IMAGE_PARAMS,
      {
        name: "resolution",
        label: "Resolution",
        type: "select",
        options: [{ label: "1080p (1K)", value: "1080p" }],
        defaultValue: "1080p",
      },
      {
        name: "aspectRatio",
        label: "Ratio",
        type: "select",
        options: [
          { label: "Auto", value: "auto" },
          { label: "16:9", value: "16:9" },
          { label: "9:16", value: "9:16" },
          { label: "1:1", value: "1:1" },
          { label: "4:3", value: "4:3" },
          { label: "3:4", value: "3:4" },
        ],
        defaultValue: "16:9",
      },
    ],
  },

  // --- Video Models (Vidu) ---
  {
    id: "vidu-vid-2.0",
    name: "Vidu 2.0 (Fast)",
    provider: "vidu",
    modelId: "vidu2.0",
    type: "video",
    capabilities: {
      supportsStartFrame: true,
      supportsEndFrame: true,
      supportsReferenceImage: true,
      maxReferenceImages: 3,
      supportedGenerationTypes: [
        "text_to_video",
        "first_last_frame",
        "multi_ref",
      ],
      requiresImageInput: false,
      supportsAudioGeneration: true,
    },
    parameters: [
      ...COMMON_VIDU_PARAMS,
      VIDU_MOVEMENT_PARAM,
      ...VIDU_AUDIO_PARAMS,
      ...VIDU_REC_PARAMS,
      {
        name: "duration",
        label: "Duration",
        type: "select",
        options: [
          { label: "4s", value: 4 },
          { label: "8s", value: 8 },
        ],
        defaultValue: 4,
      },
      {
        name: "aspectRatio",
        label: "Ratio",
        type: "select",
        options: [
          { label: "16:9", value: "16:9" },
          { label: "9:16", value: "9:16" },
          { label: "1:1", value: "1:1" },
          { label: "4:3", value: "4:3" },
          { label: "3:4", value: "3:4" },
        ],
        defaultValue: "16:9",
      },
      {
        name: "resolution",
        label: "Resolution",
        type: "select",
        options: [
          { label: "360p", value: "360p" },
          { label: "720p", value: "720p" },
          { label: "1080p", value: "1080p" },
        ],
        defaultValue: "360p",
      },
    ],
  },
  {
    id: "vidu-vid-q2",
    name: "Vidu Q2 (Standard)",
    provider: "vidu",
    modelId: "viduq2",
    type: "video",
    capabilities: {
      supportsStartFrame: false,
      supportsEndFrame: false,
      supportsReferenceImage: true,
      maxReferenceImages: 7,
      supportedGenerationTypes: ["text_to_video", "multi_ref"],
      requiresImageInput: false,
    },
    parameters: [
      ...COMMON_VIDU_PARAMS,
      // No Movement, No Audio for Standard Text/Ref
      {
        name: "duration",
        label: "Duration",
        type: "number",
        defaultValue: 5,
        min: 1,
        max: 10,
        step: 1,
      },
      {
        name: "aspectRatio",
        label: "Ratio",
        type: "select",
        options: [
          { label: "16:9", value: "16:9" },
          { label: "9:16", value: "9:16" },
          { label: "1:1", value: "1:1" },
        ],
        defaultValue: "16:9",
      },
      {
        name: "resolution",
        label: "Resolution",
        type: "select",
        options: [
          { label: "540p", value: "540p" },
          { label: "720p", value: "720p" },
          { label: "1080p", value: "1080p" },
        ],
        defaultValue: "720p",
      },
    ],
  },
  {
    id: "vidu-vid-q2-pro",
    name: "Vidu Q2 Pro (Detail)",
    provider: "vidu",
    modelId: "viduq2-pro",
    type: "video",
    capabilities: {
      supportsStartFrame: true,
      supportsEndFrame: true,
      supportsReferenceImage: false,
      supportedGenerationTypes: ["first_last_frame"],
      requiresImageInput: true,
      supportsAudioGeneration: true,
    },
    parameters: [
      ...COMMON_VIDU_PARAMS,
      VIDU_MOVEMENT_PARAM,
      ...VIDU_AUDIO_PARAMS,
      ...VIDU_REC_PARAMS,
      {
        name: "duration",
        label: "Duration",
        type: "number",
        defaultValue: 5,
        min: 1,
        max: 10,
        step: 1,
      },
      {
        name: "aspectRatio",
        label: "Ratio",
        type: "select",
        options: [
          { label: "16:9", value: "16:9" },
          { label: "9:16", value: "9:16" },
          { label: "4:3", value: "4:3" },
          { label: "3:4", value: "3:4" },
          { label: "1:1", value: "1:1" },
        ],
        defaultValue: "16:9",
      },
      {
        name: "resolution",
        label: "Resolution",
        type: "select",
        options: [
          { label: "540p", value: "540p" },
          { label: "720p", value: "720p" },
          { label: "1080p", value: "1080p" },
        ],
        defaultValue: "720p",
      },
    ],
  },
  {
    id: "vidu-vid-q2-turbo",
    name: "Vidu Q2 Turbo (Balanced)",
    provider: "vidu",
    modelId: "viduq2-turbo",
    type: "video",
    capabilities: {
      supportsStartFrame: true,
      supportsEndFrame: true,
      supportsReferenceImage: false,
      supportedGenerationTypes: ["first_last_frame"],
      requiresImageInput: true,
      supportsAudioGeneration: true,
    },
    parameters: [
      ...COMMON_VIDU_PARAMS,
      VIDU_MOVEMENT_PARAM,
      ...VIDU_AUDIO_PARAMS,
      ...VIDU_REC_PARAMS,
      {
        name: "duration",
        label: "Duration",
        type: "number",
        defaultValue: 5,
        min: 1,
        max: 10,
        step: 1,
      },
      {
        name: "aspectRatio",
        label: "Ratio",
        type: "select",
        options: [
          { label: "16:9", value: "16:9" },
          { label: "9:16", value: "9:16" },
          { label: "4:3", value: "4:3" },
          { label: "3:4", value: "3:4" },
          { label: "1:1", value: "1:1" },
        ],
        defaultValue: "16:9",
      },
      {
        name: "resolution",
        label: "Resolution",
        type: "select",
        options: [
          { label: "540p", value: "540p" },
          { label: "720p", value: "720p" },
          { label: "1080p", value: "1080p" },
        ],
        defaultValue: "720p",
      },
    ],
  },
  {
    id: "vidu-vid-q2-pro-fast",
    name: "Vidu Q2 Pro Fast (Eco)",
    provider: "vidu",
    modelId: "viduq2-pro-fast",
    type: "video",
    capabilities: {
      supportsStartFrame: true,
      supportsEndFrame: true,
      supportsReferenceImage: false,
      supportedGenerationTypes: ["first_last_frame"],
      requiresImageInput: true,
      supportsAudioGeneration: true,
    },
    parameters: [
      ...COMMON_VIDU_PARAMS,
      VIDU_MOVEMENT_PARAM,
      ...VIDU_AUDIO_PARAMS,
      ...VIDU_REC_PARAMS,
      {
        name: "duration",
        label: "Duration",
        type: "number",
        defaultValue: 5,
        min: 1,
        max: 10,
        step: 1,
      },
      {
        name: "aspectRatio",
        label: "Ratio",
        type: "select",
        options: [
          { label: "16:9", value: "16:9" },
          { label: "9:16", value: "9:16" },
          { label: "4:3", value: "4:3" },
          { label: "3:4", value: "3:4" },
          { label: "1:1", value: "1:1" },
        ],
        defaultValue: "16:9",
      },
      {
        name: "resolution",
        label: "Resolution",
        type: "select",
        options: [
          { label: "720p", value: "720p" },
          { label: "1080p", value: "1080p" },
        ],
        defaultValue: "720p",
      },
    ],
  },
  {
    id: "vidu-vid-q1-classic",
    name: "Vidu Q1 Classic (Rich)",
    provider: "vidu",
    modelId: "viduq1-classic",
    type: "video",
    capabilities: {
      supportsStartFrame: true,
      supportsEndFrame: true,
      supportsReferenceImage: false,
      supportedGenerationTypes: ["first_last_frame"],
      requiresImageInput: true,
      supportsAudioGeneration: true,
    },
    parameters: [
      ...COMMON_VIDU_PARAMS,
      VIDU_MOVEMENT_PARAM,
      ...VIDU_AUDIO_PARAMS,
      ...VIDU_REC_PARAMS,
      {
        name: "duration",
        label: "Duration",
        type: "select",
        options: [{ label: "5s", value: 5 }],
        defaultValue: 5,
      },
      {
        name: "resolution",
        label: "Resolution",
        type: "select",
        options: [{ label: "1080p", value: "1080p" }],
        defaultValue: "1080p",
      },
      {
        name: "aspectRatio",
        label: "Ratio",
        type: "select",
        options: [
          { label: "16:9", value: "16:9" },
          { label: "9:16", value: "9:16" },
          { label: "1:1", value: "1:1" },
        ],
        defaultValue: "16:9",
      },
    ],
  },
  {
    id: "vidu-vid-q1",
    name: "Vidu Q1 (Stable)",
    provider: "vidu",
    modelId: "viduq1",
    type: "video",
    capabilities: {
      supportsStartFrame: true,
      supportsEndFrame: true,
      supportsReferenceImage: true,
      maxReferenceImages: 7,
      supportedGenerationTypes: [
        "text_to_video",
        "first_last_frame",
        "multi_ref",
      ],
      requiresImageInput: false,
      supportsAudioGeneration: true,
    },
    parameters: [
      ...COMMON_VIDU_PARAMS,
      VIDU_MOVEMENT_PARAM,
      ...VIDU_AUDIO_PARAMS,
      ...VIDU_REC_PARAMS,
      ...VIDU_STYLE_PARAMS, // Style for text2video
      {
        name: "duration",
        label: "Duration",
        type: "select",
        options: [{ label: "5s", value: 5 }],
        defaultValue: 5,
      },
      {
        name: "resolution",
        label: "Resolution",
        type: "select",
        options: [{ label: "1080p", value: "1080p" }],
        defaultValue: "1080p",
      },
      {
        name: "aspectRatio",
        label: "Ratio",
        type: "select",
        options: [
          { label: "16:9", value: "16:9" },
          { label: "9:16", value: "9:16" },
          { label: "1:1", value: "1:1" },
        ],
        defaultValue: "16:9",
      },
    ],
  },

  // --- Video Models (Volcengine) ---
  {
    id: "volc-vid-seedance-1.5-pro",
    name: "Doubao Seedance 1.5 Pro",
    provider: "volcengine",
    modelId: "doubao-seedance-1-5-pro-251215",
    type: "video",
    capabilities: {
      supportsStartFrame: true,
      supportsEndFrame: true,
      supportsAudioGeneration: true,
      supportedGenerationTypes: ["text_to_video", "first_last_frame"],
    },
    parameters: [
      ...COMMON_VOLC_VIDEO_PARAMS,
      {
        name: "generateAudio",
        label: "Generate Audio",
        type: "boolean",
        defaultValue: true,
      },
      {
        name: "aspectRatio",
        label: "Ratio",
        type: "select",
        options: [
          { label: "16:9", value: "16:9" },
          { label: "9:16", value: "9:16" },
          { label: "3:4", value: "3:4" },
          { label: "4:3", value: "4:3" },
          { label: "Adaptive", value: "adaptive" },
        ],
        defaultValue: "16:9",
      },
      {
        name: "duration",
        label: "Duration",
        type: "number",
        defaultValue: 5,
        min: 3,
        max: 10,
        step: 1,
        description: "Video duration in seconds",
      },
    ],
  },
  {
    id: "volc-vid-seedance-1.0-pro",
    name: "Doubao Seedance 1.0 Pro",
    provider: "volcengine",
    modelId: "doubao-seedance-1-0-pro-250528",
    type: "video",
    capabilities: {
      supportsStartFrame: true,
      supportsEndFrame: true,
      supportedGenerationTypes: ["text_to_video", "first_last_frame"],
    },
    parameters: [
      ...COMMON_VOLC_VIDEO_PARAMS,
      {
        name: "aspectRatio",
        label: "Ratio",
        type: "select",
        options: [
          { label: "16:9", value: "16:9" },
          { label: "9:16", value: "9:16" },
          { label: "3:4", value: "3:4" },
          { label: "4:3", value: "4:3" },
        ],
        defaultValue: "16:9",
      },
      {
        name: "duration",
        label: "Duration",
        type: "number",
        defaultValue: 5,
        min: 3,
        max: 10,
        step: 1,
      },
    ],
  },
  {
    id: "volc-vid-seedance-1.0-pro-fast",
    name: "Doubao Seedance 1.0 Pro Fast",
    provider: "volcengine",
    modelId: "doubao-seedance-1-0-pro-fast-251015",
    type: "video",
    capabilities: {
      supportsStartFrame: true,
      supportsEndFrame: false,
      supportedGenerationTypes: ["text_to_video", "first_last_frame"],
    },
    parameters: [
      ...COMMON_VOLC_VIDEO_PARAMS,
      {
        name: "aspectRatio",
        label: "Ratio",
        type: "select",
        options: [
          { label: "16:9", value: "16:9" },
          { label: "9:16", value: "9:16" },
          { label: "3:4", value: "3:4" },
          { label: "4:3", value: "4:3" },
          { label: "1:1", value: "1:1" },
        ],
        defaultValue: "16:9",
      },
      {
        name: "duration",
        label: "Duration",
        type: "number",
        defaultValue: 5,
        min: 3,
        max: 5,
        step: 1,
      },
    ],
  },
  {
    id: "volc-vid-seedance-1.0-lite-i2v",
    name: "Doubao Seedance 1.0 Lite I2V (Multi-Ref)",
    provider: "volcengine",
    modelId: "doubao-seedance-1-0-lite-i2v-250428",
    type: "video",
    capabilities: {
      supportsStartFrame: true,
      supportsEndFrame: false,
      supportsReferenceImage: true,
      maxReferenceImages: 10,
      requiresImageInput: true,
      supportedGenerationTypes: ["first_last_frame", "multi_ref"],
    },
    parameters: [
      ...COMMON_VOLC_VIDEO_PARAMS,
      {
        name: "aspectRatio",
        label: "Ratio",
        type: "select",
        options: [
          { label: "16:9", value: "16:9" },
          { label: "9:16", value: "9:16" },
          { label: "3:4", value: "3:4" },
          { label: "4:3", value: "4:3" },
        ],
        defaultValue: "16:9",
      },
      {
        name: "duration",
        label: "Duration",
        type: "number",
        defaultValue: 5,
        min: 3,
        max: 5,
        step: 1,
      },
    ],
  },
];

/**
 * Find a model configuration by Config ID
 */
export function findModelConfig(identifier: string): ModelConfig | undefined {
  if (!identifier) return undefined;
  return DEFAULT_MODELS.find((m) => m.id === identifier);
}
