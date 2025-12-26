# Hatch 🐣

**Hatch** is a powerful, standardized project folder structure creator and footage ingest tool designed for video production workflows. Built with Electron, React, and Vite, it streamlines the setup process for editors, colorists, and VFX artists by generating consistent directory hierarchies and safely offloading media.

## Features

*   **Customizable Project Structures:** Define and save folder templates for different workflows (e.g., OG Content, Reels, Documentary, VFX).
*   **Smart Naming Conventions:** Automatically generates root folder names based on Client, Project, Type, and Date to ensure consistency.
*   **Media Ingest:** Securely copy footage from source cards to destination drives with integrity verification (file count and size checks).
*   **Cross-Platform:** Runs on macOS, Windows, and Linux.
*   **Modern UI:** A sleek, dark-themed interface built with TailwindCSS and Framer Motion.

## Tech Stack

*   **Electron:** Cross-platform desktop application framework.
*   **React:** UI library for building the interface.
*   **Vite:** Fast build tool and development server.
*   **TailwindCSS:** Utility-first CSS framework for styling.
*   **Radix UI:** Accessible, unstyled UI components.
*   **Framer Motion:** Animation library for React.
*   **Electron Store:** Simple data persistence for settings and logs.

## Installation

You can download the latest release for your platform from the [Releases](https://github.com/chasinghues/Hatch/releases) page (if available) or build it yourself.

### Development

To run the application locally:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/chasinghues/Hatch.git
    cd Hatch
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run in development mode:**
    ```bash
    npm run dev
    ```
    This will start both the Vite development server and the Electron app.

## Building

To create production builds:

*   **macOS (Universal):**
    ```bash
    npm run build:mac
    ```
*   **Windows:**
    ```bash
    npm run build:win
    ```
*   **Linux:**
    ```bash
    npm run build && npx electron-builder --linux
    ```
*   **All Platforms:**
    ```bash
    npm run build && npx electron-builder -mwl
    ```

## Usage

1.  **Select Project Type:** Choose from presets like "OG Content", "Ad Film", etc.
2.  **Enter Details:** Fill in Client Name, Project Name, and verify the Date.
3.  **Customize Structure:** Toggle folders on/off in the tree view or load a saved template.
4.  **Initialize:** Select a destination and click "Initialize Project" to create the folder hierarchy immediately.
5.  **Ingest (Optional):** a Switch to the "Ingest" tab to safely copy media from camera cards to your new project structure.

## License

[MIT](LICENSE)
