export default {
  root: "/home/abied/Desktop/Truffle/worker",
  cacheDir: "/home/abied/Desktop/Truffle/fleet/outbox/S11/vite-cache",
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    cache: false,
    fsModuleCache: false,
    attachmentsDir: "/home/abied/Desktop/Truffle/fleet/outbox/S11/attachments"
  }
};
