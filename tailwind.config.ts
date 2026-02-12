import type { Config } from "tailwindcss";

const config: Config = {
    darkMode: ["class"],
    content: [
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                // Nepal Flag Colors
                primary: {
                    DEFAULT: "#003893", // Nepal Blue
                    foreground: "#FFFFFF",
                },
                accent: {
                    DEFAULT: "#DC143C", // Nepal Red (Crimson)
                    foreground: "#FFFFFF",
                },
                warning: {
                    DEFAULT: "#F59E0B",
                    foreground: "#FFFFFF",
                },
                danger: {
                    DEFAULT: "#DC143C", // Nepal Red
                    foreground: "#FFFFFF",
                },
                success: {
                    DEFAULT: "#10B981",
                    foreground: "#FFFFFF",
                },
                background: {
                    DEFAULT: "#F8F9FA",
                    foreground: "#1F2937",
                },
                foreground: {
                    DEFAULT: "#1F2937",
                },
                surface: {
                    DEFAULT: "#FFFFFF",
                    foreground: "#1F2937",
                },
                text: {
                    primary: "#1F2937",
                    muted: "#6B7280",
                },
                border: "#E5E7EB",
                input: "#E5E7EB",
                ring: "#003893", // Nepal Blue
                card: {
                    DEFAULT: "#FFFFFF",
                    foreground: "#1F2937",
                },
                muted: {
                    DEFAULT: "#6B7280",
                    foreground: "#1F2937",
                },
            },
            fontFamily: {
                sans: ["Inter", "system-ui", "sans-serif"],
                mono: ["JetBrains Mono", "monospace"],
            },
            borderRadius: {
                lg: "0.5rem",
                md: "0.375rem",
                sm: "0.25rem",
            },
        },
    },
    plugins: [require("tailwindcss-animate")],
};

export default config;

