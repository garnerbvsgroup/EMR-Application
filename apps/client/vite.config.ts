import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (id.includes("socket.io-client")) {
            return "socket";
          }

          if (id.includes("react-dom") || id.includes("/react/")) {
            return "react-vendor";
          }

          if (id.includes("@react-three/postprocessing") || id.includes("/postprocessing/")) {
            return "postfx";
          }

          if (id.includes("three-stdlib")) {
            return "three-stdlib";
          }

          if (id.includes("@react-three/drei")) {
            return "drei";
          }

          if (id.includes("@react-three/fiber")) {
            return "r3f";
          }

          if (id.includes("/three/")) {
            return "three-core";
          }

          return undefined;
        },
      },
    },
  },
});