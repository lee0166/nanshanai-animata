# 🎬 Nanshan AI Animata
> **Local-First AI Video Creation Studio for Creators**

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-blue)
![Vite](https://img.shields.io/badge/Vite-6-purple)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-4-cyan)

---

## 📖 Project Introduction
**Nanshan AI Animata** is an AI video creation tool extended based on the open-source project "Kemeng AI Manju". It is designed to turn your local computer into a professional digital creation studio.

The project adopts a **Local-First** architecture, relying on file system access APIs to directly read and write local disks without cloud uploads, maximizing data privacy. The tool deeply integrates top AI models such as **Volcano Engine (Doubao)** and **Vidu**, building an efficient end-to-end workflow from character design, scene construction to final video generation.

## ✨ Core Features
### 🎨 Character Design
Generate character design sheets with stable styles and consistent images, solving the pain point of "inconsistent character images" in AI generation.
- **Multi-style Support**: Built-in presets for anime, 3D game, oil painting, realistic photography and more.
- **Batch Generation**: Generate multiple versions concurrently for quick selection of the best effect.
- **High-Fidelity Quality**: Supports 4K resolution character generation.

### 🏙️ Scene Creation
Create high-fidelity backgrounds for stories with flexible aspect ratios.
- **Custom Ratios**: Supports landscape (16:9), portrait (9:16), and square (1:1).
- **Style Consistency**: Shares style parameters with characters for unified visual harmony.

### 📦 Prop Design
Generate props, weapons, decorations and other elements to enrich details and worldbuilding.
- **Diverse Categories**: Create weapons, furniture, food and various other props.
- **Style Adaptation**: Automatically matches the overall art style of the project.
- **Visual Enhancement**: Use props as reference materials to add details for video generation.

### 🎥 Video Generation
Powered by the Vidu model, providing cinematic video generation control.
- **Image-to-Video**:
  - **Start Frame Control**: Customize the opening scene to perfectly match static assets.
  - **Start & End Frame Control**: Set the beginning and end of the scene for precise control over narrative rhythm and transitions.
- **Text-to-Video**: Generate dynamic video clips directly from text descriptions.
- **Camera Control**: Adjust push/pull, pan, zoom and other camera parameters for cinematic camerawork.

### 📂 Intelligent Asset Management
Manage AI assets just like local files, away from messy libraries.
- **Auto-Archiving**: Generated characters and scenes are automatically sorted into the corresponding `assets/` directory.
- **Visual Gallery**: Waterfall browsing mode with quick preview and drag-and-drop operations.
- **Metadata Tracking**: Automatically saves prompts and parameters for each generation, supporting one-click effect reproduction.

## ⚡ Quick Start
### Requirements
- **Node.js** (v18 or later)
- Modern browser (Chrome or Edge recommended)

### Installation & Deployment
```bash
# 1. Clone the repository
git clone https://github.com/your-username/nanshanai-animata.git

# 2. Enter the project directory
cd nanshanai-animata

# 3. Install dependencies
npm install

# 4. Start dev server
npm run dev
```

Visit `http://localhost:3000` to start creating.

## 📖 Usage Flow
Create videos in 4 steps:
1. **Configure Engines**: Enter your Volcano Engine or Vidu API keys in "Settings" (keys are only stored locally in LocalStorage).
2. **Create Project**: Select a local folder as the project root to manage all assets uniformly.
3. **Make Assets**: Generate and finalize art assets via the "Character" and "Scene" modules.
4. **Generate Video**: Enter the "Clip" module, use generated images as the start frame, describe motion instructions, and generate videos.

## 🛠️ Tech Stack
- **Frontend Framework**: [React 19](https://react.dev/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **UI Library**: [HeroUI](https://www.heroui.com/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Animation**: [Framer Motion](https://www.framer.com/motion/)
- **Routing**: [React Router](https://reactrouter.com/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)

## 🤝 Contributing
Issues and Pull Requests are welcome!

## 📄 License
This project is released under the [MIT License](LICENSE).
