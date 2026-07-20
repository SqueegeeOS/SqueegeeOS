import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

const config = {
  root: repositoryRoot,
  resolve: {
    alias: {
      "@": repositoryRoot,
    },
  },
  test: {
    include: ["components/marketing/home2-homepage.test.tsx"],
    environment: "node",
  },
};

export default config;
